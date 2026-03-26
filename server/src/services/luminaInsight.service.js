import { Offer } from "../models/Offer.js";
import { WhatsAppCommandSession } from "../models/WhatsAppCommandSession.js";
import { buildGeneralReportsSnapshot } from "./generalReports.service.js";
import {
  buildOfferOpportunityLine,
  groupPendingOfferAutomations,
} from "./webAgentAutomation.service.js";
import {
  getDateIsoForTimeZone,
  getWorkspaceAgendaTimeZone,
  shiftDateIso,
} from "./whatsapp-ai/whatsappAgendaQuery.service.js";
import {
  getIntentExtractionModel,
  getOpenAIClient,
  isWhatsAppAiEnabled,
} from "./whatsapp-ai/openai.client.js";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DEFAULT_WINDOW_DAYS = 30;
const DAILY_INSIGHT_LIMIT = 1;
const OFFER_TERMINAL_STATUSES = ["EXPIRED", "CANCELLED", "CANCELED", "CONFIRMED", "PAID"];
const PAID_SET = ["PAID", "CONFIRMED"];

function compactWhitespace(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function rangeInSaoPaulo(fromYMD, toYMD) {
  const start = new Date(`${String(fromYMD || "").trim()}T00:00:00-03:00`);
  const endZero = new Date(`${String(toYMD || "").trim()}T00:00:00-03:00`);
  const end = new Date(endZero.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function buildTodayInsightWindow(now = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const todayYMD = getDateIsoForTimeZone(now, timeZone);
  return {
    todayYMD,
    ...rangeInSaoPaulo(todayYMD, todayYMD),
  };
}

export function buildLuminaInsightLimitMessage() {
  return "O Insight da Lumina ja foi usado hoje. Ele fica disponivel novamente amanha.";
}

export async function getLuminaInsightUsageStatus({
  user,
  now = new Date(),
  timeZone = DEFAULT_TIMEZONE,
} = {}) {
  if (!user?._id) {
    return {
      enabled: false,
      dailyLimit: DAILY_INSIGHT_LIMIT,
      usedToday: false,
      remainingToday: 0,
      resetsAt: null,
      blockedReason: "",
    };
  }

  const { start, end } = buildTodayInsightWindow(now, timeZone);
  const usedToday = !!(await WhatsAppCommandSession.exists({
    userId: user._id,
    sourceChannel: "web",
    insightGeneratedAt: {
      $gte: start,
      $lt: end,
    },
  }));

  return {
    enabled: true,
    dailyLimit: DAILY_INSIGHT_LIMIT,
    usedToday,
    remainingToday: usedToday ? 0 : DAILY_INSIGHT_LIMIT,
    resetsAt: end.toISOString(),
    blockedReason: usedToday ? buildLuminaInsightLimitMessage() : "",
  };
}

function formatDate(value, timeZone = DEFAULT_TIMEZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone,
      day: "2-digit",
      month: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

function formatDateTime(value, timeZone = DEFAULT_TIMEZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

function formatCurrency(cents) {
  const value = Number(cents);
  if (!Number.isFinite(value)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function buildWindows(
  now = new Date(),
  timeZone = DEFAULT_TIMEZONE,
  windowDays = DEFAULT_WINDOW_DAYS,
) {
  const todayIso = getDateIsoForTimeZone(now, timeZone);
  const currentToYMD = todayIso;
  const currentFromYMD = shiftDateIso(todayIso, -(windowDays - 1));
  const previousToYMD = shiftDateIso(currentFromYMD, -1);
  const previousFromYMD = shiftDateIso(previousToYMD, -(windowDays - 1));

  return {
    currentFromYMD,
    currentToYMD,
    previousFromYMD,
    previousToYMD,
    currentRange: rangeInSaoPaulo(currentFromYMD, currentToYMD),
    previousRange: rangeInSaoPaulo(previousFromYMD, previousToYMD),
  };
}

function addPaidFieldsStage() {
  return {
    $addFields: {
      isPaid: {
        $or: [
          { $in: ["$paymentStatus", PAID_SET] },
          { $in: ["$status", PAID_SET] },
        ],
      },
      paidDate: {
        $ifNull: [
          "$paidAt",
          { $ifNull: ["$payment.lastPixUpdatedAt", "$updatedAt"] },
        ],
      },
      paidCents: {
        $ifNull: [
          "$paidAmountCents",
          { $ifNull: ["$totalCents", "$amountCents"] },
        ],
      },
    },
  };
}

function buildScopedOfferMatch({ workspaceId, ownerUserId = null } = {}) {
  const match = { workspaceId };
  if (ownerUserId) match.ownerUserId = ownerUserId;
  return match;
}

function buildPendingOfferMatch({ workspaceId, ownerUserId = null } = {}) {
  return {
    ...buildScopedOfferMatch({ workspaceId, ownerUserId }),
    paymentStatus: "PENDING",
    status: { $nin: OFFER_TERMINAL_STATUSES },
  };
}

function formatInsightMetricLine(label, currentValue, previousValue, formatter = (value) => value) {
  return `${label}: ${formatter(currentValue)} (antes ${formatter(previousValue)})`;
}

function toPercentDelta(currentValue, previousValue) {
  const current = Number(currentValue || 0);
  const previous = Number(previousValue || 0);
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function daysSince(value, now = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = now.getTime() - date.getTime();
  return Math.max(0, Math.round(diffMs / (24 * 60 * 60 * 1000)));
}

function buildTopClientLine(item = {}) {
  return `${compactWhitespace(item.customerName || "Cliente")} - ${formatCurrency(
    item.paidRevenueCents,
  )} em ${toNumber(item.paidCount)} venda(s)`;
}

function buildTopItemLine(item = {}) {
  return `${compactWhitespace(item.description || "Produto")} - ${formatCurrency(
    item.paidRevenueCents,
  )} em ${toNumber(item.qty)} unidade(s)`;
}

async function buildCustomerSignals({
  workspaceId,
  ownerUserId = null,
  currentRange,
  previousRange,
  now = new Date(),
}) {
  const rows = await Offer.aggregate([
    { $match: buildScopedOfferMatch({ workspaceId, ownerUserId }) },
    addPaidFieldsStage(),
    {
      $match: {
        isPaid: true,
        paidDate: { $gte: previousRange.start, $lt: currentRange.end },
      },
    },
    {
      $group: {
        _id: "$customerName",
        currentPaidCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$paidDate", currentRange.start] },
                  { $lt: ["$paidDate", currentRange.end] },
                ],
              },
              1,
              0,
            ],
          },
        },
        currentRevenueCents: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$paidDate", currentRange.start] },
                  { $lt: ["$paidDate", currentRange.end] },
                ],
              },
              "$paidCents",
              0,
            ],
          },
        },
        previousPaidCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$paidDate", previousRange.start] },
                  { $lt: ["$paidDate", previousRange.end] },
                ],
              },
              1,
              0,
            ],
          },
        },
        previousRevenueCents: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$paidDate", previousRange.start] },
                  { $lt: ["$paidDate", previousRange.end] },
                ],
              },
              "$paidCents",
              0,
            ],
          },
        },
        totalPaidCount: { $sum: 1 },
        lastPaidAt: { $max: "$paidDate" },
      },
    },
    {
      $project: {
        _id: 0,
        customerName: "$_id",
        currentPaidCount: 1,
        currentRevenueCents: 1,
        previousPaidCount: 1,
        previousRevenueCents: 1,
        totalPaidCount: 1,
        lastPaidAt: 1,
      },
    },
  ]).allowDiskUse(true);

  const normalizedRows = (Array.isArray(rows) ? rows : [])
    .map((item) => ({
      customerName: compactWhitespace(item?.customerName || "Cliente"),
      currentPaidCount: toNumber(item?.currentPaidCount),
      currentRevenueCents: toNumber(item?.currentRevenueCents),
      previousPaidCount: toNumber(item?.previousPaidCount),
      previousRevenueCents: toNumber(item?.previousRevenueCents),
      totalPaidCount: toNumber(item?.totalPaidCount),
      lastPaidAt: item?.lastPaidAt || null,
      daysSinceLastPurchase: daysSince(item?.lastPaidAt, now),
    }))
    .filter((item) => item.customerName);

  const recurringCustomers = normalizedRows
    .filter((item) => item.currentPaidCount > 0 && item.totalPaidCount >= 2)
    .sort(
      (left, right) =>
        right.currentRevenueCents - left.currentRevenueCents ||
        right.currentPaidCount - left.currentPaidCount,
    )
    .slice(0, 5);

  const dormantCustomers = normalizedRows
    .filter((item) => item.previousPaidCount > 0 && item.currentPaidCount === 0)
    .sort(
      (left, right) =>
        right.previousRevenueCents - left.previousRevenueCents ||
        (right.daysSinceLastPurchase || 0) - (left.daysSinceLastPurchase || 0),
    )
    .slice(0, 5);

  return {
    recurringCustomers,
    dormantCustomers,
  };
}

