// src/pages/Offers.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../app/api.js";

// Componentes da UI
import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import { Input } from "../components/appui/Input.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import Badge from "../components/appui/Badge.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";

// Ícones simples para manter a UI "clean" sem novas dependências
const IconCopy = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2}
    stroke="currentColor"
    className="w-4 h-4"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
    />
  </svg>
);

const IconExternal = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2}
    stroke="currentColor"
    className="w-4 h-4"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
    />
  </svg>
);

const IconEye = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2}
    stroke="currentColor"
    className="w-4 h-4"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const STATUS_LABEL = {
  PUBLIC: "Público",
  ACCEPTED: "Aceito",
  HOLD: "Reservado",
  CONFIRMED: "Pago",
  PAID: "Pago",
  EXPIRED: "Expirado",
  CANCELLED: "Cancelado",
  CANCELED: "Cancelado",
  DRAFT: "Rascunho",
  PENDING: "Pendente",
};

// ===== helpers (seguros) =====
const normStatus = (s) => {
  const v = String(s || "")
    .trim()
    .toUpperCase();
  if (!v) return "";
  return v === "CANCELED" ? "CANCELLED" : v;
};
const isPaidCode = (s) => ["PAID", "CONFIRMED"].includes(normStatus(s));
const isOfferPaid = (o) =>
  isPaidCode(o?.paymentStatus) || isPaidCode(o?.status);

const safeDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
};

const fmtDateTimeBR = (isoOrDate) => {
  const d = isoOrDate instanceof Date ? isoOrDate : safeDate(isoOrDate);
  return d ? d.toLocaleString("pt-BR") : "—";
};

const fmtBRLFromCents = (cents) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (Number(cents) || 0) / 100,
  );

function getPaidAt(o) {
  return (
    o?.paidAt ||
    o?.payment?.lastPixUpdatedAt ||
    o?.payment?.updatedAt ||
    o?.updatedAt ||
    o?.createdAt ||
    null
  );
}

function getPaidCents(o) {
  const v = o?.paidAmountCents ?? o?.totalCents ?? o?.amountCents ?? 0;
  return Number(v) || 0;
}

function getTotalCents(o) {
  return Number(o?.totalCents ?? o?.amountCents ?? 0) || 0;
}

function getSubtotalCents(o) {
  const v = o?.subtotalCents;
  return v == null ? null : Number(v) || 0;
}

function getDiscountCents(o) {
  const v = o?.discountCents;
  return v == null ? null : Number(v) || 0;
}

function getFreightCents(o) {
  const v = o?.freightCents;
  return v == null ? null : Number(v) || 0;
}

function extractBooking(offer) {
  // suporte a diferentes formatos, sem depender de endpoint
  const b =
    offer?.booking ||
    offer?.appointment ||
    offer?.schedule ||
    offer?.agenda ||
    null;

  if (b && (b.startAt || b.endAt)) return b;

  if (offer?.startAt || offer?.endAt) {
    return {
      startAt: offer.startAt,
      endAt: offer.endAt,
      status: offer.bookingStatus || offer.scheduleStatus || offer.status,
    };
  }

  return null;
}

