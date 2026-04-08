import { randomUUID } from "crypto";
import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import { Router } from "express";
import multer from "multer";
import { MyPage, MY_PAGE_BUTTON_TYPES } from "../models/MyPage.js";
import { MyPageClick } from "../models/MyPageClick.js";
import { MyPageQuoteRequest } from "../models/MyPageQuoteRequest.js";
import { Workspace } from "../models/Workspace.js";
import { Product } from "../models/Product.js";
import { Offer } from "../models/Offer.js";
import Booking from "../models/Booking.js";
import { AppSettings } from "../models/AppSettings.js";
import { ensureAuth, tenantFromUser } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  assertWorkspaceModuleAccess,
  assertWorkspaceOwner,
} from "../utils/workspaceAccess.js";
import {
  DEFAULT_AGENDA,
  DEFAULT_SELF_SERVICE_MINIMUM_NOTICE_MINUTES,
  buildSlotsForDate,
  dayRangeInTZ,
  mergeAgenda,
  resolveAgendaForDate,
} from "../services/agendaSettings.js";

const router = Router();

const DEFAULT_COVER_STYLE = "clean_light";
const DEFAULT_SHOP = { productIds: [] };
const DEFAULT_DESIGN = {
  themePreset: "clean_light",
  brandLayout: "classic",
  accentPalette: "sky",
  backgroundStyle: "halo",
  fontPreset: "inter",
  buttonStyle: "solid",
  buttonRadius: "rounded",
  secondaryLinksStyle: "text",
};
const BUTTON_TYPE_LABELS = {
  whatsapp: "Fale no WhatsApp",
  external_url: "Abrir link",
  public_schedule: "Agendar atendimento",
  public_offer: "Pedir orcamento",
  catalog: "Ver catalogo",
  payment_link: "Pagar proposta",
};
const QUOTE_REQUEST_STATUSES = ["new", "in_progress", "converted", "archived"];
const MY_PAGE_THEME_PRESETS = [
  "premium_dark",
  "clean_light",
  "creator_gradient",
  "business_storefront",
  "editorial_luxury",
  "bold_conversion",
  "agate",
  "air",
  "aura",
  "blocks",
  "twilight",
  "vox",
  "cobalt_blaze",
  "violet_punch",
  "solar_pop",
  "midnight_prism",
];
const MY_PAGE_BRAND_LAYOUTS = ["classic", "hero"];
const MY_PAGE_ACCENT_PALETTES = [
  "sky",
  "emerald",
  "rose",
  "violet",
  "amber",
  "teal",
  "coral",
  "slate",
];
const MY_PAGE_BACKGROUND_STYLES = [
  "halo",
  "mesh",
  "spotlight",
  "velvet",
  "grid",
  "bloom",
];
const MY_PAGE_FONT_PRESETS = ["inter", "manrope", "jakarta", "editorial"];
const MY_PAGE_BUTTON_STYLES = ["solid", "soft", "outline"];
const MY_PAGE_BUTTON_RADII = ["square", "rounded", "pill"];
const MY_PAGE_SECONDARY_LINK_STYLES = ["text", "icon", "icon_text"];
const MY_PAGE_AVATAR_MODES = ["keep", "upload", "url", "remove"];
const LEGACY_THEME_PRESET_MAP = {
  ocean: "clean_light",
  sunset: "creator_gradient",
  graphite: "premium_dark",
};
const MY_PAGE_THEME_PRESET_DEFAULTS = {
  premium_dark: {
    accentPalette: "teal",
    backgroundStyle: "velvet",
    fontPreset: "manrope",
    buttonStyle: "solid",
  },
  clean_light: {
    accentPalette: "slate",
    backgroundStyle: "halo",
    fontPreset: "inter",
    buttonStyle: "solid",
  },
  creator_gradient: {
    accentPalette: "violet",
    backgroundStyle: "mesh",
    fontPreset: "jakarta",
    buttonStyle: "solid",
  },
  business_storefront: {
    accentPalette: "emerald",
    backgroundStyle: "grid",
    fontPreset: "manrope",
    buttonStyle: "solid",
  },
  editorial_luxury: {
    accentPalette: "amber",
    backgroundStyle: "spotlight",
    fontPreset: "editorial",
    buttonStyle: "outline",
  },
  bold_conversion: {
    accentPalette: "coral",
    backgroundStyle: "spotlight",
    fontPreset: "manrope",
    buttonStyle: "solid",
  },
  agate: {
    accentPalette: "teal",
    backgroundStyle: "mesh",
    fontPreset: "jakarta",
    buttonStyle: "soft",
  },
  air: {
    accentPalette: "sky",
    backgroundStyle: "halo",
    fontPreset: "inter",
    buttonStyle: "outline",
  },
  aura: {
    accentPalette: "violet",
    backgroundStyle: "bloom",
    fontPreset: "jakarta",
    buttonStyle: "soft",
  },
  blocks: {
    accentPalette: "coral",
    backgroundStyle: "grid",
    fontPreset: "manrope",
    buttonStyle: "solid",
  },
  twilight: {
    accentPalette: "violet",
    backgroundStyle: "velvet",
    fontPreset: "editorial",
    buttonStyle: "outline",
  },
  vox: {
    accentPalette: "rose",
    backgroundStyle: "spotlight",
    fontPreset: "manrope",
    buttonStyle: "solid",
  },
  cobalt_blaze: {
    accentPalette: "sky",
    backgroundStyle: "bloom",
    fontPreset: "jakarta",
    buttonStyle: "solid",
  },
  violet_punch: {
    accentPalette: "violet",
    backgroundStyle: "mesh",
    fontPreset: "jakarta",
    buttonStyle: "solid",
  },
  solar_pop: {
    accentPalette: "coral",
    backgroundStyle: "bloom",
    fontPreset: "manrope",
    buttonStyle: "solid",
  },
  midnight_prism: {
    accentPalette: "violet",
    backgroundStyle: "velvet",
    fontPreset: "manrope",
    buttonStyle: "soft",
  },
};