async function buildProductSignals({
  workspaceId,
  ownerUserId = null,
  currentRange,
  previousRange,
}) {
  const rows = await Offer.aggregate([
    { $match: buildScopedOfferMatch({ workspaceId, ownerUserId }) },
    addPaidFieldsStage(),
    {
      $match: {
        isPaid: true,
        paidDate: { $gte: previousRange.start, $lt: currentRange.end },
      },
    },
    { $unwind: { path: "$items", preserveNullAndEmptyArrays: false } },
    {
      $addFields: {
        itemDescription: {
          $trim: {
            input: {
              $ifNull: ["$items.description", "$title"],
            },
          },
        },
        itemQty: { $ifNull: ["$items.qty", 1] },
        itemRevenueCents: {
          $ifNull: [
            "$items.lineTotalCents",
            {
              $multiply: [
                { $ifNull: ["$items.qty", 1] },
                { $ifNull: ["$items.unitPriceCents", 0] },
              ],
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: "$itemDescription",
        currentRevenueCents: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$paidDate", currentRange.start] },
                  { $lt: ["$paidDate", currentRange.end] },
                ],
              },
              "$itemRevenueCents",
              0,
            ],
          },
        },
        currentQty: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$paidDate", currentRange.start] },
                  { $lt: ["$paidDate", currentRange.end] },
                ],
              },
              "$itemQty",
              0,
            ],
          },
        },
        previousRevenueCents: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$paidDate", previousRange.start] },
                  { $lt: ["$paidDate", previousRange.end] },
                ],
              },
              "$itemRevenueCents",
              0,
            ],
          },
        },
        previousQty: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$paidDate", previousRange.start] },
                  { $lt: ["$paidDate", previousRange.end] },
                ],
              },
              "$itemQty",
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        description: "$_id",
        currentRevenueCents: 1,
        currentQty: 1,
        previousRevenueCents: 1,
        previousQty: 1,
      },
    },
  ]).allowDiskUse(true);

  const normalizedRows = (Array.isArray(rows) ? rows : [])
    .map((item) => {
      const currentRevenueCents = toNumber(item?.currentRevenueCents);
      const previousRevenueCents = toNumber(item?.previousRevenueCents);
      return {
        description: compactWhitespace(item?.description || "Produto"),
        currentRevenueCents,
        currentQty: toNumber(item?.currentQty),
        previousRevenueCents,
        previousQty: toNumber(item?.previousQty),
        revenueDeltaPct: toPercentDelta(currentRevenueCents, previousRevenueCents),
      };
    })
    .filter((item) => item.description);

  const decliningProducts = normalizedRows
    .filter(
      (item) =>
        item.previousRevenueCents > 0 &&
        item.currentRevenueCents < item.previousRevenueCents,
    )
    .sort(
      (left, right) =>
        right.previousRevenueCents -
          right.currentRevenueCents -
          (left.previousRevenueCents - left.currentRevenueCents) ||
        left.revenueDeltaPct - right.revenueDeltaPct,
    )
    .slice(0, 5);

  return {
    decliningProducts,
  };
}

