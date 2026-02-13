// src/pages/Dashboard.jsx
import Shell from "../components/layout/Shell.jsx";
import { api } from "../app/api.js";
import { listBookings } from "../app/bookingsApi.js";
import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import Badge from "../components/appui/Badge.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthContext.jsx";

function normStatus(s) {
  return String(s || "")
    .trim()
    .toUpperCase();
}

function fmtDateTimeBR(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR");
}

function pixToneClasses(st) {
  const s = normStatus(st);
  if (s === "EXPIRED" || s === "CANCELLED") return "text-red-700";
  if (s === "REFUNDED") return "text-amber-800";
  if (s === "PENDING") return "text-amber-900";
  if (s === "PAID") return "text-emerald-800";
  return "text-zinc-500";
}

function isSameLocalDay(a, b) {
  if (!(a instanceof Date) || Number.isNaN(a.getTime())) return false;
  if (!(b instanceof Date) || Number.isNaN(b.getTime())) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function safeDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export default function Dashboard() {
  const [offers, setOffers] = useState([]);
  const [bookingsBusy, setBookingsBusy] = useState(true);
  const [bookingsErr, setBookingsErr] = useState("");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const copiedTimerRef = useRef(null);
  const nav = useNavigate();
  const { signOut } = useAuth();

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  async function loadOffers() {
    try {
      setError("");
      setLoading(true);
      const d = await api("/offers");
      setOffers(d.items || []);
    } catch (e) {
      if (e?.status === 401) {
        signOut();
        nav(`/login?next=${encodeURIComponent("/")}`, { replace: true });
        return;
      }
      setError(e?.message || "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  function bookingStatusLabel(st) {
    const s = normStatus(st);
    if (s === "CONFIRMED") return "Confirmada";
    if (s === "HOLD") return "Em espera";
    if (s === "EXPIRED") return "Expirada";
    if (s === "CANCELLED" || s === "CANCELED") return "Cancelada";
    return s || "—";
  }

  function bookingTone(st) {
    // mantém compat com seu Badge.jsx (que tem HOLD/CONFIRMED/EXPIRED/CANCELED)
    const s = normStatus(st);
    if (s === "CANCELLED") return "CANCELED";
    return s || "DRAFT";
  }

  function fmtTimeBR(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function fmtDateBR(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR");
  }

  function fmtRangeBR(startAt, endAt) {
    const s = safeDate(startAt);
    const e = safeDate(endAt);
    if (!s || !e) return "";
    if (isSameLocalDay(s, e)) {
      return `${fmtDateBR(startAt)} • ${fmtTimeBR(startAt)}–${fmtTimeBR(endAt)}`;
    }
    return `${fmtDateTimeBR(startAt)} – ${fmtDateTimeBR(endAt)}`;
  }

  function pickOfferTitle(b) {
    return b?.offer?.title || b?.offerTitle || b?.title || "Proposta";
  }
  function pickOfferId(b) {
    return b?.offer?._id || b?.offerId || b?.offer?.id || "";
  }
  function pickPublicToken(b) {
    return b?.offer?.publicToken || b?.publicToken || b?.offerPublicToken || "";
  }

  async function loadBookings() {
    try {
      setBookingsErr("");
      setBookingsBusy(true);

      const now = new Date();
      const from = now.toISOString();
      const to = new Date(
        now.getTime() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      // backend ideal: status=HOLD,CONFIRMED (ou repetido), mas filtramos no front também por segurança
      const d = await listBookings({ from, to, status: "HOLD,CONFIRMED" });
      const items = d?.items || d?.bookings || [];

      const arr = Array.isArray(items) ? items : [];
      const filtered = arr
        .filter((b) => {
          const st = normStatus(b?.status);
          return st === "HOLD" || st === "CONFIRMED";
        })
        .sort((a, b) => {
          const as = safeDate(a?.startAt)?.getTime() || 0;
          const bs = safeDate(b?.startAt)?.getTime() || 0;
          return as - bs;
        });

      setBookings(filtered);
    } catch (e) {
      if (e?.status === 401) {
        signOut();
        nav(`/login?next=${encodeURIComponent("/")}`, { replace: true });
        return;
      }
      setBookingsErr(e?.message || "Falha ao carregar reservas.");
      setBookings([]);
    } finally {
      setBookingsBusy(false);
    }
  }

  async function loadAll() {
    await Promise.all([loadOffers(), loadBookings()]);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const fmtBRL = (cents) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format((cents || 0) / 100);

  const kpis = useMemo(() => {
    const total = offers.length;

    // Volume: mantém seu comportamento atual (somatório de amountCents)
    const totalValueCents = offers.reduce(
      (acc, o) => acc + (o.amountCents || 0),
      0,
    );

    const PAID_SET = new Set(["PAID", "CONFIRMED"]);
    const PIX_PENDING_SET = new Set(["PENDING"]);
    const PIX_DONE_SET = new Set(["PAID"]);
    const PIX_FAIL_SET = new Set(["EXPIRED", "CANCELLED", "REFUNDED"]);
    const BOOKED_SET = new Set(["BOOKED_HOLD", "HOLD", "CONFIRMED", "PAID"]);

    const paidOffers = offers.filter((o) => PAID_SET.has(normStatus(o.status)));
    const paidCount = paidOffers.length;

    // Agendamentos: conta se tem bookingId/scheduledStartAt ou status de agendado
    const bookedOffers = offers.filter((o) => {
      const st = normStatus(o.status);
      return (
        !!o.bookingId ||
        !!o.scheduledStartAt ||
        !!o.scheduledEndAt ||
        BOOKED_SET.has(st)
      );
    });
    const bookedCount = bookedOffers.length;

    // Pagos hoje: conta e soma valores hoje (por paidAt; fallback: updatedAt)
    const now = new Date();
    const paidToday = paidOffers.filter((o) => {
      const dt = safeDate(o.paidAt) || safeDate(o.updatedAt);
      return dt ? isSameLocalDay(dt, now) : false;
    });
    const paidTodayCount = paidToday.length;

    // Valor pago hoje: fallback em amountCents, depois totalCents
    const paidTodayValueCents = paidToday.reduce(
      (acc, o) => acc + (o.amountCents || o.totalCents || 0),
      0,
    );

    const getValueCents = (o) => {
      const v = Number(o?.amountCents ?? o?.totalCents ?? 0);
      return Number.isFinite(v) ? v : 0;
    };

    // Pendentes (preferir Pix status; fallback status Offer)
    const pendingOffers = offers.filter((o) => {
      const valueCents = getValueCents(o);
      if (valueCents <= 0) return false;

      const pixSt = normStatus(o?.payment?.lastPixStatus);
      if (pixSt) {
        if (PIX_PENDING_SET.has(pixSt)) return true;
        if (PIX_DONE_SET.has(pixSt)) return false;
        if (PIX_FAIL_SET.has(pixSt)) return false;
        // status desconhecido -> cai no fallback de status da offer
      }

      const st = normStatus(o?.status);
      if (PAID_SET.has(st)) return false;
      return st === "PUBLIC" || st === "SENT" || st === "DRAFT";
    });

    const pendingCount = pendingOffers.length;
    const pendingValueCents = pendingOffers.reduce(
      (acc, o) => acc + getValueCents(o),
      0,
    );

    // Conversão: pagos / propostas (em %)
    const conversionPct = total > 0 ? Math.round((paidCount / total) * 100) : 0;

    const last5 = offers.slice(0, 5);

    return {
      total,
      totalValueCents,
      last5,
      paidCount,
      bookedCount,
      conversionPct,
      paidTodayCount,
      paidTodayValueCents,
      pendingCount,
      pendingValueCents,
    };
  }, [offers]);

  return (
    <Shell>
      <div className="space-y-4">
        <PageHeader
          title="Dashboard"
          subtitle="Orçamento que vira contrato + cobrança + agenda em 1 clique."
          actions={
            <>
              <Button
                variant="secondary"
                onClick={loadAll}
                disabled={loading || bookingsBusy}
              >
                Atualizar
              </Button>
              <Link to="/offers/new">
                <Button>Nova proposta</Button>
              </Link>
            </>
          }
        />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}{" "}
            <button className="ml-2 font-semibold underline" onClick={load}>
              Tentar novamente
            </button>
          </div>
        ) : null}

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Propostas", value: kpis.total, meta: "total" },
            {
              label: "Volume",
              value: fmtBRL(kpis.totalValueCents),
              meta: "somatório (amountCents)",
            },
            {
              label: "Conversão",
              value: `${kpis.conversionPct}%`,
              meta: `${kpis.paidCount}/${kpis.total} pagos`,
            },
            {
              label: "Agendamentos",
              value: kpis.bookedCount,
              meta: "com booking/hold",
            },
            {
              label: "Pagos hoje",
              value: kpis.paidTodayCount,
              meta: fmtBRL(kpis.paidTodayValueCents),
            },
          ].map((it) => (
            <Card key={it.label}>
              <CardBody>
                <div className="text-xs font-semibold text-zinc-500">
                  {it.label}
                </div>
                <div className="mt-2 text-xl font-semibold text-zinc-900">
                  {loading ? <Skeleton className="h-7 w-24" /> : it.value}
                </div>
                <div className="mt-1 text-xs text-zinc-400">{it.meta}</div>
              </CardBody>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Links recentes */}
          <div className="col-span-12 lg:col-span-8">
            <Card>
              <CardHeader
                title="Links recentes"
                subtitle="Ações rápidas: copiar e abrir link público."
                right={
                  <div className="text-xs text-zinc-500">
                    {offers.length} itens
                  </div>
                }
              />
              <CardBody className="p-0">
                {loading ? (
                  <div className="p-5 space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : offers.length === 0 ? (
                  <div className="p-5">
                    <EmptyState
                      title="Nenhuma proposta ainda"
                      description="Crie uma proposta e envie o link para o cliente."
                      ctaLabel="Nova proposta"
                      onCta={() => nav("/offers/new")}
                    />
                  </div>
                ) : (
                  <div className="p-4 sm:p-5 space-y-3">
                    {kpis.last5.map((o) => {
                      const publicUrl = `/p/${o.publicToken}`;
                      const payUrl = `${publicUrl}/pay`;
                      const pixSt = normStatus(o?.payment?.lastPixStatus);
                      const pixUpdatedAt = o?.payment?.lastPixUpdatedAt;

                      const offerSt = normStatus(o?.status);
                      const isPaidOffer =
                        offerSt === "PAID" || offerSt === "CONFIRMED";

                      const isCopied = copiedId === o._id;

                      return (
                        <div
                          key={o._id}
                          className="rounded-2xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50 transition"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-zinc-900">
                                {o.customerName}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {o.customerWhatsApp || "—"}
                              </div>
                              <div className="mt-2 min-w-0">
                                <div className="text-sm font-medium text-zinc-900">
                                  {o.title}
                                </div>
                                <div className="text-xs text-zinc-500 line-clamp-2">
                                  {o.description || "—"}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col items-start sm:items-end gap-2">
                              <div className="text-sm font-semibold text-zinc-900">
                                {fmtBRL(o.amountCents || o.totalCents || 0)}
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={o.status || "PUBLIC"}>
                                  {o.status || "PUBLIC"}
                                </Badge>
                                {pixSt ? (
                                  <div
                                    className={`text-[11px] ${pixToneClasses(
                                      pixSt,
                                    )}`}
                                  >
                                    Pix:{" "}
                                    <span className="font-semibold">
                                      {pixSt}
                                    </span>
                                    {pixUpdatedAt ? (
                                      <> • {fmtDateTimeBR(pixUpdatedAt)}</>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>

                              <div className="flex flex-wrap gap-2 pt-1">
                                <Button
                                  variant="secondary"
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(
                                        window.location.origin + publicUrl,
                                      );
                                      setCopiedId(o._id);
                                      if (copiedTimerRef.current)
                                        clearTimeout(copiedTimerRef.current);
                                      copiedTimerRef.current = setTimeout(
                                        () => setCopiedId(null),
                                        1200,
                                      );
                                    } catch {}
                                  }}
                                >
                                  {isCopied ? "Copiado!" : "Copiar"}
                                </Button>

                                <Button
                                  variant="ghost"
                                  type="button"
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

                                {!isPaidOffer ? (
                                  <Button
                                    variant="secondary"
                                    type="button"
                                    onClick={() =>
                                      window.open(
                                        payUrl,
                                        "_blank",
                                        "noopener,noreferrer",
                                      )
                                    }
                                  >
                                    Abrir pagamento
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Painéis laterais (MVP placeholders) */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <Card>
              <CardHeader
                title="Agenda (MVP)"
                subtitle="Próximas reservas (7 dias) — HOLD e CONFIRMED."
              />
              <CardBody>
                {bookingsBusy ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : bookingsErr ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {bookingsErr}{" "}
                    <button
                      className="ml-2 font-semibold underline"
                      onClick={loadBookings}
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : bookings.length === 0 ? (
                  <EmptyState
                    title="Nenhuma reserva nos próximos 7 dias"
                    description="Quando um cliente agendar (HOLD) ou confirmar (CONFIRMED), vai aparecer aqui."
                  />
                ) : (
                  <div className="space-y-2">
                    {bookings.map((b) => {
                      const offerTitle = pickOfferTitle(b);
                      const offerId = pickOfferId(b);
                      const publicToken = pickPublicToken(b);
                      const publicUrl = publicToken ? `/p/${publicToken}` : "";

                      return (
                        <div
                          key={b._id || b.id}
                          className="rounded-xl border bg-white p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-zinc-900">
                                {fmtRangeBR(b.startAt, b.endAt) || "—"}
                              </div>
                              <div className="mt-0.5 text-xs text-zinc-500 line-clamp-1">
                                {offerTitle}
                              </div>
                            </div>

                            <Badge tone={bookingTone(b.status)}>
                              {bookingStatusLabel(b.status)}
                            </Badge>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {offerId ? (
                              <Link to={`/offers/${offerId}`}>
                                <Button variant="secondary" type="button">
                                  Ver no painel
                                </Button>
                              </Link>
                            ) : null}

                            {publicUrl ? (
                              <Button
                                variant="ghost"
                                type="button"
                                onClick={() =>
                                  window.open(
                                    publicUrl,
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
                                }
                              >
                                Abrir link público
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Caixa (MVP)"
                subtitle="Resumo de pagos/pendentes/reembolsos."
              />
              <CardBody className="space-y-3">
                <div className="rounded-xl border bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-500">
                    Pagos hoje
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {loading ? "—" : fmtBRL(kpis.paidTodayValueCents)}
                  </div>
                </div>
                <div className="rounded-xl border bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-500">
                    Pendentes
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {loading ? "—" : fmtBRL(kpis.pendingValueCents)}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {loading ? "—" : `${kpis.pendingCount} propostas`}
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </Shell>
  );
}