function OfferDetailsModal({
  open,
  baseOffer,
  offer,
  loading,
  error,
  onClose,
  onCopyLink,
  onOpenLink,
}) {
  if (!open) return null;

  const o = offer || baseOffer || {};
  const publicUrl = o?.publicToken ? `/p/${o.publicToken}` : null;

  const paid = isOfferPaid(o);
  const paidAt = getPaidAt(o);
  const paidCents = paid ? getPaidCents(o) : 0;

  const items = Array.isArray(o?.items) ? o.items : [];
  const offerType = String(o?.offerType || "service").toLowerCase();
  const booking = extractBooking(o);

  const totalCents = getTotalCents(o);
  const subtotalCents = getSubtotalCents(o);
  const discountCents = getDiscountCents(o);
  const freightCents = getFreightCents(o);

  const paymentStatus = normStatus(
    o?.paymentStatus || o?.payment?.lastPixStatus || "",
  );
  const flowStatus = normStatus(o?.status || "PUBLIC");

  const pillCode = paid ? "PAID" : flowStatus || "PUBLIC";
  const pillText = STATUS_LABEL[pillCode] || pillCode;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Detalhes da proposta"
      onClick={() => onClose?.()}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm font-semibold text-zinc-900 truncate">
                {o?.customerName || "Cliente"}
              </div>

              <Badge tone={pillCode} size="xs">
                {pillText}
              </Badge>
            </div>

            <div className="mt-1 text-xs text-zinc-500 line-clamp-1">
              {o?.title || "Proposta"}{" "}
              {o?.description ? `• ${o.description}` : ""}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {publicUrl ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9"
                  onClick={() => onCopyLink?.(publicUrl)}
                >
                  <IconCopy />
                  <span className="ml-2">Copiar</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9"
                  onClick={() => onOpenLink?.(publicUrl)}
                >
                  <IconExternal />
                  <span className="ml-2">Abrir</span>
                </Button>
              </>
            ) : null}

            <button
              type="button"
              className="h-9 w-9 rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
              onClick={() => onClose?.()}
              aria-label="Fechar"
              title="Fechar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-40 rounded-lg" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Payment + Totals */}
            <div className="lg:col-span-1 space-y-4">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Pagamento
                </div>

                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="text-sm font-semibold text-zinc-900">
                    {paid ? "Confirmado" : "Pendente"}
                  </div>
                  <div className="text-lg font-extrabold text-zinc-900 tabular-nums">
                    {paid ? fmtBRLFromCents(paidCents) : "—"}
                  </div>
                </div>

                <div className="mt-2 text-xs text-zinc-600 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-500">Pago em</span>
                    <span className="font-semibold text-zinc-800">
                      {paid ? fmtDateTimeBR(paidAt) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-500">Método</span>
                    <span className="font-semibold text-zinc-800">Pix</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Resumo
                </div>

                <div className="mt-2 space-y-1 text-xs">
                  {subtotalCents != null ? (
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Subtotal</span>
                      <span className="font-semibold text-zinc-900 tabular-nums">
                        {fmtBRLFromCents(subtotalCents)}
                      </span>
                    </div>
                  ) : null}

                  {discountCents != null ? (
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Desconto</span>
                      <span className="font-semibold text-zinc-900 tabular-nums">
                        - {fmtBRLFromCents(discountCents)}
                      </span>
                    </div>
                  ) : null}

                  {freightCents != null ? (
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Frete</span>
                      <span className="font-semibold text-zinc-900 tabular-nums">
                        {fmtBRLFromCents(freightCents)}
                      </span>
                    </div>
                  ) : null}

                  <div className="pt-2 mt-2 border-t border-zinc-100 flex items-center justify-between">
                    <span className="text-zinc-600 font-bold">Total</span>
                    <span className="text-zinc-900 font-extrabold tabular-nums">
                      {fmtBRLFromCents(totalCents)}
                    </span>
                  </div>
                </div>
              </div>

              {booking ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    Agendamento
                  </div>

                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Início</span>
                      <span className="font-semibold text-zinc-900">
                        {fmtDateTimeBR(booking.startAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Fim</span>
                      <span className="font-semibold text-zinc-900">
                        {fmtDateTimeBR(booking.endAt)}
                      </span>
                    </div>
                    {booking.status ? (
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-zinc-500">Status</span>
                        <span className="font-semibold text-zinc-900">
                          {normStatus(booking.status)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Right: Offer info + items */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      Proposta
                    </div>
                    <div className="mt-2 text-sm font-semibold text-zinc-900">
                      {o?.title || "—"}
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">
                      {o?.description || "—"}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      Tipo
                    </div>
                    <div className="mt-1 text-xs font-semibold text-zinc-900">
                      {offerType === "product" ? "Produto" : "Serviço"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                    <div className="text-[11px] font-bold uppercase text-zinc-400">
                      Cliente
                    </div>
                    <div className="mt-1 font-semibold text-zinc-900">
                      {o?.customerName || "—"}
                    </div>
                    <div className="mt-1 text-zinc-600">
                      {o?.customerWhatsApp || "—"}
                    </div>
                    <div className="mt-1 text-zinc-600">
                      {o?.customerEmail || "—"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                    <div className="text-[11px] font-bold uppercase text-zinc-400">
                      Vendedor
                    </div>
                    <div className="mt-1 font-semibold text-zinc-900">
                      {o?.sellerName || "—"}
                    </div>
                    <div className="mt-1 text-zinc-600">
                      {o?.sellerEmail || "—"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    Itens
                  </div>
                  <div className="text-xs text-zinc-500">
                    {items.length ? `${items.length} item(s)` : "—"}
                  </div>
                </div>

                {items.length ? (
                  <div className="mt-3 overflow-hidden rounded-xl border border-zinc-100">
                    <table className="w-full text-left">
                      <thead className="bg-zinc-50">
                        <tr>
                          <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                            Descrição
                          </th>
                          <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400 text-right">
                            Qtde
                          </th>
                          <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400 text-right">
                            Unit.
                          </th>
                          <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400 text-right">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {items.map((it, idx) => {
                          const qty = Number(it?.qty ?? 1) || 1;
                          const unit = Number(it?.unitPriceCents ?? 0) || 0;
                          const line =
                            Number(it?.lineTotalCents ?? qty * unit) || 0;

                          return (
                            <tr key={idx} className="text-xs">
                              <td className="px-3 py-2">
                                <div className="font-semibold text-zinc-900">
                                  {it?.description || "Item"}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-zinc-700">
                                {qty}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-zinc-700">
                                {unit ? fmtBRLFromCents(unit) : "—"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold text-zinc-900">
                                {fmtBRLFromCents(line)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-xs text-zinc-600">
                    {offerType === "product"
                      ? "Nenhum item detalhado. (Você pode adicionar itens na criação da proposta.)"
                      : "Serviço sem itens detalhados."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-500">
            ID: <span className="font-mono text-zinc-700">{o?._id || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onClose?.()}>
              Fechar
            </Button>
            {publicUrl ? (
              <Button onClick={() => onOpenLink?.(publicUrl)}>
                Abrir link público
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Offers() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [copiedId, setCopiedId] = useState(null);

  // modal state
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsBase, setDetailsBase] = useState(null);
  const [detailsOffer, setDetailsOffer] = useState(null);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [detailsErr, setDetailsErr] = useState("");

  async function load() {
    try {
      setError("");
      setLoading(true);
      const d = await api("/offers");
      setItems(d.items || []);
    } catch (e) {
      setError(e?.message || "Falha ao carregar propostas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    const s =
      status === "ALL"
        ? items
        : items.filter((o) => {
            const st = String(o.status || "PUBLIC").toUpperCase();
            return st === status;
          });

    if (!query) return s;

    return s.filter((o) => {
      const a = (o.customerName || "").toLowerCase();
      const b = (o.title || "").toLowerCase();
      return a.includes(query) || b.includes(query);
    });
  }, [items, q, status]);

  const fmtBRL = (cents) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format((cents || 0) / 100);

  const handleCopyLink = async (id, url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch (err) {}
  };

  async function openDetails(o) {
    setDetailsOpen(true);
    setDetailsErr("");
    setDetailsBase(o || null);
    setDetailsOffer(o || null);

    const id = o?._id;
    if (!id) return;

    setDetailsBusy(true);
    try {
      const res = await api(`/offers/${id}`);

      if (res?.ok === false) {
        throw new Error(res?.error || "Falha ao carregar detalhes.");
      }

      const fullOffer = res?.offer || null;
      const booking = res?.booking || null;

      if (fullOffer && typeof fullOffer === "object") {
        // ✅ anexa booking no objeto que o modal consome
        setDetailsOffer({ ...(o || {}), ...fullOffer, booking });
      } else {
        // fallback seguro: pelo menos tenta injetar booking
        setDetailsOffer({ ...(o || {}), booking });
      }
    } catch (e) {
      setDetailsErr(e?.message || "Não foi possível carregar detalhes.");
    } finally {
      setDetailsBusy(false);
    }
  }

  function closeDetails() {
    setDetailsOpen(false);
    setDetailsBase(null);
    setDetailsOffer(null);
    setDetailsErr("");
    setDetailsBusy(false);
  }

  function modalCopy(publicUrl) {
    const full = window.location.origin + publicUrl;
    handleCopyLink(detailsOffer?._id || detailsBase?._id || "modal", full);
  }

  function modalOpen(publicUrl) {
    window.open(publicUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <Shell>
      <div className="space-y-6">
        <PageHeader
          title="Propostas"
          subtitle="Acompanhe o status e ações de seus links comerciais."
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={load}
                disabled={loading}
                className="hidden sm:inline-flex"
              >
                Atualizar
              </Button>
              <Link to="/offers/new">
                <Button>Nova Proposta</Button>
              </Link>
            </div>
          }
        />

        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              {error}
            </div>
            <button className="font-semibold underline" onClick={load}>
              Tentar novamente
            </button>
          </div>
        )}

        <Card>
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <span className="text-zinc-900">Links Gerados</span>
                {!loading && (
                  <span className="text-[11px] font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">
                    {filtered.length} total
                  </span>
                )}
              </div>
            }
            right={
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="ALL">Todos os status</option>
                  <option value="PUBLIC">Publico</option>
                  <option value="PAID">Pago</option>
                  <option value="ACCEPTED">Aceito</option>
                  <option value="EXPIRED">Expirado</option>
                </select>
                <div className="w-full sm:w-60">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar cliente ou serviço…"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            }
          />

          <CardBody className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12">
                <EmptyState
                  title="Nenhuma proposta"
                  description="Ajuste os filtros ou crie uma nova."
                  ctaLabel="Criar Proposta"
                  onCta={() => (window.location.href = "/offers/new")}
                />
              </div>
            ) : (
              <>
                {/* Desktop: Tabela Otimizada */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50/50">
                        <th className="border-b border-zinc-100 px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          Cliente
                        </th>
                        <th className="border-b border-zinc-100 px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          Serviço
                        </th>
                        <th className="border-b border-zinc-100 px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          Valor
                        </th>
                        <th className="border-b border-zinc-100 px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400 text-center">
                          Status
                        </th>
                        <th className="border-b border-zinc-100 px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400 text-right">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filtered.map((o) => {
                        const publicUrl = `/p/${o.publicToken}`;
                        const fullUrl = window.location.origin + publicUrl;
                        const isCopied = copiedId === o._id;

                        return (
                          <tr
                            key={o._id}
                            className="hover:bg-zinc-50/50 transition-colors group"
                          >
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-zinc-900 leading-tight">
                                {o.customerName}
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                {o.customerWhatsApp || "—"}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-zinc-700 font-medium line-clamp-1 truncate max-w-[180px]">
                                {o.title}
                              </div>
                              <div className="text-[11px] text-zinc-400 line-clamp-1 italic">
                                {o.description || "—"}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-zinc-900">
                              {fmtBRL(o.amountCents)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Badge tone={o.status || "PUBLIC"}>
                                {o.status || "PUBLIC"}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant={isCopied ? "primary" : "secondary"}
                                  size="sm"
                                  onClick={() => handleCopyLink(o._id, fullUrl)}
                                  className="h-8 px-3 text-[12px] flex items-center gap-1.5 transition-all"
                                >
                                  <IconCopy />
                                  {isCopied ? "Copiado" : "Copiar"}
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
                                  className="h-8 w-8 !p-0 flex items-center justify-center hover:bg-zinc-100"
                                  title="Abrir link"
                                >
                                  <IconExternal />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openDetails(o)}
                                  className="h-8 w-8 !p-0 flex items-center justify-center hover:bg-zinc-100"
                                  title="Ver Detalhes"
                                >
                                  <IconEye />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: Cards Compactos */}
                <div className="md:hidden divide-y divide-zinc-100">
                  {filtered.map((o) => {
                    const publicUrl = `/p/${o.publicToken}`;
                    const fullUrl = window.location.origin + publicUrl;
                    const isCopied = copiedId === o._id;

                    return (
                      <div key={o._id} className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="max-w-[70%]">
                            <div className="text-sm font-bold text-zinc-900 truncate">
                              {o.customerName}
                            </div>
                            <div className="text-xs text-zinc-500 truncate">
                              {o.title}
                            </div>
                          </div>
                          <Badge tone={o.status || "PUBLIC"}>
                            {o.status || "PUBLIC"}
                          </Badge>
                        </div>

                        <div className="flex justify-between items-center bg-zinc-50 rounded-lg p-2.5">
                          <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-tight">
                            Total
                          </span>
                          <span className="text-sm font-bold text-zinc-900">
                            {fmtBRL(o.amountCents)}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            variant={isCopied ? "primary" : "secondary"}
                            size="sm"
                            className="text-xs h-9"
                            onClick={() => handleCopyLink(o._id, fullUrl)}
                          >
                            {isCopied ? "Copiado" : "Copiar"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-9 border border-zinc-200"
                            onClick={() => window.open(publicUrl, "_blank")}
                          >
                            Abrir
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-9 border border-zinc-200"
                            onClick={() => openDetails(o)}
                          >
                            Ver
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardBody>
        </Card>

        {/* MODAL DETALHES */}
        <OfferDetailsModal
          open={detailsOpen}
          baseOffer={detailsBase}
          offer={detailsOffer}
          loading={detailsBusy}
          error={detailsErr}
          onClose={closeDetails}
          onCopyLink={modalCopy}
          onOpenLink={modalOpen}
        />
      </div>
    </Shell>
  );
}
