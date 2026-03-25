import { canAccessWorkspaceModule } from "../utils/workspaceAccess.js";

const TERMINAL_STATES = new Set(["COMPLETED", "CANCELLED", "ERROR", "EXPIRED"]);

const FLOW_LABELS = {
  offer_create: "Proposta",
  offer_query: "Propostas",
  offer_payment_reminder: "Cobranca",
  offer_cancel: "Cancelamento de proposta",
  client_create: "Cadastro de cliente",
  product_create: "Cadastro de produto",
  product_update: "Atualizacao de produto",
  lookup_query: "Consulta rapida",
  agenda_query: "Agenda",
  booking_reschedule: "Reagendamento",
  booking_cancel: "Cancelamento de compromisso",
  intent_disambiguation: "Nova conversa",
};

export function buildWebAgentRequesterKey(userId) {
  return `web-user:${String(userId || "").trim()}`;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function compactWhitespace(value) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function normalizeComparableText(value) {
  return compactWhitespace(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function firstName(value) {
  const normalized = compactWhitespace(value);
  return normalized ? normalized.split(" ")[0] : "";
}

function lowerFirst(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  return normalized.charAt(0).toLowerCase() + normalized.slice(1);
}

function candidateReply(label, value, variant = "default") {
  return {
    label: compactWhitespace(label),
    value: String(value || "").trim(),
    variant: variant === "danger" ? "danger" : "default",
  };
}

function buildSuggestedActionConfig({
  categoryKey,
  key,
  label,
  description,
  value,
  routingIntent,
  flowType,
  moduleKey,
  destructive = false,
  matchPhrases = [],
}) {
  const normalizedMatches = Array.from(
    new Set(
      [label, value, ...matchPhrases]
        .map((item) => normalizeComparableText(item))
        .filter(Boolean),
    ),
  );

  return {
    categoryKey: String(categoryKey || "").trim(),
    categoryLabel: "",
    actionKey: String(key || "").trim(),
    key,
    label: compactWhitespace(label),
    description: compactWhitespace(description || ""),
    value: compactWhitespace(value),
    routingIntent: String(routingIntent || "").trim(),
    flowType: String(flowType || "").trim(),
    moduleKey: String(moduleKey || "").trim(),
    destructive: destructive === true,
    matchPhrases: normalizedMatches,
  };
}

const ACTION_CATEGORY_ORDER = ["proposal", "agenda", "billing", "registry"];

const ACTION_CATEGORY_LABELS = Object.freeze({
  proposal: "Proposta",
  agenda: "Agenda",
  billing: "Cobranca",
  registry: "Cadastro",
});

const WEB_AGENT_ACTIONS = [
  buildSuggestedActionConfig({
    categoryKey: "proposal",
    key: "offer_create",
    label: "Proposta",
    description: "Criar e enviar uma nova proposta para o cliente.",
    value: "Quero criar uma proposta",
    routingIntent: "create_offer_send_whatsapp",
    flowType: "offer_create",
    moduleKey: "newOffer",
    matchPhrases: ["Criar proposta"],
  }),
  buildSuggestedActionConfig({
    categoryKey: "agenda",
    key: "agenda_today",
    label: "Agenda de hoje",
    description: "Ver os compromissos do dia na sua carteira.",
    value: "Qual e a minha agenda de hoje?",
    routingIntent: "query_daily_agenda",
    flowType: "agenda_query",
    moduleKey: "calendar",
    matchPhrases: ["Minha agenda de hoje"],
  }),
  buildSuggestedActionConfig({
    categoryKey: "agenda",
    key: "agenda_week",
    label: "Agenda da semana",
    description: "Consultar a agenda consolidada dos proximos 7 dias.",
    value: "Quero ver a agenda da semana",
    routingIntent: "query_weekly_agenda",
    flowType: "agenda_query",
    moduleKey: "calendar",
    matchPhrases: ["Agenda semanal", "Agenda da semana"],
  }),
  buildSuggestedActionConfig({
    categoryKey: "agenda",
    key: "next_booking",
    label: "Proximo compromisso",
    description: "Descobrir qual e o seu proximo atendimento agendado.",
    value: "Qual e o meu proximo compromisso?",
    routingIntent: "query_next_booking",
    flowType: "agenda_query",
    moduleKey: "calendar",
    matchPhrases: ["Proximo agendamento", "Proximo compromisso"],
  }),
  buildSuggestedActionConfig({
    categoryKey: "agenda",
    key: "booking_reschedule",
    label: "Reagendar compromisso",
    description: "Mover um compromisso para nova data e horario.",
    value: "Quero reagendar um compromisso",
    routingIntent: "reschedule_booking",
    flowType: "booking_reschedule",
    moduleKey: "calendar",
    matchPhrases: ["Reagendar compromisso", "Reagendar agendamento"],
  }),
  buildSuggestedActionConfig({
    categoryKey: "agenda",
    key: "booking_cancel",
    label: "Cancelar compromisso",
    description: "Cancelar um compromisso da agenda.",
    value: "Quero cancelar um compromisso",
    routingIntent: "cancel_booking",
    flowType: "booking_cancel",
    moduleKey: "calendar",
    destructive: true,
    matchPhrases: ["Cancelar compromisso", "Cancelar agendamento"],
  }),
  buildSuggestedActionConfig({
    categoryKey: "billing",
    key: "billing_due_today",
    label: "Quem preciso cobrar hoje?",
    description: "Listar as cobrancas que vencem hoje na sua carteira.",
    value: "Quem preciso cobrar hoje?",
    routingIntent: "query_due_today_offers",
    flowType: "offer_query",
    moduleKey: "offers",
    matchPhrases: ["Quem cobrar hoje", "Cobrar vencidas de hoje"],
  }),
  buildSuggestedActionConfig({
    categoryKey: "billing",
    key: "pending_offers",
    label: "Montar lista de pendentes",
    description: "Montar uma lista rapida das propostas pendentes da carteira.",
    value: "Quero montar a lista de propostas pendentes",
    routingIntent: "query_pending_offers",
    flowType: "offer_query",
    moduleKey: "offers",
    matchPhrases: ["Propostas pendentes", "Consultar pendentes", "Lista de pendentes"],
  }),
  buildSuggestedActionConfig({
    categoryKey: "billing",
    key: "offer_payment_reminder",
    label: "Enviar lembrete para uma proposta",
    description: "Escolher uma proposta e revisar a cobranca antes do envio.",
    value: "Quero enviar lembrete para uma proposta",
    routingIntent: "send_offer_payment_reminder",
    flowType: "offer_payment_reminder",
    moduleKey: "offers",
    matchPhrases: ["Cobrar cliente", "Enviar cobranca", "Enviar lembrete para proposta"],
  }),
  buildSuggestedActionConfig({
    categoryKey: "billing",
    key: "billing_followup_stale",
    label: "Retomar propostas sem resposta",
    description: "Localizar propostas que pedem follow-up de cobranca.",
    value: "Quero retomar propostas sem resposta",
    routingIntent: "query_stale_offer_followups",
    flowType: "offer_query",
    moduleKey: "offers",
    matchPhrases: ["Retomar propostas sem resposta", "Propostas sem resposta"],
  }),
  buildSuggestedActionConfig({
    categoryKey: "billing",
    key: "billing_priorities",
    label: "Ver minhas prioridades do dia",
    description: "Resumo rapido do que pedir follow-up agora na cobranca.",
    value: "Quero ver minhas prioridades de cobranca do dia",
    routingIntent: "query_billing_priorities",
    flowType: "offer_query",
    moduleKey: "offers",
    matchPhrases: ["Minhas prioridades do dia", "Prioridades de cobranca"],
  }),
  buildSuggestedActionConfig({
    categoryKey: "billing",
    key: "billing_overdue",
    label: "Ver cobrancas atrasadas",
    description: "Listar as propostas que ja passaram do vencimento.",
    value: "Quais cobrancas atrasadas eu tenho?",
    routingIntent: "query_overdue_offers",
    flowType: "offer_query",
    moduleKey: "offers",
    matchPhrases: ["Cobrancas atrasadas", "Propostas atrasadas"],
  }),
  buildSuggestedActionConfig({
    categoryKey: "billing",
    key: "offer_cancel",
    label: "Cancelar proposta",
    description: "Cancelar uma proposta existente.",
    value: "Quero cancelar uma proposta",
    routingIntent: "cancel_offer",
    flowType: "offer_cancel",
    moduleKey: "offers",
    destructive: true,
    matchPhrases: ["Cancelar proposta"],
  }),
  buildSuggestedActionConfig({
    categoryKey: "registry",
    key: "client_create",
    label: "Cadastrar cliente",
    description: "Criar um novo cliente na carteira.",
    value: "Quero cadastrar um cliente",
    routingIntent: "create_client",
    flowType: "client_create",
    moduleKey: "clients",
    matchPhrases: ["Cadastrar cliente"],
  }),
  buildSuggestedActionConfig({
    categoryKey: "registry",
    key: "client_lookup_phone",
    label: "Consultar telefone do cliente",
    description: "Buscar o telefone de um cliente ja cadastrado.",
    value: "Quero consultar o telefone de um cliente",
    routingIntent: "lookup_client_phone",
    flowType: "lookup_query",
    moduleKey: "clients",
    matchPhrases: ["Consultar telefone do cliente", "Buscar telefone do cliente"],
  }),
  buildSuggestedActionConfig({
    categoryKey: "registry",
    key: "product_create",
    label: "Cadastrar produto",
    description: "Criar um novo produto ou servico no catalogo.",
    value: "Quero cadastrar um produto",
    routingIntent: "create_product",
    flowType: "product_create",
    moduleKey: "products",
    matchPhrases: ["Cadastrar produto"],
  }),
  buildSuggestedActionConfig({
    categoryKey: "registry",
    key: "product_update_price",
    label: "Atualizar preco",
    description: "Alterar o preco de um produto ou servico.",
    value: "Quero atualizar o preco de um produto",
    routingIntent: "update_product_price",
    flowType: "product_update",
    moduleKey: "products",
    matchPhrases: ["Atualizar preco", "Alterar preco do produto"],
  }),
  buildSuggestedActionConfig({
    categoryKey: "registry",
    key: "product_lookup",
    label: "Consultar produto",
    description: "Buscar dados de um produto pelo nome ou codigo.",
    value: "Quero consultar um produto",
    routingIntent: "lookup_product",
    flowType: "lookup_query",
    moduleKey: "products",
    matchPhrases: ["Consultar produto", "Buscar produto"],
  }),
];

for (const action of WEB_AGENT_ACTIONS) {
  action.categoryLabel = ACTION_CATEGORY_LABELS[action.categoryKey] || action.categoryKey;
}

function buildSelectionReplies(items = [], { limit = null } = {}) {
  const source =
    Number.isInteger(limit) && limit >= 0 ? items.slice(0, limit) : [...items];

  return source
    .map((item, index) => {
      const label = compactWhitespace(
        item?.displayLabel ||
          item?.fullName ||
          item?.name ||
          item?.title ||
          `Opcao ${index + 1}`,
      );
      return candidateReply(label, String(index + 1));
    });
}

function buildReplyControls(session = null) {
  if (!session?._id) return null;

  const state = String(session.state || "").trim().toUpperCase();
  const lastQuestionKey = String(session.lastQuestionKey || "").trim();
  const title = compactWhitespace(
    String(session.lastQuestionText || "Escolha uma opcao")
      .split(/\r?\n/)[0]
      .trim(),
  );

  if (state === "AWAITING_INTENT_SELECTION") {
    if (lastQuestionKey === "intent_selection") {
      return {
        presentation: "chips",
        options: [
          candidateReply("Proposta", "1"),
          candidateReply("Agenda", "2"),
          candidateReply("Cancelar", "CANCELAR", "danger"),
        ],
      };
    }

    if (lastQuestionKey === "booking_operation_selection") {
      return {
        presentation: "chips",
        options: [
          candidateReply("Consultar agenda", "1"),
          candidateReply("Reagendar", "2"),
          candidateReply("Cancelar compromisso", "3", "danger"),
          candidateReply("Cancelar", "CANCELAR", "danger"),
        ],
      };
    }

    if (lastQuestionKey === "offer_sales_operation_selection") {
      return {
        presentation: "chips",
        options: [
          candidateReply("Pendentes", "1"),
          candidateReply("Cobrar cliente", "2"),
          candidateReply("Cancelar proposta", "3", "danger"),
          candidateReply("Cancelar", "CANCELAR", "danger"),
        ],
      };
    }

    if (lastQuestionKey === "backoffice_operation_selection") {
      return {
        presentation: "chips",
        options: [
          candidateReply("Cadastrar cliente", "1"),
          candidateReply("Cadastrar produto", "2"),
          candidateReply("Atualizar preco", "3"),
          candidateReply("Consultar dados", "4"),
          candidateReply("Cancelar", "CANCELAR", "danger"),
        ],
      };
    }

    if (lastQuestionKey === "offer_sales_context_switch") {
      return {
        presentation: "chips",
        options: [
          candidateReply("Continuar proposta", "1"),
          candidateReply("Cobranca e vendas", "2"),
          candidateReply("Cancelar", "CANCELAR", "danger"),
        ],
      };
    }

    if (lastQuestionKey === "backoffice_context_switch") {
      return {
        presentation: "chips",
        options: [
          candidateReply("Continuar proposta", "1"),
          candidateReply("Cadastro e backoffice", "2"),
          candidateReply("Cancelar", "CANCELAR", "danger"),
        ],
      };
    }
  }

  if (
    [
      "AWAITING_CONFIRMATION",
      "AWAITING_BOOKING_CHANGE_CONFIRMATION",
      "AWAITING_OFFER_ACTION_CONFIRMATION",
      "AWAITING_BACKOFFICE_ACTION_CONFIRMATION",
    ].includes(state)
  ) {
    return {
      presentation: "chips",
      options: [
        candidateReply("Confirmar", "CONFIRMAR"),
        candidateReply("Cancelar", "CANCELAR", "danger"),
      ],
    };
  }

  if (state === "AWAITING_CUSTOMER_SELECTION") {
    if (lastQuestionKey === "client_create_existing_selection") {
      return {
        presentation: "selector",
        title,
        options: [
          ...buildSelectionReplies(session.candidateCustomers || []),
          candidateReply("Novo cadastro", "NOVO"),
          candidateReply("Cancelar", "CANCELAR", "danger"),
        ],
      };
    }

    return {
      presentation: "selector",
      title,
      options: [
        ...buildSelectionReplies(session.candidateCustomers || []),
        candidateReply("Cancelar", "CANCELAR", "danger"),
      ],
    };
  }

  if (state === "AWAITING_PRODUCT_SELECTION") {
    return {
      presentation: "selector",
      title,
      options: [
        ...buildSelectionReplies(session.candidateProducts || []),
        candidateReply("Cancelar", "CANCELAR", "danger"),
      ],
    };
  }

  if (state === "AWAITING_BOOKING_SELECTION") {
    return {
      presentation: "selector",
      title,
      options: [
        ...buildSelectionReplies(session.candidateBookings || []),
        candidateReply("Cancelar", "CANCELAR", "danger"),
      ],
    };
  }

  if (state === "AWAITING_OFFER_SELECTION") {
    return {
      presentation: "selector",
      title,
      options: [
        ...buildSelectionReplies(session.candidateOffers || []),
        candidateReply("Cancelar", "CANCELAR", "danger"),
      ],
    };
  }

  return null;
}

function resolveSessionPreview(session = null) {
  if (!session) return "";

  const candidates = [
    session?.lastQuestionText,
    session?.confirmationSummaryText,
    session?.lastUserMessageText,
  ];

  const found = candidates.find((value) => normalizeText(value));
  return compactWhitespace(found || "");
}

export function serializeWebAgentSession(session = null) {
  if (!session?._id) return null;

  return {
    _id: String(session._id),
    sourceChannel: String(session.sourceChannel || "whatsapp"),
    flowType: String(session.flowType || "offer_create"),
    flowLabel:
      FLOW_LABELS[String(session.flowType || "").trim()] || "Nova conversa",
    state: String(session.state || "NEW"),
    preview: resolveSessionPreview(session),
    pendingFields: Array.isArray(session.pendingFields) ? session.pendingFields : [],
    lastQuestionKey: String(session.lastQuestionKey || "").trim(),
    lastQuestionText: normalizeText(session.lastQuestionText || ""),
    createdAt: session.createdAt || null,
    updatedAt: session.updatedAt || null,
    completedAt: session.completedAt || null,
    cancelledAt: session.cancelledAt || null,
    expiresAt: session.expiresAt || null,
    isTerminal: TERMINAL_STATES.has(String(session.state || "").trim().toUpperCase()),
  };
}

export function serializeWebAgentMessages(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    _id: String(item?._id || ""),
    role: String(item?.role || "assistant"),
    inputType: String(item?.inputType || "text"),
    text: normalizeText(item?.text || ""),
    createdAt: item?.createdAt || null,
  }));
}

