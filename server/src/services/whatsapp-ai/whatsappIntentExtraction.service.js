import {
  buildAgendaDateExtractionPrompt,
  buildBackofficeOperationPrompt,
  buildBookingOperationPrompt,
  buildIntentRoutingPrompt,
  buildOfferSalesOperationPrompt,
  buildContinuationExtractionPrompt,
  buildFreshExtractionPrompt,
} from "./whatsappAi.prompts.js";
import {
  buildAgendaDateResponseFormat,
  buildBackofficeOperationResponseFormat,
  buildBookingOperationResponseFormat,
  buildIntentRoutingResponseFormat,
  buildOfferSalesOperationResponseFormat,
  buildExtractionResponseFormat,
  parseAgendaDateExtraction,
  parseBackofficeOperationExtraction,
  parseBookingOperationExtraction,
  parseIntentRoutingExtraction,
  parseOfferSalesOperationExtraction,
  parseStructuredExtraction,
} from "./whatsappAi.schemas.js";
import {
  getIntentExtractionModel,
  getOpenAIClient,
  isWhatsAppAiEnabled,
} from "./openai.client.js";

async function requestStructuredExtraction({
  systemPrompt,
  userPrompt,
  responseFormat,
  parseResponse,
}) {
  if (!isWhatsAppAiEnabled()) {
    const err = new Error("WhatsApp AI desabilitado.");
    err.code = "WHATSAPP_AI_DISABLED";
    throw err;
  }

  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: getIntentExtractionModel(),
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: responseFormat,
  });

  const content = String(response?.choices?.[0]?.message?.content || "").trim();
  if (!content) {
    const err = new Error("A IA nao retornou conteudo estruturado.");
    err.code = "WHATSAPP_AI_EMPTY_RESPONSE";
    throw err;
  }

  return parseResponse(content);
}

export async function extractWhatsAppIntent({ text }) {
  return requestStructuredExtraction({
    ...buildFreshExtractionPrompt({ text }),
    responseFormat: buildExtractionResponseFormat(),
    parseResponse: parseStructuredExtraction,
  });
}

export async function extractWhatsAppSessionReply({
  text,
  lastQuestionKey,
  pendingFields,
  currentResolved,
}) {
  return requestStructuredExtraction(
    {
      ...buildContinuationExtractionPrompt({
        text,
        lastQuestionKey,
        pendingFields,
        currentResolved,
      }),
      responseFormat: buildExtractionResponseFormat(),
      parseResponse: parseStructuredExtraction,
    },
  );
}

export async function routeWhatsAppMessageIntent({ text }) {
  return requestStructuredExtraction({
    ...buildIntentRoutingPrompt({ text }),
    responseFormat: buildIntentRoutingResponseFormat(),
    parseResponse: parseIntentRoutingExtraction,
  });
}

export async function extractWhatsAppAgendaDate({
  text,
  todayDateIso,
  timeZone,
}) {
  return requestStructuredExtraction({
    ...buildAgendaDateExtractionPrompt({
      text,
      todayDateIso,
      timeZone,
    }),
    responseFormat: buildAgendaDateResponseFormat(),
    parseResponse: parseAgendaDateExtraction,
  });
}

export async function extractWhatsAppBookingOperation({
  text,
  todayDateIso,
  timeZone,
}) {
  return requestStructuredExtraction({
    ...buildBookingOperationPrompt({
      text,
      todayDateIso,
      timeZone,
    }),
    responseFormat: buildBookingOperationResponseFormat(),
    parseResponse: parseBookingOperationExtraction,
  });
}

export async function extractWhatsAppOfferSalesOperation({
  text,
  todayDateIso,
  timeZone,
}) {
  return requestStructuredExtraction({
    ...buildOfferSalesOperationPrompt({
      text,
      todayDateIso,
      timeZone,
    }),
    responseFormat: buildOfferSalesOperationResponseFormat(),
    parseResponse: parseOfferSalesOperationExtraction,
  });
}

export async function extractWhatsAppBackofficeOperation({ text }) {
  return requestStructuredExtraction({
    ...buildBackofficeOperationPrompt({ text }),
    responseFormat: buildBackofficeOperationResponseFormat(),
    parseResponse: parseBackofficeOperationExtraction,
  });
}
