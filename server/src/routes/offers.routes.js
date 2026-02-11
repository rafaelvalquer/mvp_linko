import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Offer } from "../models/Offer.js";
import { createOffer } from "../services/offers.service.js";

const r = Router();

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeOfferType(input, hasItems) {
  const t = isNonEmptyString(input) ? input.trim().toLowerCase() : "";
  if (t === "product") return "product";
  if (t === "service") return "service";
  return hasItems ? "product" : "service";
}

/**
 * Regras:
 * - Não confiar em string -> só aceita number de verdade
 * - Campos faltando podem ficar undefined (UI exibirá "—")
 */
function sanitizeItems(input) {
  if (!Array.isArray(input)) return [];

  return input.map((it) => {
    const description = isNonEmptyString(it?.description)
      ? it.description.trim()
      : "";

    const qty =
      typeof it?.qty === "number" && Number.isFinite(it.qty)
        ? it.qty
        : undefined;

    const unitPriceCents =
      typeof it?.unitPriceCents === "number" &&
      Number.isFinite(it.unitPriceCents)
        ? it.unitPriceCents
        : undefined;

    const lineTotalCents =
      typeof it?.lineTotalCents === "number" &&
      Number.isFinite(it.lineTotalCents)
        ? it.lineTotalCents
        : undefined;

    return { description, qty, unitPriceCents, lineTotalCents };
  });
}

r.get(
  "/offers",
  asyncHandler(async (_req, res) => {
    const items = await Offer.find().sort({ createdAt: -1 }).limit(200);
    res.json({ ok: true, items });
  }),
);

r.post(
  "/offers",
  asyncHandler(async (req, res) => {
    const { customerName, title, amountCents } = req.body || {};
    if (!customerName || !title || !Number.isFinite(amountCents)) {
      return res.status(400).json({
        ok: false,
        error: "customerName, title, amountCents required",
      });
    }

    // ✅ NOVO: normaliza/sanitiza para persistir "product"
    const rawItems = sanitizeItems(req.body?.items);
    const hasItems = rawItems.length > 0;
    const offerType = normalizeOfferType(req.body?.offerType, hasItems);

    // Se for service, não salva itens (evita lixo)
    const itemsToSave = offerType === "product" ? rawItems : [];

    // Mantém compatibilidade: passa para o createOffer sem quebrar nada
    const offer = await createOffer({
      ...(req.body || {}),
      offerType,
      items: itemsToSave,
    });

    // ✅ Garantia extra: mesmo que createOffer faça whitelist, persiste aqui
    // (safe/minimal, não altera demais campos)
    try {
      await Offer.updateOne(
        { _id: offer._id },
        { $set: { offerType, items: itemsToSave } },
        { strict: false },
      );
    } catch {
      // não bloqueia a criação
    }

    res.json({ ok: true, offer, publicUrl: `/p/${offer.publicToken}` });
  }),
);

export default r;