const myPageUploadDir = path.resolve(process.cwd(), "uploads", "my-page");
fs.mkdirSync(myPageUploadDir, { recursive: true });

const myPageAvatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, myPageUploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      cb(null, `${randomUUID().replace(/-/g, "")}${ext}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype || "");
    cb(ok ? null : new Error("Formato de imagem invalido."), ok);
  },
});

function toSlug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function sanitizeText(value, max = 120) {
  return String(value || "").trim().slice(0, max);
}

function sanitizeLongText(value, max = 1500) {
  return String(value || "").trim().slice(0, max);
}

function sanitizeUrl(value) {
  return String(value || "").trim().slice(0, 2000);
}

function parseMaybeJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return fallback;

  try {
    return JSON.parse(trimmed);
  } catch {
    return fallback;
  }
}

function sanitizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").slice(0, 30);
}

function sanitizeObjectIdList(items = [], limit = 200) {
  const raw = Array.isArray(items) ? items : items != null ? [items] : [];
  return Array.from(
    new Set(
      raw
        .map((item) => String(item || "").trim())
        .filter((item) => mongoose.Types.ObjectId.isValid(item)),
    ),
  ).slice(0, limit);
}

function sanitizePublicCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 24);
}

function onlyDigits(value) {
  return String(value || "").replace(/\D+/g, "");
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function sortByOrder(items = []) {
  return [...items].sort((a, b) => {
    const orderDiff = Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0);
    if (orderDiff !== 0) return orderDiff;
    return String(a?.label || "").localeCompare(String(b?.label || ""));
  });
}

function buildDefaultButtons(whatsappPhone = "") {
  const phone = sanitizePhone(whatsappPhone);
  return [
    {
      id: randomUUID(),
      label: "Fale no WhatsApp",
      type: "whatsapp",
      url: "",
      enabled: !!phone,
      sortOrder: 0,
    },
    {
      id: randomUUID(),
      label: "Pedir orcamento",
      type: "public_offer",
      url: "",
      enabled: false,
      sortOrder: 1,
    },
    {
      id: randomUUID(),
      label: "Agendar atendimento",
      type: "public_schedule",
      url: "",
      enabled: false,
      sortOrder: 2,
    },
    {
      id: randomUUID(),
      label: "Pagar proposta",
      type: "payment_link",
      url: "",
      enabled: false,
      sortOrder: 3,
    },
    {
      id: randomUUID(),
      label: "Ver catalogo",
      type: "catalog",
      url: "",
      enabled: false,
      sortOrder: 4,
    },
  ];
}

function buildDefaultShop() {
  return { ...DEFAULT_SHOP, productIds: [] };
}

function buildDefaultDesign(coverStyle = DEFAULT_COVER_STYLE) {
  const themePreset = sanitizeThemePreset(coverStyle, DEFAULT_DESIGN.themePreset);
  const presetDefaults =
    MY_PAGE_THEME_PRESET_DEFAULTS[themePreset] ||
    MY_PAGE_THEME_PRESET_DEFAULTS[DEFAULT_DESIGN.themePreset] ||
    {};
  return {
    ...DEFAULT_DESIGN,
    ...presetDefaults,
    themePreset,
    brandLayout: DEFAULT_DESIGN.brandLayout,
  };
}

async function uniqueSlug(base, excludeId = null) {
  const fallback = toSlug(base) || `pagina-${Date.now()}`;
  let candidate = fallback;
  let cursor = 2;

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await MyPage.findOne({ slug: candidate })
      .select("_id")
      .lean();
    if (!existing || String(existing._id) === String(excludeId || "")) {
      return candidate;
    }
    candidate = `${fallback}-${cursor}`;
    cursor += 1;
  }
}

function sanitizeButtons(buttons = [], fallbackWhatsAppPhone = "") {
  const items = Array.isArray(buttons) ? buttons : [];
  if (!items.length) return buildDefaultButtons(fallbackWhatsAppPhone);

  return sortByOrder(
    items.map((item, index) => {
      const type = MY_PAGE_BUTTON_TYPES.includes(String(item?.type || ""))
        ? String(item.type)
        : "external_url";

      return {
        id: sanitizeText(item?.id, 120) || randomUUID(),
        label: sanitizeText(
          item?.label || BUTTON_TYPE_LABELS[type] || "Abrir link",
          80,
        ),
        type,
        url: type === "whatsapp" ? "" : sanitizeUrl(item?.url),
        enabled: item?.enabled === true,
        sortOrder: Number.isFinite(Number(item?.sortOrder))
          ? Number(item.sortOrder)
          : index,
      };
    }),
  );
}

function sanitizeSocialLinks(items = []) {
  if (!Array.isArray(items)) return [];
  return sortByOrder(
    items
      .map((item, index) => ({
        id: sanitizeText(item?.id, 120) || randomUUID(),
        platform: sanitizeText(item?.platform, 40),
        label: sanitizeText(item?.label, 80),
        url: sanitizeUrl(item?.url),
        enabled: item?.enabled === true,
        sortOrder: Number.isFinite(Number(item?.sortOrder))
          ? Number(item.sortOrder)
          : index,
      }))
      .filter((item) => item.platform || item.label || item.url),
  );
}

function sanitizeShop(shop = {}) {
  return {
    productIds: sanitizeObjectIdList(shop?.productIds, 300),
  };
}

function sanitizeEnum(value, allowed, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function sanitizeThemePreset(value, fallback = DEFAULT_DESIGN.themePreset) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  const mapped = LEGACY_THEME_PRESET_MAP[normalized] || normalized;
  return MY_PAGE_THEME_PRESETS.includes(mapped) ? mapped : fallback;
}

function maybeUploadMyPageAvatar(req, res, next) {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (!contentType.includes("multipart/form-data")) {
    return next();
  }
  return myPageAvatarUpload.single("avatarFile")(req, res, next);
}

function sanitizeDesign(design = {}, coverStyle = DEFAULT_COVER_STYLE) {
  const themePreset = sanitizeThemePreset(
    design?.themePreset || coverStyle,
    DEFAULT_DESIGN.themePreset,
  );
  const fallback = buildDefaultDesign(themePreset);
  return {
    themePreset,
    brandLayout: sanitizeEnum(
      design?.brandLayout,
      MY_PAGE_BRAND_LAYOUTS,
      fallback.brandLayout,
    ),
    accentPalette: sanitizeEnum(
      design?.accentPalette,
      MY_PAGE_ACCENT_PALETTES,
      fallback.accentPalette,
    ),
    backgroundStyle: sanitizeEnum(
      design?.backgroundStyle,
      MY_PAGE_BACKGROUND_STYLES,
      fallback.backgroundStyle,
    ),
    fontPreset: sanitizeEnum(
      design?.fontPreset,
      MY_PAGE_FONT_PRESETS,
      fallback.fontPreset,
    ),
    buttonStyle: sanitizeEnum(
      design?.buttonStyle,
      MY_PAGE_BUTTON_STYLES,
      fallback.buttonStyle,
    ),
    buttonRadius: sanitizeEnum(
      design?.buttonRadius,
      MY_PAGE_BUTTON_RADII,
      fallback.buttonRadius,
    ),
    secondaryLinksStyle: sanitizeEnum(
      design?.secondaryLinksStyle,
      MY_PAGE_SECONDARY_LINK_STYLES,
      fallback.secondaryLinksStyle,
    ),
  };
}

function buildWhatsAppUrl(phone, title = "") {
  const digits = onlyDigits(phone);
  if (!digits) return "";
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  const message = encodeURIComponent(
    `Ola! Vim pela sua pagina ${title ? `da ${title}` : "na LuminorPay"} e quero falar com voce.`,
  );
  return `https://wa.me/${withCountry}?text=${message}`;
}

