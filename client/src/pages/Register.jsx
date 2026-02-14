//src/pages/Register.jsx

import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthContext.jsx";

export default function Register() {
  const { user, signUp } = useAuth();
  const [name, setName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [plan, setPlan] = useState("free"); // ✅ novo: plano escolhido
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const nav = useNavigate();
  const loc = useLocation();
  const next = new URLSearchParams(loc.search).get("next") || "/";

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signUp({
        name,
        email,
        password,
        workspaceName: workspaceName || undefined,
        plan, // ✅ envia free|premium para o backend
      });
      nav(next, { replace: true });
    } catch (err) {
      setError(err?.message || "Falha ao cadastrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Criar conta</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Cadastre-se para começar a criar ofertas.
        </p>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="text-sm text-zinc-700">Nome</label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-300"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm text-zinc-700">
              Nome do workspace (opcional)
            </label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-300"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Ex.: Minha Empresa"
            />
          </div>
          <div>
            <label className="text-sm text-zinc-700">Plano</label>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-300 bg-white"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
            >
              <option value="free">Free (acesso básico)</option>
              <option value="premium">Premium (acesso completo)</option>
            </select>
            <div className="mt-1 text-xs text-zinc-500">
              Você poderá alterar o plano depois nas configurações.
            </div>
          </div>
          <div>
            <label className="text-sm text-zinc-700">Email</label>
            <input
              className="mt-1 w-full_toggle w-full rounded-lg border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-300"
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
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>
          <button
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800 disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? "Criando..." : "Criar conta"}
          </button>
        </form>

        <div className="mt-4 text-sm text-zinc-600">
          Já tem conta?{" "}
          <Link
            className="text-zinc-900 underline"
            to={`/login?next=${encodeURIComponent(next)}`}
          >
            Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}
