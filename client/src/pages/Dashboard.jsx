// src/pages/Dashboard.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FileText,
  CheckCircle2,
  CalendarDays,
  DollarSign,
  TrendingUp,
  Wallet as WalletIcon,
} from "lucide-react";

import Shell from "../components/layout/Shell.jsx";
import { api } from "../app/api.js";
import { listBookings } from "../app/bookingsApi.js";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import Badge from "../components/appui/Badge.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import { useAuth } from "../app/AuthContext.jsx";
import AnalyticsSection from "../components/dashboard/AnalyticsSection.jsx";
import PixSettingsModal from "../components/PixSettingsModal.jsx";

import OfferDetailsModal from "../components/offers/OfferDetailsModal.jsx";
import {
  fmtBRLFromCents,
  getAmountCents,
  getPaymentLabel,
} from "../components/offers/offerHelpers.js";
import {
  getEffectivePixKeyMasked,
  guardOfferCreation,
  hasPixAccountConfigured,
} from "../utils/guardOfferCreation.js";

const Icons = {
  Refresh: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  ),
  Plus: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  ),
  External: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  ),
  Wallet: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-indigo-500"
    >
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  ),
};

const normStatus = (s) => {
  const v = String(s || "")
    .trim()
    .toUpperCase();
  if (!v) return "";
  return v === "CANCELED" ? "CANCELLED" : v;
};

const isPaidCode = (s) => ["PAID", "CONFIRMED"].includes(normStatus(s));
const isPaidOffer = (o) =>
  isPaidCode(o?.paymentStatus) || isPaidCode(o?.status);

const isCancelledOrExpiredOffer = (o) =>
  ["CANCELLED", "EXPIRED"].includes(normStatus(o?.status)) ||
  ["CANCELLED", "EXPIRED"].includes(normStatus(o?.paymentStatus));

const fmtBRL = (cents) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (Number(cents) || 0) / 100,
  );

const fmtDateTimeBR = (iso) =>
  iso ? new Date(iso).toLocaleString("pt-BR") : "";
const fmtTimeBR = (iso) =>
  iso
    ? new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(
        new Date(iso),
      )
    : "";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function inRange(dt, start, end) {
  const t = dt instanceof Date ? dt.getTime() : new Date(dt).getTime();
  return t >= start.getTime() && t < end.getTime();
}

function offerPaidDate(o) {
  return o?.paidAt || o?.confirmedAt || o?.updatedAt || o?.createdAt;
}

function offerCreatedDate(o) {
  return o?.createdAt || o?.updatedAt;
}

function offerPaidAmountCents(o) {
  return (
    Number(o?.paidAmountCents ?? o?.totalCents ?? o?.amountCents ?? 0) || 0
  );
}

