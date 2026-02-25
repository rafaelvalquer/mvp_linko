// server/src/routes/withdraws.routes.js
import express from "express";
import mongoose from "mongoose";
import crypto from "crypto";

import { ensureAuth, tenantFromUser } from "../middleware/auth.js";
import { Workspace } from "../models/Workspace.js";
import Withdraw from "../models/Withdraw.js";
import PixDebit from "../models/PixDebit.js";
import {
  abacateCreateWithdraw,
  abacateGetWithdraw,
} from "../services/abacatepayClient.js";

const router = express.Router();

router.use(ensureAuth);
router.use(tenantFromUser);

const MIN_NET_CENTS = 350;
const PROVIDER_PIX_TYPES = [
  "CPF",
  "CNPJ",
  "PHONE",
  "EMAIL",
  "RANDOM",
  "BR_CODE",
];
const TERMINAL = new Set([
  "COMPLETE",
  "EXPIRED",
  "CANCELLED",
  "REFUNDED",
  "FAILED",
]);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getOwnerUserId(req) {
  const id =
    req.user?._id ||
    req.user?.id ||
    req.userId ||
    req.auth?.userId ||
    req.auth?.sub ||
    req.auth?.id ||
    null;

  const s = id ? String(id) : "";
  if (!s || !mongoose.isValidObjectId(s)) return null;
  return s;
}

function normalizeStatus(st) {
  const s = String(st || "")
    .trim()
    .toUpperCase();
  if (!s) return "PENDING";
  if (s === "CANCELED") return "CANCELLED";
  if (s === "COMPLETED" || s === "SUCCESS" || s === "PAID") return "COMPLETE";
  if (s === "FAILED") return "FAILED";
  if (TERMINAL.has(s)) return s;
  if (s === "PENDING" || s === "PROCESSING") return "PENDING";
  return "PENDING";
}

function isTerminalStatus(st) {
  return TERMINAL.has(normalizeStatus(st));
}

