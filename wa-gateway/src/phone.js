export function normalizeToBR(toRaw) {
  const digits = String(toRaw || "").replace(/\D/g, "");
  if (!digits) return null;

  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  return null;
}

export function normalizeInboundPhoneDigits(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  return "";
}

export function isLidUserId(raw) {
  return /@lid$/i.test(String(raw || "").trim());
}

