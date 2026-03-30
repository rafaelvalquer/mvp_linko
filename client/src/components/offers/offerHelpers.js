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

export function getOfferFeedbackRating(o) {
  const rating = Number(o?.feedback?.rating);
  return Number.isFinite(rating) && rating >= 1 && rating <= 5 ? rating : null;
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

export function isOfferFulfillmentCompleted(o) {
  return !!o?.fulfillment?.completedAt;
}

export function hasFeedbackRequestSent(o) {
  return !!o?.feedbackRequest?.sentAt;
}

export function hasFeedbackResponse(o) {
  return !!o?.feedback?.respondedAt && getOfferFeedbackRating(o) !== null;
}

export function isOfferLowRating(o) {
  const rating = getOfferFeedbackRating(o);
  return rating !== null && rating <= 3;
}

export function hasOfferContactRequested(o) {
  return o?.feedback?.contactRequested === true;
}

export function isOfferCriticalFeedback(o) {
  return isOfferLowRating(o) || hasOfferContactRequested(o);
}

export function getOfferCxState(o) {
  if (!isPaidOffer(o)) return null;
  if (hasFeedbackResponse(o)) return "FEEDBACK_RESPONDED";
  if (hasFeedbackRequestSent(o)) return "FEEDBACK_SENT";
  if (!isOfferFulfillmentCompleted(o)) return "NOT_COMPLETED";
  return null;
}

export function getOfferCxStatusSummary(o) {
  const cxState = getOfferCxState(o);
  const rating = getOfferFeedbackRating(o);

  if (cxState === "FEEDBACK_RESPONDED") {
    return {
      code: cxState,
      tone: "CONFIRMED",
      text: `Avaliacao respondida: ${rating}/5`,
    };
  }

  if (cxState === "FEEDBACK_SENT") {
    return {
      code: cxState,
      tone: "ACCEPTED",
      text: "Avaliacao enviada",
    };
  }

  if (cxState === "NOT_COMPLETED") {
    return {
      code: cxState,
      tone: "PUBLIC",
      text: "Nao concluido",
    };
  }

  return null;
}

export function getOfferCxAlertBadges(o) {
  const items = [];
  if (isOfferLowRating(o)) {
    items.push({ code: "LOW_RATING", tone: "CANCELLED", text: "Nota baixa" });
  }
  if (hasOfferContactRequested(o)) {
    items.push({
      code: "CONTACT_REQUESTED",
      tone: "ACCEPTED",
      text: "Pediu contato",
    });
  }
  return items;
}

export function getOfferFulfillmentCtaLabel(o) {
  if (hasFeedbackResponse(o)) return "Ver avaliacao";
  if (isOfferFulfillmentCompleted(o)) return "Reenviar avaliacao";
  return String(o?.offerType || "").toLowerCase() === "product"
    ? "Pedido entregue"
    : "Concluir atendimento";
}

export function getOfferFulfillmentLabel(o) {
  return String(o?.offerType || "").toLowerCase() === "product"
    ? "Pedido entregue"
    : "Atendimento concluido";
}

export function getOfferFulfillmentDialogTitle(o) {
  return String(o?.offerType || "").toLowerCase() === "product"
    ? "Marcar pedido como entregue"
    : "Marcar atendimento como concluido";
}

export function buildFeedbackUrl(offer) {
  const publicUrl = buildPublicUrl(offer);
  return publicUrl ? `${publicUrl}/feedback` : "";
}

export function buildFeedbackPreview(offer, channel) {
  const feedbackUrl = buildFeedbackUrl(offer);
  const label =
    String(offer?.offerType || "").toLowerCase() === "product"
      ? "pedido"
      : "atendimento";
  const name = String(offer?.customerName || "")
    .trim()
    .split(/\s+/)[0];

  if (String(channel || "").toLowerCase() === "email") {
    return [
      name ? `Assunto para ${name}` : "Assunto para cliente",
      `Obrigado pela experiencia com ${offer?.title || "sua proposta"}`,
      "",
      `Seu ${label} foi finalizado por aqui e queremos ouvir sua opiniao.`,
      `Link da avaliacao: ${feedbackUrl || "link indisponivel"}`,
    ].join("\n");
  }

  return [
    name ? `Oi, ${name}!` : "Oi!",
    "",
    `Obrigada por confiar na gente. Seu ${label} foi finalizado por aqui.`,
    "Se puder, queria te pedir uma avaliacao rapida:",
    feedbackUrl || "link indisponivel",
  ].join("\n");
}

export function normalizeOfferCxFilter(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (
    [
      "ALL",
      "NOT_COMPLETED",
      "FEEDBACK_SENT",
      "FEEDBACK_RESPONDED",
      "LOW_RATING",
      "CONTACT_REQUESTED",
    ].includes(normalized)
  ) {
    return normalized;
  }

  return "ALL";
}

export function matchesOfferCxFilter(offer, cxFilter) {
  const filter = normalizeOfferCxFilter(cxFilter);
  if (filter === "ALL") return true;
  if (filter === "LOW_RATING") return isOfferLowRating(offer);
  if (filter === "CONTACT_REQUESTED") return hasOfferContactRequested(offer);
  return getOfferCxState(offer) === filter;
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
