// Sidebar.jsx
import React, { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/AuthContext.jsx";

// Ícones SVG Natos (Mesmo design, sem dependências)
const Icons = {
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
  Withdraws: () => (
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
      {/* seta para baixo + linha (saque/retirada) */}
      <path d="M12 3v10" />
      <path d="m8 11 4 4 4-4" />
      <path d="M5 21h14" />
    </svg>
  ),

  ChevronDown: ({ className }) => (
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

const Item = ({ to, children, icon: Icon, indent = false }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      [
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-300",
        indent ? "ml-9" : "",
        isActive
          ? "bg-emerald-50 text-emerald-700 font-medium shadow-sm ring-1 ring-emerald-100"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
      ].join(" ")
    }
  >
    {Icon ? (
      <div className="shrink-0">
        <Icon />
      </div>
    ) : null}
    <span>{children}</span>
  </NavLink>
);

export default function Sidebar() {
  const { perms } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  // ✅ Só marca "Propostas" como ativa quando estiver EXATAMENTE em /offers
  const isOffersRoot = useMemo(
    () => loc.pathname === "/offers",
    [loc.pathname],
  );

  // ✅ Mantém o grupo aberto quando estiver dentro de /offers/*
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

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          Painel
        </span>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200">
          {String(perms.plan || "free").toUpperCase()}
        </span>
      </div>

      <nav className="space-y-1">
        <Item to="/" icon={Icons.Dashboard}>
          Dashboard
        </Item>

        {/* ✅ Grupo: Propostas (ativa só em /offers; Nova proposta ativa só em /offers/new) */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => {
              setIsOffersOpen((v) => !v);
              nav("/offers");
            }}
            className={[
              "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors",
              isOffersRoot
                ? "bg-emerald-50 text-emerald-700 font-medium shadow-sm ring-1 ring-emerald-100"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <Icons.Offers />
              <span className="font-medium">Propostas</span>
            </div>
            <Icons.ChevronDown
              className={`transition-transform duration-300 ${
                isOffersOpen ? "rotate-0" : "-rotate-90"
              }`}
            />
          </button>

          <div
            className={`overflow-hidden transition-all duration-500 ease-in-out ${
              isOffersOpen
                ? "max-h-28 opacity-100 mt-1"
                : "max-h-0 opacity-0 mt-0"
            }`}
          >
            <div className="space-y-1">
              {/* ✅ remove ícone ao lado de "Nova proposta" */}
              <Item to="/offers/new" indent>
                Nova proposta
              </Item>
            </div>
          </div>
        </div>

        <Item to="/calendar" icon={Icons.Calendar}>
          Agenda
        </Item>

        {/* Store (Premium) */}
        {perms.store && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsStoreOpen(!isStoreOpen)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              <div className="flex items-center gap-3">
                <Icons.Store />
                <span className="font-medium">Sua Loja</span>
              </div>
              <Icons.ChevronDown
                className={`transition-transform duration-300 ${
                  isStoreOpen ? "rotate-0" : "-rotate-90"
                }`}
              />
            </button>

            <div
              className={`overflow-hidden transition-all duration-500 ease-in-out ${
                isStoreOpen
                  ? "max-h-40 opacity-100 mt-1"
                  : "max-h-0 opacity-0 mt-0"
              }`}
            >
              <div className="space-y-1">
                <Item to="/store/products" indent>
                  Produtos
                </Item>
                <Item to="/store/customers" indent>
                  Clientes
                </Item>
                <Item to="/store/pay-links" indent>
                  Links de Pagamento
                </Item>
              </div>
            </div>
          </div>
        )}
      </nav>

      <Item to="/withdraws" icon={Icons.Withdraws}>
        Saques
      </Item>

      {/* Footer Link Público */}
      <div className="mt-auto pt-4 border-t border-zinc-50">
        <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-100">
          <div className="text-[9px] font-bold uppercase text-zinc-400 mb-1">
            Link Público
          </div>
          <span className="truncate font-mono text-[11px] font-medium text-emerald-600">
            /p/:token
          </span>
        </div>
      </div>
    </div>
  );
}
