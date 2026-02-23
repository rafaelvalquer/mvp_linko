// src/components/layout/Topbar.jsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/AuthContext.jsx";
import { api } from "../../app/api.js";
import QuotaBadge from "../QuotaBadge.jsx";
import brandLogo from "../../assets/brand.png";

function StatusBadge({ status, loading }) {
  const s = String(status || "").toLowerCase();

  let cls = "border-zinc-200 bg-zinc-100 text-zinc-700";
  let label = s || "—";

  if (loading) {
    cls = "border-zinc-200 bg-zinc-50 text-zinc-500";
    label = "...";
  } else if (s === "active") {
    cls = "border-emerald-200 bg-emerald-50 text-emerald-800";
    label = "active";
  } else if (s === "past_due") {
    cls = "border-amber-200 bg-amber-50 text-amber-900";
    label = "past_due";
  } else if (s === "canceled") {
    cls = "border-red-200 bg-red-50 text-red-700";
    label = "canceled";
  } else if (s === "inactive") {
    cls = "border-red-200 bg-red-50 text-red-700";
    label = "inactive";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}
    >
      Assinatura: {label}
    </span>
  );
}

export default function Topbar({ title = "LuminorPay" }) {
  const {
    user,
    workspace,
    loadingMe,
    loadingBilling,
    subscriptionStatus,
    signOut,
  } = useAuth();

  const navigate = useNavigate();
  const [portalLoading, setPortalLoading] = useState(false);

  const displayName =
    (user?.name && String(user.name).trim()) || user?.email || "";

  const remaining = workspace?.pixRemaining;
  const flags = useMemo(() => {
    const r = Number(remaining);
    if (!Number.isFinite(r)) return { low: false, empty: false };
    return { low: r > 0 && r <= 5, empty: r === 0 };
  }, [remaining]);

  const stripeCustomerId = workspace?.subscription?.stripeCustomerId || "";
  const hasPortal = !!stripeCustomerId;

  const s = String(subscriptionStatus || "").toLowerCase();
  const needsAttention = s !== "active";
  const isPastDue = s === "past_due";

  function handleLogout() {
    signOut?.();
    navigate("/login", { replace: true });
  }

  async function openPortal() {
    try {
      setPortalLoading(true);
      const data = await api("/billing/stripe/portal", {
        method: "POST",
        body: JSON.stringify({ returnUrl: window.location.href }),
      });
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      alert(e?.data?.error || e?.message || "Falha ao abrir portal.");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
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

        <div className="flex items-center gap-3">
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

          <div className="hidden md:block">
            <StatusBadge status={subscriptionStatus} loading={loadingBilling} />
          </div>

          {user && hasPortal ? (
            <button
              type="button"
              onClick={openPortal}
              disabled={portalLoading}
              className="hidden sm:inline-flex rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              title="Gerenciar assinatura/cartão/cancelamento"
            >
              {portalLoading ? "Abrindo..." : "Gerenciar assinatura"}
            </button>
          ) : null}

          {user ? (
            <>
              {needsAttention ? (
                <Link
                  to="/billing/plans"
                  className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  {isPastDue ? "Regularizar" : "Assinar plano"}
                </Link>
              ) : null}

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

      {user && needsAttention ? (
        <div className="border-t border-amber-200 bg-amber-50">
          <div className="mx-auto max-w-7xl px-4 py-2 text-sm text-amber-900">
            {isPastDue
              ? "Pagamento pendente. Geração de Pix bloqueada até regularização."
              : "Assinatura inativa. Assine um plano para liberar cobranças Pix."}
          </div>
        </div>
      ) : null}
    </div>
  );
}
