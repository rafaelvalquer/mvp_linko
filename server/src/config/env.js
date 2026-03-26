import "dotenv/config";

function required(name, value) {
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function parseEmailList(raw) {
  return Array.from(
    new Set(
      String(raw || "")
        .split(",")
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function parseBoolean(raw, defaultValue = false) {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();

  if (!value) return defaultValue;
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function parseNumber(raw, defaultValue) {
  const value = Number(raw);
  return Number.isFinite(value) ? value : defaultValue;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 8011),
  mongoUri: required("MONGODB_URI", process.env.MONGODB_URI || ""),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  frontendUrl: String(process.env.FRONTEND_URL || "").trim(),
  publicFrontendUrl: String(process.env.PUBLIC_FRONTEND_URL || "").trim(),
  masterAdminEmails: parseEmailList(process.env.MASTER_ADMIN_EMAILS || ""),
  whatsappAiEnabled: parseBoolean(process.env.WHATSAPP_AI_ENABLED, false),
  openaiApiKey: String(process.env.OPENAI_API_KEY || "").trim(),
  openaiModel: String(process.env.OPENAI_MODEL || "").trim(),
  openaiTranscribeModel: String(
    process.env.OPENAI_TRANSCRIBE_MODEL || "",
  ).trim(),
  internalWaWebhookKey: String(process.env.INTERNAL_WA_WEBHOOK_KEY || "").trim(),
  whatsappAiSessionTtlMinutes: parseNumber(
    process.env.WHATSAPP_AI_SESSION_TTL_MINUTES || 30,
    30,
  ),

  // JWT (Auth)
  jwtSecret:
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV !== "production" ? "dev-secret-change-me" : ""),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
};

// Validação em produção
if (process.env.NODE_ENV === "production") {
  required("JWT_SECRET", process.env.JWT_SECRET || "");
}
