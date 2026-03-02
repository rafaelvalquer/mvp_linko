// server/src/routes/withdraws.routes.js
import express from "express";
import mongoose from "mongoose";
import crypto from "crypto";

import { ensureAuth, tenantFromUser } from "../middleware/auth.js";
import { Workspace } from "../models/Workspace.js";
import Withdraw from "../models/Withdraw.js";
import { Workspace } from "../models/Workspace.js";
import PixDebit from "../models/PixDebit.js";
import {
  abacateCreateWithdraw,
  abacateGetWithdraw,
} from "../services/abacatepayClient.js";

const router = express.Router();

router.use(ensureAuth);
router.use(tenantFromUser);

// ===== constantes =====
const PIX_TYPES = ["CPF", "CNPJ", "PHONE", "EMAIL", "EVP", "RANDOM", "BR_CODE"];
const PAYOUT_PIX_TYPES = ["CPF", "CNPJ", "PHONE", "EMAIL", "EVP"];

const TERMINAL = new Set(["COMPLETE", "EXPIRED", "CANCELLED", "REFUNDED", "PAID", "FAILED"]);
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

// ===== helpers =====
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

function onlyDigits(v) {
  return String(v || "").replace(/\D+/g, "");
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function normalizePixKey(type, key) {
  const t = String(type || "").trim().toUpperCase();
  const raw = String(key || "").trim();

  if (!raw) return "";
  if (t === "CPF" || t === "CNPJ" || t === "PHONE") return onlyDigits(raw);
  if (t === "EMAIL") return normalizeEmail(raw);
  if (t === "EVP") return raw.trim();
  return raw.trim();
}

function isValidEmail(v) {
  const s = String(v || "").trim().toLowerCase();
  // simples e suficiente pro MVP
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isValidEvp(v) {
  const s = String(v || "").trim();
  if (!s) return false;
  // aceita UUID (com ou sem hífen) e outras chaves random (MVP)
  if (/^[0-9a-fA-F]{32}$/.test(s.replace(/-/g, ""))) return true;
  return s.length >= 8 && s.length <= 90;
}

function validatePixKey(type, key) {
  const t = String(type || "").trim().toUpperCase();
  const k = normalizePixKey(t, key);

  if (!PAYOUT_PIX_TYPES.includes(t)) return { ok: false, error: "payoutPixKeyType inválido." };
  if (!k) return { ok: false, error: "payoutPixKey é obrigatório." };

  if (t === "CPF") {
    if (k.length !== 11) return { ok: false, error: "CPF inválido." };
    return { ok: true, value: k };
  }
  if (t === "CNPJ") {
    if (k.length !== 14) return { ok: false, error: "CNPJ inválido." };
    return { ok: true, value: k };
  }
  if (t === "PHONE") {
    if (k.length < 10 || k.length > 13) return { ok: false, error: "Telefone inválido." };
    return { ok: true, value: k };
  }
  if (t === "EMAIL") {
    if (!isValidEmail(k)) return { ok: false, error: "E-mail inválido." };
    return { ok: true, value: k };
  }
  if (t === "EVP") {
    if (!isValidEvp(k)) return { ok: false, error: "EVP inválida." };
    return { ok: true, value: k };
  }

  return { ok: false, error: "Tipo de chave inválido." };
}

function maskDigits(digits, keepStart = 0, keepEnd = 2) {
  const s = onlyDigits(digits);
  if (!s) return "";
  const a = s.slice(0, keepStart);
  const b = s.slice(-keepEnd);
  const midLen = Math.max(0, s.length - keepStart - keepEnd);
  return a + "*".repeat(midLen) + b;
}

function maskEmail(email) {
  const e = normalizeEmail(email);
  if (!e || !e.includes("@")) return "";
  const [user, domain] = e.split("@");
  const u = user.length <= 2 ? user[0] + "*" : user.slice(0, 2) + "*".repeat(Math.max(1, user.length - 2));
  const dparts = String(domain || "").split(".");
  const d0 = dparts[0] ? dparts[0].slice(0, 2) + "*".repeat(Math.max(1, dparts[0].length - 2)) : "***";
  const rest = dparts.slice(1).join(".");
  return `${u}@${d0}${rest ? "." + rest : ""}`;
}

function maskPixKey(type, key) {
  const t = String(type || "").trim().toUpperCase();
  const k = normalizePixKey(t, key);

  if (!k) return "";
  if (t === "CPF") return maskDigits(k, 0, 2);
  if (t === "CNPJ") return maskDigits(k, 0, 3);
  if (t === "PHONE") return maskDigits(k, 0, 4);
  if (t === "EMAIL") return maskEmail(k);
  if (t === "EVP") {
    const s = String(k);
    if (s.length <= 8) return "*".repeat(s.length);
    return `${s.slice(0, 4)}****${s.slice(-4)}`;
  }
  return "***";
}

function gatewayPixTypeFromWorkspaceType(t) {
  const s = String(t || "").trim().toUpperCase();
  // AbacatePay costuma usar RANDOM para EVP
  if (s === "EVP") return "RANDOM";
  return s;
}

function normalizeStatus(st) {
  const s = String(st || "")
    .trim()
    .toUpperCase();
  if (!s) return "PENDING";
  if (s === "CANCELED") return "CANCELLED";
  if (s === "COMPLETED" || s === "SUCCESS") return "COMPLETE";
  if (s === "PAID") return "COMPLETE";
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
    requestedBy: doc.requestedBy || "USER",
    amountCents: Number(doc.amountCents ?? doc.netAmountCents ?? doc.grossAmountCents ?? 0),
    grossAmountCents: doc.grossAmountCents,
    feePct: doc.feePct,
    feeCents: doc.feeCents,
    netAmountCents: doc.netAmountCents,
    destinationPixKeyType: doc.destinationPixKeyType || doc?.pix?.type || null,
    destinationPixKeyMasked: doc.destinationPixKeyMasked || doc?.pix?.key || null,
    receiptUrl: doc.receiptUrl || "",
    providerTransactionId: doc.providerTransactionId || "",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toPublicWithdrawDetail(doc, { includeGateway = false } = {}) {
  const base = {
    externalId: doc.externalId,
    status: doc.status,
    requestedBy: doc.requestedBy || "USER",
    method: doc.method,
    amountCents: Number(doc.amountCents ?? doc.netAmountCents ?? doc.grossAmountCents ?? 0),
    grossAmountCents: doc.grossAmountCents,
    feePct: doc.feePct,
    feeCents: doc.feeCents,
    netAmountCents: doc.netAmountCents,
    destinationPixKeyType: doc.destinationPixKeyType || doc?.pix?.type || null,
    destinationPixKeyMasked: doc.destinationPixKeyMasked || doc?.pix?.key || null,
    receiptUrl: doc.receiptUrl || "",
    provider: doc.provider,
    devMode: !!doc.devMode,
    description: doc.description,
    error: doc.error || undefined,
    pix: {
      type: doc?.pix?.type,
      key: doc?.pix?.key, // ⚠️ para novos registros, está mascarada
      description: doc?.pix?.description,
    },
    error: doc.error || "",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  if (includeGateway) base.gateway = doc.gateway;
  return base;
}

function makeExternalId(workspaceId) {
  const rand = crypto.randomBytes(4).toString("hex");
  return `withdraw_${workspaceId}_${Date.now()}_${rand}`;
}

function noStore(res) {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
}

// =========================================================
// ✅ CONFIG (mantido)
// =========================================================
router.get("/withdraw/config", async (_req, res) => {
  noStore(res);
  return res.json({
    ok: true,
    feePct: 0,
    minNetCents: MIN_NET_CENTS,
  });
});

// =========================================================
// ✅ PAYOUT SETTINGS + WALLET
// GET /api/withdraw/payout-settings
// PUT /api/withdraw/payout-settings
// =========================================================
router.get("/withdraw/payout-settings", async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const ownerUserId = getOwnerUserId(req);

    if (!tenantId || !ownerUserId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const ws = await Workspace.findOne({ _id: tenantId, ownerUserId })
      .select("walletAvailableCents payoutPixKeyType payoutPixKeyMasked autoPayoutEnabled autoPayoutMinCents payoutUpdatedAt")
      .lean();

    if (!ws) return res.status(404).json({ ok: false, error: "Workspace não encontrado." });

    noStore(res);
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

router.put("/withdraw/payout-settings", async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const ownerUserId = getOwnerUserId(req);

    if (!tenantId || !ownerUserId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const typeIn = req.body?.payoutPixKeyType;
    const keyIn = req.body?.payoutPixKey;
    const autoIn = req.body?.autoPayoutEnabled;
    const minIn = req.body?.autoPayoutMinCents;

    // lê estado atual
    const ws = await Workspace.findOne({ _id: tenantId, ownerUserId })
      .select("payoutPixKeyType payoutPixKey payoutPixKeyMasked autoPayoutEnabled autoPayoutMinCents walletAvailableCents")
      .lean();

    if (!ws) return res.status(404).json({ ok: false, error: "Workspace não encontrado." });

    const $set = {};
    const wantUpdateKey = typeIn !== undefined || keyIn !== undefined;

    let nextType = ws.payoutPixKeyType || null;
    let nextKey = ws.payoutPixKey || null;
    let nextMasked = ws.payoutPixKeyMasked || null;

    if (wantUpdateKey) {
      const t = String(typeIn || nextType || "").trim().toUpperCase();
      const k = String(keyIn || "").trim();

      const v = validatePixKey(t, k);
      if (!v.ok) return res.status(400).json({ ok: false, error: v.error });

      nextType = t;
      nextKey = v.value;
      nextMasked = maskPixKey(t, v.value);

      $set.payoutPixKeyType = nextType;
      $set.payoutPixKey = nextKey;
      $set.payoutPixKeyMasked = nextMasked;
    }

    if (autoIn !== undefined) {
      $set.autoPayoutEnabled = !!autoIn;
    }
    if (minIn !== undefined) {
      const n = Number(minIn);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({ ok: false, error: "autoPayoutMinCents inválido." });
      }
      $set.autoPayoutMinCents = Math.trunc(n);
    }

    const nextAutoEnabled = $set.autoPayoutEnabled !== undefined ? !!$set.autoPayoutEnabled : !!ws.autoPayoutEnabled;
    const nextAutoMin = $set.autoPayoutMinCents !== undefined ? Number($set.autoPayoutMinCents) : Number(ws.autoPayoutMinCents || 0);

    // Se autoPayoutEnabled ON, exigir chave configurada
    const effectiveMasked = wantUpdateKey ? nextMasked : ws.payoutPixKeyMasked;
    const effectiveType = wantUpdateKey ? nextType : ws.payoutPixKeyType;
    const effectiveKey = wantUpdateKey ? nextKey : ws.payoutPixKey;

    if (nextAutoEnabled) {
      if (!effectiveType || !effectiveKey || !effectiveMasked) {
        return res.status(400).json({
          ok: false,
          error: "Cadastre uma chave Pix válida para habilitar a transferência automática.",
        });
      }
    }

    $set.payoutUpdatedAt = new Date();

    const updated = await Workspace.findOneAndUpdate(
      { _id: tenantId, ownerUserId },
      { $set },
      { new: true },
    )
      .select("walletAvailableCents payoutPixKeyType payoutPixKeyMasked autoPayoutEnabled autoPayoutMinCents payoutUpdatedAt")
      .lean();

    noStore(res);
    return res.json({
      ok: true,
      walletAvailableCents: Number(updated?.walletAvailableCents || 0),
      payoutPixKeyType: updated?.payoutPixKeyType || null,
      payoutPixKeyMasked: updated?.payoutPixKeyMasked || null,
      autoPayoutEnabled: !!updated?.autoPayoutEnabled,
      autoPayoutMinCents: Number(updated?.autoPayoutMinCents || 0),
      payoutUpdatedAt: updated?.payoutUpdatedAt || null,
    });
  } catch (e) {
    next(e);
  }
});

// =========================================================
// ✅ SAQUE (manual) - agora usando wallet + chave Pix do Workspace
// POST /api/withdraw/create
// =========================================================
router.post("/withdraw/create", async (req, res, next) => {
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

    // compat: amountCents (novo) ou grossAmountCents (antigo)
    const amountCentsRaw =
      req.body?.amountCents !== undefined
        ? req.body.amountCents
        : req.body?.grossAmountCents;

    const amountCents = Math.round(Number(amountCentsRaw));
    const description = String(req.body?.description || "Saque do PayLink");

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return res.status(400).json({ ok: false, error: "amountCents inválido." });
    }
    if (amountCents < MIN_NET_CENTS) {
      return res.status(400).json({
        ok: false,
        error: `Valor mínimo é R$ ${(MIN_NET_CENTS / 100).toFixed(2)}.`,
      });
    }

    // lê workspace e valida chave Pix
    const ws = await Workspace.findOne({ _id: tenantId, ownerUserId })
      .select("walletAvailableCents payoutPixKeyType payoutPixKey payoutPixKeyMasked")
      .lean();

    if (!ws) return res.status(404).json({ ok: false, error: "Workspace não encontrado." });

    if (!ws.payoutPixKeyType || !ws.payoutPixKey || !ws.payoutPixKeyMasked) {
      return res.status(400).json({
        ok: false,
        error: "Cadastre uma chave Pix de recebimento antes de solicitar saque.",
      });
    }

    const pixType = String(ws.payoutPixKeyType || "").trim().toUpperCase();
    const pixKeyRaw = String(ws.payoutPixKey || "").trim();
    const pixKeyMasked = String(ws.payoutPixKeyMasked || "").trim();

    if (!PAYOUT_PIX_TYPES.includes(pixType) || !pixKeyRaw) {
      return res.status(400).json({
        ok: false,
        error: "Chave Pix do workspace inválida. Reconfigure no modal de Saque.",
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

    // ✅ 1) débito atômico do wallet antes do gateway
    const debitedWs = await Workspace.findOneAndUpdate(
      { _id: tenantId, ownerUserId, walletAvailableCents: { $gte: amountCents } },
      { $inc: { walletAvailableCents: -amountCents } },
      { new: true },
    )
      .select("walletAvailableCents")
      .lean();

    if (!debitedWs) {
      return res.status(400).json({ ok: false, error: "Saldo insuficiente para saque." });
    }

    // ✅ 2) cria ledger idempotente do saque manual
    const debitKey = `manual:withdraw:${externalId}`;
    const debit = await PixDebit.create({
      workspaceId: tenantId,
      withdrawId: null,
      key: debitKey,
      kind: "MANUAL_WITHDRAW",
      amountCents,
      status: "APPLIED",
      reason: "",
      meta: { externalId },
    }).catch((e) => {
      // se der conflito (extremamente raro), estorna e retorna
      if (e?.code === 11000) return null;
      throw e;
    });

    if (!debit) {
      await Workspace.updateOne(
        { _id: tenantId, ownerUserId },
        { $inc: { walletAvailableCents: amountCents } },
      ).catch(() => {});
      return res.status(409).json({ ok: false, error: "Conflito ao registrar saque. Tente novamente." });
    }

    // ✅ 3) cria Withdraw local ANTES do gateway (para auditoria)
    let doc = await Withdraw.create({
      workspaceId: tenantId,
      ownerUserId,
      requestedBy: "USER",
      externalId,
      method: "PIX",
      amountCents,
      grossAmountCents: amountCents,
      feePct: 0,
      feeCents: 0,
      netAmountCents: amountCents,
      destinationPixKeyType: pixType,
      destinationPixKeyMasked: pixKeyMasked,
      pix: { type: pixType, key: pixKeyMasked },
      description,
      provider: "ABACATEPAY",
      status: "PENDING",
      error: "",
    });

    // associa withdrawId no ledger
    await PixDebit.updateOne(
      { workspaceId: tenantId, key: debitKey },
      { $set: { withdrawId: doc._id } },
      { strict: false },
    ).catch(() => {});

    // ✅ 4) chama gateway
    let createResp;
    try {
      createResp = await abacateCreateWithdraw({
        externalId,
        amount: amountCents,
        pix: { type: gatewayPixTypeFromWorkspaceType(pixType), key: pixKeyRaw },
        description,
      });
    } catch (err) {
      // estorna wallet
      await Workspace.updateOne(
        { _id: tenantId, ownerUserId },
        { $inc: { walletAvailableCents: amountCents } },
      ).catch(() => {});

      // marca ledger revertido
      await PixDebit.updateOne(
        { workspaceId: tenantId, key: debitKey },
        {
          $set: {
            status: "REVERTED",
            reason: err?.message || "gateway_create_failed",
            meta: { ...(debit?.meta || {}), gatewayError: err?.details || err?.message || String(err) },
          },
        },
        { strict: false },
      ).catch(() => {});

      // marca Withdraw failed
      await Withdraw.updateOne(
        { _id: doc._id },
        {
          $set: {
            status: "FAILED",
            error: err?.message || "Falha ao criar saque no gateway.",
            gateway: { lastError: err?.details || err?.message || String(err) },
          },
        },
        { strict: false },
      ).catch(() => {});

      const freshFailed = await Withdraw.findById(doc._id).lean().catch(() => null);

      return res.status(502).json({
        ok: false,
        error:
          err?.message ||
          "Falha ao criar saque no gateway. Tente novamente em instantes.",
        withdraw: freshFailed ? toPublicWithdrawDetail(freshFailed) : undefined,
      });
    }

    // 5) atualiza doc com retorno do gateway
    const data = createResp?.data ?? createResp ?? {};
    const status = normalizeStatus(data.status);
    const receiptUrl = data.receiptUrl || data.receipt_url || "";
    const providerTransactionId =
      data.id || data.withdrawId || data.transactionId || "";

    doc.status = status;
    doc.receiptUrl = receiptUrl || "";
    doc.providerTransactionId = providerTransactionId;
    doc.devMode = Boolean(data.devMode);
    doc.gateway = { ...(doc.gateway || {}), rawCreateResponse: createResp };
    await doc.save();

    // short-polling (10–15s) no backend
    if (!isTerminalStatus(doc.status)) {
      for (let i = 0; i < 5; i++) {
        await sleep(2500);

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

// =========================================================
// GET /api/withdraw/get?externalId=...
// =========================================================
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

    noStore(res);
    return res.json({ ok: true, withdraw: toPublicWithdraw(doc.toObject()) });
  } catch (e) {
    next(e);
  }
});

// =========================================================
// GET /api/withdraw/list?limit=20
// =========================================================
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

    noStore(res);
    return res.json({ ok: true, items: (docs || []).map(toPublicWithdraw) });
  } catch (e) {
    next(e);
  }
});

export default router;
