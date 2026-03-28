import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { api } from "../app/api.js";
import { listWorkspaceUsers } from "../app/authApi.js";
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

import OfferDetailsModal from "../components/offers/OfferDetailsModal.jsx";
import {
  norm,
  fmtBRLFromCents,
  getAmountCents,
  getPaymentLabel,
  isCancelledOffer,
  isPaidOffer,
  isPendingPaymentOffer,
} from "../components/offers/offerHelpers.js";

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

function getFulfillmentCtaLabel(offer) {
  const rating = Number(offer?.feedback?.rating);
  if (offer?.feedback?.respondedAt && Number.isFinite(rating) && rating > 0) {
    return "Ver avaliacao";
  }
  if (offer?.fulfillment?.completedAt) {
    return "Reenviar avaliacao";
  }
  return String(offer?.offerType || "").toLowerCase() === "product"
    ? "Pedido entregue"
    : "Concluir atendimento";
}

function hasFeedbackResponse(offer) {
  const rating = Number(offer?.feedback?.rating);
  return !!offer?.feedback?.respondedAt && Number.isFinite(rating) && rating > 0;
}

export default function Offers() {
  const { isDark } = useThemeToggle();
  const { perms, user } = useAuth();
  const isOwnerTeamView =
    perms?.isWorkspaceOwner === true && perms?.isWorkspaceTeamPlan === true;
  const ownerUserId = String(user?._id || "").trim();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workspaceUsers, setWorkspaceUsers] = useState([]);
  const [teamUsersBusy, setTeamUsersBusy] = useState(false);

  const [scopeTab, setScopeTab] = useState("workspace");
  const [teamOwnerFilter, setTeamOwnerFilter] = useState("all");

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [originFilter, setOriginFilter] = useState("ALL");
  const [copiedId, setCopiedId] = useState(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsOffer, setDetailsOffer] = useState(null);
  const [detailsIntent, setDetailsIntent] = useState("");

  const selectClass = isDark
    ? "h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/40"
    : "h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-sky-300";
  const tableHeadClass = isDark
    ? "text-[11px] uppercase tracking-wider text-slate-400"
    : "text-[11px] uppercase tracking-wider text-zinc-400";
  const tableBorderClass = isDark ? "border-white/10" : "border-zinc-100";
  const tableRowClass = isDark ? "hover:bg-white/5" : "hover:bg-zinc-50/50";

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

  const filtered = useMemo(() => {
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
          subtitle="Gerencie propostas avulsas, cobrancas recorrentes e confirmacoes de pagamento."
          actions={
            <Link to="/offers/new">
              <Button size="lg">Nova proposta</Button>
            </Link>
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

                <Badge tone="neutral">{scopeSummaryLabel}</Badge>
              </div>
            </CardBody>
          </Card>
        ) : null}

        <FilterBar
          actions={
            <Button variant="secondary" size="md" onClick={load} disabled={loading}>
              Atualizar
            </Button>
          }
          summary={
            <>
              <Badge tone="DRAFT">{scopeSummaryLabel}</Badge>
              <Badge tone="DRAFT">{worklistSummary.total} visiveis</Badge>
              <Badge tone="ACCEPTED">{worklistSummary.pending} pendentes</Badge>
              <Badge tone="PUBLIC">{worklistSummary.waiting} em analise</Badge>
              <Badge tone="PAID">{worklistSummary.paid} pagas</Badge>
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
            right={<Badge tone="DRAFT">{items.length} total</Badge>}
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
                  ctaLabel="Criar proposta"
                  onCta={() => (window.location.href = "/offers/new")}
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
                  <tbody className={isDark ? "divide-y divide-white/10" : "divide-y divide-zinc-100"}>
                    {filtered.map((o) => {
                      const pay = getPaymentLabel(o);
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
                            <div className={isDark ? "font-semibold text-white" : "font-semibold text-zinc-900"}>
                              {o.customerName || "-"}
                            </div>
                            <div className={isDark ? "text-xs text-slate-400" : "text-xs text-zinc-500"}>
                              {o.customerWhatsApp || "-"}
                            </div>
                          </td>
                          <td className="px-5 py-4 pr-4">
                            <div className={isDark ? "flex flex-wrap items-center gap-2 text-white" : "flex flex-wrap items-center gap-2 text-zinc-900"}>
                              <span>{o.title || "Proposta"}</span>
                              {isRecurring ? (
                                <span className={isDark ? "inline-flex items-center rounded-full border border-indigo-400/20 bg-indigo-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-200" : "inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700"}>
                                  Recorrente
                                </span>
                              ) : (
                                <span className={isDark ? "inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300" : "inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600"}>
                                  Avulsa
                                </span>
                              )}
                            </div>
                            <div className={isDark ? "line-clamp-1 text-xs text-slate-400" : "line-clamp-1 text-xs text-zinc-500"}>
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
                              <div className={isDark ? "text-sm font-semibold text-white" : "text-sm font-semibold text-zinc-900"}>
                                {responsibleName}
                              </div>
                              <div className={isDark ? "text-xs text-slate-400" : "text-xs text-zinc-500"}>
                                {isMine ? "Sua carteira" : "Carteira da equipe"}
                              </div>
                            </td>
                          ) : null}
                          <td className={isDark ? "px-5 py-4 pr-4 font-semibold tabular-nums text-white" : "px-5 py-4 pr-4 font-semibold tabular-nums text-zinc-900"}>
                            {fmtBRLFromCents(getAmountCents(o))}
                          </td>
                          <td className="px-5 py-4 pr-4">
                            <div className="flex items-center gap-2">
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
                                    if (hasFeedbackResponse(o) && o?.publicToken) {
                                      window.open(
                                        `/p/${o.publicToken}/feedback`,
                                        "_blank",
                                        "noopener,noreferrer",
                                      );
                                      return;
                                    }
                                    openDetails(o, "fulfillment");
                                  }}
                                >
                                  {getFulfillmentCtaLabel(o)}
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
      </div>
    </Shell>
  );
}
