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
  const productCode = String(item?.productCode || item?.product_code || "").trim();

  return `${index + 1}. ${label}${productCode ? ` - Codigo: ${productCode}` : ""} - Qtd: ${qty} - Valor unitario: ${formatMoney(unitPriceCents)} - Total: ${formatMoney(totalCents)}`;
}

function formatAgendaDate(dateISO, timeZone = "America/Sao_Paulo") {
  const value = String(dateISO || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "--/--/----";

  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatAgendaDateTime(value, timeZone = "America/Sao_Paulo") {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function resolveAgendaItemIcon(item = {}) {
  const offerTitle = String(item?.offerTitle || "").trim().toLowerCase();
  if (item?.status === "HOLD") return "📞";
  if (offerTitle.includes("aula") || offerTitle.includes("curso")) return "💼";
  return "🤝";
}

function buildAgendaDailyGoal({ dayLabel = "hoje", summary = {}, items = [] } = {}) {
  const total = Number(summary?.total || 0);
  if (total <= 0) {
    return "Aproveitar os horarios livres para organizar pendencias e abrir espaco para novas oportunidades.";
  }

  const morningItems = (Array.isArray(items) ? items : []).filter((item) => {
    const label = String(item?.timeLabel || "");
    const hour = Number(label.slice(0, 2));
    return Number.isFinite(hour) && hour < 12;
  });

  if (morningItems.length === total) {
    return `Organizar os compromissos da manha e manter o foco nas atividades planejadas para ${String(
      dayLabel || "o dia",
    ).trim()}.`;
  }

  if (total === 1) {
    return `Conduzir o compromisso de ${String(
      dayLabel || "hoje",
    ).trim()} com tranquilidade e reservar tempo para follow-ups importantes.`;
  }

  return `Priorizar os ${total} compromissos de ${String(
    dayLabel || "hoje",
  ).trim()} e manter o ritmo do atendimento ao longo do dia.`;
}

export function buildNotLinkedNumberMessage() {
  return "Seu numero nao esta vinculado a nenhum usuario ativo da Luminor Pay. Atualize seu numero no perfil da plataforma para usar este recurso.";
}

export function buildDuplicateLinkedNumberMessage() {
  return "Seu numero esta vinculado a mais de um usuario ativo da Luminor Pay. Deixe este WhatsApp cadastrado em apenas uma conta para usar o agente com seguranca.";
}

export function buildPlanUpgradeRequiredMessage() {
  return "Seu plano atual nao inclui o agente da Luminor no WhatsApp. Faca upgrade para Pro, Business ou Enterprise para usar esse recurso.";
}

export function buildIntentDisambiguationQuestion() {
  return [
    "Voce quer fazer uma proposta ou consultar a agenda?",
    "",
    "1. Proposta",
    "2. Agenda",
  ].join("\n");
}

export function buildBookingOperationDisambiguationQuestion() {
  return [
    "Voce quer consultar a agenda, reagendar ou cancelar um compromisso?",
    "",
    "1. Consultar agenda",
    "2. Reagendar compromisso",
    "3. Cancelar compromisso",
  ].join("\n");
}

export function buildOfferSalesOperationDisambiguationQuestion() {
  return [
    "Voce quer consultar pendentes, cobrar um cliente ou cancelar uma proposta?",
    "",
    "1. Consultar pendentes",
    "2. Cobrar cliente",
    "3. Cancelar proposta",
  ].join("\n");
}

export function buildBackofficeOperationDisambiguationQuestion() {
  return [
    "Voce quer cadastrar cliente, cadastrar produto, atualizar preco ou consultar dados?",
    "",
    "1. Cadastrar cliente",
    "2. Cadastrar produto",
    "3. Atualizar preco",
    "4. Consultar dados",
  ].join("\n");
}

export function buildOfferSalesContextSwitchQuestion() {
  return [
    "Existe uma proposta em andamento. Voce quer continuar a proposta atual ou seguir com cobranca e vendas?",
    "",
    "1. Proposta",
    "2. Cobranca e vendas",
  ].join("\n");
}

export function buildBackofficeContextSwitchQuestion() {
  return [
    "Existe uma proposta em andamento. Voce quer continuar a proposta atual ou seguir com cadastro e backoffice?",
    "",
    "1. Proposta",
    "2. Cadastro e backoffice",
  ].join("\n");
}

export function buildBookingAmbiguityQuestion(candidates = [], actionLabel = "esse compromisso") {
  const options = candidates
    .map(
      (candidate, index) =>
        `${index + 1}. ${String(candidate?.displayLabel || "").trim() || "Compromisso"}`,
    )
    .join("\n");

  return `Encontrei ${candidates.length} compromissos para ${actionLabel}. Responda com o numero:\n${options}`;
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

export function buildProductCodeNotFoundQuestion(productCode = "", context = {}) {
  const itemIndex =
    Number.isInteger(context?.itemIndex) && context.itemIndex >= 0
      ? context.itemIndex
      : null;
  const suffix = itemIndex != null ? ` para o item ${itemIndex + 1}` : "";

  return `Nao encontrei produto com o codigo ${String(productCode || "informado").trim()}${suffix}. Informe outro codigo ou o nome do produto.`;
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

export function buildInvalidIntentSelectionMessage(originalQuestion) {
  return [
    "Nao entendi sua escolha. Responda com PROPOSTA, AGENDA, 1, 2 ou CANCELAR.",
    "",
    String(originalQuestion || buildIntentDisambiguationQuestion()).trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInvalidBookingOperationSelectionMessage(originalQuestion) {
  return [
    "Nao entendi sua escolha. Responda com AGENDA, REAGENDAR, CANCELAR, 1, 2 ou 3.",
    "",
    String(originalQuestion || buildBookingOperationDisambiguationQuestion()).trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInvalidOfferSalesSelectionMessage(originalQuestion) {
  return [
    "Nao entendi sua escolha. Responda com PENDENTES, COBRAR, CANCELAR, 1, 2 ou 3.",
    "",
    String(originalQuestion || buildOfferSalesOperationDisambiguationQuestion()).trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInvalidOfferSalesContextSwitchMessage(originalQuestion) {
  return [
    "Nao entendi sua escolha. Responda com PROPOSTA, COBRANCA, 1, 2 ou CANCELAR.",
    "",
    String(originalQuestion || buildOfferSalesContextSwitchQuestion()).trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInvalidBackofficeSelectionMessage(originalQuestion) {
  return [
    "Nao entendi sua escolha. Responda com CLIENTE, PRODUTO, PRECO, CONSULTAR, 1, 2, 3 ou 4.",
    "",
    String(originalQuestion || buildBackofficeOperationDisambiguationQuestion()).trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInvalidBackofficeContextSwitchMessage(originalQuestion) {
  return [
    "Nao entendi sua escolha. Responda com PROPOSTA, BACKOFFICE, 1, 2 ou CANCELAR.",
    "",
    String(originalQuestion || buildBackofficeContextSwitchQuestion()).trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildClientExistingMatchesQuestion(candidates = []) {
  const options = candidates
    .map(
      (candidate, index) =>
        `${index + 1}. ${candidate.fullName} - ${formatPhoneDisplay(candidate.phoneDigits || candidate.phone)}`,
    )
    .join("\n");

  return [
    `Encontrei ${candidates.length} clientes parecidos.`,
    "Responda com o numero para usar um cadastro existente ou com NOVO para criar outro.",
    options,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildClientCreateConfirmation(draft = {}) {
  return [
    "Confirma a criacao deste cliente?",
    "",
    `Nome: ${String(draft?.client_full_name || "").trim()}`,
    `Telefone: ${formatPhoneDisplay(draft?.client_phone || "")}`,
    `Email: ${String(draft?.client_email || "").trim()}`,
    `CPF/CNPJ: ${String(draft?.client_cpf_cnpj || "").trim()}`,
    "",
    "Digite CONFIRMAR para continuar ou CANCELAR para desistir.",
  ].join("\n");
}

export function buildClientCreatedSuccessMessage(client = {}) {
  return `Cliente ${String(client?.fullName || "informado").trim()} criado com sucesso.`;
}

export function buildProductCreateConfirmation(draft = {}) {
  const productCode = String(draft?.product_code || "").trim();
  return [
    "Confirma o cadastro deste produto?",
    "",
    `Produto: ${String(draft?.product_name || "").trim()}`,
    `Codigo: ${productCode || "sera gerado automaticamente"}`,
    `Preco: ${formatMoney(draft?.product_price_cents)}`,
    String(draft?.product_description || "").trim()
      ? `Descricao: ${String(draft.product_description || "").trim()}`
      : "",
    "",
    "Digite CONFIRMAR para continuar ou CANCELAR para desistir.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildProductCreatedSuccessMessage(product = {}) {
  const productCode = String(product?.productId || "").trim();
  return `Produto ${String(product?.name || "informado").trim()} cadastrado com sucesso${
    productCode ? ` com o codigo ${productCode}` : ""
  }.`;
}

export function buildProductPriceUpdateConfirmation(product = {}, draft = {}) {
  return [
    "Confirma a atualizacao deste produto?",
    "",
    `Produto: ${String(product?.name || draft?.product_name || "").trim()}`,
    `Preco atual: ${formatMoney(product?.priceCents)}`,
    `Novo preco: ${formatMoney(draft?.product_price_cents)}`,
    "",
    "Digite CONFIRMAR para continuar ou CANCELAR para desistir.",
  ].join("\n");
}

export function buildProductPriceUpdatedSuccessMessage(product = {}) {
  return `Preco do produto ${String(product?.name || "informado").trim()} atualizado com sucesso.`;
}

export function buildBackofficeMissingFieldQuestion(field) {
  if (field === "client_full_name") return "Qual e o nome completo do cliente?";
  if (field === "client_phone") return "Qual e o telefone do cliente com DDD?";
  if (field === "client_email") return "Qual e o email do cliente?";
  if (field === "client_cpf_cnpj") return "Qual e o CPF ou CNPJ do cliente?";
  if (field === "product_name") return "Qual e o nome do produto?";
  if (field === "product_code") return "Qual e o codigo do produto?";
  if (field === "product_price_cents") return "Qual e o preco do produto em reais?";
  if (field === "product_description") return "Qual e a descricao do produto?";
  return "Qual informacao esta faltando?";
}

export function buildClientLookupMessage(clientName = "", lines = []) {
  const safeLines = Array.isArray(lines) ? lines.filter(Boolean) : [];
  if (!safeLines.length) {
    return `Nao encontrei telefone para ${String(clientName || "esse cliente").trim()}.`;
  }

  return [
    `Telefone(s) encontrado(s) para ${String(clientName || "o cliente").trim()}:`,
    "",
    ...safeLines,
  ].join("\n");
}

export function buildProductCodeConflictMessage(productCode = "") {
  return `Ja existe um produto com esse codigo neste workspace. Informe outro codigo ou use o fluxo de atualizacao de preco.`;
}

export function buildProductLookupMessage(productName = "", lines = [], options = {}) {
  const safeLines = Array.isArray(lines) ? lines.filter(Boolean) : [];
  const lookupMode = String(options?.lookupMode || "").trim();
  const productCode = String(options?.productCode || "").trim();
  const firstItem = Array.isArray(options?.items) ? options.items[0] : null;

  if (lookupMode === "by_code") {
    if (!firstItem) {
      return `Nao encontrei produto com o codigo ${productCode || "informado"}.`;
    }

    return [
      `Produto encontrado para o codigo ${productCode || firstItem?.externalProductId || "informado"}:`,
      "",
      `Codigo: ${String(firstItem?.externalProductId || productCode || "").trim()}`,
      `Nome: ${String(firstItem?.name || "Produto").trim()}`,
      `Preco: ${formatMoney(firstItem?.priceCents)}`,
      String(firstItem?.description || "").trim()
        ? `Descricao: ${String(firstItem.description || "").trim()}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (!safeLines.length) {
    return `Nao encontrei produtos com nome parecido com ${String(
      productName || "essa busca",
    ).trim()}.`;
  }

  return [
    `Produtos encontrados para ${String(productName || "essa busca").trim()}:`,
    "",
    ...safeLines,
  ].join("\n");
}

export function buildPendingOffersEmptyMessage() {
  return "Nao ha cobrancas pendentes no momento.";
}

export function buildPendingOffersSummaryMessage(offers = []) {
  const safeOffers = Array.isArray(offers) ? offers : [];
  const lines = [
    `Propostas aguardando pagamento agora: ${safeOffers.length}`,
    "",
  ];

  safeOffers.forEach((offer, index) => {
    lines.push(
      `${index + 1}. ${String(offer?.displayLabel || "").trim() || "Proposta pendente"}`,
    );
  });

  return lines.join("\n").trim();
}

export function buildOfferAmbiguityQuestion(candidates = [], actionLabel = "essa proposta") {
  const options = candidates
    .map(
      (candidate, index) =>
        `${index + 1}. ${String(candidate?.displayLabel || "").trim() || "Proposta"}`,
    )
    .join("\n");

  return `Encontrei ${candidates.length} propostas para ${actionLabel}. Responda com o numero:\n${options}`;
}

export function buildOfferReminderConfirmation(candidate = {}) {
  const createdAt =
    formatAgendaDateTime(candidate?.createdAt, "America/Sao_Paulo") || "--";
  const expiresAt = candidate?.expiresAt
    ? formatAgendaDateTime(candidate.expiresAt, "America/Sao_Paulo")
    : "";

  return [
    "Confirma o envio do lembrete desta proposta?",
    "",
    `Cliente: ${String(candidate?.customerName || "Cliente").trim()}`,
    `Proposta: ${String(candidate?.title || "Proposta").trim()}`,
    `Valor: ${formatMoney(candidate?.totalCents)}`,
    `Criada em: ${createdAt}`,
    expiresAt ? `Vence em: ${expiresAt}` : "",
    "",
    "Digite CONFIRMAR para continuar ou CANCELAR para desistir.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildOfferCancelConfirmation(candidate = {}) {
  const createdAt =
    formatAgendaDateTime(candidate?.createdAt, "America/Sao_Paulo") || "--";
  const expiresAt = candidate?.expiresAt
    ? formatAgendaDateTime(candidate.expiresAt, "America/Sao_Paulo")
    : "";

  return [
    "Confirma o cancelamento desta proposta?",
    "",
    `Cliente: ${String(candidate?.customerName || "Cliente").trim()}`,
    `Proposta: ${String(candidate?.title || "Proposta").trim()}`,
    `Valor: ${formatMoney(candidate?.totalCents)}`,
    `Criada em: ${createdAt}`,
    expiresAt ? `Vence em: ${expiresAt}` : "",
    "",
    "Digite CONFIRMAR para continuar ou CANCELAR para desistir.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildOfferReminderResultMessage(candidate = {}, result = {}) {
  const customerName = String(candidate?.customerName || "o cliente").trim();

  if (result?.status === "sent") {
    return `Lembrete enviado com sucesso para ${customerName}.`;
  }

  if (result?.status === "queued") {
    return `Lembrete enfileirado com sucesso para ${customerName}.`;
  }

  if (result?.status === "skipped") {
    return `Nao foi possivel enviar o lembrete para ${customerName}: ${String(
      result?.reason || "regra nao permitiu o envio",
    ).trim()}.`;
  }

  return `Nao consegui enviar o lembrete para ${customerName} agora.`;
}

export function buildOfferCancelledSuccessMessage(candidate = {}) {
  return `Proposta cancelada com sucesso para ${String(
    candidate?.customerName || "o cliente",
  ).trim()}.`;
}

export function buildProcessingMessage() {
  return "Sua solicitacao ainda esta sendo processada. Aguarde alguns instantes.";
}

export function buildWeeklyAgendaMessage({
  startDateISO = "",
  endDateISO = "",
  days = [],
  timeZone = "America/Sao_Paulo",
} = {}) {
  const lines = [
    "✨ *SUA AGENDA DA SEMANA* ✨",
    `🗓️ ${formatAgendaDate(startDateISO, timeZone)} ate ${formatAgendaDate(
      endDateISO,
      timeZone,
    )}`,
    "",
  ];

  if (!Array.isArray(days) || !days.length) {
    lines.push("Nenhum compromisso encontrado nos proximos 7 dias.");
  } else {
    days.forEach((day) => {
      lines.push(`*${formatAgendaDate(day?.dateISO, timeZone)}*`);
      if (!Array.isArray(day?.items) || !day.items.length) {
        lines.push("Livre");
      } else {
        day.items.forEach((item) => {
          lines.push(
            `- ${String(item?.timeLabel || "").trim().replace(" - ", " — ")} | ${String(
              item?.customerName || "Cliente",
            ).trim()} | ${String(item?.offerTitle || "Servico").trim()}`,
          );
        });
      }
      lines.push("");
    });
  }

  return lines.join("\n").trim();
}

export function buildNextBookingMessage(candidate = {}) {
  if (!candidate?.bookingId) {
    return "Nao encontrei um proximo compromisso na sua agenda.";
  }

  return [
    "📍 *PROXIMO COMPROMISSO*",
    "",
    `Cliente: ${String(candidate?.customerName || "Cliente").trim()}`,
    `Servico: ${String(candidate?.offerTitle || "Servico").trim()}`,
    `Horario: ${formatAgendaDateTime(candidate?.startAt, candidate?.timeZone)}`,
    `Status: ${String(candidate?.status || "").trim() || "CONFIRMED"}`,
  ].join("\n");
}

export function buildMissingBookingTimeQuestion(candidate = {}) {
  return [
    "Qual e o novo horario do compromisso?",
    `Atual: ${formatAgendaDateTime(candidate?.startAt, candidate?.timeZone)}`,
    "Exemplo: 14:00 ou 21/03/2026 14:00",
  ].join("\n");
}

export function buildBookingRescheduleConfirmation(candidate = {}, nextSchedule = {}) {
  return [
    "Confirma o reagendamento deste compromisso?",
    "",
    `Cliente: ${String(candidate?.customerName || "Cliente").trim()}`,
    `Servico: ${String(candidate?.offerTitle || "Servico").trim()}`,
    `Horario atual: ${formatAgendaDateTime(candidate?.startAt, candidate?.timeZone)}`,
    `Novo horario: ${formatAgendaDateTime(
      nextSchedule?.startAt,
      candidate?.timeZone,
    )}`,
    "",
    "Digite CONFIRMAR para continuar ou CANCELAR para desistir.",
  ].join("\n");
}

export function buildBookingCancelConfirmation(candidate = {}) {
  return [
    "Confirma o cancelamento deste compromisso?",
    "",
    `Cliente: ${String(candidate?.customerName || "Cliente").trim()}`,
    `Servico: ${String(candidate?.offerTitle || "Servico").trim()}`,
    `Horario atual: ${formatAgendaDateTime(candidate?.startAt, candidate?.timeZone)}`,
    "",
    "Digite CONFIRMAR para continuar ou CANCELAR para desistir.",
  ].join("\n");
}

export function buildBookingRescheduledSuccessMessage(candidate = {}, nextSchedule = {}) {
  return `Compromisso reagendado com sucesso para ${formatAgendaDateTime(
    nextSchedule?.startAt,
    candidate?.timeZone,
  )}.`;
}

export function buildBookingCancelledSuccessMessage(candidate = {}) {
  return `Compromisso cancelado com sucesso: ${formatAgendaDateTime(
    candidate?.startAt,
    candidate?.timeZone,
  )}.`;
}

export function buildAgendaFreeDayMessage({
  dayLabel = "hoje",
  dateISO = "",
  timeZone = "America/Sao_Paulo",
} = {}) {
  return [
    "✨ *SUA AGENDA DO DIA* ✨",
    `🗓️ ${formatAgendaDate(dateISO, timeZone)}`,
    "",
    `Sua agenda de ${String(dayLabel || "hoje").trim()} esta livre.`,
    "",
    "🚀 *Meta do dia:*",
    buildAgendaDailyGoal({ dayLabel, summary: { total: 0 }, items: [] }),
  ].join("\n");
}

export function buildAgendaSummaryMessage({
  dayLabel = "hoje",
  dateISO = "",
  timeZone = "America/Sao_Paulo",
  summary = {},
  items = [],
} = {}) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const lines = [
    "✨ *SUA AGENDA DO DIA* ✨",
    `🗓️ ${formatAgendaDate(dateISO, timeZone)}`,
  ];

  if (normalizedItems.length) {
    lines.push("");
    normalizedItems.forEach((item) => {
      lines.push("━━━━━━━━━━━━━━");
      lines.push(
        `⏰ *${String(item?.timeLabel || "").trim().replace(" - ", " — ")}*`,
      );
      lines.push(
        `${resolveAgendaItemIcon(item)} ${String(
          item?.offerTitle || "Servico",
        ).trim()}`,
      );
      lines.push(`👤 ${String(item?.customerName || "Cliente").trim()}`);
      lines.push("━━━━━━━━━━━━━━");
      lines.push("");
    });
  }

  lines.push("🚀 *Meta do dia:*");
  lines.push(buildAgendaDailyGoal({ dayLabel, summary, items: normalizedItems }));

  return lines.join("\n");
}
