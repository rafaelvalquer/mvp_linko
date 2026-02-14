//server/src/models/Workspace.js

import mongoose from "mongoose";

const WorkspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // opcional, mas único quando existir (sparse permite múltiplos null/undefined)
    slug: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ✅ Plano do workspace (tenant)
    plan: {
      type: String,
      enum: ["free", "premium"],
      default: "free",
      index: true,
    },
  },
  { timestamps: true },
);

export const Workspace =
  mongoose.models.Workspace || mongoose.model("Workspace", WorkspaceSchema);
