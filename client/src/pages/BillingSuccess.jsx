// src/pages/BillingSuccess.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../app/api.js";
import { useAuth } from "../app/AuthContext.jsx";

export default function BillingSuccess() {
  const [sp] = useSearchParams();
  const sessionId = sp.get("session_id") || "";
  const nav = useNavigate();
  const { refreshWorkspace, refreshBilling } = useAuth();

  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("confirming"); // confirming | waiting | done

  const canPoll = useMemo(() => !!sessionId, [sessionId]);

  useEffect(() => {
    if (!canPoll) return;

    let alive = true;
    let attempt = 0;
    let timer = null;

    async function step() {
      attempt += 1;
      setError("");

      try {
        // 1) confirma/valida ownership + tenta sincronizar do Stripe (fallback)
        const conf = await api(
          `/billing/stripe/confirm?session_id=${encodeURIComponent(sessionId)}`,
        );

        if (!alive) return;

        setStatus(conf);

        const subStatus = String(
          conf?.subscription?.status || "",
        ).toLowerCase();
        if (subStatus === "active") {
          setPhase("done");

          // atualiza context
          await refreshWorkspace();
          await refreshBilling();

          nav("/dashboard", { replace: true });
          return;
        }

        setPhase("waiting");
      } catch (e) {
        if (!alive) return;
        setError(
          e?.data?.error || e?.message || "Falha ao confirmar checkout.",
        );
      }

      // backoff: 800ms -> 1500ms -> 2500ms -> 3500ms (cap)
      const delay = Math.min(3500, 800 + attempt * 700);
      timer = setTimeout(step, delay);
    }

    step();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [canPoll, sessionId, nav, refreshWorkspace, refreshBilling]);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-xl font-semibold text-zinc-900">
          Pagamento confirmado
        </div>
        <div className="mt-2 text-sm text-zinc-600">
          {phase === "confirming"
            ? "Confirmando checkout e validando assinatura..."
            : phase === "waiting"
              ? "Aguardando ativação da assinatura (webhook pode levar alguns segundos)..."
              : "Assinatura ativa. Redirecionando..."}
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
