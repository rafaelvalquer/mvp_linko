import mongoose from "mongoose";

const PasswordResetCodeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    lastSentAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

PasswordResetCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetCode =
  mongoose.models.PasswordResetCode ||
  mongoose.model("PasswordResetCode", PasswordResetCodeSchema);
