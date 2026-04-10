//src/components/layout/Sidebar.jsx
import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/AuthContext.jsx";
import { FileText, Wallet as WalletIcon } from "lucide-react";
import PixSettingsModal from "../PixSettingsModal.jsx";
import {
  getEffectivePixKeyMasked,
  guardOfferCreation,
} from "../../utils/guardOfferCreation.js";
import {
  canUseAutomations,
  canUseRecurringPlan,
} from "../../utils/planFeatures.js";
import useThemeToggle from "../../app/useThemeToggle.js";
import brandLogo from "../../assets/brand.png";
import { hasWorkspaceModuleAccess } from "../../utils/workspacePermissions.js";

const Icons = {
  Menu: ({ className = "" }) => (
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
      className={className}
    >
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  ),

  Close: ({ className = "" }) => (
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
      className={className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  ),

  Dashboard: () => (
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
    >
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  ),

  Management: () => (
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
    >
      <path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),

  Offers: () => (
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
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
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
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  ),

  Reports: () => <FileText size={18} className="text-current" />,

  Automations: () => (
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
    >
      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="m4.93 4.93 2.83 2.83" />
      <path d="m16.24 16.24 2.83 2.83" />
      <path d="M3 12h4" />
      <path d="M17 12h4" />
      <path d="m4.93 19.07 2.83-2.83" />
      <path d="m16.24 7.76 2.83-2.83" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  ),

  Store: () => (
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
    >
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
      <path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7" />
    </svg>
  ),

  Wallet: () => <WalletIcon className="h-[18px] w-[18px] text-current" />,

  Settings: () => (
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
    >
      <path d="M12.22 2h-0.44a2 2 0 0 0-2 2v0.18a2 2 0 0 1-1 1.73l-0.43 0.25a2 2 0 0 1-2 0l-0.15-0.08a2 2 0 0 0-2.73 0.73l-0.22 0.38a2 2 0 0 0 0.73 2.73l0.15 0.1a2 2 0 0 1 1 1.72v0.51a2 2 0 0 1-1 1.74l-0.15 0.09a2 2 0 0 0-0.73 2.73l0.22 0.38a2 2 0 0 0 2.73 0.73l0.15-0.08a2 2 0 0 1 2 0l0.43 0.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h0.44a2 2 0 0 0 2-2v-0.18a2 2 0 0 1 1-1.73l0.43-0.25a2 2 0 0 1 2 0l0.15 0.08a2 2 0 0 0 2.73-0.73l0.22-0.39a2 2 0 0 0-0.73-2.73l-0.15-0.08a2 2 0 0 1-1-1.74v-0.5a2 2 0 0 1 1-1.74l0.15-0.09a2 2 0 0 0 0.73-2.73l-0.22-0.38a2 2 0 0 0-2.73-0.73l-0.15 0.08a2 2 0 0 1-2 0l-0.43-0.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),

  Link: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07L11.8 5.14" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.67-1.67" />
    </svg>
  ),

  ChevronDown: ({ className = "" }) => (
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
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
};

const NAV_ACTIVE_CLASSES =
  "bg-[linear-gradient(135deg,rgba(37,99,235,0.92),rgba(20,184,166,0.88))] text-white shadow-[0_18px_40px_-24px_rgba(37,99,235,0.85)] ring-1 ring-cyan-400/20";

function getNavIdleClasses(isDark) {
  return isDark
    ? "text-slate-300 hover:bg-white/6 hover:text-white"
    : "text-slate-600 hover:bg-slate-100/90 hover:text-slate-950";
}

function getNavSectionClasses(isDark) {
  return isDark
    ? "bg-white/8 text-white ring-1 ring-white/10"
    : "bg-slate-100/90 text-slate-950 ring-1 ring-slate-200/80";
}

function AnimatedText({ collapsed, children, className = "" }) {
  return (
    <span
      className={[
        "overflow-hidden whitespace-nowrap transition-all duration-300 ease-out",
        collapsed
          ? "max-w-0 opacity-0 -translate-x-1"
          : "max-w-[220px] opacity-100 translate-x-0",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function SidebarItem({
  to,
  children,
  icon: Icon,
  collapsed,
  indent = false,
  end = false,
  isDark,
  onNavigate,
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? String(children) : undefined}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          "group relative flex items-center rounded-2xl px-3 py-2.5 text-sm transition-all duration-300",
          collapsed ? "justify-center" : "justify-start",
          !collapsed && indent ? "ml-9" : "",
          isActive ? NAV_ACTIVE_CLASSES : getNavIdleClasses(isDark),
        ].join(" ")
      }
    >
      {Icon ? (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Icon />
        </span>
      ) : null}

      <AnimatedText collapsed={collapsed} className="ml-1 font-medium">
        {children}
      </AnimatedText>
    </NavLink>
  );
}

function SidebarActionItem({
  children,
  icon: Icon,
  collapsed,
  indent = false,
  active = false,
  isDark,
  onClick,
}) {
  return (
    <button
      type="button"
      title={collapsed ? String(children) : undefined}
      onClick={onClick}
      className={[
        "group relative flex w-full items-center rounded-2xl px-3 py-2.5 text-sm transition-all duration-300",
        collapsed ? "justify-center" : "justify-start",
        !collapsed && indent ? "ml-9" : "",
        active ? NAV_ACTIVE_CLASSES : getNavIdleClasses(isDark),
      ].join(" ")}
    >
      {Icon ? (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Icon />
        </span>
      ) : null}

      <AnimatedText collapsed={collapsed} className="ml-1 font-medium">
        {children}
      </AnimatedText>
    </button>
  );
}

function SidebarParentButton({
  icon: Icon,
  label,
  collapsed,
  highlighted,
  open,
  isDark,
  onClick,
}) {
  return (
    <button
      type="button"
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={[
        "flex w-full items-center rounded-2xl px-3 py-2.5 text-sm transition-all duration-300",
        collapsed ? "justify-center" : "justify-between",
        highlighted ? getNavSectionClasses(isDark) : getNavIdleClasses(isDark),
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Icon />
        </span>
        <AnimatedText collapsed={collapsed} className="ml-1 font-medium">
          {label}
        </AnimatedText>
      </div>

      {!collapsed ? (
        <Icons.ChevronDown
          className={`shrink-0 transition-transform duration-300 ${
            open ? "rotate-0" : "-rotate-90"
          }`}
        />
      ) : null}
    </button>
  );
}

export default function Sidebar({
  collapsed = false,
  onToggle,
  onNavigate,
  mobile = false,
}) {
  const { isDark } = useThemeToggle();
  const { perms, user, workspace, refreshWorkspace } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const isOffersAny = useMemo(
    () => loc.pathname === "/offers" || loc.pathname.startsWith("/offers/"),
    [loc.pathname],
  );

  const isReportsAny = useMemo(
    () => loc.pathname === "/reports" || loc.pathname.startsWith("/reports/"),
    [loc.pathname],
  );

  const isStoreRoute = useMemo(
    () => loc.pathname === "/store" || loc.pathname.startsWith("/store/"),
    [loc.pathname],
  );

  const isMyPageRoute = useMemo(
    () => loc.pathname === "/my-page" || loc.pathname.startsWith("/my-page/"),
    [loc.pathname],
  );

  const [isOffersOpen, setIsOffersOpen] = useState(isOffersAny);
  const [isReportsOpen, setIsReportsOpen] = useState(isReportsAny);
  const [isStoreOpen, setIsStoreOpen] = useState(isStoreRoute);
  const [isMyPageOpen, setIsMyPageOpen] = useState(isMyPageRoute);
  const [localPayoutPixKeyMasked, setLocalPayoutPixKeyMasked] = useState("");
  const [pixModalState, setPixModalState] = useState({
    open: false,
    title: "",
    description: "",
    redirectTo: null,
  });

  useEffect(() => {
    if (isOffersAny) setIsOffersOpen(true);
  }, [isOffersAny]);

  useEffect(() => {
    if (isReportsAny) setIsReportsOpen(true);
  }, [isReportsAny]);

  useEffect(() => {
    if (isStoreRoute) setIsStoreOpen(true);
  }, [isStoreRoute]);

  useEffect(() => {
    if (isMyPageRoute) setIsMyPageOpen(true);
  }, [isMyPageRoute]);

  useEffect(() => {
    setLocalPayoutPixKeyMasked(
      String(workspace?.payoutPixKeyMasked || "").trim(),
    );
  }, [workspace?.payoutPixKeyMasked]);

  function openPixModal(context = {}) {
    setPixModalState({
      open: true,
      title: String(context?.title || ""),
      description: String(context?.description || ""),
      redirectTo: context?.redirectTo || null,
    });
  }

  function closePixModal() {
    setPixModalState((prev) => ({
      ...prev,
      open: false,
      title: "",
      description: "",
      redirectTo: null,
    }));
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
      onNavigate?.();
      nav(redirectTo);
    }
  }

  function handleOffersClick() {
    if (collapsed) {
      onToggle?.();
      setIsOffersOpen(true);
      nav("/offers");
      return;
    }

    setIsOffersOpen((prev) => !prev);
    nav("/offers");
  }

  function handleStoreClick() {
    if (collapsed) {
      onToggle?.();
      setIsStoreOpen(true);
      return;
    }

    setIsStoreOpen((prev) => !prev);
  }

  function handleReportsClick() {
    if (collapsed) {
      onToggle?.();
      setIsReportsOpen(true);
      nav("/reports");
      return;
    }

    setIsReportsOpen((prev) => !prev);
    nav("/reports");
  }

  function handleMyPageClick() {
    if (collapsed) {
      onToggle?.();
      setIsMyPageOpen(true);
      nav("/my-page/links");
      return;
    }

    setIsMyPageOpen((prev) => !prev);
    nav("/my-page/links");
  }

  function handleCreateOffer() {
    const allowed = guardOfferCreation({
      workspace,
      payoutPixKeyMasked: getEffectivePixKeyMasked(
        workspace,
        localPayoutPixKeyMasked,
      ),
      navigate: nav,
      openPixModal,
      targetPath: "/offers/new",
      canManagePixAccount,
    });

    if (allowed) {
      onNavigate?.();
    }
  }

  function handleCreateRecurring() {
    const allowed = guardOfferCreation({
      workspace,
      payoutPixKeyMasked: getEffectivePixKeyMasked(
        workspace,
        localPayoutPixKeyMasked,
      ),
      navigate: nav,
      openPixModal,
      targetPath: "/offers/new?mode=recurring",
      canManagePixAccount,
    });

    if (allowed) {
      onNavigate?.();
    }
  }

  const canUseRecurringFeatures = canUseRecurringPlan(
    perms?.plan || workspace?.plan || "start",
  );
  const canAccessAutomations = canUseAutomations(
    perms?.plan || workspace?.plan || "start",
  );
  const canManagePixAccount = perms?.canManagePixAccount === true;
  const canAccessDashboard = hasWorkspaceModuleAccess(perms, "dashboard");
  const canAccessOffers = hasWorkspaceModuleAccess(perms, "offers");
  const canCreateOffers = hasWorkspaceModuleAccess(perms, "newOffer");
  const canAccessCalendar = hasWorkspaceModuleAccess(perms, "calendar");
  const canAccessReports = hasWorkspaceModuleAccess(perms, "reports");
  const canAccessProducts = hasWorkspaceModuleAccess(perms, "products");
  const canAccessClients = hasWorkspaceModuleAccess(perms, "clients");
  const canAccessSettings = hasWorkspaceModuleAccess(perms, "settings");
  const canAccessMyPage = canAccessSettings && perms?.isWorkspaceOwner === true;
  const planLabel = String(perms.plan || "free").toUpperCase();

  return (
    <>
      <div
        className={[
          "flex h-full flex-col rounded-[32px] border p-3 backdrop-blur-2xl transition-all duration-300",
          isDark
            ? mobile
              ? "border-white/10 bg-[linear-gradient(180deg,rgba(8,15,30,0.98),rgba(6,12,24,0.94))] shadow-[0_24px_80px_-42px_rgba(15,23,42,0.92)]"
              : "border-white/10 bg-[linear-gradient(180deg,rgba(8,15,30,0.98),rgba(6,12,24,0.95))] shadow-[0_20px_60px_-48px_rgba(15,23,42,0.88)]"
            : mobile
              ? "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,245,249,0.9))] shadow-[0_24px_80px_-42px_rgba(15,23,42,0.18)]"
              : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(241,245,249,0.92))] shadow-[0_20px_56px_-46px_rgba(15,23,42,0.16)]",
          collapsed ? "items-center" : "items-stretch",
        ].join(" ")}
      >
        <div
          className={[
            "pb-3",
            collapsed
              ? "flex flex-col items-center gap-2 px-0"
              : "flex items-center justify-between gap-3 px-2",
          ].join(" ")}
        >
          {!collapsed ? (
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={[
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white shadow-[0_18px_40px_-22px_rgba(37,99,235,0.75)]",
                  isDark ? "border-white/10" : "border-slate-200/80",
                ].join(" ")}
              >
                <img
                  src={brandLogo}
                  alt="LuminorPay"
                  className="h-8 w-8 rounded-xl object-contain"
                  draggable={false}
                />
              </div>

              <div className="min-w-0">
                <div
                  className={[
                    "block text-[11px] font-bold uppercase tracking-[0.22em]",
                    isDark ? "text-slate-400" : "text-slate-500",
                  ].join(" ")}
                >
                  Vendas e Pix
                </div>
                <div
                  className={[
                    "mt-1 block text-sm font-semibold",
                    isDark ? "text-white" : "text-slate-950",
                  ].join(" ")}
                >
                  LuminorPay
                </div>
              </div>
            </div>
          ) : (
            <div
              className={[
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white shadow-[0_18px_40px_-22px_rgba(37,99,235,0.75)]",
                isDark ? "border-white/10" : "border-slate-200/80",
              ].join(" ")}
              title="LuminorPay"
            >
              <img
                src={brandLogo}
                alt="LuminorPay"
                className="h-8 w-8 rounded-xl object-contain"
                draggable={false}
              />
            </div>
          )}

          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className={[
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition",
              isDark
                ? "border-white/10 bg-white/5 text-slate-200 hover:border-cyan-400/20 hover:bg-white/10 hover:text-white"
                : "border-slate-200/80 bg-white/85 text-slate-600 shadow-[0_14px_28px_-20px_rgba(15,23,42,0.2)] hover:border-sky-300 hover:text-slate-950",
            ].join(" ")}
          >
            {mobile ? <Icons.Close /> : <Icons.Menu />}
          </button>
        </div>

        {!collapsed ? (
          <div
            className={[
              "mb-3 flex items-center justify-between rounded-2xl border px-3 py-2",
              isDark
                ? "border-white/10 bg-white/5"
                : "border-slate-200/80 bg-white/80 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.16)]",
            ].join(" ")}
          >
            <div>
              <div
                className={[
                  "text-[10px] font-bold uppercase tracking-[0.18em]",
                  isDark ? "text-slate-400" : "text-slate-500",
                ].join(" ")}
              >
                Plano
              </div>
              <div
                className={[
                  "mt-1 text-sm font-semibold",
                  isDark ? "text-white" : "text-slate-950",
                ].join(" ")}
              >
                {planLabel}
              </div>
            </div>
            <span
              className={[
                "rounded-full border px-2.5 py-1 text-[10px] font-bold",
                isDark
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                  : "border-emerald-300/70 bg-emerald-50 text-emerald-700",
              ].join(" ")}
            >
              Ativo
            </span>
          </div>
        ) : (
          <div className="mb-3 flex w-full justify-center">
            <span
              title={planLabel}
              className={[
                "inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-[10px] font-bold",
                isDark
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                  : "border-emerald-300/70 bg-emerald-50 text-emerald-700",
              ].join(" ")}
            >
              {planLabel.slice(0, 1)}
            </span>
          </div>
        )}

        <nav className="flex-1 space-y-1.5 pr-1">
          {canAccessDashboard ? (
            <SidebarItem
              to="/dashboard"
              icon={Icons.Dashboard}
              collapsed={collapsed}
              isDark={isDark}
              onNavigate={onNavigate}
            >
              Dashboard
            </SidebarItem>
          ) : null}

          {user?.isMasterAdmin ? (
            <SidebarItem
              to="/gerenciamento"
              icon={Icons.Management}
              collapsed={collapsed}
              isDark={isDark}
              onNavigate={onNavigate}
            >
              Gerenciamento
            </SidebarItem>
          ) : null}

          {canAccessOffers ? (
            <div className="pt-1">
              <SidebarParentButton
                icon={Icons.Offers}
                label="Propostas"
                collapsed={collapsed}
                highlighted={isOffersAny}
                open={isOffersOpen}
                isDark={isDark}
                onClick={handleOffersClick}
              />

              <div
                className={`overflow-hidden transition-all duration-300 ease-out ${
                  !collapsed && isOffersOpen
                    ? canUseRecurringFeatures
                      ? "mt-1 max-h-44 opacity-100"
                      : "mt-1 max-h-32 opacity-100"
                    : "mt-0 max-h-0 opacity-0"
                }`}
              >
                <div className="space-y-1">
                  <SidebarItem
                    to="/offers"
                    collapsed={collapsed}
                    indent
                    end
                    isDark={isDark}
                    onNavigate={onNavigate}
                  >
                    Todas as propostas
                  </SidebarItem>

                  {canCreateOffers ? (
                    <SidebarActionItem
                      collapsed={collapsed}
                      indent
                      isDark={isDark}
                      active={
                        loc.pathname === "/offers/new" &&
                        (!loc.search.includes("mode=recurring") ||
                          !canUseRecurringFeatures)
                      }
                      onClick={handleCreateOffer}
                    >
                      Nova proposta
                    </SidebarActionItem>
                  ) : null}

                  {canUseRecurringFeatures ? (
                    <SidebarItem
                      to="/offers/recurring"
                      collapsed={collapsed}
                      indent
                      isDark={isDark}
                      onNavigate={onNavigate}
                    >
                      Recorrências
                    </SidebarItem>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {canAccessCalendar ? (
            <SidebarItem
              to="/calendar"
              icon={Icons.Calendar}
              collapsed={collapsed}
              isDark={isDark}
              onNavigate={onNavigate}
            >
              Agenda
            </SidebarItem>
          ) : null}

          {canAccessReports ? (
            <div className="pt-1">
              <SidebarParentButton
                icon={Icons.Reports}
                label="Relatórios"
                collapsed={collapsed}
                highlighted={isReportsAny}
                open={isReportsOpen}
                isDark={isDark}
                onClick={handleReportsClick}
              />

              <div
                className={`overflow-hidden transition-all duration-300 ease-out ${
                  !collapsed && isReportsOpen
                    ? canUseRecurringFeatures
                      ? "mt-1 max-h-64 opacity-100"
                      : "mt-1 max-h-48 opacity-100"
                    : "mt-0 max-h-0 opacity-0"
                }`}
              >
                <div className="space-y-1">
                  <SidebarItem
                    to="/reports"
                    collapsed={collapsed}
                    indent
                    end
                    isDark={isDark}
                    onNavigate={onNavigate}
                  >
                    Geral
                  </SidebarItem>

                  <SidebarItem
                    to="/reports/feedback"
                    collapsed={collapsed}
                    indent
                    isDark={isDark}
                    onNavigate={onNavigate}
                  >
                    Satisfação
                  </SidebarItem>

                  <SidebarItem
                    to="/reports/my-page"
                    collapsed={collapsed}
                    indent
                    isDark={isDark}
                    onNavigate={onNavigate}
                  >
                    Minha Pagina
                  </SidebarItem>

                  {canUseRecurringFeatures ? (
                    <SidebarItem
                      to="/reports/recurring"
                      collapsed={collapsed}
                      indent
                      isDark={isDark}
                      onNavigate={onNavigate}
                    >
                      Recorrência
                    </SidebarItem>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {canAccessAutomations ? (
            <SidebarItem
              to="/automations"
              icon={Icons.Automations}
              collapsed={collapsed}
              isDark={isDark}
              onNavigate={onNavigate}
            >
              Automações
            </SidebarItem>
          ) : null}

          {perms.store && (canAccessProducts || canAccessClients) ? (
            <div className="pt-1">
              <SidebarParentButton
                icon={Icons.Store}
                label="Sua Loja"
                collapsed={collapsed}
                highlighted={isStoreRoute}
                open={isStoreOpen}
                isDark={isDark}
                onClick={handleStoreClick}
              />

              <div
                className={`overflow-hidden transition-all duration-300 ease-out ${
                  !collapsed && isStoreOpen
                    ? "mt-1 max-h-44 opacity-100"
                    : "mt-0 max-h-0 opacity-0"
                }`}
              >
                <div className="space-y-1">
                  {canAccessProducts ? (
                    <SidebarItem
                      to="/store/products"
                      collapsed={collapsed}
                      indent
                      isDark={isDark}
                      onNavigate={onNavigate}
                    >
                      Produtos
                    </SidebarItem>
                  ) : null}
                  {canAccessClients ? (
                    <SidebarItem
                      to="/store/customers"
                      collapsed={collapsed}
                      indent
                      isDark={isDark}
                      onNavigate={onNavigate}
                    >
                      Clientes
                    </SidebarItem>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {canAccessMyPage ? (
            <div className="pt-1">
              <SidebarParentButton
                icon={Icons.Link}
                label="Minha Pagina"
                collapsed={collapsed}
                highlighted={isMyPageRoute}
                open={isMyPageOpen}
                isDark={isDark}
                onClick={handleMyPageClick}
              />

              <div
                className={`overflow-hidden transition-all duration-300 ease-out ${
                  !collapsed && isMyPageOpen
                    ? "mt-1 max-h-44 opacity-100"
                    : "mt-0 max-h-0 opacity-0"
                }`}
              >
                <div className="space-y-1">
                  <SidebarItem
                    to="/my-page/links"
                    collapsed={collapsed}
                    indent
                    isDark={isDark}
                    onNavigate={onNavigate}
                  >
                    Links
                  </SidebarItem>
                  <SidebarItem
                    to="/my-page/shop"
                    collapsed={collapsed}
                    indent
                    isDark={isDark}
                    onNavigate={onNavigate}
                  >
                    Shop
                  </SidebarItem>
                  <SidebarItem
                    to="/my-page/design"
                    collapsed={collapsed}
                    indent
                    isDark={isDark}
                    onNavigate={onNavigate}
                  >
                    Design
                  </SidebarItem>
                </div>
              </div>
            </div>
          ) : null}

          {canAccessSettings ? (
            <div className="pt-1">
              <SidebarItem
                to="/settings"
                icon={Icons.Settings}
                collapsed={collapsed}
                isDark={isDark}
                onNavigate={onNavigate}
              >
                Configurações
              </SidebarItem>
            </div>
          ) : null}

          <div className="pt-1">
            <SidebarItem
              to="/withdraws"
              icon={Icons.Wallet}
              collapsed={collapsed}
              isDark={isDark}
              onNavigate={onNavigate}
            >
              Conta Pix
            </SidebarItem>
          </div>
        </nav>

        <div
          className={[
            "mt-4 border-t pt-4",
            isDark ? "border-white/10" : "border-slate-200/80",
          ].join(" ")}
        >
          <div
            className={[
              "rounded-2xl border transition-all duration-300",
              isDark
                ? "border-white/10 bg-white/5"
                : "border-slate-200/80 bg-white/78 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.16)]",
              collapsed ? "p-2" : "p-3",
            ].join(" ")}
            title={collapsed ? "Link Público" : undefined}
          >
            <div
              className={[
                "flex items-center",
                collapsed ? "justify-center" : "gap-3",
              ].join(" ")}
            >
              <div
                className={[
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  isDark
                    ? "bg-white/10 text-cyan-300 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.8)]"
                    : "bg-sky-50 text-sky-600 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.24)]",
                ].join(" ")}
              >
                <Icons.Link />
              </div>

              <div className="min-w-0">
                <AnimatedText
                  collapsed={collapsed}
                  className={[
                    "block text-[10px] font-bold uppercase tracking-[0.18em]",
                    isDark ? "text-slate-400" : "text-slate-500",
                  ].join(" ")}
                >
                  Link Público
                </AnimatedText>
                <AnimatedText
                  collapsed={collapsed}
                  className={[
                    "mt-1 block truncate font-mono text-[11px] font-medium",
                    isDark ? "text-cyan-300" : "text-sky-600",
                  ].join(" ")}
                >
                  /p/:token
                </AnimatedText>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PixSettingsModal
        open={pixModalState.open}
        onClose={closePixModal}
        onSaved={handlePixSaved}
        contextTitle={pixModalState.title}
        contextDescription={pixModalState.description}
        canManagePixAccount={canManagePixAccount}
      />
    </>
  );
}
