import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CreditCard,
  LogOut,
  MessageCircle,
  Moon,
  Settings2,
  Sun,
} from "lucide-react";

import { api } from "../../app/api.js";
import { useAuth } from "../../app/AuthContext.jsx";
import useThemeToggle from "../../app/useThemeToggle.js";
import brandLogo from "../../assets/brand.png";

function StatusBadge({ status, loading }) {
  const { isDark } = useThemeToggle();
  const normalized = String(status || "").toLowerCase();

  let classes = isDark
    ? "border-white/10 bg-white/5 text-slate-300"
    : "border-slate-200/80 bg-white/80 text-slate-600";
  let label = "Sem status";

  if (loading) {
    label = "Sincronizando";
  } else if (normalized === "active") {
    classes = isDark
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : "border-emerald-300/70 bg-emerald-50 text-emerald-700";
    label = "Ativa";
  } else if (normalized === "past_due") {
    classes = isDark
      ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
      : "border-amber-300/70 bg-amber-50 text-amber-700";
    label = "Pendente";
  } else if (normalized === "canceled") {
    classes = isDark
      ? "border-red-400/20 bg-red-400/10 text-red-200"
      : "border-red-300/70 bg-red-50 text-red-700";
    label = "Cancelada";
  } else if (normalized === "inactive") {
    classes = isDark
      ? "border-red-400/20 bg-red-400/10 text-red-200"
      : "border-red-300/70 bg-red-50 text-red-700";
    label = "Inativa";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${classes}`}
    >
      Assinatura {label}
    </span>
  );
}

export default function Topbar({
  title = "LuminorPay",
  isDark = false,
  setIsDark,
  contextualAction = null,
  onOpenMyWhatsApp = null,
  layout = "mobile",
}) {
  const { user, workspace, loadingBilling, subscriptionStatus, signOut } =
    useAuth();

  const navigate = useNavigate();
  const [portalLoading, setPortalLoading] = useState(false);

  const displayName =
    (user?.name && String(user.name).trim()) || user?.email || "";

  const stripeCustomerId = workspace?.subscription?.stripeCustomerId || "";
  const hasPortal = !!stripeCustomerId;

  const normalized = String(subscriptionStatus || "").toLowerCase();
  const needsAttention = normalized !== "active";
  const isPastDue = normalized === "past_due";
  const hasWhatsAppConfigured = String(user?.whatsappPhone || "").trim().length > 0;
  const isMobileLayout = layout === "mobile";

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
    } catch (error) {
      alert(error?.data?.error || error?.message || "Falha ao abrir portal.");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div
      className={[
        "border backdrop-blur-2xl",
        isDark
          ? "border-white/10 bg-[rgba(6,11,24,0.88)]"
          : "border-slate-200/80 bg-[rgba(255,255,255,0.82)]",
        isMobileLayout
          ? "fixed inset-x-0 top-0 z-40 border-x-0 border-t-0 md:hidden"
          : "hidden overflow-hidden rounded-[28px] shadow-[0_22px_72px_-50px_rgba(15,23,42,0.28)] md:block md:sticky md:top-4 md:z-30",
      ].join(" ")}
    >
      <div
        className={[
          "flex items-center justify-between gap-4 px-4 py-2.5 sm:px-5 lg:px-6",
          isMobileLayout ? "mx-auto max-w-[1500px]" : "",
        ].join(" ")}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          {isMobileLayout ? (
            <Link
              to={user ? "/dashboard" : "/"}
              className="flex items-center gap-3"
              aria-label="Ir para o dashboard"
            >
              <div
                className={[
                  "flex h-11 w-11 items-center justify-center rounded-2xl border bg-[linear-gradient(135deg,#2563eb,#14b8a6)] shadow-[0_18px_40px_-20px_rgba(37,99,235,0.7)] sm:h-[42px] sm:w-[42px]",
                  isDark ? "border-white/10" : "border-slate-200/80",
                ].join(" ")}
              >
                <img
                  src={brandLogo}
                  alt="Logo da marca"
                  className="h-8 w-8 rounded-xl object-contain"
                  loading="eager"
                  draggable={false}
                />
              </div>

              <div className="min-w-0">
                <div
                  className={[
                    "truncate text-[15px] font-black tracking-tight",
                    isDark ? "text-white" : "text-slate-950",
                  ].join(" ")}
                >
                  {title}
                </div>
              </div>
            </Link>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="hidden xl:block">
            <StatusBadge status={subscriptionStatus} loading={loadingBilling} />
          </div>

          {contextualAction}

          <button
            type="button"
            onClick={() => setIsDark?.((value) => !value)}
            className={[
              "inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition",
              isDark
                ? "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-400/20 hover:bg-white/10 hover:text-white"
                : "border-slate-200/80 bg-white/85 text-slate-600 shadow-[0_14px_26px_-18px_rgba(15,23,42,0.25)] hover:border-sky-300 hover:text-slate-950",
            ].join(" ")}
            aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
            title={isDark ? "Usar tema claro" : "Usar tema escuro"}
          >
            {isDark ? (
              <Sun className="h-[18px] w-[18px] text-amber-400" />
            ) : (
              <Moon className="h-[18px] w-[18px] text-sky-600" />
            )}
          </button>

          {user && hasPortal ? (
            <button
              type="button"
              onClick={openPortal}
              disabled={portalLoading}
              className={[
                "hidden rounded-2xl border px-4 py-2.5 text-xs font-semibold transition disabled:opacity-60 sm:inline-flex",
                isDark
                  ? "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  : "border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_14px_28px_-20px_rgba(15,23,42,0.2)] hover:bg-white",
              ].join(" ")}
              title="Gerenciar assinatura"
            >
              <Settings2 className="mr-2 h-4 w-4" />
              {portalLoading ? "Abrindo..." : "Gerenciar assinatura"}
            </button>
          ) : null}

          {user ? (
            <>
              {needsAttention ? (
                <Link
                  to="/billing/plans"
                  className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#2563eb,#14b8a6)] px-4 py-2.5 text-xs font-bold text-white shadow-[0_20px_40px_-24px_rgba(37,99,235,0.7)] transition hover:brightness-110"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  {isPastDue ? "Regularizar" : "Assinar plano"}
                </Link>
              ) : null}

              {onOpenMyWhatsApp ? (
                <button
                  type="button"
                  onClick={onOpenMyWhatsApp}
                  className={[
                    "inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition lg:hidden",
                    isDark
                      ? "border-white/10 bg-white/5 text-slate-200 hover:border-cyan-400/20 hover:bg-white/10 hover:text-white"
                      : "border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_14px_28px_-20px_rgba(15,23,42,0.18)] hover:border-cyan-300 hover:bg-sky-50 hover:text-slate-950",
                  ].join(" ")}
                  title="Meu WhatsApp"
                  aria-label="Abrir Meu WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" />
                </button>
              ) : null}

              {onOpenMyWhatsApp ? (
                <button
                  type="button"
                  onClick={onOpenMyWhatsApp}
                  className={[
                    "hidden rounded-2xl border px-4 py-2 text-left transition lg:block",
                    hasWhatsAppConfigured
                      ? isDark
                        ? "border-white/10 bg-white/5 hover:border-cyan-400/20 hover:bg-white/10"
                        : "border-slate-200/80 bg-white/78 shadow-[0_14px_28px_-20px_rgba(15,23,42,0.18)] hover:border-cyan-300 hover:bg-sky-50"
                      : isDark
                        ? "border-cyan-400/20 bg-cyan-400/10 hover:border-cyan-300/30 hover:bg-cyan-400/14"
                        : "border-cyan-200 bg-cyan-50 shadow-[0_14px_28px_-20px_rgba(14,165,233,0.24)] hover:border-cyan-300 hover:bg-cyan-100/80",
                  ].join(" ")}
                  title="Abrir Meu WhatsApp"
                >
                  <div
                    className={[
                      "text-[10px] font-bold uppercase tracking-[0.18em]",
                      isDark ? "text-slate-400" : "text-slate-500",
                    ].join(" ")}
                  >
                    Meu WhatsApp
                  </div>
                  <div
                    className={[
                      "max-w-[190px] truncate text-sm font-semibold",
                      isDark ? "text-slate-100" : "text-slate-900",
                    ].join(" ")}
                  >
                    {displayName}
                  </div>
                  <div
                    className={[
                      "mt-0.5 text-xs",
                      hasWhatsAppConfigured
                        ? isDark
                          ? "text-emerald-300"
                          : "text-emerald-700"
                        : isDark
                          ? "text-cyan-200"
                          : "text-cyan-700",
                    ].join(" ")}
                  >
                    {hasWhatsAppConfigured
                      ? "Numero configurado"
                      : "Configurar numero"}
                  </div>
                </button>
              ) : (
                <div
                  className={[
                    "hidden rounded-2xl border px-4 py-2 text-right lg:block",
                    isDark
                      ? "border-white/10 bg-white/5"
                      : "border-slate-200/80 bg-white/78 shadow-[0_14px_28px_-20px_rgba(15,23,42,0.18)]",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "text-[10px] font-bold uppercase tracking-[0.18em]",
                      isDark ? "text-slate-400" : "text-slate-500",
                    ].join(" ")}
                  >
                    Usuario logado
                  </div>
                  <div
                    className={[
                      "max-w-[180px] truncate text-sm font-semibold",
                      isDark ? "text-slate-100" : "text-slate-900",
                    ].join(" ")}
                  >
                    {displayName}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className={[
                  "inline-flex items-center rounded-2xl border px-4 py-2.5 text-xs font-semibold transition",
                  isDark
                    ? "border-white/10 bg-white/5 text-slate-200 hover:border-red-400/20 hover:bg-red-400/10 hover:text-red-100"
                    : "border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_14px_28px_-20px_rgba(15,23,42,0.18)] hover:border-red-300 hover:bg-red-50 hover:text-red-700",
                ].join(" ")}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </button>
            </>
          ) : (
            <div
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                isDark
                  ? "border-white/10 bg-white/5 text-slate-300"
                  : "border-slate-200/80 bg-white/75 text-slate-600",
              ].join(" ")}
            >
              Modo visualizacao
            </div>
          )}
        </div>
      </div>

      {user && needsAttention ? (
        <div
          className={[
            "border-t",
            isDark
              ? "border-amber-400/20 bg-amber-400/10"
              : "border-amber-300/60 bg-amber-50",
          ].join(" ")}
        >
          <div
            className={[
              "mx-auto max-w-[1600px] px-4 py-2 text-sm sm:px-6 lg:px-8",
              isDark ? "text-amber-100" : "text-amber-700",
            ].join(" ")}
          >
            {isPastDue
              ? "Pagamento pendente. A cobranca Pix fica bloqueada ate a regularizacao."
              : "Assinatura inativa. Escolha um plano para liberar cobrancas Pix."}
          </div>
        </div>
      ) : null}
    </div>
  );
}
