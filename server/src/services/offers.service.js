import { Offer } from "../models/Offer.js";
import { token } from "../utils/nanoid.js";

export async function createOffer(payload) {
  const publicToken = token(20);
  const expiresAt = payload.expiresAt
    ? new Date(payload.expiresAt)
    : new Date(Date.now() + 7 * 864e5);

  const offer = await Offer.create({
    publicToken,
    customerName: payload.customerName,
    customerWhatsApp: payload.customerWhatsApp || "",
    title: payload.title,
    description: payload.description || "",
    amountCents: payload.amountCents,
    depositPct: payload.depositPct ?? 30,
    durationMin: payload.durationMin ?? 60,
    policyText: payload.policyText || "Cancelamentos com 24h de antecedência.",
    expiresAt,
    availability: payload.availability || undefined,
    status: "PUBLIC",
  });

  return offer;
}
