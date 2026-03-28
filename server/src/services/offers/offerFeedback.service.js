import { Offer } from "../../models/Offer.js";
import {
  isWhatsAppMasterEnabled,
  resolveWorkspaceNotificationContext,
} from "../notificationSettings.js";
import { buildOfferPublicUrl } from "../publicUrl.service.js";
import { isWhatsAppNotificationsEnabled } from "../waGateway.js";
import { queueOrSendWhatsApp } from "../whatsappOutbox.service.js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function normalizeStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  return status === "CANCELED" ? "CANCELLED" : status;
}

function isPaidConfirmedOffer(offer) {
  const paymentStatus = normalizeStatus(offer?.paymentStatus);
  const status = normalizeStatus(offer?.status);
  return (
    ["PAID", "CONFIRMED"].includes(paymentStatus) ||
    ["PAID", "CONFIRMED"].includes(status) ||
    !!offer?.paidAt ||
    !!offer?.confirmedAt
  );
}

function onlyDigits(value) {
  return String(value || "").replace(/\D+/g, "");
}

function normalizePhoneBR(raw) {
  const digits = onlyDigits(raw);
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  return digits;
}

function firstName(name) {
  const clean = String(name || "").trim();
  return clean ? clean.split(/\s+/)[0] || "" : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fmtBRL(cents) {
  const value = Number.isFinite(Number(cents)) ? Number(cents) : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function buildFeedbackPublicUrl(offer, origin = "") {
  const base = buildOfferPublicUrl(offer, origin, { preferPublic: true });
  if (!base) return "";
  return `${base}/feedback`;
}

function resolveFulfillmentLabel(offer) {
  return String(offer?.offerType || "").trim().toLowerCase() === "product"
    ? "Pedido entregue"
    : "Atendimento concluido";
}

function resolveFeedbackStatus(offer) {
  const rating = Number(offer?.feedback?.rating);
  if (offer?.feedback?.respondedAt && Number.isFinite(rating) && rating > 0) {
    return {
      code: "RESPONDED",
      label: `Avaliacao respondida: ${rating}/5`,
      tone: "CONFIRMED",
    };
  }
  if (offer?.feedbackRequest?.sentAt) {
    return {
      code: "SENT",
      label: "Avaliacao enviada",
      tone: "ACCEPTED",
    };
  }
  return {
    code: "PENDING",
    label: "Nao concluido",
    tone: "PUBLIC",
  };
}

function buildFeedbackWhatsAppMessage({ offer, publicFeedbackUrl }) {
  const name = firstName(offer?.customerName);
  const fulfillmentLabel = resolveFulfillmentLabel(offer).toLowerCase();

  return [
    name ? `Oi, ${name}!` : "Oi!",
    "",
    `Obrigada por confiar na gente. Seu ${fulfillmentLabel} foi registrado por aqui.`,
    "Se puder, queria te pedir uma avaliacao rapida. Leva menos de 1 minuto:",
    publicFeedbackUrl,
    "",
    "Sua opiniao ajuda muito a melhorar os proximos atendimentos.",
  ].join("\n");
}

function buildFeedbackRequestEmail({ offer, publicFeedbackUrl }) {
  const customerName = String(offer?.customerName || "").trim() || "Cliente";
  const title = String(offer?.title || "").trim() || "sua proposta";
  const fulfillmentLabel = resolveFulfillmentLabel(offer);
  const amount = fmtBRL(offer?.totalCents ?? offer?.amountCents ?? 0);
  const subtitle =
    String(offer?.offerType || "").trim().toLowerCase() === "product"
      ? "Esperamos que sua compra tenha sido uma otima experiencia."
      : "Esperamos que seu atendimento tenha sido uma otima experiencia.";

  const subject = `Obrigado pela experiencia com ${title}`;

  const html = `
    <div style="background:#f5f7fb;padding:32px 16px;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
        Obrigado pela sua experiencia. Sua avaliacao ajuda a melhorar cada novo atendimento.
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;border-collapse:collapse;">
        <tr>
          <td style="padding:0;">
            <div style="background:linear-gradient(135deg,#0f172a,#1d4ed8);border-radius:28px 28px 0 0;padding:28px 32px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
              <div style="font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.72);">
                Lumina
              </div>
              <div style="margin-top:10px;font-size:28px;font-weight:800;line-height:1.2;">
                Obrigado, ${escapeHtml(customerName)}.
              </div>
              <div style="margin-top:10px;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.84);">
                ${escapeHtml(subtitle)}
              </div>
            </div>
            <div style="background:#ffffff;border:1px solid #dbe3f0;border-top:none;border-radius:0 0 28px 28px;padding:28px 32px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
              <div style="border:1px solid #e2e8f0;border-radius:22px;padding:18px 20px;background:#f8fafc;">
                <div style="font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#64748b;">
                  Resumo
                </div>
                <div style="margin-top:10px;font-size:18px;font-weight:700;color:#0f172a;">
                  ${escapeHtml(title)}
                </div>
                <div style="margin-top:8px;font-size:14px;line-height:1.7;color:#475569;">
                  ${escapeHtml(fulfillmentLabel)}<br/>
                  Valor da proposta: <strong>${escapeHtml(amount)}</strong>
                </div>
              </div>

              <div style="margin-top:22px;font-size:15px;line-height:1.8;color:#334155;">
                Sua opiniao ajuda muito a melhorar cada novo atendimento. Se puder, avalie sua experiencia em poucos segundos.
              </div>

              <div style="margin-top:24px;">
                <a href="${escapeHtml(publicFeedbackUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-size:14px;font-weight:700;">
                  Avaliar experiencia
                </a>
              </div>

              <div style="margin-top:16px;font-size:12px;line-height:1.7;color:#64748b;">
                Se preferir, copie este link no navegador:<br/>
                <span style="word-break:break-all;color:#1d4ed8;">${escapeHtml(publicFeedbackUrl)}</span>
              </div>
            </div>
          </td>
        </tr>
      </table>
    </div>`;

  const text = [
    `Obrigado, ${customerName}.`,
    "",
    subtitle,
    `${fulfillmentLabel}: ${title}`,
    `Valor da proposta: ${amount}`,
    "",
    "Se puder, avalie sua experiencia em poucos segundos:",
    publicFeedbackUrl,
  ].join("\n");

  return { subject, html, text };
}

function resolveWhatsAppCapability(context = null) {
  if (isWhatsAppNotificationsEnabled() !== true) {
    return {
      available: false,
      code: "WHATSAPP_ENVIRONMENT_DISABLED",
      reason: "WhatsApp indisponivel no ambiente.",
      status: 503,
    };
  }

  if (isWhatsAppMasterEnabled(context) === true) {
    return { available: true, code: "", reason: "", status: 200 };
  }

  if (context?.capabilities?.environment?.whatsapp?.available !== true) {
    return {
      available: false,
      code: "WHATSAPP_ENVIRONMENT_DISABLED",
      reason:
        context?.capabilities?.environment?.whatsapp?.reason ||
        "WhatsApp indisponivel no ambiente.",
      status: 503,
    };
  }

  return {
    available: false,
    code: "WHATSAPP_MASTER_DISABLED",
    reason: "WhatsApp desativado nas configuracoes do workspace.",
    status: 403,
  };
}

async function sendFeedbackRequestEmail({ offer, publicFeedbackUrl }) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM || "").trim();
  const to = String(offer?.customerEmail || "").trim().toLowerCase();

  if (!apiKey) {
    const error = new Error("RESEND_API_KEY ausente.");
    error.statusCode = 500;
    error.code = "EMAIL_PROVIDER_UNAVAILABLE";
    throw error;
  }
  if (!from) {
    const error = new Error("RESEND_FROM ausente.");
    error.statusCode = 500;
    error.code = "EMAIL_PROVIDER_UNAVAILABLE";
    throw error;
  }
  if (!to) {
    const error = new Error("Cliente sem e-mail valido para avaliacao.");
    error.statusCode = 409;
    error.code = "NO_EMAIL";
    throw error;
  }

  const { subject, html, text } = buildFeedbackRequestEmail({
    offer,
    publicFeedbackUrl,
  });

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `offer-feedback:${String(offer?._id || "")}:${Date.now()}`,
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      data?.message || data?.error || `Resend error (${response.status})`,
    );
    error.statusCode = response.status;
    error.code = "EMAIL_SEND_FAILED";
    error.data = data;
    throw error;
  }

  return {
    messageId: data?.id || data?.data?.id || null,
  };
}

