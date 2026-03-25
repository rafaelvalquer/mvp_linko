import mongoose from "mongoose";

const WebAgentMessageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WhatsAppCommandSession",
      required: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
      default: "assistant",
    },
    inputType: {
      type: String,
      enum: ["text"],
      default: "text",
    },
    text: {
      type: String,
      required: true,
      default: "",
    },
    sourceMessageId: {
      type: String,
      default: "",
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "web_agent_messages",
  },
);

WebAgentMessageSchema.index({ sessionId: 1, createdAt: 1 });
WebAgentMessageSchema.index({ userId: 1, createdAt: -1 });
WebAgentMessageSchema.index({ workspaceId: 1, createdAt: -1 });

export const WebAgentMessage =
  mongoose.models.WebAgentMessage ||
  mongoose.model("WebAgentMessage", WebAgentMessageSchema);
