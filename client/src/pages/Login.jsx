import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { useAuth } from "../app/AuthContext.jsx";
import ForgotPasswordModal from "../components/auth/ForgotPasswordModal.jsx";
import brandLogo from "../assets/brand.png";

function safeNextPath(value, fallback = null) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  return raw;
}

function AuthBrand() {
  return (
    <Link to="/" className="inline-flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[linear-gradient(135deg,#2563eb,#14b8a6)] shadow-[0_18px_40px_-20px_rgba(37,99,235,0.7)]">
        <img
          src={brandLogo}
          alt="LuminorPay"
          className="h-8 w-8 rounded-xl object-contain"
          draggable="false"
        />
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
          Vendas e Pix
        </div>
        <div className="text-lg font-black tracking-tight text-white">
          LuminorPay
        </div>
      </div>
    </Link>
  );
}

function AuthShell({ children }) {
  const highlights = [
    "Entre pelo celular e acompanhe propostas, pagamentos e agenda sem complicacao.",
    "Veja o que foi enviado, pago e confirmado em um so lugar.",
    "Continue seu atendimento com mais organizacao e menos mensagem solta.",
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[rgb(5,10,24)] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-120px] top-[-120px] h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute right-[-120px] top-1/4 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-[-180px] left-1/3 h-[28rem] w-[28rem] rounded-full bg-emerald-400/12 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,10,24,0.92),rgba(8,15,30,0.88))]" />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px)",
            backgroundSize: "52px 52px",
            maskImage:
              "radial-gradient(72% 58% at 50% 28%, black 0%, transparent 72%)",
            WebkitMaskImage:
              "radial-gradient(72% 58% at 50% 28%, black 0%, transparent 72%)",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-[32px] border border-white/10 bg-[rgba(10,18,36,0.72)] shadow-[0_28px_80px_-40px_rgba(15,23,42,0.9)] backdrop-blur-2xl lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="hidden border-r border-white/10 bg-[linear-gradient(180deg,rgba(8,15,30,0.9),rgba(10,18,36,0.72))] p-10 lg:flex lg:flex-col lg:justify-between">
            <div>
              <AuthBrand />

              <div className="mt-12 max-w-md">
                <div className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
                  Entrar
                </div>
                <h1 className="mt-4 text-4xl font-black tracking-tight text-white">
                  Acesse sua conta e continue suas vendas.
                </h1>
                <p className="mt-5 text-base leading-7 text-slate-300">
                  Entre para acompanhar propostas, pagamentos e agenda com uma
                  tela simples, clara e pronta para o dia a dia do seu negocio.
                </p>
              </div>

              <div className="mt-10 space-y-3">
                {highlights.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-slate-200"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-teal-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-[26px] border border-cyan-400/15 bg-cyan-400/10 p-5">
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">
                  Acesso rapido
                </div>
                <div className="mt-3 text-3xl font-black">1 toque</div>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Interface pensada para abrir bem no celular e no computador.
                </p>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                  Seguranca
                </div>
                <div className="mt-3 flex items-center gap-2 text-lg font-bold text-white">
                  <ShieldCheck className="h-5 w-5 text-emerald-300" />
                  Conta protegida
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Entre e siga seu fluxo com seguranca e confirmacoes claras.
                </p>
              </div>
            </div>
          </aside>

          <div className="flex min-h-[100svh] items-center justify-center p-4 sm:p-6 lg:min-h-[760px] lg:p-10">
            <div className="w-full max-w-md">
              <div className="mb-6 lg:hidden">
                <AuthBrand />
                <div className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
                    Entrar
                  </div>
                  <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
                    Continue suas vendas de onde parou.
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Acesse sua conta para acompanhar propostas, Pix e agenda com
                    conforto no celular.
                  </p>
                </div>
              </div>

              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-5 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.45)] sm:p-8">
      <div className="mb-6">
        <span className="inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700">
          Acesso a conta
        </span>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
      </div>

      {children}

      {footer ? <div className="mt-6">{footer}</div> : null}
    </div>
  );
}

function Alert({ children }) {
  if (!children) return null;

  return (
    <div className="mb-5 rounded-2xl border border-red-200 bg-[linear-gradient(180deg,#fff1f2_0%,#fff7f7_100%)] px-4 py-3 text-sm text-red-700">
      <div className="flex gap-3">
        <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-red-100 text-[11px] font-bold text-red-700">
          !
        </span>
        <div className="leading-6">{children}</div>
      </div>
    </div>
  );
}

