import { Check, CreditCard, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../app/api.js";
import { useAuth } from "../app/AuthContext.jsx";
import Badge from "../components/appui/Badge.jsx";
import Button from "../components/appui/Button.jsx";
import Card, { CardBody } from "../components/appui/Card.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Shell from "../components/layout/Shell.jsx";

const PLANS = [
  {
    key: "start",
    title: "Start",
    eyebrow: "Essencial",
    badge: "Base organizada",
    price: "R$ 35,90",
    description:
      "Para parar de improvisar e operar com proposta, Pix e agenda no mesmo fluxo.",
    features: [
      "Propostas e orçamentos",
      "Link público sem login",
      "Pix com QR Code",
      "Status de pagamento",
      "Agenda básica",
    ],
  },
  {
    key: "pro",
    title: "Pro",
    eyebrow: "Profissional",
    badge: "Mais escolhido",
    price: "R$ 99,90",
    featured: true,
    description:
      "Mais automação, velocidade e visibilidade comercial para quem já vende toda semana.",
    features: [
      "Tudo do Start",
      "Clientes e produtos",
      "Dashboard avançado",
      "Agente no WhatsApp",
      "Automações pessoais",
      "Cobranças recorrentes",
    ],
  },
  {
    key: "business",
    title: "Business",
    eyebrow: "Equipe",
    badge: "Equipe e governança",
    price: "R$ 279,90",
    description:
      "Para escalar a operação com multiusuário, visão consolidada e controle por carteira.",
    features: [
      "Tudo do Pro",
      "Multiusuário no workspace",
      "Perfis e permissões",
      "Visão Minha carteira e Equipe",
      "Relatórios por usuário",
      "Operação coordenada",
    ],
  },
];

const ENTERPRISE_CONTACT_URL =
  "https://wa.me/5511925957940?text=Ola%2C%20quero%20falar%20sobre%20o%20plano%20Enterprise%20da%20LuminorPay.";

function PlanCard({ plan, currentPlan, loadingPlan, onSubscribe }) {
  const isCurrent = currentPlan === plan.key;

  return (
    <Card
      variant={plan.featured ? "elevated" : "default"}
      className={`overflow-hidden ${plan.featured ? "ring-1 ring-sky-200/80 dark:ring-sky-400/20" : ""}`}
    >
      <CardBody className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-200">
              {plan.eyebrow}
            </div>
            <div className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">
              {plan.title}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={plan.featured ? "PUBLIC" : "NEUTRAL"}>{plan.badge}</Badge>
            {isCurrent ? <Badge tone="PAID">Plano atual</Badge> : null}
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/5">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Investimento mensal
          </div>
          <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">
            {plan.price}
          </div>
          <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {plan.description}
          </div>
        </div>

        <div className="space-y-3">
          {plan.features.map((feature) => (
            <div
              key={feature}
              className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                <Check className="h-3.5 w-3.5" />
              </span>
              <span>{feature}</span>
            </div>
          ))}
        </div>

        <Button
          className="w-full"
          disabled={Boolean(loadingPlan) || isCurrent}
          onClick={() => onSubscribe(plan.key)}
          variant={plan.featured ? "primary" : "secondary"}
        >
          {loadingPlan === plan.key
            ? "Redirecionando..."
            : isCurrent
              ? "Plano atual"
              : `Assinar ${plan.title}`}
        </Button>

        <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
          Cobrança recorrente por cartão via Stripe Checkout.
        </div>
      </CardBody>
    </Card>
  );
}

export default function BillingPlansV2() {
  const [loadingPlan, setLoadingPlan] = useState("");
  const [error, setError] = useState("");
  const { workspace } = useAuth();

  const currentPlan = useMemo(
    () => String(workspace?.plan || "").trim().toLowerCase(),
    [workspace?.plan],
  );

  async function subscribe(plan) {
    setError("");
    setLoadingPlan(plan);
    try {
      const data = await api("/billing/stripe/checkout-session", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });

      if (data?.url) window.location.href = data.url;
      else setError("Checkout não retornou URL.");
    } catch (e) {
      setError(e?.data?.error || e?.message || "Falha ao iniciar assinatura.");
    } finally {
      setLoadingPlan("");
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <PageHeader
          eyebrow="Assinatura"
          title="Planos da LuminorPay"
          subtitle="Escolha a estrutura ideal para o momento da sua operação e evolua sem trocar de ferramenta."
          actions={
            <Link to="/dashboard">
              <Button variant="secondary">Voltar ao painel</Button>
            </Link>
          }
        />

        {error ? (
          <div className="surface-quiet rounded-2xl border border-rose-200/80 p-4 text-sm text-rose-700 dark:border-rose-400/20 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        <Card variant="elevated">
          <CardBody className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">
                <Sparkles className="h-3.5 w-3.5" />
                Gestão comercial + cobrança no mesmo fluxo
              </div>
              <div className="mt-4 text-2xl font-black tracking-[-0.04em] text-slate-950 dark:text-white sm:text-[2rem]">
                Assinatura pensada para crescer junto com a maturidade da operação.
              </div>
              <div className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                A base do produto continua a mesma: proposta, Pix, agenda,
                relacionamento e relatórios. O que muda entre os planos é a
                profundidade da operação, o nível de automação e a capacidade
                de trabalhar em equipe.
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="app-kpi-card">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Assinatura
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                  <CreditCard className="h-4 w-4 text-sky-600 dark:text-sky-300" />
                  Stripe Checkout
                </div>
              </div>
              <div className="app-kpi-card">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Gestão
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                  Renovação automática
                </div>
              </div>
              <div className="app-kpi-card">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Plano atual
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                  {currentPlan ? currentPlan.toUpperCase() : "SEM PLANO"}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="grid gap-5 xl:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              currentPlan={currentPlan}
              loadingPlan={loadingPlan}
              onSubscribe={subscribe}
            />
          ))}
        </div>

        <Card variant="quiet">
          <CardBody className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Enterprise
              </div>
              <div className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">
                Para operações maiores, rollout acompanhado e contratação consultiva.
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Mantém a base multiusuário do Business e adiciona implantação,
                adaptação operacional e condições comerciais sob medida.
              </div>
            </div>

            <a href={ENTERPRISE_CONTACT_URL} target="_blank" rel="noreferrer">
              <Button>Falar sobre Enterprise</Button>
            </a>
          </CardBody>
        </Card>
      </div>
    </Shell>
  );
}
