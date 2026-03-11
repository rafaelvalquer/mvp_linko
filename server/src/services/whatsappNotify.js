// server/src/services/whatsappNotify.js
import { Offer } from "../models/Offer.js";
import Booking from "../models/Booking.js";
import { Client } from "../models/Client.js";
import { MessageLog } from "../models/MessageLog.js";
import { isWhatsAppNotificationsEnabled } from "./waGateway.js";
import { queueOrSendWhatsApp } from "./whatsappOutbox.service.js";

function onlyDigits(v) {
  return String(v || "").replace(/\D+/g, "");
}

// ✅ mantém como está (regra do projeto)
function normalizePhoneBR(raw) {
  const digits = onlyDigits(raw);
  if (!digits) return "";
  // Se vier com DDD+numero (10/11 dígitos), assume BR e prefixa 55
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  // Se já vier com 55 (12/13 dígitos), mantém
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13))
    return digits;
  // Caso já venha com código do país diferente, deixa como está
  return digits;
}

function firstName(name) {
  const s = String(name || "").trim();
  if (!s) return null;
  const n = s.split(/\s+/)[0];
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : null;
}

function fmtDateTimeBR(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// ✅ ESTE NOME PRECISA EXISTIR
export function buildPaidMessage({ offer, booking }) {
  const title = String(offer?.title || offer?.name || "sua proposta").trim();

  const cents =
    typeof offer?.totalCents === "number"
      ? offer.totalCents
      : typeof offer?.amountCents === "number"
        ? offer.amountCents
        : null;

  const value =
    offer?.totalFormatted ||
    offer?.totalBRL ||
    (typeof cents === "number"
      ? new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(cents / 100)
      : null);

  const customerName =
    offer?.customerName || offer?.clientName || offer?.customer?.name || "";
  const name = firstName(customerName);

  const items = Array.isArray(offer?.items) ? offer.items : [];
  const offerType = String(offer?.offerType || offer?.type || "").toUpperCase();
  const isProduct =
    offerType === "PRODUCT" ||
    offerType === "PRODUTO" ||
    (items.length > 0 && offerType !== "SERVICE" && offerType !== "SERVICO");

  const lines = [];

  lines.push(name ? `Oi, ${name}! Tudo bem?` : "Olá! Tudo bem?");
  lines.push("");

  lines.push("*Pagamento confirmado ✅*");
  lines.push(
    isProduct
      ? "Recebemos o pagamento do seu pedido. Segue um resumo:"
      : "Recebemos o pagamento. Segue um resumo:",
  );

  lines.push("");
  lines.push(`*Proposta:* ${title}`);
  if (value) lines.push(`*Valor:* ${value}`);

  if (isProduct && items.length) {
    lines.push("");
    lines.push("*Itens:*");
    for (const it of items.slice(0, 8)) {
      const desc = String(it?.description || it?.name || "").trim();
      const qty = Number(it?.qty) || 1;
      if (!desc) continue;
      lines.push(`• ${desc} x${qty}`);
    }
  }

  const startAt = booking?.startAt || booking?.start || booking?.from;
  if (startAt) {
    const when = fmtDateTimeBR(startAt);
    if (when) {
      lines.push("");
      lines.push(`*Agendado para:* ${when}`);
    }
  }

  lines.push("");
  lines.push("Obrigado pela confiança! 🙌");

  return lines.join("\n");
}

async function dispatchQueuedMessageLog({
  doc,
  workspaceId = null,
  to,
  message,
  dedupeKey,
  meta = null,
}) {
  const result = await queueOrSendWhatsApp({
    workspaceId,
    to,
    message,
    dedupeKey,
    sourceType: "message_log",
    sourceId: doc?._id || null,
    meta,
  });

  const freshLog = doc?._id ? await MessageLog.findById(doc._id).lean() : null;

  if (result?.status === "sent") {
    return {
      ok: true,
      status: "SENT",
      providerMessageId:
        freshLog?.providerMessageId || result?.providerMessageId || null,
      log: freshLog,
    };
  }

  if (result?.status === "queued") {
    return {
      ok: true,
      status: "QUEUED",
      log: freshLog,
    };
  }

  return {
    ok: false,
    status: "FAILED",
    error: result?.error || new Error("Falha ao enviar WhatsApp"),
    log: freshLog,
  };
}

/**
 * Dispara WhatsApp para o CLIENTE quando o Pix for confirmado (AbacatePay/fluxos existentes).
 * - Idempotência forte: 1 envio por (offerId,eventType="PIX_PAID").
 */
export async function maybeNotifyWhatsAppPixPaid({
  offer,
  offerId,
  workspaceId,
  bookingId,
  booking,
  pixId,
}) {
  if (!offer) return { ok: false, status: "SKIPPED", reason: "NO_OFFER" };

  if (!isWhatsAppNotificationsEnabled()) {
    return { ok: false, status: "SKIPPED", reason: "FEATURE_DISABLED" };
  }

  if (offer?.notifyWhatsAppOnPaid !== true) {
    return { ok: false, status: "SKIPPED", reason: "OFFER_FLAG_DISABLED" };
  }

  const to = normalizePhoneBR(offer?.customerWhatsApp);
  const message = buildPaidMessage({ offer, booking });

  if (!to) {
    const filter = { offerId: offerId || offer?._id, eventType: "PIX_PAID" };
    const base = {
      workspaceId: workspaceId || offer?.workspaceId || null,
      offerId: offerId || offer?._id,
      bookingId: bookingId || null,
      eventType: "PIX_PAID",
      channel: "WHATSAPP",
      provider: "whatsapp-web.js",
      to: "",
      message,
      status: "SKIPPED",
      providerMessageId: null,
      error: {
        message: "customerWhatsApp ausente ou inválido",
        code: "NO_PHONE",
        details: { pixId: String(pixId || "").trim() || null },
      },
      sentAt: null,
    };

    await MessageLog.findOneAndUpdate(
      filter,
      { $setOnInsert: base },
      { upsert: true, new: true, strict: false },
    ).catch(() => {});

    return { ok: false, status: "SKIPPED", reason: "NO_PHONE" };
  }

  const filter = { offerId: offerId || offer?._id, eventType: "PIX_PAID" };

  const base = {
    workspaceId: workspaceId || offer?.workspaceId || null,
    offerId: offerId || offer?._id,
    bookingId: bookingId || null,
    eventType: "PIX_PAID",
    channel: "WHATSAPP",
    provider: "whatsapp-web.js",
    to,
    message,
    status: "PENDING",
    providerMessageId: null,
    error: null,
    sentAt: null,
  };

  const raw = await MessageLog.findOneAndUpdate(
    filter,
    { $setOnInsert: base },
    {
      upsert: true,
      new: true,
      includeResultMetadata: true,
      strict: false,
    },
  );

  const created = raw?.lastErrorObject?.updatedExisting === false;
  const doc = raw?.value ?? null;

  if (!created) {
    return { ok: true, status: "SKIPPED", reason: "IDEMPOTENT", log: doc };
  }

  return dispatchQueuedMessageLog({
    doc,
    workspaceId: workspaceId || offer?.workspaceId || null,
    to,
    message,
    dedupeKey: `offer:${offerId || offer?._id}:PIX_PAID`,
    meta: {
      offerId: offerId || offer?._id || null,
      bookingId: bookingId || null,
      eventType: "PIX_PAID",
      pixId: String(pixId || "").trim() || null,
    },
  });
}

/**
 * ✅ NOVO: disparo quando o pagamento é CONFIRMADO MANUALMENTE no backoffice.
 * - Só envia se offer.notifyWhatsAppOnPaid === true
 * - Só envia se customerWhatsApp existir (senão registra SKIPPED)
 * - Idempotência por (offerId,eventType="PAYMENT_CONFIRMED")
 */
export async function notifyPaymentConfirmed(offerId) {
  const id = String(offerId || "").trim();
  if (!id) return { ok: false, status: "SKIPPED", reason: "NO_OFFER_ID" };

  if (!isWhatsAppNotificationsEnabled()) {
    return { ok: false, status: "SKIPPED", reason: "FEATURE_DISABLED" };
  }

  const offer = await Offer.findById(id).lean();
  if (!offer) return { ok: false, status: "SKIPPED", reason: "NO_OFFER" };

  if (offer?.notifyWhatsAppOnPaid !== true) {
    return { ok: false, status: "SKIPPED", reason: "OFFER_FLAG_DISABLED" };
  }

  // booking (se existir) para enriquecer a mensagem
  let booking = null;
  let bookingId = null;
  try {
    booking = await Booking.findOne({
      offerId: offer._id,
      workspaceId: offer?.workspaceId || null,
    })
      .sort({ startAt: -1 })
      .lean();
    bookingId = booking?._id || null;
  } catch {
    booking = null;
    bookingId = null;
  }

  // cliente (se existir) para completar nome/whatsapp caso a offer esteja incompleta
  let customerName = String(offer?.customerName || "").trim();
  let customerWhatsApp = String(offer?.customerWhatsApp || "").trim();

  try {
    if (offer?.customerId) {
      const c = await Client.findOne({
        _id: offer.customerId,
        workspaceId: offer?.workspaceId || null,
      }).lean();

      if (c) {
        if (!customerName) customerName = String(c?.name || "").trim();
        if (!customerWhatsApp) customerWhatsApp = String(c?.phone || "").trim();
      }
    }
  } catch {}

  const offerForMsg = {
    ...offer,
    customerName: customerName || offer?.customerName,
    customerWhatsApp: customerWhatsApp || offer?.customerWhatsApp,
  };

  const to = normalizePhoneBR(offerForMsg?.customerWhatsApp);
  const message = buildPaidMessage({ offer: offerForMsg, booking });

  const filter = { offerId: offer._id, eventType: "PAYMENT_CONFIRMED" };

  // Se faltou número, registra SKIPPED (idempotente) e sai
  if (!to) {
    const base = {
      workspaceId: offer?.workspaceId || null,
      offerId: offer._id,
      bookingId,
      eventType: "PAYMENT_CONFIRMED",
      channel: "WHATSAPP",
      provider: "whatsapp-web.js",
      to: "",
      message,
      status: "SKIPPED",
      providerMessageId: null,
      error: {
        message: "customerWhatsApp ausente ou inválido",
        code: "NO_PHONE",
        details: { offerId: String(offer?._id || "") },
      },
      sentAt: null,
    };

    await MessageLog.findOneAndUpdate(
      filter,
      { $setOnInsert: base },
      { upsert: true, new: true, strict: false },
    ).catch(() => {});

    return { ok: false, status: "SKIPPED", reason: "NO_PHONE" };
  }

  // Idempotência: cria log apenas na primeira vez
  const base = {
    workspaceId: offer?.workspaceId || null,
    offerId: offer._id,
    bookingId,
    eventType: "PAYMENT_CONFIRMED",
    channel: "WHATSAPP",
    provider: "whatsapp-web.js",
    to,
    message,
    status: "PENDING",
    providerMessageId: null,
    error: null,
    sentAt: null,
  };

  const raw = await MessageLog.findOneAndUpdate(
    filter,
    { $setOnInsert: base },
    {
      upsert: true,
      new: true,
      includeResultMetadata: true,
      strict: false,
    },
  );

  const created = raw?.lastErrorObject?.updatedExisting === false;
  const doc = raw?.value ?? null;

  if (!created) {
    return { ok: true, status: "SKIPPED", reason: "IDEMPOTENT", log: doc };
  }

  return dispatchQueuedMessageLog({
    doc,
    workspaceId: offer?.workspaceId || null,
    to,
    message,
    dedupeKey: `offer:${offer?._id}:PAYMENT_CONFIRMED`,
    meta: {
      offerId: offer?._id || null,
      bookingId,
      eventType: "PAYMENT_CONFIRMED",
    },
  });
}

function fmtMoneyBRLFromCentsSafe(cents) {
  const v = Number(cents);
  if (!Number.isFinite(v)) return "";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(v / 100);
  } catch {
    const s = (v / 100).toFixed(2).replace(".", ",");
    return `R$ ${s}`;
  }
}