async function sendFeedbackRequestWhatsApp({
  offer,
  workspaceId,
  ownerUserId,
  requesterUserId,
  publicFeedbackUrl,
}) {
  const notificationContext = await resolveWorkspaceNotificationContext({
    workspaceId,
    ownerUserId: ownerUserId || null,
  });
  const capability = resolveWhatsAppCapability(notificationContext);
  if (!capability.available) {
    const error = new Error(capability.reason);
    error.statusCode = capability.status;
    error.code = capability.code;
    throw error;
  }

  const to = normalizePhoneBR(offer?.customerWhatsApp);
  if (!to) {
    const error = new Error("Cliente sem WhatsApp valido para avaliacao.");
    error.statusCode = 409;
    error.code = "NO_PHONE";
    throw error;
  }

  const result = await queueOrSendWhatsApp({
    workspaceId,
    to,
    message: buildFeedbackWhatsAppMessage({
      offer,
      publicFeedbackUrl,
    }),
    sourceType: "offer_feedback_request",
    sourceId: offer?._id || null,
    meta: {
      direction: "offer_feedback_request",
      offerId: offer?._id || null,
      requesterUserId: requesterUserId || null,
      publicFeedbackUrl,
    },
  });

  return {
    messageId: result?.providerMessageId || result?.outbox?._id || null,
    status: result?.status || "queued",
  };
}

