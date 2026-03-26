import Booking from "../../models/Booking.js";
import { Offer } from "../../models/Offer.js";
import {
  notifyPaymentConfirmed,
  notifyPaymentRejected,
} from "../whatsappNotify.js";
import {
  notifySellerPixPaid,
  notifySellerPaymentConfirmedOnPlatform,
} from "../resendEmail.js";
import {
  isEmailNotificationEnabled,
  resolveWorkspaceOwnerNotificationContext,
} from "../notificationSettings.js";
import {
  notifyResponsibleSellerPixPaidWhatsApp,
  notifyResponsibleSellerPlatformConfirmedWhatsApp,
} from "../workspaceUserWhatsApp.service.js";

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace("CANCELED", "CANCELLED");
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
  return depositEnabled ? depositCents : totalCents;
}

async function safeNotifyPaymentConfirmed(offerId) {
  try {
    return await notifyPaymentConfirmed(offerId);
  } catch (err) {
    return {
      ok: false,
      status: "FAILED",
      error: {
        message: String(err?.message || "Falha ao notificar WhatsApp"),
        code: String(err?.code || err?.name || "NOTIFY_FAILED"),
      },
    };
  }
}

async function safeNotifySellerPixPaid({
  offer,
  booking,
  now,
  includeInternalWhatsApp = true,
}) {
  let internalWhatsApp = null;

  try {
    const notificationContext = await resolveWorkspaceOwnerNotificationContext({
      workspaceId: offer?.workspaceId || null,
    });

    let email = null;
    if (!isEmailNotificationEnabled(notificationContext, "sellerPixPaid")) {
      email = {
        status: "SKIPPED",
        reason:
          notificationContext?.capabilities?.environment?.email?.available !== true
            ? notificationContext?.capabilities?.environment?.email?.reason ||
              "EMAIL_UNAVAILABLE"
            : "WORKSPACE_SETTING_DISABLED",
      };
    } else {
      const result = await notifySellerPixPaid({
        offerId: offer._id,
        offer,
        booking,
        pixId: offer?.payment?.lastPixId || null,
        paidAt: offer?.paidAt || now,
        paidAmountCents: offer?.paidAmountCents || null,
        proof: offer?.paymentProof || null,
      });

      email = result?.skipped
        ? { status: "SKIPPED", reason: result.reason || "" }
        : { status: "SENT", id: result?.id || null, to: result?.to || "" };
    }

    if (includeInternalWhatsApp) {
      internalWhatsApp = await notifyResponsibleSellerPixPaidWhatsApp({
        offer,
        booking,
        pixId: offer?.payment?.lastPixId || null,
        paidAt: offer?.paidAt || now,
        paidAmountCents: offer?.paidAmountCents || null,
        notificationContext,
      });
    } else {
      internalWhatsApp = {
        ok: false,
        status: "SKIPPED",
        reason: "MANUAL_PLATFORM_CONFIRMATION",
        code: "MANUAL_PLATFORM_CONFIRMATION",
      };
    }

    return { ...email, internalWhatsApp };
  } catch (error) {
    return {
      status: "FAILED",
      error: String(error?.message || "email_failed"),
      internalWhatsApp,
    };
  }
}

async function safeNotifySellerConfirmedOnPlatform({ offer, booking }) {
  let internalWhatsApp = null;

  try {
    const notificationContext = await resolveWorkspaceOwnerNotificationContext({
      workspaceId: offer?.workspaceId || null,
    });

    let email = null;
    if (!isEmailNotificationEnabled(notificationContext, "sellerPlatformConfirmed")) {
      email = {
        status: "SKIPPED",
        reason:
          notificationContext?.capabilities?.environment?.email?.available !== true
            ? notificationContext?.capabilities?.environment?.email?.reason ||
              "EMAIL_UNAVAILABLE"
            : "WORKSPACE_SETTING_DISABLED",
      };
    } else {
      const result = await notifySellerPaymentConfirmedOnPlatform({
        offerId: offer._id,
        offer,
        booking,
        proof: offer?.paymentProof || null,
      });

      email = result?.skipped
        ? { status: "SKIPPED", reason: result.reason || "" }
        : { status: "SENT", id: result?.id || null, to: result?.to || "" };
    }

    internalWhatsApp = await notifyResponsibleSellerPlatformConfirmedWhatsApp({
      offer,
      booking,
      proof: offer?.paymentProof || null,
      notificationContext,
    });

    return { ...email, internalWhatsApp };
  } catch (error) {
    return {
      status: "FAILED",
      error: String(error?.message || "email_failed"),
      internalWhatsApp,
    };
  }
}

async function safeNotifyPaymentRejected(offerId, options = {}) {
  try {
    return await notifyPaymentRejected(offerId, options);
  } catch (err) {
    return {
      ok: false,
      status: "FAILED",
      error: {
        message: String(err?.message || "Falha ao notificar WhatsApp"),
        code: String(err?.code || err?.name || "NOTIFY_FAILED"),
      },
    };
  }
}

async function findScopedOffer({ offerId, workspaceId, ownerUserId = null }) {
  const query = { _id: offerId, workspaceId };
  if (ownerUserId) query.ownerUserId = ownerUserId;

  const offer = await Offer.findOne(query).lean();
  if (!offer) {
    const err = new Error("Offer not found");
    err.status = 404;
    err.code = "OFFER_NOT_FOUND";
    throw err;
  }

  return offer;
}

