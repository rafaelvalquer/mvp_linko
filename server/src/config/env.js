import "dotenv/config";

function required(name, value) {
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT || 8011),
  mongoUri: required("MONGODB_URI", process.env.MONGODB_URI || ""),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",

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
