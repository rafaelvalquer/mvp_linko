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

import OfferDetailsModal from "../components/offers/OfferDetailsModal.jsx";
import {
  norm,
  fmtBRLFromCents,
  getAmountCents,
  getPaymentLabel,
} from "../components/offers/offerHelpers.js";

export default function Offers() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [copiedId, setCopiedId] = useState(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsOffer, setDetailsOffer] = useState(null);

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

    const base =
      filter === "ALL"
        ? items
        : (items || []).filter((o) => {
            const pay = norm(o?.paymentStatus);
            const flow = norm(o?.status || "PUBLIC");
            const paid =
              ["PAID", "CONFIRMED"].includes(pay) ||
              ["PAID", "CONFIRMED"].includes(flow);

            if (filter === "PAID") return paid;
            if (
              ["PENDING", "WAITING_CONFIRMATION", "REJECTED"].includes(filter)
            )
              return pay === filter;

            return flow === filter;
          });

    if (!query) return base;

    return base.filter((o) => {
      const a = String(o?.customerName || "").toLowerCase();
      const b = String(o?.title || "").toLowerCase();
      return a.includes(query) || b.includes(query);
    });
  }, [items, q, filter]);

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
          subtitle="Gerencie propostas e confirmações de pagamento."
          right={
            <Link to="/offers/new">
              <Button>Nova proposta</Button>
            </Link>
          }
        />

        <Card>
          <CardBody className="p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-2">
                <select
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="ALL">Todos</option>
                  <option value="WAITING_CONFIRMATION">
                    Aguardando confirmação
                  </option>
                  <option value="PENDING">Aguardando pagamento</option>
                  <option value="REJECTED">Comprovante recusado</option>
                  <option value="PAID">Pago (confirmado)</option>
                  <option value="ACCEPTED">Aceito</option>
                  <option value="PUBLIC">Público</option>
                  <option value="EXPIRED">Expirado</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>

                <div className="w-full md:w-80">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar cliente ou proposta…"
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
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="mt-8">
                <EmptyState
                  title="Nenhuma proposta"
                  description="Ajuste filtros ou crie uma nova."
                  ctaLabel="Criar proposta"
                  onCta={() => (window.location.href = "/offers/new")}
                />
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-zinc-400">
                    <tr>
                      <th className="border-b border-zinc-100 py-3 pr-4">
                        Cliente
                      </th>
                      <th className="border-b border-zinc-100 py-3 pr-4">
                        Proposta
                      </th>
                      <th className="border-b border-zinc-100 py-3 pr-4">
                        Valor
                      </th>
                      <th className="border-b border-zinc-100 py-3 pr-4">
                        Status
                      </th>
                      <th className="border-b border-zinc-100 py-3 text-right">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filtered.map((o) => {
                      const pay = getPaymentLabel(o);
                      const publicUrl = `/p/${o.publicToken}`;
                      const copied = copiedId === o._id;

                      return (
                        <tr key={o._id} className="hover:bg-zinc-50/50">
                          <td className="py-3 pr-4">
                            <div className="font-semibold text-zinc-900">
                              {o.customerName || "—"}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {o.customerWhatsApp || "—"}
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="text-zinc-900">
                              {o.title || "Proposta"}
                            </div>
                            <div className="text-xs text-zinc-500 line-clamp-1">
                              {o.description || ""}
                            </div>
                          </td>
                          <td className="py-3 pr-4 font-semibold text-zinc-900 tabular-nums">
                            {fmtBRLFromCents(getAmountCents(o))}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <Badge tone={pay.tone}>{pay.text}</Badge>
                              {o?.notifyWhatsAppOnPaid ? (
                                <span className="text-[10px] font-bold text-emerald-700 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1">
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
                                  window.open(
                                    publicUrl,
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
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
