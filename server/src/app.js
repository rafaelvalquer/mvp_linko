import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import offersRoutes from "./routes/offers.routes.js";
import publicRoutes from "./routes/public.routes.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", healthRoutes);
  app.use("/api", offersRoutes);
  app.use("/api", publicRoutes);

  // erro padrão
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ ok: false, error: "Internal error" });
  });

  return app;
}
