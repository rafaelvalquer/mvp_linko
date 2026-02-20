// server/src/services/stripeClient.js
import Stripe from "stripe";

let _stripe = null;

export function getStripe() {
  if (_stripe) return _stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY ausente.");

  _stripe = new Stripe(key, {
    apiVersion: "2024-06-20",
  });

  return _stripe;
}

export function priceIdForPlan(plan) {
  const p = String(plan || "")
    .trim()
    .toLowerCase();
  if (p === "start") return process.env.STRIPE_PRICE_START;
  if (p === "pro") return process.env.STRIPE_PRICE_PRO;
  if (p === "business") return process.env.STRIPE_PRICE_BUSINESS;
  return null;
}

export function planForPriceId(priceId) {
  const id = String(priceId || "").trim();
  if (!id) return null;

  if (id === process.env.STRIPE_PRICE_START) return "start";
  if (id === process.env.STRIPE_PRICE_PRO) return "pro";
  if (id === process.env.STRIPE_PRICE_BUSINESS) return "business";
  return null;
}

export async function createCheckoutSession({
  workspaceId,
  plan,
  stripeCustomerId,
  customerEmail,
}) {
  const stripe = getStripe();

  const appUrl = process.env.APP_URL || "http://localhost:5173";

  const price = priceIdForPlan(plan);
  if (!price) throw new Error(`PriceId não configurado para o plano: ${plan}`);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],

    success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/billing/cancel`,

    client_reference_id: String(workspaceId),

    ...(stripeCustomerId
      ? { customer: stripeCustomerId }
      : customerEmail
        ? { customer_email: customerEmail }
        : {}),

    subscription_data: {
      metadata: {
        workspaceId: String(workspaceId),
        plan: String(plan),
      },
    },

    metadata: {
      workspaceId: String(workspaceId),
      plan: String(plan),
    },
  });

  return session;
}

export async function retrieveCheckoutSession(sessionId) {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription", "customer"],
  });
}

export async function createPortalSession(stripeCustomerId, returnUrl) {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
  return session;
}
