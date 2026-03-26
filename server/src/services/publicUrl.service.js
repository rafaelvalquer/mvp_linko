import { env } from "../config/env.js";

const DEFAULT_PUBLIC_APP_ORIGIN = "https://www.luminorpay.com.br";

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/g, "");
}

function normalizeAbsoluteHttpOrigin(value = "") {
  const raw = trimTrailingSlash(value);
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(String(url.protocol || "").toLowerCase())) {
      return "";
    }
    return trimTrailingSlash(url.origin);
  } catch {
    return "";
  }
}

function isLocalDevelopmentOrigin(origin = "") {
  const normalized = normalizeAbsoluteHttpOrigin(origin);
  if (!normalized) return false;

  try {
    const { hostname } = new URL(normalized);
    return ["localhost", "127.0.0.1", "::1"].includes(
      String(hostname || "").trim().toLowerCase(),
    );
  } catch {
    return false;
  }
}

export function resolvePublicAppOrigin(origin = "", options = {}) {
  const preferPublic = options?.preferPublic === true;
  const candidates = [
    normalizeAbsoluteHttpOrigin(origin),
    normalizeAbsoluteHttpOrigin(env.publicFrontendUrl || ""),
    normalizeAbsoluteHttpOrigin(env.frontendUrl || ""),
    normalizeAbsoluteHttpOrigin(String(env.corsOrigin || "").split(",")[0]),
  ].filter(Boolean);

  if (preferPublic) {
    const publicCandidate = candidates.find(
      (candidate) => !isLocalDevelopmentOrigin(candidate),
    );
    if (publicCandidate) return publicCandidate;
    return DEFAULT_PUBLIC_APP_ORIGIN;
  }

  return candidates[0] || DEFAULT_PUBLIC_APP_ORIGIN;
}

export function buildOfferPublicUrl(offer, origin = "", options = {}) {
  const token = String(offer?.publicToken || "").trim();
  if (!token) return "";
  return `${resolvePublicAppOrigin(origin, options)}/p/${token}`;
}
