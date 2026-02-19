// server/src/routes/withdraws.routes.js
import express from "express";
import mongoose from "mongoose";
import crypto from "crypto";

import { ensureAuth, tenantFromUser } from "../middleware/auth.js";
import Withdraw from "../models/Withdraw.js";
import {
  abacateCreateWithdraw,
  abacateGetWithdraw,
} from "../services/abacatepayClient.js";

const router = express.Router();

router.use(ensureAuth);
router.use(tenantFromUser);

const PIX_TYPES = ["CPF", "CNPJ", "PHONE", "EMAIL", "RANDOM", "BR_CODE"];
const TERMINAL = new Set(["COMPLETE", "EXPIRED", "CANCELLED", "REFUNDED"]);
const MIN_NET_CENTS = 350;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * ✅ Regra nova: não existe mais comissão do produto.
 * Mantemos o campo por compatibilidade, mas sempre 0.
 */
function getCommissionPct() {
  return 0;
}

function getOwnerUserId(req) {
  // depende do ensureAuth - tenta cobrir formatos comuns
  const id =
    req.user?._id ||
    req.user?.id ||
    req.userId ||
    req.auth?.userId ||
    req.auth?.sub ||
    req.auth?.id ||
    null;

  const s = id ? String(id) : "";
  if (!s) return null;
  if (!mongoose.isValidObjectId(s)) return null;
  return s;
}

function normalizeStatus(st) {
  const s = String(st || "")
    .trim()
    .toUpperCase();
  if (!s) return "PENDING";
  if (s === "CANCELED") return "CANCELLED";
  if (s === "CANCELLED") return "CANCELLED";
  if (s === "COMPLETED" || s === "SUCCESS") return "COMPLETE";
  if (s === "PAID") return "COMPLETE";
  if (s === "FAILED") return "CANCELLED";
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
    grossAmountCents: doc.grossAmountCents,
    feePct: doc.feePct,
    feeCents: doc.feeCents,
    netAmountCents: doc.netAmountCents,
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
    method: doc.method,
    grossAmountCents: doc.grossAmountCents,
    feePct: doc.feePct,
    feeCents: doc.feeCents,
    netAmountCents: doc.netAmountCents,
    receiptUrl: doc.receiptUrl || "",
    provider: doc.provider,
    providerTransactionId: doc.providerTransactionId || "",
    devMode: !!doc.devMode,
    description: doc.description,
    pix: {
      type: doc?.pix?.type,
      key: doc?.pix?.key,
      description: doc?.pix?.description,
    },
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
  return res.json({
    ok: true,
    feePct: 0,
    minNetCents: MIN_NET_CENTS,
  });
});

/**
 * POST /api/withdraw/create
 */
router.post("/withdraw/create", async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const ownerUserId = getOwnerUserId(req);

    if (!tenantId || !ownerUserId)
      return res.status(401).json({ ok: false, error: "Unauthorized" });

    const pixType = String(req.body?.pixType || "")
      .trim()
      .toUpperCase();
    const pixKey = String(req.body?.pixKey || "").trim();
    const grossAmountCents = Number(req.body?.grossAmountCents);
    const description = String(req.body?.description || "Saque do PayLink");

    if (!PIX_TYPES.includes(pixType)) {
      return res.status(400).json({
        ok: false,
        error:
          "pixType inválido. Use CPF, CNPJ, PHONE, EMAIL, RANDOM, BR_CODE.",
      });
    }
    if (!pixKey) {
      return res
        .status(400)
        .json({ ok: false, error: "pixKey é obrigatório." });
    }
    if (!Number.isFinite(grossAmountCents) || grossAmountCents <= 0) {
      return res
        .status(400)
        .json({ ok: false, error: "grossAmountCents inválido." });
    }

    const feePct = getCommissionPct(); // sempre 0
    const grossCents = Math.round(grossAmountCents);
    const feeCents = 0;
    const netCents = grossCents;

    if (netCents < MIN_NET_CENTS) {
      return res.status(400).json({
        ok: false,
        error: `Valor líquido mínimo é R$ ${(MIN_NET_CENTS / 100).toFixed(
          2,
        )}. Aumente o valor do saque.`,
      });
    }

    const externalId = makeExternalId(tenantId);

    // cria no gateway
    let createResp;
    try {
      createResp = await abacateCreateWithdraw({
        externalId,
        amount: netCents,
        pix: { type: pixType, key: pixKey },
        description,
      });
    } catch (err) {
      const failed = await Withdraw.create({
        workspaceId: tenantId,
        ownerUserId,
        externalId,
        method: "PIX",
        grossAmountCents: grossCents,
        feePct,
        feeCents,
        netAmountCents: netCents,
        pix: { type: pixType, key: pixKey },
        description,
        provider: "ABACATEPAY",
        status: "CANCELLED",
        gateway: { lastError: err?.details || err?.message || String(err) },
      }).catch(() => null);

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

    let doc = await Withdraw.create({
      workspaceId: tenantId,
      ownerUserId,
      externalId,
      method: "PIX",
      grossAmountCents: grossCents,
      feePct,
      feeCents,
      netAmountCents: netCents,
      pix: { type: pixType, key: pixKey },
      description,
      provider: "ABACATEPAY",
      providerTransactionId,
      status,
      receiptUrl,
      devMode: Boolean(data.devMode),
      gateway: { rawCreateResponse: createResp },
    });

    // short-polling (10–15s) no backend
    if (!isTerminalStatus(doc.status)) {
      for (let i = 0; i < 5; i++) {
        await sleep(2500);

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
              g.id ||
              g.withdrawId ||
              g.transactionId ||
              doc.providerTransactionId;

            doc.gateway = {
              ...(doc.gateway || {}),
              rawGetResponse: got,
            };

            await doc.save();
          }

          if (isTerminalStatus(nextStatus)) break;
        } catch {
          // ignora tentativa e continua
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

    // gateway/debug apenas para admin ou quando o saque foi criado em devMode
    const includeGateway = isAdmin || fresh?.devMode === true;

    return res.json({
      ok: true,
      withdraw: toPublicWithdrawDetail(fresh, { includeGateway }),
    });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({
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

        doc.gateway = {
          ...(doc.gateway || {}),
          rawGetResponse: got,
        };

        await doc.save();
      }
    } catch {
      // mantém estado local
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
