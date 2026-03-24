//server/src/models/User.js

import mongoose from "mongoose";
import { normalizeUserWhatsAppPhone } from "../utils/phone.js";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["owner", "member"],
      default: "owner",
    },
    profile: {
      type: String,
      enum: ["owner", "manager", "sales", "operations"],
      default: "owner",
    },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },
    permissions: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    whatsNewLastSeenAt: {
      type: Date,
      default: null,
    },
    whatsappPhone: {
      type: String,
      default: "",
      trim: true,
    },
    whatsappPhoneDigits: {
      type: String,
      default: "",
      index: true,
    },
  },
  { timestamps: true },
);

UserSchema.pre("validate", function preValidate(next) {
  try {
    const normalized = normalizeUserWhatsAppPhone(this.whatsappPhone || "");
    this.whatsappPhone = normalized.whatsappPhone;
    this.whatsappPhoneDigits = normalized.whatsappPhoneDigits;
    next();
  } catch (error) {
    next(error);
  }
});

export const User = mongoose.models.User || mongoose.model("User", UserSchema);
