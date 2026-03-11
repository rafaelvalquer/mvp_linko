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

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 8011),
  mongoUri: required("MONGODB_URI", process.env.MONGODB_URI || ""),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  masterAdminEmails: parseEmailList(process.env.MASTER_ADMIN_EMAILS || ""),

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
