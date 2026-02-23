// server/src/services/resendEmail.js
import { Offer } from "../models/Offer.js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function fmtBRL(cents) {
  const v = Number.isFinite(Number(cents)) ? Number(cents) : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v / 100);
}

function fmtDateTimeSP(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nl2br(s) {
  return escapeHtml(s).replace(/\n/g, "<br/>");
}

function inferOfferType(offer) {
  const raw = String(offer?.offerType || "")
    .trim()
    .toLowerCase();
  if (raw === "product") return "product";
  const items = Array.isArray(offer?.items) ? offer.items : [];
  if (items.length > 0) return "product";
  return "service";
}

function normalizeItems(offer) {
  const items = Array.isArray(offer?.items) ? offer.items : [];
  return items
    .map((it) => {
      const description = String(it?.description || "").trim();
      const qty = Number(it?.qty);
      const unitPriceCents = Number(it?.unitPriceCents);
      const lineTotalCents = Number.isFinite(Number(it?.lineTotalCents))
        ? Number(it?.lineTotalCents)
        : Number.isFinite(qty) && Number.isFinite(unitPriceCents)
          ? Math.round(qty * unitPriceCents)
          : null;

      return {
        description,
        qty: Number.isFinite(qty) && qty > 0 ? Math.trunc(qty) : 0,
        unitPriceCents: Number.isFinite(unitPriceCents) ? unitPriceCents : null,
        lineTotalCents: Number.isFinite(lineTotalCents) ? lineTotalCents : null,
      };
    })
    .filter((it) => it.description);
}

function buildProductHtml(items, totalCents) {
  const rows = items
    .map((it) => {
      const unit = fmtBRL(it.unitPriceCents || 0);
      const line = fmtBRL(it.lineTotalCents || 0);
      return `
        <tr>
          <td style="padding:10px 8px; border-bottom:1px solid #e5e7eb;">${escapeHtml(
            it.description,
          )}</td>
          <td style="padding:10px 8px; border-bottom:1px solid #e5e7eb; text-align:right;">${
            it.qty
          }</td>
          <td style="padding:10px 8px; border-bottom:1px solid #e5e7eb; text-align:right; white-space:nowrap;">${unit}</td>
          <td style="padding:10px 8px; border-bottom:1px solid #e5e7eb; text-align:right; white-space:nowrap;">${line}</td>
        </tr>`;
    })
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
      <thead>
        <tr style="background:#f9fafb;">
          <th align="left" style="padding:10px 8px; font-size:12px; color:#111827;">Item</th>
          <th align="right" style="padding:10px 8px; font-size:12px; color:#111827;">Qtd</th>
          <th align="right" style="padding:10px 8px; font-size:12px; color:#111827;">Unit.</th>
          <th align="right" style="padding:10px 8px; font-size:12px; color:#111827;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding:12px 8px; text-align:right; font-weight:600;">Total do orçamento</td>
          <td style="padding:12px 8px; text-align:right; font-weight:700; white-space:nowrap;">${fmtBRL(
            totalCents,
          )}</td>
        </tr>
      </tfoot>
    </table>`;
}

function buildProductText(items, totalCents) {
  const lines = items.map((it) => {
    const unit = fmtBRL(it.unitPriceCents || 0);
    const line = fmtBRL(it.lineTotalCents || 0);
    return `- ${it.description} | qtd: ${it.qty} | unit: ${unit} | total: ${line}`;
  });
  lines.push(`Total do orçamento: ${fmtBRL(totalCents)}`);
  return lines.join("\n");
}

function buildPaidEmail({ offer, booking, paidAt, paidAmountCents }) {
  const offerType = inferOfferType(offer);
  const customerName = String(offer?.customerName || "").trim() || "Cliente";
  const title =
    String(offer?.title || "").trim() ||
    (offerType === "product" ? "Orçamento" : "Proposta");
  const description = String(offer?.description || "").trim();

  const totalCents = Number.isFinite(Number(offer?.totalCents))
    ? Number(offer.totalCents)
    : Number.isFinite(Number(offer?.amountCents))
      ? Number(offer.amountCents)
      : 0;

  const paidCents = Number.isFinite(Number(paidAmountCents))
    ? Number(paidAmountCents)
    : 0;

  const when = fmtDateTimeSP(paidAt);

  const subject = `Pix confirmado — ${title} (${fmtBRL(
    paidCents || totalCents,
  )})`;

  const header = `
    <div style="padding:18px 18px 8px;">
      <div style="font-size:18px; font-weight:700; color:#111827;">Pagamento Pix confirmado</div>
      <div style="margin-top:6px; font-size:13px; color:#4b5563;">
        Cliente: <strong>${escapeHtml(customerName)}</strong><br/>
        Valor pago: <strong>${fmtBRL(paidCents || totalCents)}</strong><br/>
        Data/hora: <strong>${escapeHtml(when)}</strong>
      </div>
    </div>`;

  let detailHtml = "";
  let detailText = "";

  if (offerType === "service") {
    const bookingLine =
      booking?.startAt && booking?.endAt
        ? `Agendamento: ${fmtDateTimeSP(booking.startAt)} → ${fmtDateTimeSP(
            booking.endAt,
          )}`
        : "";

    detailHtml = `
      <div style="padding:0 18px 18px;">
        <div style="margin-top:10px; font-size:14px; font-weight:700; color:#111827;">Serviço</div>
        <div style="margin-top:6px; font-size:13px; color:#111827;">
          <strong>${escapeHtml(title)}</strong>
        </div>
        ${
          description
            ? `<div style="margin-top:6px; font-size:13px; color:#4b5563;">${nl2br(
                description,
              )}</div>`
            : ""
        }
        ${
          bookingLine
            ? `<div style="margin-top:10px; font-size:13px; color:#111827;"><strong>${escapeHtml(
                bookingLine,
              )}</strong></div>`
            : ""
        }
      </div>`;

    detailText =
      `SERVIÇO\n` +
      `${title}\n` +
      (description ? `${description}\n` : "") +
      (bookingLine ? `${bookingLine}\n` : "");
  } else {
    const items = normalizeItems(offer);

    detailHtml = `<div style="padding:0 18px 18px;">
      <div style="margin-top:10px; font-size:14px; font-weight:700; color:#111827;">Produtos</div>
      <div style="margin-top:10px;">${buildProductHtml(items, totalCents)}</div>
    </div>`;

    detailText = `PRODUTOS\n${buildProductText(items, totalCents)}\n`;
  }

  const footer = `
    <div style="padding:14px 18px; border-top:1px solid #e5e7eb; font-size:12px; color:#6b7280;">
      Esta mensagem foi enviada automaticamente.
    </div>`;

  const html = `
  <div style="background:#f3f4f6; padding:24px;">
    <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden; font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
      ${header}
      ${detailHtml}
      ${footer}
    </div>
  </div>`;

  const text =
    `Pagamento Pix confirmado\n` +
    `Cliente: ${customerName}\n` +
    `Valor pago: ${fmtBRL(paidCents || totalCents)}\n` +
    `Data/hora: ${when}\n\n` +
    detailText +
    `\n`;

  return { subject, html, text };
}

/**
 * Envia e-mail (Resend) para o vendedor quando Pix fica PAID.
 * - Persiste paymentNotifiedAt/paymentNotifiedTo na Offer somente após envio bem sucedido.
 */
export async function notifySellerPixPaid({
  offerId,
  offer,
  booking,
  pixId,
  paidAt,
  paidAmountCents,
}) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM || "").trim();
  const fallbackTo = String(process.env.PAYMENT_NOTIFY_EMAIL || "").trim();

  const sellerEmail = String(offer?.sellerEmail || "").trim();
  const to = (sellerEmail || fallbackTo || "").trim();

  if (!apiKey) {
    console.warn("[resend] RESEND_API_KEY missing; skipping email notify");
    return { ok: false, skipped: true, reason: "missing_api_key" };
  }
  if (!from) {
    console.warn("[resend] RESEND_FROM missing; skipping email notify");
    return { ok: false, skipped: true, reason: "missing_from" };
  }
  if (!to) {
    console.warn(
      "[resend] sellerEmail and PAYMENT_NOTIFY_EMAIL missing; skipping",
    );
    return { ok: false, skipped: true, reason: "missing_to" };
  }

  if (offer?.paymentNotifiedAt) {
    return { ok: true, skipped: true, reason: "already_notified" };
  }

  const key = `${String(offerId)}:${String(pixId || "").trim() || "paid"}`;

  const { subject, html, text } = buildPaidEmail({
    offer,
    booking,
    paidAt,
    paidAmountCents,
  });

  const resp = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const msg =
      data?.message ||
      data?.error ||
      data?.details ||
      `Resend error (${resp.status})`;
    const err = new Error(msg);
    err.statusCode = resp.status;
    err.data = data;
    throw err;
  }

  await Offer.updateOne(
    { _id: offerId, paymentNotifiedAt: { $exists: false } },
    {
      $set: {
        paymentNotifiedAt: new Date(),
        paymentNotifiedTo: to,
        paymentNotifiedPixId: String(pixId || "").trim() || null,
        paymentNotifiedKey: key,
      },
    },
    { strict: false },
  ).catch(() => {});

  return { ok: true, id: data?.id || data?.data?.id || null };
}