async function buildBillingSignals({
  workspaceId,
  ownerUserId = null,
  now = new Date(),
  timeZone = DEFAULT_TIMEZONE,
}) {
  const pendingCount = await Offer.countDocuments(
    buildPendingOfferMatch({ workspaceId, ownerUserId }),
  );
  const pendingOffers = await Offer.find(
    buildPendingOfferMatch({ workspaceId, ownerUserId }),
  )
    .sort({ updatedAt: 1, createdAt: 1 })
    .limit(200)
    .lean();

  const grouped = groupPendingOfferAutomations({
    offers: pendingOffers,
    now,
    timeZone,
  });

  return {
    pendingCount,
    dueTodayCount: grouped.dueToday.length,
    overdueCount: grouped.overdue.length,
    staleFollowupCount: grouped.staleFollowup.length,
    dueTodayHighlights: grouped.dueToday.slice(0, 5).map((item) => buildOfferOpportunityLine(item, timeZone)),
    overdueHighlights: grouped.overdue.slice(0, 5).map((item) => buildOfferOpportunityLine(item, timeZone)),
    staleFollowupHighlights: grouped.staleFollowup
      .slice(0, 5)
      .map((item) => buildOfferOpportunityLine(item, timeZone)),
  };
}

function buildInsightResponseFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: "lumina_commercial_insight",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          headline: { type: "string" },
          summary: { type: "string" },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
          insights: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                evidence: { type: "string" },
                recommendation: { type: "string" },
                priority: {
                  type: "string",
                  enum: ["high", "medium", "low"],
                },
              },
              required: ["title", "evidence", "recommendation", "priority"],
            },
          },
        },
        required: ["headline", "summary", "confidence", "insights"],
      },
    },
  };
}

