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
  const item = sub?.items?.data?.[0];
  return item?.price?.id || item?.plan?.id || sub?.plan?.id || "";
}

function pickScheduleIdFromSubscription(sub) {
  if (!sub?.schedule) return "";
  return typeof sub.schedule === "string"
    ? sub.schedule
    : sub?.schedule?.id || "";
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

  return { start, end };
}

function isNewCycleInvoice(invoice) {
  const reason = String(invoice?.billing_reason || "").toLowerCase();
  // subscription_cycle: renovação
  // subscription_create: primeira cobrança
  return reason === "subscription_cycle" || reason === "subscription_create";
}

async function findWorkspace({ subscriptionId, customerId, workspaceId }) {
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

  return ws;
}

async function applyInvoicePaid(invoice) {
  const stripe = getStripe();

  const subscriptionId = invoice?.subscription
    ? String(invoice.subscription)
    : "";
  const customerId = invoice?.customer ? String(invoice.customer) : "";
  const workspaceId = pickWorkspaceIdFromInvoice(invoice);

  const ws = await findWorkspace({ subscriptionId, customerId, workspaceId });
  if (!ws) {
    console.log("[stripe] invoice.paid: workspace não encontrado", {
      subscriptionId,
      customerId,
      workspaceId,
    });
    return;
  }

  // Buscar subscription para obter o priceId final (invoice pode conter proration/linhas não finais)
  let sub = null;
  if (subscriptionId) {
    try {
      sub = await loadSubscription(subscriptionId);
    } catch {}
  }

  const wsSubStatus = wsStatusFromStripeStatus(
    sub?.status || ws?.subscription?.status,
  );
  const isActive = wsSubStatus === "active";

  const priceIdFromSub = pickPriceIdFromSubscription(sub);
  const priceIdFromInvoice = pickPriceIdFromInvoice(invoice);
  const priceId = priceIdFromSub || priceIdFromInvoice || "";

  const plan = normalizePlan(planForPriceId(priceId) || ws.plan || "start");
  const nextLimit = limitForPlan(plan);

  const currentLimit = Number.isFinite(Number(ws.pixMonthlyLimit))
    ? Number(ws.pixMonthlyLimit)
    : limitForPlan(ws.plan);

  const billingReason = String(invoice?.billing_reason || "").toLowerCase();
  const cycleInvoice = isNewCycleInvoice(invoice);

  // REGRAS:
  // - Upgrade: aplicar imediatamente quando a invoice do update for paga (subscription_update)
  // - Downgrade: NÃO aplicar em invoice de update (se houver). Aplicar só no próximo ciclo.
  // - Reset de uso: apenas no início de ciclo (subscription_cycle/subscription_create)
  const shouldApplyPlan = cycleInvoice || nextLimit > currentLimit;
  const shouldResetUsage = cycleInvoice || !ws?.pixUsage?.cycleKey;

  // Período preferencial do subscription; fallback para invoice line period
  const periodStart = sub?.current_period_start
    ? new Date(sub.current_period_start * 1000)
    : pickPeriodFromInvoice(invoice).start;
  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : pickPeriodFromInvoice(invoice).end;

  const ck = cycleKeySP(periodStart || new Date());

  if (shouldApplyPlan) {
    ws.plan = plan;
    ws.planStatus = "active";

    // Se assinatura não está ativa, bloqueia Pix
    ws.pixMonthlyLimit = isActive ? nextLimit : 0;

    ws.pixUsage = shouldResetUsage
      ? { cycleKey: ck, used: 0 }
      : {
          cycleKey: ws?.pixUsage?.cycleKey || ck,
          used: Number.isFinite(Number(ws?.pixUsage?.used))
            ? Number(ws.pixUsage.used)
            : 0,
        };

    // limpamos qualquer pending downgrade quando efetivamos um plano
    ws.subscription = {
      ...(ws.subscription?.toObject?.() || ws.subscription || {}),
      provider: "stripe",
      stripeCustomerId: customerId || ws.subscription?.stripeCustomerId || "",
      stripeSubscriptionId:
        subscriptionId || ws.subscription?.stripeSubscriptionId || "",
      status: wsSubStatus || "active",
      currentPeriodStart:
        periodStart || ws.subscription?.currentPeriodStart || undefined,
      currentPeriodEnd:
        periodEnd || ws.subscription?.currentPeriodEnd || undefined,
      priceId: priceId || ws.subscription?.priceId || "",
      planAtStripe: plan,
      pendingPriceId: "",
      pendingPlan: "",
      pendingEffectiveAt: null,
      scheduleId:
        pickScheduleIdFromSubscription(sub) ||
        ws.subscription?.scheduleId ||
        "",
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
      resetUsage: shouldResetUsage,
      billingReason,
    });

    return;
  }

  // Downgrade em invoice de update: apenas registra o plano no Stripe e mantém acesso até o fim do ciclo.
  // (O downgrade será aplicado no próximo invoice.paid de subscription_cycle.)
  ws.subscription = {
    ...(ws.subscription?.toObject?.() || ws.subscription || {}),
    provider: "stripe",
    stripeCustomerId: customerId || ws.subscription?.stripeCustomerId || "",
    stripeSubscriptionId:
      subscriptionId || ws.subscription?.stripeSubscriptionId || "",
    status: wsSubStatus || ws.subscription?.status || "active",
    currentPeriodStart:
      periodStart || ws.subscription?.currentPeriodStart || undefined,
    currentPeriodEnd:
      periodEnd || ws.subscription?.currentPeriodEnd || undefined,
    priceId: priceId || ws.subscription?.priceId || "",
    planAtStripe: plan,
    pendingPriceId: priceId,
    pendingPlan: plan,
    pendingEffectiveAt: periodEnd || ws.subscription?.currentPeriodEnd || null,
    scheduleId:
      pickScheduleIdFromSubscription(sub) || ws.subscription?.scheduleId || "",
    lastInvoiceId: String(invoice?.id || ""),
  };

  await ws.save();

  console.log("[stripe] invoice.paid (downgrade adiado)", {
    workspace: String(ws._id),
    subscriptionId,
    currentPlan: ws.plan,
    pendingPlan: plan,
    effectiveAt: ws.subscription?.pendingEffectiveAt,
    billingReason,
  });
}

