import Booking from "../../models/Booking.js";
import { Offer } from "../../models/Offer.js";
import { notifyOfferCancelled } from "../whatsappNotify.js";
import { buildOfferPublicUrl } from "../publicUrl.service.js";

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace("CANCELED", "CANCELLED");
}

async function safeNotifyOfferCancelled(offerId, options = {}) {
  try {
    return await notifyOfferCancelled(offerId, options);
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

async function cancelActiveBookingsForOffer({ offer, actionAt, reason }) {
  if (!offer?._id || !offer?.workspaceId) return 0;

  const result = await Booking.updateMany(
    {
      offerId: offer._id,
      workspaceId: offer.workspaceId,
      status: { $in: ["HOLD", "CONFIRMED"] },
    },
    {
      $set: {
        status: "CANCELLED",
        cancelledAt: actionAt,
        cancelledBy: "workspace",
        cancelReason: reason || "Proposta cancelada no backoffice.",
      },
      $push: {
        changeHistory: {
          action: "cancel",
          actor: "workspace",
          changedAt: actionAt,
          reason: reason || "Proposta cancelada no backoffice.",
        },
      },
    },
    { strict: false },
  ).catch(() => ({ modifiedCount: 0 }));

  return Number(result?.modifiedCount || 0);
}

export async function cancelOfferByWorkspace({
  offerId,
  workspaceId,
  ownerUserId = null,
  cancelledByUserId = null,
  reason = "",
  publicUrl = "",
}) {
  const query = { _id: offerId, workspaceId };
  if (ownerUserId) query.ownerUserId = ownerUserId;

  const offer = await Offer.findOne(query).lean();
  if (!offer) {
    const err = new Error("Offer not found");
    err.status = 404;
    err.code = "OFFER_NOT_FOUND";
    throw err;
  }

  const status = normalizeStatus(offer?.status);
  const paymentStatus = normalizeStatus(offer?.paymentStatus);
  const alreadyPaid =
    ["PAID", "CONFIRMED"].includes(status) ||
    ["PAID", "CONFIRMED"].includes(paymentStatus) ||
    !!offer?.paidAt;

  if (alreadyPaid) {
    const err = new Error(
      "Propostas com pagamento confirmado nao podem ser canceladas.",
    );
    err.status = 409;
    err.code = "ALREADY_PAID";
    throw err;
  }

  if (status === "CANCELLED") {
    return {
      offer,
      cancelledBookingsCount: 0,
      notify: {
        ok: false,
        status: "SKIPPED",
        reason: "IDEMPOTENT",
      },
    };
  }

  const actionAt = new Date();
  await Offer.updateOne(
    { _id: offer._id },
    {
      $set: {
        status: "CANCELLED",
        cancelledAt: actionAt,
        cancelledByUserId: cancelledByUserId || null,
        cancelReason: String(reason || "").trim() || null,
        publicLockedAt: actionAt.toISOString(),
      },
    },
    { strict: false },
  );

  const cancelledBookingsCount = await cancelActiveBookingsForOffer({
    offer,
    actionAt,
    reason: String(reason || "").trim(),
  });

  const updated = await Offer.findById(offer._id).lean();
  const resolvedPublicUrl =
    String(publicUrl || "").trim() || buildOfferPublicUrl(updated);
  const notify = await safeNotifyOfferCancelled(updated._id, {
    reason: String(reason || "").trim(),
    publicUrl: resolvedPublicUrl,
  });

  return {
    offer: updated,
    cancelledBookingsCount,
    notify,
  };
}
