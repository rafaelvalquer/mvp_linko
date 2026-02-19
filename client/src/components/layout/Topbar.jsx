// src/components/Topbar.jsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/AuthContext.jsx";
import QuotaBadge from "../QuotaBadge.jsx";

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
  const { user, workspace, loadingMe } = useAuth();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const remaining = workspace?.pixRemaining;
  const limit = workspace?.pixMonthlyLimit;

  const flags = useMemo(() => {
    const r = Number(remaining);
    if (!Number.isFinite(r)) return { low: false, empty: false };
    return { low: r > 0 && r <= 5, empty: r === 0 };
  }, [remaining]);

  return (
    <div className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />

      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-sm font-bold text-zinc-900">
            {title}
          </Link>

          {flags.low ? (
            <span className="hidden sm:inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              Poucos Pix restantes
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
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

          {/* mobile compacto */}
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

          {user?.name ? (
            <div className="hidden md:block text-xs text-zinc-500">
              {user.name}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
