// src/utils/planQuota.js

export const PLAN_LIMITS = {
  start: 20,
  pro: 50,
  business: 120,
};

export function normalizePlan(plan) {
  const p = String(plan || "")
    .trim()
    .toLowerCase();

  // compat legado
  if (p === "free") return "start";
  if (p === "premium") return "pro";

  if (p === "start" || p === "pro" || p === "business" || p === "enterprise")
    return p;

  return "start";
}

export function getPlanLabel(plan) {
  const p = normalizePlan(plan);
  if (p === "start") return "Start";
  if (p === "pro") return "Pro";
  if (p === "business") return "Business";
  if (p === "enterprise") return "Enterprise";
  return "Start";
}

export function getMonthlyLimit(plan, pixMonthlyLimit) {
  const p = normalizePlan(plan);
  if (p === "enterprise") {
    const v = Number(pixMonthlyLimit);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }
  return PLAN_LIMITS[p] ?? PLAN_LIMITS.start;
}

export function formatQuota(remaining, limit) {
  const r = Number(remaining);
  const l = Number(limit);
  const rr = Number.isFinite(r) ? Math.max(0, r) : 0;
  const ll = Number.isFinite(l) ? Math.max(0, l) : 0;
  return `${rr}/${ll} Pix`;
}

export function quotaPercent(used, limit) {
  const u = Number(used);
  const l = Number(limit);
  if (!Number.isFinite(u) || !Number.isFinite(l) || l <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((u / l) * 100)));
}

export function isQuotaExceededError(err) {
  const status = err?.status;
  if (status === 402 || status === 403) return true;

  const msg = String(err?.message || err?.data?.error || "").toLowerCase();
  return msg.includes("cota") && msg.includes("pix");
}

export function quotaExceededMessage(scope = "seller") {
  if (scope === "public") {
    return "O vendedor atingiu o limite de Pix do mês. Entre em contato para outra forma de pagamento ou aguarde a renovação.";
  }
  return "Sua cota de Pix do mês acabou. Faça upgrade do plano para liberar mais Pix.";
}
