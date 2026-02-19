// src/components/layout/Topbar.jsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/AuthContext.jsx";
import QuotaBadge from "../QuotaBadge.jsx";

// ajuste o caminho conforme seu projeto
import brandLogo from "../../assets/brand.png";

function UpgradeModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Upgrade de plano"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-semibold text-zinc-900">
          Fazer upgrade do plano
        </div>
        <div className="mt-2 text-sm text-zinc-700">
          Sua cota de Pix do mês acabou. Para liberar mais Pix, faça upgrade do
          plano.
        </div>

        <div className="mt-4 rounded-xl border bg-zinc-50 p-3 text-xs text-zinc-600">
          Esta é apenas a UI. Você pode conectar o fluxo de billing depois (ex.:
          WhatsApp, checkout ou página de planos).
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Topbar({ title = "PayLink" }) {
  const { user, workspace, loadingMe, signOut } = useAuth();
  const navigate = useNavigate();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const displayName =
    (user?.name && String(user.name).trim()) || user?.email || "";

  const remaining = workspace?.pixRemaining;
  const limit = workspace?.pixMonthlyLimit;

  const flags = useMemo(() => {
    const r = Number(remaining);
    if (!Number.isFinite(r)) return { low: false, empty: false };
    return { low: r > 0 && r <= 5, empty: r === 0 };
  }, [remaining]);

  function handleLogout() {
    signOut?.();
    navigate("/login", { replace: true });
  }

  return (
    <div className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />

      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* LEFT: logo + brand */}
        <div className="flex items-center gap-4">
          <Link
            to={user ? "/dashboard" : "/"}
            className="flex h-11 items-center justify-center transition-transform hover:scale-105"
            aria-label="Ir para o dashboard"
          >
            <img
              src={brandLogo}
              alt="Logo da marca"
              className="h-full w-auto max-w-[140px] object-contain"
              loading="eager"
              draggable={false}
            />
          </Link>

          <div className="border-l border-zinc-200 pl-4">
            <div className="text-base font-bold tracking-tight text-zinc-900">
              <Link to={user ? "/dashboard" : "/"}>{title}</Link>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
              Propostas • Agenda • Pix
            </div>
          </div>

          {flags.low ? (
            <span className="hidden sm:inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              Poucos Pix restantes
            </span>
          ) : null}
        </div>

        {/* RIGHT: quota + user + actions */}
        <div className="flex items-center gap-3">
          {/* quota badge (desktop) */}
          <div className="hidden sm:block">
            <QuotaBadge
              plan={workspace?.plan}
              remaining={workspace?.pixRemaining}
              limit={workspace?.pixMonthlyLimit}
              used={workspace?.pixUsedThisCycle}
              cycleKey={workspace?.cycleKey}
              loading={loadingMe}
            />
          </div>

          {/* quota badge (mobile compacto) */}
          <div className="sm:hidden">
            <QuotaBadge
              plan={workspace?.plan}
              remaining={workspace?.pixRemaining}
              limit={workspace?.pixMonthlyLimit}
              used={workspace?.pixUsedThisCycle}
              cycleKey={workspace?.cycleKey}
              loading={loadingMe}
              compact
            />
          </div>

          {flags.empty ? (
            <button
              type="button"
              onClick={() => setUpgradeOpen(true)}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Fazer upgrade
            </button>
          ) : null}

          {user ? (
            <>
              <div className="hidden sm:block text-right">
                <div className="text-[10px] uppercase text-zinc-400 font-bold">
                  Usuário logado
                </div>
                <div className="text-sm font-medium text-zinc-700">
                  {displayName}
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-600 transition-all hover:bg-red-50 hover:text-red-600 hover:border-red-100"
              >
                Sair
              </button>
            </>
          ) : (
            <div className="text-xs font-medium text-zinc-400 bg-zinc-50 px-3 py-1 rounded-full border border-zinc-100">
              Modo Visualização
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
