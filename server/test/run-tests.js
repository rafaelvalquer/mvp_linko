import assert from "node:assert/strict";

import { PendingRegistration } from "../src/models/PendingRegistration.js";
import {
  normalizeDestinationPhoneN11,
  normalizeUserWhatsAppPhone,
  normalizeWhatsAppPhoneDigits,
} from "../src/utils/phone.js";
import {
  parseAgendaDateExtraction,
  parseBackofficeOperationExtraction,
  parseBookingOperationExtraction,
  parseIntentRoutingExtraction,
  parseOfferSalesOperationExtraction,
  listMissingMandatoryFields,
  mergeResolvedDraft,
  parseDirectReplyValue,
  parseMoneyToCents,
  parseStructuredExtraction,
  normalizeResolvedItems,
} from "../src/services/whatsapp-ai/whatsappAi.schemas.js";
import {
  buildAgendaFreeDayMessage,
  buildAgendaSummaryMessage,
  buildBackofficeOperationDisambiguationQuestion,
  buildBookingCancelConfirmation,
  buildBookingRescheduleConfirmation,
  buildClientCreateConfirmation,
  buildClientLookupMessage,
  buildNextBookingMessage,
  buildOfferCancelConfirmation,
  buildOfferReminderConfirmation,
  buildPendingOffersSummaryMessage,
  buildProductCreateConfirmation,
  buildProductLookupMessage,
  buildProductPriceUpdateConfirmation,
  buildWeeklyAgendaMessage,
  buildConfirmationSummary,
  buildIntentDisambiguationQuestion,
} from "../src/services/whatsapp-ai/whatsappQuestionBuilder.service.js";
import { buildOfferPayloadFromSession } from "../src/services/whatsapp-ai/whatsappOfferCreation.service.js";
import {
  buildAgendaDayLabel,
  getDateIsoForTimeZone,
  resolveAgendaQueryDate,
  shiftDateIso,
} from "../src/services/whatsapp-ai/whatsappAgendaQuery.service.js";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  getNotificationFeatureAvailability,
  mergeNotificationSettings,
} from "../src/services/notificationSettings.js";
import {
  assertWhatsAppAccountPhoneAllowed,
  getPlanFeatureMatrix,
} from "../src/utils/planFeatures.js";
import {
  assertWorkspaceModuleAccess,
  buildWorkspaceCatalogFilter,
  canUseWorkspaceSharedCatalog,
  getScopedCatalogOwnerUserId,
} from "../src/utils/workspaceAccess.js";
import { applyProductSelectionToItem } from "../src/services/whatsapp-ai/whatsappEntityResolver.service.js";
import {
  buildDeliveryAckPatch,
  deliveryAckCodeToState,
  normalizeDeliveryState,
} from "../src/services/whatsappDelivery.service.js";

