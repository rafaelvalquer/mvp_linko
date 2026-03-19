import assert from "node:assert/strict";

import { PendingRegistration } from "../src/models/PendingRegistration.js";
import {
  normalizeDestinationPhoneN11,
  normalizeUserWhatsAppPhone,
  normalizeWhatsAppPhoneDigits,
} from "../src/utils/phone.js";
import {
  listMissingMandatoryFields,
  mergeResolvedDraft,
  parseDirectReplyValue,
  parseMoneyToCents,
  parseStructuredExtraction,
  normalizeResolvedItems,
} from "../src/services/whatsapp-ai/whatsappAi.schemas.js";
import { buildConfirmationSummary } from "../src/services/whatsapp-ai/whatsappQuestionBuilder.service.js";
import { buildOfferPayloadFromSession } from "../src/services/whatsapp-ai/whatsappOfferCreation.service.js";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  getNotificationFeatureAvailability,
  mergeNotificationSettings,
} from "../src/services/notificationSettings.js";
import { getPlanFeatureMatrix } from "../src/utils/planFeatures.js";

process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/test";
const { buildUserPayload, validateRegisterPayload } = await import(
  "../src/routes/auth.routes.js"
);
const { validateInboundPayload } = await import(
  "../src/routes/whatsapp-ai.routes.js"
);

let failures = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

await check("normalizeWhatsAppPhoneDigits canonicalizes BR numbers", () => {
  assert.equal(normalizeWhatsAppPhoneDigits("11999998888"), "5511999998888");
  assert.equal(
    normalizeWhatsAppPhoneDigits("+55 (11) 99999-8888"),
    "5511999998888",
  );
});

await check("normalizeDestinationPhoneN11 keeps only national 11 digits", () => {
  assert.equal(normalizeDestinationPhoneN11("11999998888"), "11999998888");
  assert.equal(normalizeDestinationPhoneN11("+55 11 99999-8888"), "11999998888");
  assert.equal(normalizeDestinationPhoneN11("1133334444"), "");
});

await check("normalizeUserWhatsAppPhone validates and clears values", () => {
  assert.deepEqual(normalizeUserWhatsAppPhone(""), {
    whatsappPhone: "",
    whatsappPhoneDigits: "",
  });
  assert.deepEqual(normalizeUserWhatsAppPhone("11 99999-8888"), {
    whatsappPhone: "11 99999-8888",
    whatsappPhoneDigits: "5511999998888",
  });
  assert.throws(() => normalizeUserWhatsAppPhone("123"), /WhatsApp valido/i);
});

await check("validateRegisterPayload accepts optional WhatsApp", () => {
  assert.deepEqual(
    validateRegisterPayload({
      name: "Rafael",
      email: "rafael@example.com",
      password: "Senha@123",
      workspaceName: "Luminor",
    }),
    {
      name: "Rafael",
      email: "rafael@example.com",
      password: "Senha@123",
      workspaceName: "Luminor",
      plan: "start",
      whatsappPhone: "",
      whatsappPhoneDigits: "",
    },
  );

  assert.deepEqual(
    validateRegisterPayload({
      name: "Rafael",
      email: "rafael@example.com",
      password: "Senha@123",
      workspaceName: "Luminor",
      whatsappPhone: "11 99999-8888",
    }),
    {
      name: "Rafael",
      email: "rafael@example.com",
      password: "Senha@123",
      workspaceName: "Luminor",
      plan: "start",
      whatsappPhone: "11 99999-8888",
      whatsappPhoneDigits: "5511999998888",
    },
  );
});

await check("validateRegisterPayload rejects invalid WhatsApp", () => {
  assert.throws(
    () =>
      validateRegisterPayload({
        name: "Rafael",
        email: "rafael@example.com",
        password: "Senha@123",
        workspaceName: "Luminor",
        whatsappPhone: "123",
      }),
    /WhatsApp valido/i,
  );
});

await check("PendingRegistration normalizes WhatsApp on validation", async () => {
  const pending = new PendingRegistration({
    name: "Rafael",
    email: "rafael@example.com",
    passwordHash: "hash",
    workspaceName: "Luminor",
    whatsappPhone: "+55 (11) 99999-8888",
    code: "1234",
    expiresAt: new Date(Date.now() + 60_000),
    lastSentAt: new Date(),
  });

  await pending.validate();
  assert.equal(pending.whatsappPhone, "+55 (11) 99999-8888");
  assert.equal(pending.whatsappPhoneDigits, "5511999998888");
});

