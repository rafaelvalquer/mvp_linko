import Stripe from "stripe";

let _stripe = null;

export function getStripe() {
  if (_stripe) return _stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY ausente.");

  _stripe = new Stripe(key, { apiVersion: "2024-06-20" });
  return _stripe;
}

export function getFrontendUrl() {
  const url = String(process.env.FRONTEND_URL || "").trim();

  if (!url) {
    throw new Error("FRONTEND_URL ausente (ex.: https://app.seudominio.com).");
  }

  // em produção, não pode ser localhost
  if (
    (process.env.NODE_ENV || "").toLowerCase() === "production" &&
    /localhost|127\.0\.0\.1/i.test(url)
  ) {
    throw new Error(
      "FRONTEND_URL inválido em produção (não pode ser localhost).",
    );
  }

  return url.replace(/\/+$/, "");
}

export function priceIdForPlan(plan) {
  const p = String(plan || "").toLowerCase();
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

function assertIsPriceId(priceId, envName) {
  const v = String(priceId || "").trim();
  if (!/^price_[A-Za-z0-9]+$/.test(v)) {
    throw new Error(
      `${envName} inválido: "${v}". O Stripe Checkout precisa de Price ID (price_...), não Product ID (prod_...) nem valor numérico.`,
    );
  }
}

export async function createCheckoutSession({
  workspaceId,
  plan,
  stripeCustomerId,
  customerEmail,
}) {
  const stripe = getStripe();
  const frontendUrl = getFrontendUrl();

  const priceId = priceIdForPlan(plan);
  if (!priceId) throw new Error(`PriceId do plano não configurado: ${plan}`);

  const envName =
    plan === "start"
      ? "STRIPE_PRICE_START"
      : plan === "pro"
        ? "STRIPE_PRICE_PRO"
        : "STRIPE_PRICE_BUSINESS";

  assertIsPriceId(priceId, envName);

  return stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${frontendUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/billing/cancel`,
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
    metadata: { workspaceId: String(workspaceId), plan: String(plan) },
  });
}

export async function retrieveCheckoutSession(sessionId) {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"], // ✅ não expandir "customer"
  });
}

export async function createPortalSession(stripeCustomerId, returnUrl) {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
}