async function applySubscriptionUpdated(sub) {
  const subscriptionId = String(sub?.id || "");
  if (!subscriptionId) return;

  const customerId =
    typeof sub?.customer === "string" ? sub.customer : sub?.customer?.id || "";
  const workspaceId = String(sub?.metadata?.workspaceId || "").trim();

  const ws = await findWorkspace({ subscriptionId, customerId, workspaceId });
  if (!ws) {
    console.log(
      "[stripe] customer.subscription.updated: workspace não encontrado",
      {
        subscriptionId,
        customerId,
        workspaceId,
      },
    );
    return;
  }

  const priceId = pickPriceIdFromSubscription(sub);
  const planFromPrice = normalizePlan(
    planForPriceId(priceId) || ws.plan || "start",
  );

  const wsSubStatus = wsStatusFromStripeStatus(sub?.status);
  const active = wsSubStatus === "active";

  const periodStart = sub?.current_period_start
    ? new Date(sub.current_period_start * 1000)
    : null;
  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : null;

  const scheduleId = pickScheduleIdFromSubscription(sub);

  const currentLimit = Number.isFinite(Number(ws.pixMonthlyLimit))
    ? Number(ws.pixMonthlyLimit)
    : limitForPlan(ws.plan);

  const nextLimit = limitForPlan(planFromPrice);

  // Regra solicitada:
  // - downgrade: efetivar apenas no próximo ciclo (não reduz agora)
  // - upgrade: efetivar apenas quando invoice.paid do update ocorrer (não aumenta aqui)
  const isDowngrade = Number.isFinite(nextLimit) && nextLimit < currentLimit;

  const patch = {
    "subscription.status": wsSubStatus,
    ...(customerId && customerId.startsWith("cus_")
      ? { "subscription.stripeCustomerId": customerId }
      : {}),
    "subscription.currentPeriodStart": periodStart || undefined,
    "subscription.currentPeriodEnd": periodEnd || undefined,
    "subscription.priceId": priceId || "",
    "subscription.planAtStripe": planFromPrice,
    "subscription.scheduleId": scheduleId || "",
  };

  if (!active) {
    patch.pixMonthlyLimit = 0;
  }

  if (isDowngrade) {
    patch["subscription.pendingPriceId"] = priceId || "";
    patch["subscription.pendingPlan"] = planFromPrice;
    patch["subscription.pendingEffectiveAt"] =
      periodEnd || ws?.subscription?.currentPeriodEnd || null;
  } else {
    // se não é downgrade, limpa pendências
    patch["subscription.pendingPriceId"] = "";
    patch["subscription.pendingPlan"] = "";
    patch["subscription.pendingEffectiveAt"] = null;
  }

  await Workspace.updateOne({ _id: ws._id }, { $set: patch });
}

