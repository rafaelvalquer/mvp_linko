import mongoose from "mongoose";

const MY_PAGE_BUTTON_TYPES = [
  "whatsapp",
  "external_url",
  "public_schedule",
  "public_offer",
  "catalog",
  "payment_link",
];

const MyPageButtonSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    type: {
      type: String,
      enum: MY_PAGE_BUTTON_TYPES,
      default: "external_url",
    },
    url: { type: String, default: "", trim: true, maxlength: 2000 },
    enabled: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false },
);

const MyPageSocialLinkSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    platform: { type: String, default: "", trim: true, maxlength: 40 },
    label: { type: String, default: "", trim: true, maxlength: 80 },
    url: { type: String, default: "", trim: true, maxlength: 2000 },
    enabled: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false },
);

const MyPageShopSchema = new mongoose.Schema(
  {
    productIds: { type: [String], default: () => [] },
  },
  { _id: false },
);

const MyPageDesignSchema = new mongoose.Schema(
  {
    themePreset: {
      type: String,
      default: "clean_light",
      trim: true,
      maxlength: 40,
    },
    brandLayout: {
      type: String,
      default: "classic",
      trim: true,
      maxlength: 40,
    },
    accentPalette: {
      type: String,
      default: "sky",
      trim: true,
      maxlength: 40,
    },
    backgroundStyle: {
      type: String,
      default: "fill",
      trim: true,
      maxlength: 40,
    },
    backgroundColor: {
      type: String,
      default: "#E2E8F0",
      trim: true,
      maxlength: 7,
    },
    fontPreset: { type: String, default: "inter", trim: true, maxlength: 40 },
    buttonStyle: {
      type: String,
      default: "solid",
      trim: true,
      maxlength: 40,
    },
    buttonRadius: {
      type: String,
      default: "round",
      trim: true,
      maxlength: 40,
    },
    secondaryLinksStyle: {
      type: String,
      default: "text",
      trim: true,
      maxlength: 40,
    },
  },
  { _id: false },
);

const MyPageSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
      unique: true,
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    subtitle: { type: String, default: "", trim: true, maxlength: 160 },
    description: { type: String, default: "", trim: true, maxlength: 400 },
    avatarUrl: { type: String, default: "", trim: true, maxlength: 2000 },
    coverStyle: { type: String, default: "clean_light", trim: true, maxlength: 40 },
    whatsappPhone: { type: String, default: "", trim: true, maxlength: 30 },
    isPublished: { type: Boolean, default: false },
    buttons: { type: [MyPageButtonSchema], default: () => [] },
    socialLinks: { type: [MyPageSocialLinkSchema], default: () => [] },
    shop: { type: MyPageShopSchema, default: () => ({ productIds: [] }) },
    design: {
      type: MyPageDesignSchema,
      default: () => ({
        themePreset: "clean_light",
        brandLayout: "classic",
        accentPalette: "sky",
        backgroundStyle: "fill",
        backgroundColor: "#E2E8F0",
        fontPreset: "inter",
        buttonStyle: "solid",
        buttonRadius: "round",
        secondaryLinksStyle: "text",
      }),
    },
  },
  { timestamps: true },
);

export const MyPage =
  mongoose.models.MyPage || mongoose.model("MyPage", MyPageSchema);

export { MY_PAGE_BUTTON_TYPES };
