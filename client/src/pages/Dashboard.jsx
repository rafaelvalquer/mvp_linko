// src/pages/Dashboard.jsx
import Shell from "../components/layout/Shell.jsx";
import { api } from "../app/api.js";
import { listBookings } from "../app/bookingsApi.js";
import { listWithdraws } from "../app/withdrawApi.js";
import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import Badge from "../components/appui/Badge.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthContext.jsx";
import WithdrawModal from "../components/WithdrawModal.jsx";

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

function fmtTimeBR(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(d);
}

function safeDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
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

function holdRemainingLabel(holdExpiresAt) {
  const d = safeDate(holdExpiresAt);
  if (!d) return null;
  const ms = d.getTime() - Date.now();
  const min = Math.floor(ms / 60000);
  if (min <= 0) return "HOLD expirado";
  if (min === 1) return "Expira em 1 min";
  return `Expira em ${min} min`;
}

/** ========= Pix status UI helpers ========= */
function pixToneClasses(st) {
  const s = normStatus(st);
  if (s === "EXPIRED" || s === "CANCELLED") return "text-red-700";
  if (s === "REFUNDED") return "text-amber-800";
  if (s === "PENDING") return "text-amber-900";
  if (s === "PAID") return "text-emerald-800";
  return "text-zinc-500";
}

function pixStatusLabel(st) {
  const s = normStatus(st);
  if (s === "PAID") return "Pago";
  if (s === "PENDING") return "Pendente";
  if (s === "EXPIRED") return "Expirado";
  if (s === "CANCELLED" || s === "CANCELED") return "Cancelado";
  if (s === "REFUNDED") return "Reembolsado";
  return s || "—";
}

