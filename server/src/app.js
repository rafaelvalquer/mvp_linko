// server/src/app.js
import express from "express";
import cors from "cors";
import { env } from "./config/env.js";

import healthRoutes from "./routes/health.routes.js";
import offersRoutes from "./routes/offers.routes.js";
import publicRoutes from "./routes/public.routes.js";
import webhooksAbacatepayRoutes from "./routes/webhooks.abacatepay.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { authOptional } from "./middleware/auth.js";
import bookingsRoutes from "./routes/bookings.routes.js";
import withdrawRoutes from "./routes/withdraws.routes.js";
import productsRoutes from "./routes/products.routes.js";
import clientsRoutes from "./routes/clients.routes.js";
import settingsRoutes from "./routes/settings.routes.js";

import billingStripeRoutes from "./routes/billing.stripe.routes.js";
import webhooksStripeRoutes from "./routes/webhooks.stripe.routes.js";

import path from "path";

export function createApp() {
  const app = express();

  // Aceita múltiplas origens separadas por vírgula:
  // Ex: CORS_ORIGIN="http://localhost:5173,https://seuapp.vercel.app"
  const allowlist = String(env.corsOrigin || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const corsOptions = {
    origin(origin, cb) {
      // requests sem Origin (curl/postman/webhook server-to-server)
      if (!origin) return cb(null, true);

      // se não configurou allowlist, libera (útil p/ MVP)
      if (allowlist.length === 0) return cb(null, true);

      // permite origin exata
      if (allowlist.includes(origin)) return cb(null, true);

      // opcional: liberar qualquer domínio .vercel.app
      if (origin.endsWith(".vercel.app")) return cb(null, true);

      const err = new Error(`CORS blocked for origin: ${origin}`);
      err.status = 403;
      return cb(err);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false, // use false se você autentica por Bearer token (localStorage)
    optionsSuccessStatus: 204,
  };

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions)); // garante preflight OK

  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  // arquivos estáticos (imagens de produtos)
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
  app.use("/api", publicRoutes);
  // webhooks (AbacatePay)
  app.use("/api", webhooksAbacatepayRoutes);
  // webhooks (Stripe)
  app.use("/api", webhooksStripeRoutes);

  // Se tiver Bearer token válido, popula req.user (senão segue)
  app.use(authOptional);

  app.use("/api", healthRoutes);
  app.use("/api", authRoutes);
  app.use("/api", offersRoutes);
  app.use("/api", bookingsRoutes);
  app.use("/api", withdrawRoutes);

  app.use("/api", productsRoutes);
  app.use("/api", clientsRoutes);
  app.use("/api", settingsRoutes);

  // billing (Stripe)
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
