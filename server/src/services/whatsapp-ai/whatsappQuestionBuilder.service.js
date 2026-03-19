import { formatPhoneDisplay } from "../../utils/phone.js";
import {
  normalizeResolvedItems,
  parseItemFieldKey,
} from "./whatsappAi.schemas.js";

function formatMoney(cents) {
  const value = Number(cents);
  if (!Number.isFinite(value)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function resolveItemLabel(resolved = {}, itemIndex = 0) {
  const items = normalizeResolvedItems(resolved);
  const item = items[itemIndex] || null;
  const productName = String(item?.productName || item?.product_name_raw || "").trim();
  return productName ? ` (${productName})` : "";
}

function buildItemLine(item = {}, index = 0) {
  const qty = Number(item?.quantity || 0);
  const unitPriceCents = Number(item?.unit_price_cents || 0);
  const totalCents = qty * unitPriceCents;
  const label = String(item?.productName || item?.product_name_raw || `Item ${index + 1}`).trim();

  return `${index + 1}. ${label} - Qtd: ${qty} - Valor unitario: ${formatMoney(unitPriceCents)} - Total: ${formatMoney(totalCents)}`;
}

export function buildNotLinkedNumberMessage() {
  return "Seu numero nao esta vinculado a nenhum usuario ativo da Luminor Pay. Atualize seu numero no perfil da plataforma para usar este recurso.";
}

export function buildCustomerAmbiguityQuestion(candidates = []) {
  const options = candidates
    .map(
      (candidate, index) =>
        `${index + 1}. ${candidate.fullName} - ${formatPhoneDisplay(candidate.phoneDigits || candidate.phone)}`,
    )
    .join("\n");

  return `Encontrei ${candidates.length} clientes com esse nome. Responda com o numero:\n${options}`;
}

export function buildProductAmbiguityQuestion(candidates = [], context = {}) {
  const formattedOptions = candidates
    .map((candidate, index) => `${index + 1}. ${candidate.name}`)
    .join("\n");

  const itemIndex =
    Number.isInteger(context?.itemIndex) && context.itemIndex >= 0
      ? context.itemIndex
      : null;
  const suffix =
    itemIndex != null
      ? ` para o item ${itemIndex + 1}${context?.itemLabel || ""}`
      : "";

  return `Encontrei ${candidates.length} produtos parecidos${suffix}. Responda com o numero:\n${formattedOptions}`;
}

export function buildMissingFieldQuestion(field, resolved = {}) {
  const itemField = parseItemFieldKey(field);
  if (itemField) {
    const itemNumber = itemField.itemIndex + 1;
    const itemLabel = resolveItemLabel(resolved, itemField.itemIndex);

    if (itemField.field === "product_name_raw") {
      return `Qual e o produto ou servico do item ${itemNumber}${itemLabel}?`;
    }
    if (itemField.field === "quantity") {
      return `Qual e a quantidade do item ${itemNumber}${itemLabel}?`;
    }
    if (itemField.field === "unit_price_cents") {
      return `Qual e o valor unitario do item ${itemNumber}${itemLabel} em reais?`;
    }
  }

  if (field === "customer_name_raw") return "Qual e o nome do cliente?";
  if (field === "destination_phone_n11") {
    return "Qual e o numero do cliente com DDD? Exemplo: 11999998888";
  }
  if (field === "product_name_raw") return "Qual e o produto ou servico da proposta?";
  if (field === "quantity") return "Qual e a quantidade?";
  if (field === "unit_price_cents") return "Qual e o valor unitario do item em reais?";
  return "Qual informacao esta faltando?";
}

export function buildConfirmationSummary(resolved = {}) {
  const items = normalizeResolvedItems(resolved);
  const customerName = String(
    resolved.customerName || resolved.customer_name_raw || "",
  ).trim();
  const totalCents = items.reduce((sum, item) => {
    const qty = Number(item?.quantity || 0);
    const unitPriceCents = Number(item?.unit_price_cents || 0);
    return sum + qty * unitPriceCents;
  }, 0);
  const itemLines = items.length
    ? items.map((item, index) => buildItemLine(item, index))
    : ["1. Item 1 - Qtd: 0 - Valor unitario: R$ 0,00 - Total: R$ 0,00"];

  return [
    "Confirma a criacao e envio desta proposta?",
    "",
    `Cliente: ${customerName}`,
    `Telefone: ${formatPhoneDisplay(resolved.destination_phone_n11 || "")}`,
    "Itens:",
    ...itemLines,
    `Total geral: ${formatMoney(totalCents)}`,
    "",
    "Responda com CONFIRMAR ou CANCELAR.",
  ].join("\n");
}

export function buildSuccessMessage(customerName) {
  return `Proposta criada e enviada com sucesso para ${String(customerName || "o cliente").trim()}.`;
}

export function buildCancelledMessage() {
  return "Operacao cancelada.";
}

export function buildErrorMessage() {
  return "Nao consegui concluir sua solicitacao agora. Tente novamente em instantes.";
}

export function buildInvalidSelectionMessage(originalQuestion) {
  return [
    "Nao entendi a opcao informada. Responda apenas com o numero da opcao desejada.",
    "",
    String(originalQuestion || "").trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInvalidConfirmationMessage() {
  return "Responda com CONFIRMAR ou CANCELAR.";
}

export function buildProcessingMessage() {
  return "Sua solicitacao ainda esta sendo processada. Aguarde alguns instantes.";
}
