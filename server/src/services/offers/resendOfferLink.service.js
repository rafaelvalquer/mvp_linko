import { Offer } from "../../models/Offer.js";
import { resolveWorkspaceNotificationContext, isWhatsAppMasterEnabled } from "../notificationSettings.js";
import { buildOfferPublicUrl } from "../publicUrl.service.js";
import { isWhatsAppNotificationsEnabled } from "../waGateway.js";
import { queueOrSendWhatsApp } from "../whatsappOutbox.service.js";

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

function normalizeStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  return status === "CANCELED" ? "CANCELLED" : status;
}

function resolveResendCapability(context = null) {
  if (isWhatsAppNotificationsEnabled() !== true) {
    return {
      available: false,
      code: "WHATSAPP_ENVIRONMENT_DISABLED",
      reason: "WhatsApp indisponivel no ambiente.",
      status: 503,
    };
  }

  if (isWhatsAppMasterEnabled(context) === true) {
    return {
      available: true,
      code: "",
      reason: "",
      status: 200,
    };
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

function buildOfferResendMessage({ offer, publicUrl }) {
  const name = firstName(offer?.customerName);
  const title = String(offer?.title || "sua proposta").trim() || "sua proposta";

  return [
    name ? `Ola, ${name}!` : "Ola!",
    "",
    `Estou reenviando o link da proposta *${title}* para facilitar sua consulta.`,
    "Voce pode revisar e concluir pelo link abaixo:",
    publicUrl,
  ].join("\n");
}

export async function resendOfferLinkByWorkspace({
  offerId,
  workspaceId,
  ownerUserId = null,
  userId = null,
  origin = "",
} = {}) {
  const query = {
    _id: offerId,
    workspaceId,
  };

  if (ownerUserId) query.ownerUserId = ownerUserId;

  const offer = await Offer.findOne(query).lean();
  if (!offer) {
    const error = new Error("Nao encontrei a proposta para reenviar.");
    error.status = 404;
    error.statusCode = 404;
    error.code = "OFFER_NOT_FOUND";
    throw error;
  }

  const paymentStatus = normalizeStatus(offer?.paymentStatus);
  const status = normalizeStatus(offer?.status);

  if (["CONFIRMED", "PAID"].includes(paymentStatus) || ["CONFIRMED", "PAID"].includes(status)) {
    const error = new Error("Essa proposta ja foi concluida e nao precisa de reenvio.");
    error.status = 409;
    error.statusCode = 409;
    error.code = "OFFER_ALREADY_COMPLETED";
    throw error;
  }

  if (["EXPIRED", "CANCELLED"].includes(status)) {
    const error = new Error("Essa proposta nao pode ser reenviada no status atual.");
    error.status = 409;
    error.statusCode = 409;
    error.code = "OFFER_NOT_ELIGIBLE";
    throw error;
  }

  const publicUrl = buildOfferPublicUrl(offer, origin, { preferPublic: true });
  if (!publicUrl) {
    const error = new Error("Nao consegui gerar o link publico da proposta.");
    error.status = 500;
    error.statusCode = 500;
    error.code = "OFFER_PUBLIC_URL_UNAVAILABLE";
    throw error;
  }

  const notificationContext = await resolveWorkspaceNotificationContext({
    workspaceId,
    ownerUserId: ownerUserId || null,
  });
  const capability = resolveResendCapability(notificationContext);

  if (!capability.available) {
    const error = new Error(capability.reason);
    error.status = capability.status;
    error.statusCode = capability.status;
    error.code = capability.code;
    throw error;
  }

  const to = normalizePhoneBR(offer?.customerWhatsApp);
  if (!to) {
    const error = new Error("Essa proposta nao tem WhatsApp valido para reenvio.");
    error.status = 409;
    error.statusCode = 409;
    error.code = "NO_PHONE";
    throw error;
  }

  const result = await queueOrSendWhatsApp({
    workspaceId,
    to,
    message: buildOfferResendMessage({
      offer,
      publicUrl,
    }),
    sourceType: "offer_resend",
    sourceId: offer?._id || null,
    meta: {
      direction: "offer_resend",
      offerId: offer?._id || null,
      requesterUserId: userId || null,
      publicUrl,
    },
  });

  return {
    status: String(result?.status || "failed").trim() || "failed",
    publicUrl,
    offer,
    providerMessageId: result?.providerMessageId || null,
  };
}
