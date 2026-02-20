// server/src/routes/webhooks.stripe.routes.js
import { Router } from "express";
import { getStripe, planForPriceId } from "../services/stripeClient.js";
import { StripeEvent } from "../models/StripeEvent.js";
import { Workspace } from "../models/Workspace.js";
import {
  PLAN_LIMITS,
  normalizePlan,
  cycleKeySP,
  httpError,
} from "../utils/pixQuota.js";

const r = Router();

function wsStatusFromStripeStatus(stripeStatus) {
  const s = String(stripeStatus || "").toLowerCase();

  if (s === "active" || s === "trialing") return "active";
  if (s === "past_due" || s === "unpaid") return "past_due";
  if (s === "canceled" || s === "incomplete_expired") return "canceled";
  return "inactive";
}

function limitForPlan(plan, enterpriseLimit) {
  const p = normalizePlan(plan);
  if (p === "enterprise") {
    const n = Number(enterpriseLimit);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
  }
  return PLAN_LIMITS[p] ?? PLAN_LIMITS.start;
}

async function loadSubscription(subscriptionId) {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  return sub;
}

function pickPriceIdFromSubscription(sub) {
  const item = sub?.items?.data?.[0];
  return item?.price?.id || "";
}

/**
 * POST /api/webhooks/stripe
 * Requer req.rawBody (Buffer) para verificação de assinatura.
 */
