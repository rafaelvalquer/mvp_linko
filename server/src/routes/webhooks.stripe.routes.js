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
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
}

function pickPriceIdFromSubscription(sub) {
  const item = sub?.items?.data?.[0];
  return item?.price?.id || "";
}

function pickInvoiceLine(invoice) {
  const line0 = invoice?.lines?.data?.[0];
  if (line0) return line0;
  return null;
}

function pickPriceIdFromInvoice(invoice) {
  const line = pickInvoiceLine(invoice);
  // versões diferentes do Stripe podem expor price em locais diferentes
  return line?.price?.id || line?.pricing?.price_details?.price || "";
}

function pickPlanFromInvoiceMetadata(invoice) {
  const line = pickInvoiceLine(invoice);
  return line?.metadata?.plan || "";
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

/**
 * Aplica o "invoice.paid" no workspace:
 * - encontra workspace por subscriptionId OU metadata.workspaceId OU stripeCustomerId
 * - seta status active
 * - grava stripeSubscriptionId e stripeCustomerId
 * - atualiza período e reseta quota no ciclo
 */
async function applyInvoicePaid(invoice, { stripe }) {
  const subscriptionId = invoice?.subscription
    ? String(invoice.subscription)
    : "";
  const customerId = invoice?.customer ? String(invoice.customer) : "";

  const workspaceId = pickWorkspaceIdFromInvoice(invoice);
  const priceIdFromInvoice = pickPriceIdFromInvoice(invoice);
  const planFromMeta = pickPlanFromInvoiceMetadata(invoice);

  const { start: periodStart, end: periodEnd } = pickPeriodFromInvoice(invoice);

  // plano preferencial: priceId -> plan; fallback: metadata.plan
  const planFromPrice = planForPriceId(priceIdFromInvoice);
  const plan = normalizePlan(planFromPrice || planFromMeta || "start");

  // ciclo por "day anchor" em SP (baseado no periodStart da invoice)
  const ck = cycleKeySP(periodStart || new Date());

  // encontra workspace mesmo se stripeSubscriptionId ainda não existe
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
    return { matched: 0, modified: 0 };
  }

  // garante priceId “verdadeiro” (se faltar no invoice, pega da subscription)
  let priceId = priceIdFromInvoice;
  let sub = null;

  if (!priceId && subscriptionId) {
    sub = await loadSubscription(subscriptionId);
    priceId = pickPriceIdFromSubscription(sub);
  }

  ws.plan = plan;
  if (plan !== "enterprise") ws.pixMonthlyLimit = limitForPlan(plan);

  // reset no ciclo pago
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

  return { matched: 1, modified: 1 };
}

/**
 * POST /api/webhooks/stripe
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
    return res.status(400).json({
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
    // ==============
    // checkout.session.completed
    // ==============
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
        stripeCustomerId: String(customerId || ""),
        stripeSubscriptionId: String(subscriptionId || ""),
        status: wsStatusFromStripeStatus(sub?.status),
        currentPeriodStart: periodStart || undefined,
        currentPeriodEnd: periodEnd || undefined,
        priceId: priceId || ws.subscription?.priceId || "",
        planAtStripe: plan,
      };

      await ws.save();

      console.log("[stripe] checkout.session.completed aplicado", {
        workspace: String(ws._id),
        subscriptionId: ws.subscription?.stripeSubscriptionId,
        status: ws.subscription?.status,
      });

      return res.json({ ok: true });
    }

    // ==========
    // invoice.paid (evento principal)
    // ==========
    if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      await applyInvoicePaid(invoice, { stripe });
      return res.json({ ok: true });
    }

    // =========================
    // payment_intent.succeeded (fallback)
    // =========================
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object;

      // Stripe está enviando `payment_details.order_reference` com a invoice "in_..."
      const invId = pi?.payment_details?.order_reference;
      if (typeof invId === "string" && invId.startsWith("in_")) {
        // Busca invoice completa e aplica como invoice.paid
        const invoice = await stripe.invoices.retrieve(invId, {
          expand: ["lines.data.price"],
        });

        if (invoice?.status === "paid") {
          await applyInvoicePaid(invoice, { stripe });
        }
      }

      return res.json({ ok: true, ignored: true, type: event.type });
    }

    // =====================
    // invoice.payment_failed
    // =====================
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const subscriptionId = invoice?.subscription;

      if (!subscriptionId) return res.json({ ok: true });

      // tenta por subscriptionId; fallback por customerId
      const q1 = {
        "subscription.stripeSubscriptionId": String(subscriptionId),
      };
      const q2 = {
        "subscription.stripeCustomerId": String(invoice?.customer || ""),
      };

      const result = await Workspace.updateOne(q1, {
        $set: {
          "subscription.status": "past_due",
          "subscription.lastInvoiceId": String(invoice?.id || ""),
        },
      });

      if ((result?.matchedCount || 0) === 0 && invoice?.customer) {
        await Workspace.updateOne(q2, {
          $set: {
            "subscription.status": "past_due",
            "subscription.lastInvoiceId": String(invoice?.id || ""),
          },
        });
      }

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
    return res.status(500).json({
      ok: false,
      error: e?.message || "Erro ao processar webhook Stripe.",
    });
  }
});

export default r;
