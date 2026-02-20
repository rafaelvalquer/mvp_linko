// server/src/routes/webhooks.stripe.routes.js
import { Router } from "express";
import { getStripe, planForPriceId } from "../services/stripeClient.js";
import { StripeEvent } from "../models/StripeEvent.js";
import { Workspace } from "../models/Workspace.js";
import { PLAN_LIMITS, normalizePlan, cycleKeySP } from "../utils/pixQuota.js";

const r = Router();

function wsStatusFromStripeStatus(stripeStatus) {
  const s = String(stripeStatus || "").toLowerCase();
  if (s === "active" || s === "trialing") return "active";
  if (s === "past_due" || s === "unpaid") return "past_due";
  if (s === "canceled" || s === "incomplete_expired") return "canceled";
  return "inactive";
}

function limitForPlan(plan) {
  const p = normalizePlan(plan);
  if (p === "enterprise") return 0;
  return PLAN_LIMITS[p] ?? PLAN_LIMITS.start;
}

async function loadSubscription(subscriptionId) {
  const stripe = getStripe();
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
}

function pickPriceIdFromSubscription(sub) {
  return sub?.items?.data?.[0]?.price?.id || "";
}

function pickInvoiceLine(invoice) {
  return invoice?.lines?.data?.[0] || null;
}

function pickWorkspaceIdFromInvoice(invoice) {
  const line = pickInvoiceLine(invoice);
  return (
    line?.metadata?.workspaceId ||
    invoice?.parent?.subscription_details?.metadata?.workspaceId ||
    invoice?.subscription_details?.metadata?.workspaceId ||
    ""
  );
}

function pickPlanFromInvoiceMeta(invoice) {
  const line = pickInvoiceLine(invoice);
  return line?.metadata?.plan || "";
}

function pickPriceIdFromInvoice(invoice) {
  const line = pickInvoiceLine(invoice);
  return line?.price?.id || line?.pricing?.price_details?.price || "";
}

function pickPeriodFromInvoice(invoice) {
  const line = pickInvoiceLine(invoice);
  const startSec = line?.period?.start;
  const endSec = line?.period?.end;
  const start = Number.isFinite(Number(startSec))
    ? new Date(Number(startSec) * 1000)
    : null;
  const end = Number.isFinite(Number(endSec))
    ? new Date(Number(endSec) * 1000)
    : null;
  return { start, end, startSec, endSec };
}