r.post("/webhooks/stripe", async (req, res) => {
  const stripe = getStripe();

  const sig = req.headers["stripe-signature"];
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;

  if (!whsec)
    return res
      .status(500)
      .json({ ok: false, error: "STRIPE_WEBHOOK_SECRET ausente." });
  if (!sig)
    return res
      .status(400)
      .json({ ok: false, error: "Stripe-Signature ausente." });
  if (!req.rawBody)
    return res
      .status(400)
      .json({
        ok: false,
        error: "rawBody ausente (ver app.js express.json verify).",
      });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, whsec);
  } catch (e) {
    return res
      .status(400)
      .json({
        ok: false,
        error: `Assinatura inválida: ${e?.message || "erro"}`,
      });
  }

  // idempotência por eventId
  try {
    await StripeEvent.create({
      provider: "stripe",
      eventId: event.id,
      type: event.type,
      created: event.created,
      // payload opcional (pode ficar grande; use se quiser auditoria)
      payload: undefined,
    });
  } catch (e) {
    if (e?.code === 11000) {
      return res.json({ ok: true, duplicated: true });
    }
    return res
      .status(500)
      .json({
        ok: false,
        error: e?.message || "Falha ao registrar StripeEvent.",
      });
  }

  try {
    // =========================
    // checkout.session.completed
    // =========================
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      if (session?.mode !== "subscription") return res.json({ ok: true });

      const workspaceId =
        session?.client_reference_id || session?.metadata?.workspaceId || "";

      const subscriptionId = session?.subscription;
      const customerId = session?.customer;

      if (!workspaceId || !subscriptionId || !customerId)
        return res.json({ ok: true });

      const ws = await Workspace.findById(workspaceId);
      if (!ws) return res.json({ ok: true });

      const sub = await loadSubscription(subscriptionId);

      const priceId = pickPriceIdFromSubscription(sub);
      const planFromPrice = planForPriceId(priceId);
      const plan = normalizePlan(
        planFromPrice || session?.metadata?.plan || ws.plan,
      );

      const periodStart = sub?.current_period_start
        ? new Date(sub.current_period_start * 1000)
        : null;
      const periodEnd = sub?.current_period_end
        ? new Date(sub.current_period_end * 1000)
        : null;

      const ck = cycleKeySP(periodStart || new Date());

      ws.plan = plan;
      ws.pixMonthlyLimit =
        plan === "enterprise" ? ws.pixMonthlyLimit : limitForPlan(plan);

      ws.pixUsage = { cycleKey: ck, used: 0 };

      ws.subscription = {
        ...(ws.subscription?.toObject?.() || ws.subscription || {}),
        provider: "stripe",
        stripeCustomerId: String(customerId),
        stripeSubscriptionId: String(subscriptionId),
        status: wsStatusFromStripeStatus(sub?.status),
        currentPeriodStart: periodStart || undefined,
        currentPeriodEnd: periodEnd || undefined,
        priceId: priceId || ws.subscription?.priceId || "",
        planAtStripe: plan,
      };

      await ws.save();

      return res.json({ ok: true });
    }

    // ===========
    // invoice.paid
    // ===========
    if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      const subscriptionId = invoice?.subscription;

      if (!subscriptionId) return res.json({ ok: true });

      const ws = await Workspace.findOne({
        "subscription.stripeSubscriptionId": String(subscriptionId),
      });
      if (!ws) return res.json({ ok: true });

      const sub = await loadSubscription(subscriptionId);

      const priceId = pickPriceIdFromSubscription(sub);
      const planFromPrice = planForPriceId(priceId);
      const plan = normalizePlan(planFromPrice || ws.plan);

      const periodStart = sub?.current_period_start
        ? new Date(sub.current_period_start * 1000)
        : null;
      const periodEnd = sub?.current_period_end
        ? new Date(sub.current_period_end * 1000)
        : null;

      // ciclo = periodStart (anchor)
      const ck = cycleKeySP(periodStart || new Date());

      ws.plan = plan;
      if (plan !== "enterprise") ws.pixMonthlyLimit = limitForPlan(plan);

      // RESET por ciclo pago
      ws.pixUsage = { cycleKey: ck, used: 0 };

      ws.subscription = {
        ...(ws.subscription?.toObject?.() || ws.subscription || {}),
        provider: "stripe",
        stripeCustomerId: String(
          invoice?.customer || ws.subscription?.stripeCustomerId || "",
        ),
        stripeSubscriptionId: String(subscriptionId),
        status: "active",
        currentPeriodStart: periodStart || undefined,
        currentPeriodEnd: periodEnd || undefined,
        priceId: priceId || ws.subscription?.priceId || "",
        planAtStripe: plan,
        lastInvoiceId: String(invoice?.id || ""),
      };

      await ws.save();

      return res.json({ ok: true });
    }

    // =====================
    // invoice.payment_failed
    // =====================
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const subscriptionId = invoice?.subscription;

      if (!subscriptionId) return res.json({ ok: true });

      await Workspace.updateOne(
        { "subscription.stripeSubscriptionId": String(subscriptionId) },
        {
          $set: {
            "subscription.status": "past_due",
            "subscription.lastInvoiceId": String(invoice?.id || ""),
          },
        },
      );

      return res.json({ ok: true });
    }

    // ===========================
    // customer.subscription.deleted
    // ===========================
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const subscriptionId = sub?.id;

      if (!subscriptionId) return res.json({ ok: true });

      await Workspace.updateOne(
        { "subscription.stripeSubscriptionId": String(subscriptionId) },
        {
          $set: {
            "subscription.status": "canceled",
            "subscription.currentPeriodStart": sub?.current_period_start
              ? new Date(sub.current_period_start * 1000)
              : undefined,
            "subscription.currentPeriodEnd": sub?.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : undefined,
          },
        },
      );

      return res.json({ ok: true });
    }

    // ============================
    // customer.subscription.updated
    // ============================
    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      const subscriptionId = sub?.id;

      if (!subscriptionId) return res.json({ ok: true });

      const priceId = pickPriceIdFromSubscription(sub);
      const planFromPrice = planForPriceId(priceId);

      const patch = {
        "subscription.status": wsStatusFromStripeStatus(sub?.status),
        "subscription.currentPeriodStart": sub?.current_period_start
          ? new Date(sub.current_period_start * 1000)
          : undefined,
        "subscription.currentPeriodEnd": sub?.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : undefined,
        "subscription.priceId": priceId || "",
      };

      // atualiza plan/limit se price mudou (sem resetar cota; reset é no invoice.paid)
      if (planFromPrice) {
        const plan = normalizePlan(planFromPrice);
        patch.plan = plan;
        if (plan !== "enterprise") patch.pixMonthlyLimit = limitForPlan(plan);
        patch["subscription.planAtStripe"] = plan;
      }

      await Workspace.updateOne(
        { "subscription.stripeSubscriptionId": String(subscriptionId) },
        { $set: patch },
      );

      return res.json({ ok: true });
    }

    return res.json({ ok: true, ignored: true, type: event.type });
  } catch (e) {
    // webhook deve responder 2xx quando possível, mas aqui registramos erro
    return res
      .status(500)
      .json({
        ok: false,
        error: e?.message || "Erro ao processar webhook Stripe.",
      });
  }
});

export default r;
