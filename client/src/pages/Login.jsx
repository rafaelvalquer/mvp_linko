//src/pages/Login.jsx
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthContext.jsx";

export default function Login() {
  const { user, signIn, refreshBilling, refreshWorkspace } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const nav = useNavigate();
  const loc = useLocation();
  const nextParam = new URLSearchParams(loc.search).get("next");

  if (user) return <Navigate to="/dashboard" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn({ email, password });

      // ✅ Atualiza contexto (workspace + billing) antes de decidir o redirect
      let billing = null;
      try {
        if (typeof refreshWorkspace === "function") await refreshWorkspace();
      } catch {}
      try {
        if (typeof refreshBilling === "function")
          billing = await refreshBilling();
      } catch {}

      // tenta extrair status de qualquer formato comum
      const statusRaw =
        billing?.subscription?.status ||
        billing?.subscriptionStatus ||
        billing?.status ||
        "";

      const status = String(statusRaw).toLowerCase();

      // Stripe: active/trialing contam como "ok"
      const hasActiveSub = status === "active" || status === "trialing";

      const fallback = hasActiveSub ? "/dashboard" : "/billing/plans";

      // se vier next explícito (ex: usuário tentou acessar /billing/plans), respeita
      nav(nextParam || fallback, { replace: true });
    } catch (err) {
      setError(err?.message || "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Entrar</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Acesse sua conta para continuar.
        </p>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="text-sm text-zinc-700">Email</label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-300"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="text-sm text-zinc-700">Senha</label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-300"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800 disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-4 text-sm text-zinc-600">
          Não tem conta?{" "}
          <Link className="text-zinc-900 underline" to="/register">
            Criar conta
          </Link>
        </div>
      </div>
    </div>
  );
}
