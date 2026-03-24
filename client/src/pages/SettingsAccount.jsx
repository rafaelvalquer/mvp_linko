import { ArrowRight, BookOpenText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Badge from "../components/appui/Badge.jsx";
import Button from "../components/appui/Button.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import MyWhatsAppPanel from "../components/account/MyWhatsAppPanel.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import SettingsLayout from "../components/settings/SettingsLayout.jsx";
import { useAuth } from "../app/AuthContext.jsx";
import { useMyWhatsAppConfig } from "../components/account/useMyWhatsAppConfig.js";

export default function SettingsAccount() {
  const navigate = useNavigate();
  const { loadingMe, agentPlanAllowed } = useMyWhatsAppConfig();
  const { perms } = useAuth();

  if (loadingMe) {
    return (
      <SettingsLayout
        activeTab="account"
        title="Conta"
        subtitle="Gerencie seus dados pessoais e o numero usado para liberar comandos por WhatsApp."
      >
        <Skeleton className="h-36 rounded-[28px]" />
        <Skeleton className="h-72 rounded-[28px]" />
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout
      activeTab="account"
      title="Conta"
      subtitle="Defina o numero que identifica voce nos comandos enviados pelo WhatsApp."
    >
      <Card>
        <CardHeader
          title="Guia do agente"
          subtitle="Explore exemplos, casos de uso e limites operacionais do agente do WhatsApp sem sair de Configuracoes."
        />
        <CardBody className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-100">
                    <BookOpenText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-950 dark:text-white">
                      Tudo o que o agente ja consegue fazer hoje
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      O guia reune proposta, agenda, cobranca e operacoes de
                      cadastro, com exemplos prontos para copiar no WhatsApp.
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone={agentPlanAllowed ? "PAID" : "ACCEPTED"}>
                    {agentPlanAllowed ? "Uso liberado" : "Bloqueado pelo plano"}
                  </Badge>
                  <Badge tone="PUBLIC">Pro+</Badge>
                  <Badge tone="DRAFT">Guia visivel para todos</Badge>
                </div>

                <div className="mt-4 text-xs leading-6 text-slate-500 dark:text-slate-400">
                  {agentPlanAllowed
                    ? "Seu plano atual ja pode usar o agente. O guia ajuda a acelerar o onboarding e evitar duvidas no primeiro uso."
                    : "Mesmo no plano Start, voce pode abrir o guia para entender o fluxo e os casos de uso antes do upgrade."}
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate("/settings/account/agent-guide")}
              >
                Ver guia do agente
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
      <MyWhatsAppPanel />

      {perms?.isWorkspaceTeamPlan === true && perms?.isWorkspaceOwner !== true ? (
        <Card>
          <CardHeader
            title="Uso em equipe"
            subtitle="Seu numero pessoal segue as configuracoes do dono do workspace para avisos internos."
            right={<Badge tone="PUBLIC">Equipe</Badge>}
          />
          <CardBody className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            O dono do workspace continua controlando quais avisos ficam ativos
            para a operacao. Quando esses avisos estiverem liberados, voce
            recebe apenas os eventos da sua propria carteira.
          </CardBody>
        </Card>
      ) : null}
    </SettingsLayout>
  );
}