function parseInsightResponse(payload) {
  let value = payload;
  if (typeof value === "string") {
    value = JSON.parse(value);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const err = new Error("A IA retornou um insight invalido.");
    err.code = "LUMINA_INSIGHT_INVALID_PAYLOAD";
    throw err;
  }

  const insights = Array.isArray(value.insights)
    ? value.insights
        .map((item) => ({
          title: compactWhitespace(item?.title || ""),
          evidence: compactWhitespace(item?.evidence || ""),
          recommendation: compactWhitespace(item?.recommendation || ""),
          priority: ["high", "medium", "low"].includes(String(item?.priority || "").trim())
            ? String(item.priority).trim()
            : "medium",
        }))
        .filter((item) => item.title && item.evidence && item.recommendation)
        .slice(0, 5)
    : [];

  return {
    headline: compactWhitespace(value.headline || ""),
    summary: compactWhitespace(value.summary || ""),
    confidence: ["high", "medium", "low"].includes(String(value.confidence || "").trim())
      ? String(value.confidence).trim()
      : "medium",
    insights,
  };
}

function buildInsightPrompt(snapshot = {}) {
  return {
    systemPrompt: [
      "Voce e a Lumina Insight, uma analista comercial da LuminorPay.",
      "Use apenas os dados fornecidos.",
      "Seu objetivo e apontar oportunidades concretas para aumentar vendas e recuperar carteira.",
      "Nao invente numeros, nao faca promessas e nao recomende automacao sem confirmacao humana.",
      "Escreva em pt-BR, com foco comercial, linguagem humana e orientacao pratica.",
      "Priorize oportunidades como produto com melhor tracao, cliente recorrente que esfriou, produto que caiu e follow-up com chance de conversao.",
      "Se os dados forem fracos, assuma baixa confianca e deixe isso explicito.",
      "Entregue apenas a analise.",
      "Nao inclua secoes de proximos passos, lista de acoes sugeridas, convite para continuar a conversa ou oferta de ajuda adicional no fechamento.",
    ].join(" "),
    userPrompt: JSON.stringify(snapshot, null, 2),
  };
}

