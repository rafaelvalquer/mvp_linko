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

  Wallet: () => <WalletIcon className="h-[18px] w-[18px] text-indigo-500" />,

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
  onNavigate,
}) {
  return (
    <NavLink
      to={to}
      title={collapsed ? String(children) : undefined}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          "group relative flex items-center rounded-2xl px-3 py-2.5 text-sm transition-all duration-300",
          collapsed ? "justify-center" : "justify-start",
          !collapsed && indent ? "ml-9" : "",
          isActive
            ? "bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-100"
            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
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
        active
          ? "bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-100"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
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
  active,
  open,
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
        active
          ? "bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-100"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
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
  const { perms, workspace, refreshWorkspace } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const isOffersAny = useMemo(
    () => loc.pathname === "/offers" || loc.pathname.startsWith("/offers/"),
    [loc.pathname],
  );

  const isStoreRoute = useMemo(
    () => loc.pathname === "/store" || loc.pathname.startsWith("/store/"),
    [loc.pathname],
  );

  const [isOffersOpen, setIsOffersOpen] = useState(isOffersAny);
  const [isStoreOpen, setIsStoreOpen] = useState(isStoreRoute);
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
    if (isStoreRoute) setIsStoreOpen(true);
  }, [isStoreRoute]);

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
    });

    if (allowed) {
      onNavigate?.();
    }
  }

  const planLabel = String(perms.plan || "free").toUpperCase();

  return (
    <>
      <div
        className={[
          "flex h-full flex-col rounded-[28px] border border-zinc-200/80 bg-white/90 p-3 shadow-[0_10px_30px_rgba(24,24,27,0.05)] backdrop-blur transition-all duration-300",
          collapsed ? "items-center" : "items-stretch",
        ].join(" ")}
      >
        <div
          className={[
            "pb-3",
            collapsed
              ? "flex justify-center px-0"
              : "flex items-center justify-between gap-3 px-2",
          ].join(" ")}
        >
          {!collapsed ? (
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#111827_0%,#374151_100%)] text-white shadow-lg shadow-zinc-900/10">
                <span className="text-sm font-bold">L</span>
              </div>

              <div className="min-w-0">
                <div className="block text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-400">
                  Painel
                </div>
                <div className="mt-1 block text-sm font-semibold text-zinc-900">
                  Luminor
                </div>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
          >
            {mobile ? <Icons.Close /> : <Icons.Menu />}
          </button>
        </div>

        {!collapsed ? (
          <div className="mb-3 flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50/80 px-3 py-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                Plano
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">
                {planLabel}
              </div>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
              Ativo
            </span>
          </div>
        ) : (
          <div className="mb-3 flex w-full justify-center">
            <span
              title={planLabel}
              className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 px-2 text-[10px] font-bold text-emerald-700"
            >
              {planLabel.slice(0, 1)}
            </span>
          </div>
        )}

        <nav className="flex-1 space-y-1.5">
          <SidebarItem
            to="/dashboard"
            icon={Icons.Dashboard}
            collapsed={collapsed}
            onNavigate={onNavigate}
          >
            Dashboard
          </SidebarItem>

          <div className="pt-1">
            <SidebarParentButton
              icon={Icons.Offers}
              label="Propostas"
              collapsed={collapsed}
              active={isOffersAny}
              open={isOffersOpen}
              onClick={handleOffersClick}
            />

            <div
              className={`overflow-hidden transition-all duration-300 ease-out ${
                !collapsed && isOffersOpen
                  ? "mt-1 max-h-44 opacity-100"
                  : "mt-0 max-h-0 opacity-0"
              }`}
            >
              <div className="space-y-1">
                <SidebarItem
                  to="/offers"
                  collapsed={collapsed}
                  indent
                  onNavigate={onNavigate}
                >
                  Todas as propostas
                </SidebarItem>

                <SidebarActionItem
                  collapsed={collapsed}
                  indent
                  active={loc.pathname === "/offers/new" && !loc.search.includes("mode=recurring")}
                  onClick={handleCreateOffer}
                >
                  Nova proposta
                </SidebarActionItem>

                <SidebarItem
                  to="/offers/recurring"
                  collapsed={collapsed}
                  indent
                  onNavigate={onNavigate}
                >
                  Recorrências
                </SidebarItem>
              </div>
            </div>
          </div>

          <SidebarItem
            to="/calendar"
            icon={Icons.Calendar}
            collapsed={collapsed}
            onNavigate={onNavigate}
          >
            Agenda
          </SidebarItem>

          <SidebarItem
            to="/reports"
            icon={() => <FileText size={18} className="text-current" />}
            collapsed={collapsed}
            onNavigate={onNavigate}
          >
            Relatórios
          </SidebarItem>

          {perms.store ? (
            <div className="pt-1">
              <SidebarParentButton
                icon={Icons.Store}
                label="Sua Loja"
                collapsed={collapsed}
                active={isStoreRoute}
                open={isStoreOpen}
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
                  <SidebarItem
                    to="/store/products"
                    collapsed={collapsed}
                    indent
                    onNavigate={onNavigate}
                  >
                    Produtos
                  </SidebarItem>
                  <SidebarItem
                    to="/store/customers"
                    collapsed={collapsed}
                    indent
                    onNavigate={onNavigate}
                  >
                    Clientes
                  </SidebarItem>
                </div>
              </div>
            </div>
          ) : null}

          <div className="pt-1">
            <SidebarItem
              to="/settings/agenda"
              icon={Icons.Settings}
              collapsed={collapsed}
              onNavigate={onNavigate}
            >
              Configurações da Agenda
            </SidebarItem>
          </div>

          <div className="pt-1">
            <SidebarItem
              to="/withdraws"
              icon={Icons.Wallet}
              collapsed={collapsed}
              onNavigate={onNavigate}
            >
              Conta Pix
            </SidebarItem>
          </div>
        </nav>

        <div className="mt-4 border-t border-zinc-100 pt-4">
          <div
            className={[
              "rounded-2xl border border-zinc-100 bg-zinc-50/90 transition-all duration-300",
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
                <Icons.Link />
              </div>

              <div className="min-w-0">
                <AnimatedText
                  collapsed={collapsed}
                  className="block text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400"
                >
                  Link Público
                </AnimatedText>
                <AnimatedText
                  collapsed={collapsed}
                  className="mt-1 block truncate font-mono text-[11px] font-medium text-emerald-600"
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
      />
    </>
  );
}
