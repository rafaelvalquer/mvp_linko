// src/pages/Dashboard.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FileText,
  CheckCircle2,
  CalendarDays,
  DollarSign,
  TrendingUp,
  CreditCard,
  Wallet as WalletIcon,
  Clock,
} from "lucide-react";

import Shell from "../components/layout/Shell.jsx";
import { api } from "../app/api.js";
import { listBookings } from "../app/bookingsApi.js";
import { listWithdraws, getPayoutSettings } from "../app/withdrawApi.js";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import Badge from "../components/appui/Badge.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import { useAuth } from "../app/AuthContext.jsx";
import WithdrawModal from "../components/WithdrawModal.jsx";
import QuotaBadge from "../components/QuotaBadge.jsx";
import { quotaPercent } from "../utils/planQuota.js";
import AnalyticsSection from "../components/dashboard/AnalyticsSection.jsx";

/** ========= ICON COMPONENTS (SVG INLINE) ========= */
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
  Withdraw: () => (
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
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
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
  Copy: () => (
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
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
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
  TrendUp: () => (
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
      className="text-emerald-500"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  Users: () => (
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
      className="text-blue-500"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Calendar: () => (
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
      className="text-amber-500"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
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
  Chevron: ({ open }) => (
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
      className={[
        "transition-transform duration-200",
        open ? "rotate-180" : "rotate-0",
      ].join(" ")}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
};

/** ========= HELPERS ========= */
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
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents) || 0) / 100);

const fmtDateTimeBR = (iso) =>
  iso ? new Date(iso).toLocaleString("pt-BR") : "";

const fmtTimeBR = (iso) =>
  iso
    ? new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(
        new Date(iso),
      )
    : "";

const safeDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const inRange = (dt, startInclusive, endExclusive) =>
  dt && dt >= startInclusive && dt < endExclusive;

const offerPaidDate = (o) =>
  safeDate(
    o?.paidAt ||
      o?.payment?.lastPixUpdatedAt ||
      o?.updatedAt ||
      o?.updated_at ||
      o?.createdAt ||
      o?.created_at,
  );

const offerCreatedDate = (o) =>
  safeDate(o?.createdAt || o?.created_at || o?.updatedAt || o?.updated_at);

const offerPaidAmountCents = (o) =>
  Number(o?.paidAmountCents ?? o?.totalCents ?? o?.amountCents ?? 0) || 0;

function holdRemainingLabel(holdExpiresAt) {
  const d = safeDate(holdExpiresAt);
  if (!d) return null;
  const ms = d.getTime() - Date.now();
  const min = Math.floor(ms / 60000);
  return min <= 0 ? "HOLD expirado" : `Expira em ${min} min`;
}

/** ========= SUB-COMPONENTS ========= */
function StatCard({
  icon,
  label,
  value,
  subtitle,
  trend,
  highlight = false,
  index = 0,
  loading,
}) {
  const hasTrend =
    Boolean(trend?.label) &&
    trend?.value !== undefined &&
    trend?.value !== null;
  const t = Number(trend?.value);
  const isPct = trend?.format === "pct";
  const tText = Number.isFinite(t)
    ? `${t > 0 ? "+" : ""}${t}${isPct ? "%" : ""}`
    : "";

  const trendClass =
    t > 0
      ? "text-emerald-700 dark:text-emerald-300"
      : t < 0
        ? "text-red-700 dark:text-red-300"
        : "text-zinc-500 dark:text-zinc-400";

  return (
    <Card
      className={[
        "overflow-hidden border-none shadow-sm ring-1",
        highlight
          ? "ring-emerald-200 bg-emerald-50/40 dark:ring-emerald-500/25 dark:bg-emerald-500/10"
          : "ring-zinc-200 bg-white dark:ring-zinc-800/70 dark:bg-zinc-950/40",
      ].join(" ")}
    >
      <CardBody className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              {label}
            </div>
            {subtitle ? (
              <div className="mt-1 text-[11px] text-zinc-400 font-medium truncate">
                {subtitle}
              </div>
            ) : null}
          </div>

          {icon ? (
            <div
              className={[
                "shrink-0 rounded-xl border p-2",
                "border-zinc-200/70 bg-zinc-50",
                "dark:border-zinc-800/70 dark:bg-zinc-900/30",
              ].join(" ")}
              aria-hidden="true"
            >
              {icon}
            </div>
          ) : null}
        </div>

        <div className="mt-3">
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <div className="text-2xl font-bold text-zinc-900 tracking-tight dark:text-zinc-100">
              {value}
            </div>
          )}
        </div>

        {hasTrend ? (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span
              className={["font-semibold tabular-nums", trendClass].join(" ")}
            >
              {tText}
            </span>
            <span className="text-zinc-400 dark:text-zinc-500">
              {trend.label}
            </span>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function Toast({ message, visible }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-zinc-900 text-white text-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
        <Icons.Copy /> {message}
      </div>
    </div>
  );
}

function QuotaAccordion({ workspace, quota, loading }) {
  const [open, setOpen] = useState(false);

  const planLabel = useMemo(() => {
    const p = String(workspace?.plan || "").toLowerCase();
    if (!p) return "—";
    return p.charAt(0).toUpperCase() + p.slice(1);
  }, [workspace]);

  const summaryLine = useMemo(() => {
    return `${quota.remaining}/${quota.limit} Pix`;
  }, [quota]);

  return (
    <Card className="border-none shadow-sm ring-1 ring-zinc-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-900">
              Cota Pix do mês
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
              <span>Ciclo: {quota.cycleKey || "—"}</span>
              <span className="text-zinc-300">•</span>
              <span>Plano: {planLabel}</span>
              <span className="text-zinc-300">•</span>
              <span className="font-semibold text-zinc-900">{summaryLine}</span>
              {quota.cycleKey ? (
                <>
                  <span className="text-zinc-300">•</span>
                  <span>• {quota.cycleKey}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <QuotaBadge
              plan={workspace?.plan}
              remaining={workspace?.pixRemaining}
              limit={workspace?.pixMonthlyLimit}
              used={workspace?.pixUsedThisCycle}
              cycleKey={workspace?.cycleKey}
              loading={loading}
              compact
            />
            <span className="text-zinc-400">
              <Icons.Chevron open={open} />
            </span>
          </div>
        </div>
      </button>

      {open ? (
        <CardBody className="px-5 pb-5 pt-0">
          {loading ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border bg-zinc-50 p-4">
                <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Restantes
                </div>
                <div className="mt-1 text-2xl font-bold text-zinc-900">
                  {quota.remaining}
                </div>
              </div>

              <div className="rounded-2xl border bg-zinc-50 p-4">
                <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Usados
                </div>
                <div className="mt-1 text-2xl font-bold text-zinc-900">
                  {quota.used}
                </div>
              </div>

              <div className="rounded-2xl border bg-zinc-50 p-4">
                <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Limite
                </div>
                <div className="mt-1 text-2xl font-bold text-zinc-900">
                  {quota.limit}
                </div>
              </div>

              <div className="sm:col-span-3">
                <div className="flex items-center justify-between text-xs text-zinc-600">
                  <span>Uso do ciclo</span>
                  <span className="font-semibold text-zinc-900">
                    {quota.pct}%
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-zinc-100">
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: `${quota.pct}%` }}
                  />
                </div>

                {quota.remaining === 0 ? (
                  <div className="mt-2 text-xs text-amber-700">
                    Sua cota do ciclo acabou. Faça upgrade do plano para liberar
                    mais Pix.
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </CardBody>
      ) : null}
    </Card>
  );
}

/** ========= MAIN DASHBOARD ========= */
export default function Dashboard() {
  const [offers, setOffers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [withdraws, setWithdraws] = useState([]);

  const [walletAvailableCents, setWalletAvailableCents] = useState(null);
  const [walletBusy, setWalletBusy] = useState(true);

  const [loading, setLoading] = useState(true);
  const [bookingsBusy, setBookingsBusy] = useState(true);
  const [withdrawsBusy, setWithdrawsBusy] = useState(true);
  const [error, setError] = useState("");
  const [bookingsErr, setBookingsErr] = useState("");
  const [withdrawsErr, setWithdrawsErr] = useState("");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("");
  const { signOut, workspace, loadingMe } = useAuth();

  const nav = useNavigate();
  const toastTimerRef = useRef(null);

  const handleCopy = async (url) => {
    try {
      await navigator.clipboard.writeText(window.location.origin + url);
      setShowToast(true);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setShowToast(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

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

  async function loadWithdraws() {
    try {
      setWithdrawsBusy(true);
      const d = await listWithdraws({ limit: 50 });
      setWithdraws(d.items || []);
    } catch (e) {
      if (e?.status === 401) return signOut();
      setWithdrawsErr("Erro nos saques.");
    } finally {
      setWithdrawsBusy(false);
    }
  }

  async function loadWallet() {
    try {
      setWalletBusy(true);
      const d = await getPayoutSettings();
      setWalletAvailableCents(Number(d?.walletAvailableCents || 0));
    } catch (e) {
      // fallback será workspace.walletAvailableCents
    } finally {
      setWalletBusy(false);
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
      loadWithdraws();
      loadWallet();
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

    // Pendente = não pago e não cancelado/expirado
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

    const paidCur7Count = paidCur7.length;
    const paidPrev7Count = paidPrev7.length;

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

    // Conversão (últimos 30d): pagas / criadas
    const createdCur30 = createdIn(cur30Start, tomorrow0).length;
    const paidCur30Count = paidIn(cur30Start, tomorrow0).length;
    const conversionCur =
      createdCur30 > 0 ? Math.round((paidCur30Count / createdCur30) * 100) : 0;

    // Agendamentos: próximos 7 dias (HOLD/CONFIRMED)
    const appointments = bookings.filter((b) =>
      ["HOLD", "CONFIRMED"].includes(normStatus(b.status)),
    ).length;

    // Pix quota do plano
    const pixLimit = Number(workspace?.pixMonthlyLimit ?? 0) || 0;
    const pixUsed = Number(workspace?.pixUsedThisCycle ?? 0) || 0;

    // ✅ Saldo disponível: prioriza getPayoutSettings (igual WithdrawModal)
    const balanceCents = Number.isFinite(Number(walletAvailableCents))
      ? Number(walletAvailableCents)
      : Number(workspace?.walletAvailableCents ?? 0) || 0;

    // Saques processando
    const withdrawalsProcessing = withdraws.filter((w) => {
      const s = normStatus(w?.status);
      return ![
        "COMPLETE",
        "COMPLETED",
        "FAILED",
        "CANCELLED",
        "REJECTED",
        "ERROR",
      ].includes(s);
    }).length;

    return {
      total,
      last5,

      pendingNow,
      pendingTrend,

      volumeCur7Cents,
      volumePrev7Cents,

      paidTodayCents,

      conversionCur,
      paidCur30Count,

      appointments,
      pixUsed,
      pixLimit,

      balanceCents,
      withdrawalsProcessing,
    };
  }, [offers, bookings, withdraws, workspace, walletAvailableCents]);

  const quota = useMemo(() => {
    const limit = Number(workspace?.pixMonthlyLimit);
    const used = Number(workspace?.pixUsedThisCycle);
    const remaining = Number(workspace?.pixRemaining);

    return {
      cycleKey: workspace?.cycleKey || "",
      limit: Number.isFinite(limit) ? limit : 0,
      used: Number.isFinite(used) ? used : 0,
      remaining: Number.isFinite(remaining) ? remaining : 0,
      pct: quotaPercent(used, limit),
    };
  }, [workspace]);

  return (
    <Shell>
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* --- INÍCIO DO NOVO HEADER PREMIUM --- */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-blue-500/10 rounded-3xl blur-2xl" />

          <div className="relative rounded-3xl border border-gray-200 bg-white/80 backdrop-blur-xl p-6 sm:p-8 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              {/* LEFT */}
              <div className="space-y-3 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                    Dashboard
                  </h1>

                  {lastUpdate && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
                      <span className="relative flex h-2 w-2">
                        <span
                          className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${
                            loading ? "hidden" : ""
                          }`}
                        />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>

                      <span className="text-xs font-bold text-emerald-700">
                        {loading
                          ? "Sincronizando..."
                          : `Atualizado: ${lastUpdate}`}
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-gray-600 text-sm">
                  Visão geral de sua plataforma em tempo real
                </p>
              </div>

              {/* RIGHT (actions) */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                  <Button
                    variant="outline"
                    onClick={load}
                    disabled={loading}
                    className="gap-2 h-11 px-4 active:scale-95 transition-all"
                  >
                    <span className={`${loading ? "animate-spin" : ""}`}>
                      <Icons.Refresh />
                    </span>
                    <span className="font-semibold">
                      {loading ? "Atualizando..." : "Atualizar"}
                    </span>
                  </Button>

                  <Button
                    onClick={() => setWithdrawOpen(true)}
                    className="gap-2 h-11 px-4 active:scale-95 transition-all bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                  >
                    <Icons.Withdraw />
                    <span className="font-semibold">Sacar</span>
                  </Button>

                  <Link to="/offers/new" className="w-full sm:w-auto">
                    <Button
                      size="sm"
                      className="
                w-full sm:w-auto
                justify-center items-center gap-2
                h-11 px-6
                font-bold
                rounded-xl
                text-white
                bg-gradient-to-r from-emerald-600 to-teal-600
                hover:from-emerald-700 hover:to-teal-700
                shadow-lg shadow-emerald-200/60
                ring-1 ring-emerald-500/20
                active:scale-95 transition-all
                focus:outline-none focus:ring-2 focus:ring-emerald-300
                relative overflow-hidden
              "
                    >
                      {/* shine */}
                      <span className="pointer-events-none absolute inset-0 opacity-0 hover:opacity-100 transition-opacity">
                        <span className="absolute -left-10 top-0 h-full w-24 rotate-12 bg-white/20 blur-md" />
                      </span>
                      <Icons.Plus />
                      Nova proposta
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- FIM DO NOVO HEADER PREMIUM --- */}

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={load} className="font-bold underline">
              Tentar de novo
            </button>
          </div>
        )}

        {/* ✅ COTA PIX DO MÊS */}
        <QuotaAccordion
          workspace={workspace}
          quota={quota}
          loading={loadingMe}
        />

        {/* ✅ KPI Cards (no padrão do exemplo) */}
        <section
          className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 mb-6"
          aria-label="Indicadores"
        >
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
            icon={<CreditCard className="h-5 w-5 text-cyan-500" />}
            label="Pix usados"
            value={`${kpis.pixUsed}/${kpis.pixLimit}`}
            subtitle="limite mensal do plano"
            loading={loadingMe}
            index={5}
          />

          <StatCard
            icon={<WalletIcon className="h-5 w-5 text-emerald-600" />}
            label="Saldo disponível"
            value={
              walletBusy && !Number.isFinite(Number(walletAvailableCents))
                ? "…"
                : fmtBRL(kpis.balanceCents)
            }
            highlight
            loading={loadingMe}
            index={6}
          />

          <StatCard
            icon={<Clock className="h-5 w-5 text-orange-500" />}
            label="Saques processando"
            value={kpis.withdrawalsProcessing}
            subtitle="previsão: 1–2 dias úteis"
            loading={withdrawsBusy}
            index={7}
          />
        </section>

        {/* ✅ ANALYTICS */}
        <AnalyticsSection offers={offers} />

        <div className="grid grid-cols-12 gap-6">
          {/* MAIN COLUMN: RECENT LINKS */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <Card className="border-none shadow-sm ring-1 ring-zinc-200 overflow-hidden">
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
                  <div className="p-6 space-y-4">
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
                      onCta={() => nav("/offers/new")}
                    />
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {kpis.last5.map((o) => {
                      const publicUrl = `/p/${o.publicToken}`;
                      const isPaid = isPaidOffer(o);

                      return (
                        <div key={o._id} className="p-5 hover:bg-zinc-50">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-semibold text-zinc-900 truncate">
                                  {o.title || "Proposta"}
                                </div>
                                <Badge
                                  tone={normStatus(o.status)}
                                  size="xs"
                                  className="shrink-0"
                                />
                              </div>
                              <div className="mt-1 text-xs text-zinc-500">
                                {fmtBRL(o.amountCents)} •{" "}
                                {o.customerName || "Cliente"}
                              </div>

                              <div className="mt-2 flex items-center gap-2">
                                <code className="rounded-lg border bg-white px-2 py-1 text-[11px] text-zinc-700">
                                  {publicUrl}
                                </code>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(publicUrl)}
                                  className="rounded-lg border bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                                >
                                  Copiar
                                </button>
                              </div>

                              {isPaid ? (
                                <div className="mt-2 text-[11px] font-semibold text-emerald-700">
                                  Pago/Confirmado
                                </div>
                              ) : null}
                            </div>

                            <div className="text-right shrink-0">
                              <Link
                                to={publicUrl}
                                target="_blank"
                                className="text-[11px] font-bold text-emerald-600 hover:underline"
                              >
                                ABRIR
                              </Link>
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

          {/* RIGHT COLUMN */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* AGENDA */}
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
                  <div className="text-center py-4">
                    <p className="text-xs text-zinc-400 font-medium">
                      Sem compromissos em breve
                    </p>
                  </div>
                ) : (
                  bookings.slice(0, 3).map((b) => (
                    <div
                      key={b._id}
                      className="relative pl-4 border-l-2 border-zinc-100 hover:border-indigo-400 transition-colors py-1"
                    >
                      <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-tighter">
                        {fmtTimeBR(b.startAt)} — {fmtTimeBR(b.endAt)}
                      </div>
                      <div className="text-sm font-semibold text-zinc-900 truncate">
                        {b.customerName || "Cliente"}
                      </div>
                      <div className="text-[11px] text-zinc-500 line-clamp-1">
                        {b?.offer?.title}
                      </div>
                      {normStatus(b.status) === "HOLD" && (
                        <div className="mt-1 text-[10px] font-bold text-amber-600 italic">
                          {holdRemainingLabel(b.holdExpiresAt)}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardBody>
            </Card>

            {/* WITHDRAWS */}
            <Card className="border-none shadow-sm ring-1 ring-zinc-200">
              <CardHeader
                title="Últimos Saques"
                subtitle={withdrawsErr || ""}
              />
              <CardBody className="p-0">
                {withdrawsBusy ? (
                  <div className="p-5">
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : withdraws.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-xs text-zinc-400">
                      Nenhum saque realizado
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-50">
                    {withdraws.slice(0, 5).map((w) => (
                      <div
                        key={w.externalId}
                        className="p-4 flex justify-between items-center group"
                      >
                        <div>
                          <div className="text-sm font-bold text-zinc-900">
                            {fmtBRL(w.netAmountCents)}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
                            {fmtDateTimeBR(w.createdAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge tone={w.status} size="xs" />
                          {w.receiptUrl &&
                            normStatus(w.status) === "COMPLETE" && (
                              <button
                                onClick={() =>
                                  window.open(w.receiptUrl, "_blank")
                                }
                                className="p-1.5 text-zinc-400 hover:text-zinc-900 transition-colors"
                              >
                                <Icons.External />
                              </button>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* CAIXA EXPRESSO */}
            <div className="p-5 rounded-2xl bg-zinc-900 text-white shadow-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                  Caixa de Hoje
                </p>
                <div className="text-xl font-bold">
                  {loading ? "..." : fmtBRL(kpis.paidTodayCents)}
                </div>
              </div>
              <div className="h-10 w-10 bg-zinc-800 rounded-xl flex items-center justify-center">
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

      <WithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onCreated={() => loadWithdraws()}
      />
    </Shell>
  );
}
