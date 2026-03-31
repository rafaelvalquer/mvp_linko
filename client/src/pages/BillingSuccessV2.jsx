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

export default function BillingSuccessV2() {
  const [sp] = useSearchParams();
  const sessionId = sp.get("session_id") || "";
  const nav = useNavigate();
  const { refreshWorkspace, refreshBilling } = useAuth();

  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("confirming");

  const canPoll = useMemo(() => !!sessionId, [sessionId]);

  useEffect(() => {
    if (!canPoll) return undefined;

    let alive = true;
    let attempt = 0;
    let timer = null;

    async function step() {
      attempt += 1;
      setError("");

      try {
        const conf = await api(
          `/billing/stripe/confirm?session_id=${encodeURIComponent(sessionId)}`,
        );

        if (!alive) return;

        setStatus(conf);

        const subStatus = String(conf?.subscription?.status || "").toLowerCase();
        if (subStatus === "active") {
          setPhase("done");

          await refreshWorkspace();
          await refreshBilling();

          nav("/dashboard", { replace: true });
          return;
        }

        setPhase("waiting");
      } catch (e) {
        if (!alive) return;
        setError(e?.data?.error || e?.message || "Falha ao confirmar checkout.");
      }

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_34%),linear-gradient(180deg,#eff6ff,#f8fafc_46%,#ecfeff)] px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-center pt-2">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/80 bg-[linear-gradient(135deg,#2563eb,#14b8a6)] shadow-[0_20px_40px_-24px_rgba(37,99,235,0.5)]">
              <img
                src={brandLogo}
                alt="LuminorPay"
                className="h-8 w-8 rounded-xl object-contain"
                draggable="false"
              />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-sky-700">
                Assinatura
              </div>
              <div className="text-lg font-black tracking-tight text-slate-950">
                LuminorPay
              </div>
            </div>
          </Link>
        </div>

        <section className="relative overflow-hidden rounded-[34px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,245,249,0.95),rgba(236,253,245,0.96))] p-5 shadow-[0_36px_100px_-56px_rgba(15,23,42,0.34)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.14),transparent_28%)]" />
          <div className="relative space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl space-y-3">
                <PhasePill phase={phase} />
                <div className="space-y-2">
                  <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                    {phaseCopy.title}
                  </h1>
                  <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                    {phaseCopy.description}
                  </p>
                </div>
              </div>

              <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-emerald-50 text-emerald-700">
                {phase === "done" ? (
                  <CheckCircle2 className="h-8 w-8" />
                ) : phase === "waiting" ? (
                  <Clock3 className="h-8 w-8" />
                ) : (
                  <Sparkles className="h-8 w-8" />
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <InfoTile
                label="Plano"
                value={planLabel}
                hint="Plano confirmado a partir deste checkout."
                tone="sky"
              />
              <InfoTile
                label="Status"
                value={subscriptionStatus}
                hint={
                  phase === "done"
                    ? "Assinatura pronta para uso."
                    : "Atualizando status da assinatura."
                }
                tone={phase === "done" ? "emerald" : "slate"}
              />
              <InfoTile
                label="Sessao"
                value={sessionId ? "Checkout validado" : "Sem session_id"}
                hint={
                  sessionId
                    ? "Esta sessao foi reconhecida com seguranca."
                    : "Se necessario, volte ao dashboard e tente novamente."
                }
              />
            </div>

            {error ? (
              <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-4 text-sm leading-6 text-red-700">
                {error}
              </div>
            ) : null}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <section className="rounded-[30px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_28px_70px_-50px_rgba(15,23,42,0.2)] sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-black tracking-[-0.03em] text-slate-950">
                  O que acontece agora
                </div>
                <div className="mt-1 text-sm leading-6 text-slate-600">
                  Mantivemos esta etapa transparente para voce acompanhar a confirmacao da assinatura sem duvida.
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {steps.map((step) => (
                <div
                  key={step.label}
                  className={cls(
                    "rounded-[24px] border p-4",
                    step.done
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-slate-200/80 bg-slate-50",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cls(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl",
                        step.done
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-white text-slate-400",
                      )}
                    >
                      {step.done ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Clock3 className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {step.label}
                      </div>
                      <div className="mt-1 text-sm leading-6 text-slate-600">
                        {step.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-[30px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_28px_70px_-50px_rgba(15,23,42,0.2)] sm:p-6">
            <div className="text-lg font-black tracking-[-0.03em] text-slate-950">
              Proximos passos
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              Se preferir nao esperar o redirecionamento automatico, voce pode seguir manualmente.
            </div>

            <div className="mt-5 space-y-3">
              <Link
                to="/dashboard"
                className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#2563eb,#14b8a6)] px-4 py-3 text-sm font-bold text-white shadow-[0_20px_40px_-22px_rgba(37,99,235,0.45)] transition hover:-translate-y-0.5"
              >
                Ir para o dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                to="/billing/plans"
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Revisar planos
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
