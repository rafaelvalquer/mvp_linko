// src/pages/Register.jsx
import { useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthContext.jsx";
import { getPlanLabel } from "../utils/planQuota.js";

export default function Register() {
  const { user, signUp } = useAuth();

  const [name, setName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [plan, setPlan] = useState("start");
  const [enterpriseLimit, setEnterpriseLimit] = useState(200);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const nav = useNavigate();
  const loc = useLocation();
  const next = new URLSearchParams(loc.search).get("next") || "/dashboard";

  const isEnterprise = plan === "enterprise";

  const planHint = useMemo(() => {
    if (plan === "start") return "20 Pix/mês";
    if (plan === "pro") return "50 Pix/mês";
    if (plan === "business") return "120 Pix/mês";
    if (plan === "enterprise") return "Cota configurável";
    return "";
  }, [plan]);

  if (user) return <Navigate to={next} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        name,
        email,
        password,
        workspaceName: workspaceName || undefined,
        plan,
      };

      if (isEnterprise) {
        const v = Number(enterpriseLimit);
        if (!Number.isFinite(v) || v <= 0) {
          setError("Informe um limite válido para Enterprise (maior que 0).");
          setLoading(false);
          return;
        }
        payload.pixMonthlyLimit = Math.round(v);
      }

      await signUp(payload);
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
              <option value="start">Start — 20 Pix/mês</option>
              <option value="pro">Pro — 50 Pix/mês</option>
              <option value="business">Business — 120 Pix/mês</option>
              <option value="enterprise">Enterprise — cota configurável</option>
            </select>

            <div className="mt-1 text-xs text-zinc-500">
              Plano selecionado:{" "}
              <span className="font-semibold">{getPlanLabel(plan)}</span> •{" "}
              {planHint}
            </div>
          </div>

          {isEnterprise ? (
            <div>
              <label className="text-sm text-zinc-700">
                Limite mensal (Enterprise)
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-300"
                value={enterpriseLimit}
                onChange={(e) => setEnterpriseLimit(e.target.value)}
                type="number"
                min={1}
                step={1}
                required
              />
              <div className="mt-1 text-xs text-zinc-500">
                Defina a cota mensal de Pix para este workspace.
              </div>
            </div>
          ) : null}

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
