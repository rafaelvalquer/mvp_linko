import mongoose from "mongoose";

const PendingRegistrationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    workspaceName: { type: String, required: true, trim: true },
    plan: {
      type: String,
      enum: ["start", "pro", "business", "enterprise"],
      default: "start",
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
  },
  { timestamps: true },
);

PendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PendingRegistration =
  mongoose.models.PendingRegistration ||
  mongoose.model("PendingRegistration", PendingRegistrationSchema);