export function buildLuminaWelcomeMessage(userName = "") {
  const greetingName = firstName(userName);
  const salutation = greetingName ? `Oi, ${greetingName}!` : "Oi!";

  return [
    `${salutation} Eu sou a Lumina.`,
    "Posso te ajudar com proposta, agenda, cobranca e cadastros da sua carteira aqui no site.",
    "Se quiser, me diga a tarefa em linguagem natural ou toque em uma das acoes rapidas abaixo.",
  ].join(" ");
}

export function buildWebModuleAccessDeniedMessage(moduleKey = "") {
  const labels = {
    newOffer: "propostas",
    offers: "propostas e cobrancas",
    calendar: "agenda",
    clients: "clientes",
    products: "produtos",
    reports: "relatorios",
  };

  const label = labels[String(moduleKey || "").trim()] || "esse modulo";
  return `Consigo te ajudar com isso assim que o modulo de ${label} estiver liberado para o seu usuario. Hoje esse acesso nao esta disponivel para a sua conta.`;
}

function canShowActionForUser(action, user = null) {
  if (!action?.moduleKey || !user) return true;
  return canAccessWorkspaceModule({
    user,
    workspacePlan: user?.workspacePlan,
    workspaceOwnerUserId: user?.workspaceOwnerUserId,
    moduleKey: action.moduleKey,
  });
}