function buildFallbackInsight(snapshot = {}) {
  const summary = snapshot?.summary || {};
  const billing = snapshot?.billing || {};

  const headline =
    toNumber(summary?.current?.paidCount) > 0
      ? "Ja consigo enxergar alguns sinais da sua carteira."
      : "Ainda tenho poucos dados para um insight forte.";

  const insights = [];

  if (toNumber(billing.overdueCount) > 0) {
    insights.push({
      title: "Cobrancas atrasadas merecem prioridade agora",
      evidence: `Existem ${toNumber(billing.overdueCount)} cobranca(s) atrasada(s) na carteira.`,
      recommendation: "Vale revisar as propostas atrasadas primeiro e decidir quais merecem lembrete agora.",
      priority: "high",
    });
  }

  if (Array.isArray(snapshot?.customerSignals?.dormantCustomers) && snapshot.customerSignals.dormantCustomers[0]) {
    const customer = snapshot.customerSignals.dormantCustomers[0];
    insights.push({
      title: "Ha cliente recorrente esfriando",
      evidence: `${customer.customerName} nao compra ha ${toNumber(customer.daysSinceLastPurchase)} dia(s).`,
      recommendation: "Pode valer uma retomada consultiva com uma oferta ou follow-up objetivo.",
      priority: "medium",
    });
  }

  if (!insights.length) {
    insights.push({
      title: "Base ainda pequena para leitura definitiva",
      evidence: "O volume de vendas do periodo ainda esta baixo para uma conclusao forte.",
      recommendation: "Use o Insight para acompanhar recorrencia, itens mais vendidos e oportunidades de follow-up nas proximas semanas.",
      priority: "low",
    });
  }

  return {
    headline,
    summary:
      "Ainda estou com baixa confianca para uma leitura mais agressiva, mas ja consigo apontar prioridades operacionais simples.",
    confidence: "low",
    insights,
  };
}

function formatInsightMessage(analysis = {}, snapshot = {}) {
  const insights = Array.isArray(analysis?.insights) ? analysis.insights : [];
  const lines = [
    compactWhitespace(analysis?.headline || "Separei um insight comercial para voce."),
    "",
    compactWhitespace(analysis?.summary || ""),
  ].filter(Boolean);

  if (insights.length > 0) {
    lines.push("", "Onde eu vejo mais potencial agora:");
    insights.forEach((item, index) => {
      const priorityLabel =
        item.priority === "high" ? "Alta" : item.priority === "low" ? "Baixa" : "Media";
      lines.push(
        "",
        `${index + 1}. ${item.title} [${priorityLabel}]`,
        `Evidencia: ${item.evidence}`,
        `Sugestao: ${item.recommendation}`,
      );
    });
  }

  const currentSummary = snapshot?.summary?.current || {};
  const previousSummary = snapshot?.summary?.previous || {};
  lines.push(
    "",
    "Leitura da janela analisada:",
    formatInsightMetricLine(
      "Receita paga",
      currentSummary.paidRevenueCents,
      previousSummary.paidRevenueCents,
      formatCurrency,
    ),
    formatInsightMetricLine(
      "Vendas pagas",
      currentSummary.paidCount,
      previousSummary.paidCount,
      (value) => `${toNumber(value)}`,
    ),
    formatInsightMetricLine(
      "Ticket medio",
      currentSummary.avgTicketCents,
      previousSummary.avgTicketCents,
      formatCurrency,
    ),
  );

  return lines.join("\n");
}