function toPublicWithdraw(doc) {
  return {
    externalId: doc.externalId,
    status: doc.status,
    requestedBy: doc.requestedBy,
    grossAmountCents: doc.grossAmountCents,
    feePct: doc.feePct,
    feeCents: doc.feeCents,
    netAmountCents: doc.netAmountCents,
    destinationPixKeyType: doc.destinationPixKeyType,
    destinationPixKeyMasked: doc.destinationPixKeyMasked,
    receiptUrl: doc.receiptUrl || "",
    providerTransactionId: doc.providerTransactionId || "",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toPublicWithdrawDetail(doc, { includeGateway = false } = {}) {
  const base = {
    ...toPublicWithdraw(doc),
    method: doc.method,
    provider: doc.provider,
    devMode: !!doc.devMode,
    description: doc.description,
    error: doc.error || undefined,
    pix: {
      type: doc?.pix?.type,
      key: doc?.pix?.key, // sempre mascarada
      description: doc?.pix?.description,
    },
  };
  if (includeGateway) base.gateway = doc.gateway;
  return base;
}

function makeExternalId(workspaceId) {
  const rand = crypto.randomBytes(4).toString("hex");
  return `withdraw_${workspaceId}_${Date.now()}_${rand}`;
}

function makeExternalIdFromIdempotencyKey(workspaceId, idemKey) {
  const h = crypto
    .createHash("sha256")
    .update(String(idemKey))
    .digest("hex")
    .slice(0, 18);
  return `withdraw_${workspaceId}_idem_${h}`;
}

function onlyDigits(v) {
  return String(v || "").replace(/\D+/g, "");
}

function normalizePixKey(type, raw) {
  const t = String(type || "")
    .trim()
    .toUpperCase();
  const v = String(raw || "").trim();
  if (!t) return { ok: false, error: "payoutPixKeyType é obrigatório." };
  if (!v) return { ok: false, error: "payoutPixKey é obrigatório." };

  if (t === "CPF") {
    const d = onlyDigits(v);
    if (d.length !== 11) return { ok: false, error: "CPF inválido." };
    return { ok: true, normalized: d };
  }

  if (t === "CNPJ") {
    const d = onlyDigits(v);
    if (d.length !== 14) return { ok: false, error: "CNPJ inválido." };
    return { ok: true, normalized: d };
  }

  if (t === "PHONE") {
    let d = onlyDigits(v);
    if (!d) return { ok: false, error: "Telefone inválido." };
    if (d.startsWith("00")) d = d.replace(/^00+/, "");
    if (!d.startsWith("55")) {
      if (d.length === 10 || d.length === 11) d = `55${d}`;
    }
    if (!(d.length === 12 || d.length === 13) || !d.startsWith("55")) {
      return { ok: false, error: "Telefone inválido (use DDD)." };
    }
    return { ok: true, normalized: d };
  }

  if (t === "EMAIL") {
    const s = v.toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(s))
      return { ok: false, error: "E-mail inválido." };
    return { ok: true, normalized: s };
  }

  if (t === "EVP") {
    const s = v.trim();
    if (s.length < 10) return { ok: false, error: "EVP inválida." };
    return { ok: true, normalized: s };
  }

  return {
    ok: false,
    error: "payoutPixKeyType inválido. Use CPF, CNPJ, PHONE, EMAIL ou EVP.",
  };
}

function maskPixKey(type, normalized) {
  const t = String(type || "")
    .trim()
    .toUpperCase();
  const v = String(normalized || "").trim();
  if (!v) return "";
  const last4 = v.slice(-4);

  if (t === "CPF") return `***.***.***-${v.slice(-2)}`;
  if (t === "CNPJ") return `**.***.***/****-${v.slice(-2)}`;

  if (t === "PHONE") {
    const d = onlyDigits(v);
    const ddd = d.startsWith("55") ? d.slice(2, 4) : d.slice(0, 2);
    return `(${ddd}) *****-${d.slice(-4)}`;
  }

  if (t === "EMAIL") {
    const [user, domain] = v.split("@");
    const u = user || "";
    const d = domain || "";
    const uMasked = u.length <= 2 ? "**" : `${u[0]}***${u.slice(-1)}`;
    const dMasked = d ? `@***${d.slice(-4)}` : "";
    return `${uMasked}${dMasked}`;
  }

  if (t === "EVP") return `****${last4}`;
  return `****${last4}`;
}

function toProviderPixType(workspacePixType) {
  const t = String(workspacePixType || "")
    .trim()
    .toUpperCase();
  if (t === "EVP") return "RANDOM";
  return t;
}

async function safeRevertWallet({ workspaceId, ownerUserId, amountCents }) {
  const cents = Math.round(Number(amountCents) || 0);
  if (!workspaceId || !ownerUserId || cents <= 0) return;

  await Workspace.updateOne(
    { _id: workspaceId, ownerUserId },
    { $inc: { walletAvailableCents: cents } },
  ).catch(() => {});
}

async function markDebitReverted({ workspaceId, withdrawId }) {
  if (!workspaceId || !withdrawId) return;

  await PixDebit.updateMany(
    {
      workspaceId,
      withdrawId,
      kind: { $in: ["AUTO_PAYOUT", "MANUAL_WITHDRAW"] },
      status: { $in: ["CREATED", "APPLIED"] },
    },
    { $set: { status: "REVERTED" } },
  ).catch(() => {});
}

/**
 * GET /api/withdraw/config
 */
router.get("/withdraw/config", async (_req, res) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  return res.json({ ok: true, feePct: 0, minNetCents: MIN_NET_CENTS });
});

/**
 * GET /api/withdraw/payout-settings
 */
