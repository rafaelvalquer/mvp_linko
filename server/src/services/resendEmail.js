// server/src/services/resendEmail.js
import { Offer } from "../models/Offer.js";
import fs from "fs/promises";
import path from "path";

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

function computeChargeCentsForManual(offer) {
  const totalCents = Number(offer?.totalCents ?? offer?.amountCents ?? 0) || 0;

  const depositPctRaw = Number(offer?.depositPct);
  const depositPct =
    Number.isFinite(depositPctRaw) && depositPctRaw > 0 ? depositPctRaw : 0;

  const depositEnabled =
    offer?.depositEnabled === false ? false : depositPct > 0;

  const depositCents = depositEnabled
    ? Math.round((totalCents * depositPct) / 100)
    : 0;

  return {
    totalCents,
    depositEnabled,
    depositPct,
    depositCents,
    chargeCents: depositEnabled ? depositCents : totalCents,
  };
}

function inferExtFromMime(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("pdf")) return ".pdf";
  if (m.includes("png")) return ".png";
  if (m.includes("jpeg") || m.includes("jpg")) return ".jpg";
  return "";
}

function sanitizeFilename(name, mime) {
  const ext = inferExtFromMime(mime);
  let base = String(name || "comprovante").trim();
  base = base.replace(/[\\\/:*?"<>|]+/g, "-").trim();
  if (!base) base = "comprovante";
  if (ext && !base.toLowerCase().endsWith(ext)) base += ext;
  return base;
}

async function buildLocalProofAttachment(proof) {
  const provider = String(proof?.storage?.provider || "local").toLowerCase();
  if (provider !== "local") return null;

  const key = String(proof?.storage?.key || "").trim();
  if (!key) return null;

  const rel =
    String(proof?.storage?.path || "").trim() ||
    path.posix.join("uploads", "payment-proofs", key);

  // resolve para o cwd do server
  const abs = path.resolve(process.cwd(), rel);

  const buf = await fs.readFile(abs);
  const filename = sanitizeFilename(
    proof?.originalName || key,
    proof?.mimeType,
  );
  return { filename, content: buf.toString("base64") };
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

function buildProofSubmittedEmail({ offer, booking, proof, attachWarning }) {
  const offerType = inferOfferType(offer);
  const customerName = String(offer?.customerName || "").trim() || "Cliente";
  const title =
    String(offer?.title || "").trim() ||
    (offerType === "product" ? "Orçamento" : "Proposta");
  const description = String(offer?.description || "").trim();

  const { totalCents, depositEnabled, depositPct, depositCents, chargeCents } =
    computeChargeCentsForManual(offer);

  const when = fmtDateTimeSP(proof?.uploadedAt || new Date());

  const subject = `Comprovante Pix recebido — ação necessária • ${title} (${fmtBRL(
    chargeCents || totalCents,
  )})`;

  const header = `
    <div style="padding:18px 18px 10px;">
      <div style="font-size:18px; font-weight:800; color:#111827;">Comprovante Pix recebido — ação necessária</div>
      <div style="margin-top:8px; font-size:13px; color:#4b5563;">
        Cliente: <strong>${escapeHtml(customerName)}</strong><br/>
        Valor: <strong>${fmtBRL(chargeCents || totalCents)}</strong>${
          depositEnabled
            ? ` <span style="color:#6b7280;">(sinal de ${depositPct}% • total ${fmtBRL(
                totalCents,
              )} • restante ${fmtBRL(Math.max(0, totalCents - depositCents))})</span>`
            : ""
        }<br/>
        Data/hora: <strong>${escapeHtml(when)}</strong>
      </div>

      <div style="margin-top:12px; padding:12px 12px; border:1px solid #fde68a; background:#fffbeb; border-radius:12px; color:#92400e; font-size:13px;">
        O cliente enviou um comprovante de pagamento Pix. <strong>Confirme manualmente o crédito na sua conta Pix</strong> e, em seguida, marque como pago na plataforma (botão <strong>Confirmar</strong>).
      </div>

      ${
        attachWarning
          ? `<div style="margin-top:10px; padding:10px 12px; border:1px solid #fecaca; background:#fef2f2; border-radius:12px; color:#991b1b; font-size:12px;">
              Não foi possível anexar o comprovante neste e-mail. Você pode visualizar/baixar o arquivo no painel.
            </div>`
          : ""
      }
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
        <div style="margin-top:6px; font-size:14px; font-weight:800; color:#111827;">Serviço</div>
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
      <div style="margin-top:6px; font-size:14px; font-weight:800; color:#111827;">Produtos</div>
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
    `Comprovante Pix recebido — ação necessária\n` +
    `Cliente: ${customerName}\n` +
    `Valor: ${fmtBRL(chargeCents || totalCents)}\n` +
    `Data/hora: ${when}\n\n` +
    `O cliente enviou um comprovante. Confirme manualmente o crédito na sua conta Pix e marque como pago na plataforma.\n\n` +
    detailText +
    `\n`;

  return { subject, html, text };
}

/**
 * OBJETIVO 1
 * Envia e-mail (Resend) para o vendedor quando o cliente envia comprovante (WAITING_CONFIRMATION).
 * - Idempotência por offerId + proof.storage.key
 * - Persiste proofNotified* na Offer somente após envio bem sucedido.
 */
export async function notifySellerPaymentProofSubmitted({
  offerId,
  offer,
  booking,
  proof,
}) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM || "").trim();
  const fallbackTo = String(process.env.PAYMENT_NOTIFY_EMAIL || "").trim();

  const sellerEmail = String(offer?.sellerEmail || "").trim();
  const to = (sellerEmail || fallbackTo || "").trim();

  if (!apiKey) {
    console.warn("[resend] RESEND_API_KEY missing; skipping proof email");
    return { ok: false, skipped: true, reason: "missing_api_key" };
  }
  if (!from) {
    console.warn("[resend] RESEND_FROM missing; skipping proof email");
    return { ok: false, skipped: true, reason: "missing_from" };
  }
  if (!to) {
    console.warn(
      "[resend] sellerEmail and PAYMENT_NOTIFY_EMAIL missing; skipping proof email",
    );
    return { ok: false, skipped: true, reason: "missing_to" };
  }

  const proofKey = String(proof?.storage?.key || "").trim();
  if (!proofKey) {
    console.warn("[resend] missing proof.storage.key; skipping proof email");
    return { ok: false, skipped: true, reason: "missing_proof_key" };
  }

  // ✅ não duplicar para o mesmo arquivo
  if (
    String(offer?.proofNotifiedFileKey || "").trim() === proofKey &&
    offer?.proofNotifiedAt
  ) {
    return { ok: true, skipped: true, reason: "already_notified_same_file" };
  }

  const key = `${String(offerId)}:proof:${proofKey}`;

  let attachments = undefined;
  let attachWarning = false;

  try {
    const att = await buildLocalProofAttachment(proof);
    if (att) attachments = [att];
  } catch (e) {
    attachWarning = true;
    console.warn("[email] proof attachment read failed", {
      offerId: String(offerId),
      key: proofKey,
      err: e?.message || String(e),
    });
  }

  const { subject, html, text } = buildProofSubmittedEmail({
    offer,
    booking,
    proof,
    attachWarning,
  });

  const payload = { from, to, subject, html, text };
  if (attachments && attachments.length) payload.attachments = attachments;

  const resp = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(payload),
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
    {
      _id: offerId,
      $or: [
        { proofNotifiedFileKey: { $exists: false } },
        { proofNotifiedFileKey: { $ne: proofKey } },
      ],
    },
    {
      $set: {
        proofNotifiedAt: new Date(),
        proofNotifiedTo: to,
        proofNotifiedKey: key,
        proofNotifiedFileKey: proofKey,
      },
    },
    { strict: false },
  ).catch(() => {});

  return { ok: true, id: data?.id || data?.data?.id || null, to, key };
}

/**
 * OBJETIVO 2
 * Envia e-mail (Resend) para o vendedor quando Pix fica PAID/CONFIRMED.
 * - Persiste paymentNotifiedAt/paymentNotifiedTo na Offer somente após envio bem sucedido.
 * - Opcional: anexa comprovante (proof) se enviado.
 */
export async function notifySellerPixPaid({
  offerId,
  offer,
  booking,
  pixId,
  paidAt,
  paidAmountCents,
  proof, // ✅ opcional
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

  let attachments = undefined;
  if (proof?.storage?.key) {
    try {
      const att = await buildLocalProofAttachment(proof);
      if (att) attachments = [att];
    } catch (e) {
      console.warn("[email] paid attachment read failed", {
        offerId: String(offerId),
        key: String(proof?.storage?.key || ""),
        err: e?.message || String(e),
      });
    }
  }

  const { subject, html, text } = buildPaidEmail({
    offer,
    booking,
    paidAt,
    paidAmountCents,
  });

  const payload = { from, to, subject, html, text };
  if (attachments && attachments.length) payload.attachments = attachments;

  const resp = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(payload),
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

  return { ok: true, id: data?.id || data?.data?.id || null, to, key };
}

// ✅ NOVO: e-mail “confirmado pelo vendedor” (estilo do “proof recebido”, mas final)
function buildPaymentConfirmedBySellerEmail({
  offer,
  booking,
  proof,
  attachWarning,
}) {
  const offerType = inferOfferType(offer);
  const customerName = String(offer?.customerName || "").trim() || "Cliente";
  const title =
    String(offer?.title || "").trim() ||
    (offerType === "product" ? "Orçamento" : "Proposta");
  const description = String(offer?.description || "").trim();

  const { totalCents, depositEnabled, depositPct, depositCents, chargeCents } =
    computeChargeCentsForManual(offer);

  const paidCents = Number.isFinite(Number(offer?.paidAmountCents))
    ? Number(offer.paidAmountCents)
    : chargeCents || totalCents;

  const when = fmtDateTimeSP(offer?.paidAt || offer?.confirmedAt || new Date());

  const subject = `Pagamento Pix confirmado — confirmado na plataforma • ${title} (${fmtBRL(
    paidCents || totalCents,
  )})`;

  const header = `
    <div style="padding:18px 18px 10px;">
      <div style="font-size:18px; font-weight:800; color:#111827;">Pagamento Pix confirmado — confirmado na plataforma</div>
      <div style="margin-top:8px; font-size:13px; color:#4b5563;">
        Cliente: <strong>${escapeHtml(customerName)}</strong><br/>
        Valor: <strong>${fmtBRL(paidCents || totalCents)}</strong>${
          depositEnabled
            ? ` <span style="color:#6b7280;">(sinal de ${depositPct}% • total ${fmtBRL(
                totalCents,
              )} • restante ${fmtBRL(Math.max(0, totalCents - depositCents))})</span>`
            : ""
        }<br/>
        Data/hora: <strong>${escapeHtml(when)}</strong>
      </div>

      <div style="margin-top:12px; padding:12px 12px; border:1px solid #bbf7d0; background:#ecfdf5; border-radius:12px; color:#065f46; font-size:13px;">
        O pagamento foi <strong>confirmado manualmente</strong> pelo usuário da plataforma e a proposta foi marcada como <strong>paga</strong>.
      </div>

      ${
        attachWarning
          ? `<div style="margin-top:10px; padding:10px 12px; border:1px solid #fecaca; background:#fef2f2; border-radius:12px; color:#991b1b; font-size:12px;">
              Não foi possível anexar o comprovante neste e-mail. Você pode visualizar/baixar o arquivo no painel.
            </div>`
          : ""
      }
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
        <div style="margin-top:6px; font-size:14px; font-weight:800; color:#111827;">Serviço</div>
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
      <div style="margin-top:6px; font-size:14px; font-weight:800; color:#111827;">Produtos</div>
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
    `Pagamento Pix confirmado — confirmado na plataforma\n` +
    `Cliente: ${customerName}\n` +
    `Valor: ${fmtBRL(paidCents || totalCents)}\n` +
    `Data/hora: ${when}\n\n` +
    `O pagamento foi confirmado manualmente pelo usuário da plataforma e a proposta foi marcada como paga.\n\n` +
    detailText +
    `\n`;

  return { subject, html, text };
}

/**
 * ✅ NOVO: notifica vendedor que o pagamento foi confirmado no painel (template “estilo proof”, mas final)
 * Idempotência separada: offerId + "confirmed" + proofKey (ou paidAt)
 */
export async function notifySellerPaymentConfirmedOnPlatform({
  offerId,
  offer,
  booking,
  proof,
}) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM || "").trim();
  const fallbackTo = String(process.env.PAYMENT_NOTIFY_EMAIL || "").trim();

  const sellerEmail = String(offer?.sellerEmail || "").trim();
  const to = (sellerEmail || fallbackTo || "").trim();

  if (!apiKey) return { ok: false, skipped: true, reason: "missing_api_key" };
  if (!from) return { ok: false, skipped: true, reason: "missing_from" };
  if (!to) return { ok: false, skipped: true, reason: "missing_to" };

  // ✅ evita duplicar esse “segundo e-mail”
  if (offer?.confirmedNotifiedAt) {
    return { ok: true, skipped: true, reason: "already_notified" };
  }

  const proofKey = String(proof?.storage?.key || "").trim();
  const paidKey = offer?.paidAt ? new Date(offer.paidAt).toISOString() : "";
  const seed = proofKey || paidKey || "confirmed";

  const key = `${String(offerId)}:confirmed:${seed}`;

  let attachments = undefined;
  let attachWarning = false;

  if (proofKey) {
    try {
      const att = await buildLocalProofAttachment(proof);
      if (att) attachments = [att];
    } catch {
      attachWarning = true;
    }
  }

  const { subject, html, text } = buildPaymentConfirmedBySellerEmail({
    offer,
    booking,
    proof,
    attachWarning,
  });

  const payload = { from, to, subject, html, text };
  if (attachments && attachments.length) payload.attachments = attachments;

  const resp = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(payload),
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
    { _id: offerId, confirmedNotifiedAt: { $exists: false } },
    {
      $set: {
        confirmedNotifiedAt: new Date(),
        confirmedNotifiedTo: to,
        confirmedNotifiedKey: key,
        confirmedNotifiedProofKey: proofKey || null,
      },
    },
    { strict: false },
  ).catch(() => {});

  return { ok: true, id: data?.id || data?.data?.id || null, to, key };
}

