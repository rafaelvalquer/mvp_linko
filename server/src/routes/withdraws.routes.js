// server/src/routes/withdraws.routes.js
import { Router } from "express";
import { ensureAuth, tenantFromUser } from "../middleware/auth.js";
import { Workspace } from "../models/Workspace.js";

const r = Router();
r.use(ensureAuth, tenantFromUser);

const PIX_TYPES = ["CPF", "CNPJ", "PHONE", "EMAIL", "EVP"];

function onlyDigits(v) {
  return String(v || "").replace(/\D+/g, "");
}

function clampStr(v, max) {
  const s = String(v || "").trim();
  if (!s) return null;
  return s.length <= max ? s : s.slice(0, max);
}

function normalizePixKey(type, raw) {
  const t = String(type || "").toUpperCase();
  const v = String(raw || "").trim();

  if (!v) return null;

  if (t === "CPF") {
    return onlyDigits(v);
  }
  if (t === "CNPJ") {
    return onlyDigits(v);
  }
  if (t === "EMAIL") {
    return v.toLowerCase();
  }
  if (t === "EVP") {
    return v.toLowerCase();
  }
  if (t === "PHONE") {
    // Pix phone key geralmente em E.164: +55DDDNXXXXXXXX
    let d = onlyDigits(v);
    if (!d) return null;

    // se veio 10/11 (BR sem DDI) -> +55
    if (d.length === 10 || d.length === 11) {
      return `+55${d}`;
    }

    // se veio 55 + número (12/13) -> +55...
    if ((d.length === 12 || d.length === 13) && d.startsWith("55")) {
      return `+${d}`;
    }

    // fallback: se usuário já digitou com +
    if (v.startsWith("+")) return v;

    // fallback final
    return v;
  }

  return v;
}

function maskCpf(d) {
  const x = onlyDigits(d);
  if (x.length !== 11) return "***";
  return `${x.slice(0, 3)}.***.***-${x.slice(9)}`;
}

function maskCnpj(d) {
  const x = onlyDigits(d);
  if (x.length !== 14) return "***";
  return `${x.slice(0, 2)}.***.***/****-${x.slice(12)}`;
}

function maskEmail(e) {
  const s = String(e || "").trim();
  const [u, dom] = s.split("@");
  if (!u || !dom) return "***";
  const u2 = u.length <= 2 ? `${u[0]}*` : `${u.slice(0, 2)}***`;
  return `${u2}@${dom}`;
}

function maskPhone(p) {
  const s = String(p || "").trim();
  const d = onlyDigits(s);
  const last4 = d.slice(-4);
  return `+** *****-${last4 || "****"}`;
}

