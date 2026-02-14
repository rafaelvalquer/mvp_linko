// server/src/models/Client.js
import mongoose from "mongoose";

function onlyDigits(v) {
  return String(v || "").replace(/\D+/g, "");
}

const ClientSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ID gerado (imutável)
    clientId: { type: String, required: true, trim: true },

    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },

    cpfCnpj: { type: String, required: true, trim: true },
    cpfCnpjDigits: { type: String, index: true },

    phone: { type: String, required: true, trim: true },
    phoneDigits: { type: String, index: true },
  },
  { timestamps: true },
);

ClientSchema.index({ workspaceId: 1, clientId: 1 }, { unique: true });

ClientSchema.pre("validate", function (next) {
  this.cpfCnpjDigits = onlyDigits(this.cpfCnpj);
  this.phoneDigits = onlyDigits(this.phone);
  next();
});

export const Client =
  mongoose.models.Client || mongoose.model("Client", ClientSchema);