async function findLatestOfferBooking({ offerId, workspaceId }) {
  try {
    return await Booking.findOne({
      offerId,
      workspaceId,
    })
      .sort({ startAt: -1 })
      .lean();
  } catch {
    return null;
  }
}

export async function confirmOfferPaymentByWorkspace({
  offerId,
  workspaceId,
  ownerUserId = null,
  confirmedByUserId = null,
}) {
  const offer0 = await findScopedOffer({ offerId, workspaceId, ownerUserId });
  const offer = (await Offer.findById(offer0._id).lean()) || offer0;
  const booking = await findLatestOfferBooking({
    offerId: offer._id,
    workspaceId,
  });

  const paymentStatus = normalizeStatus(offer?.paymentStatus);
  const alreadyConfirmed =
    paymentStatus === "CONFIRMED" || paymentStatus === "PAID" || !!offer?.paidAt;

  if (alreadyConfirmed) {
    const notify =
      offer?.notifyWhatsAppOnPaid === true
        ? await safeNotifyPaymentConfirmed(offer._id)
        : { ok: false, status: "SKIPPED", reason: "OFFER_FLAG_DISABLED" };
    const email = await safeNotifySellerPixPaid({
      offer,
      booking,
      now: new Date(),
      includeInternalWhatsApp: false,
    });
    const emailConfirmed = await safeNotifySellerConfirmedOnPlatform({
      offer,
      booking,
    });

    return {
      offer,
      booking,
      notify,
      email,
      emailConfirmed,
      idempotent: true,
    };
  }

  const hasProof = !!offer?.paymentProof?.storage?.key;
  if (!hasProof) {
    const err = new Error("Nenhum comprovante enviado para esta proposta.");
    err.status = 409;
    err.code = "NO_PROOF";
    throw err;
  }

  const now = new Date();
  const paidAmountCents = computeChargeCentsForManual(offer);

  await Offer.updateOne(
    { _id: offer._id },
    {
      $set: {
        paymentMethod: "MANUAL_PIX",
        paymentStatus: "CONFIRMED",
        status: "CONFIRMED",
        paidAt: now,
        paidAmountCents: paidAmountCents || null,
        confirmedAt: now,
        confirmedByUserId: confirmedByUserId || null,
        rejectedAt: null,
        rejectedByUserId: null,
        rejectionNote: null,
        publicDoneOnly: true,
        publicLockedAt: now.toISOString(),
      },
    },
    { strict: false },
  );

  if (booking?._id) {
    try {
      await Booking.updateOne(
        { _id: booking._id },
        {
          $set: {
            status: "CONFIRMED",
            "payment.provider": "MANUAL_PIX",
            "payment.status": "CONFIRMED",
            "payment.paidAt": now,
          },
        },
        { strict: false },
      );
    } catch {}
  }

  const updated = await Offer.findById(offer._id).lean();
  const notify =
    updated?.notifyWhatsAppOnPaid === true
      ? await safeNotifyPaymentConfirmed(updated._id)
      : { ok: false, status: "SKIPPED", reason: "OFFER_FLAG_DISABLED" };
  const email = await safeNotifySellerPixPaid({
    offer: updated,
    booking,
    now,
    includeInternalWhatsApp: false,
  });
  const emailConfirmed = await safeNotifySellerConfirmedOnPlatform({
    offer: updated,
    booking,
  });

  return {
    offer: updated,
    booking,
    notify,
    email,
    emailConfirmed,
    idempotent: false,
  };
}

export async function rejectOfferPaymentByWorkspace({
  offerId,
  workspaceId,
  ownerUserId = null,
  rejectedByUserId = null,
  reason = "",
  publicUrl = "",
}) {
  const offer = await findScopedOffer({ offerId, workspaceId, ownerUserId });
  const paymentStatus = normalizeStatus(offer?.paymentStatus);
  const hasProof = !!offer?.paymentProof?.storage?.key;

  if (!hasProof) {
    const err = new Error("Nenhum comprovante enviado para esta proposta.");
    err.status = 409;
    err.code = "NO_PROOF";
    throw err;
  }

  if (paymentStatus === "CONFIRMED" || paymentStatus === "PAID" || offer?.paidAt) {
    const err = new Error("Pagamento ja confirmado e nao pode ser recusado.");
    err.status = 409;
    err.code = "ALREADY_CONFIRMED";
    throw err;
  }

  const now = new Date();
  await Offer.updateOne(
    { _id: offer._id },
    {
      $set: {
        paymentMethod: "MANUAL_PIX",
        paymentStatus: "REJECTED",
        rejectedAt: now,
        rejectedByUserId: rejectedByUserId || null,
        rejectionNote: String(reason || "").trim() || null,
      },
    },
    { strict: false },
  );

  const updated = await Offer.findById(offer._id).lean();
  const notify =
    updated?.notifyWhatsAppOnPaid === true
      ? await safeNotifyPaymentRejected(updated._id, {
          reason: String(reason || "").trim(),
          publicUrl: String(publicUrl || "").trim(),
        })
      : {
          ok: false,
          status: "SKIPPED",
          reason: "OFFER_FLAG_DISABLED",
        };

  return {
    offer: updated,
    notify,
  };
}