function buildSnapshotForModel(snapshot = {}) {
  return {
    meta: snapshot.meta,
    summary: snapshot.summary,
    topClients: snapshot.topClients,
    topItems: snapshot.topItems,
    billing: snapshot.billing,
    customerSignals: snapshot.customerSignals,
    productSignals: snapshot.productSignals,
  };
}

export async function buildLuminaInsightSnapshot({
  user,
  now = new Date(),
  windowDays = DEFAULT_WINDOW_DAYS,
}) {
  if (!user?._id || !user?.workspaceId) {
    const err = new Error("Usuario invalido para montar o insight.");
    err.code = "LUMINA_INSIGHT_USER_REQUIRED";
    throw err;
  }

  const timeZone = await getWorkspaceAgendaTimeZone(user.workspaceId).catch(
    () => DEFAULT_TIMEZONE,
  );
  const windows = buildWindows(now, timeZone, windowDays);
  const ownerUserId = user._id;

  const [currentSnapshot, previousSnapshot, customerSignals, productSignals, billing] =
    await Promise.all([
      buildGeneralReportsSnapshot({
        tenantId: user.workspaceId,
        userId: ownerUserId,
        fromYMD: windows.currentFromYMD,
        toYMD: windows.currentToYMD,
        start: windows.currentRange.start,
        end: windows.currentRange.end,
        type: "all",
        onlyPaid: true,
        transactionsLimit: 12,
      }),
      buildGeneralReportsSnapshot({
        tenantId: user.workspaceId,
        userId: ownerUserId,
        fromYMD: windows.previousFromYMD,
        toYMD: windows.previousToYMD,
        start: windows.previousRange.start,
        end: windows.previousRange.end,
        type: "all",
        onlyPaid: true,
        transactionsLimit: 12,
      }),
      buildCustomerSignals({
        workspaceId: user.workspaceId,
        ownerUserId,
        currentRange: windows.currentRange,
        previousRange: windows.previousRange,
        now,
      }),
      buildProductSignals({
        workspaceId: user.workspaceId,
        ownerUserId,
        currentRange: windows.currentRange,
        previousRange: windows.previousRange,
      }),
      buildBillingSignals({
        workspaceId: user.workspaceId,
        ownerUserId,
        now,
        timeZone,
      }),
    ]);

  const currentSummary = currentSnapshot?.summary || {};
  const previousSummary = previousSnapshot?.summary || {};

  return {
    meta: {
      windowDays,
      timeZone,
      generatedAt: now.toISOString(),
      scopeLabel: "Minha carteira",
      currentFromYMD: windows.currentFromYMD,
      currentToYMD: windows.currentToYMD,
      previousFromYMD: windows.previousFromYMD,
      previousToYMD: windows.previousToYMD,
    },
    summary: {
      current: {
        paidRevenueCents: toNumber(currentSummary?.paidRevenueCents),
        paidCount: toNumber(currentSummary?.paidCount),
        createdCount: toNumber(currentSummary?.createdCount),
        avgTicketCents: toNumber(currentSummary?.avgTicketCents),
        conversionPct: toNumber(currentSummary?.conversionPct),
      },
      previous: {
        paidRevenueCents: toNumber(previousSummary?.paidRevenueCents),
        paidCount: toNumber(previousSummary?.paidCount),
        createdCount: toNumber(previousSummary?.createdCount),
        avgTicketCents: toNumber(previousSummary?.avgTicketCents),
        conversionPct: toNumber(previousSummary?.conversionPct),
      },
    },
    topClients: {
      current: (Array.isArray(currentSnapshot?.topClients) ? currentSnapshot.topClients : [])
        .slice(0, 5)
        .map((item) => ({
          customerName: compactWhitespace(item?.customerName || "Cliente"),
          paidRevenueCents: toNumber(item?.paidRevenueCents),
          paidCount: toNumber(item?.paidCount),
          label: buildTopClientLine(item),
        })),
      previous: (Array.isArray(previousSnapshot?.topClients) ? previousSnapshot.topClients : [])
        .slice(0, 5)
        .map((item) => ({
          customerName: compactWhitespace(item?.customerName || "Cliente"),
          paidRevenueCents: toNumber(item?.paidRevenueCents),
          paidCount: toNumber(item?.paidCount),
          label: buildTopClientLine(item),
        })),
    },
    topItems: {
      current: (Array.isArray(currentSnapshot?.topItems) ? currentSnapshot.topItems : [])
        .slice(0, 5)
        .map((item) => ({
          description: compactWhitespace(item?.description || "Produto"),
          paidRevenueCents: toNumber(item?.paidRevenueCents),
          qty: toNumber(item?.qty),
          label: buildTopItemLine(item),
        })),
      previous: (Array.isArray(previousSnapshot?.topItems) ? previousSnapshot.topItems : [])
        .slice(0, 5)
        .map((item) => ({
          description: compactWhitespace(item?.description || "Produto"),
          paidRevenueCents: toNumber(item?.paidRevenueCents),
          qty: toNumber(item?.qty),
          label: buildTopItemLine(item),
        })),
    },
    billing,
    customerSignals: {
      recurringCustomers: customerSignals.recurringCustomers.map((item) => ({
        ...item,
        lastPaidAtLabel: formatDate(item.lastPaidAt, timeZone),
      })),
      dormantCustomers: customerSignals.dormantCustomers.map((item) => ({
        ...item,
        lastPaidAtLabel: formatDate(item.lastPaidAt, timeZone),
      })),
    },
    productSignals,
    recentTransactions: (Array.isArray(currentSnapshot?.transactions) ? currentSnapshot.transactions : [])
      .slice(0, 8)
      .map((item) => ({
        title: compactWhitespace(item?.title || "Proposta"),
        customerName: compactWhitespace(item?.customerName || "Cliente"),
        paidCents: toNumber(item?.paidCents),
        paidDate: item?.paidDate || "",
      })),
  };
}

