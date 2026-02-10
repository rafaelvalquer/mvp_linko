import "dotenv/config";

export const env = {
  port: Number(process.env.PORT || 8011),
  mongoUri: process.env.MONGODB_URI || "",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
};
