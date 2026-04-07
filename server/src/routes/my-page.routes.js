import { randomUUID } from "crypto";
import { Router } from "express";
import { MyPage, MY_PAGE_BUTTON_TYPES } from "../models/MyPage.js";
import { MyPageClick } from "../models/MyPageClick.js";
import { Workspace } from "../models/Workspace.js";
import { ensureAuth, tenantFromUser } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  assertWorkspaceModuleAccess,
  assertWorkspaceOwner,
} from "../utils/workspaceAccess.js";

const router = Router();

const DEFAULT_COVER_STYLE = "ocean";
const BUTTON_TYPE_LABELS = {
  whatsapp: "Fale no WhatsApp",
  external_url: "Abrir link",
  public_schedule: "Agendar atendimento",
  public_offer: "Pedir orçamento",
  catalog: "Ver catálogo",
  payment_link: "Pagar proposta",
};

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

function sanitizeUrl(value) {
  return String(value || "").trim().slice(0, 2000);
}

function sanitizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").slice(0, 30);
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
      label: "Pedir orçamento",
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
      label: "Ver catálogo",
      type: "catalog",
      url: "",
      enabled: false,
      sortOrder: 4,
    },
  ];
}

async function uniqueSlug(base, excludeId = null) {
  const fallback = toSlug(base) || `pagina-${Date.now()}`;
  let candidate = fallback;
  let cursor = 2;

  while (true) {
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

function buildWhatsAppUrl(phone, title = "") {
  const digits = String(phone || "").replace(/\D+/g, "");
  if (!digits) return "";
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  const message = encodeURIComponent(
    `Olá! Vim pela sua página ${title ? `da ${title}` : "na LuminorPay"} e quero falar com você.`,
  );
  return `https://wa.me/${withCountry}?text=${message}`;
}

function resolveButtonTarget(page, button) {
  if (!button?.enabled) return "";
  if (button.type === "whatsapp") {
    return buildWhatsAppUrl(page?.whatsappPhone, page?.title);
  }
  return sanitizeUrl(button?.url);
}

function serializePage(pageDoc) {
  const page = pageDoc?.toObject ? pageDoc.toObject() : { ...(pageDoc || {}) };
  const buttons = sortByOrder(page.buttons || []).map((button) => ({
    ...button,
    targetUrl: resolveButtonTarget(page, button),
  }));
  const socialLinks = sortByOrder(page.socialLinks || []);

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
    createdAt: page.createdAt || null,
    updatedAt: page.updatedAt || null,
  };
}

async function buildInitialPage({ workspace, ownerUserId, whatsappPhone }) {
  const baseSlug = workspace?.slug || workspace?.name || "minha-pagina";
  const slug = await uniqueSlug(baseSlug);

  return MyPage.create({
    workspaceId: workspace?._id,
    ownerUserId,
    slug,
    title: sanitizeText(workspace?.name || "Minha Página", 120),
    subtitle: "Seus principais links comerciais em um só lugar.",
    description:
      "Centralize atendimento, orçamento, agenda e pagamento em uma única página pública da LuminorPay.",
    avatarUrl: "",
    coverStyle: DEFAULT_COVER_STYLE,
    whatsappPhone: sanitizePhone(whatsappPhone),
    isPublished: false,
    buttons: buildDefaultButtons(whatsappPhone),
    socialLinks: [],
  });
}

async function loadWorkspacePage(req) {
  const workspace = await Workspace.findById(req.tenantId)
    .select("_id name slug ownerUserId")
    .lean();
  if (!workspace) {
    const err = new Error("Workspace nao encontrado.");
    err.status = 404;
    throw err;
  }

  let page = await MyPage.findOne({ workspaceId: req.tenantId });
  if (!page) {
    page = await buildInitialPage({
      workspace,
      ownerUserId: req.user?._id,
      whatsappPhone: req.user?.whatsappPhone || "",
    });
  }

  return { workspace, page };
}

router.get(
  "/my-page/public/:slug",
  asyncHandler(async (req, res) => {
    const slug = toSlug(req.params.slug);
    if (!slug) {
      return res.status(400).json({ ok: false, error: "Slug invalido." });
    }

    const page = await MyPage.findOne({ slug, isPublished: true }).lean();
    if (!page) {
      return res
        .status(404)
        .json({ ok: false, error: "Pagina publica nao encontrada." });
    }

    const serialized = serializePage(page);
    return res.json({
      ok: true,
      page: {
        ...serialized,
        buttons: serialized.buttons.filter((button) => button.targetUrl),
        socialLinks: serialized.socialLinks.filter(
          (item) => item.enabled === true && item.url,
        ),
      },
    });
  }),
);

router.post(
  "/my-page/public/:slug/click",
  asyncHandler(async (req, res) => {
    const slug = toSlug(req.params.slug);
    const page = await MyPage.findOne({ slug, isPublished: true });
    if (!page) {
      return res
        .status(404)
        .json({ ok: false, error: "Pagina publica nao encontrada." });
    }

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
router.use((req, _res, next) => {
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
});

router.get(
  "/my-page",
  asyncHandler(async (req, res) => {
    const { page } = await loadWorkspacePage(req);
    return res.json({ ok: true, page: serializePage(page) });
  }),
);

router.put(
  "/my-page",
  asyncHandler(async (req, res) => {
    const { page } = await loadWorkspacePage(req);
    const nextSlug = await uniqueSlug(req.body?.slug || page.slug, page._id);

    page.slug = nextSlug;
    page.title = sanitizeText(req.body?.title || page.title, 120) || page.title;
    page.subtitle = sanitizeText(req.body?.subtitle, 160);
    page.description = sanitizeText(req.body?.description, 400);
    page.avatarUrl = sanitizeUrl(req.body?.avatarUrl);
    page.coverStyle =
      sanitizeText(req.body?.coverStyle, 40) || DEFAULT_COVER_STYLE;
    page.whatsappPhone = sanitizePhone(req.body?.whatsappPhone);
    page.buttons = sanitizeButtons(req.body?.buttons, page.whatsappPhone);
    page.socialLinks = sanitizeSocialLinks(req.body?.socialLinks);

    await page.save();
    return res.json({ ok: true, page: serializePage(page) });
  }),
);

router.post(
  "/my-page/publish",
  asyncHandler(async (req, res) => {
    const { page } = await loadWorkspacePage(req);
    page.isPublished = req.body?.isPublished === true;
    await page.save();
    return res.json({ ok: true, page: serializePage(page) });
  }),
);

router.get(
  "/my-page/analytics",
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
        MyPageClick.find({ pageId })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
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

export default router;
