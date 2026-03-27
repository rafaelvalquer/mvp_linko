// src/components/offers/offerHelpers.js
export function norm(s) {
  const v = String(s || "")
    .trim()
    .toUpperCase();
  if (!v) return "";
  return v === "CANCELED" ? "CANCELLED" : v;
}

export function fmtBRLFromCents(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents) || 0) / 100);
}

export function getAmountCents(o) {
  return Number(o?.totalCents ?? o?.amountCents ?? 0) || 0;
}

export function isCancelledOffer(o) {
  return (
    norm(o?.status) === "CANCELLED" || norm(o?.paymentStatus) === "CANCELLED"
  );
}

export function isExpiredOffer(o) {
  return (
    norm(o?.status) === "EXPIRED" || norm(o?.paymentStatus) === "EXPIRED"
  );
}

export function isPaidOffer(o) {
  return (
    ["PAID", "CONFIRMED"].includes(norm(o?.paymentStatus)) ||
    ["PAID", "CONFIRMED"].includes(norm(o?.status))
  );
}

export function isPendingPaymentOffer(o) {
  const pay = norm(o?.paymentStatus);
  if (isCancelledOffer(o) || isExpiredOffer(o) || isPaidOffer(o)) return false;
  return pay === "PENDING" || !pay;
}

export function getPaymentLabel(o) {
  const pay = norm(o?.paymentStatus);
  const flow = norm(o?.status || "PUBLIC");
  if (isCancelledOffer(o)) {
    return { tone: "CANCELLED", text: "Cancelado", code: "CANCELLED" };
  }
  if (isExpiredOffer(o)) {
    return { tone: "EXPIRED", text: "Expirado", code: "EXPIRED" };
  }
  if (isPaidOffer(o))
    return { tone: "PAID", text: "Pago (confirmado)", code: "PAID" };
  if (pay === "WAITING_CONFIRMATION")
    return {
      tone: "PENDING",
      text: "Aguardando confirmação",
      code: "WAITING_CONFIRMATION",
    };
  if (pay === "REJECTED")
    return {
      tone: "CANCELLED",
      text: "Comprovante recusado",
      code: "REJECTED",
    };
  if (isPendingPaymentOffer(o))
    return { tone: "PENDING", text: "Aguardando pagamento", code: "PENDING" };

  const map = {
    PUBLIC: { tone: "PUBLIC", text: "Público" },
    ACCEPTED: { tone: "ACCEPTED", text: "Aceito" },
    EXPIRED: { tone: "EXPIRED", text: "Expirado" },
    CANCELLED: { tone: "CANCELLED", text: "Cancelado" },
  };

  return (
    map[flow] || {
      tone: flow || "PUBLIC",
      text: flow || "PUBLIC",
      code: flow || "PUBLIC",
    }
  );
}

export function fmtDT(iso) {
  try {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return "—";
  }
}

export function buildPublicUrl(offer) {
  const token = offer?.publicToken;
  if (!token) return "";
  return `${window.location.origin}/p/${token}`;
}

export function inferExtFromMime(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("pdf")) return ".pdf";
  if (m.includes("png")) return ".png";
  if (m.includes("jpeg") || m.includes("jpg")) return ".jpg";
  return "";
}

export function safeFileName(name, mime) {
  const ext = inferExtFromMime(mime);
  let base = String(name || "comprovante").trim();
  base = base.replace(/[\\\/:*?"<>|]+/g, "-").trim();
  if (!base) base = "comprovante";
  if (ext && !base.toLowerCase().endsWith(ext)) base += ext;
  return base;
}

export function downloadBase64File(base64, mime, filename) {
  const b64 = String(base64 || "").trim();
  if (!b64) throw new Error("Comprovante vazio.");

  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime || "application/octet-stream" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "comprovante";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}
