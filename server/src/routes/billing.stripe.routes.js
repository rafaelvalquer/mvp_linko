// server/src/routes/billing.stripe.routes.js
import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ensureAuth } from "../middleware/auth.js";
import { Workspace } from "../models/Workspace.js";

import {
  createCheckoutSession,
  createPortalSession,
  getFrontendUrl,
  getStripe,
  retrieveCheckoutSession,
  planForPriceId,
  priceIdForPlan,
} from "../services/stripeClient.js";

import {
  PLAN_LIMITS,
  normalizePlan,
  summarizeWorkspaceQuota,
  ensureWorkspaceCycle,
  ensurePixMonthlyLimit,
  httpError,
  cycleKeySP,
} from "../utils/pixQuota.js";

const r = Router();

function limitForPlan(plan) {
  const p = normalizePlan(plan);
  if (p === "enterprise") return 0;
  return PLAN_LIMITS[p] ?? PLAN_LIMITS.start;
}

/**
 * POST /api/billing/stripe/checkout-session
 * body: { plan: "start"|"pro"|"business" }
 */
r.post(
  "/billing/stripe/checkout-session",
  ensureAuth,
  asyncHandler(async (req, res) => {
    const workspaceId = req.user?.workspaceId;
    if (!workspaceId) throw httpError(400, "workspaceId ausente no usuário.");

    const plan = normalizePlan(req.body?.plan);
    if (!["start", "pro", "business"].includes(plan)) {
      return res.status(400).json({
        ok: false,
        error: "Plano inválido. Use start|pro|business.",
      });
    }

    const ws = await Workspace.findById(workspaceId);
    if (!ws)
      return res
        .status(404)
        .json({ ok: false, error: "Workspace não encontrado." });

    // se já tem subscriptionId, força portal
    if (ws?.subscription?.stripeSubscriptionId) {
      return res.status(409).json({
        ok: false,
        error: "Workspace já possui assinatura. Use o Portal para gerenciar.",
      });
    }

    // valida env priceId antes de criar checkout
    const pid = priceIdForPlan(plan);
    if (!pid) {
      return res
        .status(500)
        .json({ ok: false, error: "PriceId do plano não configurado no ENV." });
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

    // cria checkout
    const session = await createCheckoutSession({
      workspaceId,
      plan,
      stripeCustomerId,
      customerEmail:
        String(req.user?.email || "")
          .trim()
          .toLowerCase() || undefined,
    });

    // marca como pending (sem liberar Pix ainda)
    ws.plan = plan;
    ws.planStatus = "pending";
    ws.pixMonthlyLimit = 0;

    ws.subscription = {
      ...(ws.subscription?.toObject?.() || ws.subscription || {}),
      provider: "stripe",
      stripeCustomerId,
      status: "inactive",
      priceId: pid,
      planAtStripe: plan,
    };

    await ws.save();

    return res.json({ ok: true, url: session.url });
  }),
);

/**
 * GET /api/billing/stripe/confirm?session_id=...
 * - valida se session pertence ao workspace logado
 * - se session completa e subscription existir, sincroniza do Stripe (fallback ao webhook)
 */
r.get(
  "/billing/stripe/confirm",
  ensureAuth,
  asyncHandler(async (req, res) => {
    const workspaceId = String(req.user?.workspaceId || "");
    const sessionId = String(req.query?.session_id || "").trim();

    if (!sessionId)
      return res.status(400).json({ ok: false, error: "session_id required" });

    const stripe = getStripe();

    const session = await retrieveCheckoutSession(sessionId);

    if (session?.mode !== "subscription") {
      return res
        .status(400)
        .json({ ok: false, error: "Checkout session não é subscription." });
    }

    const wsIdFromSession = String(
      session?.client_reference_id || session?.metadata?.workspaceId || "",
    );

    if (!wsIdFromSession || wsIdFromSession !== workspaceId) {
      return res.status(403).json({
        ok: false,
        error: "Checkout session não pertence ao workspace autenticado.",
      });
    }

    // se já estiver ativo no banco, só retorna status
    await ensureWorkspaceCycle(workspaceId);
    await ensurePixMonthlyLimit(workspaceId);

    let ws = await Workspace.findById(workspaceId).lean();
    if (!ws)
      return res
        .status(404)
        .json({ ok: false, error: "Workspace não encontrado." });

    // fallback: se session completou, sincroniza assinatura do Stripe
    const isComplete =
      String(session?.status || "").toLowerCase() === "complete";
    const subscriptionId =
      typeof session?.subscription === "string"
        ? session.subscription
        : session?.subscription?.id;

    if (isComplete && subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["items.data.price"],
      });

      const priceId = sub?.items?.data?.[0]?.price?.id || "";
      const plan = normalizePlan(
        planForPriceId(priceId) || session?.metadata?.plan || ws.plan,
      );

      const periodStart = sub?.current_period_start
        ? new Date(sub.current_period_start * 1000)
        : null;
      const periodEnd = sub?.current_period_end
        ? new Date(sub.current_period_end * 1000)
        : null;

      const ck = cycleKeySP(periodStart || new Date());

      const nextStatus = String(sub?.status || "").toLowerCase();
      const active = nextStatus === "active" || nextStatus === "trialing";

      const customerFromSession =
        typeof session?.customer === "string"
          ? session.customer
          : session?.customer?.id || "";

      const customerFromSub =
        typeof sub?.customer === "string"
          ? sub.customer
          : sub?.customer?.id || "";

      const safeCustomerId =
        customerFromSession ||
        customerFromSub ||
        String(ws?.subscription?.stripeCustomerId || "").trim();

      // só grava se for cus_
      const finalCustomerId = safeCustomerId.startsWith("cus_")
        ? safeCustomerId
        : "";

      await Workspace.updateOne(
        { _id: workspaceId },
        {
          $set: {
            plan,
            planStatus: active ? "active" : "pending",
            pixMonthlyLimit: active ? limitForPlan(plan) : 0,
            pixUsage: { cycleKey: ck, used: 0 },

            "subscription.provider": "stripe",
            "subscription.stripeCustomerId": finalCustomerId,
            "subscription.stripeSubscriptionId": String(subscriptionId),
            "subscription.status": active ? "active" : "inactive",
            "subscription.currentPeriodStart": periodStart,
            "subscription.currentPeriodEnd": periodEnd,
            "subscription.priceId": priceId,
            "subscription.planAtStripe": plan,
          },
        },
      );

      ws = await Workspace.findById(workspaceId).lean();
    }

    const quota = summarizeWorkspaceQuota(ws);

    return res.json({
      ok: true,
      plan: ws.plan,
      planStatus: ws.planStatus || "free",
      pixMonthlyLimit: quota.limit,
      pixUsedThisCycle: quota.used,
      pixRemaining: quota.remaining,
      cycleKey: quota.cycleKey,
      subscription: ws.subscription || { status: "inactive" },
    });
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
      .select("plan planStatus pixMonthlyLimit pixUsage subscription")
      .lean();

    if (!ws)
      return res
        .status(404)
        .json({ ok: false, error: "Workspace não encontrado." });

    const quota = summarizeWorkspaceQuota(ws);

    return res.json({
      ok: true,
      plan: ws.plan,
      planStatus: ws.planStatus || "free",
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
        planAtStripe: ws.subscription?.planAtStripe || "",
        pendingPlan: ws.subscription?.pendingPlan || "",
        pendingEffectiveAt: ws.subscription?.pendingEffectiveAt || null,
        scheduleId: ws.subscription?.scheduleId || "",
        lastInvoiceId: ws.subscription?.lastInvoiceId || "",
      },
    });
  }),
);

/**
 * POST /api/billing/stripe/portal
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
          "Workspace ainda não possui stripeCustomerId. Assine um plano primeiro.",
      });
    }

    const frontendUrl = getFrontendUrl();

    const defaultReturnUrl = `${frontendUrl}/dashboard`;
    const rawReturnUrl = String(req.body?.returnUrl || "").trim();

    // evita open redirect: só aceita returnUrl no mesmo origin do FRONTEND_URL
    let returnUrl = defaultReturnUrl;
    if (rawReturnUrl) {
      try {
        const u = new URL(rawReturnUrl);
        const allowed = new URL(frontendUrl);
        if (u.origin === allowed.origin) returnUrl = u.toString();
      } catch {}
    }

    const portal = await createPortalSession(stripeCustomerId, returnUrl);
    return res.json({ ok: true, url: portal.url });
  }),
);

export default r;
