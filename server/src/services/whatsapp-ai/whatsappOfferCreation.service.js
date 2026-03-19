import { Workspace } from "../../models/Workspace.js";
import { normalizeWhatsAppPhoneDigits } from "../../utils/phone.js";
import { createOfferFromPayload } from "../offers/createOffer.service.js";
import { buildOfferPublicUrl } from "../publicUrl.service.js";
import { queueOrSendWhatsApp } from "../whatsappOutbox.service.js";

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

function buildCustomerOfferMessage({ customerName, productName, publicUrl }) {
  const name = firstName(customerName);
  const greeting = name ? `Ola, ${name}!` : "Ola!";

  return [
    greeting,
    "",
    "Sua proposta da Luminor Pay esta pronta.",
    `Item: ${productName}`,
    "Acesse o link abaixo para visualizar e concluir:",
    publicUrl,
  ].join("\n");
}

function buildOfferPayloadFromSession(session) {
  const resolved = session?.resolved || {};
  const customerName = String(
    resolved.customerName || resolved.customer_name_raw || "",
  ).trim();
  const productName = String(
    resolved.productName || resolved.product_name_raw || "",
  ).trim();
  const quantity = Number(resolved.quantity || 0);
  const unitPriceCents = Number(resolved.unit_price_cents || 0);
  const lineTotalCents = quantity * unitPriceCents;

  return {
    customerId: resolved.customerId || null,
    customerName,
    customerWhatsApp: resolved.destination_phone_n11 || "",
    offerType: "product",
    items: [
      {
        description: productName,
        qty: quantity,
        unitPriceCents,
        lineTotalCents,
      },
    ],
    amountCents: lineTotalCents,
    subtotalCents: lineTotalCents,
    totalCents: lineTotalCents,
    originMeta: {
      source: "whatsapp_ai",
      sessionId: String(session?._id || ""),
      requesterPhoneDigits: String(session?.requesterPhoneDigits || ""),
    },
  };
}

export async function createOfferAndDispatchToCustomer({ session, user }) {
  const workspace = await Workspace.findById(user.workspaceId).select("plan").lean();
  const offer = await createOfferFromPayload({
    tenantId: user.workspaceId,
    userId: user._id,
    workspacePlan: workspace?.plan || "start",
    body: buildOfferPayloadFromSession(session),
  });

  const publicUrl = buildOfferPublicUrl(offer);
  const customerName = String(
    session?.resolved?.customerName || session?.resolved?.customer_name_raw || "",
  ).trim();
  const productName = String(
    session?.resolved?.productName || session?.resolved?.product_name_raw || "",
  ).trim();
  const customerPhone = normalizeWhatsAppPhoneDigits(
    session?.resolved?.destination_phone_n11 || "",
  );

  const dispatch = await queueOrSendWhatsApp({
    workspaceId: user.workspaceId,
    to: customerPhone,
    message: buildCustomerOfferMessage({ customerName, productName, publicUrl }),
    dedupeKey: `whatsapp-command-session:${session?._id}:customer-offer`,
    sourceType: "whatsapp_command_session",
    sourceId: session?._id || null,
    meta: {
      direction: "customer_offer",
      offerId: offer?._id || null,
      publicUrl,
      requesterPhoneDigits: session?.requesterPhoneDigits || "",
    },
  });

  return {
    offer,
    publicUrl,
    dispatch,
  };
}
