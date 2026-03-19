import test from "node:test";
import assert from "node:assert/strict";

import {
  listMissingMandatoryFields,
  mergeResolvedDraft,
  normalizeResolvedItems,
  parseDirectReplyValue,
  parseMoneyToCents,
  parseStructuredExtraction,
} from "../src/services/whatsapp-ai/whatsappAi.schemas.js";

test("parseStructuredExtraction normalizes expected fields", () => {
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

test("parseStructuredExtraction keeps multiple items", () => {
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

test("mergeResolvedDraft resets linked entities when raw names change", () => {
  const base = {
    customer_name_raw: "Joao",
    customerId: "abc",
    customerName: "Joao Silva",
    product_name_raw: "TV 32",
    productId: "def",
    productName: "TV 32 Polegadas",
  };

  const next = mergeResolvedDraft(base, {
    customer_name_raw: "Maria",
    product_name_raw: "Notebook",
  });

  assert.equal(next.customerId, null);
  assert.equal(next.customerName, "");
  assert.equal(next.productId, null);
  assert.equal(next.productName, "");
});

test("listMissingMandatoryFields reports unresolved required inputs", () => {
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

test("parseDirectReplyValue handles quantity, money and destination phone", () => {
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
});

test("mergeResolvedDraft applies indexed item replies", () => {
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

  assert.equal(normalizeResolvedItems(next)[1]?.quantity, 2);
});

test("parseMoneyToCents supports integer and decimal BRL", () => {
  assert.equal(parseMoneyToCents("100"), 10000);
  assert.equal(parseMoneyToCents("100,99"), 10099);
  assert.equal(parseMoneyToCents("1.250,40"), 125040);
});
