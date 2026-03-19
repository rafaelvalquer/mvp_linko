import OpenAI from "openai";

import { env } from "../../config/env.js";

let openAiClient = null;

export function isWhatsAppAiEnabled() {
  return env.whatsappAiEnabled === true;
}

export function getOpenAIClient() {
  if (!env.openaiApiKey) {
    const err = new Error("OPENAI_API_KEY ausente.");
    err.code = "OPENAI_API_KEY_MISSING";
    throw err;
  }

  if (!openAiClient) {
    openAiClient = new OpenAI({ apiKey: env.openaiApiKey });
  }

  return openAiClient;
}

export function getIntentExtractionModel() {
  return env.openaiModel || "gpt-4.1-mini";
}

export function getTranscriptionModel() {
  return env.openaiTranscribeModel || "gpt-4o-mini-transcribe";
}
