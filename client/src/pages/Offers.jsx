import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../app/api.js";
import { listWorkspaceUsers } from "../app/authApi.js";
import {
  getMyPageQuoteRequests,
  updateMyPageQuoteRequestStatus,
} from "../app/myPageApi.js";
import { useAuth } from "../app/AuthContext.jsx";

import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import FilterBar from "../components/appui/FilterBar.jsx";
import { Input } from "../components/appui/Input.jsx";
import Badge from "../components/appui/Badge.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import useThemeToggle from "../app/useThemeToggle.js";
import { hasWorkspaceModuleAccess } from "../utils/workspacePermissions.js";

import OfferDetailsModal from "../components/offers/OfferDetailsModal.jsx";
import {
  norm,
  fmtBRLFromCents,
  getAmountCents,
  getPaymentLabel,
  isCancelledOffer,
  isPaidOffer,
  isPendingPaymentOffer,
  hasFeedbackResponse,
  buildFeedbackUrl,
  getOfferCxStatusSummary,
  getOfferCxAlertBadges,
  getOfferFulfillmentCtaLabel,
  isOfferCriticalFeedback,
  matchesOfferCxFilter,
  normalizeOfferCxFilter,
} from "../components/offers/offerHelpers.js";
import {
  buildQuoteRequestsSummary,
  formatQuoteRequestDateTime,
  matchesQuoteRequestStatus,
  normalizeQuoteRequestStatusFilter,
  quoteRequestStatusBadge,
} from "../components/my-page/quoteRequestHelpers.js";

