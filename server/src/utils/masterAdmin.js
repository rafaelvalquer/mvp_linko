import { env } from "../config/env.js";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isMasterAdminEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return env.masterAdminEmails.includes(normalized);
}

export function enrichUserWithMasterAccess(user) {
  if (!user) return null;
  return {
    ...user,
    isMasterAdmin: isMasterAdminEmail(user.email),
  };
}
