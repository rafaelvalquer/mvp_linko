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

function AuthShell({ children }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#fafafa_0%,#f4f4f5_45%,#f8fafc_100%)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-80px] top-[-80px] h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute right-[-100px] top-1/3 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-[-120px] left-1/3 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.7),transparent_35%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/70 bg-white/70 shadow-[0_25px_80px_rgba(15,23,42,0.12)] backdrop-blur xl:grid-cols-[0.9fr_1.1fr]">
          <div className="hidden border-r border-zinc-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(244,244,245,0.8))] p-10 xl:flex xl:flex-col xl:justify-center">
            <span className="inline-flex w-fit items-center rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-600">
              Luminor Platform
            </span>

            <div className="mt-8 max-w-md">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Login
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950">
                Entre na sua conta.
              </h1>
              <p className="mt-4 text-base leading-7 text-zinc-600">
                Acesse sua plataforma para continuar seu fluxo com segurança.
              </p>
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

function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.10)] backdrop-blur sm:p-8">
      <div className="mb-6">
        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          Acesso à conta
        </span>
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
  disabled,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-800">
        {label}
      </label>
      <input
        className={[
          "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[15px] text-zinc-950 shadow-[0_1px_2px_rgba(24,24,27,0.04)] outline-none transition",
          "placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-4 focus:ring-zinc-200/60",
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
    </div>
  );
}

function SubmitButton({ loading }) {
  return (
    <button
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3.5 text-sm font-medium text-white shadow-[0_16px_40px_rgba(24,24,27,0.18)] transition hover:-translate-y-0.5 hover:bg-zinc-800 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={loading}
      type="submit"
    >
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
          Entrando...
        </>
      ) : (
        "Entrar"
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
    <AuthShell>
      <AuthCard
        title="Entrar"
        subtitle="Acesse sua conta para continuar sua experiência na plataforma."
        footer={
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600">
            Não tem conta?{" "}
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
            Entre para acessar seu workspace e continuar o fluxo da plataforma.
          </div>

          <SubmitButton loading={loading} />
        </form>
      </AuthCard>
    </AuthShell>
  );
}