function serializeWebAgentAction(action) {
  return {
    categoryKey: action.categoryKey,
    categoryLabel: action.categoryLabel,
    actionKey: action.actionKey,
    label: action.label,
    description: action.description,
    value: action.value,
    routingIntent: action.routingIntent,
    flowType: action.flowType,
    moduleKey: action.moduleKey,
    destructive: action.destructive === true,
  };
}

function listVisibleWebAgentActions(user = null) {
  return WEB_AGENT_ACTIONS.filter((action) => canShowActionForUser(action, user));
}

export function buildWebAgentActionMenu(user = null) {
  const visibleActions = listVisibleWebAgentActions(user);

  return ACTION_CATEGORY_ORDER.map((categoryKey) => {
    const actions = visibleActions
      .filter((action) => action.categoryKey === categoryKey)
      .sort((left, right) => Number(left.destructive === true) - Number(right.destructive === true))
      .map((action) => serializeWebAgentAction(action));

    if (!actions.length) return null;

    return {
      categoryKey,
      categoryLabel: ACTION_CATEGORY_LABELS[categoryKey] || categoryKey,
      actions,
    };
  }).filter(Boolean);
}

export function buildWebAgentSuggestedActions(user = null) {
  const preferredKeys = [
    "offer_create",
    "agenda_today",
    "billing_priorities",
    "client_create",
  ];

  return preferredKeys
    .map((key) => WEB_AGENT_ACTIONS.find((action) => action.actionKey === key) || null)
    .filter((action) => action && canShowActionForUser(action, user))
    .map((action) => serializeWebAgentAction(action));
}