function PulseGlowBadge({ children, isDark }) {
  const chipClass = isDark
    ? "inline-flex items-center rounded-full border border-amber-400/25 bg-amber-400/12 px-2.5 py-1 text-[11px] font-bold text-amber-200"
    : "inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800";
  const pulseShadow = isDark
    ? [
        "0 0 0 0 rgba(251,191,36,0)",
        "0 0 0 6px rgba(251,191,36,0.18)",
        "0 0 0 0 rgba(251,191,36,0)",
      ]
    : [
        "0 0 0 0 rgba(245,158,11,0)",
        "0 0 0 6px rgba(245,158,11,0.24)",
        "0 0 0 0 rgba(245,158,11,0)",
      ];

  return (
    <motion.span
      className={chipClass}
      animate={{
        boxShadow: pulseShadow,
        scale: [1, 1.015, 1],
      }}
      transition={{
        duration: 1.9,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.span>
  );
}

function sameId(a, b) {
  if (!a || !b) return false;
  return String(a) === String(b);
}

function buildOffersQuery({ scope, ownerUserId }) {
  const params = new URLSearchParams();
  params.set("scope", scope);
  if (ownerUserId) params.set("ownerUserId", ownerUserId);
  return params.toString();
}

function normalizeOffersView(value) {
  return String(value || "").trim().toLowerCase() === "requests"
    ? "requests"
    : "offers";
}

export default function Offers() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDark } = useThemeToggle();
  const { perms, user } = useAuth();
  const isOwnerTeamView =
    perms?.isWorkspaceOwner === true && perms?.isWorkspaceTeamPlan === true;
  const ownerUserId = String(user?._id || "").trim();
  const canCreateOffers = hasWorkspaceModuleAccess(perms, "newOffer");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quoteRequests, setQuoteRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState("");
  const [requestBusyId, setRequestBusyId] = useState("");
  const [workspaceUsers, setWorkspaceUsers] = useState([]);
  const [teamUsersBusy, setTeamUsersBusy] = useState(false);

  const [scopeTab, setScopeTab] = useState("workspace");
  const [teamOwnerFilter, setTeamOwnerFilter] = useState("all");

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [originFilter, setOriginFilter] = useState("ALL");
  const [cxFilter, setCxFilter] = useState(() =>
    normalizeOfferCxFilter(searchParams.get("cxFilter")),
  );
  const [requestSearch, setRequestSearch] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsOffer, setDetailsOffer] = useState(null);
  const [detailsIntent, setDetailsIntent] = useState("");
  const currentView = normalizeOffersView(searchParams.get("view"));
  const requestStatusFilter = normalizeQuoteRequestStatusFilter(
    searchParams.get("requestStatus"),
  );

  const selectClass = "app-field h-10 rounded-xl px-3";
  const tableHeadClass = isDark
    ? "bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-slate-400"
    : "bg-slate-50/80 text-[11px] uppercase tracking-[0.18em] text-slate-500";
  const tableBorderClass = isDark ? "border-white/10" : "border-slate-200/80";
  const tableRowClass = isDark ? "hover:bg-white/5" : "hover:bg-slate-50/80";

  const effectiveScopeTab = isOwnerTeamView ? scopeTab : "mine";
  const appliedScope =
    isOwnerTeamView && effectiveScopeTab === "workspace" ? "workspace" : "mine";
  const selectedOwnerUserId =
    appliedScope !== "workspace"
      ? ""
      : teamOwnerFilter === "me"
        ? ownerUserId
        : teamOwnerFilter !== "all"
          ? teamOwnerFilter
          : "";
  const showResponsibleColumn = appliedScope === "workspace";

  const selectedTeamMemberName = useMemo(() => {
    if (teamOwnerFilter === "all") return "Toda a equipe";
    if (teamOwnerFilter === "me") return "Somente eu";
    return (
      workspaceUsers.find((item) => sameId(item?._id, teamOwnerFilter))?.name ||
      "Responsavel"
    );
  }, [teamOwnerFilter, workspaceUsers]);

  const scopeSummaryLabel =
    appliedScope === "workspace"
      ? `Equipe: ${selectedTeamMemberName}`
      : "Minha carteira";

  useEffect(() => {
    const nextFilter = normalizeOfferCxFilter(searchParams.get("cxFilter"));
    setCxFilter((prev) => (prev === nextFilter ? prev : nextFilter));
  }, [searchParams]);

  const updateSearchParam = useCallback(
    (key, value, defaultValue = "") => {
      const nextParams = new URLSearchParams(searchParams);
      if (!value || value === defaultValue) nextParams.delete(key);
      else nextParams.set(key, value);
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    const currentParam = normalizeOfferCxFilter(searchParams.get("cxFilter"));
    if (currentParam === cxFilter) return;

    const nextParams = new URLSearchParams(searchParams);
    if (cxFilter === "ALL") nextParams.delete("cxFilter");
    else nextParams.set("cxFilter", cxFilter);
    setSearchParams(nextParams, { replace: true });
  }, [cxFilter, searchParams, setSearchParams]);

  const patchOfferInList = useCallback((updated) => {
    if (!updated?._id) return;
    setItems((prev) =>
      (prev || []).map((it) =>
        it?._id === updated._id ? { ...it, ...updated } : it,
      ),
    );
    setDetailsOffer((prev) =>
      prev?._id === updated._id ? { ...prev, ...updated } : prev,
    );
  }, []);

  const setViewMode = useCallback(
    (nextView) => {
      updateSearchParam("view", normalizeOffersView(nextView), "offers");
    },
    [updateSearchParam],
  );

  const setRequestStatusParam = useCallback(
    (nextStatus) => {
      updateSearchParam(
        "requestStatus",
        normalizeQuoteRequestStatusFilter(nextStatus),
        "ALL",
      );
    },
    [updateSearchParam],
  );

  const loadWorkspaceTeam = useCallback(async () => {
    if (!isOwnerTeamView) {
      setWorkspaceUsers([]);
      return;
    }

    try {
      setTeamUsersBusy(true);
      const data = await listWorkspaceUsers();
      const rawItems = Array.isArray(data?.items) ? data.items : [];
      setWorkspaceUsers(
        rawItems.filter(
          (item) =>
            !sameId(item?._id, ownerUserId) && item?.status !== "disabled",
        ),
      );
    } catch {
      setWorkspaceUsers([]);
    } finally {
      setTeamUsersBusy(false);
    }
  }, [isOwnerTeamView, ownerUserId]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const d = await api(
        `/offers?${buildOffersQuery({
          scope: appliedScope,
          ownerUserId: selectedOwnerUserId,
        })}`,
      );
      setItems(d?.items || []);
    } catch (e) {
      setError(e?.message || "Falha ao carregar propostas.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [appliedScope, selectedOwnerUserId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadWorkspaceTeam();
  }, [loadWorkspaceTeam]);

  const loadQuoteRequests = useCallback(async () => {
    try {
      setRequestsLoading(true);
      setRequestsError("");
      const data = await getMyPageQuoteRequests();
      setQuoteRequests(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setRequestsError(e?.message || "Falha ao carregar solicitacoes.");
      setQuoteRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuoteRequests();
  }, [loadQuoteRequests]);

  const filteredBase = useMemo(() => {
    const query = q.trim().toLowerCase();

    let base =
      filter === "ALL"
        ? items
        : (items || []).filter((o) => {
            const pay = norm(o?.paymentStatus);
            const flow = norm(o?.status || "PUBLIC");

            if (filter === "PAID") return isPaidOffer(o);
            if (filter === "PENDING") return isPendingPaymentOffer(o);
            if (filter === "CANCELLED") return isCancelledOffer(o);
            if (filter === "WAITING_CONFIRMATION") {
              return !isCancelledOffer(o) && pay === "WAITING_CONFIRMATION";
            }
            if (filter === "REJECTED") {
              return !isCancelledOffer(o) && pay === "REJECTED";
            }

            return flow === filter;
          });

    if (originFilter !== "ALL") {
      base = base.filter((o) => {
        const generatedBy = String(o?.generatedBy || "manual").toLowerCase();
        if (originFilter === "RECURRING") return generatedBy === "recurring";
        if (originFilter === "MANUAL") return generatedBy !== "recurring";
        return true;
      });
    }

    if (!query) return base;

    return base.filter((o) => {
      const customerName = String(o?.customerName || "").toLowerCase();
      const title = String(o?.title || "").toLowerCase();
      const recurringName = String(o?.recurringNameSnapshot || "").toLowerCase();
      const responsibleName = String(o?.responsibleUser?.name || "").toLowerCase();
      return (
        customerName.includes(query) ||
        title.includes(query) ||
        recurringName.includes(query) ||
        responsibleName.includes(query)
      );
    });
  }, [items, q, filter, originFilter]);

  const filtered = useMemo(() => {
    return filteredBase.filter((offer) => matchesOfferCxFilter(offer, cxFilter));
  }, [filteredBase, cxFilter]);

  const worklistSummary = useMemo(() => {
    return filtered.reduce(
      (acc, offer) => {
        const pay = getPaymentLabel(offer);
        if (pay?.code === "PENDING") acc.pending += 1;
        if (pay?.code === "WAITING_CONFIRMATION") acc.waiting += 1;
        if (["PAID", "CONFIRMED"].includes(String(pay?.code || "").toUpperCase())) {
          acc.paid += 1;
        }
        return acc;
      },
      { total: filtered.length, pending: 0, waiting: 0, paid: 0 },
    );
  }, [filtered]);

  const cxSummary = useMemo(() => {
    return filteredBase.reduce(
      (acc, offer) => {
        const cxStatus = getOfferCxStatusSummary(offer);
        if (cxStatus?.code === "NOT_COMPLETED") acc.notCompleted += 1;
        if (cxStatus?.code === "FEEDBACK_SENT") acc.feedbackSent += 1;
        if (cxStatus?.code === "FEEDBACK_RESPONDED") acc.feedbackResponded += 1;
        if (isOfferCriticalFeedback(offer)) acc.critical += 1;
        return acc;
      },
      {
        notCompleted: 0,
        feedbackSent: 0,
        feedbackResponded: 0,
        critical: 0,
      },
    );
  }, [filteredBase]);

  const quoteRequestsSummary = useMemo(
    () => buildQuoteRequestsSummary(quoteRequests),
    [quoteRequests],
  );

  const filteredQuoteRequests = useMemo(() => {
    const query = requestSearch.trim().toLowerCase();

    return (quoteRequests || []).filter((request) => {
      if (!matchesQuoteRequestStatus(request, requestStatusFilter)) {
        return false;
      }
      if (!query) return true;

      const productsText = Array.isArray(request?.selectedProducts)
        ? request.selectedProducts
            .map((item) => `${item?.name || ""} ${item?.productId || ""}`)
            .join(" ")
        : "";

      const haystack = [
        request?.customerName,
        request?.customerWhatsApp,
        request?.customerEmail,
        request?.message,
        request?.pageTitleSnapshot,
        request?.requestType,
        productsText,
      ]
        .map((item) => String(item || "").toLowerCase())
        .join(" ");

      return haystack.includes(query);
    });
  }, [quoteRequests, requestSearch, requestStatusFilter]);

  const copyLink = useCallback(async (offer) => {
    const token = offer?.publicToken;
    if (!token) return;

    const url = `${window.location.origin}/p/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(offer._id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      // silencioso
    }
  }, []);

  const handleQuoteRequestStatus = useCallback(async (id, status) => {
    try {
      setRequestBusyId(id);
      setRequestsError("");
      const response = await updateMyPageQuoteRequestStatus(id, status);
      const nextRequest = response?.request || null;
      if (!nextRequest?._id) return;

      setQuoteRequests((prev) =>
        prev.map((item) => (item._id === nextRequest._id ? nextRequest : item)),
      );
    } catch (e) {
      setRequestsError(e?.message || "Nao consegui atualizar a solicitacao.");
    } finally {
      setRequestBusyId("");
    }
  }, []);

  const handleCreateOfferFromRequest = useCallback(
    async (request) => {
      if (!request?._id || !canCreateOffers) return;

      try {
        if (request.status === "new") {
          setRequestBusyId(request._id);
          setRequestsError("");
          const response = await updateMyPageQuoteRequestStatus(
            request._id,
            "in_progress",
          );
          const nextRequest = response?.request || request;
          setQuoteRequests((prev) =>
            prev.map((item) =>
              item._id === nextRequest._id ? nextRequest : item,
            ),
          );
        }

        navigate(
          `/offers/new?quoteRequestId=${encodeURIComponent(request._id)}`,
        );
      } catch (e) {
        setRequestsError(
          e?.message || "Nao consegui abrir a proposta desta solicitacao.",
        );
      } finally {
        setRequestBusyId("");
      }
    },
    [canCreateOffers, navigate],
  );

  const openDetails = useCallback((offer, intent = "") => {
    setDetailsOffer(offer || null);
    setDetailsIntent(intent || "");
    setDetailsOpen(true);
  }, []);

  return (
    <Shell>
      <div className="mx-auto max-w-[1380px] space-y-5">
        <PageHeader
          eyebrow="Propostas"
          title="Propostas"
          subtitle="Gerencie propostas, solicitacoes vindas da Minha Pagina e confirmacoes de pagamento."
          actions={
            canCreateOffers ? (
              <Link to="/offers/new">
                <Button size="lg">Nova proposta</Button>
              </Link>
            ) : null
          }
        />

        {isOwnerTeamView ? (
          <Card>
            <CardBody className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={effectiveScopeTab === "mine" ? "primary" : "secondary"}
                  onClick={() => setScopeTab("mine")}
                >
                  Minha carteira
                </Button>
                <Button
                  size="sm"
                  variant={effectiveScopeTab === "workspace" ? "primary" : "secondary"}
                  onClick={() => setScopeTab("workspace")}
                >
                  Equipe
                </Button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {effectiveScopeTab === "workspace" ? (
                  <select
                    className={selectClass}
                    value={teamOwnerFilter}
                    onChange={(e) => setTeamOwnerFilter(e.target.value)}
                    disabled={teamUsersBusy}
                  >
                    <option value="all">Toda a equipe</option>
                    <option value="me">Somente eu</option>
                    {workspaceUsers.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                ) : null}

                <Badge tone="NEUTRAL">{scopeSummaryLabel}</Badge>
              </div>
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardBody className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={currentView === "offers" ? "primary" : "secondary"}
                onClick={() => setViewMode("offers")}
              >
                Propostas
              </Button>
              <Button
                size="sm"
                variant={currentView === "requests" ? "primary" : "secondary"}
                onClick={() => setViewMode("requests")}
              >
                Solicitacoes
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="NEUTRAL">{items.length} propostas</Badge>
              <Badge tone="PUBLIC">{quoteRequestsSummary.total} solicitacoes</Badge>
              <Badge tone="ACCEPTED">{quoteRequestsSummary.newCount} novas</Badge>
              <Badge tone="PUBLIC">{quoteRequestsSummary.inProgress} em andamento</Badge>
            </div>
          </CardBody>
        </Card>

        {currentView === "offers" ? (
          <>
        <FilterBar
          actions={
            <Button variant="secondary" size="md" onClick={load} disabled={loading}>
              Atualizar
            </Button>
          }
          summary={
            <>
              <Badge tone="NEUTRAL">{scopeSummaryLabel}</Badge>
              <Badge tone="NEUTRAL">{worklistSummary.total} visiveis</Badge>
              <Badge tone="ACCEPTED">{worklistSummary.pending} pendentes</Badge>
              <Badge tone="PUBLIC">{worklistSummary.waiting} em analise</Badge>
              <Badge tone="PAID">{worklistSummary.paid} pagas</Badge>
              <Badge tone="PUBLIC">{cxSummary.notCompleted} nao concluidas</Badge>
              <Badge tone="ACCEPTED">{cxSummary.feedbackSent} avaliacao enviada</Badge>
              <Badge tone="CONFIRMED">{cxSummary.feedbackResponded} respondidas</Badge>
              <Badge tone="CANCELLED">{cxSummary.critical} criticas</Badge>
            </>
          }
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <select
              className={selectClass}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="ALL">Todos os status</option>
              <option value="WAITING_CONFIRMATION">Aguardando confirmacao</option>
              <option value="PENDING">Aguardando pagamento</option>
              <option value="REJECTED">Comprovante recusado</option>
              <option value="PAID">Pago (confirmado)</option>
              <option value="ACCEPTED">Aceito</option>
              <option value="PUBLIC">Publico</option>
              <option value="EXPIRED">Expirado</option>
              <option value="CANCELLED">Cancelado</option>
            </select>

            <select
              className={selectClass}
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
            >
              <option value="ALL">Todas as origens</option>
              <option value="MANUAL">Avulsas</option>
              <option value="RECURRING">Recorrentes</option>
            </select>

            <select
              className={selectClass}
              value={cxFilter}
              onChange={(e) => setCxFilter(e.target.value)}
            >
              <option value="ALL">CX: todos</option>
              <option value="NOT_COMPLETED">CX: Nao concluido</option>
              <option value="FEEDBACK_SENT">CX: Avaliacao enviada</option>
              <option value="FEEDBACK_RESPONDED">CX: Avaliacao respondida</option>
              <option value="LOW_RATING">CX: Nota baixa</option>
              <option value="CONTACT_REQUESTED">CX: Pediu contato</option>
            </select>

            <div className="w-full md:w-[360px]">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={
                  showResponsibleColumn
                    ? "Buscar cliente, proposta, recorrencia ou responsavel..."
                    : "Buscar cliente, proposta ou recorrencia..."
                }
                className="h-10"
              />
            </div>
          </div>
        </FilterBar>

        <Card className="overflow-hidden">
          <CardHeader
            title="Lista operacional"
            subtitle="Cliente, valor e status em primeiro plano para agir mais rapido."
            right={<Badge tone="NEUTRAL">{items.length} total</Badge>}
          />
          <CardBody className="p-0">
            {loading ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ) : error ? (
              <div
                className={[
                  "m-5 rounded-xl border p-4 text-sm",
                  isDark
                    ? "border-red-400/20 bg-red-500/10 text-red-100"
                    : "border-red-200 bg-red-50 text-red-800",
                ].join(" ")}
              >
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="Nenhuma proposta"
                  description="Ajuste filtros ou crie uma nova proposta."
                  ctaLabel={canCreateOffers ? "Criar proposta" : undefined}
                  onCta={canCreateOffers ? () => navigate("/offers/new") : undefined}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className={`border-b px-5 py-3 pr-4 ${tableBorderClass}`}>Cliente</th>
                      <th className={`border-b px-5 py-3 pr-4 ${tableBorderClass}`}>Proposta</th>
                      {showResponsibleColumn ? (
                        <th className={`border-b px-5 py-3 pr-4 ${tableBorderClass}`}>Responsavel</th>
                      ) : null}
                      <th className={`border-b px-5 py-3 pr-4 ${tableBorderClass}`}>Valor</th>
                      <th className={`border-b px-5 py-3 pr-4 ${tableBorderClass}`}>Status</th>
                      <th className={`border-b px-5 py-3 text-right ${tableBorderClass}`}>Acoes</th>
                    </tr>
                  </thead>
                  <tbody className={isDark ? "divide-y divide-white/10" : "divide-y divide-slate-200/70"}>
                    {filtered.map((o) => {
                      const pay = getPaymentLabel(o);
                      const cxStatus = getOfferCxStatusSummary(o);
                      const cxAlertBadges = getOfferCxAlertBadges(o);
                      const publicUrl = `/p/${o.publicToken}`;
                      const copied = copiedId === o._id;
                      const isPendingAlert = isPendingPaymentOffer(o);
                      const isWaitingConfirmation =
                        pay?.code === "WAITING_CONFIRMATION";
                      const isRecurring =
                        String(o?.generatedBy || "manual").toLowerCase() === "recurring";
                      const responsibleName =
                        o?.responsibleUser?.name || "Sem responsavel";
                      const isMine = sameId(o?.ownerUserId, ownerUserId);
                      const canRunFulfillmentCta = isPaidOffer(o);

                      return (
                        <tr key={o._id} className={tableRowClass}>
                          <td className="px-5 py-4 pr-4">
                            <div className={isDark ? "font-semibold text-white" : "font-semibold text-slate-900"}>
                              {o.customerName || "-"}
                            </div>
                            <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                              {o.customerWhatsApp || "-"}
                            </div>
                          </td>
                          <td className="px-5 py-4 pr-4">
                            <div className={isDark ? "flex flex-wrap items-center gap-2 text-white" : "flex flex-wrap items-center gap-2 text-slate-900"}>
                              <span>{o.title || "Proposta"}</span>
                              {isRecurring ? (
                                <span className={isDark ? "inline-flex items-center rounded-full border border-indigo-400/20 bg-indigo-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-200" : "inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700"}>
                                  Recorrente
                                </span>
                              ) : (
                                <span className={isDark ? "inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300" : "inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600"}>
                                  Avulsa
                                </span>
                              )}
                            </div>
                            <div className={isDark ? "line-clamp-1 text-xs text-slate-400" : "line-clamp-1 text-xs text-slate-500"}>
                              {o.description || ""}
                            </div>
                            {isRecurring && o?.recurringOfferId ? (
                              <Link
                                to={`/offers/recurring/${o.recurringOfferId}`}
                                className={isDark ? "mt-1 inline-flex text-xs font-medium text-indigo-300 hover:text-indigo-200" : "mt-1 inline-flex text-xs font-medium text-indigo-600 hover:text-indigo-800"}
                              >
                                {o?.recurringNameSnapshot || "Ver recorrencia"}
                              </Link>
                            ) : null}
                          </td>
                          {showResponsibleColumn ? (
                            <td className="px-5 py-4 pr-4">
                              <div className={isDark ? "text-sm font-semibold text-white" : "text-sm font-semibold text-slate-900"}>
                                {responsibleName}
                              </div>
                              <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                                {isMine ? "Sua carteira" : "Carteira da equipe"}
                              </div>
                            </td>
                          ) : null}
                          <td className={isDark ? "px-5 py-4 pr-4 font-semibold tabular-nums text-white" : "px-5 py-4 pr-4 font-semibold tabular-nums text-slate-900"}>
                            {fmtBRLFromCents(getAmountCents(o))}
                          </td>
                          <td className="px-5 py-4 pr-4">
                            <div className="flex flex-wrap items-center gap-2">
                              {isPendingAlert ? (
                                <span className={isDark ? "inline-flex items-center rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[11px] font-bold text-amber-200" : "inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700"}>
                                  Aguardando pagamento
                                </span>
                              ) : isWaitingConfirmation ? (
                                <PulseGlowBadge isDark={isDark}>
                                  {pay.text}
                                </PulseGlowBadge>
                              ) : (
                                <Badge tone={pay.tone}>{pay.text}</Badge>
                              )}

                              {cxStatus ? (
                                <Badge tone={cxStatus.tone}>{cxStatus.text}</Badge>
                              ) : null}

                              {cxAlertBadges.map((badge) => (
                                <Badge key={`${o._id}-${badge.code}`} tone={badge.tone}>
                                  {badge.text}
                                </Badge>
                              ))}

                              {o?.notifyWhatsAppOnPaid ? (
                                <span className={isDark ? "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-200" : "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"}>
                                  WA ON
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {canRunFulfillmentCta ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    const feedbackUrl = buildFeedbackUrl(o);
                                    if (hasFeedbackResponse(o) && feedbackUrl) {
                                      window.open(
                                        feedbackUrl,
                                        "_blank",
                                        "noopener,noreferrer",
                                      );
                                      return;
                                    }
                                    openDetails(o, "fulfillment");
                                  }}
                                >
                                  {getOfferFulfillmentCtaLabel(o)}
                                </Button>
                              ) : null}

                              <Button
                                variant={copied ? "primary" : "secondary"}
                                size="sm"
                                onClick={() => copyLink(o)}
                              >
                                {copied ? "Copiado" : "Copiar link"}
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  window.open(publicUrl, "_blank", "noopener,noreferrer")
                                }
                              >
                                Abrir
                              </Button>

                              <Button size="sm" onClick={() => openDetails(o)}>
                                Detalhes
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <OfferDetailsModal
          open={detailsOpen}
          onClose={() => {
            setDetailsOpen(false);
            setDetailsOffer(null);
            setDetailsIntent("");
          }}
          offer={detailsOffer}
          initialAction={detailsIntent}
          onOfferUpdated={patchOfferInList}
          copyLink={copyLink}
          copiedId={copiedId}
        />
          </>
        ) : (
          <>
            <FilterBar
              actions={
                <Button
                  variant="secondary"
                  size="md"
                  onClick={loadQuoteRequests}
                  disabled={requestsLoading}
                >
                  Atualizar
                </Button>
              }
              summary={
                <>
                  <Badge tone="PUBLIC">{quoteRequestsSummary.total} recebidas</Badge>
                  <Badge tone="ACCEPTED">{quoteRequestsSummary.newCount} novas</Badge>
                  <Badge tone="PUBLIC">{quoteRequestsSummary.inProgress} em andamento</Badge>
                  <Badge tone="PAID">{quoteRequestsSummary.converted} convertidas</Badge>
                  <Badge tone="DRAFT">{quoteRequestsSummary.archived} arquivadas</Badge>
                </>
              }
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <select
                  className={selectClass}
                  value={requestStatusFilter}
                  onChange={(e) => setRequestStatusParam(e.target.value)}
                >
                  <option value="ALL">Todas as solicitacoes</option>
                  <option value="NEW">Novas</option>
                  <option value="IN_PROGRESS">Em andamento</option>
                  <option value="CONVERTED">Convertidas</option>
                  <option value="ARCHIVED">Arquivadas</option>
                </select>

                <div className="w-full md:w-[420px]">
                  <Input
                    value={requestSearch}
                    onChange={(e) => setRequestSearch(e.target.value)}
                    placeholder="Buscar lead, contato, mensagem ou produto..."
                    className="h-10"
                  />
                </div>
              </div>
            </FilterBar>

            <Card className="overflow-hidden">
              <CardHeader
                title="Solicitacoes recebidas"
                subtitle="Pedidos de orcamento que chegaram pela Minha Pagina e podem virar proposta."
                right={
                  <Badge tone="PUBLIC">
                    {filteredQuoteRequests.length} visiveis
                  </Badge>
                }
              />
              <CardBody className="space-y-3">
                {requestsLoading ? (
                  <>
                    <Skeleton className="h-28 w-full rounded-[24px]" />
                    <Skeleton className="h-28 w-full rounded-[24px]" />
                  </>
                ) : requestsError ? (
                  <div
                    className={[
                      "rounded-xl border p-4 text-sm",
                      isDark
                        ? "border-red-400/20 bg-red-500/10 text-red-100"
                        : "border-red-200 bg-red-50 text-red-800",
                    ].join(" ")}
                  >
                    {requestsError}
                  </div>
                ) : filteredQuoteRequests.length === 0 ? (
                  <EmptyState
                    title="Nenhuma solicitacao"
                    description="Quando alguem pedir orcamento pela sua Minha Pagina, as solicitacoes aparecerao aqui."
                  />
                ) : (
                  filteredQuoteRequests.map((request) => {
                    const statusMeta = quoteRequestStatusBadge(request.status);
                    const busy = requestBusyId === request._id;
                    const hasOffer = !!request?.createdOffer?._id;

                    return (
                      <div
                        key={request._id}
                        className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-white/5"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-semibold text-slate-950 dark:text-white">
                                {request.customerName || "Lead sem nome"}
                              </div>
                              <Badge tone={statusMeta.tone}>
                                {statusMeta.label}
                              </Badge>
                              <Badge
                                tone={
                                  request.requestType === "product"
                                    ? "PAID"
                                    : "PUBLIC"
                                }
                              >
                                {request.requestType === "product"
                                  ? "Produto"
                                  : "Servico"}
                              </Badge>
                            </div>

                            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                              {request.customerWhatsApp || "Sem WhatsApp"}
                              {request.customerEmail
                                ? ` • ${request.customerEmail}`
                                : ""}
                            </div>

                            {request.message ? (
                              <div className="mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-3 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                                {request.message}
                              </div>
                            ) : null}

                            {request.selectedProducts?.length ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {request.selectedProducts.map((product) => (
                                  <span
                                    key={`${request._id}:${product._id || product.productId}`}
                                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                                  >
                                    {product.name}
                                  </span>
                                ))}
                              </div>
                            ) : null}

                            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                              Recebido em{" "}
                              {formatQuoteRequestDateTime(request.createdAt)}
                              {request?.createdOffer?.publicCode
                                ? ` • Codigo ${request.createdOffer.publicCode}`
                                : ""}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 md:max-w-[320px] md:justify-end">
                            {!hasOffer && canCreateOffers ? (
                              <Button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  handleCreateOfferFromRequest(request)
                                }
                              >
                                {busy ? "Abrindo..." : "Criar proposta"}
                              </Button>
                            ) : null}

                            {hasOffer && request.createdOffer?.publicToken ? (
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() =>
                                  window.open(
                                    `/p/${request.createdOffer.publicToken}`,
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
                                }
                              >
                                Ver proposta
                              </Button>
                            ) : null}

                            {!hasOffer && request.status !== "in_progress" ? (
                              <Button
                                type="button"
                                variant="ghost"
                                disabled={busy}
                                onClick={() =>
                                  handleQuoteRequestStatus(
                                    request._id,
                                    "in_progress",
                                  )
                                }
                              >
                                Em andamento
                              </Button>
                            ) : null}

                            {request.status !== "archived" ? (
                              <Button
                                type="button"
                                variant="ghost"
                                disabled={busy}
                                onClick={() =>
                                  handleQuoteRequestStatus(
                                    request._id,
                                    "archived",
                                  )
                                }
                              >
                                Arquivar
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                disabled={busy}
                                onClick={() =>
                                  handleQuoteRequestStatus(request._id, "new")
                                }
                              >
                                Reabrir
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </Shell>
  );
}
