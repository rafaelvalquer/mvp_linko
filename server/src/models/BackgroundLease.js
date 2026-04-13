import mongoose from "mongoose";

const BackgroundLeaseSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    holderId: {
      type: String,
      default: null,
      index: true,
    },
    lockId: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    acquiredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "background_leases",
  },
);

// Expired leases are safe to reacquire immediately; TTL cleanup only removes
// stale rows eventually so the collection stays compact over time.
BackgroundLeaseSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const BackgroundLease =
  mongoose.models.BackgroundLease ||
  mongoose.model("BackgroundLease", BackgroundLeaseSchema);
