import { env } from "../config/env.js";

const DEFAULT_PUBLIC_APP_ORIGIN = "https://luminorpay.com.br";
const CANONICAL_PUBLIC_HOST = "luminorpay.com.br";

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
    const hostname = String(url.hostname || "").trim().toLowerCase();
    if (!hostname || /[,\s/\\]/.test(hostname)) {
      return "";
    }
    return trimTrailingSlash(url.origin);
  } catch {
    return "";
  }
}

function canonicalizePublicOrigin(origin = "") {
  const normalized = normalizeAbsoluteHttpOrigin(origin);
  if (!normalized) return "";

  try {
    const url = new URL(normalized);
    const hostname = String(url.hostname || "").trim().toLowerCase();
    if (hostname === CANONICAL_PUBLIC_HOST || hostname === `www.${CANONICAL_PUBLIC_HOST}`) {
      return DEFAULT_PUBLIC_APP_ORIGIN;
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
    origin,
    env.publicFrontendUrl || "",
    env.frontendUrl || "",
    String(env.corsOrigin || "").split(",")[0],
  ]
    .map((candidate) => normalizeAbsoluteHttpOrigin(candidate))
    .filter(Boolean);

  if (preferPublic) {
    const publicCandidate = candidates.find(
      (candidate) => !isLocalDevelopmentOrigin(candidate),
    );
    if (publicCandidate) {
      return canonicalizePublicOrigin(publicCandidate) || DEFAULT_PUBLIC_APP_ORIGIN;
    }
    return DEFAULT_PUBLIC_APP_ORIGIN;
  }

  const resolvedOrigin = candidates[0] || DEFAULT_PUBLIC_APP_ORIGIN;
  if (isLocalDevelopmentOrigin(resolvedOrigin)) return resolvedOrigin;
  return canonicalizePublicOrigin(resolvedOrigin) || DEFAULT_PUBLIC_APP_ORIGIN;
}

export function buildOfferPublicUrl(offer, origin = "", options = {}) {
  const token = String(offer?.publicToken || "").trim();
  if (!token) return "";
  return `${resolvePublicAppOrigin(origin, options)}/p/${token}`;
}