function maskEvp(k) {
  const s = String(k || "").trim();
  if (s.length <= 10) return "***";
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function maskPixKey(type, key) {
  const t = String(type || "").toUpperCase();
  if (!key) return null;

  if (t === "CPF") return maskCpf(key);
  if (t === "CNPJ") return maskCnpj(key);
  if (t === "EMAIL") return maskEmail(key);
  if (t === "PHONE") return maskPhone(key);
  if (t === "EVP") return maskEvp(key);

  return "***";
}

async function findWorkspace(req) {
  const tenantId = req.tenantId;
  const userId = req.user?._id;

  if (!tenantId) {
    const err = new Error("Workspace não resolvido (tenant).");
    err.status = 400;
    throw err;
  }

  // preferível validar dono; se seu tenantFromUser já garante isso, continua ok.
  const q = { _id: tenantId };
  if (userId) q.ownerUserId = userId;

  const ws = await Workspace.findOne(q).catch(() => null);
  if (!ws) {
    const err = new Error("Workspace não encontrado.");
    err.status = 404;
    throw err;
  }
  return ws;
}

/**
 * GET /withdraw/payout-settings
 * Retorna apenas masked + tipo (não retorna chave crua)
 */
r.get("/withdraw/payout-settings", async (req, res, next) => {
  try {
    const ws = await findWorkspace(req);

    return res.json({
      ok: true,
      payoutPixKeyType: ws.payoutPixKeyType || null,
      payoutPixKeyMasked: ws.payoutPixKeyMasked || null,
      pixReceiverName: ws.pixReceiverName || null,
      pixReceiverCity: ws.pixReceiverCity || null,
      pixKeyEnabled: ws.pixKeyEnabled !== false,
      payoutUpdatedAt: ws.payoutUpdatedAt || null,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * PUT /withdraw/payout-settings
 * Body: { payoutPixKeyType, payoutPixKey, pixReceiverName?, pixReceiverCity?, pixKeyEnabled? }
 * Salva no Workspace:
 * - payoutPixKey (crua / normalizada)
 * - payoutPixKeyMasked (retorno)
 * - payoutPixKeyType
 */
r.put("/withdraw/payout-settings", async (req, res, next) => {
  try {
    const ws = await findWorkspace(req);

    const type = String(req.body?.payoutPixKeyType || "").toUpperCase();
    if (!PIX_TYPES.includes(type)) {
      return res.status(400).json({
        ok: false,
        error: "payoutPixKeyType inválido. Use CPF, CNPJ, PHONE, EMAIL ou EVP.",
      });
    }

    const rawKey = String(req.body?.payoutPixKey || "").trim();
    if (!rawKey) {
      return res.status(400).json({
        ok: false,
        error: "payoutPixKey é obrigatório.",
      });
    }

    const normalized = normalizePixKey(type, rawKey);
    if (!normalized) {
      return res.status(400).json({ ok: false, error: "Chave Pix inválida." });
    }

    // validações básicas por tipo
    if (type === "CPF" && onlyDigits(normalized).length !== 11) {
      return res.status(400).json({ ok: false, error: "CPF inválido." });
    }
    if (type === "CNPJ" && onlyDigits(normalized).length !== 14) {
      return res.status(400).json({ ok: false, error: "CNPJ inválido." });
    }
    if (type === "EMAIL" && !normalized.includes("@")) {
      return res.status(400).json({ ok: false, error: "E-mail inválido." });
    }
    if (type === "PHONE" && !String(normalized).startsWith("+")) {
      return res.status(400).json({
        ok: false,
        error: "Telefone inválido. Use DDD e número (ex.: 11999999999).",
      });
    }

    const masked = maskPixKey(type, normalized);

    // opcionais para BRCode
    const pixReceiverName = clampStr(req.body?.pixReceiverName, 25);
    const pixReceiverCity = clampStr(req.body?.pixReceiverCity, 15);
    const pixKeyEnabled =
      req.body?.pixKeyEnabled === undefined
        ? ws.pixKeyEnabled !== false
        : !!req.body.pixKeyEnabled;

    ws.payoutPixKeyType = type;
    ws.payoutPixKey = normalized;
    ws.payoutPixKeyMasked = masked;
    ws.pixReceiverName = pixReceiverName ?? ws.pixReceiverName ?? null;
    ws.pixReceiverCity = pixReceiverCity ?? ws.pixReceiverCity ?? null;
    ws.pixKeyEnabled = pixKeyEnabled;
    ws.payoutUpdatedAt = new Date();

    await ws.save();

    return res.json({
      ok: true,
      payoutPixKeyType: ws.payoutPixKeyType,
      payoutPixKeyMasked: ws.payoutPixKeyMasked,
      pixReceiverName: ws.pixReceiverName || null,
      pixReceiverCity: ws.pixReceiverCity || null,
      pixKeyEnabled: ws.pixKeyEnabled !== false,
      payoutUpdatedAt: ws.payoutUpdatedAt,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Legado de saque: desativado
 * (mantém rotas antigas para não quebrar UI legada, mas retorna 410)
 */
r.all(
  [
    "/withdraw/config",
    "/withdraw/create",
    "/withdraw/list",
    "/withdraw/get",
    "/withdraw/*",
    "/withdraws",
    "/withdraws/*",
  ],
  (req, res) => {
    return res.status(410).json({
      ok: false,
      error:
        "Saques/repasse internos foram removidos no MVP (pagamento cai direto no Pix do vendedor).",
      code: "WITHDRAWS_DISABLED",
    });
  },
);

export default r;
