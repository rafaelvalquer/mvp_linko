import { env } from "../config/env.js";

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/g, "");
}

export function resolvePublicAppOrigin(origin = "") {
  const explicit = trimTrailingSlash(origin);
  if (explicit) return explicit;

  const frontendUrl = trimTrailingSlash(env.frontendUrl || "");
  if (frontendUrl) return frontendUrl;

  const corsOrigin = trimTrailingSlash(String(env.corsOrigin || "").split(",")[0]);
  if (corsOrigin) return corsOrigin;

  return "http://localhost:5173";
}

export function buildOfferPublicUrl(offer, origin = "") {
  const token = String(offer?.publicToken || "").trim();
  if (!token) return "";
  return `${resolvePublicAppOrigin(origin)}/p/${token}`;
}
