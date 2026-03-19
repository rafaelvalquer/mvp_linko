import { formatPhoneDisplay } from "../../utils/phone.js";

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

function formatMoney(cents) {
  const value = Number(cents);
  if (!Number.isFinite(value)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
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

export function buildProductAmbiguityQuestion(candidates = []) {
  const options = candidates
    .map((candidate, index) => `${index + 1}. ${candidate.name}`)
    .join("\n");

  return `Encontrei ${candidates.length} produtos parecidos. Responda com o numero:\n${options}`;
}

export function buildMissingFieldQuestion(field) {
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
  const customerName = String(
    resolved.customerName || resolved.customer_name_raw || "",
  ).trim();
  const productName = String(
    resolved.productName || resolved.product_name_raw || "",
  ).trim();
  const quantity = Number(resolved.quantity || 0);
  const unitPriceCents = Number(resolved.unit_price_cents || 0);
  const totalCents = quantity * unitPriceCents;

  return [
    "Confirma a criacao e envio desta proposta?",
    "",
    `Cliente: ${customerName}`,
    `Telefone: ${formatPhoneDisplay(resolved.destination_phone_n11 || "")}`,
    `Produto: ${productName}`,
    `Quantidade: ${quantity}`,
    `Valor unitario: ${formatMoney(unitPriceCents)}`,
    `Total: ${formatMoney(totalCents)}`,
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
