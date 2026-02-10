import mongoose from "mongoose";

const OfferSchema = new mongoose.Schema(
  {
    publicToken: { type: String, unique: true, index: true, required: true },

    // Cliente
    customerName: { type: String, required: true },
    customerWhatsApp: { type: String, default: "" },

    // Proposta
    title: { type: String, required: true },
    description: { type: String, default: "" },
    currency: { type: String, default: "BRL" },
    amountCents: { type: Number, required: true }, // valor total

    // Sinal (MVP)
    depositPct: { type: Number, default: 30 }, // ex.: 30%
    durationMin: { type: Number, default: 60 },

    // Regras
    policyText: {
      type: String,
      default: "Cancelamentos com 24h de antecedência.",
    },
    expiresAt: { type: Date, required: true },

    // Disponibilidade (MVP simples)
    availability: {
      timezone: { type: String, default: "America/Sao_Paulo" },
      days: { type: [Number], default: [1, 2, 3, 4, 5] }, // 0=Dom..6=Sáb
      startHour: { type: String, default: "09:00" },
      endHour: { type: String, default: "18:00" },
    },

    status: {
      type: String,
      enum: ["DRAFT", "PUBLIC", "EXPIRED"],
      default: "PUBLIC",
      index: true,
    },
  },
  { timestamps: true },
);

export const Offer = mongoose.model("Offer", OfferSchema);
