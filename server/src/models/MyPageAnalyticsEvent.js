import mongoose from "mongoose";

const MY_PAGE_ANALYTICS_EVENT_TYPES = [
  "page_view",
  "geo_context_update",
  "block_view",
  "cta_click",
  "secondary_link_click",
  "catalog_item_open",
  "quote_form_view",
  "quote_submit",
  "schedule_view",
  "slot_select",
  "booking_submit",
  "pay_view",
  "sale_attributed",
];

const MY_PAGE_ANALYTICS_PAGE_KINDS = [
  "home",
  "catalog",
  "quote",
  "schedule",
  "pay",
];

const MY_PAGE_ANALYTICS_BLOCK_KEYS = [
  "hero",
  "primary_buttons",
  "secondary_links",
  "catalog_items",
  "quote_form",
  "schedule_slots",
  "pay_panel",
];

const MyPageAnalyticsEventSchema = new mongoose.Schema(
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
    pageSlug: { type: String, default: "", trim: true, maxlength: 160 },
    pageTitle: { type: String, default: "", trim: true, maxlength: 160 },
    pageKind: {
      type: String,
      enum: MY_PAGE_ANALYTICS_PAGE_KINDS,
      default: "home",
      index: true,
    },
    visitorId: { type: String, default: "", trim: true, maxlength: 120 },
    sessionId: { type: String, default: "", trim: true, maxlength: 120 },
    eventType: {
      type: String,
      enum: MY_PAGE_ANALYTICS_EVENT_TYPES,
      required: true,
      index: true,
    },
    eventAt: { type: Date, default: Date.now, index: true },
    referrer: { type: String, default: "", trim: true, maxlength: 2000 },
    sourceBucket: {
      type: String,
      default: "Outros sites",
      trim: true,
      maxlength: 40,
      index: true,
    },
    utmSource: { type: String, default: "", trim: true, maxlength: 120 },
    utmMedium: { type: String, default: "", trim: true, maxlength: 120 },
    utmCampaign: { type: String, default: "", trim: true, maxlength: 160 },
    utmContent: { type: String, default: "", trim: true, maxlength: 160 },
    utmTerm: { type: String, default: "", trim: true, maxlength: 160 },
    language: { type: String, default: "", trim: true, maxlength: 80 },
    deviceType: {
      type: String,
      default: "other",
      trim: true,
      maxlength: 20,
      index: true,
    },
    userAgent: { type: String, default: "", trim: true, maxlength: 1000 },
    countryCode: {
      type: String,
      default: "unknown",
      trim: true,
      maxlength: 16,
      index: true,
    },
    countryName: { type: String, default: "Desconhecido", trim: true, maxlength: 120 },
    region: { type: String, default: "", trim: true, maxlength: 120 },
    city: { type: String, default: "", trim: true, maxlength: 120 },
    geoSource: {
      type: String,
      default: "unknown",
      trim: true,
      maxlength: 20,
      index: true,
    },
    browserGeoStatus: {
      type: String,
      default: "",
      trim: true,
      maxlength: 20,
    },
    blockKey: {
      type: String,
      default: "",
      trim: true,
      maxlength: 60,
      enum: ["", ...MY_PAGE_ANALYTICS_BLOCK_KEYS],
      index: true,
    },
    buttonKey: { type: String, default: "", trim: true, maxlength: 120 },
    buttonLabel: { type: String, default: "", trim: true, maxlength: 160 },
    buttonType: { type: String, default: "", trim: true, maxlength: 80 },
    contentKind: { type: String, default: "", trim: true, maxlength: 80 },
    contentId: { type: String, default: "", trim: true, maxlength: 120 },
    contentLabel: { type: String, default: "", trim: true, maxlength: 200 },
    quoteRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MyPageQuoteRequest",
      default: null,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
      index: true,
    },
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      default: null,
      index: true,
    },
    revenueCents: { type: Number, default: null, min: 0 },
  },
  { timestamps: true },
);

MyPageAnalyticsEventSchema.index({ workspaceId: 1, eventAt: -1 });
MyPageAnalyticsEventSchema.index({ pageId: 1, eventType: 1, eventAt: -1 });
MyPageAnalyticsEventSchema.index({ pageId: 1, sessionId: 1, eventAt: -1 });
MyPageAnalyticsEventSchema.index({ pageId: 1, sourceBucket: 1, eventAt: -1 });
MyPageAnalyticsEventSchema.index({ pageId: 1, countryCode: 1, eventAt: -1 });
MyPageAnalyticsEventSchema.index({ offerId: 1, eventType: 1, eventAt: -1 });

export const MyPageAnalyticsEvent =
  mongoose.models.MyPageAnalyticsEvent ||
  mongoose.model("MyPageAnalyticsEvent", MyPageAnalyticsEventSchema);

export {
  MY_PAGE_ANALYTICS_BLOCK_KEYS,
  MY_PAGE_ANALYTICS_EVENT_TYPES,
  MY_PAGE_ANALYTICS_PAGE_KINDS,
};