export function getWebAgentActionByKey(actionKey = "", user = null) {
  const normalizedKey = String(actionKey || "").trim();
  if (!normalizedKey) return null;

  const found = WEB_AGENT_ACTIONS.find((action) => action.actionKey === normalizedKey);
  if (!found || !canShowActionForUser(found, user)) return null;
  return { ...found };
}

export function resolveWebAgentActionInput({
  actionKey = "",
  value = "",
  user = null,
} = {}) {
  const explicitAction = getWebAgentActionByKey(actionKey, user);
  if (explicitAction) return explicitAction;

  const normalized = normalizeComparableText(value);
  if (!normalized) return null;

  const matched = WEB_AGENT_ACTIONS.find(
    (action) =>
      canShowActionForUser(action, user) &&
      action.matchPhrases.includes(normalized),
  );

  return matched ? { ...matched } : null;
}

export function resolveWebAgentSuggestedAction(value = "", user = null) {
  return resolveWebAgentActionInput({ value, user });
}

export function humanizeLuminaMessage({ message, session = null }) {
  const text = normalizeText(message);
  if (!text || session?.sourceChannel !== "web") return text;

  if (/^Qual e /i.test(text)) {
    return `Perfeito. ${text}`;
  }

  if (/^Confirma/i.test(text)) {
    return `Revisei tudo aqui. ${text}`;
  }

  if (/^Encontrei \d+/i.test(text)) {
    return `Achei algumas opcoes para voce. ${text}`;
  }

  if (/^Nao consegui/i.test(text)) {
    return `Tive um problema por aqui. ${lowerFirst(text)}`;
  }

  if (/^Processando/i.test(text)) {
    return `Estou cuidando disso agora. ${text}`;
  }

  return text;
}

