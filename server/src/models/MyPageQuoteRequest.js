import mongoose from "mongoose";

const QuoteRequestProductSchema = new mongoose.Schema(
  {
    productId: { type: String, default: "", trim: true, maxlength: 80 },
    name: { type: String, default: "", trim: true, maxlength: 160 },
    description: { type: String, default: "", trim: true, maxlength: 500 },
    priceCents: { type: Number, default: null, min: 0 },
    imageUrl: { type: String, default: "", trim: true, maxlength: 2000 },
  },
  { _id: false },
);

const MyPageQuoteRequestSchema = new mongoose.Schema(
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
    pageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MyPage",
      required: true,
      index: true,
    },
    slugSnapshot: { type: String, default: "", trim: true, maxlength: 120 },
    pageTitleSnapshot: { type: String, default: "", trim: true, maxlength: 160 },
    status: {
      type: String,
      enum: ["new", "in_progress", "converted", "archived"],
      default: "new",
      index: true,
    },
    customerName: { type: String, required: true, trim: true, maxlength: 160 },
    customerWhatsApp: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    customerEmail: { type: String, default: "", trim: true, maxlength: 160 },
    requestType: {
      type: String,
      enum: ["product", "service"],
      default: "service",
      index: true,
    },
    message: { type: String, default: "", trim: true, maxlength: 2000 },
    selectedProducts: {
      type: [QuoteRequestProductSchema],
      default: () => [],
    },
    analyticsSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    createdOfferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

MyPageQuoteRequestSchema.index({ pageId: 1, createdAt: -1 });
MyPageQuoteRequestSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });

export const MyPageQuoteRequest =
  mongoose.models.MyPageQuoteRequest ||
  mongoose.model("MyPageQuoteRequest", MyPageQuoteRequestSchema);