function assertFeedbackEligibility(offer) {
  if (!offer) {
    const error = new Error("Proposta nao encontrada.");
    error.statusCode = 404;
    error.code = "OFFER_NOT_FOUND";
    throw error;
  }

  if (!isPaidConfirmedOffer(offer)) {
    const error = new Error(
      "Somente propostas com pagamento confirmado podem ser concluidas.",
    );
    error.statusCode = 409;
    error.code = "OFFER_NOT_PAID";
    throw error;
  }

  if (normalizeStatus(offer?.status) === "CANCELLED") {
    const error = new Error("Proposta cancelada nao pode receber avaliacao.");
    error.statusCode = 409;
    error.code = "OFFER_CANCELLED";
    throw error;
  }
}

export async function completeOfferFulfillmentByWorkspace({
  offerId,
  workspaceId,
  ownerUserId = null,
  completedByUserId = null,
  sendFeedbackRequest = false,
  channel = "whatsapp",
  origin = "",
} = {}) {
  const query = { _id: offerId, workspaceId };
  if (ownerUserId) query.ownerUserId = ownerUserId;

  const offer = await Offer.findOne(query).lean();
  assertFeedbackEligibility(offer);

  const now = new Date();
  const normalizedChannel =
    String(channel || "").trim().toLowerCase() === "email" ? "email" : "whatsapp";
  const fulfillmentLabel = resolveFulfillmentLabel(offer);

  const setPatch = {
    "fulfillment.label": fulfillmentLabel,
  };
  if (!offer?.fulfillment?.completedAt) {
    setPatch["fulfillment.completedAt"] = now;
    setPatch["fulfillment.completedByUserId"] = completedByUserId || null;
  }

  let dispatch = null;
  if (sendFeedbackRequest) {
    const publicFeedbackUrl = buildFeedbackPublicUrl(offer, origin);
    if (!publicFeedbackUrl) {
      const error = new Error("Nao consegui gerar o link publico de avaliacao.");
      error.statusCode = 500;
      error.code = "FEEDBACK_PUBLIC_URL_UNAVAILABLE";
      throw error;
    }

    if (normalizedChannel === "email") {
      dispatch = await sendFeedbackRequestEmail({
        offer,
        publicFeedbackUrl,
      });
    } else {
      dispatch = await sendFeedbackRequestWhatsApp({
        offer,
        workspaceId,
        ownerUserId: ownerUserId || offer?.ownerUserId || null,
        requesterUserId: completedByUserId || null,
        publicFeedbackUrl,
      });
    }

    setPatch["feedbackRequest.sentAt"] = now;
    setPatch["feedbackRequest.channel"] = normalizedChannel;
    setPatch["feedbackRequest.sentByUserId"] = completedByUserId || null;
    setPatch["feedbackRequest.lastMessageId"] = dispatch?.messageId || null;
  }

  await Offer.updateOne({ _id: offer._id }, { $set: setPatch }, { strict: false });

  const updated = await Offer.findById(offer._id).lean();
  return {
    offer: updated,
    dispatch: sendFeedbackRequest
      ? {
          ok: true,
          channel: normalizedChannel,
          status: dispatch?.status || "sent",
          messageId: dispatch?.messageId || null,
          publicFeedbackUrl: buildFeedbackPublicUrl(updated, origin),
        }
      : null,
  };
}