await check("buildUserPayload exposes whatsappPhone", () => {
  assert.deepEqual(
    buildUserPayload({
      _id: "user-1",
      name: "Rafael",
      email: "rafael@example.com",
      workspaceId: "workspace-1",
      role: "owner",
      status: "active",
      whatsNewLastSeenAt: null,
      whatsappPhone: "11 99999-8888",
    }),
    {
      _id: "user-1",
      name: "Rafael",
      email: "rafael@example.com",
      workspaceId: "workspace-1",
      role: "owner",
      status: "active",
      isMasterAdmin: false,
      whatsNewLastSeenAt: null,
      whatsappPhone: "11 99999-8888",
    },
  );
});

await check("notification settings include offer cancelled toggle", () => {
  const merged = mergeNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS, {
    whatsapp: {
      offerCancelledEnabled: true,
    },
  });

  assert.equal(
    DEFAULT_NOTIFICATION_SETTINGS.whatsapp.offerCancelledEnabled,
    false,
  );
  assert.equal(merged.whatsapp.offerCancelledEnabled, true);
});

await check("plan matrix enables offer cancelled whatsapp on Pro+", () => {
  assert.equal(getPlanFeatureMatrix("start").whatsappOfferCancelled, false);
  assert.equal(getPlanFeatureMatrix("pro").whatsappOfferCancelled, true);
});

await check("feature availability evaluates offer cancelled toggle", () => {
  const availability = getNotificationFeatureAvailability({
    settings: mergeNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS, {
      whatsapp: {
        masterEnabled: true,
        offerCancelledEnabled: true,
      },
    }),
    capabilities: {
      environment: {
        whatsapp: { available: true, reason: "", reasons: [] },
      },
      plan: {
        value: "pro",
        features: {
          whatsappOfferCancelled: true,
        },
      },
    },
  });

  assert.equal(availability.whatsappOfferCancelled.available, true);
});

await check("parseStructuredExtraction normalizes AI output", () => {
  const parsed = parseStructuredExtraction({
    intent: "create_offer_send_whatsapp",
    customer_name_raw: "Joao",
    destination_phone_n11: "+55 (11) 99999-8888",
    product_name_raw: "Televisao",
    quantity: 2,
    unit_price_cents: 10000,
    items: [
      {
        product_name_raw: "Televisao",
        quantity: 2,
        unit_price_cents: 10000,
      },
    ],
    send_via_whatsapp: true,
    source_text: "texto final",
  });

  assert.deepEqual(parsed, {
    intent: "create_offer_send_whatsapp",
    customer_name_raw: "Joao",
    destination_phone_n11: "11999998888",
    product_name_raw: "Televisao",
    quantity: 2,
    unit_price_cents: 10000,
    items: [
      {
        product_name_raw: "Televisao",
        quantity: 2,
        unit_price_cents: 10000,
      },
    ],
    send_via_whatsapp: true,
    source_text: "texto final",
  });
});

await check("parseStructuredExtraction keeps all extracted items", () => {
  const parsed = parseStructuredExtraction({
    intent: "create_offer_send_whatsapp",
    customer_name_raw: "Joao",
    destination_phone_n11: "11999998888",
    product_name_raw: "Televisao",
    quantity: 1,
    unit_price_cents: 5000,
    items: [
      {
        product_name_raw: "Televisao",
        quantity: 1,
        unit_price_cents: 5000,
      },
      {
        product_name_raw: "Suporte",
        quantity: 2,
        unit_price_cents: 3000,
      },
    ],
    send_via_whatsapp: true,
    source_text: "texto final",
  });

  assert.equal(parsed.items.length, 2);
  assert.deepEqual(parsed.items[1], {
    product_name_raw: "Suporte",
    quantity: 2,
    unit_price_cents: 3000,
  });
});

await check("mergeResolvedDraft resets linked entities when raw values change", () => {
  const next = mergeResolvedDraft(
    {
      customer_name_raw: "Joao",
      customerId: "abc",
      customerName: "Joao Silva",
      product_name_raw: "TV 32",
      productId: "def",
      productName: "TV 32 Polegadas",
    },
    {
      customer_name_raw: "Maria",
      product_name_raw: "Notebook",
    },
  );

  assert.equal(next.customerId, null);
  assert.equal(next.customerName, "");
  assert.equal(next.productId, null);
  assert.equal(next.productName, "");
});

await check("mergeResolvedDraft updates indexed item replies", () => {
  const next = mergeResolvedDraft(
    {
      customer_name_raw: "Joao",
      destination_phone_n11: "11999998888",
      items: [
        {
          product_name_raw: "Televisao",
          quantity: 1,
          unit_price_cents: 5000,
        },
        {
          product_name_raw: "Suporte",
          quantity: null,
          unit_price_cents: 3000,
        },
      ],
    },
    parseDirectReplyValue("items.1.quantity", "2"),
  );

  assert.deepEqual(normalizeResolvedItems(next)[1], {
    product_name_raw: "Suporte",
    quantity: 2,
    unit_price_cents: 3000,
    productId: null,
    productName: "",
    productLookupQuery: "",
    productLookupMiss: false,
  });
});

