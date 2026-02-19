import mongoose from "mongoose";

const WebhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    event: { type: String, required: true },
    devMode: { type: Boolean, default: false },
    receivedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
    ok: { type: Boolean, default: false },
    error: { type: String },
    result: { type: mongoose.Schema.Types.Mixed },
    payload: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

export default mongoose.models.WebhookEvent ||
  mongoose.model("WebhookEvent", WebhookEventSchema);