router.get("/withdraw/payout-settings", async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const ownerUserId = getOwnerUserId(req);
    if (!tenantId || !ownerUserId)
      return res.status(401).json({ ok: false, error: "Unauthorized" });

    const ws = await Workspace.findOne({ _id: tenantId, ownerUserId })
      .select(
        "walletAvailableCents payoutPixKeyType payoutPixKeyMasked autoPayoutEnabled autoPayoutMinCents payoutUpdatedAt",
      )
      .lean();

    if (!ws)
      return res
        .status(404)
        .json({ ok: false, error: "Workspace não encontrado." });

    return res.json({
      ok: true,
      walletAvailableCents: Number(ws.walletAvailableCents || 0),
      payoutPixKeyType: ws.payoutPixKeyType || null,
      payoutPixKeyMasked: ws.payoutPixKeyMasked || null,
      autoPayoutEnabled: !!ws.autoPayoutEnabled,
      autoPayoutMinCents: Number(ws.autoPayoutMinCents || 0),
      payoutUpdatedAt: ws.payoutUpdatedAt || null,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * PUT /api/withdraw/payout-settings
 * Body: { payoutPixKeyType, payoutPixKey, autoPayoutEnabled, autoPayoutMinCents }
 */
router.put("/withdraw/payout-settings", async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const ownerUserId = getOwnerUserId(req);
    if (!tenantId || !ownerUserId)
      return res.status(401).json({ ok: false, error: "Unauthorized" });

    const ws = await Workspace.findOne({ _id: tenantId, ownerUserId })
      .select(
        "+payoutPixKey payoutPixKeyType payoutPixKeyMasked autoPayoutEnabled autoPayoutMinCents walletAvailableCents",
      )
      .lean();

    if (!ws)
      return res
        .status(404)
        .json({ ok: false, error: "Workspace não encontrado." });

    const body = req.body || {};

    const wantsChangeKey =
      body.payoutPixKeyType !== undefined || body.payoutPixKey !== undefined;

    let nextType = ws.payoutPixKeyType || null;
    let nextKeyRaw = ws.payoutPixKey || null;
    let nextMasked = ws.payoutPixKeyMasked || null;

    if (wantsChangeKey) {
      const t = String(body.payoutPixKeyType || nextType || "")
        .trim()
        .toUpperCase();
      const k = String(body.payoutPixKey || "").trim();

      // permite limpar chave
      if (!k) {
        nextType = null;
        nextKeyRaw = null;
        nextMasked = null;
      } else {
        const parsed = normalizePixKey(t, k);
        if (!parsed.ok)
          return res.status(400).json({ ok: false, error: parsed.error });
        nextType = t;
        nextKeyRaw = parsed.normalized;
        nextMasked = maskPixKey(t, parsed.normalized);
      }
    }

    const nextMinRaw =
      body.autoPayoutMinCents === undefined
        ? ws.autoPayoutMinCents || 0
        : body.autoPayoutMinCents;
    const nextMin = Math.trunc(Number(nextMinRaw) || 0);
    if (!Number.isFinite(nextMin) || nextMin < 0) {
      return res
        .status(400)
        .json({ ok: false, error: "autoPayoutMinCents inválido." });
    }

    const wantsAuto =
      body.autoPayoutEnabled === undefined
        ? !!ws.autoPayoutEnabled
        : !!body.autoPayoutEnabled;

    // se tentar ligar auto sem chave válida
    if (wantsAuto && (!nextType || !nextKeyRaw || !nextMasked)) {
      return res.status(400).json({
        ok: false,
        error:
          "Cadastre uma chave Pix válida para ativar a transferência automática.",
      });
    }

    // se chave removida -> força auto off
    const finalAuto = nextKeyRaw ? wantsAuto : false;

    await Workspace.updateOne(
      { _id: tenantId, ownerUserId },
      {
        $set: {
          payoutPixKeyType: nextType,
          payoutPixKey: nextKeyRaw,
          payoutPixKeyMasked: nextMasked,
          autoPayoutEnabled: finalAuto,
          autoPayoutMinCents: nextMin,
          payoutUpdatedAt: new Date(),
        },
      },
      { strict: false },
    );

    return res.json({
      ok: true,
      walletAvailableCents: Number(ws.walletAvailableCents || 0),
      payoutPixKeyType: nextType,
      payoutPixKeyMasked: nextMasked,
      autoPayoutEnabled: finalAuto,
      autoPayoutMinCents: nextMin,
      payoutUpdatedAt: new Date().toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/withdraw/create
 * Body: { amountCents }
 * Header opcional: Idempotency-Key
 */
router.post("/withdraw/create", async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const ownerUserId = getOwnerUserId(req);
    if (!tenantId || !ownerUserId)
      return res.status(401).json({ ok: false, error: "Unauthorized" });

    const amountCentsRaw =
      req.body?.amountCents ?? req.body?.grossAmountCents ?? 0;
    const grossCents = Math.round(Number(amountCentsRaw));
    const description = String(req.body?.description || "Saque do PayLink");

    if (!Number.isFinite(grossCents) || grossCents <= 0)
      return res
        .status(400)
        .json({ ok: false, error: "amountCents inválido." });

    const netCents = grossCents; // fee sempre 0
    if (netCents < MIN_NET_CENTS) {
      return res.status(400).json({
        ok: false,
        error: `Valor mínimo é R$ ${(MIN_NET_CENTS / 100).toFixed(2)}. Aumente o valor do saque.`,
      });
    }

    const idemKey =
      String(
        req.get("Idempotency-Key") || req.body?.idempotencyKey || "",
      ).trim() || "";

    const externalId = idemKey
      ? makeExternalIdFromIdempotencyKey(tenantId, idemKey)
      : makeExternalId(tenantId);

    // idempotência do endpoint
    const existing = await Withdraw.findOne({
      externalId,
      workspaceId: tenantId,
      ownerUserId,
    }).lean();

    if (existing) {
      const isAdmin =
        !!req.user?.isAdmin ||
        req.user?.role === "admin" ||
        !!req.user?.perms?.admin ||
        req.user?.admin === true;

      return res.json({
        ok: true,
        withdraw: toPublicWithdrawDetail(existing, {
          includeGateway: isAdmin || existing?.devMode === true,
        }),
      });
    }

    // carrega payout settings (com payoutPixKey bruto)
    const ws = await Workspace.findOne({ _id: tenantId, ownerUserId })
      .select(
        "+payoutPixKey payoutPixKeyType payoutPixKeyMasked walletAvailableCents",
      )
      .lean();

    if (!ws)
      return res
        .status(404)
        .json({ ok: false, error: "Workspace não encontrado." });

    if (!ws.payoutPixKeyType || !ws.payoutPixKey) {
      return res.status(400).json({
        ok: false,
        error: "Cadastre uma chave Pix em 'Conta Pix' para solicitar saque.",
      });
    }

    const providerPixType = toProviderPixType(ws.payoutPixKeyType);
    if (!PROVIDER_PIX_TYPES.includes(providerPixType)) {
      return res
        .status(400)
        .json({ ok: false, error: "Tipo de chave Pix não suportado." });
    }

    const pixMasked =
      ws.payoutPixKeyMasked || maskPixKey(ws.payoutPixKeyType, ws.payoutPixKey);

    // cria Withdraw local (antes do gateway) com chave mascarada
    let doc = await Withdraw.create({
      workspaceId: tenantId,
      ownerUserId,
      externalId,
      idempotencyKey: idemKey,
      requestedBy: "USER",
      method: "PIX",
      grossAmountCents: grossCents,
      feePct: 0,
      feeCents: 0,
      netAmountCents: netCents,
      destinationPixKeyType: ws.payoutPixKeyType,
      destinationPixKeyMasked: pixMasked,
      pix: { type: providerPixType, key: pixMasked },
      description,
      provider: "ABACATEPAY",
      status: "PENDING",
      ledgerDebited: false,
      balanceReverted: false,
    });

    // ✅ debita wallet ANTES do gateway
    const debitedWs = await Workspace.findOneAndUpdate(
      { _id: tenantId, ownerUserId, walletAvailableCents: { $gte: netCents } },
      { $inc: { walletAvailableCents: -netCents } },
      { new: true },
    ).lean();

    if (!debitedWs) {
      await Withdraw.updateOne(
        { _id: doc._id },
        {
          $set: {
            status: "FAILED",
            error: {
              code: "INSUFFICIENT_FUNDS",
              message: "Saldo insuficiente.",
            },
          },
        },
      ).catch(() => {});

      return res
        .status(400)
        .json({ ok: false, error: "Saldo insuficiente para saque." });
    }

    await Withdraw.updateOne(
      { _id: doc._id },
      { $set: { ledgerDebited: true } },
    ).catch(() => {});
    doc.ledgerDebited = true;

    // ledger idempotente do débito
    await PixDebit.create({
      workspaceId: tenantId,
      kind: "MANUAL_WITHDRAW",
      key: `manualwithdraw:${doc._id}`,
      withdrawId: doc._id,
      amountCents: netCents,
      status: "APPLIED",
      meta: { externalId },
    }).catch((e) => {
      if (e?.code !== 11000) throw e;
    });

    // cria no gateway (backend-only)
    let createResp;
    try {
      createResp = await abacateCreateWithdraw({
        externalId,
        amount: netCents,
        pix: { type: providerPixType, key: ws.payoutPixKey },
        description,
      });
    } catch (err) {
      // estorno best-effort
      await safeRevertWallet({
        workspaceId: tenantId,
        ownerUserId,
        amountCents: netCents,
      });
      await markDebitReverted({ workspaceId: tenantId, withdrawId: doc._id });

      await Withdraw.updateOne(
        { _id: doc._id },
        {
          $set: {
            status: "FAILED",
            balanceReverted: true,
            error: {
              code: "GATEWAY_CREATE_FAILED",
              message:
                err?.message ||
                "Falha ao criar saque no gateway. Tente novamente em instantes.",
            },
            gateway: { lastError: err?.details || err?.message || String(err) },
          },
        },
      ).catch(() => {});

      const failed = await Withdraw.findById(doc._id)
        .lean()
        .catch(() => null);
      return res.status(502).json({
        ok: false,
        error:
          err?.message ||
          "Falha ao criar saque no gateway. Tente novamente em instantes.",
        withdraw: failed ? toPublicWithdraw(failed) : undefined,
      });
    }

    const data = createResp?.data ?? createResp ?? {};
    const status = normalizeStatus(data.status);
    const receiptUrl = data.receiptUrl || data.receipt_url || "";
    const providerTransactionId =
      data.id || data.withdrawId || data.transactionId || "";

    await Withdraw.updateOne(
      { _id: doc._id },
      {
        $set: {
          status,
          receiptUrl,
          providerTransactionId,
          devMode: Boolean(data.devMode),
          gateway: { rawCreateResponse: createResp },
        },
      },
      { strict: false },
    ).catch(() => {});

    // short poll rápido para devolver status melhor (opcional)
    if (!isTerminalStatus(status)) {
      for (let i = 0; i < 4; i++) {
        await sleep(2000);
        try {
          const got = await abacateGetWithdraw({ externalId });
          const g = got?.data ?? got ?? {};
          const nextStatus = normalizeStatus(g.status);
          if (isTerminalStatus(nextStatus)) {
            await Withdraw.updateOne(
              { _id: doc._id },
              {
                $set: {
                  status: nextStatus,
                  receiptUrl: g.receiptUrl || g.receipt_url || receiptUrl,
                  providerTransactionId:
                    g.id ||
                    g.withdrawId ||
                    g.transactionId ||
                    providerTransactionId,
                  gateway: { ...(doc.gateway || {}), rawGetResponse: got },
                },
              },
              { strict: false },
            ).catch(() => {});
            break;
          }
        } catch {
          // ignora
        }
      }
    }

    const fresh = await Withdraw.findOne({
      externalId,
      workspaceId: tenantId,
      ownerUserId,
    }).lean();

    const isAdmin =
      !!req.user?.isAdmin ||
      req.user?.role === "admin" ||
      !!req.user?.perms?.admin ||
      req.user?.admin === true;

    return res.json({
      ok: true,
      withdraw: toPublicWithdrawDetail(fresh, {
        includeGateway: isAdmin || fresh?.devMode === true,
      }),
      walletAvailableCents: Number(debitedWs.walletAvailableCents || 0),
    });
  } catch (e) {
    if (e?.code === 11000) {
      return res
        .status(409)
        .json({
          ok: false,
          error: "Conflito ao gerar externalId. Tente novamente.",
        });
    }
    next(e);
  }
});

/**
 * GET /api/withdraw/get?externalId=...
 */
router.get("/withdraw/get", async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const ownerUserId = getOwnerUserId(req);
    const externalId = String(req.query.externalId || "").trim();

    if (!tenantId || !ownerUserId)
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (!externalId)
      return res
        .status(400)
        .json({ ok: false, error: "externalId é obrigatório." });

    const doc = await Withdraw.findOne({
      externalId,
      workspaceId: tenantId,
      ownerUserId,
    });
    if (!doc)
      return res
        .status(404)
        .json({ ok: false, error: "Saque não encontrado." });

    // best-effort sync com gateway
    try {
      const got = await abacateGetWithdraw({ externalId });
      const g = got?.data ?? got ?? {};
      const nextStatus = normalizeStatus(g.status);
      const nextReceipt = g.receiptUrl || g.receipt_url || doc.receiptUrl;

      const changed =
        nextStatus !== doc.status || nextReceipt !== doc.receiptUrl;
      if (changed) {
        doc.status = nextStatus;
        doc.receiptUrl = nextReceipt || "";
        doc.providerTransactionId =
          g.id || g.withdrawId || g.transactionId || doc.providerTransactionId;

        doc.gateway = { ...(doc.gateway || {}), rawGetResponse: got };
        await doc.save();
      }
    } catch {
      // mantém local
    }

    return res.json({ ok: true, withdraw: toPublicWithdraw(doc.toObject()) });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/withdraw/list?limit=20
 */
router.get("/withdraw/list", async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const ownerUserId = getOwnerUserId(req);
    if (!tenantId || !ownerUserId)
      return res.status(401).json({ ok: false, error: "Unauthorized" });

    const limitRaw = Number(req.query.limit ?? 20);
    const limit = Math.min(
      100,
      Math.max(1, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 20),
    );

    const docs = await Withdraw.find({ workspaceId: tenantId, ownerUserId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ ok: true, items: (docs || []).map(toPublicWithdraw) });
  } catch (e) {
    next(e);
  }
});

export default router;
