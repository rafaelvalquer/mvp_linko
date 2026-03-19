import {
  buildContinuationExtractionPrompt,
  buildFreshExtractionPrompt,
} from "./whatsappAi.prompts.js";
import {
  buildExtractionResponseFormat,
  parseStructuredExtraction,
} from "./whatsappAi.schemas.js";
import {
  getIntentExtractionModel,
  getOpenAIClient,
  isWhatsAppAiEnabled,
} from "./openai.client.js";

async function requestStructuredExtraction({ systemPrompt, userPrompt }) {
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
    response_format: buildExtractionResponseFormat(),
  });

  const content = String(response?.choices?.[0]?.message?.content || "").trim();
  if (!content) {
    const err = new Error("A IA nao retornou conteudo estruturado.");
    err.code = "WHATSAPP_AI_EMPTY_RESPONSE";
    throw err;
  }

  return parseStructuredExtraction(content);
}

export async function extractWhatsAppIntent({ text }) {
  return requestStructuredExtraction(buildFreshExtractionPrompt({ text }));
}

export async function extractWhatsAppSessionReply({
  text,
  lastQuestionKey,
  pendingFields,
  currentResolved,
}) {
  return requestStructuredExtraction(
    buildContinuationExtractionPrompt({
      text,
      lastQuestionKey,
      pendingFields,
      currentResolved,
    }),
  );
}