function buildNativeTarget(page, type) {
  const slug = String(page?.slug || "").trim();
  if (!slug) return "";
  if (type === "catalog") return `/u/${slug}/catalog`;
  if (type === "public_offer") return `/u/${slug}/quote`;
  if (type === "public_schedule") return `/u/${slug}/schedule`;
  if (type === "payment_link") return `/u/${slug}/pay`;
  return "";
}

function resolveButtonTarget(page, button) {
  if (!button?.enabled) return "";
  if (button.type === "whatsapp") {
    return buildWhatsAppUrl(page?.whatsappPhone, page?.title);
  }
  if (
    button.type === "catalog" ||
    button.type === "public_offer" ||
    button.type === "public_schedule" ||
    button.type === "payment_link"
  ) {
    return buildNativeTarget(page, button.type);
  }
  return sanitizeUrl(button?.url);
}

function resolvePageShopProductIds(page) {
  return sanitizeObjectIdList(page?.shop?.productIds, 300);
}

function serializePage(pageDoc) {
  const page = pageDoc?.toObject ? pageDoc.toObject() : { ...(pageDoc || {}) };
  const buttons = sortByOrder(page.buttons || []).map((button) => ({
    ...button,
    targetUrl: resolveButtonTarget(page, button),
  }));
  const socialLinks = sortByOrder(page.socialLinks || []);
  const shop = {
    productIds: resolvePageShopProductIds(page),
  };
  const design = sanitizeDesign(page.design || {}, page.coverStyle);

  return {
    _id: page._id ? String(page._id) : null,
    slug: page.slug || "",
    title: page.title || "",
    subtitle: page.subtitle || "",
    description: page.description || "",
    avatarUrl: page.avatarUrl || "",
    coverStyle: page.coverStyle || DEFAULT_COVER_STYLE,
    whatsappPhone: page.whatsappPhone || "",
    isPublished: page.isPublished === true,
    buttons,
    socialLinks,
    shop,
    design,
    summary: {
      activeButtonsCount: buttons.filter((button) => button.enabled === true)
        .length,
      secondaryLinksCount: socialLinks.filter((item) => item.enabled === true)
        .length,
      selectedProductsCount: shop.productIds.length,
    },
    createdAt: page.createdAt || null,
    updatedAt: page.updatedAt || null,
  };
}

function serializePublicPage(pageDoc) {
  const serialized = serializePage(pageDoc);
  return {
    ...serialized,
    buttons: serialized.buttons.filter((button) => button.targetUrl),
    socialLinks: serialized.socialLinks.filter(
      (item) => item.enabled === true && item.url,
    ),
  };
}

function serializeProduct(productDoc) {
  const product = productDoc?.toObject
    ? productDoc.toObject()
    : { ...(productDoc || {}) };

  return {
    _id: product._id ? String(product._id) : null,
    productId: product.productId || "",
    name: product.name || "",
    description: product.description || "",
    priceCents: Number(product.priceCents || 0),
    imageUrl: product.imageUrl || "",
    createdAt: product.createdAt || null,
  };
}

