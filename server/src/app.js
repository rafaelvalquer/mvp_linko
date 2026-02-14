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

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  // Se tiver Bearer token válido, popula req.user (senão segue)
  app.use(authOptional);

  app.use("/api", healthRoutes);
  app.use("/api", authRoutes);
  app.use("/api", offersRoutes);
  app.use("/api", publicRoutes);
  app.use("/api", bookingsRoutes);
  app.use("/api", withdrawRoutes);
  app.use("/api", webhooksAbacatepayRoutes);
  app.use("/api", authRoutes);

  app.use((err, _req, res, _next) => {
    console.error(err);

    const status = Number(err?.status) || 500;
    const payload = {
      ok: false,
      error: err?.message || "Internal error",
    };

    if (process.env.NODE_ENV !== "production" && err?.details) {
      payload.details = err.details;
    }

    res.status(status).json(payload);
  });

  return app;
}
