// src/pages/Dashboard.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BellRing,
  FileText,
  CheckCircle2,
  CalendarDays,
  DollarSign,
  TrendingUp,
  Repeat2,
  Wallet as WalletIcon,
} from "lucide-react";

import Shell from "../components/layout/Shell.jsx";
import { api } from "../app/api.js";
import * as authApi from "../app/authApi.js";
import { listBookings } from "../app/bookingsApi.js";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import Badge from "../components/appui/Badge.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import { useAuth } from "../app/AuthContext.jsx";
import useThemeToggle from "../app/useThemeToggle.js";
import { useMyWhatsAppModal } from "../components/layout/MyWhatsAppModalContext.jsx";
import AnalyticsSection from "../components/dashboard/AnalyticsSection.jsx";
import PixSettingsModal from "../components/PixSettingsModal.jsx";
import WhatsNewModalHost from "../components/whats-new/WhatsNewModalHost.jsx";

import OfferDetailsModal from "../components/offers/OfferDetailsModal.jsx";
import {
  fmtBRLFromCents,
  getAmountCents,
  getPaymentLabel,
  getOfferFeedbackRating,
  hasFeedbackResponse,
  isOfferCriticalFeedback,
  isOfferLowRating,
  hasOfferContactRequested,
  buildFeedbackUrl,
  getOfferCxStatusSummary,
  getOfferCxAlertBadges,
} from "../components/offers/offerHelpers.js";
import {
  getEffectivePixKeyMasked,
  guardOfferCreation,
  hasPixAccountConfigured,
} from "../utils/guardOfferCreation.js";
import { canUseRecurringPlan } from "../utils/planFeatures.js";
import { hasWorkspaceModuleAccess } from "../utils/workspacePermissions.js";

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

function normalizeWhatsNewItems(items) {
  return Array.isArray(items) ? items.filter(Boolean) : [];
}

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

function offerDueDate(o) {
  if (o?.validityEnabled !== true) return null;
  const validityDays = Number(o?.validityDays);
  if (!Number.isFinite(validityDays) || validityDays <= 0) return null;

  const createdAt = offerCreatedDate(o);
  if (!createdAt) return null;

  const dueAt = startOfDay(createdAt);
  dueAt.setDate(dueAt.getDate() + validityDays);
  return dueAt;
}

function offerPaidAmountCents(o) {
  return (
    Number(o?.paidAmountCents ?? o?.totalCents ?? o?.amountCents ?? 0) || 0
  );
}

