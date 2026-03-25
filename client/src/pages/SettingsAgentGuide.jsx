import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  Check,
  Copy,
  FileText,
  Lock,
  Package,
  Wallet,
} from "lucide-react";

import { useAuth } from "../app/AuthContext.jsx";
import Badge from "../components/appui/Badge.jsx";
import Button from "../components/appui/Button.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import SettingsLayout from "../components/settings/SettingsLayout.jsx";
import {
  AGENT_BEST_PRACTICES,
  AGENT_CAPABILITIES,
  AGENT_FAQ,
  AGENT_PREREQUISITES,
} from "../content/agentGuideContent.js";
import { canUseWhatsAppAiOfferCreation } from "../utils/planFeatures.js";

const ICONS = {
  offers: FileText,
  agenda: CalendarClock,
  billing: Wallet,
  backoffice: Package,
};

async function copyText(value) {
  const text = String(value || "");
  if (!text) return;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === "undefined") return;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function flattenExamples(groups) {
  return groups.flatMap((group) =>
    group.examples.map((example, index) => ({
      id: `${group.id}:${index}`,
      category: group.title,
      chips: group.chips || [],
      example,
    })),
  );
}

export default function SettingsAgentGuide() {
  const navigate = useNavigate();
  const copyResetRef = useRef(null);
  const { workspace, perms, user } = useAuth();
  const [copiedId, setCopiedId] = useState("");

  const currentPlan = String(
    perms?.plan || workspace?.plan || user?.workspace?.plan || "start",
  )
    .trim()
    .toLowerCase();
  const planAllowed = canUseWhatsAppAiOfferCreation(currentPlan);
  const flattenedExamples = useMemo(
    () => flattenExamples(AGENT_CAPABILITIES),
    [],
  );

  async function handleCopy(exampleId, text) {
    try {
      await copyText(text);
      setCopiedId(exampleId);
      window.clearTimeout(copyResetRef.current);
      copyResetRef.current = window.setTimeout(() => setCopiedId(""), 1800);
    } catch (error) {
      console.warn("[agent-guide] failed to copy example", error);
    }
  }

  return (
    <SettingsLayout
      activeTab="account"
      title="Guia da Lumina"
      subtitle="Veja o que a Lumina no site e o agente do WhatsApp conseguem fazer hoje, com exemplos reais de uso e limites do fluxo."
      actions={
        <Button type="button" variant="secondary" onClick={() => navigate("/settings/account")}>
          <ArrowLeft className="h-4 w-4" />
          Voltar para Conta
        </Button>
      }
    >
      <Card>
        <CardBody className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-100">
                <Bot className="h-4 w-4" />
                Lumina + WhatsApp
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                O que o agente faz
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                A Lumina conversa com voce aqui no site com um tom mais humano,
                enquanto o agente do WhatsApp continua disponivel no canal
                atual. Os dois usam o mesmo motor operacional do workspace e
                ainda pedem confirmacao quando a acao vai gerar impacto real em
                proposta, cobranca, agenda ou cadastro.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge tone={planAllowed ? "PAID" : "ACCEPTED"}>
                {planAllowed ? "Disponivel no seu plano" : "Bloqueado pelo plano"}
              </Badge>
              <Badge tone="PUBLIC">Pro+</Badge>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-[24px] border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="text-sm font-semibold text-slate-950 dark:text-white">
                Pre-requisitos para usar no dia a dia
              </div>
              <div className="mt-4 grid gap-3">
                {AGENT_PREREQUISITES.map((item) => (
                  <div
                    key={item.title}
                    className="surface-subtle rounded-2xl p-4"
                  >
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {item.title}
                    </div>
                    <div className="surface-subtle-copy mt-1 text-xs leading-5">
                      {item.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={[
                "rounded-[24px] border p-4",
                planAllowed
                  ? "border-emerald-200 bg-emerald-50/90 dark:border-emerald-400/20 dark:bg-emerald-400/10"
                  : "border-amber-200 bg-amber-50/90 dark:border-amber-400/20 dark:bg-amber-400/10",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <div
                  className={[
                    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
                    planAllowed
                      ? "border-emerald-200 bg-white/80 text-emerald-700 dark:border-emerald-400/20 dark:bg-white/10 dark:text-emerald-100"
                      : "border-amber-200 bg-white/80 text-amber-700 dark:border-amber-400/20 dark:bg-white/10 dark:text-amber-100",
                  ].join(" ")}
                >
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-950 dark:text-white">
                    Disponibilidade por plano
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                    {planAllowed
                      ? "Seu plano atual pode usar o agente para proposta, agenda, cobranca e operacoes de backoffice."
                      : "No plano Start, o guia continua disponivel para consulta, mas a execucao do agente fica bloqueada ate o upgrade para Pro, Business ou Enterprise."}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge tone={planAllowed ? "PAID" : "ACCEPTED"}>
                      {planAllowed ? "Uso liberado" : "Uso bloqueado"}
                    </Badge>
                    <Badge tone="PUBLIC">Pro, Business e Enterprise</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="O que voce pode pedir"
          subtitle="As capacidades abaixo refletem o que o agente ja consegue executar hoje no produto."
        />
        <CardBody className="grid gap-4 md:grid-cols-2">
          {AGENT_CAPABILITIES.map((group) => {
            const Icon = ICONS[group.id] || Bot;

            return (
              <div
                key={group.id}
                className="rounded-[24px] border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-start gap-3">
                  <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-black tracking-tight text-slate-950 dark:text-white">
                      {group.title}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {group.description}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {group.chips.map((chip) => (
                    <Badge key={`${group.id}:${chip}`} tone={chip === "Pro+" ? "PUBLIC" : "DRAFT"}>
                      {chip}
                    </Badge>
                  ))}
                </div>

                <div className="mt-4 space-y-2">
                  {group.notes.map((note) => (
                    <div
                      key={`${group.id}:${note}`}
                      className="surface-subtle rounded-2xl px-3 py-3 text-sm leading-6 text-slate-600 dark:text-slate-300"
                    >
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Exemplos prontos para copiar"
          subtitle="Use estes prompts como atalho. O agente entende frases naturais, mas exemplos objetivos costumam resolver mais rapido."
        />
        <CardBody className="grid gap-4 lg:grid-cols-2">
          {flattenedExamples.map((item) => (
            <div
              key={item.id}
              className="rounded-[24px] border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="PUBLIC">{item.category}</Badge>
                {item.chips.slice(0, 2).map((chip) => (
                  <Badge key={`${item.id}:${chip}`} tone="DRAFT">
                    {chip}
                  </Badge>
                ))}
              </div>

              <div className="surface-subtle mt-4 rounded-2xl px-4 py-3 text-sm font-medium leading-6 text-slate-900 dark:text-slate-100">
                {item.example}
              </div>

              <div className="mt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleCopy(item.id, item.example)}
                >
                  {copiedId === item.id ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar exemplo
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Card>
          <CardHeader
            title="FAQ"
            subtitle="Respostas curtas para as duvidas mais comuns antes de usar o agente no dia a dia."
          />
          <CardBody className="space-y-3">
            {AGENT_FAQ.map((item) => (
              <div
                key={item.question}
                className="rounded-[24px] border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5"
              >
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  {item.question}
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {item.answer}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Boas praticas"
            subtitle="Pequenos cuidados que melhoram a precisao e evitam idas e vindas no chat."
          />
          <CardBody className="space-y-3">
            {AGENT_BEST_PRACTICES.map((item) => (
              <div
                key={item}
                className="rounded-[24px] border border-slate-200/80 bg-white/80 p-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              >
                {item}
              </div>
            ))}

            <div className="rounded-[24px] border border-sky-100 bg-sky-50/90 p-4 text-sm leading-6 text-slate-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-slate-200">
              Se o agente ficar em duvida entre duas operacoes, ele pergunta o
              que voce quer fazer antes de continuar. Nesses casos, responder de
              forma objetiva acelera bastante o fluxo.
            </div>
          </CardBody>
        </Card>
      </div>
    </SettingsLayout>
  );
}