async function applyInvoicePaid(invoice) {
  const stripe = getStripe();

  const subscriptionId = invoice?.subscription
    ? String(invoice.subscription)
    : "";
  const customerId = invoice?.customer ? String(invoice.customer) : "";

  const workspaceId = pickWorkspaceIdFromInvoice(invoice);
  const priceId = pickPriceIdFromInvoice(invoice);
  const planFromMeta = pickPlanFromInvoiceMeta(invoice);

  const plan = normalizePlan(
    planForPriceId(priceId) || planFromMeta || "start",
  );
  const { start: periodStart, end: periodEnd } = pickPeriodFromInvoice(invoice);

  const ck = cycleKeySP(periodStart || new Date());

  let ws = null;

  if (subscriptionId) {
    ws = await Workspace.findOne({
      "subscription.stripeSubscriptionId": subscriptionId,
    });
  }

  if (!ws && workspaceId) {
    ws = await Workspace.findById(workspaceId);
  }

  if (!ws && customerId) {
    ws = await Workspace.findOne({
      "subscription.stripeCustomerId": customerId,
    });
  }

  if (!ws) {
    console.log("[stripe] invoice.paid: workspace não encontrado", {
      subscriptionId,
      customerId,
      workspaceId,
    });
    return;
  }

  ws.plan = plan;
  ws.planStatus = "active";
  ws.pixMonthlyLimit = limitForPlan(plan);
  ws.pixUsage = { cycleKey: ck, used: 0 };

  ws.subscription = {
    ...(ws.subscription?.toObject?.() || ws.subscription || {}),
    provider: "stripe",
    stripeCustomerId: customerId || ws.subscription?.stripeCustomerId || "",
    stripeSubscriptionId:
      subscriptionId || ws.subscription?.stripeSubscriptionId || "",
    status: "active",
    currentPeriodStart:
      periodStart || ws.subscription?.currentPeriodStart || undefined,
    currentPeriodEnd:
      periodEnd || ws.subscription?.currentPeriodEnd || undefined,
    priceId: priceId || ws.subscription?.priceId || "",
    planAtStripe: plan,
    lastInvoiceId: String(invoice?.id || ""),
  };

  await ws.save();

  console.log("[stripe] invoice.paid aplicado", {
    workspace: String(ws._id),
    subscriptionId: ws.subscription?.stripeSubscriptionId,
    status: ws.subscription?.status,
    plan: ws.plan,
    limit: ws.pixMonthlyLimit,
    cycleKey: ws.pixUsage?.cycleKey,
  });
}

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
  if (!req.rawBody) {
    return res.status(400).json({
      ok: false,
      error: "rawBody ausente (ver app.js express.json verify).",
    });
  }

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

  // idempotência
  try {
    await StripeEvent.create({
      provider: "stripe",
      eventId: event.id,
      type: event.type,
      created: event.created,
      payload: undefined,
    });
  } catch (e) {
    if (e?.code === 11000) return res.json({ ok: true, duplicated: true });
    return res
      .status(500)
      .json({
        ok: false,
        error: e?.message || "Falha ao registrar StripeEvent.",
      });
  }

  try {
    // checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session?.mode !== "subscription") return res.json({ ok: true });

      const workspaceId =
        session?.client_reference_id || session?.metadata?.workspaceId || "";
      const subscriptionId = session?.subscription;
      const customerId = session?.customer;

      if (!workspaceId || !subscriptionId) return res.json({ ok: true });

      const ws = await Workspace.findById(workspaceId);
      if (!ws) return res.json({ ok: true });

      const sub = await loadSubscription(subscriptionId);
      const priceId = pickPriceIdFromSubscription(sub);

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

      const status = wsStatusFromStripeStatus(sub?.status);
      const isActive = status === "active";

      ws.plan = plan;
      ws.planStatus = isActive ? "active" : "pending";
      ws.pixMonthlyLimit = isActive ? limitForPlan(plan) : 0;
      ws.pixUsage = { cycleKey: ck, used: 0 };

      ws.subscription = {
        ...(ws.subscription?.toObject?.() || ws.subscription || {}),
        provider: "stripe",
        stripeCustomerId: String(customerId || ""),
        stripeSubscriptionId: String(subscriptionId || ""),
        status,
        currentPeriodStart: periodStart || undefined,
        currentPeriodEnd: periodEnd || undefined,
        priceId: priceId || ws.subscription?.priceId || "",
        planAtStripe: plan,
      };

      await ws.save();

      return res.json({ ok: true });
    }

    // invoice.paid
    if (event.type === "invoice.paid") {
      await applyInvoicePaid(event.data.object);
      return res.json({ ok: true });
    }

    // fallback: payment_intent.succeeded -> invoice retrieve (order_reference)
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object;
      const invId = pi?.payment_details?.order_reference;

      if (typeof invId === "string" && invId.startsWith("in_")) {
        const invoice = await stripe.invoices.retrieve(invId, {
          expand: ["lines.data.price"],
        });
        if (invoice?.status === "paid") await applyInvoicePaid(invoice);
      }

      return res.json({ ok: true, ignored: true, type: event.type });
    }

    // invoice.payment_failed
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const subscriptionId = invoice?.subscription
        ? String(invoice.subscription)
        : "";
      const customerId = invoice?.customer ? String(invoice.customer) : "";

      let result = null;
      if (subscriptionId) {
        result = await Workspace.updateOne(
          { "subscription.stripeSubscriptionId": subscriptionId },
          { $set: { "subscription.status": "past_due", planStatus: "active" } },
        );
      }
      if ((!result || result.matchedCount === 0) && customerId) {
        await Workspace.updateOne(
          { "subscription.stripeCustomerId": customerId },
          { $set: { "subscription.status": "past_due", planStatus: "active" } },
        );
      }

      return res.json({ ok: true });
    }

    // subscription.deleted
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const subscriptionId = String(sub?.id || "");
      if (!subscriptionId) return res.json({ ok: true });

      await Workspace.updateOne(
        { "subscription.stripeSubscriptionId": subscriptionId },
        { $set: { "subscription.status": "canceled", planStatus: "active" } },
      );

      return res.json({ ok: true });
    }

    // subscription.updated
    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      const subscriptionId = String(sub?.id || "");
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

      if (planFromPrice) {
        const plan = normalizePlan(planFromPrice);
        patch.plan = plan;
        patch["subscription.planAtStripe"] = plan;
      }

      await Workspace.updateOne(
        { "subscription.stripeSubscriptionId": subscriptionId },
        { $set: patch },
      );

      return res.json({ ok: true });
    }

    return res.json({ ok: true, ignored: true, type: event.type });
  } catch (e) {
    return res
      .status(500)
      .json({
        ok: false,
        error: e?.message || "Erro ao processar webhook Stripe.",
      });
  }
});

export default r;