async function requestInsightAnalysis(snapshot = {}) {
  if (!isWhatsAppAiEnabled()) {
    const err = new Error("Insight da Lumina indisponivel porque a IA esta desativada.");
    err.code = "LUMINA_INSIGHT_AI_DISABLED";
    throw err;
  }

  const client = getOpenAIClient();
  const prompt = buildInsightPrompt(snapshot);
  const response = await client.chat.completions.create({
    model: getIntentExtractionModel(),
    temperature: 0.3,
    messages: [
      { role: "system", content: prompt.systemPrompt },
      { role: "user", content: prompt.userPrompt },
    ],
    response_format: buildInsightResponseFormat(),
  });

  const content = String(response?.choices?.[0]?.message?.content || "").trim();
  if (!content) {
    const err = new Error("A IA nao retornou nenhum insight.");
    err.code = "LUMINA_INSIGHT_EMPTY_RESPONSE";
    throw err;
  }

  return parseInsightResponse(content);
}

function hasEnoughData(snapshot = {}) {
  const currentPaid = toNumber(snapshot?.summary?.current?.paidCount);
  const previousPaid = toNumber(snapshot?.summary?.previous?.paidCount);
  const pendingCount = toNumber(snapshot?.billing?.pendingCount);
  return currentPaid + previousPaid + pendingCount >= 3;
}

export async function generateLuminaInsight({
  user,
  now = new Date(),
  windowDays = DEFAULT_WINDOW_DAYS,
}) {
  const snapshot = await buildLuminaInsightSnapshot({
    user,
    now,
    windowDays,
  });

  const modelSnapshot = buildSnapshotForModel(snapshot);
  const analysis = hasEnoughData(snapshot)
    ? await requestInsightAnalysis(modelSnapshot)
    : buildFallbackInsight(snapshot);

  return {
    snapshot,
    analysis,
    message: formatInsightMessage(analysis, snapshot),
  };
}
