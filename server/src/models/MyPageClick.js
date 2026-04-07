import mongoose from "mongoose";

const MyPageClickSchema = new mongoose.Schema(
  {
    pageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MyPage",
      required: true,
      index: true,
    },
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
    slugSnapshot: { type: String, default: "", trim: true, maxlength: 160 },
    buttonId: { type: String, default: "", trim: true, maxlength: 120 },
    buttonLabel: { type: String, default: "", trim: true, maxlength: 160 },
    buttonType: { type: String, default: "", trim: true, maxlength: 40 },
    targetUrl: { type: String, default: "", trim: true, maxlength: 2000 },
    referrer: { type: String, default: "", trim: true, maxlength: 1000 },
    userAgent: { type: String, default: "", trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

MyPageClickSchema.index({ pageId: 1, createdAt: -1 });
MyPageClickSchema.index({ workspaceId: 1, createdAt: -1 });

export const MyPageClick =
  mongoose.models.MyPageClick ||
  mongoose.model("MyPageClick", MyPageClickSchema);
