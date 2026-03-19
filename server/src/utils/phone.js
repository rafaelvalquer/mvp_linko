export function onlyDigits(value) {
  return String(value || "").replace(/\D+/g, "");
}

export function normalizeWhatsAppPhoneDigits(raw) {
  const digits = onlyDigits(raw);
  if (!digits) return "";

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  return "";
}

export function normalizeDestinationPhoneN11(raw) {
  const digits = onlyDigits(raw);
  if (!digits) return "";

  if (digits.length === 11) return digits;
  if (digits.startsWith("55") && digits.length === 13) return digits.slice(2);

  return "";
}

export function normalizeUserWhatsAppPhone(raw) {
  const display = String(raw || "").trim();
  if (!display) {
    return {
      whatsappPhone: "",
      whatsappPhoneDigits: "",
    };
  }

  const whatsappPhoneDigits = normalizeWhatsAppPhoneDigits(display);
  if (!whatsappPhoneDigits) {
    const err = new Error(
      "Informe um numero de WhatsApp valido com DDD. Exemplo: 11999998888.",
    );
    err.status = 400;
    err.code = "INVALID_WHATSAPP_PHONE";
    throw err;
  }

  return {
    whatsappPhone: display,
    whatsappPhoneDigits,
  };
}

export function formatPhoneDisplay(raw) {
  const digits = onlyDigits(raw);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 13 && digits.startsWith("55")) {
    return formatPhoneDisplay(digits.slice(2));
  }

  return String(raw || "").trim();
}
