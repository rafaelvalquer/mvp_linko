import { Workspace } from "../../models/Workspace.js";
import { normalizeWhatsAppPhoneDigits } from "../../utils/phone.js";
import { canUseWhatsAppAiOfferCreation } from "../../utils/planFeatures.js";
import { createOfferFromPayload } from "../offers/createOffer.service.js";
import { buildOfferPublicUrl } from "../publicUrl.service.js";
import { queueOrSendWhatsApp } from "../whatsappOutbox.service.js";
import { normalizeResolvedItems } from "./whatsappAi.schemas.js";

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

function buildCustomerOfferMessage({ customerName, items = [], publicUrl }) {
  const name = firstName(customerName);
  const greeting = name ? `Ola, ${name}!` : "Ola!";
  const itemLines = items.length
    ? items.map((item) => {
        const label = String(item?.description || "").trim() || "Item";
        const qty = Number(item?.qty || 0);
        return `- ${label} (${qty}x)`;
      })
    : ["- Item"];

  return [
    greeting,
    "",
    "Sua proposta da Luminor Pay esta pronta.",
    "Itens:",
    ...itemLines,
    "Acesse o link abaixo para visualizar e concluir:",
    publicUrl,
  ].join("\n");
}

export function buildOfferPayloadFromSession(session) {
  const resolved = session?.resolved || {};
  const customerName = String(
    resolved.customerName || resolved.customer_name_raw || "",
  ).trim();
  const items = normalizeResolvedItems(resolved).map((item) => {
    const description = String(
      item.productName || item.product_name_raw || "",
    ).trim();
    const qty = Number(item.quantity || 0);
    const unitPriceCents = Number(item.unit_price_cents || 0);

    return {
      description,
      qty,
      unitPriceCents,
      lineTotalCents: qty * unitPriceCents,
    };
  });
  const totalCents = items.reduce(
    (sum, item) => sum + Number(item.lineTotalCents || 0),
    0,
  );

  return {
    customerId: resolved.customerId || null,
    customerName,
    customerWhatsApp: resolved.destination_phone_n11 || "",
    offerType: "product",
    items,
    amountCents: totalCents,
    subtotalCents: totalCents,
    totalCents,
    originMeta: {
      source: "whatsapp_ai",
      sessionId: String(session?._id || ""),
      requesterPhoneDigits: String(session?.requesterPhoneDigits || ""),
    },
  };
}

export async function createOfferAndDispatchToCustomer({ session, user }) {
  const workspace = await Workspace.findById(user.workspaceId).select("plan").lean();
  if (!canUseWhatsAppAiOfferCreation(workspace?.plan || "start")) {
    const err = new Error(
      "Plano nao permite criar propostas pelo agente de WhatsApp.",
    );
    err.code = "PLAN_NOT_ALLOWED";
    throw err;
  }

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
  const customerPhone = normalizeWhatsAppPhoneDigits(
    session?.resolved?.destination_phone_n11 || "",
  );
  const offerItems = Array.isArray(offer?.items) ? offer.items : [];

  const dispatch = await queueOrSendWhatsApp({
    workspaceId: user.workspaceId,
    to: customerPhone,
    message: buildCustomerOfferMessage({
      customerName,
      items: offerItems,
      publicUrl,
    }),
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
