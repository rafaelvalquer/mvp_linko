// src/app.js
import express from "express";
import cors from "cors";
import { env } from "./config/env.js";

import healthRoutes from "./routes/health.routes.js";
import offersRoutes from "./routes/offers.routes.js";
import recurringOffersRoutes from "./routes/recurring-offers.routes.js";
import publicRoutes from "./routes/public.routes.js";
import authRoutes from "./routes/auth.routes.js";
import whatsappAiRoutes from "./routes/whatsapp-ai.routes.js";
import agentWebRoutes from "./routes/agent-web.routes.js";
import { authOptional } from "./middleware/auth.js";
import bookingsRoutes from "./routes/bookings.routes.js";
import withdrawRoutes from "./routes/withdraws.routes.js";
import productsRoutes from "./routes/products.routes.js";
import clientsRoutes from "./routes/clients.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import offerRemindersRoutes from "./routes/offer-reminders.routes.js";
import userAutomationsRoutes from "./routes/user-automations.routes.js";
import myPageRoutes from "./routes/my-page.native.routes.js";

import billingStripeRoutes from "./routes/billing.stripe.routes.js";
import webhooksStripeRoutes from "./routes/webhooks.stripe.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { startBookingRemindersRunner } from "./services/booking-reminders.runner.js";
import { startRecurringOffersRunner } from "./services/recurring-offers.runner.js";
import { startPaymentRemindersRunner } from "./services/payment-reminders.runner.js";
import { startUserAutomationsRunner } from "./services/user-automations.runner.js";
import { startWhatsAppOutboxRunner } from "./services/whatsappOutbox.runner.js";

import path from "path";

function sendLegacyPixGatewayDisabled(res) {
  return res.status(410).json({
    ok: false,
    error: "Webhooks do gateway legado foram desativados (MVP MANUAL_PIX).",
    code: "ABACATEPAY_DISABLED",
  });
}

export function createApp() {
  const app = express();
  const publicOrigin =
    String(env.corsOrigin || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)[0] || "";

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
    allowedHeaders: ["Content-Type", "Authorization", "x-internal-key"],
    credentials: false,
    optionsSuccessStatus: 204,
  };

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));

  app.use(
    "/api/internal/whatsapp",
    express.json({
      limit: "35mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
    whatsappAiRoutes,
  );

  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use("/api", publicRoutes);
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
  app.use("/api/webhooks/abacatepay", (_req, res) =>
    sendLegacyPixGatewayDisabled(res),
  );
  app.use("/api", webhooksStripeRoutes);

  app.use(authOptional);

  app.use("/api", healthRoutes);
  app.use("/api", authRoutes);
  app.use("/api", agentWebRoutes);
  app.use("/api", offersRoutes);
  app.use("/api", recurringOffersRoutes);
  app.use("/api", bookingsRoutes);
  app.use("/api", withdrawRoutes);
  app.use("/api", productsRoutes);
  app.use("/api", clientsRoutes);
  app.use("/api", settingsRoutes);
  app.use("/api", analyticsRoutes);
  app.use("/api", reportsRoutes);
  app.use("/api", myPageRoutes);
  app.use("/api", userAutomationsRoutes);
  app.use("/api", billingStripeRoutes);
  app.use("/api", adminRoutes);

  startRecurringOffersRunner({
    origin: publicOrigin,
  });
  startBookingRemindersRunner({ origin: publicOrigin });
  startPaymentRemindersRunner({ origin: publicOrigin });
  startUserAutomationsRunner();
  startWhatsAppOutboxRunner();

  app.use("/api", offerRemindersRoutes);

  app.use((err, _req, res, _next) => {
    console.error(err);

    const status = Number(err?.statusCode || err?.status) || 500;
    const payload = { ok: false, error: err?.message || "Internal error" };

    if (err?.code) payload.code = err.code;
    if (err?.reason) payload.reason = err.reason;
    if (err?.capability) payload.capability = err.capability;

    if (process.env.NODE_ENV !== "production" && err?.details) {
      payload.details = err.details;
    }

    res.status(status).json(payload);
  });

  return app;
}