process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/test";
const { buildUserPayload, validateRegisterPayload } = await import(
  "../src/routes/auth.routes.js"
);
const { validateInboundPayload, validateMessageAckPayload } = await import(
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
  const payload = buildUserPayload({
    _id: "user-1",
    name: "Rafael",
    email: "rafael@example.com",
    workspaceId: "workspace-1",
    role: "owner",
    status: "active",
    whatsNewLastSeenAt: null,
    whatsappPhone: "11 99999-8888",
  });

  assert.equal(payload._id, "user-1");
  assert.equal(payload.name, "Rafael");
  assert.equal(payload.email, "rafael@example.com");
  assert.equal(payload.workspaceId, "workspace-1");
  assert.equal(payload.role, "owner");
  assert.equal(payload.profile, "owner");
  assert.equal(payload.status, "active");
  assert.equal(payload.isMasterAdmin, false);
  assert.equal(payload.isWorkspaceOwner, true);
  assert.equal(payload.workspacePlan, "start");
  assert.deepEqual(payload.permissions, {});
  assert.equal(payload.whatsNewLastSeenAt, null);
  assert.equal(payload.whatsappPhone, "11 99999-8888");
  assert.equal(payload.modulePermissions?.products, true);
  assert.equal(payload.modulePermissions?.clients, true);
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

await check("plan matrix enables payment reminder whatsapp on Pro+", () => {
  assert.equal(getPlanFeatureMatrix("start").whatsappPaymentReminders, false);
  assert.equal(getPlanFeatureMatrix("pro").whatsappPaymentReminders, true);
  assert.equal(getPlanFeatureMatrix("business").whatsappPaymentReminders, true);
  assert.equal(
    getPlanFeatureMatrix("enterprise").whatsappPaymentReminders,
    true,
  );
});

await check("plan matrix blocks account WhatsApp editing on Start", () => {
  assert.equal(getPlanFeatureMatrix("start").whatsappAccountPhone, false);
  assert.equal(getPlanFeatureMatrix("pro").whatsappAccountPhone, true);
  assert.equal(getPlanFeatureMatrix("business").whatsappAccountPhone, true);
  assert.equal(getPlanFeatureMatrix("enterprise").whatsappAccountPhone, true);
});

await check("assertWhatsAppAccountPhoneAllowed blocks Start plan", () => {
  assert.throws(
    () => assertWhatsAppAccountPhoneAllowed("start"),
    /WhatsApp da conta/i,
  );
  assert.equal(assertWhatsAppAccountPhoneAllowed("pro"), "pro");
});

await check("workspace catalog is shared for Business and Enterprise members", () => {
  const member = {
    _id: "507f191e810c19729de860ea",
    role: "member",
  };

  assert.equal(canUseWorkspaceSharedCatalog("business"), true);
  assert.equal(canUseWorkspaceSharedCatalog("enterprise"), true);
  assert.equal(
    getScopedCatalogOwnerUserId({
      user: member,
      workspacePlan: "business",
      workspaceOwnerUserId: "507f1f77bcf86cd799439011",
    }),
    null,
  );

  assert.deepEqual(
    buildWorkspaceCatalogFilter({
      user: member,
      workspaceId: "507f191e810c19729de860eb",
      workspacePlan: "enterprise",
      workspaceOwnerUserId: "507f1f77bcf86cd799439011",
    }),
    {
      workspaceId: "507f191e810c19729de860eb",
    },
  );
});

await check("workspace catalog keeps members scoped outside shared plans", () => {
  const member = {
    _id: "507f191e810c19729de860ec",
    role: "member",
  };

  assert.equal(canUseWorkspaceSharedCatalog("start"), false);
  assert.equal(canUseWorkspaceSharedCatalog("pro"), false);
  assert.equal(
    String(
      getScopedCatalogOwnerUserId({
        user: member,
        workspacePlan: "pro",
        workspaceOwnerUserId: "507f1f77bcf86cd799439011",
      }),
    ),
    "507f191e810c19729de860ec",
  );

  const filter = buildWorkspaceCatalogFilter({
    user: member,
    workspaceId: "507f191e810c19729de860ed",
    workspacePlan: "start",
    workspaceOwnerUserId: "507f1f77bcf86cd799439011",
  });

  assert.equal(filter.workspaceId, "507f191e810c19729de860ed");
  assert.equal(String(filter.ownerUserId), "507f191e810c19729de860ec");
});

await check("workspace module access still blocks unauthorized catalog modules", () => {
  assert.throws(
    () =>
      assertWorkspaceModuleAccess({
        user: {
          _id: "507f191e810c19729de860ee",
          role: "member",
          profile: "sales",
          permissions: {
            clients: false,
          },
        },
        workspacePlan: "business",
        workspaceOwnerUserId: "507f1f77bcf86cd799439011",
        moduleKey: "clients",
      }),
    /permissao/i,
  );
});

await check("plan matrix blocks WhatsApp AI offer creation on Start", () => {
  assert.equal(getPlanFeatureMatrix("start").whatsappAiOfferCreation, false);
  assert.equal(getPlanFeatureMatrix("pro").whatsappAiOfferCreation, true);
  assert.equal(getPlanFeatureMatrix("business").whatsappAiOfferCreation, true);
  assert.equal(
    getPlanFeatureMatrix("enterprise").whatsappAiOfferCreation,
    true,
  );
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

await check("feature availability evaluates payment reminder toggle on Pro", () => {
  const availability = getNotificationFeatureAvailability({
    settings: mergeNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS, {
      whatsapp: {
        masterEnabled: true,
        paymentReminders: {
          enabled: true,
        },
      },
    }),
    capabilities: {
      environment: {
        whatsapp: { available: true, reason: "", reasons: [] },
      },
      plan: {
        value: "pro",
        features: {
          whatsappPaymentReminders: true,
        },
      },
    },
  });

  assert.equal(availability.whatsappPaymentReminders.available, true);
});

await check("parseStructuredExtraction normalizes AI output", () => {
  const parsed = parseStructuredExtraction({
    intent: "create_offer_send_whatsapp",
    customer_name_raw: "Joao",
    destination_phone_n11: "+55 (11) 99999-8888",
    product_name_raw: "Televisao",
    product_code: "",
    quantity: 2,
    unit_price_cents: 10000,
    items: [
      {
        product_name_raw: "Televisao",
        product_code: "",
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
    product_code: "",
    quantity: 2,
    unit_price_cents: 10000,
    items: [
      {
        product_name_raw: "Televisao",
        product_code: "",
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
    product_code: "101010",
    quantity: 1,
    unit_price_cents: 5000,
    items: [
      {
        product_name_raw: "Televisao",
        product_code: "101010",
        quantity: 1,
        unit_price_cents: 5000,
      },
      {
        product_name_raw: "Suporte",
        product_code: "",
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
    product_code: "",
    quantity: 2,
    unit_price_cents: 3000,
  });
  assert.equal(parsed.product_code, "101010");
});

await check("parseIntentRoutingExtraction accepts agenda routing", () => {
  const parsed = parseIntentRoutingExtraction({
    intent: "query_weekly_agenda",
    source_text: "qual minha agenda da semana",
  });

  assert.deepEqual(parsed, {
    intent: "query_weekly_agenda",
    source_text: "qual minha agenda da semana",
  });
});

await check("parseBookingOperationExtraction normalizes booking operations", () => {
  const parsed = parseBookingOperationExtraction({
    intent: "reschedule_booking",
    target_customer_name: "Rafael",
    target_date_iso: "2026-03-20",
    target_time_hhmm: "9:00",
    target_reference: "explicit",
    new_date_iso: "2026-03-21",
    new_time_hhmm: "14:30",
    source_text: "remarque o Rafael para 21/03 as 14:30",
  });

  assert.deepEqual(parsed, {
    intent: "reschedule_booking",
    target_customer_name: "Rafael",
    target_date_iso: "2026-03-20",
    target_time_hhmm: "09:00",
    target_reference: "explicit",
    new_date_iso: "2026-03-21",
    new_time_hhmm: "14:30",
    source_text: "remarque o Rafael para 21/03 as 14:30",
  });
});

await check("parseOfferSalesOperationExtraction normalizes sales operations", () => {
  const parsed = parseOfferSalesOperationExtraction({
    intent: "send_offer_payment_reminder",
    target_customer_name: "Rafael",
    target_created_day_kind: "yesterday",
    target_created_date_iso: "",
    source_text: "cobrar Rafael da proposta de ontem",
  });

  assert.deepEqual(parsed, {
    intent: "send_offer_payment_reminder",
    target_customer_name: "Rafael",
    target_created_day_kind: "yesterday",
    target_created_date_iso: "",
    source_text: "cobrar Rafael da proposta de ontem",
  });
});

await check("parseBackofficeOperationExtraction normalizes backoffice operations", () => {
  const parsed = parseBackofficeOperationExtraction({
    intent: "create_client",
    client_full_name: "Rafael Silva",
    client_phone: "11 99999-8888",
    client_email: "RAFAEL@EXAMPLE.COM",
    client_cpf_cnpj: "123.456.789-09",
    product_name: "",
    product_price_cents: null,
    product_description: "",
    source_text: "crie um cliente Rafael Silva, telefone 11 99999-8888",
  });

  assert.deepEqual(parsed, {
    intent: "create_client",
    client_full_name: "Rafael Silva",
    client_phone: "11 99999-8888",
    client_email: "rafael@example.com",
    client_cpf_cnpj: "123.456.789-09",
    product_name: "",
    product_code: "",
    product_lookup_mode: "unspecified",
    product_price_cents: null,
    product_description: "",
    source_text: "crie um cliente Rafael Silva, telefone 11 99999-8888",
  });
});

await check("parseBackofficeOperationExtraction keeps product code lookups explicit", () => {
  const parsed = parseBackofficeOperationExtraction({
    intent: "lookup_product",
    client_full_name: "",
    client_phone: "",
    client_email: "",
    client_cpf_cnpj: "",
    product_name: "",
    product_code: "101010",
    product_lookup_mode: "by_code",
    product_price_cents: null,
    product_description: "",
    source_text: "qual e o produto de codigo 101010",
  });

  assert.deepEqual(parsed, {
    intent: "lookup_product",
    client_full_name: "",
    client_phone: "",
    client_email: "",
    client_cpf_cnpj: "",
    product_name: "",
    product_code: "101010",
    product_lookup_mode: "by_code",
    product_price_cents: null,
    product_description: "",
    source_text: "qual e o produto de codigo 101010",
  });
});

await check("parseAgendaDateExtraction normalizes requested day", () => {
  const parsed = parseAgendaDateExtraction({
    requested_day_kind: "tomorrow",
    requested_date_iso: "",
    source_text: "agenda de amanha",
  });

  assert.deepEqual(parsed, {
    requested_day_kind: "tomorrow",
    requested_date_iso: "",
    source_text: "agenda de amanha",
  });
});

await check("agenda date helpers resolve today and tomorrow", () => {
  const now = new Date("2026-03-19T15:00:00.000Z");
  const timeZone = "America/Sao_Paulo";

  assert.equal(getDateIsoForTimeZone(now, timeZone), "2026-03-19");
  assert.equal(shiftDateIso("2026-03-19", 1), "2026-03-20");
  assert.equal(
    resolveAgendaQueryDate({
      requestedDayKind: "unspecified",
      requestedDateIso: "",
      now,
      timeZone,
    }),
    "2026-03-19",
  );
  assert.equal(
    resolveAgendaQueryDate({
      requestedDayKind: "tomorrow",
      requestedDateIso: "",
      now,
      timeZone,
    }),
    "2026-03-20",
  );
});

await check("agenda messages format summary and disambiguation", () => {
  const now = new Date("2026-03-19T15:00:00.000Z");
  const dayLabel = buildAgendaDayLabel({
    requestedDayKind: "tomorrow",
    dateISO: "2026-03-20",
    now,
    timeZone: "America/Sao_Paulo",
  });
  const summary = buildAgendaSummaryMessage({
    dayLabel,
    dateISO: "2026-03-20",
    timeZone: "America/Sao_Paulo",
    summary: {
      confirmed: 1,
      hold: 1,
      total: 2,
    },
    items: [
      {
        timeLabel: "09:00 - 10:00",
        customerName: "Rafael",
        offerTitle: "Consulta",
        status: "CONFIRMED",
      },
      {
        timeLabel: "10:30 - 11:00",
        customerName: "Maria",
        offerTitle: "Retorno",
        status: "HOLD",
      },
    ],
  });

  assert.equal(dayLabel, "amanha");
  assert.match(summary, /✨ \*SUA AGENDA DO DIA\* ✨/u);
  assert.match(summary, /🗓️ 20\/03\/2026/u);
  assert.match(summary, /⏰ \*09:00 — 10:00\*/u);
  assert.match(summary, /🤝 Consulta/u);
  assert.match(summary, /📞 Retorno/u);
  assert.match(summary, /👤 Rafael/u);
  assert.match(summary, /🚀 \*Meta do dia:\*/u);

  const disambiguation = buildIntentDisambiguationQuestion();
  assert.match(disambiguation, /1\. Proposta/);
  assert.match(disambiguation, /2\. Agenda/);
});

await check("agenda free day message uses the WhatsApp template", () => {
  const message = buildAgendaFreeDayMessage({
    dayLabel: "hoje",
    dateISO: "2026-03-19",
    timeZone: "America/Sao_Paulo",
  });

  assert.match(message, /✨ \*SUA AGENDA DO DIA\* ✨/u);
  assert.match(message, /🗓️ 19\/03\/2026/u);
  assert.match(message, /Sua agenda de hoje esta livre\./);
  assert.match(message, /🚀 \*Meta do dia:\*/u);
});

await check("weekly agenda and booking operation messages render summaries", () => {
  const weekly = buildWeeklyAgendaMessage({
    startDateISO: "2026-03-19",
    endDateISO: "2026-03-25",
    timeZone: "America/Sao_Paulo",
    days: [
      {
        dateISO: "2026-03-19",
        items: [
          {
            timeLabel: "09:00 - 10:00",
            customerName: "Rafael",
            offerTitle: "Consulta",
          },
        ],
      },
    ],
  });

  assert.match(weekly, /SUA AGENDA DA SEMANA/);
  assert.match(weekly, /19\/03\/2026 ate 25\/03\/2026/);
  assert.match(weekly, /09:00/);
  assert.match(weekly, /Rafael/);

  const nextBooking = buildNextBookingMessage({
    bookingId: "booking-1",
    customerName: "Rafael",
    offerTitle: "Consulta",
    status: "CONFIRMED",
    startAt: "2026-03-19T12:00:00.000Z",
    timeZone: "America/Sao_Paulo",
  });

  assert.match(nextBooking, /PROXIMO COMPROMISSO/);
  assert.match(nextBooking, /Rafael/);
  assert.match(nextBooking, /Consulta/);

  const rescheduleSummary = buildBookingRescheduleConfirmation(
    {
      customerName: "Rafael",
      offerTitle: "Consulta",
      startAt: "2026-03-19T12:00:00.000Z",
      timeZone: "America/Sao_Paulo",
    },
    {
      startAt: "2026-03-20T15:00:00.000Z",
    },
  );
  assert.match(rescheduleSummary, /Confirma o reagendamento/);
  assert.match(rescheduleSummary, /Digite CONFIRMAR/);

  const cancelSummary = buildBookingCancelConfirmation({
    customerName: "Rafael",
    offerTitle: "Consulta",
    startAt: "2026-03-19T12:00:00.000Z",
    timeZone: "America/Sao_Paulo",
  });
  assert.match(cancelSummary, /Confirma o cancelamento/);
  assert.match(cancelSummary, /Digite CONFIRMAR/);
});

await check("offer sales messages render pending list and confirmations", () => {
  const pendingSummary = buildPendingOffersSummaryMessage([
    {
      displayLabel:
        "Rafael - Televisao - R$ 50,00 - criada em 19/03/2026 - vence em 20/03/2026",
    },
    {
      displayLabel: "Maria - Curso - R$ 200,00 - criada em 18/03/2026",
    },
  ]);

  assert.match(pendingSummary, /Propostas aguardando pagamento agora: 2/);
  assert.match(pendingSummary, /1\. Rafael/);
  assert.match(pendingSummary, /2\. Maria/);

  const reminderSummary = buildOfferReminderConfirmation({
    customerName: "Rafael",
    title: "Televisao",
    totalCents: 5000,
    createdAt: "2026-03-19T12:00:00.000Z",
    expiresAt: "2026-03-20T12:00:00.000Z",
  });
  assert.match(reminderSummary, /Confirma o envio do lembrete/);
  assert.match(reminderSummary, /Rafael/);
  assert.match(reminderSummary, /Digite CONFIRMAR/);

  const cancelSummary = buildOfferCancelConfirmation({
    customerName: "Rafael",
    title: "Televisao",
    totalCents: 5000,
    createdAt: "2026-03-19T12:00:00.000Z",
  });
  assert.match(cancelSummary, /Confirma o cancelamento desta proposta/);
  assert.match(cancelSummary, /Televisao/);
});

await check("backoffice messages render confirmations and lookups", () => {
  const selection = buildBackofficeOperationDisambiguationQuestion();
  assert.match(selection, /1\. Cadastrar cliente/);
  assert.match(selection, /4\. Consultar dados/);

  const clientConfirmation = buildClientCreateConfirmation({
    client_full_name: "Rafael Silva",
    client_phone: "11999998888",
    client_email: "rafael@example.com",
    client_cpf_cnpj: "12345678909",
  });
  assert.match(clientConfirmation, /Confirma a criacao deste cliente/);
  assert.match(clientConfirmation, /Rafael Silva/);
  assert.match(clientConfirmation, /Digite CONFIRMAR/);

  const productConfirmation = buildProductCreateConfirmation({
    product_name: "Televisao 50",
    product_code: "101010",
    product_price_cents: 250000,
    product_description: "Smart TV",
  });
  assert.match(productConfirmation, /Confirma o cadastro deste produto/);
  assert.match(productConfirmation, /Televisao 50/);
  assert.match(productConfirmation, /Codigo: 101010/);
  assert.match(productConfirmation, /R\$\s*2.500,00/);

  const automaticCodeConfirmation = buildProductCreateConfirmation({
    product_name: "Banana",
    product_price_cents: 1000,
  });
  assert.match(automaticCodeConfirmation, /Codigo: sera gerado automaticamente/);

  const priceUpdateConfirmation = buildProductPriceUpdateConfirmation(
    {
      name: "Suporte premium",
      priceCents: 7900,
    },
    {
      product_price_cents: 8900,
    },
  );
  assert.match(priceUpdateConfirmation, /Confirma a atualizacao deste produto/);
  assert.match(priceUpdateConfirmation, /Suporte premium/);
  assert.match(priceUpdateConfirmation, /R\$\s*89,00/);

  const clientLookup = buildClientLookupMessage("Maria", [
    "1. Maria Silva - (11) 99999-8888",
  ]);
  assert.match(clientLookup, /Telefone\(s\) encontrado\(s\) para Maria/);
  assert.match(clientLookup, /Maria Silva/);

  const productLookup = buildProductLookupMessage("televisao", [
    "1. Televisao 50 - Codigo: 101010 - R$ 2.500,00",
  ]);
  assert.match(productLookup, /Produtos encontrados para televisao/);
  assert.match(productLookup, /Televisao 50/);

  const productLookupByCode = buildProductLookupMessage("", [], {
    lookupMode: "by_code",
    productCode: "101010",
    items: [
      {
        externalProductId: "101010",
        name: "Banana",
        priceCents: 1000,
        description: "Fruta",
      },
    ],
  });
  assert.match(productLookupByCode, /Produto encontrado para o codigo 101010/);
  assert.match(productLookupByCode, /Nome: Banana/);
  assert.match(productLookupByCode, /Codigo: 101010/);
  assert.match(productLookupByCode, /Descricao: Fruta/);
});

await check("mergeResolvedDraft resets linked entities when raw values change", () => {
  const next = mergeResolvedDraft(
    {
      customer_name_raw: "Joao",
      customerId: "abc",
      customerName: "Joao Silva",
      product_name_raw: "TV 32",
      product_code: "101010",
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
  assert.equal(next.product_code, "");
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
    productCode: "",
    quantity: 2,
    unit_price_cents: 3000,
    productId: null,
    productName: "",
    productLookupQuery: "",
    productLookupMiss: false,
  });
});

await check("applyProductSelectionToItem hydrates catalog price when resolved by code", () => {
  const next = applyProductSelectionToItem(
    {
      customer_name_raw: "Joao",
      destination_phone_n11: "11999998888",
      items: [
        {
          product_name_raw: "codigo 101010",
          productCode: "101010",
          quantity: 2,
          unit_price_cents: 999999,
        },
      ],
    },
    0,
    {
      productId: "mongo-product-1",
      name: "Banana",
      externalProductId: "101010",
      priceCents: 1000,
    },
    {
      replaceRawName: true,
      useCatalogPrice: true,
    },
  );

  assert.deepEqual(normalizeResolvedItems(next)[0], {
    product_name_raw: "Banana",
    productCode: "101010",
    quantity: 2,
    unit_price_cents: 1000,
    productId: "mongo-product-1",
    productName: "Banana",
    productLookupQuery: "Banana",
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

await check("parseDirectReplyValue handles quantity, money, phone and product code", () => {
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
  assert.deepEqual(parseDirectReplyValue("product_name_raw", "codigo 101010"), {
    product_name_raw: "codigo 101010",
    product_code: "101010",
    source_text: "codigo 101010",
  });
  assert.deepEqual(parseDirectReplyValue("items.0.unit_price_cents", "codigo 101010"), {
    items: [
      {
        productCode: "101010",
      },
    ],
    source_text: "codigo 101010",
  });
  assert.deepEqual(parseDirectReplyValue("product_code", "codigo 101010"), {
    product_code: "101010",
    product_lookup_mode: "by_code",
    source_text: "codigo 101010",
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
        productCode: "101010",
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
  assert.match(summary, /Codigo: 101010/);
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

await check("validateMessageAckPayload accepts internal ack payload", () => {
  const payload = validateMessageAckPayload({
    providerMessageId: "wamid.123",
    ack: 3,
    ackState: "read",
    at: "2026-03-23T12:00:00.000Z",
    chatId: "5511999999999@c.us",
    raw: { from: "5511999999999@c.us" },
  });

  assert.equal(payload.providerMessageId, "wamid.123");
  assert.equal(payload.ack, 3);
  assert.equal(payload.ackState, "READ");
  assert.equal(payload.chatId, "5511999999999@c.us");
});

await check("validateMessageAckPayload rejects invalid ack body", () => {
  assert.throws(
    () =>
      validateMessageAckPayload({
        providerMessageId: "",
        ack: 1,
        ackState: "SERVER",
        at: "2026-03-23T12:00:00.000Z",
      }),
    /providerMessageId obrigatorio/i,
  );

  assert.throws(
    () =>
      validateMessageAckPayload({
        providerMessageId: "wamid.123",
        ack: "abc",
        ackState: "SERVER",
        at: "2026-03-23T12:00:00.000Z",
      }),
    /ack invalido/i,
  );
});

await check("deliveryAckCodeToState maps WhatsApp ack codes", () => {
  assert.equal(deliveryAckCodeToState(-1), "ERROR");
  assert.equal(deliveryAckCodeToState(0), "PENDING");
  assert.equal(deliveryAckCodeToState(1), "SERVER");
  assert.equal(deliveryAckCodeToState(2), "DEVICE");
  assert.equal(deliveryAckCodeToState(3), "READ");
  assert.equal(deliveryAckCodeToState(4), "PLAYED");
  assert.equal(deliveryAckCodeToState(9), null);
  assert.equal(normalizeDeliveryState("read"), "READ");
});

await check("buildDeliveryAckPatch advances delivery milestones", () => {
  const patch = buildDeliveryAckPatch(
    {
      deliveryState: "SERVER",
      deliveredAt: null,
      readAt: null,
      playedAt: null,
    },
    {
      ack: 3,
      ackState: "READ",
      at: "2026-03-23T12:30:00.000Z",
    },
  );

  assert.equal(patch.deliveryState, "READ");
  assert.equal(patch.deliveryLastAckCode, 3);
  assert.ok(patch.deliveryLastAckAt instanceof Date);
  assert.ok(patch.deliveredAt instanceof Date);
  assert.ok(patch.readAt instanceof Date);
  assert.equal(patch.playedAt, undefined);
});

await check("buildDeliveryAckPatch ignores regressions", () => {
  const patch = buildDeliveryAckPatch(
    {
      deliveryState: "READ",
      deliveredAt: new Date("2026-03-23T12:20:00.000Z"),
      readAt: new Date("2026-03-23T12:21:00.000Z"),
    },
    {
      ack: 2,
      ackState: "DEVICE",
      at: "2026-03-23T12:19:00.000Z",
    },
  );

  assert.equal(patch, null);
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nAll tests passed.");
}