async function markSubscriptionProblem({
  subscriptionId,
  customerId,
  status,
  invoiceId,
}) {
  const patch = {
    "subscription.status": status,
    planStatus: "active",
    pixMonthlyLimit: 0,
    ...(invoiceId ? { "subscription.lastInvoiceId": String(invoiceId) } : {}),
  };

  let result = null;
  if (subscriptionId) {
    result = await Workspace.updateOne(
      { "subscription.stripeSubscriptionId": subscriptionId },
      { $set: patch },
    );
  }

  if ((!result || result.matchedCount === 0) && customerId) {
    await Workspace.updateOne(
      { "subscription.stripeCustomerId": customerId },
      { $set: patch },
    );
  }
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
    return res.status(400).json({
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
    return res.status(500).json({
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
        pendingPriceId: "",
        pendingPlan: "",
        pendingEffectiveAt: null,
        scheduleId: pickScheduleIdFromSubscription(sub) || "",
      };

      await ws.save();
      return res.json({ ok: true });
    }

    // invoice.paid
    if (event.type === "invoice.paid") {
      await applyInvoicePaid(event.data.object);
      return res.json({ ok: true });
    }

    // invoice.payment_action_required (SCA/3DS) => bloqueia Pix até resolver
    if (event.type === "invoice.payment_action_required") {
      const invoice = event.data.object;
      const subscriptionId = invoice?.subscription
        ? String(invoice.subscription)
        : "";
      const customerId = invoice?.customer ? String(invoice.customer) : "";
      await markSubscriptionProblem({
        subscriptionId,
        customerId,
        status: "past_due",
        invoiceId: invoice?.id,
      });
      return res.json({ ok: true });
    }

    // invoice.payment_failed
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const subscriptionId = invoice?.subscription
        ? String(invoice.subscription)
        : "";
      const customerId = invoice?.customer ? String(invoice.customer) : "";

      await markSubscriptionProblem({
        subscriptionId,
        customerId,
        status: "past_due",
        invoiceId: invoice?.id,
      });

      return res.json({ ok: true });
    }

    // subscription.deleted
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const subscriptionId = String(sub?.id || "");
      if (!subscriptionId) return res.json({ ok: true });

      await Workspace.updateOne(
        { "subscription.stripeSubscriptionId": subscriptionId },
        {
          $set: {
            "subscription.status": "canceled",
            planStatus: "active",
            pixMonthlyLimit: 0,
            "subscription.pendingPriceId": "",
            "subscription.pendingPlan": "",
            "subscription.pendingEffectiveAt": null,
          },
        },
      );

      return res.json({ ok: true });
    }

    // subscription.updated
    if (event.type === "customer.subscription.updated") {
      await applySubscriptionUpdated(event.data.object);
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

    return res.json({ ok: true, ignored: true, type: event.type });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "Erro ao processar webhook Stripe.",
    });
  }
});

export default r;
