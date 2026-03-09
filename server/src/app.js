// server/src/app.js
import express from "express";
import cors from "cors";
import { env } from "./config/env.js";

import healthRoutes from "./routes/health.routes.js";
import offersRoutes from "./routes/offers.routes.js";
import offerRemindersRoutes from "./routes/offer-reminders.routes.js";
import publicRoutes from "./routes/public.routes.js";
import webhooksAbacatepayRoutes from "./routes/webhooks.abacatepay.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { authOptional } from "./middleware/auth.js";
import bookingsRoutes from "./routes/bookings.routes.js";
import withdrawRoutes from "./routes/withdraws.routes.js";
import productsRoutes from "./routes/products.routes.js";
import clientsRoutes from "./routes/clients.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import reportsRoutes from "./routes/reports.routes.js";

import billingStripeRoutes from "./routes/billing.stripe.routes.js";
import webhooksStripeRoutes from "./routes/webhooks.stripe.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";

import path from "path";

export function createApp() {
  const app = express();

  const allowlist = String(env.corsOrigin || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const corsOptions = {
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowlist.length === 0) return cb(null, true);
      if (allowlist.includes(origin)) return cb(null, true);
      if (origin.endsWith(".vercel.app")) return cb(null, true);

      const err = new Error(`CORS blocked for origin: ${origin}`);
      err.status = 403;
      return cb(err);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
    optionsSuccessStatus: 204,
  };

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));

  // JSON + rawBody (webhooks)
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  // ✅ 1) ROTAS PÚBLICAS PRIMEIRO
  app.use("/api", publicRoutes);

  // static uploads
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  // ✅ 2) WEBHOOKS EM PREFIXO ESPECÍFICO (não intercepta /api/auth/login)
  // Se seu webhook do AbacatePay está "desativado" com router.all("*"), isso evita pegar tudo.
  app.use("/api/webhooks/abacatepay", webhooksAbacatepayRoutes);

  // Stripe (mantém como está no seu projeto)
  app.use("/api", webhooksStripeRoutes);

  // Auth optional (se tiver Bearer válido popula req.user)
  app.use(authOptional);

  // ✅ Rotas autenticadas / internas
  app.use("/api", healthRoutes);
  app.use("/api", authRoutes);
  app.use("/api", offersRoutes);
  app.use("/api", offerRemindersRoutes);
  app.use("/api", bookingsRoutes);

  // Mantém withdrawRoutes por enquanto (vamos reutilizar para "Conta Pix")
  app.use("/api", withdrawRoutes);

  app.use("/api", productsRoutes);
  app.use("/api", clientsRoutes);
  app.use("/api", settingsRoutes);
  app.use("/api", analyticsRoutes);
  app.use("/api", reportsRoutes);

  app.use("/api", billingStripeRoutes);

  app.use((err, _req, res, _next) => {
    console.error(err);

    const status = Number(err?.status) || 500;
    const payload = { ok: false, error: err?.message || "Internal error" };

    if (process.env.NODE_ENV !== "production" && err?.details) {
      payload.details = err.details;
    }

    res.status(status).json(payload);
  });

  return app;
}