await check("listMissingMandatoryFields reports unresolved inputs", () => {
  assert.deepEqual(
    listMissingMandatoryFields({
      customer_name_raw: "Joao",
      destination_phone_n11: "",
      items: [
        {
          product_name_raw: "",
          quantity: null,
          unit_price_cents: 1000,
        },
        {
          product_name_raw: "Suporte",
          quantity: null,
          unit_price_cents: null,
        },
      ],
    }),
    [
      "items.0.product_name_raw",
      "items.0.quantity",
      "items.1.quantity",
      "items.1.unit_price_cents",
      "destination_phone_n11",
    ],
  );
});

await check("parseDirectReplyValue handles quantity, money and phone", () => {
  assert.deepEqual(parseDirectReplyValue("quantity", "2"), {
    quantity: 2,
    source_text: "2",
  });
  assert.deepEqual(parseDirectReplyValue("destination_phone_n11", "11 99999-8888"), {
    destination_phone_n11: "11999998888",
    source_text: "11 99999-8888",
  });
  assert.deepEqual(parseDirectReplyValue("unit_price_cents", "R$ 100,50"), {
    unit_price_cents: 10050,
    source_text: "R$ 100,50",
  });
  assert.deepEqual(parseDirectReplyValue("items.1.quantity", "3"), {
    items: [
      ,
      {
        quantity: 3,
      },
    ],
    source_text: "3",
  });
});

await check("parseMoneyToCents supports integer and decimal BRL", () => {
  assert.equal(parseMoneyToCents("100"), 10000);
  assert.equal(parseMoneyToCents("100,99"), 10099);
  assert.equal(parseMoneyToCents("1.250,40"), 125040);
});

await check("buildConfirmationSummary lists all items and total", () => {
  const summary = buildConfirmationSummary({
    customer_name_raw: "Joao",
    destination_phone_n11: "11999998888",
    items: [
      {
        product_name_raw: "Televisao",
        quantity: 1,
        unit_price_cents: 5000,
      },
      {
        product_name_raw: "Suporte",
        quantity: 2,
        unit_price_cents: 3000,
      },
    ],
  });

  assert.match(summary, /1\. Televisao/);
  assert.match(summary, /2\. Suporte/);
  assert.match(summary, /Total geral: R\$\s*110,00/);
});

await check("buildOfferPayloadFromSession preserves the full item list", () => {
  const payload = buildOfferPayloadFromSession({
    _id: "session-1",
    requesterPhoneDigits: "5511999999999",
    resolved: {
      customerId: null,
      customer_name_raw: "Joao",
      destination_phone_n11: "11999998888",
      items: [
        {
          product_name_raw: "Televisao",
          quantity: 1,
          unit_price_cents: 5000,
        },
        {
          product_name_raw: "Suporte",
          quantity: 2,
          unit_price_cents: 3000,
        },
      ],
    },
  });

  assert.equal(payload.items.length, 2);
  assert.equal(payload.totalCents, 11000);
  assert.deepEqual(payload.items[1], {
    description: "Suporte",
    qty: 2,
    unitPriceCents: 3000,
    lineTotalCents: 6000,
  });
});

await check("validateInboundPayload accepts text and audio payloads", () => {
  const textPayload = validateInboundPayload({
    messageId: "wamid-1",
    fromPhoneDigits: "5511999999999",
    pushName: "Rafael",
    type: "text",
    text: "criar proposta",
    timestamp: "2026-03-17T22:10:00.000Z",
  });

  assert.equal(textPayload.type, "text");
  assert.equal(textPayload.text, "criar proposta");

  const audioPayload = validateInboundPayload({
    messageId: "wamid-2",
    fromPhoneDigits: "5511999999999",
    type: "audio",
    mimeType: "audio/ogg",
    audioBase64: "ZmFrZQ==",
  });

  assert.equal(audioPayload.type, "audio");
  assert.equal(audioPayload.mimeType, "audio/ogg");
});

await check("validateInboundPayload rejects invalid bodies", () => {
  assert.throws(
    () =>
      validateInboundPayload({
        messageId: "wamid-3",
        fromPhoneDigits: "5511999999999",
        type: "text",
      }),
    /text obrigatorio/i,
  );

  assert.throws(
    () =>
      validateInboundPayload({
        messageId: "wamid-4",
        fromPhoneDigits: "5511999999999",
        type: "audio",
        mimeType: "audio/ogg",
      }),
    /audioBase64/i,
  );
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nAll tests passed.");
}
