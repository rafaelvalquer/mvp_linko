// src/pages/BillingSuccess.jsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api } from "../app/api.js";

export default function BillingSuccess() {
  const [sp] = useSearchParams();
  const sessionId = sp.get("session_id") || "";
  const nav = useNavigate();

  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // Para MVP: basta ler status (webhook pode demorar alguns segundos)
        const s = await api("/billing/stripe/status");
        if (!alive) return;
        setStatus(s);
        // segue para dashboard
        setTimeout(() => nav("/dashboard", { replace: true }), 800);
      } catch (e) {
        if (!alive) return;
        setError(e?.data?.error || e?.message || "Falha ao confirmar status.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [nav, sessionId]);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-xl font-semibold text-zinc-900">
          Pagamento confirmado
        </div>
        <div className="mt-2 text-sm text-zinc-600">
          Atualizando assinatura e cota do seu workspace...
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {status?.subscription ? (
          <div className="mt-4 rounded-xl border bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            <div>
              Status: <b>{status.subscription.status}</b>
            </div>
            <div className="mt-1">
              Pix restantes: <b>{status.pixRemaining}</b> /{" "}
              {status.pixMonthlyLimit}
            </div>
          </div>
        ) : null}

        <div className="mt-5 text-sm">
          <Link className="text-zinc-900 underline" to="/dashboard">
            Ir para o Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