export async function submitPublicOfferFeedback({
  token,
  rating,
  comment = "",
  contactRequested = false,
}) {
  const offer = await Offer.findOne({ publicToken: token }).lean();
  assertFeedbackEligibility(offer);

  if (!offer?.fulfillment?.completedAt || !offer?.feedbackRequest?.sentAt) {
    const error = new Error("A avaliacao ainda nao esta disponivel para esta proposta.");
    error.statusCode = 409;
    error.code = "FEEDBACK_NOT_AVAILABLE";
    throw error;
  }

  if (offer?.feedback?.respondedAt) {
    const error = new Error("A avaliacao desta proposta ja foi registrada.");
    error.statusCode = 409;
    error.code = "FEEDBACK_ALREADY_SUBMITTED";
    throw error;
  }

  const parsedRating = Number(rating);
  if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    const error = new Error("Informe uma nota de 1 a 5.");
    error.statusCode = 400;
    error.code = "INVALID_FEEDBACK_RATING";
    throw error;
  }

  const trimmedComment = String(comment || "").trim().slice(0, 1000);
  const allowContactRequest = parsedRating <= 3;
  const now = new Date();

  await Offer.updateOne(
    { _id: offer._id, "feedback.respondedAt": null },
    {
      $set: {
        "feedback.respondedAt": now,
        "feedback.rating": parsedRating,
        "feedback.comment": trimmedComment || null,
        "feedback.contactRequested": allowContactRequest
          ? contactRequested === true
          : false,
      },
    },
    { strict: false },
  );

  return Offer.findById(offer._id).lean();
}

export function buildOfferFeedbackPublicState(offer, origin = "") {
  const type =
    String(offer?.offerType || "").trim().toLowerCase() === "product"
      ? "product"
      : "service";
  const paid = isPaidConfirmedOffer(offer);
  const fulfilled = !!offer?.fulfillment?.completedAt;
  const feedbackSent = !!offer?.feedbackRequest?.sentAt;
  const responded = !!offer?.feedback?.respondedAt;
  const feedbackUrl = buildFeedbackPublicUrl(offer, origin);

  let availability = {
    eligible: true,
    reason: "",
    code: "",
  };

  if (!paid) {
    availability = {
      eligible: false,
      reason: "A avaliacao so fica disponivel depois da confirmacao do pagamento.",
      code: "OFFER_NOT_PAID",
    };
  } else if (!fulfilled) {
    availability = {
      eligible: false,
      reason: "O atendimento ainda nao foi marcado como concluido.",
      code: "FULFILLMENT_PENDING",
    };
  } else if (!feedbackSent) {
    availability = {
      eligible: false,
      reason: "O pedido de avaliacao ainda nao foi enviado para esta proposta.",
      code: "FEEDBACK_NOT_SENT",
    };
  }

  return {
    offerId: offer?._id ? String(offer._id) : "",
    token: String(offer?.publicToken || ""),
    offerType: type,
    title: String(offer?.title || "").trim() || "Proposta",
    customerName: String(offer?.customerName || "").trim() || "",
    amountCents: Number(offer?.totalCents ?? offer?.amountCents ?? 0) || 0,
    fulfillmentLabel: resolveFulfillmentLabel(offer),
    feedbackStatus: resolveFeedbackStatus(offer),
    availability,
    feedbackUrl,
    feedback: {
      respondedAt: offer?.feedback?.respondedAt || null,
      rating: Number(offer?.feedback?.rating) || null,
      comment: String(offer?.feedback?.comment || "").trim() || "",
      contactRequested: offer?.feedback?.contactRequested === true,
    },
  };
}
