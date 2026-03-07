//src/pages/Login.jsx
import { useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthContext.jsx";

function safeNextPath(value, fallback = null) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  return raw;
}

function AuthShell({ children, eyebrow, title, subtitle }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.10),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.10),_transparent_30%),linear-gradient(180deg,#fafafa_0%,#f4f4f5_100%)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-80px] top-[-80px] h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-120px] h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute left-1/2 top-24 h-40 w-40 -translate-x-1/2 rounded-full bg-white/50 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-white/70 bg-white/70 shadow-[0_30px_80px_rgba(24,24,27,0.10)] backdrop-blur xl:grid-cols-[1.1fr_0.9fr]">
          <div className="relative hidden border-r border-zinc-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,244,245,0.78))] p-10 xl:flex xl:flex-col xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-xs font-medium tracking-[0.18em] text-zinc-600 uppercase shadow-sm">
                Luminor Platform
              </div>

              <div className="mt-10 max-w-xl">
                <div className="text-sm font-semibold tracking-[0.22em] text-zinc-500 uppercase">
                  {eyebrow}
                </div>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950">
                  {title}
                </h1>
                <p className="mt-5 max-w-lg text-base leading-7 text-zinc-600">
                  {subtitle}
                </p>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                <FeatureCard
                  title="Experiência profissional"
                  text="Fluxo claro, autenticação confiável e visual com acabamento premium."
                />
                <FeatureCard
                  title="Ambiente SaaS moderno"
                  text="Interface consistente para continuar no dashboard ou concluir seu plano."
                />
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200/80 bg-white/80 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-zinc-500">
                    Plataforma
                  </div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                    Login seguro e rápido
                  </div>
                </div>
                <div className="rounded-2xl bg-zinc-950 px-3 py-2 text-sm font-medium text-white shadow-lg shadow-zinc-950/15">
                  SaaS
                </div>
              </div>
              <div className="mt-4 h-px bg-zinc-200" />
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill>Autenticação</Pill>
                <Pill>Billing</Pill>
                <Pill>Workspace</Pill>
                <Pill>Stripe</Pill>
              </div>
            </div>
          </div>

          <div className="flex min-h-[720px] items-center justify-center p-4 sm:p-6 lg:p-10">
            <div className="w-full max-w-md">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, text }) {
  return (
    <div className="rounded-3xl border border-zinc-200/80 bg-white/75 p-5 shadow-sm">
      <div className="text-sm font-semibold text-zinc-900">{title}</div>
      <div className="mt-2 text-sm leading-6 text-zinc-600">{text}</div>
    </div>
  );
}

function Pill({ children }) {
  return (
    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
      {children}
    </span>
  );
}

function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_20px_60px_rgba(24,24,27,0.10)] backdrop-blur sm:p-8">
      <div className="mb-6">
        <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          Acesso à plataforma
        </div>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">{subtitle}</p>
      </div>

      {children}

      {footer ? <div className="mt-6">{footer}</div> : null}
    </div>
  );
}

function Alert({ children }) {
  if (!children) return null;

  return (
    <div className="mb-5 rounded-2xl border border-red-200 bg-[linear-gradient(180deg,#fff1f2_0%,#fff5f5_100%)] px-4 py-3 text-sm text-red-700 shadow-sm">
      <div className="flex gap-3">
        <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-red-100 text-[11px] font-bold text-red-700">
          !
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
  error,
  disabled,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-800">
        {label}
      </label>
      <input
        className={[
          "w-full rounded-2xl border bg-white px-4 py-3 text-[15px] text-zinc-950 outline-none transition placeholder:text-zinc-400",
          "shadow-[0_1px_2px_rgba(24,24,27,0.04)]",
          error
            ? "border-red-300 ring-4 ring-red-100/70"
            : "border-zinc-200 focus:border-zinc-300 focus:ring-4 focus:ring-zinc-200/60",
          disabled ? "cursor-not-allowed opacity-70" : "",
        ].join(" ")}
        value={value}
        onChange={onChange}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
        required
      />
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function Button({ children, loading, disabled, type = "button" }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3.5 text-sm font-medium text-white shadow-[0_16px_40px_rgba(24,24,27,0.18)] transition hover:-translate-y-0.5 hover:bg-zinc-800 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
          Entrando...
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export default function Login() {
  const { user, signIn, refreshBilling, refreshWorkspace } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const nav = useNavigate();
  const loc = useLocation();

  const nextParam = useMemo(
    () => safeNextPath(new URLSearchParams(loc.search).get("next")),
    [loc.search],
  );

  if (user) return <Navigate to="/dashboard" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
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

  return (
    <AuthShell
      eyebrow="Acesso seguro"
      title="Entre na sua plataforma com uma experiência mais profissional."
      subtitle="Faça login para continuar seu fluxo, acessar seu workspace e seguir para o dashboard ou para a ativação do plano, mantendo a mesma autenticação já integrada à aplicação."
    >
      <AuthCard
        title="Entrar"
        subtitle="Acesse sua conta para continuar sua operação com segurança e consistência visual de uma plataforma SaaS premium."
        footer={
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600">
            Ainda não tem conta?{" "}
            <Link
              className="font-medium text-zinc-950 underline underline-offset-4 transition hover:text-zinc-700"
              to="/register"
            >
              Criar conta
            </Link>
          </div>
        }
      >
        <Alert>{error}</Alert>

        <form className="space-y-4" onSubmit={onSubmit}>
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="voce@empresa.com"
            disabled={loading}
          />

          <Field
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Digite sua senha"
            disabled={loading}
          />

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-500">
            Use suas credenciais para acessar o workspace e continuar o fluxo da
            plataforma com autenticação segura.
          </div>

          <Button type="submit" loading={loading}>
            Entrar
          </Button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