export default function Dashboard() {
  const [offers, setOffers] = useState([]);
  const [bookingsBusy, setBookingsBusy] = useState(true);
  const [bookingsErr, setBookingsErr] = useState("");
  const [bookings, setBookings] = useState([]);

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawsBusy, setWithdrawsBusy] = useState(true);
  const [withdrawsErr, setWithdrawsErr] = useState("");
  const [withdraws, setWithdraws] = useState([]);

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

  async function loadBookingsNext7Days() {
    try {
      setBookingsErr("");
      setBookingsBusy(true);

      const from = new Date();
      from.setHours(0, 0, 0, 0);

      const to = new Date(from);
      to.setDate(to.getDate() + 7);
      to.setHours(23, 59, 59, 999);

      const d = await listBookings({
        from: from.toISOString(),
        to: to.toISOString(),
        status: "HOLD,CONFIRMED",
      });

      setBookings(d.items || []);
    } catch (e) {
      if (e?.status === 401) {
        signOut();
        nav(`/login?next=${encodeURIComponent("/")}`, { replace: true });
        return;
      }
      setBookingsErr(e?.message || "Falha ao carregar agenda.");
    } finally {
      setBookingsBusy(false);
    }
  }

  async function loadWithdrawsLatest() {
    try {
      setWithdrawsErr("");
      setWithdrawsBusy(true);

      const d = await listWithdraws({ limit: 10 });
      setWithdraws(d.items || []);
    } catch (e) {
      if (e?.status === 401) {
        signOut();
        nav(`/login?next=${encodeURIComponent("/")}`, { replace: true });
        return;
      }
      setWithdrawsErr(e?.message || "Falha ao carregar saques.");
    } finally {
      setWithdrawsBusy(false);
    }
  }

  async function load() {
    try {
      setError("");
      setLoading(true);

      const d = await api("/offers");
      setOffers(d.items || []);

      loadBookingsNext7Days();
      loadWithdrawsLatest();
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

  useEffect(() => {
    load();
  }, []);

  const fmtBRL = (cents) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format((cents || 0) / 100);

  const kpis = useMemo(() => {
    const total = offers.length;

    const totalValueCents = offers.reduce(
      (acc, o) => acc + (o.amountCents || 0),
      0,
    );

    const PAID_SET = new Set(["PAID", "CONFIRMED"]);
    const BOOKED_SET = new Set(["BOOKED_HOLD", "HOLD", "CONFIRMED", "PAID"]);

    const paidOffers = offers.filter((o) => PAID_SET.has(normStatus(o.status)));
    const paidCount = paidOffers.length;

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

    const now = new Date();
    const paidToday = paidOffers.filter((o) => {
      const dt = safeDate(o.paidAt) || safeDate(o.updatedAt);
      return dt ? isSameLocalDay(dt, now) : false;
    });

    const paidTodayCount = paidToday.length;
    const paidTodayValueCents = paidToday.reduce(
      (acc, o) => acc + (o.amountCents || o.totalCents || 0),
      0,
    );

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
    };
  }, [offers]);

  const nextBookings = useMemo(() => {
    return (bookings || []).slice(0, 6);
  }, [bookings]);

  return (
    <Shell>
      <div className="space-y-4">
        <PageHeader
          title="Dashboard"
          subtitle="Orçamento que vira contrato + cobrança + agenda em 1 clique."
          actions={
            <>
              <Button variant="secondary" onClick={load} disabled={loading}>
                Atualizar
              </Button>

              <Button
                variant="secondary"
                type="button"
                onClick={() => setWithdrawOpen(true)}
              >
                Saque
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
                      const items = Array.isArray(o?.items) ? o.items : [];
                      const rawType = String(o?.offerType || "")
                        .trim()
                        .toLowerCase();
                      const isProduct =
                        rawType === "product" || items.length > 0;
                      const payUrl =
                        !isProduct && o?.bookingId
                          ? `${publicUrl}/pay?bookingId=${encodeURIComponent(o.bookingId)}`
                          : `${publicUrl}/pay`;

                      const offerSt = normStatus(o?.status);
                      const isPaidOffer =
                        offerSt === "PAID" || offerSt === "CONFIRMED";

                      const isCopied = copiedId === o._id;

                      // ✅ Pix status voltou
                      const pixSt = normStatus(o?.payment?.lastPixStatus);
                      const pixUpdatedAt = o?.payment?.lastPixUpdatedAt;

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
                                {/* ✅ sem children -> Badge mostra label PT-BR */}
                                <Badge tone={o.status || "PUBLIC"} />

                                {pixSt ? (
                                  <div
                                    className={`text-[11px] ${pixToneClasses(
                                      pixSt,
                                    )}`}
                                  >
                                    Pix:{" "}
                                    <span className="font-semibold">
                                      {pixStatusLabel(pixSt)}
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

          {/* Lateral */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <Card>
              <CardHeader
                title="Agenda (MVP)"
                subtitle="Próximas reservas (HOLD/CONFIRMED) do seu workspace."
                right={
                  <div className="text-xs text-zinc-500">
                    <Link className="underline" to="/calendar">
                      Abrir agenda
                    </Link>
                  </div>
                }
              />
              <CardBody className="space-y-3">
                {bookingsBusy ? (
                  <>
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </>
                ) : bookingsErr ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {bookingsErr}{" "}
                    <button
                      className="ml-2 font-semibold underline"
                      onClick={loadBookingsNext7Days}
                    >
                      Recarregar
                    </button>
                  </div>
                ) : nextBookings.length === 0 ? (
                  <EmptyState
                    title="Nenhuma reserva nos próximos dias"
                    description="Quando um cliente reservar um horário, aparecerá aqui."
                    ctaLabel="Ver agenda"
                    onCta={() => nav("/calendar")}
                  />
                ) : (
                  nextBookings.map((b) => {
                    const offerTitle = b?.offer?.title || "—";
                    const publicToken = b?.offer?.publicToken;
                    const holdInfo =
                      normStatus(b.status) === "HOLD"
                        ? holdRemainingLabel(b.holdExpiresAt)
                        : null;

                    return (
                      <div key={b._id} className="rounded-xl border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-zinc-900">
                              {fmtTimeBR(b.startAt)}–{fmtTimeBR(b.endAt)}
                            </div>
                            <div className="mt-0.5 text-xs text-zinc-600">
                              Cliente:{" "}
                              <span className="font-medium">
                                {b.customerName || "—"}
                              </span>
                              {b.customerWhatsApp
                                ? ` • ${b.customerWhatsApp}`
                                : ""}
                            </div>
                            <div className="mt-0.5 text-xs text-zinc-500 line-clamp-1">
                              Serviço: {offerTitle}
                            </div>
                            {holdInfo ? (
                              <div className="mt-1 text-[11px] text-amber-800">
                                {holdInfo}
                              </div>
                            ) : null}
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <Badge tone={b.status} />
                            {publicToken ? (
                              <Button
                                variant="ghost"
                                type="button"
                                onClick={() =>
                                  window.open(
                                    `/p/${publicToken}`,
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
                                }
                              >
                                Abrir proposta
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-2 text-[11px] text-zinc-400">
                          {fmtDateTimeBR(b.startAt)}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Saques"
                subtitle="Últimos saques via Pix (multi-tenant)."
                right={
                  <div className="text-xs text-zinc-500">
                    {withdraws.length ? `${withdraws.length} itens` : ""}
                  </div>
                }
              />
              <CardBody className="space-y-3">
                {withdrawsBusy ? (
                  <>
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </>
                ) : withdrawsErr ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {withdrawsErr}{" "}
                    <button
                      className="ml-2 font-semibold underline"
                      onClick={loadWithdrawsLatest}
                    >
                      Recarregar
                    </button>
                  </div>
                ) : withdraws.length === 0 ? (
                  <EmptyState
                    title="Nenhum saque ainda"
                    description="Use o botão Saque para transferir via Pix."
                    ctaLabel="Fazer saque"
                    onCta={() => setWithdrawOpen(true)}
                  />
                ) : (
                  withdraws.slice(0, 5).map((w) => (
                    <div key={w.externalId} className="rounded-xl border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zinc-900">
                            {fmtBRL(w.netAmountCents || 0)}
                          </div>
                          <div className="mt-0.5 text-xs text-zinc-500">
                            {fmtDateTimeBR(w.createdAt)}
                          </div>
                          <div className="mt-1 text-[11px] text-zinc-500">
                            Taxa: {fmtBRL(w.feeCents || 0)} • Bruto:{" "}
                            {fmtBRL(w.grossAmountCents || 0)}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <Badge tone={w.status} />
                          {w.receiptUrl &&
                          normStatus(w.status) === "COMPLETE" ? (
                            <Button
                              variant="ghost"
                              type="button"
                              onClick={() =>
                                window.open(
                                  w.receiptUrl,
                                  "_blank",
                                  "noopener,noreferrer",
                                )
                              }
                            >
                              Comprovante
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Caixa (MVP)" subtitle="Resumo de pagos." />
              <CardBody className="space-y-3">
                <div className="rounded-xl border bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-500">
                    Pagos hoje
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {loading ? "—" : fmtBRL(kpis.paidTodayValueCents)}
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
      <WithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onCreated={() => loadWithdrawsLatest()}
      />
    </Shell>
  );
}