function serializeQuoteRequest(doc) {
  const item = doc?.toObject ? doc.toObject() : { ...(doc || {}) };
  return {
    _id: item._id ? String(item._id) : null,
    status: item.status || "new",
    requestType: item.requestType || "service",
    customerName: item.customerName || "",
    customerWhatsApp: item.customerWhatsApp || "",
    customerEmail: item.customerEmail || "",
    message: item.message || "",
    selectedProducts: Array.isArray(item.selectedProducts)
      ? item.selectedProducts.map((product) => ({
          _id: product?._id ? String(product._id) : null,
          productId: product?.productId || "",
          name: product?.name || "",
          description: product?.description || "",
          priceCents: Number(product?.priceCents || 0),
          imageUrl: product?.imageUrl || "",
        }))
      : [],
    createdOfferId: item.createdOfferId
      ? String(item.createdOfferId)
      : item.createdOffer?._id
        ? String(item.createdOffer._id)
        : null,
    createdOffer: item.createdOffer
      ? {
          _id: item.createdOffer._id ? String(item.createdOffer._id) : null,
          publicToken: item.createdOffer.publicToken || "",
          publicCode: item.createdOffer.publicCode || "",
          title: item.createdOffer.title || "",
          status: item.createdOffer.status || "",
          totalCents: Number(item.createdOffer.totalCents || 0),
          customerName: item.createdOffer.customerName || "",
        }
      : null,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

async function buildInitialPage({ workspace, ownerUserId, whatsappPhone }) {
  const baseSlug = workspace?.slug || workspace?.name || "minha-pagina";
  const slug = await uniqueSlug(baseSlug);

  return MyPage.create({
    workspaceId: workspace?._id,
    ownerUserId,
    slug,
    title: sanitizeText(workspace?.name || "Minha Pagina", 120),
    subtitle: "Seus principais links comerciais em um so lugar.",
    description:
      "Centralize atendimento, orcamento, agenda e pagamento em uma unica pagina publica da LuminorPay.",
    avatarUrl: "",
    coverStyle: DEFAULT_COVER_STYLE,
    whatsappPhone: sanitizePhone(whatsappPhone),
    isPublished: false,
    buttons: buildDefaultButtons(whatsappPhone),
    socialLinks: [],
    shop: buildDefaultShop(),
    design: buildDefaultDesign(DEFAULT_COVER_STYLE),
  });
}

async function loadWorkspacePage(req) {
  return loadWorkspacePageWithOptions(req);
}

async function loadWorkspacePageWithOptions(req, options = {}) {
  const { createIfMissing = true } = options;
  const workspace = await Workspace.findById(req.tenantId)
    .select("_id name slug ownerUserId")
    .lean();
  if (!workspace) {
    const err = new Error("Workspace nao encontrado.");
    err.status = 404;
    throw err;
  }

  let page = await MyPage.findOne({ workspaceId: req.tenantId });
  if (!page && createIfMissing) {
    page = await buildInitialPage({
      workspace,
      ownerUserId: workspace?.ownerUserId || req.user?._id,
      whatsappPhone: req.user?.whatsappPhone || "",
    });
  }

  return { workspace, page };
}

async function loadPublishedPageBySlug(slugValue) {
  const slug = toSlug(slugValue);
  if (!slug) {
    const err = new Error("Slug invalido.");
    err.status = 400;
    throw err;
  }

  const page = await MyPage.findOne({ slug, isPublished: true }).lean();
  if (!page) {
    const err = new Error("Pagina publica nao encontrada.");
    err.status = 404;
    throw err;
  }

  return page;
}

function buildCatalogQuery(page, { q = "", selectedIds = [] } = {}) {
  const allowedShopIds = resolvePageShopProductIds(page);
  if (!allowedShopIds.length) return null;

  const query = {
    workspaceId: page.workspaceId,
    _id: {
      $in: allowedShopIds.map((value) => new mongoose.Types.ObjectId(value)),
    },
  };

  if (selectedIds.length) {
    const objectIds = selectedIds.filter((value) => isObjectId(value));
    if (!objectIds.length) return null;
    query._id = {
      $in: objectIds
        .filter((value) => allowedShopIds.includes(String(value)))
        .map((value) => new mongoose.Types.ObjectId(value)),
    };
    if (!query._id.$in.length) return null;
    return query;
  }

  const term = String(q || "").trim();
  if (term) {
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [
      { name: regex },
      { description: regex },
      { productId: regex },
    ];
  }

  return query;
}

async function listCatalogProductsForPage(page, options = {}) {
  const query = buildCatalogQuery(page, options);
  if (!query) return [];
  const docs = await Product.find(query)
    .sort({ createdAt: -1 })
    .limit(
      options.selectedIds?.length
        ? Math.max(options.selectedIds.length, 50)
        : 200,
    )
    .lean();

  return docs.map(serializeProduct);
}

function sanitizeQuoteRequestStatus(value) {
  const status = String(value || "")
    .trim()
    .toLowerCase();
  return QUOTE_REQUEST_STATUSES.includes(status) ? status : "";
}

function sanitizeQuoteProductIds(value) {
  const items = Array.isArray(value) ? value : value != null ? [value] : [];
  return Array.from(
    new Set(
      items
        .map((item) => sanitizeText(item, 80))
        .filter(Boolean),
    ),
  ).slice(0, 24);
}

async function loadPageAgenda(page) {
  const settings = await AppSettings.findOne({
    workspaceId: page.workspaceId,
    ownerUserId: page.ownerUserId,
  })
    .select("agenda")
    .lean()
    .catch(() => null);

  if (!settings?.agenda) {
    return {
      configured: false,
      agenda: DEFAULT_AGENDA,
    };
  }

  return {
    configured: true,
    agenda: mergeAgenda(DEFAULT_AGENDA, settings.agenda || {}),
  };
}

function bookingScopeFromPage(page) {
  return {
    workspaceId: page.workspaceId,
    ownerUserId: page.ownerUserId,
  };
}

function normalizeBookingStatusForSlots(status) {
  const value = String(status || "")
    .trim()
    .toUpperCase();
  if (value === "PAID") return "CONFIRMED";
  if (value === "CANCELED") return "CANCELLED";
  return value;
}

async function buildScheduleSlotsForPage(page, date) {
  const { configured, agenda } = await loadPageAgenda(page);
  if (!configured) {
    return {
      scheduleAvailable: false,
      reason: "AGENDA_NOT_CONFIGURED",
      page: serializePublicPage(page),
      now: new Date().toISOString(),
      slots: [],
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || "").trim())) {
    const err = new Error("Informe date=YYYY-MM-DD.");
    err.status = 400;
    throw err;
  }

  const tz =
    agenda?.timezone || DEFAULT_AGENDA.timezone || "America/Sao_Paulo";
  const durationMin =
    Number(agenda?.slotMinutes) > 0 ? Number(agenda.slotMinutes) : 60;
  const noticeMinutes = Number.isFinite(
    Number(agenda?.selfServiceMinimumNoticeMinutes),
  )
    ? Number(agenda.selfServiceMinimumNoticeMinutes)
    : DEFAULT_SELF_SERVICE_MINIMUM_NOTICE_MINUTES;

  const dayAgenda = resolveAgendaForDate(agenda, date, { durationMin });
  const baseSlots = buildSlotsForDate({
    dayAgenda,
    date,
    durationMin,
    tz,
  });

  const now = new Date();
  const noticeThreshold = new Date(now.getTime() + noticeMinutes * 60 * 1000);
  const { dayStart, dayEnd } = dayRangeInTZ(date, tz);
  const scope = bookingScopeFromPage(page);

  const bookings = await Booking.find({
    ...scope,
    startAt: { $gte: dayStart, $lt: dayEnd },
    $or: [
      { status: { $in: ["CONFIRMED", "PAID"] } },
      { status: "HOLD", holdExpiresAt: { $gt: now } },
    ],
  })
    .select("startAt endAt status holdExpiresAt")
    .lean()
    .catch(() => []);

  const busy = bookings
    .map((booking) => ({
      startAt: booking.startAt,
      endAt: booking.endAt,
      status: normalizeBookingStatusForSlots(booking.status),
    }))
    .filter((booking) => booking.startAt && booking.endAt);

  const slots = baseSlots.map((slot) => {
    const slotStart = new Date(slot.startAt);
    const slotEnd = new Date(slot.endAt);

    const overlaps = busy.some((item) => {
      const startAt = new Date(item.startAt);
      const endAt = new Date(item.endAt);
      return slotStart < endAt && slotEnd > startAt;
    });

    const enoughNotice = slotStart.getTime() >= noticeThreshold.getTime();
    return {
      ...slot,
      available: !overlaps && enoughNotice,
      status: !overlaps && enoughNotice ? "FREE" : overlaps ? "CONFIRMED" : "BLOCKED",
    };
  });

  return {
    scheduleAvailable: true,
    reason: "",
    page: serializePublicPage(page),
    now: now.toISOString(),
    slots,
  };
}

function buildBookingSummary(bookingDoc) {
  const booking = bookingDoc?.toObject
    ? bookingDoc.toObject()
    : { ...(bookingDoc || {}) };
  return {
    _id: booking._id ? String(booking._id) : null,
    sourceType: booking.sourceType || "offer",
    myPageId: booking.myPageId ? String(booking.myPageId) : null,
    serviceLabel: booking.serviceLabel || "",
    status: booking.status || "",
    startAt:
      booking.startAt instanceof Date
        ? booking.startAt.toISOString()
        : booking.startAt || null,
    endAt:
      booking.endAt instanceof Date
        ? booking.endAt.toISOString()
        : booking.endAt || null,
    customerName: booking.customerName || "",
    customerWhatsApp: booking.customerWhatsApp || "",
    createdAt:
      booking.createdAt instanceof Date
        ? booking.createdAt.toISOString()
        : booking.createdAt || null,
  };
}

function extractPublicTokenFromInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const directMatch = raw.match(/\b[a-f0-9]{32}\b/i);
  if (directMatch) return directMatch[0];

  try {
    const url = new URL(raw);
    const match = url.pathname.match(/\/p\/([a-f0-9]{32})/i);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function buildQuoteRequestPrefill(doc) {
  const serialized = serializeQuoteRequest(doc);
  const selectedProducts = Array.isArray(serialized.selectedProducts)
    ? serialized.selectedProducts
    : [];

  const offerType =
    serialized.requestType === "product" || selectedProducts.length
      ? "product"
      : "service";

  return {
    quoteRequestId: serialized._id,
    customerName: serialized.customerName || "",
    customerWhatsApp: serialized.customerWhatsApp || "",
    customerEmail: serialized.customerEmail || "",
    customerDoc: "",
    offerType,
    title:
      offerType === "product"
        ? "Orcamento solicitado pela Minha Pagina"
        : "Proposta solicitada pela Minha Pagina",
    description: serialized.message || "",
    items: selectedProducts.map((product) => ({
      productId: product._id || product.productId || "",
      description: product.name || product.description || "",
      qty: 1,
      unitPriceCents: Number(product.priceCents || 0),
    })),
  };
}

router.get(
  "/my-page/public/:slug",
  asyncHandler(async (req, res) => {
    const page = await loadPublishedPageBySlug(req.params.slug);
    return res.json({ ok: true, page: serializePublicPage(page) });
  }),
);

router.get(
  "/my-page/public/:slug/catalog",
  asyncHandler(async (req, res) => {
    const page = await loadPublishedPageBySlug(req.params.slug);
    const q = sanitizeText(req.query.q, 120);
    const products = await listCatalogProductsForPage(page, { q });

    return res.json({
      ok: true,
      page: serializePublicPage(page),
      products,
      q,
    });
  }),
);

router.get(
  "/my-page/public/:slug/quote/context",
  asyncHandler(async (req, res) => {
    const page = await loadPublishedPageBySlug(req.params.slug);
    const selectedIds = sanitizeQuoteProductIds(req.query.productId);
    const selectedProducts = selectedIds.length
      ? await listCatalogProductsForPage(page, { selectedIds })
      : [];
    const products = await listCatalogProductsForPage(page, {});

    return res.json({
      ok: true,
      page: serializePublicPage(page),
      products,
      selectedProducts,
      requestTypeDefault: selectedProducts.length ? "product" : "service",
    });
  }),
);

router.post(
  "/my-page/public/:slug/quote",
  asyncHandler(async (req, res) => {
    const page = await loadPublishedPageBySlug(req.params.slug);
    const customerName = sanitizeText(req.body?.customerName, 120);
    const customerWhatsApp = sanitizePhone(req.body?.customerWhatsApp);
    const customerEmail = sanitizeText(req.body?.customerEmail, 160);
    const requestType =
      String(req.body?.requestType || "service").trim().toLowerCase() ===
      "product"
        ? "product"
        : "service";
    const message = sanitizeLongText(req.body?.message, 1500);
    const selectedProductIds = sanitizeQuoteProductIds(
      req.body?.selectedProductIds,
    );

    if (!customerName) {
      return res
        .status(400)
        .json({ ok: false, error: "Informe seu nome para pedir o orcamento." });
    }
    if (!customerWhatsApp) {
      return res.status(400).json({
        ok: false,
        error: "Informe um WhatsApp valido para continuar.",
      });
    }

    const selectedProducts = selectedProductIds.length
      ? await listCatalogProductsForPage(page, { selectedIds: selectedProductIds })
      : [];

    const quoteRequest = await MyPageQuoteRequest.create({
      workspaceId: page.workspaceId,
      ownerUserId: page.ownerUserId,
      pageId: page._id,
      slugSnapshot: page.slug,
      pageTitleSnapshot: page.title,
      status: "new",
      customerName,
      customerWhatsApp,
      customerEmail,
      requestType,
      message,
      selectedProducts: selectedProducts.map((product) => ({
        productId: product.productId,
        name: product.name,
        description: product.description,
        priceCents: Number(product.priceCents || 0),
        imageUrl: product.imageUrl || "",
      })),
    });

    return res.json({
      ok: true,
      request: serializeQuoteRequest(quoteRequest),
      page: serializePublicPage(page),
      whatsappUrl: buildWhatsAppUrl(page.whatsappPhone, page.title),
    });
  }),
);

router.get(
  "/my-page/public/:slug/schedule/slots",
  asyncHandler(async (req, res) => {
    const page = await loadPublishedPageBySlug(req.params.slug);
    const date = String(req.query.date || "").trim();
    const payload = await buildScheduleSlotsForPage(page, date);

    return res.json({ ok: true, ...payload });
  }),
);

router.post(
  "/my-page/public/:slug/schedule/book",
  asyncHandler(async (req, res) => {
    const page = await loadPublishedPageBySlug(req.params.slug);
    const customerName = sanitizeText(req.body?.customerName, 120);
    const customerWhatsApp = sanitizePhone(req.body?.customerWhatsApp);
    const requestedStart = req.body?.startAt ?? req.body?.start;
    const requestedEnd = req.body?.endAt ?? req.body?.end;

    if (!customerName) {
      return res.status(400).json({
        ok: false,
        error: "Informe seu nome para agendar o atendimento.",
      });
    }
    if (!customerWhatsApp) {
      return res.status(400).json({
        ok: false,
        error: "Informe um WhatsApp valido para confirmar o horario.",
      });
    }

    const startAt = new Date(requestedStart);
    const endAt = new Date(requestedEnd);
    if (
      Number.isNaN(startAt.getTime()) ||
      Number.isNaN(endAt.getTime()) ||
      endAt <= startAt
    ) {
      return res
        .status(400)
        .json({ ok: false, error: "Horario invalido." });
    }

    const date = startAt.toISOString().slice(0, 10);
    const payload = await buildScheduleSlotsForPage(page, date);
    if (!payload.scheduleAvailable) {
      return res.status(409).json({
        ok: false,
        error: "A agenda desta pagina nao esta disponivel no momento.",
        code: payload.reason || "SCHEDULE_NOT_AVAILABLE",
      });
    }

    const slot = payload.slots.find(
      (item) =>
        item.startAt === startAt.toISOString() &&
        item.endAt === endAt.toISOString(),
    );

    if (!slot || slot.available !== true) {
      return res.status(409).json({
        ok: false,
        error: "Esse horario nao esta mais disponivel. Escolha outro.",
      });
    }

    const booking = await Booking.create({
      workspaceId: page.workspaceId,
      ownerUserId: page.ownerUserId,
      publicToken: randomUUID().replace(/-/g, ""),
      sourceType: "my_page",
      myPageId: page._id,
      serviceLabel: page.title
        ? `Agendamento via ${page.title}`
        : "Agendamento via Minha Pagina",
      startAt,
      endAt,
      status: "CONFIRMED",
      holdExpiresAt: null,
      customerName,
      customerWhatsApp,
      payment: {
        provider: "MANUAL_PIX",
        amountCents: 0,
        status: "PENDING",
      },
    });

    return res.json({
      ok: true,
      page: serializePublicPage(page),
      booking: buildBookingSummary(booking),
      whatsappUrl: buildWhatsAppUrl(page.whatsappPhone, page.title),
    });
  }),
);

router.post(
  "/my-page/public/:slug/pay/resolve",
  asyncHandler(async (req, res) => {
    const page = await loadPublishedPageBySlug(req.params.slug);
    const input = sanitizeText(req.body?.input, 400);
    if (!input) {
      return res.status(400).json({
        ok: false,
        error: "Informe o codigo da proposta ou cole o link recebido.",
      });
    }

    const publicToken = extractPublicTokenFromInput(input);
    const publicCode = sanitizePublicCode(input);

    let offer = null;

    if (publicToken) {
      offer = await Offer.findOne({
        workspaceId: page.workspaceId,
        publicToken,
      })
        .select("_id publicToken publicCode title customerName status totalCents")
        .lean();
    }

    if (!offer && publicCode) {
      offer = await Offer.findOne({
        workspaceId: page.workspaceId,
        publicCode,
      })
        .select("_id publicToken publicCode title customerName status totalCents")
        .lean();
    }

    if (!offer?.publicToken) {
      return res.status(404).json({
        ok: false,
        error:
          "Nao encontrei uma proposta valida para este codigo nesta pagina.",
      });
    }

    return res.json({
      ok: true,
      redirectUrl: `/p/${offer.publicToken}`,
      offer: {
        _id: String(offer._id),
        publicToken: offer.publicToken || "",
        publicCode: offer.publicCode || "",
        title: offer.title || "",
        customerName: offer.customerName || "",
        status: offer.status || "",
        totalCents: Number(offer.totalCents || 0),
      },
      page: serializePublicPage(page),
    });
  }),
);

router.post(
  "/my-page/public/:slug/click",
  asyncHandler(async (req, res) => {
    const page = await loadPublishedPageBySlug(req.params.slug);

    const buttonId = sanitizeText(req.body?.buttonId, 120);
    const button = (page.buttons || []).find((item) => item.id === buttonId);
    const targetUrl = resolveButtonTarget(page, button);

    await MyPageClick.create({
      pageId: page._id,
      workspaceId: page.workspaceId,
      ownerUserId: page.ownerUserId,
      slugSnapshot: page.slug,
      buttonId: button?.id || "",
      buttonLabel: button?.label || "",
      buttonType: button?.type || "",
      targetUrl,
      referrer: sanitizeUrl(req.body?.referrer || req.headers?.referer || ""),
      userAgent: sanitizeText(req.headers["user-agent"], 1000),
    });

    return res.json({ ok: true });
  }),
);

router.use(ensureAuth, tenantFromUser);

function requireMyPageSettingsAccess(req, _res, next) {
  try {
    assertWorkspaceModuleAccess({
      user: req.user,
      workspacePlan: req.user?.workspacePlan,
      workspaceOwnerUserId: req.user?.workspaceOwnerUserId,
      moduleKey: "settings",
    });
    assertWorkspaceOwner(req.user, req.user?.workspaceOwnerUserId);
    next();
  } catch (error) {
    next(error);
  }
}

function requireMyPageOffersAccess(req, _res, next) {
  try {
    assertWorkspaceModuleAccess({
      user: req.user,
      workspacePlan: req.user?.workspacePlan,
      workspaceOwnerUserId: req.user?.workspaceOwnerUserId,
      moduleKey: "offers",
    });
    next();
  } catch (error) {
    next(error);
  }
}

router.get(
  "/my-page",
  requireMyPageSettingsAccess,
  asyncHandler(async (req, res) => {
    const { page } = await loadWorkspacePage(req);
    return res.json({ ok: true, page: serializePage(page) });
  }),
);

router.put(
  "/my-page",
  requireMyPageSettingsAccess,
  asyncHandler(async (req, res) => {
    const { page } = await loadWorkspacePage(req);
    const nextSlug = await uniqueSlug(req.body?.slug || page.slug, page._id);

    page.slug = nextSlug;
    page.title = sanitizeText(req.body?.title || page.title, 120) || page.title;
    page.subtitle = sanitizeText(req.body?.subtitle, 160);
    page.description = sanitizeText(req.body?.description, 400);
    page.avatarUrl = sanitizeUrl(req.body?.avatarUrl);
    page.coverStyle =
      sanitizeText(req.body?.coverStyle, 40) ||
      page.coverStyle ||
      DEFAULT_COVER_STYLE;
    page.whatsappPhone = sanitizePhone(req.body?.whatsappPhone);
    page.buttons = sanitizeButtons(req.body?.buttons, page.whatsappPhone);
    page.socialLinks = sanitizeSocialLinks(req.body?.socialLinks);
    page.shop = sanitizeShop(req.body?.shop);
    page.design = sanitizeDesign(req.body?.design, page.coverStyle);
    page.coverStyle = page.design?.themePreset || DEFAULT_COVER_STYLE;

    await page.save();
    return res.json({ ok: true, page: serializePage(page) });
  }),
);

router.put(
  "/my-page/links",
  requireMyPageSettingsAccess,
  maybeUploadMyPageAvatar,
  asyncHandler(async (req, res) => {
    const { page } = await loadWorkspacePage(req);
    const nextSlug = await uniqueSlug(req.body?.slug || page.slug, page._id);
    const hasAvatarMode = Object.prototype.hasOwnProperty.call(
      req.body || {},
      "avatarMode",
    );
    const avatarMode = sanitizeEnum(
      req.body?.avatarMode,
      MY_PAGE_AVATAR_MODES,
      "keep",
    );
    const buttons = parseMaybeJson(req.body?.buttons, req.body?.buttons || []);
    const socialLinks = parseMaybeJson(
      req.body?.socialLinks,
      req.body?.socialLinks || [],
    );

    page.slug = nextSlug;
    page.title = sanitizeText(req.body?.title || page.title, 120) || page.title;
    page.subtitle = sanitizeText(req.body?.subtitle, 160);
    page.description = sanitizeText(req.body?.description, 400);
    page.whatsappPhone = sanitizePhone(req.body?.whatsappPhone);
    page.buttons = sanitizeButtons(buttons, page.whatsappPhone);
    page.socialLinks = sanitizeSocialLinks(socialLinks);

    if (hasAvatarMode) {
      if (avatarMode === "remove") {
        page.avatarUrl = "";
      } else if (avatarMode === "url") {
        page.avatarUrl = sanitizeUrl(req.body?.avatarUrl);
      } else if (avatarMode === "upload") {
        if (req.file) {
          page.avatarUrl = `/uploads/my-page/${req.file.filename}`;
        }
      }
    } else if (req.file) {
      page.avatarUrl = `/uploads/my-page/${req.file.filename}`;
    } else {
      page.avatarUrl = sanitizeUrl(req.body?.avatarUrl);
    }

    await page.save();
    return res.json({ ok: true, page: serializePage(page) });
  }),
);

router.get(
  "/my-page/shop/products",
  requireMyPageSettingsAccess,
  asyncHandler(async (req, res) => {
    const { page } = await loadWorkspacePage(req);
    const q = sanitizeText(req.query.q, 120);
    const regex = q
      ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;

    const query = { workspaceId: req.tenantId };
    if (regex) {
      query.$or = [{ name: regex }, { description: regex }, { productId: regex }];
    }

    const selectedIds = new Set(resolvePageShopProductIds(page));
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .limit(400)
      .lean();

    return res.json({
      ok: true,
      items: products.map((product) => ({
        ...serializeProduct(product),
        selected: selectedIds.has(String(product?._id || "")),
      })),
    });
  }),
);

router.put(
  "/my-page/shop",
  requireMyPageSettingsAccess,
  asyncHandler(async (req, res) => {
    const { page } = await loadWorkspacePage(req);
    const requestedIds = sanitizeShop(req.body?.shop).productIds;
    const validProducts = requestedIds.length
      ? await Product.find({
          workspaceId: req.tenantId,
          _id: {
            $in: requestedIds.map((value) => new mongoose.Types.ObjectId(value)),
          },
        })
          .select("_id")
          .lean()
      : [];

    page.shop = {
      productIds: validProducts.map((product) => String(product._id)),
    };

    await page.save();
    return res.json({ ok: true, page: serializePage(page) });
  }),
);

router.put(
  "/my-page/design",
  requireMyPageSettingsAccess,
  asyncHandler(async (req, res) => {
    const { page } = await loadWorkspacePage(req);
    page.design = sanitizeDesign(req.body?.design, page.coverStyle);
    page.coverStyle = page.design?.themePreset || DEFAULT_COVER_STYLE;

    await page.save();
    return res.json({ ok: true, page: serializePage(page) });
  }),
);

router.post(
  "/my-page/publish",
  requireMyPageSettingsAccess,
  asyncHandler(async (req, res) => {
    const { page } = await loadWorkspacePage(req);
    page.isPublished = req.body?.isPublished === true;
    await page.save();
    return res.json({ ok: true, page: serializePage(page) });
  }),
);

router.get(
  "/my-page/analytics",
  requireMyPageSettingsAccess,
  asyncHandler(async (req, res) => {
    const { page } = await loadWorkspacePage(req);
    const pageId = page._id;
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalClicks, clicksLast7d, clicksLast30d, topButtons, recentClicks] =
      await Promise.all([
        MyPageClick.countDocuments({ pageId }),
        MyPageClick.countDocuments({ pageId, createdAt: { $gte: since7 } }),
        MyPageClick.countDocuments({ pageId, createdAt: { $gte: since30 } }),
        MyPageClick.aggregate([
          { $match: { pageId } },
          {
            $group: {
              _id: "$buttonId",
              count: { $sum: 1 },
              label: { $first: "$buttonLabel" },
              type: { $first: "$buttonType" },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 5 },
        ]),
        MyPageClick.find({ pageId }).sort({ createdAt: -1 }).limit(10).lean(),
      ]);

    return res.json({
      ok: true,
      analytics: {
        totalClicks,
        clicksLast7d,
        clicksLast30d,
        topButtons: topButtons.map((item) => ({
          buttonId: item._id || "",
          label: item.label || "",
          type: item.type || "",
          count: item.count || 0,
        })),
        recentClicks: recentClicks.map((item) => ({
          buttonId: item.buttonId || "",
          buttonLabel: item.buttonLabel || "",
          buttonType: item.buttonType || "",
          targetUrl: item.targetUrl || "",
          createdAt: item.createdAt || null,
        })),
      },
    });
  }),
);

router.get(
  "/my-page/quote-requests",
  requireMyPageOffersAccess,
  asyncHandler(async (req, res) => {
    const { page } = await loadWorkspacePageWithOptions(req, {
      createIfMissing: false,
    });
    if (!page?._id) {
      return res.json({ ok: true, items: [] });
    }
    const status = sanitizeQuoteRequestStatus(req.query.status);

    const query = {
      workspaceId: req.tenantId,
      pageId: page._id,
    };
    if (status) query.status = status;

    const items = await MyPageQuoteRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate(
        "createdOfferId",
        "_id publicToken publicCode title status totalCents customerName",
      )
      .lean();

    return res.json({
      ok: true,
      items: items.map((item) =>
        serializeQuoteRequest({
          ...item,
          createdOffer: item.createdOfferId || null,
        }),
      ),
    });
  }),
);

router.patch(
  "/my-page/quote-requests/:id/status",
  requireMyPageOffersAccess,
  asyncHandler(async (req, res) => {
    const { page } = await loadWorkspacePageWithOptions(req, {
      createIfMissing: false,
    });
    if (!page?._id) {
      return res
        .status(404)
        .json({ ok: false, error: "Solicitacao nao encontrada." });
    }
    const status = sanitizeQuoteRequestStatus(req.body?.status);
    if (!status) {
      return res
        .status(400)
        .json({ ok: false, error: "Status invalido para a solicitacao." });
    }

    const id = String(req.params.id || "").trim();
    if (!isObjectId(id)) {
      return res
        .status(400)
        .json({ ok: false, error: "Solicitacao invalida." });
    }

    const updated = await MyPageQuoteRequest.findOneAndUpdate(
      {
        _id: id,
        workspaceId: req.tenantId,
        pageId: page._id,
      },
      { $set: { status } },
      { new: true },
    )
      .populate(
        "createdOfferId",
        "_id publicToken publicCode title status totalCents customerName",
      )
      .lean();

    if (!updated) {
      return res
        .status(404)
        .json({ ok: false, error: "Solicitacao nao encontrada." });
    }

    return res.json({
      ok: true,
      request: serializeQuoteRequest({
        ...updated,
        createdOffer: updated.createdOfferId || null,
      }),
    });
  }),
);

router.get(
  "/my-page/quote-requests/:id/prefill",
  requireMyPageOffersAccess,
  asyncHandler(async (req, res) => {
    const { page } = await loadWorkspacePageWithOptions(req, {
      createIfMissing: false,
    });
    if (!page?._id) {
      return res
        .status(404)
        .json({ ok: false, error: "Solicitacao nao encontrada." });
    }
    const id = String(req.params.id || "").trim();
    if (!isObjectId(id)) {
      return res
        .status(400)
        .json({ ok: false, error: "Solicitacao invalida." });
    }

    const doc = await MyPageQuoteRequest.findOne({
      _id: id,
      workspaceId: req.tenantId,
      pageId: page._id,
    }).lean();

    if (!doc) {
      return res
        .status(404)
        .json({ ok: false, error: "Solicitacao nao encontrada." });
    }

    return res.json({
      ok: true,
      request: serializeQuoteRequest(doc),
      prefill: buildQuoteRequestPrefill(doc),
    });
  }),
);

export default router;
