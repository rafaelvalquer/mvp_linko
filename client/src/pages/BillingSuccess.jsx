// src/pages/BillingSuccess.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "../app/api.js";
import { useAuth } from "../app/AuthContext.jsx";
import brandLogo from "../assets/brand.png";

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function PhasePill({ phase }) {
  const toneMap = {
    confirming: "border-sky-200 bg-sky-50 text-sky-700",
    waiting: "border-amber-200 bg-amber-50 text-amber-700",
    done: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  const labelMap = {
    confirming: "Validando checkout",
    waiting: "Ativando assinatura",
    done: "Assinatura ativa",
  };

  return (
    <span
      className={cls(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]",
        toneMap[phase] || toneMap.confirming,
      )}
    >
      {labelMap[phase] || labelMap.confirming}
    </span>
  );
}

function InfoTile({ label, value, hint, tone = "slate" }) {
  const toneMap = {
    slate: "border-slate-200/80 bg-white/90",
    emerald: "border-emerald-200 bg-emerald-50",
    sky: "border-sky-200 bg-sky-50",
  };

  return (
    <div className={cls("rounded-[24px] border p-4", toneMap[tone] || toneMap.slate)}>
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-lg font-black tracking-[-0.03em] text-slate-950">
        {value}
      </div>
      {hint ? <div className="mt-2 text-xs leading-5 text-slate-600">{hint}</div> : null}
    </div>
  );
}

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

  const phaseCopy = {
    confirming: {
      title: "Estamos confirmando sua assinatura.",
      description:
        "Recebemos o checkout e estamos validando os dados para liberar seu ambiente com seguranca.",
    },
    waiting: {
      title: "Pagamento reconhecido. Falta a ativacao final.",
      description:
        "Sua cobranca ja entrou no fluxo de confirmacao. A assinatura pode levar alguns segundos para ficar ativa.",
    },
    done: {
      title: "Assinatura ativa com sucesso.",
      description:
        "Seu workspace esta sendo atualizado agora. Em instantes voce segue para o dashboard.",
    },
  }[phase];

  const subscriptionStatus =
    String(status?.subscription?.status || "")
      .trim()
      .toUpperCase() || "EM ANALISE";

  const planLabel = String(status?.plan || "").trim() || "Plano selecionado";

  const steps = [
    {
      label: "Checkout recebido",
      description: "Seu pagamento foi associado ao workspace.",
      done: !!status,
    },
    {
      label: "Assinatura validada",
      description: "Sincronizamos o status com a assinatura da conta.",
      done: phase === "done",
    },
    {
      label: "Ambiente liberado",
      description: "Atualizamos plano, modulos e limites do workspace.",
      done: phase === "done",
    },
  ];

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
              Plano: <b>{status.plan || "—"}</b>
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
