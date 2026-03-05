// server/src/routes/webhooks.abacatepay.routes.js
import { Router } from "express";

const router = Router();

function isAbacateWebhook(req) {
  const base = String(req.baseUrl || "");
  const path = String(req.path || "");
  const orig = String(req.originalUrl || "");

  // cobre 2 formas de mount:
  // 1) app.use("/api", router)  -> path começa com /webhooks/abacatepay
  // 2) app.use("/api/webhooks/abacatepay", router) -> baseUrl termina com /webhooks/abacatepay e path é "/" ou "/..."
  return (
    base.endsWith("/webhooks/abacatepay") ||
    path.startsWith("/webhooks/abacatepay") ||
    orig.includes("/webhooks/abacatepay")
  );
}

// ✅ IMPORTANTE: se NÃO for webhook do abacate, passa adiante (não intercepta login)
router.use((req, res, next) => {
  if (!isAbacateWebhook(req)) return next();

  return res.status(410).json({
    ok: false,
    error: "Webhooks AbacatePay desativados (MVP MANUAL_PIX).",
    code: "ABACATEPAY_DISABLED",
  });
});

export default router;