function buildRejectedMessage({ offer, reason, publicUrl }) {
  const title = String(offer?.title || offer?.name || "sua proposta").trim();
  const cents = Number(offer?.totalCents ?? offer?.amountCents ?? 0) || 0;
  const value = fmtMoneyBRLFromCentsSafe(cents);

  const customerName = String(offer?.customerName || "").trim();
  const name = (customerName && customerName.split(/\s+/)[0]) || "";

  const lines = [];
  lines.push(name ? `Oi, ${name}! Tudo bem?` : "Olá! Tudo bem?");
  lines.push("");
  lines.push("*Comprovante recusado ❌*");
  lines.push(
    `Não conseguimos validar o comprovante enviado para *${title}*${
      value ? ` no valor de *${value}*` : ""
    }.`,
  );
  lines.push("");
  lines.push("*Mensagem:*");
  lines.push(String(reason || "").trim() || "Comprovante inválido/ilegível.");
  lines.push("");
  if (publicUrl) {
    lines.push("Para refazer o processo e enviar um novo comprovante, acesse:");
    lines.push(publicUrl);
    lines.push("");
  }
  lines.push("Se precisar de ajuda, responda esta mensagem.");
  return lines.join("\n");
}

export async function notifyPaymentRejected(
  offerId,
  { reason, publicUrl } = {},
) {
  const id = String(offerId || "").trim();
  if (!id) return { ok: false, status: "SKIPPED", reason: "NO_OFFER_ID" };

  if (!isWhatsAppNotificationsEnabled()) {
    return { ok: false, status: "SKIPPED", reason: "FEATURE_DISABLED" };
  }

  const offer = await Offer.findById(id).lean();
  if (!offer) return { ok: false, status: "SKIPPED", reason: "NO_OFFER" };

  if (offer?.notifyWhatsAppOnPaid !== true) {
    return { ok: false, status: "SKIPPED", reason: "OFFER_FLAG_DISABLED" };
  }

  const to = normalizePhoneBR(offer?.customerWhatsApp);
  const proofKey = String(offer?.paymentProof?.storage?.key || "").trim();
  const eventType = proofKey
    ? `PAYMENT_REJECTED:${proofKey}`
    : "PAYMENT_REJECTED";

  const msg = buildRejectedMessage({
    offer,
    reason: String(reason || "").trim(),
    publicUrl: String(publicUrl || "").trim(),
  });

  if (!to) {
    const filter = { offerId: offer._id, eventType };
    const base = {
      workspaceId: offer?.workspaceId || null,
      offerId: offer._id,
      bookingId: null,
      eventType,
      channel: "WHATSAPP",
      provider: "whatsapp-web.js",
      to: "",
      message: msg,
      status: "SKIPPED",
      providerMessageId: null,
      error: {
        message: "customerWhatsApp ausente ou inválido",
        code: "NO_PHONE",
      },
      sentAt: null,
    };

    await MessageLog.findOneAndUpdate(
      filter,
      { $setOnInsert: base },
      { upsert: true, new: true, strict: false },
    ).catch(() => {});
    return { ok: false, status: "SKIPPED", reason: "NO_PHONE" };
  }

  const filter = { offerId: offer._id, eventType };
  const base = {
    workspaceId: offer?.workspaceId || null,
    offerId: offer._id,
    bookingId: null,
    eventType,
    channel: "WHATSAPP",
    provider: "whatsapp-web.js",
    to,
    message: msg,
    status: "PENDING",
    providerMessageId: null,
    error: null,
    sentAt: null,
  };

  const raw = await MessageLog.findOneAndUpdate(
    filter,
    { $setOnInsert: base },
    { upsert: true, new: true, includeResultMetadata: true, strict: false },
  );

  const created = raw?.lastErrorObject?.updatedExisting === false;
  const doc = raw?.value ?? null;

  if (!created) {
    return { ok: true, status: "SKIPPED", reason: "IDEMPOTENT", log: doc };
  }

  return dispatchQueuedMessageLog({
    doc,
    workspaceId: offer?.workspaceId || null,
    to,
    message: msg,
    dedupeKey: `offer:${offer?._id}:${eventType}`,
    meta: {
      offerId: offer?._id || null,
      bookingId: null,
      eventType,
      proofKey: proofKey || null,
    },
  });
}