const FORGOT_PASSWORD_CODE_TTL_MINUTES = 10;

function fmtForgotPasswordExpiresAt(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    return `${FORGOT_PASSWORD_CODE_TTL_MINUTES} minutos`;
  }

  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildForgotPasswordCodeEmail({ name, code, expiresAt }) {
  const firstName =
    String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)[0] || "";
  const greeting = firstName ? `Olá, ${escapeHtml(firstName)}!` : "Olá!";
  const expiresText = fmtForgotPasswordExpiresAt(expiresAt);

  const subject = "Código para redefinir sua senha";

  const html = `
    <div style="background:#f4f4f5; padding:24px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e4e4e7; border-radius:18px; overflow:hidden; font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#18181b;">
        <div style="padding:28px 24px 10px;">
          <div style="font-size:22px; font-weight:800;">Redefina sua senha</div>
          <div style="margin-top:10px; font-size:14px; line-height:1.6; color:#52525b;">
            ${greeting}<br/>
            Recebemos uma solicitação para redefinir a senha da sua conta.
          </div>
        </div>

        <div style="padding:16px 24px 4px;">
          <div style="font-size:13px; color:#71717a; margin-bottom:10px;">Use o código abaixo para continuar:</div>
          <div style="display:inline-block; padding:16px 22px; border-radius:16px; border:1px solid #d4d4d8; background:#fafafa; font-size:32px; font-weight:800; letter-spacing:10px; color:#09090b;">
            ${escapeHtml(code)}
          </div>
        </div>

        <div style="padding:16px 24px 8px; font-size:14px; line-height:1.7; color:#3f3f46;">
          Este código é válido por até <strong>${FORGOT_PASSWORD_CODE_TTL_MINUTES} minutos</strong>.<br/>
          Validade até: <strong>${escapeHtml(expiresText)}</strong>.
        </div>

        <div style="padding:0 24px 24px; font-size:13px; line-height:1.7; color:#71717a;">
          Se você não solicitou a redefinição de senha, pode ignorar este e-mail com segurança.
        </div>
      </div>
    </div>`;

  const text = [
    "Código para redefinir sua senha",
    "",
    "Recebemos uma solicitação para redefinir a senha da sua conta.",
    `Código: ${code}`,
    `Validade: ${expiresText}`,
    `O código é válido por ${FORGOT_PASSWORD_CODE_TTL_MINUTES} minutos.`,
    "",
    "Se você não solicitou a redefinição de senha, pode ignorar este e-mail.",
  ].join("\n");

  return { subject, html, text };
}

export async function sendForgotPasswordCode({ to, name, code, expiresAt }) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM || "").trim();
  const recipient = String(to || "").trim();

  if (!apiKey) {
    const err = new Error("RESEND_API_KEY ausente.");
    err.status = 500;
    throw err;
  }

  if (!from) {
    const err = new Error("RESEND_FROM ausente.");
    err.status = 500;
    throw err;
  }

  if (!recipient) {
    const err = new Error("E-mail do destinatário ausente.");
    err.status = 400;
    throw err;
  }

  const { subject, html, text } = buildForgotPasswordCodeEmail({
    name,
    code,
    expiresAt,
  });

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `forgot-password:${recipient}:${String(code || "").trim()}`,
    },
    body: JSON.stringify({
      from,
      to: recipient,
      subject,
      html,
      text,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(
      data?.message || data?.error || `Resend error (${response.status})`,
    );
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return {
    ok: true,
    id: data?.id || data?.data?.id || null,
  };
}
