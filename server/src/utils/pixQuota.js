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
 * cycleKey "YYYY-MM-DD" em America/Sao_Paulo
 */
export function cycleKeySP(date = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(date);
}

export function normalizePlan(v) {
  const p = String(v || "")
    .trim()
    .toLowerCase();
  if (!p) return "start";
  if (p === "start" || p === "pro" || p === "business" || p === "enterprise")
    return p;
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

function expectedCycleKey(ws) {
  const cps = ws?.subscription?.currentPeriodStart
    ? new Date(ws.subscription.currentPeriodStart)
    : null;

  if (cps && !Number.isNaN(cps.getTime())) return cycleKeySP(cps);
  return cycleKeySP(new Date());
}

/**
 * Só garante limite automaticamente quando assinatura está active.
 * Se estiver inactive/past_due/canceled, mantemos o que está no banco (normalmente 0).
 */
export async function ensurePixMonthlyLimit(workspaceId, session) {
  const ws = await Workspace.findById(workspaceId)
    .select("plan planStatus pixMonthlyLimit subscription.status")
    .session(session || null);

  if (!ws) throw httpError(404, "Workspace não encontrado.");

  const plan = normalizePlan(ws.plan);
  const current = Number(ws.pixMonthlyLimit);

  const subStatus = String(
    ws?.subscription?.status || "inactive",
  ).toLowerCase();
  const active = subStatus === "active" && ws.planStatus === "active";

  if (!active) {
    // se não tiver valor coerente, zera
    if (!Number.isFinite(current) || current < 0) {
      await Workspace.updateOne(
        { _id: workspaceId },
        { $set: { pixMonthlyLimit: 0 } },
        { session: session || undefined, strict: false },
      );
    }
    return;
  }

  if (plan === "enterprise") return;

  const should = limitForPlan(plan);
  if (!Number.isFinite(current) || current <= 0 || current !== should) {
    await Workspace.updateOne(
      { _id: workspaceId },
      { $set: { pixMonthlyLimit: should, plan } },
      { session: session || undefined, strict: false },
    );
  }
}

/**
 * Reseta o ciclo apenas quando o expectedCycleKey mudar (baseado no currentPeriodStart).
 */
export async function ensureWorkspaceCycle(workspaceId, session) {
  const ws = await Workspace.findById(workspaceId)
    .select("pixUsage subscription.currentPeriodStart")
    .session(session || null)
    .lean();

  if (!ws) throw httpError(404, "Workspace não encontrado.");

  const ck = expectedCycleKey(ws);
  const stored = ws?.pixUsage?.cycleKey || "";

  if (stored !== ck) {
    await Workspace.updateOne(
      { _id: workspaceId },
      {
        $set: {
          "pixUsage.cycleKey": ck,
          "pixUsage.used": 0,
          pixCycleKey: ck,
          pixUsedThisMonth: 0,
        },
      },
      { session: session || undefined, strict: false },
    );
  }

  return ck;
}

export function summarizeWorkspaceQuota(ws) {
  if (!ws) return { cycleKey: cycleKeySP(), used: 0, limit: 0, remaining: 0 };

  const nowCk = expectedCycleKey(ws);

  const storedCk =
    ws?.pixUsage?.cycleKey || String(ws?.pixCycleKey || "").trim() || "";
  const storedUsedRaw =
    ws?.pixUsage?.used ?? ws?.pixUsedThisMonth ?? ws?.pixUsedThisCycle ?? 0;
  const storedUsed = Number(storedUsedRaw);

  const used =
    storedCk === nowCk && Number.isFinite(storedUsed)
      ? Math.trunc(storedUsed)
      : 0;

  const rawLimit = Number(ws.pixMonthlyLimit);
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 0 ? Math.trunc(rawLimit) : 0;

  return { cycleKey: nowCk, used, limit, remaining: Math.max(0, limit - used) };
}

/**
 * Bloqueio antes de criar Pix: exige assinatura ativa.
 */
export async function assertPixQuotaAvailable(workspaceId) {
  if (!workspaceId) throw httpError(400, "workspaceId ausente.");

  await ensureWorkspaceCycle(workspaceId);
  await ensurePixMonthlyLimit(workspaceId);

  const ws = await Workspace.findById(workspaceId)
    .select(
      "plan planStatus pixMonthlyLimit pixUsage subscription.status subscription.currentPeriodEnd",
    )
    .lean();

  if (!ws) throw httpError(404, "Workspace não encontrado.");

  const subStatus = String(
    ws?.subscription?.status || "inactive",
  ).toLowerCase();
  const active = subStatus === "active" && ws.planStatus === "active";

  if (!active) {
    throw httpError(
      402,
      "Assinatura inativa ou pagamento pendente. Regularize para continuar.",
      { subscriptionStatus: subStatus, planStatus: ws.planStatus },
    );
  }

  const quota = summarizeWorkspaceQuota(ws);

  if (quota.remaining <= 0) {
    throw httpError(
      402,
      "Sua cota do ciclo acabou. Faça upgrade do plano.",
      quota,
    );
  }

  return quota;
}

export async function debitPix(workspaceId, eventId, meta) {
  const wid = String(workspaceId || "").trim();
  const eid = String(eventId || "").trim();

  if (!wid) throw httpError(400, "workspaceId ausente.");
  if (!eid) throw httpError(400, "eventId/paymentId ausente.");

  const session = await mongoose.startSession();
  let out = null;

  try {
    await session.withTransaction(async () => {
      // exige assinatura ativa
      await assertPixQuotaAvailable(wid);

      const ck = await ensureWorkspaceCycle(wid, session);
      await ensurePixMonthlyLimit(wid, session);

      let debitDoc = null;
      try {
        const created = await PixDebit.create(
          [
            {
              workspaceId: wid,
              // ✅ preencher também paymentId (antes ficava null no PIX_QUOTA)
              paymentId: eid,
              // ✅ mantém legado: alguns fluxos ainda usam eventId
              eventId: eid,
              // ✅ key explícita (não depende do pre-validate legado)
              key: `quota:pix:${eid}`,
              kind: "PIX_QUOTA",
              amountCents: 0,
              cycleKey: ck,
              status: "DEBITED",
              reason: "",
              meta: meta || undefined,
            },
          ],
          { session },
        );
        debitDoc = created?.[0] || null;
      } catch (e) {
        if (e?.code === 11000) {
          const existing = await PixDebit.findOne({
            workspaceId: wid,
            eventId: eid,
          })
            .session(session)
            .lean();

          const wsNow = await Workspace.findById(wid)
            .select(
              "plan planStatus pixMonthlyLimit pixUsage subscription.currentPeriodStart subscription.status",
            )
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

      const incRes = await Workspace.updateOne(
        {
          _id: wid,
          $expr: {
            $and: [
              {
                $eq: [{ $ifNull: ["$pixUsage.cycleKey", "$pixCycleKey"] }, ck],
              },
              {
                $lt: [
                  {
                    $ifNull: [
                      "$pixUsage.used",
                      { $ifNull: ["$pixUsedThisMonth", 0] },
                    ],
                  },
                  "$pixMonthlyLimit",
                ],
              },
            ],
          },
        },
        { $inc: { "pixUsage.used": 1, pixUsedThisMonth: 1 } },
        { session, strict: false },
      );

      const debited = (incRes?.modifiedCount || 0) === 1;

      if (!debited) {
        await PixDebit.updateOne(
          { _id: debitDoc._id },
          { $set: { status: "SKIPPED_QUOTA", reason: "quota_exceeded" } },
          { session },
        );
      }

      const wsAfter = await Workspace.findById(wid)
        .select(
          "pixMonthlyLimit pixUsage subscription.currentPeriodStart subscription.status planStatus",
        )
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