export function buildWebAgentUiPayload(sessionOrOptions = null, maybeUser = null) {
  const config =
    sessionOrOptions &&
    typeof sessionOrOptions === "object" &&
    !Array.isArray(sessionOrOptions) &&
    ("session" in sessionOrOptions || "user" in sessionOrOptions)
      ? sessionOrOptions
      : { session: sessionOrOptions, user: maybeUser };

  const session = config?.session || null;
  const user = config?.user || null;
  const actionMenu = buildWebAgentActionMenu(user);
  const suggestedActions = buildWebAgentSuggestedActions(user);
  const replyControls = buildReplyControls(session);

  if (!session?._id) {
    return {
      quickReplies: [],
      replyControls: null,
      suggestedActions,
      actionMenu,
      composerPlaceholder: "Fale com a Lumina sobre proposta, agenda, cobranca ou cadastro",
      headerSubtitle: "Agente operacional da sua carteira",
    };
  }

  const state = String(session.state || "").trim().toUpperCase();
  const lastQuestionKey = String(session.lastQuestionKey || "").trim();
  let quickReplies = Array.isArray(replyControls?.options) ? replyControls.options : [];

  if (state === "AWAITING_INTENT_SELECTION" && quickReplies.length === 0) {
    if (lastQuestionKey === "intent_selection") {
      quickReplies = [
        candidateReply("Proposta", "1"),
        candidateReply("Agenda", "2"),
        candidateReply("Cancelar", "CANCELAR", "danger"),
      ];
    } else if (lastQuestionKey === "booking_operation_selection") {
      quickReplies = [
        candidateReply("Consultar agenda", "1"),
        candidateReply("Reagendar", "2"),
        candidateReply("Cancelar compromisso", "3", "danger"),
        candidateReply("Cancelar", "CANCELAR", "danger"),
      ];
    } else if (lastQuestionKey === "offer_sales_operation_selection") {
      quickReplies = [
        candidateReply("Pendentes", "1"),
        candidateReply("Cobrar cliente", "2"),
        candidateReply("Cancelar proposta", "3", "danger"),
        candidateReply("Cancelar", "CANCELAR", "danger"),
      ];
    } else if (lastQuestionKey === "backoffice_operation_selection") {
      quickReplies = [
        candidateReply("Cadastrar cliente", "1"),
        candidateReply("Cadastrar produto", "2"),
        candidateReply("Atualizar preco", "3"),
        candidateReply("Consultar dados", "4"),
        candidateReply("Cancelar", "CANCELAR", "danger"),
      ];
    }
  } else if (
    [
      "AWAITING_CONFIRMATION",
      "AWAITING_BOOKING_CHANGE_CONFIRMATION",
      "AWAITING_OFFER_ACTION_CONFIRMATION",
      "AWAITING_BACKOFFICE_ACTION_CONFIRMATION",
    ].includes(state)
    && quickReplies.length === 0
  ) {
    quickReplies = [
      candidateReply("Confirmar", "CONFIRMAR"),
      candidateReply("Cancelar", "CANCELAR", "danger"),
    ];
  } else if (state === "AWAITING_CUSTOMER_SELECTION" && quickReplies.length === 0) {
    quickReplies = [
      ...buildSelectionReplies(session.candidateCustomers || [], { limit: 6 }),
      ...(lastQuestionKey === "client_create_existing_selection"
        ? [candidateReply("Novo cadastro", "NOVO")]
        : []),
      candidateReply("Cancelar", "CANCELAR", "danger"),
    ];
  } else if (state === "AWAITING_PRODUCT_SELECTION" && quickReplies.length === 0) {
    quickReplies = [
      ...buildSelectionReplies(session.candidateProducts || [], { limit: 6 }),
      candidateReply("Cancelar", "CANCELAR", "danger"),
    ];
  } else if (state === "AWAITING_BOOKING_SELECTION" && quickReplies.length === 0) {
    quickReplies = [
      ...buildSelectionReplies(session.candidateBookings || [], { limit: 6 }),
      candidateReply("Cancelar", "CANCELAR", "danger"),
    ];
  } else if (state === "AWAITING_OFFER_SELECTION" && quickReplies.length === 0) {
    quickReplies = [
      ...buildSelectionReplies(session.candidateOffers || [], { limit: 6 }),
      candidateReply("Cancelar", "CANCELAR", "danger"),
    ];
  }

  return {
    quickReplies,
    replyControls,
    suggestedActions,
    actionMenu,
    composerPlaceholder:
      quickReplies.length > 0 || replyControls
        ? "Toque em uma acao rapida ou responda em texto"
        : "Escreva sua proxima mensagem para a Lumina",
    headerSubtitle: "Agente operacional da sua carteira",
  };
}