function Toast({ message, visible }) {
  return (
    <div
      className={[
        "fixed bottom-4 left-1/2 z-[9999] -translate-x-1/2 transition-all",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0",
      ].join(" ")}
    >
      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 shadow-xl">
        {message}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtitle,
  trend,
  highlight = false,
  loading = false,
  index = 0,
}) {
  return (
    <div
      className={[
        "rounded-2xl border bg-white p-4 shadow-sm ring-1 ring-zinc-200/70",
        highlight ? "border-emerald-200 ring-emerald-200" : "border-zinc-200",
      ].join(" ")}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50">
          {icon}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
          {label}
        </div>

        <div className="mt-1 text-2xl font-extrabold tabular-nums text-zinc-900">
          {loading ? "…" : value}
        </div>

        {subtitle ? (
          <div className="mt-1 text-xs text-zinc-500">{subtitle}</div>
        ) : null}

        {trend ? (
          <div className="mt-2 text-xs text-zinc-600">
            <span className="font-semibold text-zinc-800">
              {trend.format === "pct" ? `${trend.value}%` : trend.value}
            </span>{" "}
            <span className="text-zinc-500">{trend.label}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function holdRemainingLabel(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  const ms = t - Date.now();
  if (ms <= 0) return "reserva expirada";
  const min = Math.ceil(ms / 60000);
  return `reserva expira em ${min} min`;
}

export default function Dashboard() {
  const [offers, setOffers] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [loading, setLoading] = useState(true);
  const [bookingsBusy, setBookingsBusy] = useState(true);
  const [error, setError] = useState("");
  const [bookingsErr, setBookingsErr] = useState("");

  const [localPayoutPixKeyMasked, setLocalPayoutPixKeyMasked] = useState("");
  const [pixModalState, setPixModalState] = useState({
    open: false,
    title: "",
    description: "",
    redirectTo: null,
  });

  const [showToast, setShowToast] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("");

  const { signOut, workspace, loadingMe, refreshWorkspace } = useAuth();

  const nav = useNavigate();
  const location = useLocation();
  const toastTimerRef = useRef(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsOffer, setDetailsOffer] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const effectivePayoutPixKeyMasked = useMemo(
    () => getEffectivePixKeyMasked(workspace, localPayoutPixKeyMasked),
    [workspace, localPayoutPixKeyMasked],
  );

  useEffect(() => {
    setLocalPayoutPixKeyMasked(
      String(workspace?.payoutPixKeyMasked || "").trim(),
    );
  }, [workspace?.payoutPixKeyMasked]);

  const patchOfferInList = useCallback((updated) => {
    if (!updated?._id) return;
    setOffers((prev) =>
      (prev || []).map((it) =>
        it?._id === updated._id ? { ...it, ...updated } : it,
      ),
    );
    setDetailsOffer((prev) =>
      prev?._id === updated._id ? { ...prev, ...updated } : prev,
    );
  }, []);

  const copyLink = useCallback(async (offer) => {
    const token = offer?.publicToken;
    if (!token) return;

    const url = `${window.location.origin}/p/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(offer._id);
      setTimeout(() => setCopiedId(null), 1200);

      setShowToast(true);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setShowToast(false), 2000);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const openDetails = useCallback((offer) => {
    setDetailsOffer(offer || null);
    setDetailsOpen(true);
  }, []);

  function openPixModal(context = {}) {
    setPixModalState({
      open: true,
      title: String(context?.title || ""),
      description: String(context?.description || ""),
      redirectTo: context?.redirectTo || null,
    });
  }

  function closePixModal() {
    setPixModalState({
      open: false,
      title: "",
      description: "",
      redirectTo: null,
    });
  }

  async function handlePixSaved(data) {
    const masked = String(data?.payoutPixKeyMasked || "").trim();
    setLocalPayoutPixKeyMasked(masked);

    try {
      await refreshWorkspace?.();
    } catch {}

    const redirectTo = pixModalState.redirectTo;
    closePixModal();

    if (redirectTo) {
      nav(redirectTo);
    }
  }

  const handleCreateOffer = useCallback(() => {
    guardOfferCreation({
      workspace,
      payoutPixKeyMasked: effectivePayoutPixKeyMasked,
      navigate: nav,
      openPixModal,
      targetPath: "/offers/new",
    });
  }, [workspace, effectivePayoutPixKeyMasked, nav]);

  useEffect(() => {
    if (location?.state?.openPixSettings) {
      openPixModal();
      nav("/dashboard", { replace: true, state: null });
    }
  }, [location?.state, nav]);

  async function loadBookings() {
    try {
      setBookingsBusy(true);
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);
      const d = await listBookings({
        from: from.toISOString(),
        to: to.toISOString(),
        status: "HOLD,CONFIRMED",
      });
      setBookings(d.items || []);
    } catch (e) {
      if (e?.status === 401) return signOut();
      setBookingsErr("Erro na agenda.");
    } finally {
      setBookingsBusy(false);
    }
  }

  async function load() {
    try {
      setLoading(true);
      setError("");
      const d = await api("/offers");
      setOffers(d.items || []);
      setLastUpdate(
        new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(
          new Date(),
        ),
      );

      loadBookings();
    } catch (e) {
      if (e?.status === 401) return signOut();
      setError("Falha ao carregar dados principais.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpis = useMemo(() => {
    const total = offers.length;
    const last5 = offers.slice(0, 5);

    const pendingNow = offers.filter(
      (o) => !isPaidOffer(o) && !isCancelledOrExpiredOffer(o),
    ).length;

    const now = new Date();
    const today0 = startOfDay(now);
    const tomorrow0 = new Date(today0);
    tomorrow0.setDate(tomorrow0.getDate() + 1);

    const paidToday = offers.filter(
      (o) => isPaidOffer(o) && inRange(offerPaidDate(o), today0, tomorrow0),
    );
    const paidTodayCents = paidToday.reduce(
      (acc, o) => acc + offerPaidAmountCents(o),
      0,
    );

    const startNDaysAgo = (n) => {
      const d = new Date(today0);
      d.setDate(d.getDate() - (n - 1));
      return d;
    };

    const cur7Start = startNDaysAgo(7);
    const prev7Start = new Date(cur7Start);
    prev7Start.setDate(prev7Start.getDate() - 7);
    const prev7End = new Date(cur7Start);

    const cur30Start = startNDaysAgo(30);

    const paidIn = (start, end) =>
      offers.filter(
        (o) => isPaidOffer(o) && inRange(offerPaidDate(o), start, end),
      );
    const createdIn = (start, end) =>
      offers.filter((o) => inRange(offerCreatedDate(o), start, end));
    const pendingCreatedIn = (start, end) =>
      offers.filter(
        (o) =>
          !isPaidOffer(o) &&
          !isCancelledOrExpiredOffer(o) &&
          inRange(offerCreatedDate(o), start, end),
      );

    const sumCents = (items) =>
      items.reduce((acc, o) => acc + offerPaidAmountCents(o), 0);

    const paidCur7 = paidIn(cur7Start, tomorrow0);
    const paidPrev7 = paidIn(prev7Start, prev7End);

    const volumeCur7Cents = sumCents(paidCur7);
    const volumePrev7Cents = sumCents(paidPrev7);

    const pendingCur7 = pendingCreatedIn(cur7Start, tomorrow0).length;
    const pendingPrev7 = pendingCreatedIn(prev7Start, prev7End).length;

    const pctDelta = (cur, prev) => {
      const a = Number(cur) || 0;
      const b = Number(prev) || 0;
      if (b === 0) return a > 0 ? 100 : 0;
      return Math.round(((a - b) / b) * 100);
    };

    const pendingTrend = pctDelta(pendingCur7, pendingPrev7);
    const volumeTrendPct = pctDelta(volumeCur7Cents, volumePrev7Cents);

    const createdCur30 = createdIn(cur30Start, tomorrow0).length;
    const paidCur30Count = paidIn(cur30Start, tomorrow0).length;
    const conversionCur =
      createdCur30 > 0 ? Math.round((paidCur30Count / createdCur30) * 100) : 0;

    const appointments = bookings.filter((b) =>
      ["HOLD", "CONFIRMED"].includes(normStatus(b.status)),
    ).length;

    const waitingConfirmation = offers.filter(
      (o) => normStatus(o?.paymentStatus) === "WAITING_CONFIRMATION",
    ).length;

    const pixConfigured = hasPixAccountConfigured(
      workspace,
      effectivePayoutPixKeyMasked,
    );

    return {
      total,
      last5,
      pendingNow,
      pendingTrend,
      volumeCur7Cents,
      volumeTrendPct,
      paidTodayCents,
      conversionCur,
      paidCur30Count,
      appointments,
      waitingConfirmation,
      pixConfigured,
    };
  }, [offers, bookings, workspace, effectivePayoutPixKeyMasked]);

  const waitingOffers = useMemo(() => {
    return offers
      .filter((o) => normStatus(o?.paymentStatus) === "WAITING_CONFIRMATION")
      .slice(0, 5);
  }, [offers]);

  return (
    <Shell>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-blue-500/10 blur-2xl" />

          <div className="relative rounded-3xl border border-gray-200 bg-white/80 p-6 shadow-xl backdrop-blur-xl sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
                    Dashboard
                  </h1>

                  {lastUpdate && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-1.5">
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-emerald-700">
                        {loading
                          ? "Sincronizando..."
                          : `Atualizado: ${lastUpdate}`}
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-600">
                  Visão geral de sua plataforma em tempo real
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
                <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center lg:w-auto">
                  <Button
                    variant="outline"
                    onClick={load}
                    disabled={loading}
                    className="h-11 gap-2 px-4 transition-all active:scale-95"
                  >
                    <span className={`${loading ? "animate-spin" : ""}`}>
                      <Icons.Refresh />
                    </span>
                    <span className="font-semibold">
                      {loading ? "Atualizando..." : "Atualizar"}
                    </span>
                  </Button>

                  <Button
                    onClick={() => openPixModal()}
                    className="h-11 gap-2 px-4 transition-all active:scale-95 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                  >
                    <WalletIcon className="h-5 w-5" />
                    <span className="font-semibold">Conta Pix</span>
                  </Button>

                  <Button
                    size="sm"
                    onClick={handleCreateOffer}
                    className="h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 font-bold text-white shadow-lg shadow-emerald-200/60 ring-1 ring-emerald-500/20 transition-all active:scale-95 hover:from-emerald-700 hover:to-teal-700"
                  >
                    <Icons.Plus />
                    Nova proposta
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            <span>{error}</span>
            <Button variant="secondary" onClick={load}>
              Tentar novamente
            </Button>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<FileText className="h-5 w-5 text-amber-500" />}
            label="Aguardando pagamento"
            value={kpis.pendingNow}
            trend={{
              value: kpis.pendingTrend,
              label: "vs semana anterior",
              format: "pct",
            }}
            loading={loading}
            index={0}
          />

          <StatCard
            icon={<CheckCircle2 className="h-5 w-5 text-sky-500" />}
            label="Propostas"
            value={kpis.total}
            subtitle="Emitidas no total"
            loading={loading}
            index={1}
          />

          <StatCard
            icon={<CalendarDays className="h-5 w-5 text-violet-500" />}
            label="Agendamentos"
            value={kpis.appointments}
            subtitle="próximos 7 dias"
            loading={bookingsBusy}
            index={2}
          />

          <StatCard
            icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
            label="Volume (R$)"
            value={fmtBRL(kpis.volumeCur7Cents)}
            trend={{
              label: "vs semana anterior",
              value: kpis.volumeTrendPct,
              format: "pct",
            }}
            loading={loading}
            index={3}
          />

          <StatCard
            icon={<TrendingUp className="h-5 w-5 text-indigo-500" />}
            label="Conversão"
            value={`${kpis.conversionCur}%`}
            subtitle={`${kpis.paidCur30Count} pagas`}
            loading={loading}
            index={4}
          />

          <StatCard
            icon={<WalletIcon className="h-5 w-5 text-emerald-600" />}
            label="Conta Pix"
            value={kpis.pixConfigured ? "Configurada" : "Pendente"}
            subtitle={
              kpis.pixConfigured
                ? `Chave: ${effectivePayoutPixKeyMasked || ""}`
                : "Configure para receber pagamentos"
            }
            highlight
            loading={loadingMe}
            index={5}
          />

          <StatCard
            icon={<FileText className="h-5 w-5 text-orange-500" />}
            label="Aguardando confirmação"
            value={kpis.waitingConfirmation}
            subtitle="comprovantes enviados"
            loading={loading}
            index={6}
          />
        </section>

        <AnalyticsSection offers={offers} />

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 space-y-6 lg:col-span-8">
            <Card className="overflow-hidden border-none shadow-sm ring-1 ring-zinc-200">
              <CardHeader
                title="Links Recentes"
                subtitle="Acompanhe o status e envie links rapidamente."
                right={
                  <Badge tone="neutral" className="opacity-70">
                    {offers.length} total
                  </Badge>
                }
              />
              <CardBody className="p-0">
                {loading ? (
                  <div className="space-y-4 p-6">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-xl" />
                    ))}
                  </div>
                ) : offers.length === 0 ? (
                  <div className="py-12">
                    <EmptyState
                      title="Tudo limpo por aqui"
                      description="Comece criando sua primeira proposta comercial."
                      ctaLabel="Criar Proposta"
                      onCta={handleCreateOffer}
                    />
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {kpis.last5.map((o) => {
                      const pay = getPaymentLabel(o);
                      const publicUrl = `/p/${o.publicToken}`;
                      const copied = copiedId === o._id;

                      return (
                        <div key={o._id} className="p-5 hover:bg-zinc-50">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="truncate text-sm font-semibold text-zinc-900">
                                  {o.title || "Proposta"}
                                </div>
                                <Badge
                                  tone={pay.tone}
                                  size="xs"
                                  className="shrink-0"
                                >
                                  {pay.text}
                                </Badge>
                                {o?.notifyWhatsAppOnPaid ? (
                                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                                    WA ON
                                  </span>
                                ) : null}
                              </div>

                              <div className="mt-1 text-xs text-zinc-500">
                                {fmtBRLFromCents(getAmountCents(o))} •{" "}
                                {o.customerName || "Cliente"}{" "}
                                {o.customerWhatsApp
                                  ? `• ${o.customerWhatsApp}`
                                  : ""}
                              </div>

                              <div className="mt-2 flex items-center gap-2">
                                <code className="rounded-lg border bg-white px-2 py-1 text-[11px] text-zinc-700">
                                  {publicUrl}
                                </code>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
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
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="col-span-12 space-y-6 lg:col-span-4">
            <Card className="border-none shadow-sm ring-1 ring-zinc-200">
              <CardHeader
                title="Agenda (7 dias)"
                subtitle={bookingsErr || "Reservas e confirmações"}
                right={
                  <Link
                    to="/calendar"
                    className="text-[11px] font-bold text-indigo-600 hover:underline"
                  >
                    VER TUDO
                  </Link>
                }
              />
              <CardBody className="space-y-4">
                {bookingsBusy ? (
                  <Skeleton className="h-32 w-full rounded-xl" />
                ) : bookings.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-xs font-medium text-zinc-400">
                      Sem compromissos em breve
                    </p>
                  </div>
                ) : (
                  bookings.slice(0, 3).map((b) => (
                    <div
                      key={b._id}
                      className="relative border-l-2 border-zinc-100 py-1 pl-4 transition-colors hover:border-indigo-400"
                    >
                      <div className="text-[11px] font-bold uppercase tracking-tighter text-indigo-600">
                        {fmtTimeBR(b.startAt)} — {fmtTimeBR(b.endAt)}
                      </div>
                      <div className="truncate text-sm font-semibold text-zinc-900">
                        {b.customerName || "Cliente"}
                      </div>
                      <div className="line-clamp-1 text-[11px] text-zinc-500">
                        {b?.offer?.title}
                      </div>
                      {normStatus(b.status) === "HOLD" && (
                        <div className="mt-1 text-[10px] font-bold italic text-amber-600">
                          {holdRemainingLabel(b.holdExpiresAt)}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardBody>
            </Card>

            <Card className="border-none shadow-sm ring-1 ring-zinc-200">
              <CardHeader
                title="Aguardando confirmação"
                subtitle="Comprovantes enviados pelo cliente"
                right={
                  <Link
                    to="/offers"
                    className="text-[11px] font-bold text-emerald-600 hover:underline"
                  >
                    VER PROPOSTAS
                  </Link>
                }
              />
              <CardBody className="p-0">
                {loading ? (
                  <div className="p-5">
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : waitingOffers.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-xs text-zinc-400">
                      Nenhum pagamento aguardando confirmação
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-50">
                    {waitingOffers.map((o) => (
                      <div
                        key={o._id}
                        className="group flex items-center justify-between p-4"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-zinc-900">
                            {o.customerName || "Cliente"}
                          </div>
                          <div className="line-clamp-1 text-[11px] text-zinc-500">
                            {o.title || "Proposta"} •{" "}
                            {fmtBRLFromCents(getAmountCents(o))}
                          </div>
                          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                            {fmtDateTimeBR(o.updatedAt || o.createdAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge tone="PENDING" size="xs">
                            AGUARDANDO
                          </Badge>
                          <button
                            onClick={() => nav("/offers")}
                            className="p-1.5 text-zinc-400 transition-colors hover:text-zinc-900"
                            title="Abrir propostas"
                          >
                            <Icons.External />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            <div className="flex items-center justify-between rounded-2xl bg-zinc-900 p-5 text-white shadow-xl">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  Caixa de Hoje
                </p>
                <div className="text-xl font-bold">
                  {loading ? "..." : fmtBRL(kpis.paidTodayCents)}
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
                <Icons.Wallet />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Toast
        message="Link copiado para a área de transferência!"
        visible={showToast}
      />

      <PixSettingsModal
        open={pixModalState.open}
        onClose={closePixModal}
        onSaved={handlePixSaved}
        contextTitle={pixModalState.title}
        contextDescription={pixModalState.description}
      />

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
    </Shell>
  );
}