function Toast({ message, visible }) {
  const { isDark } = useThemeToggle();

  return (
    <div
      className={[
        "fixed bottom-4 left-1/2 z-[9999] -translate-x-1/2 transition-all",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0",
      ].join(" ")}
    >
      <div
        className={[
          "rounded-2xl border px-4 py-3 text-sm backdrop-blur-xl",
          isDark
            ? "border-white/10 bg-[rgba(8,15,30,0.92)] text-slate-100 shadow-[0_24px_50px_-24px_rgba(15,23,42,0.9)]"
            : "border-slate-200/80 bg-white/92 text-slate-800 shadow-[0_24px_50px_-24px_rgba(15,23,42,0.22)]",
        ].join(" ")}
      >
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
  const { isDark } = useThemeToggle();

  return (
    <div
      className={[
        "app-kpi-card relative overflow-hidden p-5",
        highlight
          ? isDark
            ? "border-cyan-400/24 bg-[linear-gradient(135deg,rgba(8,47,73,0.34),rgba(6,78,59,0.22))] shadow-[0_24px_52px_-40px_rgba(2,6,23,0.72)]"
            : "border-sky-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.98),rgba(240,253,250,0.94))] shadow-[0_20px_42px_-34px_rgba(15,23,42,0.18)]"
          : isDark
            ? "border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(9,15,28,0.76))]"
            : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,252,0.94))]",
      ].join(" ")}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div
        className={[
          "pointer-events-none absolute inset-x-0 top-0 h-16",
          isDark
            ? "bg-[linear-gradient(180deg,rgba(34,211,238,0.08),transparent)]"
            : "bg-[linear-gradient(180deg,rgba(37,99,235,0.08),transparent)]",
        ].join(" ")}
      />
      <div className="flex items-start justify-between">
        <div
          className={[
            "flex h-12 w-12 items-center justify-center rounded-2xl border",
            isDark
              ? "border-white/10 bg-white/10 text-slate-100"
              : "border-slate-200/80 bg-white text-slate-700 shadow-[0_14px_28px_-18px_rgba(15,23,42,0.35)]",
          ].join(" ")}
        >
          {icon}
        </div>
      </div>

      <div className="mt-4">
        <div
          className={[
            "text-[11px] font-bold uppercase tracking-[0.2em]",
            isDark ? "text-slate-400" : "text-slate-500",
          ].join(" ")}
        >
          {label}
        </div>

        <div
          className={[
            "mt-2 text-3xl font-black tracking-[-0.04em] tabular-nums",
            isDark ? "text-white" : "text-slate-950",
          ].join(" ")}
        >
          {loading ? "..." : value}
        </div>

        {subtitle ? (
          <div
            className={[
              "mt-2 text-xs leading-5",
              isDark ? "text-slate-400" : "text-slate-500",
            ].join(" ")}
          >
            {subtitle}
          </div>
        ) : null}

        {trend ? (
          <div
            className={[
              "mt-3 text-xs",
              isDark ? "text-slate-300" : "text-slate-600",
            ].join(" ")}
          >
            <span
              className={[
                "font-semibold",
                isDark ? "text-white" : "text-slate-900",
              ].join(" ")}
            >
              {trend.format === "pct" ? `${trend.value}%` : trend.value}
            </span>{" "}
            <span className={isDark ? "text-slate-400" : "text-slate-500"}>
              {trend.label}
            </span>
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

function WhatsAppSetupBanner({ isDark }) {
  const { openMyWhatsAppModal } = useMyWhatsAppModal();

  return (
    <div
      className={[
        "app-strip p-4",
        isDark
          ? "border-cyan-400/20 bg-[linear-gradient(135deg,rgba(8,47,73,0.28),rgba(15,23,42,0.2))] text-cyan-50"
          : "border-cyan-200/80 bg-[linear-gradient(135deg,#ecfeff,#eff6ff)] text-slate-800",
      ].join(" ")}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
            Ative seus comandos por WhatsApp
          </div>
          <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-200">
            Adicione o WhatsApp da sua conta para liberar o envio de
            comandos por texto e audio para a Luminor.
          </div>
        </div>

        <button
          type="button"
          onClick={openMyWhatsAppModal}
          className={[
            "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition",
            isDark
              ? "bg-white text-slate-950 hover:bg-slate-100"
              : "bg-slate-950 text-white hover:bg-slate-800",
          ].join(" ")}
        >
          Configurar WhatsApp
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { isDark } = useThemeToggle();
  const [offers, setOffers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [workspaceUsers, setWorkspaceUsers] = useState([]);
  const [activeRecurringCount, setActiveRecurringCount] = useState(0);
  const [activeRecurringIds, setActiveRecurringIds] = useState([]);

  const [loading, setLoading] = useState(true);
  const [bookingsBusy, setBookingsBusy] = useState(true);
  const [teamUsersBusy, setTeamUsersBusy] = useState(false);
  const [error, setError] = useState("");
  const [bookingsErr, setBookingsErr] = useState("");
  const [scopeTab, setScopeTab] = useState("mine");
  const [teamOwnerFilter, setTeamOwnerFilter] = useState("all");

  const [localPayoutPixKeyMasked, setLocalPayoutPixKeyMasked] = useState("");
  const [pixModalState, setPixModalState] = useState({
    open: false,
    title: "",
    description: "",
    redirectTo: null,
  });

  const [showToast, setShowToast] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("");
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [whatsNewBusy, setWhatsNewBusy] = useState(false);
  const [whatsNewLoading, setWhatsNewLoading] = useState(false);
  const [whatsNewSnapshotAt, setWhatsNewSnapshotAt] = useState("");
  const [whatsNewItems, setWhatsNewItems] = useState([]);
  const [whatsNewError, setWhatsNewError] = useState("");

  const { signOut, user, workspace, loadingMe, refreshWorkspace, perms } = useAuth();
  const hasRecurringPlan = canUseRecurringPlan(workspace?.plan);
  const canAccessReports = hasWorkspaceModuleAccess(perms, "reports");
  const canManagePixAccount = perms?.canManagePixAccount === true;
  const isOwnerTeamDashboard =
    perms?.isWorkspaceOwner === true && perms?.isWorkspaceTeamPlan === true;
  const needsWhatsAppSetup =
    !loadingMe && !String(user?.whatsappPhone || "").trim();
  const userId = String(user?._id || "").trim();

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
  const appliedScope =
    isOwnerTeamDashboard && scopeTab === "workspace" ? "workspace" : "mine";
  const selectedOwnerUserId =
    appliedScope !== "workspace"
      ? ""
      : teamOwnerFilter === "me"
        ? userId
        : teamOwnerFilter !== "all"
          ? teamOwnerFilter
          : "";

  const selectedTeamMemberName = useMemo(() => {
    if (teamOwnerFilter === "all") return "Toda a equipe";
    if (teamOwnerFilter === "me") return "Somente eu";
    return (
      workspaceUsers.find((item) => String(item?._id || "") === teamOwnerFilter)
        ?.name || "Responsavel"
    );
  }, [teamOwnerFilter, workspaceUsers]);

  const scopeSummaryLabel =
    appliedScope === "workspace"
      ? `Equipe: ${selectedTeamMemberName}`
      : "Minha carteira";

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
      canManagePixAccount,
    });
  }, [workspace, effectivePayoutPixKeyMasked, nav, canManagePixAccount]);

  useEffect(() => {
    if (location?.state?.openPixSettings) {
      openPixModal();
      nav("/dashboard", { replace: true, state: null });
    }
  }, [location?.state, nav]);

  useEffect(() => {
    if (loadingMe) return;

    if (!userId) {
      setWhatsNewOpen(false);
      setWhatsNewItems([]);
      setWhatsNewSnapshotAt("");
      setWhatsNewError("");
      setWhatsNewLoading(false);
      return;
    }

    let alive = true;

    (async () => {
      try {
        setWhatsNewLoading(true);
        setWhatsNewError("");

        const data = await authApi.getWhatsNew();
        if (!alive) return;

        setWhatsNewItems(normalizeWhatsNewItems(data?.items));
        setWhatsNewSnapshotAt(String(data?.snapshotAt || ""));
        setWhatsNewOpen(false);
      } catch (err) {
        if (!alive) return;
        console.warn("[dashboard] failed to load what's new", err);
        setWhatsNewItems([]);
        setWhatsNewSnapshotAt("");
        setWhatsNewOpen(false);
        setWhatsNewError(String(err?.message || "").trim());
      } finally {
        if (alive) setWhatsNewLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [loadingMe, userId]);

  const acknowledgeWhatsNew = useCallback(
    async (afterAck) => {
      if (whatsNewBusy) return;

      try {
        setWhatsNewBusy(true);
        setWhatsNewError("");

        if (whatsNewSnapshotAt) {
          await authApi.ackWhatsNew({ seenAt: whatsNewSnapshotAt });
        }

        setWhatsNewOpen(false);
        setWhatsNewItems([]);
        setWhatsNewSnapshotAt("");

        if (typeof afterAck === "function") {
          afterAck();
        }
      } catch (err) {
        setWhatsNewError(
          err?.message || "Nao foi possivel confirmar a leitura agora.",
        );
      } finally {
        setWhatsNewBusy(false);
      }
    },
    [whatsNewBusy, whatsNewSnapshotAt],
  );

  const openWhatsNew = useCallback(() => {
    if (whatsNewLoading || !whatsNewItems.length) return;
    setWhatsNewError("");
    setWhatsNewOpen(true);
  }, [whatsNewItems.length, whatsNewLoading]);

  const handleWhatsNewGoToOffers = useCallback(() => {
    acknowledgeWhatsNew(() => {
      if (window.location.pathname === "/offers") return;
      nav("/offers");
    });
  }, [acknowledgeWhatsNew, nav]);

  const loadWorkspaceTeam = useCallback(async () => {
    if (!isOwnerTeamDashboard) {
      setWorkspaceUsers([]);
      return;
    }

    try {
      setTeamUsersBusy(true);
      const data = await authApi.listWorkspaceUsers();
      const rawItems = Array.isArray(data?.items) ? data.items : [];
      setWorkspaceUsers(rawItems.filter((item) => item?.status !== "disabled"));
    } catch {
      setWorkspaceUsers([]);
    } finally {
      setTeamUsersBusy(false);
    }
  }, [isOwnerTeamDashboard]);

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
        scope: appliedScope,
        ownerUserId: selectedOwnerUserId || undefined,
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
      const offersPath = `/offers?${new URLSearchParams({
        scope: appliedScope,
        ...(selectedOwnerUserId ? { ownerUserId: selectedOwnerUserId } : {}),
      }).toString()}`;
      const recurringPath = `/recurring-offers?${new URLSearchParams({
        status: "active",
        scope: appliedScope,
        ...(selectedOwnerUserId ? { ownerUserId: selectedOwnerUserId } : {}),
      }).toString()}`;
      const [offersResult, recurringResult] = await Promise.allSettled([
        api(offersPath),
        hasRecurringPlan
          ? api(recurringPath)
          : Promise.resolve({ items: [] }),
      ]);

      if (offersResult.status !== "fulfilled") {
        throw offersResult.reason;
      }

      const d = offersResult.value;
      setOffers(d.items || []);

      if (recurringResult.status === "fulfilled") {
        const activeItems = recurringResult.value?.items || [];
        setActiveRecurringCount(activeItems.length);
        setActiveRecurringIds(
          activeItems
            .map((item) => String(item?._id || item?.id || "").trim())
            .filter(Boolean),
        );
      } else {
        if (recurringResult.reason?.status === 401) return signOut();
        setActiveRecurringCount(0);
        setActiveRecurringIds([]);
      }

      setLastUpdate(
        new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(
          new Date(),
        ),
      );

      loadBookings();
    } catch (e) {
      if (e?.status === 401) return signOut();
      setActiveRecurringCount(0);
      setActiveRecurringIds([]);
      setError("Falha ao carregar dados principais.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loadingMe) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRecurringPlan, loadingMe, appliedScope, selectedOwnerUserId]);

  useEffect(() => {
    loadWorkspaceTeam();
  }, [loadWorkspaceTeam]);

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

    const activeRecurringIdSet = new Set(
      (activeRecurringIds || []).map((id) => String(id || "").trim()),
    );
    const recurringAtRiskCount = new Set(
      offers
        .filter((o) => {
          const recurringId = String(o?.recurringOfferId || "").trim();
          if (!recurringId || !activeRecurringIdSet.has(recurringId)) {
            return false;
          }
          if (isPaidOffer(o) || isCancelledOrExpiredOffer(o)) {
            return false;
          }
          if (normStatus(o?.paymentStatus) === "WAITING_CONFIRMATION") {
            return false;
          }

          const dueAt = offerDueDate(o);
          return !!dueAt && dueAt < today0;
        })
        .map((o) => String(o?.recurringOfferId || "").trim())
        .filter(Boolean),
    ).size;

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
      recurringAtRiskCount,
      pixConfigured,
    };
  }, [
    offers,
    bookings,
    workspace,
    effectivePayoutPixKeyMasked,
    activeRecurringIds,
  ]);

  const cxSnapshot = useMemo(() => {
    const now = new Date();
    const windowEnd = startOfDay(now);
    windowEnd.setDate(windowEnd.getDate() + 1);

    const windowStart = new Date(windowEnd);
    windowStart.setDate(windowStart.getDate() - 30);

    const respondedOffers = offers.filter((offer) => {
      const respondedAt = offer?.feedback?.respondedAt;
      return (
        getOfferFeedbackRating(offer) !== null &&
        respondedAt &&
        inRange(respondedAt, windowStart, windowEnd)
      );
    });

    const respondedCount = respondedOffers.length;
    const averageRating =
      respondedCount > 0
        ? respondedOffers.reduce(
            (acc, offer) => acc + (getOfferFeedbackRating(offer) || 0),
            0,
          ) / respondedCount
        : 0;

    const criticalItems = respondedOffers
      .filter((offer) => isOfferCriticalFeedback(offer))
      .sort((a, b) => {
        const contactDelta =
          Number(hasOfferContactRequested(b)) -
          Number(hasOfferContactRequested(a));
        if (contactDelta !== 0) return contactDelta;

        const ratingDelta =
          (getOfferFeedbackRating(a) || 99) - (getOfferFeedbackRating(b) || 99);
        if (ratingDelta !== 0) return ratingDelta;

        return (
          new Date(b?.feedback?.respondedAt || 0).getTime() -
          new Date(a?.feedback?.respondedAt || 0).getTime()
        );
      });

    return {
      averageRating,
      respondedCount,
      criticalCount: criticalItems.length,
      criticalItems: criticalItems.slice(0, 5),
    };
  }, [offers]);

  const waitingOffers = useMemo(() => {
    return offers
      .filter((o) => normStatus(o?.paymentStatus) === "WAITING_CONFIRMATION")
      .slice(0, 5);
  }, [offers]);

  const teamPerformanceRows = useMemo(() => {
    return (workspaceUsers || [])
      .map((item) => ({
        _id: item?._id,
        name: item?.name || "Usuario",
        paidRevenueCents: Number(item?.performance?.paidRevenueCents || 0),
        paidOffers: Number(item?.performance?.paidOffers || 0),
        offersCreated: Number(item?.performance?.offersCreated || 0),
        conversionPct: Number(item?.performance?.conversionPct || 0),
      }))
      .sort(
        (a, b) =>
          b.paidRevenueCents - a.paidRevenueCents ||
          b.paidOffers - a.paidOffers ||
          b.offersCreated - a.offersCreated,
      )
      .slice(0, 5);
  }, [workspaceUsers]);

  const shouldShowTeamRanking =
    isOwnerTeamDashboard && appliedScope === "workspace" && !selectedOwnerUserId;

  const whatsNewCount = whatsNewItems.length;
  const canOpenWhatsNew = whatsNewCount > 0 && !whatsNewLoading;
  const cxAverageLabel = useMemo(() => {
    if (!cxSnapshot.respondedCount) return "--";
    return cxSnapshot.averageRating.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }, [cxSnapshot]);

  const topbarAction = (
    <button
      type="button"
      onClick={openWhatsNew}
      disabled={!canOpenWhatsNew}
      title={
        whatsNewError
          ? "Nao foi possivel carregar novidades agora."
          : whatsNewLoading
            ? "Carregando novidades..."
            : whatsNewCount > 0
              ? `${whatsNewCount} novidade${whatsNewCount === 1 ? "" : "s"} pendente${whatsNewCount === 1 ? "" : "s"}`
              : "Nenhuma novidade pendente"
      }
      className={[
        "relative inline-flex h-10 items-center justify-center gap-2 rounded-2xl border px-3.5 text-xs font-semibold transition",
        "disabled:cursor-default disabled:opacity-60",
        isDark
          ? "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 disabled:hover:bg-white/5"
          : "border-slate-200/80 bg-white/85 text-slate-700 shadow-[0_14px_28px_-20px_rgba(15,23,42,0.18)] hover:bg-white disabled:hover:bg-white/85",
      ].join(" ")}
    >
      <BellRing className="h-4 w-4" />
      <span className="hidden sm:inline">Novidades</span>
      {whatsNewCount > 0 ? (
        <span
          className={[
            "inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none",
            isDark
              ? "bg-cyan-400/20 text-cyan-100"
              : "bg-sky-600 text-white",
          ].join(" ")}
        >
          {whatsNewCount > 99 ? "99+" : whatsNewCount}
        </span>
      ) : null}
    </button>
  );

  return (
    <Shell topbarAction={topbarAction}>
      <div className="mx-auto max-w-[1380px] space-y-5">
        <PageHeader
          eyebrow="Operacao"
          title="Dashboard"
          subtitle="Acompanhe pagamentos, agenda e andamento das propostas com uma leitura mais clara da operacao."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                onClick={load}
                disabled={loading}
              >
                <span className={`${loading ? "animate-spin" : ""}`}>
                  <Icons.Refresh />
                </span>
                {loading ? "Atualizando..." : "Atualizar"}
              </Button>

              <Button size="md" variant="secondary" onClick={() => openPixModal()}>
                <WalletIcon className="h-[18px] w-[18px]" />
                {canManagePixAccount ? "Conta Pix" : "Ver Conta Pix"}
              </Button>

              <Button size="lg" onClick={handleCreateOffer}>
                <Icons.Plus />
                Nova proposta
              </Button>
            </div>
          }
        />

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="surface-secondary px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="PUBLIC">
                {loading ? "Sincronizando..." : `Atualizado: ${lastUpdate || "--"}`}
              </Badge>
              <Badge tone={kpis.pixConfigured ? "PAID" : "ACCEPTED"}>
                {kpis.pixConfigured ? "Conta Pix pronta" : "Conta Pix pendente"}
              </Badge>
              <Badge tone={needsWhatsAppSetup ? "ACCEPTED" : "PAID"}>
                {needsWhatsAppSetup ? "WhatsApp precisa de configuracao" : "WhatsApp pronto"}
              </Badge>
            </div>
            <div
              className={`mt-3 text-sm leading-6 ${
                isDark ? "text-slate-300" : "text-slate-600"
              }`}
            >
              Priorize pagamentos pendentes, comprovantes em análise e os próximos
              compromissos do dia sem perder o contexto da operação.
            </div>
          </div>

          <div className="surface-secondary px-4 py-4 sm:px-5">
            <div
              className={`text-[11px] font-bold uppercase tracking-[0.18em] ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Leitura rapida
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <div className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-950"}`}>
                  {kpis.pendingNow}
                </div>
                <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                  propostas aguardando pagamento
                </div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-950"}`}>
                  {kpis.waitingConfirmation}
                </div>
                <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                  comprovantes em análise
                </div>
              </div>
            </div>
          </div>

          <div className="surface-secondary px-4 py-4 sm:px-5">
            <div
              className={`text-[11px] font-bold uppercase tracking-[0.18em] ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Proximo passo
            </div>
            <div className={`mt-2 text-sm font-semibold ${isDark ? "text-white" : "text-slate-950"}`}>
              {bookingsBusy
                ? "Lendo agenda..."
                : kpis.appointments > 0
                  ? `${kpis.appointments} agendamento(s) nos proximos 7 dias`
                  : "Sem agendamentos próximos"}
            </div>
            <div className={isDark ? "mt-1 text-xs text-slate-400" : "mt-1 text-xs text-slate-500"}>
              {hasRecurringPlan
                ? `${kpis.recurringAtRiskCount} recorrencia(s) em risco no momento.`
                : "Acompanhe proposta, Pix e agenda no mesmo fluxo."}
            </div>
          </div>
        </div>

        {isOwnerTeamDashboard ? (
          <Card>
            <CardBody className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={scopeTab === "mine" ? "primary" : "secondary"}
                  onClick={() => setScopeTab("mine")}
                >
                  Minha carteira
                </Button>
                <Button
                  size="sm"
                  variant={scopeTab === "workspace" ? "primary" : "secondary"}
                  onClick={() => setScopeTab("workspace")}
                >
                  Equipe
                </Button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {appliedScope === "workspace" ? (
                  <select
                    value={teamOwnerFilter}
                    onChange={(e) => setTeamOwnerFilter(e.target.value)}
                    disabled={teamUsersBusy}
                    className={[
                      "h-10 rounded-xl border px-3 text-sm outline-none transition",
                      isDark
                        ? "border-white/10 bg-white/5 text-slate-100 focus:border-cyan-400/40"
                        : "border-zinc-200 bg-white text-slate-800 focus:border-sky-300",
                    ].join(" ")}
                  >
                    <option value="all">Toda a equipe</option>
                    <option value="me">Somente eu</option>
                    {workspaceUsers
                      .filter((item) => String(item?._id || "") !== userId)
                      .map((item) => (
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

        {needsWhatsAppSetup ? (
          <WhatsAppSetupBanner isDark={isDark} />
        ) : null}

        {error && (
          <div
            className={[
              "flex items-center justify-between rounded-[24px] border p-4 text-sm",
              isDark
                ? "border-red-400/20 bg-[linear-gradient(135deg,rgba(127,29,29,0.28),rgba(69,10,10,0.18))] text-red-100"
                : "border-red-200/80 bg-[linear-gradient(135deg,#fff1f2,#fff7f7)] text-red-700 shadow-[0_18px_36px_-28px_rgba(239,68,68,0.35)]",
            ].join(" ")}
          >
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

          {hasRecurringPlan ? (
            <StatCard
              icon={<Repeat2 className="h-5 w-5 text-cyan-500" />}
              label="Recorrencias ativas"
              value={activeRecurringCount}
              subtitle={
                kpis.recurringAtRiskCount > 0
                  ? `${kpis.recurringAtRiskCount} com parcelas em atraso`
                  : "Sem parcelas em atraso"
              }
              loading={loading}
              index={5}
            />
          ) : null}

          <StatCard
            icon={<WalletIcon className="h-5 w-5 text-emerald-600" />}
            label="Conta Pix"
            value={kpis.pixConfigured ? "Configurada" : "Pendente"}
            subtitle={
              kpis.pixConfigured
                ? `Chave: ${effectivePayoutPixKeyMasked || ""}`
                : canManagePixAccount
                  ? "Configure para receber pagamentos"
                  : "Peca ao dono do workspace para configurar a Conta Pix"
            }
            highlight
            loading={loadingMe}
            index={hasRecurringPlan ? 6 : 5}
          />

          <StatCard
            icon={<FileText className="h-5 w-5 text-orange-500" />}
            label="Aguardando confirmação"
            value={kpis.waitingConfirmation}
            subtitle="comprovantes enviados"
            loading={loading}
            index={hasRecurringPlan ? 7 : 6}
          />
        </section>

        <Card className="overflow-hidden">
          <CardBody className="space-y-5 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div
                  className={[
                    "text-[11px] font-bold uppercase tracking-[0.18em]",
                    isDark ? "text-slate-400" : "text-slate-500",
                  ].join(" ")}
                >
                  CX recente
                </div>
                <div
                  className={[
                    "mt-1 text-lg font-semibold",
                    isDark ? "text-white" : "text-slate-950",
                  ].join(" ")}
                >
                  Feedback dos ultimos 30 dias
                </div>
                <p
                  className={[
                    "mt-1 text-sm",
                    isDark ? "text-slate-400" : "text-slate-500",
                  ].join(" ")}
                >
                  Visibilidade rapida para acompanhar a experiencia do cliente
                  sem sair da rotina.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link to="/offers?cxFilter=LOW_RATING">
                  <Button variant="secondary">Abrir nota baixa</Button>
                </Link>
                {canAccessReports ? (
                  <Link to="/reports/feedback">
                    <Button>Ver satisfacao</Button>
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                {
                  label: "Nota media",
                  value: cxAverageLabel,
                  subtitle: "avaliacoes respondidas",
                  tone: "text-emerald-600 dark:text-emerald-300",
                },
                {
                  label: "Avaliacoes respondidas",
                  value: String(cxSnapshot.respondedCount),
                  subtitle: "retorno recebido no periodo",
                  tone: "text-sky-600 dark:text-sky-300",
                },
                {
                  label: "Casos criticos",
                  value: String(cxSnapshot.criticalCount),
                  subtitle: "nota baixa ou pedido de contato",
                  tone: "text-amber-600 dark:text-amber-300",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="app-kpi-card px-4 py-4"
                >
                  <div
                    className={[
                      "text-[11px] font-bold uppercase tracking-[0.16em]",
                      isDark ? "text-slate-400" : "text-slate-500",
                    ].join(" ")}
                  >
                    {item.label}
                  </div>
                  <div
                    className={[
                      "mt-2 text-3xl font-black tracking-[-0.04em]",
                      item.tone,
                    ].join(" ")}
                  >
                    {loading ? "..." : item.value}
                  </div>
                  <div
                    className={[
                      "mt-1 text-xs",
                      isDark ? "text-slate-400" : "text-slate-500",
                    ].join(" ")}
                  >
                    {item.subtitle}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <AnalyticsSection
          offers={offers}
          scope={appliedScope}
          ownerUserId={selectedOwnerUserId}
          scopeLabel={scopeSummaryLabel}
        />

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 space-y-6 lg:col-span-8">
            <Card className="overflow-hidden">
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
                  <div className={isDark ? "divide-y divide-white/10" : "divide-y divide-slate-100"}>
                    {kpis.last5.map((o) => {
                      const pay = getPaymentLabel(o);
                      const cxStatus = getOfferCxStatusSummary(o);
                      const cxAlertBadges = getOfferCxAlertBadges(o);
                      const publicUrl = `/p/${o.publicToken}`;
                      const copied = copiedId === o._id;

                      return (
                        <div
                          key={o._id}
                          className={[
                            "p-5 transition-colors",
                            isDark ? "hover:bg-white/5" : "hover:bg-slate-50/80",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className={isDark ? "truncate text-sm font-semibold text-white" : "truncate text-sm font-semibold text-zinc-900"}>
                                  {o.title || "Proposta"}
                                </div>
                                <Badge
                                  tone={pay.tone}
                                  size="xs"
                                  className="shrink-0"
                                >
                                  {pay.text}
                                </Badge>
                                {cxStatus ? (
                                  <Badge tone={cxStatus.tone} size="xs" className="shrink-0">
                                    {cxStatus.text}
                                  </Badge>
                                ) : null}
                                {cxAlertBadges.map((badge) => (
                                  <Badge
                                    key={`${o._id}-${badge.code}`}
                                    tone={badge.tone}
                                    size="xs"
                                    className="shrink-0"
                                  >
                                    {badge.text}
                                  </Badge>
                                ))}
                                {o?.notifyWhatsAppOnPaid ? (
                                  <span className={isDark ? "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-200" : "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"}>
                                    WA ON
                                  </span>
                                ) : null}
                              </div>

                              <div className={isDark ? "mt-1 text-xs text-slate-400" : "mt-1 text-xs text-slate-500"}>
                                {fmtBRLFromCents(getAmountCents(o))} •{" "}
                                {o.customerName || "Cliente"}{" "}
                                {o.customerWhatsApp
                                  ? `• ${o.customerWhatsApp}`
                                  : ""}
                              </div>
                              {appliedScope === "workspace" ? (
                                <div className={isDark ? "mt-1 text-[11px] text-slate-500" : "mt-1 text-[11px] text-slate-500"}>
                                  Responsavel: {o?.responsibleUser?.name || "Equipe"}
                                </div>
                              ) : null}

                              <div className="mt-2 flex items-center gap-2">
                                <code
                                  className={[
                                    "rounded-lg border px-2 py-1 text-[11px]",
                                    isDark
                                      ? "border-white/10 bg-white/5 text-slate-200"
                                      : "border-slate-200 bg-white text-slate-700",
                                  ].join(" ")}
                                >
                                  {publicUrl}
                                </code>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <Button
                                variant={copied ? "primary" : "secondary"}
                                onClick={() => copyLink(o)}
                              >
                                {copied ? "Copiado" : "Copiar link"}
                              </Button>

                              <Button
                                variant="ghost"
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

                              <Button onClick={() => openDetails(o)}>
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
            {shouldShowTeamRanking ? (
              <Card>
                <CardHeader
                  title="Desempenho da equipe"
                  subtitle="Resumo geral por usuario no workspace"
                  right={<Badge tone="neutral">{teamPerformanceRows.length} usuarios</Badge>}
                />
                <CardBody className="space-y-3">
                  {teamUsersBusy && teamPerformanceRows.length === 0 ? (
                    <Skeleton className="h-32 w-full rounded-xl" />
                  ) : teamPerformanceRows.length === 0 ? (
                    <div className="py-4 text-center">
                      <p className={isDark ? "text-xs font-medium text-slate-500" : "text-xs font-medium text-slate-400"}>
                        Sem dados consolidados da equipe
                      </p>
                    </div>
                  ) : (
                    teamPerformanceRows.map((item) => (
                      <div
                        key={item._id || item.name}
                        className={[
                          "rounded-2xl border px-4 py-3",
                          isDark
                            ? "border-white/10 bg-white/5"
                            : "border-slate-200/80 bg-slate-50/70",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className={isDark ? "text-sm font-semibold text-white" : "text-sm font-semibold text-slate-900"}>
                              {item.name}
                            </div>
                            <div className={isDark ? "mt-1 text-[11px] text-slate-400" : "mt-1 text-[11px] text-slate-500"}>
                              {item.offersCreated} proposta(s) • {item.paidOffers} paga(s)
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={isDark ? "text-sm font-bold text-white" : "text-sm font-bold text-slate-900"}>
                              {fmtBRL(item.paidRevenueCents)}
                            </div>
                            <div className={isDark ? "mt-1 text-[11px] text-slate-400" : "mt-1 text-[11px] text-slate-500"}>
                              {Number(item.conversionPct || 0).toFixed(1)}% conv.
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardBody>
              </Card>
            ) : null}

            <Card>
              <CardHeader
                title="Agenda (7 dias)"
                subtitle={bookingsErr || "Reservas e confirmações"}
                right={
                  <Link
                    to="/calendar"
                    className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700 hover:underline"
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
                    <p className={isDark ? "text-xs font-medium text-slate-500" : "text-xs font-medium text-slate-400"}>
                      Sem compromissos em breve
                    </p>
                  </div>
                ) : (
                  bookings.slice(0, 3).map((b) => (
                    <div
                      key={b._id}
                      className={[
                        "relative border-l-2 py-1 pl-4 transition-colors hover:border-sky-500",
                        isDark ? "border-white/10" : "border-slate-200",
                      ].join(" ")}
                    >
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700">
                        {fmtTimeBR(b.startAt)} — {fmtTimeBR(b.endAt)}
                      </div>
                      <div className={isDark ? "truncate text-sm font-semibold text-white" : "truncate text-sm font-semibold text-slate-900"}>
                        {b.customerName || "Cliente"}
                      </div>
                      <div className={isDark ? "line-clamp-1 text-[11px] text-slate-400" : "line-clamp-1 text-[11px] text-slate-500"}>
                        {b?.offer?.title}
                      </div>
                      {appliedScope === "workspace" ? (
                        <div className={isDark ? "mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500" : "mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400"}>
                          {b?.responsibleUser?.name || "Equipe"}
                        </div>
                      ) : null}
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

            <Card>
              <CardHeader
                title="Atencao em avaliacoes"
                subtitle="Casos criticos recebidos nos ultimos 30 dias"
                right={
                  canAccessReports ? (
                    <Link
                      to="/reports/feedback"
                      className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700 hover:underline"
                    >
                      VER SATISFACAO
                    </Link>
                  ) : (
                    <Link
                      to="/offers?cxFilter=LOW_RATING"
                      className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700 hover:underline"
                    >
                      VER PROPOSTAS
                    </Link>
                  )
                }
              />
              <CardBody className="space-y-3">
                {loading ? (
                  <Skeleton className="h-32 w-full rounded-xl" />
                ) : cxSnapshot.criticalItems.length === 0 ? (
                  <div className="py-4 text-center">
                    <p
                      className={
                        isDark
                          ? "text-xs font-medium text-slate-500"
                          : "text-xs font-medium text-slate-400"
                      }
                    >
                      Nenhum caso critico recente em avaliacao
                    </p>
                  </div>
                ) : (
                  <>
                    {cxSnapshot.criticalItems.map((offer) => {
                      const rating = getOfferFeedbackRating(offer);
                      const feedbackUrl = buildFeedbackUrl(offer);

                      return (
                        <div
                          key={offer._id}
                          className={[
                            "rounded-2xl border px-4 py-3",
                            isDark
                              ? "border-white/10 bg-white/5"
                              : "border-slate-200/80 bg-slate-50/80",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div
                                className={
                                  isDark
                                    ? "truncate text-sm font-semibold text-white"
                                    : "truncate text-sm font-semibold text-slate-900"
                                }
                              >
                                {offer.customerName || "Cliente"}
                              </div>
                              <div
                                className={
                                  isDark
                                    ? "mt-1 line-clamp-1 text-[11px] text-slate-400"
                                    : "mt-1 line-clamp-1 text-[11px] text-slate-500"
                                }
                              >
                                {offer.title || "Proposta"} •{" "}
                                {fmtDateTimeBR(offer?.feedback?.respondedAt)}
                              </div>
                            </div>

                            <div className="flex flex-wrap justify-end gap-2">
                              {rating !== null ? (
                                <Badge tone={isOfferLowRating(offer) ? "CANCELLED" : "CONFIRMED"}>
                                  {rating}/5
                                </Badge>
                              ) : null}
                              {hasOfferContactRequested(offer) ? (
                                <Badge tone="ACCEPTED">Pediu contato</Badge>
                              ) : null}
                            </div>
                          </div>

                          {offer?.feedback?.comment ? (
                            <div
                              className={
                                isDark
                                  ? "mt-3 line-clamp-3 text-xs text-slate-300"
                                  : "mt-3 line-clamp-3 text-xs text-slate-600"
                              }
                            >
                              {offer.feedback.comment}
                            </div>
                          ) : null}

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openDetails(offer)}
                            >
                              Abrir proposta
                            </Button>

                            {hasFeedbackResponse(offer) && feedbackUrl ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  window.open(
                                    feedbackUrl,
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
                                }
                              >
                                Ver avaliacao
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Link to="/offers?cxFilter=LOW_RATING">
                        <Button variant="secondary" size="sm">
                          Nota baixa
                        </Button>
                      </Link>
                      <Link to="/offers?cxFilter=CONTACT_REQUESTED">
                        <Button variant="secondary" size="sm">
                          Pediu contato
                        </Button>
                      </Link>
                    </div>
                  </>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Aguardando confirmação"
                subtitle="Comprovantes enviados pelo cliente"
                right={
                  <Link
                    to="/offers"
                    className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-700 hover:underline"
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
                    <p className={isDark ? "text-xs text-slate-500" : "text-xs text-slate-400"}>
                      Nenhum pagamento aguardando confirmação
                    </p>
                  </div>
                ) : (
                  <div className={isDark ? "divide-y divide-white/10" : "divide-y divide-slate-100"}>
                    {waitingOffers.map((o) => (
                      <div
                        key={o._id}
                        className={[
                          "group flex items-center justify-between p-4 transition-colors",
                          isDark ? "hover:bg-white/5" : "hover:bg-slate-50/80",
                        ].join(" ")}
                      >
                        <div className="min-w-0">
                          <div className={isDark ? "truncate text-sm font-bold text-white" : "truncate text-sm font-bold text-slate-900"}>
                            {o.customerName || "Cliente"}
                          </div>
                          <div className={isDark ? "line-clamp-1 text-[11px] text-slate-400" : "line-clamp-1 text-[11px] text-slate-500"}>
                            {o.title || "Proposta"} •{" "}
                            {fmtBRLFromCents(getAmountCents(o))}
                          </div>
                          <div className={isDark ? "text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500" : "text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400"}>
                            {fmtDateTimeBR(o.updatedAt || o.createdAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge tone="PENDING" size="xs">
                            AGUARDANDO
                          </Badge>
                          <button
                            onClick={() => nav("/offers")}
                            className={[
                              "rounded-xl p-1.5 transition-colors",
                              isDark
                                ? "text-slate-500 hover:bg-white/10 hover:text-white"
                                : "text-slate-400 hover:bg-slate-100 hover:text-slate-900",
                            ].join(" ")}
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

            <div className="flex items-center justify-between rounded-[28px] bg-[linear-gradient(135deg,#0f172a,#1d4ed8,#0f766e)] p-5 text-white shadow-[0_26px_60px_-34px_rgba(15,23,42,0.85)]">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
                  Caixa de Hoje
                </p>
                <div className="text-2xl font-black tracking-[-0.03em]">
                  {loading ? "..." : fmtBRL(kpis.paidTodayCents)}
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
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
        canManagePixAccount={canManagePixAccount}
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

      <WhatsNewModalHost
        open={whatsNewOpen}
        ackBusy={whatsNewBusy}
        snapshotAt={whatsNewSnapshotAt}
        items={whatsNewItems}
        error={whatsNewError}
        onClose={() => acknowledgeWhatsNew()}
        onAcknowledge={() => acknowledgeWhatsNew()}
        onGoToOffers={handleWhatsNewGoToOffers}
      />
    </Shell>
  );
}


