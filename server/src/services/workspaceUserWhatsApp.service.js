import { User } from "../models/User.js";
import { normalizeWhatsAppPhoneDigits } from "../utils/phone.js";
import {
  getNotificationFeatureCapability,
  isWhatsAppMasterEnabled,
  resolveWorkspaceOwnerNotificationContext,
} from "./notificationSettings.js";
import { queueOrSendWhatsApp } from "./whatsappOutbox.service.js";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";

function formatMoney(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents || 0) || 0) / 100);
}

function firstName(name) {
  const clean = String(name || "").trim();
  if (!clean) return "";
  return clean.split(/\s+/)[0] || "";
}

function formatDateTime(value, timeZone = DEFAULT_TIMEZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getOfferTitle(offer) {
  return String(offer?.title || offer?.name || "Proposta").trim() || "Proposta";
}

function getOfferValueCents(offer, fallback = 0) {
  const cents =
    offer?.paidAmountCents ?? offer?.totalCents ?? offer?.amountCents ?? fallback;
  return Number(cents || 0) || 0;
}

function getCustomerName(input = {}) {
  return (
    String(input?.customerName || input?.customer?.name || "").trim() || "Cliente"
  );
}

function getBookingWhen(booking, timeZone = DEFAULT_TIMEZONE) {
  return formatDateTime(booking?.startAt || booking?.start || booking?.from, timeZone);
}

function buildSkipped(reason, code = "SKIPPED") {
  return {
    ok: false,
    status: "SKIPPED",
    reason,
    code,
  };
}

function buildFailed(error) {
  return {
    ok: false,
    status: "FAILED",
    error,
  };
}

function resolveMasterWhatsAppCapability(context) {
  if (isWhatsAppMasterEnabled(context) === true) {
    return {
      available: true,
      code: "",
      reason: "",
    };
  }

  if (context?.capabilities?.environment?.whatsapp?.available !== true) {
    return {
      available: false,
      code: "WHATSAPP_ENVIRONMENT_DISABLED",
      reason:
        context?.capabilities?.environment?.whatsapp?.reason ||
        "WhatsApp indisponivel no ambiente.",
    };
  }

  return {
    available: false,
    code: "WHATSAPP_MASTER_DISABLED",
    reason: "WhatsApp desativado nas configuracoes do workspace.",
  };
}

function resolveEmailToggleCapability(context, emailSettingKey) {
  const masterCapability = resolveMasterWhatsAppCapability(context);
  if (masterCapability.available !== true) return masterCapability;

  if (context?.settings?.email?.[emailSettingKey] === true) {
    return {
      available: true,
      code: "",
      reason: "",
    };
  }

  return {
    available: false,
    code: "WORKSPACE_SETTING_DISABLED",
    reason: "Este aviso esta desativado nas configuracoes do workspace.",
  };
}

async function dispatchResponsibleUserWhatsApp({
  workspaceId = null,
  ownerUserId = null,
  message = "",
  dedupeKey = null,
  sourceId = null,
  meta = null,
}) {
  const recipient = await resolveResponsibleUserWhatsApp({ ownerUserId });
  if (!recipient.ok) {
    return buildSkipped(recipient.reason, recipient.code);
  }

  const result = await queueOrSendWhatsApp({
    workspaceId,
    to: recipient.to,
    message,
    dedupeKey,
    sourceType: "workspace_user_notification",
    sourceId: sourceId || null,
    meta: {
      recipientUserId: String(recipient.user?._id || ""),
      recipientName: String(recipient.user?.name || ""),
      ...(meta && typeof meta === "object" ? meta : {}),
    },
  });

  if (result?.status === "sent") {
    return {
      ok: true,
      status: "SENT",
      to: recipient.to,
      providerMessageId: result?.providerMessageId || null,
    };
  }

  if (result?.status === "queued") {
    return {
      ok: true,
      status: "QUEUED",
      to: recipient.to,
    };
  }

  return buildFailed(result?.error || new Error("Falha ao enviar WhatsApp"));
}

function buildSellerProofSubmittedMessage({ offer, booking, proof, recipientName }) {
  const greeting = firstName(recipientName);
  const title = getOfferTitle(offer);
  const customerName = getCustomerName(offer);
  const amount = formatMoney(getOfferValueCents(offer));
  const when = getBookingWhen(booking);
  const uploadedAt = formatDateTime(proof?.uploadedAt);

  return [
    greeting ? `Oi, ${greeting}!` : "Oi!",
    "",
    "*Novo comprovante recebido*",
    `Cliente: *${customerName}*`,
    `Proposta: *${title}*`,
    `Valor: *${amount}*`,
    when ? `Agendamento: *${when}*` : "",
    uploadedAt ? `Enviado em: *${uploadedAt}*` : "",
    "",
    "Abra o painel para revisar e confirmar o pagamento.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSellerPixPaidMessage({
  offer,
  booking,
  paidAt,
  paidAmountCents,
  recipientName,
}) {
  const greeting = firstName(recipientName);
  const title = getOfferTitle(offer);
  const customerName = getCustomerName(offer);
  const amount = formatMoney(
    getOfferValueCents(offer, paidAmountCents ?? offer?.paidAmountCents ?? 0),
  );
  const when = getBookingWhen(booking);
  const paidWhen = formatDateTime(paidAt || offer?.paidAt || offer?.confirmedAt);

  return [
    greeting ? `Oi, ${greeting}!` : "Oi!",
    "",
    "*Pagamento Pix confirmado*",
    `Cliente: *${customerName}*`,
    `Proposta: *${title}*`,
    `Valor: *${amount}*`,
    when ? `Agendamento: *${when}*` : "",
    paidWhen ? `Confirmado em: *${paidWhen}*` : "",
    "",
    "A proposta ja pode seguir para o proximo passo no painel.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSellerPlatformConfirmedMessage({
  offer,
  booking,
  recipientName,
}) {
  const greeting = firstName(recipientName);
  const title = getOfferTitle(offer);
  const customerName = getCustomerName(offer);
  const amount = formatMoney(getOfferValueCents(offer));
  const when = getBookingWhen(booking);
  const confirmedWhen = formatDateTime(offer?.confirmedAt || offer?.paidAt);

  return [
    greeting ? `Oi, ${greeting}!` : "Oi!",
    "",
    "*Pagamento confirmado na plataforma*",
    `Cliente: *${customerName}*`,
    `Proposta: *${title}*`,
    `Valor: *${amount}*`,
    when ? `Agendamento: *${when}*` : "",
    confirmedWhen ? `Atualizado em: *${confirmedWhen}*` : "",
    "",
    "A proposta foi marcada como paga no painel.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildBookingChangeMessage({
  type,
  offerRaw,
  bookingBefore,
  bookingAfter,
  reason = "",
  timeZone = DEFAULT_TIMEZONE,
  recipientName,
}) {
  const greeting = firstName(recipientName);
  const customerName = getCustomerName(
    bookingAfter || bookingBefore || offerRaw || {},
  );
  const title = getOfferTitle(offerRaw);
  const previousWhen = getBookingWhen(bookingBefore, timeZone);
  const nextWhen = getBookingWhen(bookingAfter, timeZone);

  if (type === "cancel") {
    return [
      greeting ? `Oi, ${greeting}!` : "Oi!",
      "",
      "*Cliente cancelou um agendamento*",
      `Cliente: *${customerName}*`,
      `Servico: *${title}*`,
      previousWhen ? `Horario: *${previousWhen}*` : "",
      reason ? `Motivo: *${reason}*` : "",
      "",
      "Se precisar, entre em contato com o cliente pelo painel.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    greeting ? `Oi, ${greeting}!` : "Oi!",
    "",
    "*Cliente reagendou um horario*",
    `Cliente: *${customerName}*`,
    `Servico: *${title}*`,
    previousWhen ? `Antes: *${previousWhen}*` : "",
    nextWhen ? `Novo horario: *${nextWhen}*` : "",
    reason ? `Motivo: *${reason}*` : "",
    "",
    "Confira o painel para seguir com a operacao.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function resolveResponsibleUserWhatsApp({ ownerUserId = null }) {
  if (!ownerUserId) {
    return {
      ok: false,
      code: "NO_OWNER_USER",
      reason: "Registro sem usuario responsavel.",
    };
  }

  const user = await User.findById(ownerUserId)
    .select("name status whatsappPhone whatsappPhoneDigits")
    .lean()
    .catch(() => null);

  if (!user || String(user?.status || "active").toLowerCase() !== "active") {
    return {
      ok: false,
      code: "RECIPIENT_UNAVAILABLE",
      reason: "Usuario responsavel indisponivel para notificacao.",
    };
  }

  const to =
    String(user?.whatsappPhoneDigits || "").trim() ||
    normalizeWhatsAppPhoneDigits(user?.whatsappPhone || "");

  if (!to) {
    return {
      ok: false,
      code: "NO_PHONE",
      reason: "Usuario responsavel sem WhatsApp configurado.",
    };
  }

  return {
    ok: true,
    to,
    user,
  };
}

export async function notifyResponsibleSellerProofSubmittedWhatsApp({
  offer,
  booking = null,
  proof = null,
  notificationContext = null,
}) {
  const context =
    notificationContext ||
    (await resolveWorkspaceOwnerNotificationContext({
      workspaceId: offer?.workspaceId || null,
    }));
  const capability = resolveEmailToggleCapability(context, "sellerProofSubmitted");
  if (capability.available !== true) {
    return buildSkipped(capability.reason, capability.code);
  }

  const recipient = await resolveResponsibleUserWhatsApp({
    ownerUserId: offer?.ownerUserId || null,
  });
  if (!recipient.ok) {
    return buildSkipped(recipient.reason, recipient.code);
  }

  const proofKey =
    String(proof?.storage?.key || offer?.paymentProof?.storage?.key || "").trim() ||
    "latest";

  return dispatchResponsibleUserWhatsApp({
    workspaceId: offer?.workspaceId || null,
    ownerUserId: offer?.ownerUserId || null,
    sourceId: offer?._id || null,
    dedupeKey: `workspace-user:${String(offer?._id || "")}:seller-proof-submitted:${proofKey}`,
    message: buildSellerProofSubmittedMessage({
      offer,
      booking,
      proof,
      recipientName: recipient.user?.name || "",
    }),
    meta: {
      eventType: "SELLER_PROOF_SUBMITTED",
      offerId: String(offer?._id || ""),
      proofKey,
    },
  });
}

export async function notifyResponsibleSellerPixPaidWhatsApp({
  offer,
  booking = null,
  pixId = null,
  paidAt = null,
  paidAmountCents = null,
  notificationContext = null,
}) {
  const context =
    notificationContext ||
    (await resolveWorkspaceOwnerNotificationContext({
      workspaceId: offer?.workspaceId || null,
    }));
  const capability = resolveEmailToggleCapability(context, "sellerPixPaid");
  if (capability.available !== true) {
    return buildSkipped(capability.reason, capability.code);
  }

  const recipient = await resolveResponsibleUserWhatsApp({
    ownerUserId: offer?.ownerUserId || null,
  });
  if (!recipient.ok) {
    return buildSkipped(recipient.reason, recipient.code);
  }

  const seed =
    String(pixId || "").trim() ||
    String(offer?.payment?.lastPixId || "").trim() ||
    String(offer?.paidAt || paidAt || "").trim() ||
    "paid";

  return dispatchResponsibleUserWhatsApp({
    workspaceId: offer?.workspaceId || null,
    ownerUserId: offer?.ownerUserId || null,
    sourceId: offer?._id || null,
    dedupeKey: `workspace-user:${String(offer?._id || "")}:seller-pix-paid:${seed}`,
    message: buildSellerPixPaidMessage({
      offer,
      booking,
      paidAt,
      paidAmountCents,
      recipientName: recipient.user?.name || "",
    }),
    meta: {
      eventType: "SELLER_PIX_PAID",
      offerId: String(offer?._id || ""),
      pixId: String(pixId || "").trim() || null,
    },
  });
}

export async function notifyResponsibleSellerPlatformConfirmedWhatsApp({
  offer,
  booking = null,
  proof = null,
  notificationContext = null,
}) {
  const context =
    notificationContext ||
    (await resolveWorkspaceOwnerNotificationContext({
      workspaceId: offer?.workspaceId || null,
    }));
  const capability = resolveEmailToggleCapability(
    context,
    "sellerPlatformConfirmed",
  );
  if (capability.available !== true) {
    return buildSkipped(capability.reason, capability.code);
  }

  const recipient = await resolveResponsibleUserWhatsApp({
    ownerUserId: offer?.ownerUserId || null,
  });
  if (!recipient.ok) {
    return buildSkipped(recipient.reason, recipient.code);
  }

  const seed =
    String(proof?.storage?.key || "").trim() ||
    String(offer?.confirmedAt || offer?.paidAt || "").trim() ||
    "confirmed";

  return dispatchResponsibleUserWhatsApp({
    workspaceId: offer?.workspaceId || null,
    ownerUserId: offer?.ownerUserId || null,
    sourceId: offer?._id || null,
    dedupeKey: `workspace-user:${String(offer?._id || "")}:seller-platform-confirmed:${seed}`,
    message: buildSellerPlatformConfirmedMessage({
      offer,
      booking,
      recipientName: recipient.user?.name || "",
    }),
    meta: {
      eventType: "SELLER_PLATFORM_CONFIRMED",
      offerId: String(offer?._id || ""),
      proofKey: String(proof?.storage?.key || "").trim() || null,
    },
  });
}

export async function notifyResponsibleBookingChangeWhatsApp({
  type,
  offerRaw,
  bookingBefore = null,
  bookingAfter = null,
  reason = "",
  timeZone = DEFAULT_TIMEZONE,
  notificationContext = null,
}) {
  const context =
    notificationContext ||
    (await resolveWorkspaceOwnerNotificationContext({
      workspaceId: offerRaw?.workspaceId || null,
    }));
  const capability = getNotificationFeatureCapability(
    context,
    "whatsappBookingChanges",
  );
  if (capability.available !== true) {
    return buildSkipped(capability.reason, capability.code);
  }

  const recipient = await resolveResponsibleUserWhatsApp({
    ownerUserId: offerRaw?.ownerUserId || null,
  });
  if (!recipient.ok) {
    return buildSkipped(recipient.reason, recipient.code);
  }

  const eventType =
    type === "cancel"
      ? `BOOKING_CANCELLED_BY_CUSTOMER:${String(bookingAfter?._id || bookingBefore?._id || "")}`
      : `BOOKING_RESCHEDULED_BY_CUSTOMER:${String(bookingAfter?._id || bookingBefore?._id || "")}:${String(bookingAfter?.startAt || "")}`;

  return dispatchResponsibleUserWhatsApp({
    workspaceId: offerRaw?.workspaceId || null,
    ownerUserId: offerRaw?.ownerUserId || null,
    sourceId: bookingAfter?._id || bookingBefore?._id || offerRaw?._id || null,
    dedupeKey: `workspace-user:${eventType}`,
    message: buildBookingChangeMessage({
      type,
      offerRaw,
      bookingBefore,
      bookingAfter,
      reason,
      timeZone,
      recipientName: recipient.user?.name || "",
    }),
    meta: {
      eventType,
      bookingId: String(bookingAfter?._id || bookingBefore?._id || ""),
      offerId: String(offerRaw?._id || ""),
      reason: reason || null,
    },
  });
}
