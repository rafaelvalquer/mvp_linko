//server/src/models/User.js

import mongoose from "mongoose";

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
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },
    whatsNewLastSeenAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export const User = mongoose.models.User || mongoose.model("User", UserSchema);
