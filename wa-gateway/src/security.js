function normalizeIp(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";

  if (value.startsWith("::ffff:")) {
    return value.slice(7);
  }

  if (value === "::1") return "127.0.0.1";
  return value;
}

export function getClientIp(req) {
  const forwarded = String(req?.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();

  return normalizeIp(
    forwarded ||
      req?.socket?.remoteAddress ||
      req?.ip ||
      "",
  );
}

export function isIpAllowed(ip, allowlist = []) {
  const normalizedIp = normalizeIp(ip);
  const normalizedAllowlist = Array.isArray(allowlist)
    ? allowlist.map(normalizeIp).filter(Boolean)
    : [];

  if (!normalizedAllowlist.length) return true;
  if (!normalizedIp) return false;

  if (normalizedAllowlist.includes(normalizedIp)) return true;

  const loopbackSet = new Set(["127.0.0.1", "::1", "localhost"]);
  if (loopbackSet.has(normalizedIp) && normalizedAllowlist.includes("loopback")) {
    return true;
  }

  return false;
}

export function matchesApiKey(actualKey, expectedKey) {
  return String(actualKey || "").trim() === String(expectedKey || "").trim();
}

export function maskKey(value) {
  const raw = String(value || "");
  if (!raw) return "(not set)";
  if (raw.length <= 6) return "***";
  return `${raw.slice(0, 3)}***${raw.slice(-3)}`;
}

