// server/src/utils/pixQuota.js
import mongoose from "mongoose";
import { Workspace } from "../models/Workspace.js";
import PixDebit from "../models/PixDebit.js";

const TZ = "America/Sao_Paulo";

export const PLAN_LIMITS = Object.freeze({
  start: 20,
  pro: 50,
  business: 120,
});

export function httpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

/**
 * cycleKey "YYYY-MM" em America/Sao_Paulo
 */
export function cycleKeySP(date = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}`;
}

/**
 * Normaliza plano:
 * - free -> start
 * - premium -> pro
 */
export function normalizePlan(v) {
  const p = String(v || "")
    .trim()
    .toLowerCase();

  if (!p) return "start";
  if (p === "free") return "start";
  if (p === "premium") return "pro";

  if (p === "start" || p === "pro" || p === "business" || p === "enterprise") {
    return p;
  }

  // fallback seguro
  return "start";
}

export function limitForPlan(planRaw, enterpriseLimitRaw) {
  const plan = normalizePlan(planRaw);

  if (plan === "enterprise") {
    const n = Number(enterpriseLimitRaw);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : NaN;
  }

  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.start;
}

/**
 * Garante que o Workspace tenha pixMonthlyLimit coerente com o plano
 * (útil para compat com workspaces antigos sem pixMonthlyLimit).
 */
export async function ensurePixMonthlyLimit(workspaceId, session) {
  const ws = await Workspace.findById(workspaceId)
    .select("plan pixMonthlyLimit")
    .session(session || null);

  if (!ws) throw httpError(404, "Workspace não encontrado.");

  const plan = normalizePlan(ws.plan);
  const current = Number(ws.pixMonthlyLimit);

  // enterprise: não sobrescreve automaticamente
  if (plan === "enterprise") {
    if (!Number.isFinite(current) || current <= 0) {
      // mantém 0 se não configurado; quem cria enterprise deve setar
      // mas não quebra runtime
    }
    return;
  }

  const should = limitForPlan(plan);
  if (!Number.isFinite(current) || current <= 0 || current !== should) {
    await Workspace.updateOne(
      { _id: workspaceId },
      { $set: { pixMonthlyLimit: should, plan } },
      { session: session || undefined },
    );
  }
}

/**
 * Reseta automaticamente o ciclo (se virou o mês), de forma persistida.
 */
export async function ensureWorkspaceCycle(workspaceId, session) {
  const ck = cycleKeySP();

  await Workspace.updateOne(
    {
      _id: workspaceId,
      $or: [
        { "pixUsage.cycleKey": { $exists: false } },
        { "pixUsage.cycleKey": { $ne: ck } },
        { pixUsage: { $exists: false } },
      ],
    },
    {
      $set: {
        "pixUsage.cycleKey": ck,
        "pixUsage.used": 0,
      },
    },
    { session: session || undefined },
  );

  return ck;
}

/**
 * Calcula resumo de quota a partir de um Workspace (lean/doc).
 * Se o ciclo armazenado for antigo, considera used=0 para o ciclo atual.
 */
export function summarizeWorkspaceQuota(ws) {
  if (!ws) {
    return { cycleKey: cycleKeySP(), used: 0, limit: 0, remaining: 0 };
  }

  const nowCk = cycleKeySP();
  const storedCk = ws?.pixUsage?.cycleKey || "";
  const storedUsed = Number(ws?.pixUsage?.used ?? 0);
  const used =
    storedCk === nowCk && Number.isFinite(storedUsed) ? storedUsed : 0;

  const plan = normalizePlan(ws.plan);
  const rawLimit = Number(ws.pixMonthlyLimit);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.trunc(rawLimit)
      : plan === "enterprise"
        ? 0
        : limitForPlan(plan);

  const remaining = Math.max(0, limit - used);

  return { cycleKey: nowCk, used, limit, remaining };
}

/**
 * Pré-check (bloqueio antes de criar cobrança Pix)
 */
export async function assertPixQuotaAvailable(workspaceId) {
  if (!workspaceId) throw httpError(400, "workspaceId ausente.");

  await ensureWorkspaceCycle(workspaceId);
  await ensurePixMonthlyLimit(workspaceId);

  const ws = await Workspace.findById(workspaceId)
    .select("plan pixMonthlyLimit pixUsage")
    .lean();

  if (!ws) throw httpError(404, "Workspace não encontrado.");

  const quota = summarizeWorkspaceQuota(ws);

  if (quota.remaining <= 0) {
    throw httpError(
      402,
      "Sua cota de Pix do mês acabou. Faça upgrade do plano.",
      { ...quota },
    );
  }

  return quota;
}

/**
 * Débito idempotente e atômico:
 * - idempotência por PixDebit(unique workspaceId+eventId)
 * - update atômico de used com $expr (used < limit)
 * - reseta ciclo automaticamente se necessário
 */
export async function debitPix(workspaceId, eventId, meta) {
  const wid = String(workspaceId || "").trim();
  const eid = String(eventId || "").trim();

  if (!wid) throw httpError(400, "workspaceId ausente.");
  if (!eid) throw httpError(400, "eventId/paymentId ausente.");

  const session = await mongoose.startSession();
  let out = null;

  try {
    await session.withTransaction(async () => {
      const ck = await ensureWorkspaceCycle(wid, session);
      await ensurePixMonthlyLimit(wid, session);

      // 1) idempotência: tenta registrar o evento
      let debitDoc = null;
      try {
        const created = await PixDebit.create(
          [
            {
              workspaceId: wid,
              eventId: eid,
              cycleKey: ck,
              status: "DEBITED", // pode virar SKIPPED_QUOTA depois
              reason: "",
              meta: meta || undefined,
            },
          ],
          { session },
        );
        debitDoc = created?.[0] || null;
      } catch (e) {
        // duplicado -> já processado
        if (e?.code === 11000) {
          const existing = await PixDebit.findOne({
            workspaceId: wid,
            eventId: eid,
          })
            .session(session)
            .lean();

          const wsNow = await Workspace.findById(wid)
            .select("plan pixMonthlyLimit pixUsage")
            .session(session)
            .lean();

          const quota = summarizeWorkspaceQuota(wsNow);

          out = {
            ok: true,
            alreadyProcessed: true,
            debited: existing?.status === "DEBITED",
            status: existing?.status || "DEBITED",
            cycleKey: quota.cycleKey,
            pixMonthlyLimit: quota.limit,
            pixUsedThisCycle: quota.used,
            pixRemaining: quota.remaining,
          };
          return;
        }
        throw e;
      }

      // 2) tenta debitar 1 (condicional atômica)
      const incRes = await Workspace.updateOne(
        {
          _id: wid,
          "pixUsage.cycleKey": ck,
          $expr: { $lt: ["$pixUsage.used", "$pixMonthlyLimit"] },
        },
        { $inc: { "pixUsage.used": 1 } },
        { session },
      );

      const debited = (incRes?.modifiedCount || 0) === 1;

      if (!debited) {
        await PixDebit.updateOne(
          { _id: debitDoc._id },
          {
            $set: {
              status: "SKIPPED_QUOTA",
              reason: "quota_exceeded",
            },
          },
          { session },
        );
      }

      const wsAfter = await Workspace.findById(wid)
        .select("plan pixMonthlyLimit pixUsage")
        .session(session)
        .lean();

      const quota = summarizeWorkspaceQuota(wsAfter);

      out = {
        ok: true,
        alreadyProcessed: false,
        debited,
        status: debited ? "DEBITED" : "SKIPPED_QUOTA",
        cycleKey: quota.cycleKey,
        pixMonthlyLimit: quota.limit,
        pixUsedThisCycle: quota.used,
        pixRemaining: quota.remaining,
      };
    });

    return out;
  } finally {
    session.endSession();
  }
}
