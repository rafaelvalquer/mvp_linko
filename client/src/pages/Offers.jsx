// src/pages/Offers.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../app/api.js";

import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
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
} from "../components/offers/offerHelpers.js";

export default function Offers() {
  const { isDark } = useThemeToggle();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [originFilter, setOriginFilter] = useState("ALL");
  const [copiedId, setCopiedId] = useState(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsOffer, setDetailsOffer] = useState(null);

  const selectClass = isDark
    ? "h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/40"
    : "h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-sky-300";
  const tableHeadClass = isDark
    ? "text-[11px] uppercase tracking-wider text-slate-400"
    : "text-[11px] uppercase tracking-wider text-zinc-400";
  const tableBorderClass = isDark ? "border-white/10" : "border-zinc-100";
  const tableRowClass = isDark ? "hover:bg-white/5" : "hover:bg-zinc-50/50";

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

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const d = await api("/offers");
      setItems(d?.items || []);
    } catch (e) {
      setError(e?.message || "Falha ao carregar propostas.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    let base = filter === "ALL"
      ? items
      : (items || []).filter((o) => {
          const pay = norm(o?.paymentStatus);
          const flow = norm(o?.status || "PUBLIC");
          const paid =
            ["PAID", "CONFIRMED"].includes(pay) ||
            ["PAID", "CONFIRMED"].includes(flow);

          if (filter === "PAID") return paid;
          if (["PENDING", "WAITING_CONFIRMATION", "REJECTED"].includes(filter)) {
            return pay === filter;
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
      const a = String(o?.customerName || "").toLowerCase();
      const b = String(o?.title || "").toLowerCase();
      const c = String(o?.recurringNameSnapshot || "").toLowerCase();
      return a.includes(query) || b.includes(query) || c.includes(query);
    });
  }, [items, q, filter, originFilter]);

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

  const openDetails = useCallback((offer) => {
    setDetailsOffer(offer || null);
    setDetailsOpen(true);
  }, []);

  return (
    <Shell>
      <div className="space-y-6">
        <PageHeader
          title="Propostas"
          subtitle="Gerencie propostas avulsas, cobranças recorrentes e confirmações de pagamento."
          actions={
            <Link to="/offers/new">
              <Button>Nova proposta</Button>
            </Link>
          }
        />

        <Card>
          <CardBody className="p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <select
                  className={selectClass}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="ALL">Todos os status</option>
                  <option value="WAITING_CONFIRMATION">Aguardando confirmação</option>
                  <option value="PENDING">Aguardando pagamento</option>
                  <option value="REJECTED">Comprovante recusado</option>
                  <option value="PAID">Pago (confirmado)</option>
                  <option value="ACCEPTED">Aceito</option>
                  <option value="PUBLIC">Público</option>
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

                <div className="w-full md:w-80">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar cliente, proposta ou recorrência..."
                    className="h-10"
                  />
                </div>
              </div>

              <Button variant="secondary" onClick={load} disabled={loading}>
                Atualizar
              </Button>
            </div>

            {loading ? (
              <div className="mt-5 space-y-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ) : error ? (
              <div
                className={[
                  "mt-5 rounded-xl border p-4 text-sm",
                  isDark
                    ? "border-red-400/20 bg-red-500/10 text-red-100"
                    : "border-red-200 bg-red-50 text-red-800",
                ].join(" ")}
              >
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="mt-8">
                <EmptyState
                  title="Nenhuma proposta"
                  description="Ajuste filtros ou crie uma nova proposta."
                  ctaLabel="Criar proposta"
                  onCta={() => (window.location.href = "/offers/new")}
                />
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className={`border-b py-3 pr-4 ${tableBorderClass}`}>Cliente</th>
                      <th className={`border-b py-3 pr-4 ${tableBorderClass}`}>Proposta</th>
                      <th className={`border-b py-3 pr-4 ${tableBorderClass}`}>Valor</th>
                      <th className={`border-b py-3 pr-4 ${tableBorderClass}`}>Status</th>
                      <th className={`border-b py-3 text-right ${tableBorderClass}`}>Ações</th>
                    </tr>
                  </thead>
                  <tbody className={isDark ? "divide-y divide-white/10" : "divide-y divide-zinc-100"}>
                    {filtered.map((o) => {
                      const pay = getPaymentLabel(o);
                      const publicUrl = `/p/${o.publicToken}`;
                      const copied = copiedId === o._id;
                      const isPendingAlert = norm(o?.paymentStatus) === "PENDING";
                      const isRecurring = String(o?.generatedBy || "manual").toLowerCase() === "recurring";

                      return (
                        <tr key={o._id} className={tableRowClass}>
                          <td className="py-3 pr-4">
                            <div className={isDark ? "font-semibold text-white" : "font-semibold text-zinc-900"}>
                              {o.customerName || "—"}
                            </div>
                            <div className={isDark ? "text-xs text-slate-400" : "text-xs text-zinc-500"}>
                              {o.customerWhatsApp || "—"}
                            </div>
                          </td>
                          <td className="py-3 pr-4">
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
                                {o?.recurringNameSnapshot || "Ver recorrência"}
                              </Link>
                            ) : null}
                          </td>
                          <td className={isDark ? "py-3 pr-4 font-semibold tabular-nums text-white" : "py-3 pr-4 font-semibold tabular-nums text-zinc-900"}>
                            {fmtBRLFromCents(getAmountCents(o))}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              {isPendingAlert ? (
                                <span className={isDark ? "inline-flex items-center rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[11px] font-bold text-amber-200" : "inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700"}>
                                  Aguardando pagamento
                                </span>
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
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
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
          }}
          offer={detailsOffer}
          onOfferUpdated={patchOfferInList}
          copyLink={copyLink}
          copiedId={copiedId}
        />
      </div>
    </Shell>
  );
}
