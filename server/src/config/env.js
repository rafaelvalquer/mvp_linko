import "dotenv/config";

export const env = {
  port: Number(process.env.PORT || 8010),
  mongoUri: process.env.MONGODB_URI || "",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
};
