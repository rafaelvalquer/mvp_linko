// server/src/services/whatsappNotify.js
import { Offer } from "../models/Offer.js";
import { MessageLog } from "../models/MessageLog.js";
import { isWhatsAppNotificationsEnabled, sendWhatsApp } from "./waGateway.js";

function onlyDigits(v) {
  return String(v || "").replace(/\D+/g, "");
}

function normalizePhoneBR(raw) {
  const digits = onlyDigits(raw);
  if (!digits) return "";
  // Se vier com DDD+numero (10/11 dígitos), assume BR e prefixa 55
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  // Se já vier com 55 (12/13 dígitos), mantém
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13))
    return digits;
  // Caso já venha com código do país diferente, deixa como está (wa-gateway também normaliza)
  return digits;
}

function fmtMoneyBRLFromCents(cents) {
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

  const value =
    offer?.totalFormatted ||
    offer?.totalBRL ||
    (typeof offer?.totalCents === "number"
      ? new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(offer.totalCents / 100)
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

  // Saudação
  lines.push(name ? `Oi, ${name}! Tudo bem?` : "Olá! Tudo bem?");
  lines.push("");

  // Título
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

/**
 * Dispara WhatsApp para o CLIENTE quando o Pix for confirmado.
 * - Não quebra o fluxo de pagamento.
 * - Idempotência forte: 1 envio por (offerId,eventType).
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

  // feature flag global
  if (!isWhatsAppNotificationsEnabled()) {
    return { ok: false, status: "SKIPPED", reason: "FEATURE_DISABLED" };
  }

  // marcador por proposta
  if (offer?.notifyWhatsAppOnPaid !== true) {
    return { ok: false, status: "SKIPPED", reason: "OFFER_FLAG_DISABLED" };
  }

  const to = normalizePhoneBR(offer?.customerWhatsApp);
  const message = buildPaidMessage({ offer, booking });

  // Se faltou número, registra SKIPPED (idempotente) e sai
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

  // Idempotência: cria log apenas na primeira vez
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
      includeResultMetadata: true, // <-- IMPORTANTÍSSIMO
      strict: false,
    },
  );

  const created = raw?.lastErrorObject?.updatedExisting === false;
  const doc = raw?.value ?? null;

  console.log("created:", created);
  if (!created) {
    return { ok: true, status: "SKIPPED", reason: "IDEMPOTENT", log: doc };
  }

  console.log("############");
  // Envia (com timeout + 1 retry no client)
  try {
    const resp = await sendWhatsApp({ to, message });
    const providerMessageId =
      String(resp?.providerMessageId || "").trim() || null;

    await MessageLog.updateOne(
      { _id: doc?._id },
      {
        $set: {
          status: "SENT",
          providerMessageId,
          sentAt: new Date(),
          error: null,
        },
      },
      { strict: false },
    ).catch(() => {});

    // opcional: gravar no Offer (auditoria)
    if (offer?._id) {
      await Offer.updateOne(
        { _id: offer._id, whatsappNotifiedAt: { $in: [null, undefined] } },
        {
          $set: {
            whatsappNotifiedAt: new Date(),
            whatsappNotifiedTo: to,
            whatsappNotifiedKey: String(pixId || "").trim() || null,
          },
        },
        { strict: false },
      ).catch(() => {});
    }

    return { ok: true, status: "SENT", providerMessageId, log: doc };
  } catch (err) {
    await MessageLog.updateOne(
      { _id: doc?._id },
      {
        $set: {
          status: "FAILED",
          providerMessageId: null,
          sentAt: null,
          error: {
            message: String(err?.message || "Falha ao enviar WhatsApp"),
            code: String(err?.code || err?.name || "SEND_FAILED"),
            details: err?.details || {
              pixId: String(pixId || "").trim() || null,
            },
          },
        },
      },
      { strict: false },
    ).catch(() => {});

    return { ok: false, status: "FAILED", error: err };
  }
}
