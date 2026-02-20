// server/src/routes/billing.stripe.routes.js
import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ensureAuth } from "../middleware/auth.js";
import { Workspace } from "../models/Workspace.js";

import {
  createCheckoutSession,
  createPortalSession,
  getStripe,
  priceIdForPlan,
} from "../services/stripeClient.js";

import {
  PLAN_LIMITS,
  normalizePlan,
  limitForPlan,
  summarizeWorkspaceQuota,
  ensureWorkspaceCycle,
  ensurePixMonthlyLimit,
  httpError,
} from "../utils/pixQuota.js";

const r = Router();

function planToLimit(planRaw, enterpriseLimitRaw) {
  const plan = normalizePlan(planRaw);
  if (plan === "enterprise") return limitForPlan(plan, enterpriseLimitRaw);
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.start;
}

/**
 * POST /api/billing/stripe/checkout
 * body: { plan: "start"|"pro"|"business" }
 */
r.post(
  "/billing/stripe/checkout",
  ensureAuth,
  asyncHandler(async (req, res) => {
    const workspaceId = req.user?.workspaceId;
    if (!workspaceId) throw httpError(400, "workspaceId ausente no usuário.");

    const plan = normalizePlan(req.body?.plan);
    if (!["start", "pro", "business"].includes(plan)) {
      return res.status(400).json({
        ok: false,
        error: "Plano inválido. Use start|pro|business (enterprise é offline).",
      });
    }

    const priceId = priceIdForPlan(plan);
    if (!priceId) {
      return res.status(500).json({
        ok: false,
        error: "PriceId do plano não configurado no ENV.",
      });
    }

    const ws = await Workspace.findById(workspaceId);
    if (!ws)
      return res
        .status(404)
        .json({ ok: false, error: "Workspace não encontrado." });

    // Para MVP: se já tem assinatura, forçar usar portal para upgrades/downgrades
    if (ws?.subscription?.stripeSubscriptionId) {
      return res.status(409).json({
        ok: false,
        error:
          "Workspace já possui assinatura. Use o Portal para gerenciar/trocar plano.",
      });
    }

    const stripe = getStripe();

    // garante Customer
    let stripeCustomerId = ws?.subscription?.stripeCustomerId || "";
    if (!stripeCustomerId) {
      const email = String(req.user?.email || "")
        .trim()
        .toLowerCase();
      const customer = await stripe.customers.create({
        email: email || undefined,
        metadata: { workspaceId: String(workspaceId) },
      });
      stripeCustomerId = customer.id;
    }

    // cria checkout session (subscription)
    const session = await createCheckoutSession({
      workspaceId,
      plan,
      stripeCustomerId,
      customerEmail:
        String(req.user?.email || "")
          .trim()
          .toLowerCase() || undefined,
    });

    const limit = planToLimit(plan);

    // grava intenção / dados mínimos
    ws.plan = plan;
    ws.pixMonthlyLimit = limit;

    ws.subscription = {
      ...(ws.subscription?.toObject?.() || ws.subscription || {}),
      provider: "stripe",
      stripeCustomerId,
      status: "inactive",
      priceId,
      planAtStripe: plan,
    };

    await ws.save();

    return res.json({ ok: true, url: session.url });
  }),
);

/**
 * GET /api/billing/stripe/status
 */
r.get(
  "/billing/stripe/status",
  ensureAuth,
  asyncHandler(async (req, res) => {
    const workspaceId = req.user?.workspaceId;
    if (!workspaceId) throw httpError(400, "workspaceId ausente no usuário.");

    await ensureWorkspaceCycle(workspaceId);
    await ensurePixMonthlyLimit(workspaceId);

    const ws = await Workspace.findById(workspaceId)
      .select("plan pixMonthlyLimit pixUsage subscription")
      .lean();

    if (!ws)
      return res
        .status(404)
        .json({ ok: false, error: "Workspace não encontrado." });

    const quota = summarizeWorkspaceQuota(ws);

    return res.json({
      ok: true,
      plan: ws.plan,
      pixMonthlyLimit: quota.limit,
      pixUsedThisCycle: quota.used,
      pixRemaining: quota.remaining,
      cycleKey: quota.cycleKey,

      subscription: {
        provider: ws.subscription?.provider || "stripe",
        status: ws.subscription?.status || "inactive",
        stripeCustomerId: ws.subscription?.stripeCustomerId || "",
        stripeSubscriptionId: ws.subscription?.stripeSubscriptionId || "",
        currentPeriodStart: ws.subscription?.currentPeriodStart || null,
        currentPeriodEnd: ws.subscription?.currentPeriodEnd || null,
        priceId: ws.subscription?.priceId || "",
        lastInvoiceId: ws.subscription?.lastInvoiceId || "",
      },
    });
  }),
);

/**
 * POST /api/billing/stripe/portal
 * body opcional: { returnUrl }
 */
r.post(
  "/billing/stripe/portal",
  ensureAuth,
  asyncHandler(async (req, res) => {
    const workspaceId = req.user?.workspaceId;
    if (!workspaceId) throw httpError(400, "workspaceId ausente no usuário.");

    const ws = await Workspace.findById(workspaceId)
      .select("subscription")
      .lean();
    if (!ws)
      return res
        .status(404)
        .json({ ok: false, error: "Workspace não encontrado." });

    const stripeCustomerId = ws.subscription?.stripeCustomerId;
    if (!stripeCustomerId) {
      return res.status(400).json({
        ok: false,
        error:
          "Workspace ainda não possui stripeCustomerId. Crie a assinatura primeiro.",
      });
    }

    const appUrl = process.env.APP_URL || "http://localhost:5173";
    const returnUrl = String(req.body?.returnUrl || `${appUrl}/dashboard`);

    const portal = await createPortalSession(stripeCustomerId, returnUrl);

    return res.json({ ok: true, url: portal.url });
  }),
);

export default r;