function SuccessAlert({ children }) {
  if (!children) return null;

  return (
    <div className="mb-5 rounded-2xl border border-emerald-200 bg-[linear-gradient(180deg,#ecfdf5_0%,#f0fdf4_100%)] px-4 py-3 text-sm text-emerald-700">
      <div className="flex gap-3">
        <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">
          ok
        </span>
        <div className="leading-6">{children}</div>
      </div>
    </div>
  );
}
function Field({
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  placeholder,
  disabled,
  icon: Icon,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-800">
        {label}
      </label>
      <div className="flex min-h-[54px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-[0_4px_18px_-14px_rgba(15,23,42,0.25)] transition focus-within:border-sky-300 focus-within:ring-4 focus-within:ring-sky-100">
        {Icon ? <Icon className="h-5 w-5 flex-none text-slate-400" /> : null}
        <input
          className="w-full bg-transparent py-3 text-[15px] text-slate-950 outline-none placeholder:text-slate-400"
          value={value}
          onChange={onChange}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          required
        />
      </div>
    </div>
  );
}

function SubmitButton({ loading }) {
  return (
    <button
      className="inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#2563eb,#14b8a6)] px-4 py-3.5 text-sm font-bold text-white shadow-[0_20px_40px_-20px_rgba(37,99,235,0.55)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={loading}
      type="submit"
    >
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
          Entrando...
        </>
      ) : (
        <>
          Entrar
          <ArrowRight className="h-4 w-4" />
        </>
      )}
    </button>
  );
}

export default function Login() {
  const { user, signIn, refreshBilling, refreshWorkspace } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  const nav = useNavigate();
  const loc = useLocation();

  const nextParam = useMemo(
    () => safeNextPath(new URLSearchParams(loc.search).get("next")),
    [loc.search],
  );

  useEffect(() => {
    if (!successMessage) return undefined;

    const timer = window.setTimeout(() => {
      setSuccessMessage("");
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [successMessage]);

  if (user) return <Navigate to="/dashboard" replace />;

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      await signIn({ email, password });

      let billing = null;

      try {
        if (typeof refreshWorkspace === "function") {
          await refreshWorkspace();
        }
      } catch {}

      try {
        if (typeof refreshBilling === "function") {
          billing = await refreshBilling();
        }
      } catch {}

      const statusRaw =
        billing?.subscription?.status ||
        billing?.subscriptionStatus ||
        billing?.status ||
        "";

      const status = String(statusRaw).toLowerCase();
      const hasActiveSub = status === "active" || status === "trialing";
      const fallback = hasActiveSub ? "/dashboard" : "/billing/plans";

      nav(nextParam || fallback, { replace: true });
    } catch (err) {
      setError(err?.message || "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  function handleForgotPasswordSuccess(message) {
    setError("");
    setSuccessMessage(message || "Senha redefinida com sucesso.");
    setPassword("");
  }

  return (
    <>
      <AuthShell>
        <AuthCard
          title="Entrar"
          subtitle="Acesse sua conta para acompanhar atendimentos, pagamentos e o andamento das suas propostas."
          footer={
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Nao tem conta?{" "}
              <Link
                className="font-semibold text-slate-950 underline underline-offset-4 transition hover:text-slate-700"
                to="/register"
              >
                Criar conta
              </Link>
            </div>
          }
        >
          <Alert>{error}</Alert>
          <SuccessAlert>{successMessage}</SuccessAlert>

          <form className="space-y-4" onSubmit={onSubmit}>
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={(event) => {
                setError("");
                setSuccessMessage("");
                setEmail(event.target.value);
              }}
              autoComplete="email"
              placeholder="voce@empresa.com"
              disabled={loading}
              icon={Mail}
            />

            <div>
              <Field
                label="Senha"
                type="password"
                value={password}
                onChange={(event) => {
                  setError("");
                  setSuccessMessage("");
                  setPassword(event.target.value);
                }}
                autoComplete="current-password"
                placeholder="Digite sua senha"
                disabled={loading}
                icon={LockKeyhole}
              />

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="text-sm font-semibold text-slate-600 underline underline-offset-4 transition hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    setError("");
                    setSuccessMessage("");
                    setIsForgotPasswordOpen(true);
                  }}
                  disabled={loading}
                >
                  Esqueceu a senha?
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm leading-6 text-slate-600">
              Entre para acessar seu workspace e continuar o fluxo de propostas,
              Pix e agenda do seu negocio.
            </div>

            <SubmitButton loading={loading} />
          </form>
        </AuthCard>
      </AuthShell>

      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        initialEmail={email}
        onClose={() => setIsForgotPasswordOpen(false)}
        onSuccess={handleForgotPasswordSuccess}
      />
    </>
  );
}
