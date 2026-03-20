import { Activity, AlertTriangle, Building2, Eye, MessageSquareText, RefreshCw, ShieldCheck } from "lucide-react";

import Button from "../appui/Button.jsx";
import Card, { CardBody, CardHeader } from "../appui/Card.jsx";
import Skeleton from "../appui/Skeleton.jsx";
import useThemeToggle from "../../app/useThemeToggle.js";

function fmtNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function fmtDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function EmptyStateBlock({ message }) {
  const { isDark } = useThemeToggle();
  return (
    <div
      className={`rounded-2xl border px-4 py-6 text-center text-sm ${
        isDark
          ? "border-white/10 bg-white/5 text-slate-400"
          : "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      {message}
    </div>
  );
}

function InlineErrorBlock({ message }) {
  const { isDark } = useThemeToggle();
  if (!message) return null;
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        isDark
          ? "border-red-400/20 bg-red-400/10 text-red-200"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {message}
    </div>
  );
}

function StatusPill({ tone = "inactive", children }) {
  const { isDark } = useThemeToggle();
  const palette = {
    healthy: isDark
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: isDark
      ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
      : "border-amber-200 bg-amber-50 text-amber-700",
    failed: isDark
      ? "border-red-400/20 bg-red-400/10 text-red-200"
      : "border-red-200 bg-red-50 text-red-700",
    inactive: isDark
      ? "border-white/10 bg-white/6 text-slate-300"
      : "border-slate-200 bg-slate-50 text-slate-600",
    queued: isDark
      ? "border-sky-400/20 bg-sky-400/10 text-sky-200"
      : "border-sky-200 bg-sky-50 text-sky-700",
  };
  const classes = palette[tone] || palette.inactive;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${classes}`}
    >
      {children}
    </span>
  );
}

function MiniMetric({ icon: Icon, title, value, subtitle, tone = "healthy" }) {
  const { isDark } = useThemeToggle();
  return (
    <div
      className={`rounded-[24px] border px-4 py-4 ${
        isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
            isDark ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <StatusPill tone={tone}>{title}</StatusPill>
      </div>
      <div
        className={`mt-4 text-2xl font-black tracking-tight ${
          isDark ? "text-white" : "text-slate-950"
        }`}
      >
        {value}
      </div>
      <div
        className={`mt-2 text-xs leading-5 ${
          isDark ? "text-slate-400" : "text-slate-500"
        }`}
      >
        {subtitle}
      </div>
    </div>
  );
}

function getCapabilityTone(capability) {
  if (!capability) return "inactive";
  if (capability.available === true) return "healthy";
  if (
    capability.code === "WHATSAPP_ENVIRONMENT_DISABLED" ||
    capability.code === "PLAN_NOT_ALLOWED"
  ) {
    return "warning";
  }
  return "failed";
}

export default function TenantDiagnosticsPanel({
  diagnosticWorkspaceId,
  workspaceOptions,
  tenantDiagnosticsState,
  tenantDiagnostics,
  diagnosticTab,
  onChangeTab,
  diagnosticFlash,
  onSelectWorkspace,
  onCopy,
  onRefresh,
  onOpenUsers,
  onOpenClients,
  onOpenOutbox,
  onOpenMessageLogs,
  onOpenDetail,
}) {
  const { isDark } = useThemeToggle();

  const diagnosticWorkspace = tenantDiagnostics?.workspace || null;
  const diagnosticOwner = tenantDiagnostics?.owner || null;
  const diagnosticPix = tenantDiagnostics?.pix || null;
  const diagnosticSettings = tenantDiagnostics?.settings || null;
  const notificationContext =
    tenantDiagnostics?.notificationContextResolved || null;
  const diagnosticAgent = tenantDiagnostics?.agentUsage || null;
  const diagnosticOutbox = tenantDiagnostics?.outboxSummary || null;
  const diagnosticMessageLogs = tenantDiagnostics?.messageLogSummary || null;
  const diagnosticOfferHealth = tenantDiagnostics?.offerHealth || null;
  const diagnosticErrors = tenantDiagnostics?.recentErrors || [];

  const tabs = [
    { key: "overview", label: "Visao geral" },
    { key: "channels", label: "Canais e configuracoes" },
    { key: "agent", label: "Agente" },
    { key: "logs", label: "Fila e logs" },
    { key: "errors", label: "Erros recentes" },
  ];

  const channelRows = [
    {
      label: "Ambiente de WhatsApp",
      tone:
        notificationContext?.environment?.whatsapp?.available === true
          ? "healthy"
          : "warning",
      value:
        notificationContext?.environment?.whatsapp?.available === true
          ? "Disponivel"
          : "Indisponivel",
      hint:
        notificationContext?.environment?.whatsapp?.reason ||
        "Ambiente apto para envio no momento.",
    },
    {
      label: "Chave mestre do WhatsApp",
      tone: notificationContext?.masterEnabled === true ? "healthy" : "failed",
      value: notificationContext?.masterEnabled === true ? "Ativa" : "Desligada",
      hint:
        notificationContext?.masterEnabled === true
          ? "Workspace com WhatsApp liberado para recursos operacionais."
          : "O toggle master do WhatsApp esta desligado neste workspace.",
    },
    {
      label: "Atualizacoes de pagamento",
      capability: notificationContext?.featureAvailability?.whatsappPaymentStatus,
    },
    {
      label: "Lembretes de pagamento",
      capability:
        notificationContext?.featureAvailability?.whatsappPaymentReminders,
    },
    {
      label: "Cancelamento de proposta",
      capability: notificationContext?.featureAvailability?.whatsappOfferCancelled,
    },
    {
      label: "Lembretes de agenda",
      capability:
        notificationContext?.featureAvailability?.whatsappBookingReminders,
    },
    {
      label: "Alteracoes de agenda",
      capability: notificationContext?.featureAvailability?.whatsappBookingChanges,
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Diagnostico do tenant"
        subtitle="Somente leitura, com acoes leves para abrir usuarios, clientes, outbox e logs no workspace certo."
        right={
          diagnosticWorkspaceId ? (
            <Button variant="secondary" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
              Atualizar diagnostico
            </Button>
          ) : null
        }
      />
      <CardBody className="space-y-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,420px)_1fr]">
          <select
            value={diagnosticWorkspaceId}
            onChange={(event) => onSelectWorkspace(event.target.value)}
            className={`w-full rounded-2xl border px-3.5 py-2.5 text-sm outline-none transition ${
              isDark
                ? "border-white/10 bg-white/6 text-slate-100"
                : "border-slate-200/80 bg-white text-slate-900 shadow-[0_14px_24px_-22px_rgba(15,23,42,0.2)]"
            }`}
          >
            <option value="">Selecione um workspace</option>
            {workspaceOptions.map((workspace) => (
              <option key={workspace._id} value={workspace._id}>
                {workspace.name} {workspace.slug ? `(/${workspace.slug})` : ""}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap items-center gap-2">
            {diagnosticWorkspaceId ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() =>
                    onCopy(
                      "Workspace ID",
                      diagnosticWorkspace?._id || diagnosticWorkspaceId,
                    )
                  }
                >
                  Copiar workspaceId
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onCopy("Slug", diagnosticWorkspace?.slug || "")}
                >
                  Copiar slug
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    onCopy("Email do owner", diagnosticOwner?.email || "")
                  }
                >
                  Copiar owner
                </Button>
              </>
            ) : (
              <div
                className={`text-sm ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Escolha um workspace para abrir o diagnostico consolidado.
              </div>
            )}
          </div>
        </div>

        {diagnosticFlash ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              isDark
                ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
                : "border-cyan-200 bg-cyan-50 text-cyan-700"
            }`}
          >
            {diagnosticFlash}
          </div>
        ) : null}

        <InlineErrorBlock message={tenantDiagnosticsState.error} />

        {!diagnosticWorkspaceId ? (
          <EmptyStateBlock message="Selecione um workspace para carregar o painel de diagnostico." />
        ) : tenantDiagnosticsState.loading && !tenantDiagnostics ? (
          <Skeleton className="h-[420px] rounded-[28px]" />
        ) : !tenantDiagnostics ? (
          <EmptyStateBlock message="Nao foi possivel montar o diagnostico deste tenant." />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => {
                const active = diagnosticTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => onChangeTab(tab.key)}
                    className={`rounded-full border px-3.5 py-2 text-xs font-bold uppercase tracking-[0.16em] transition ${
                      active
                        ? isDark
                          ? "border-cyan-300/30 bg-cyan-400/15 text-cyan-100"
                          : "border-cyan-200 bg-cyan-50 text-cyan-700"
                        : isDark
                          ? "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {diagnosticTab === "overview" ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MiniMetric
                    icon={Building2}
                    title="Plano"
                    value={String(diagnosticWorkspace?.plan || "--").toUpperCase()}
                    subtitle={`Plan status ${diagnosticWorkspace?.planStatus || "--"} - assinatura ${diagnosticWorkspace?.subscription?.status || "inactive"}`}
                    tone="healthy"
                  />
                  <MiniMetric
                    icon={ShieldCheck}
                    title="Conta Pix"
                    value={diagnosticPix?.connected ? "Configurada" : "Pendente"}
                    subtitle={
                      diagnosticPix?.connected
                        ? `${diagnosticPix?.keyType || "PIX"} ${diagnosticPix?.keyMasked || ""}`
                        : "Workspace ainda sem dados completos da conta Pix."
                    }
                    tone={diagnosticPix?.connected ? "healthy" : "warning"}
                  />
                  <MiniMetric
                    icon={Activity}
                    title="Ultima atividade"
                    value={fmtDateTime(diagnosticWorkspace?.lastActivityAt)}
                    subtitle={`Criado em ${fmtDateTime(diagnosticWorkspace?.createdAt)}`}
                    tone={diagnosticWorkspace?.lastActivityAt ? "healthy" : "inactive"}
                  />
                  <MiniMetric
                    icon={MessageSquareText}
                    title="Timezone agenda"
                    value={diagnosticSettings?.agendaTimezone || "America/Sao_Paulo"}
                    subtitle={`Atualizado em ${fmtDateTime(diagnosticSettings?.updatedAt)}`}
                    tone="healthy"
                  />
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
                  <Card className="rounded-[24px]">
                    <CardHeader
                      title="Resumo do workspace"
                      subtitle="Owner, identificadores e saude leve de propostas."
                    />
                    <CardBody className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className={`rounded-2xl border px-4 py-4 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}>
                          <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            Workspace
                          </div>
                          <div className={`mt-3 text-lg font-black ${isDark ? "text-white" : "text-slate-950"}`}>
                            {diagnosticWorkspace?.name || "--"}
                          </div>
                          <div className={`mt-2 text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                            /{diagnosticWorkspace?.slug || "--"}
                          </div>
                          <div className={`mt-3 text-xs leading-6 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            Workspace ID: {diagnosticWorkspace?._id || "--"}
                          </div>
                        </div>
                        <div className={`rounded-2xl border px-4 py-4 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}>
                          <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            Owner principal
                          </div>
                          <div className={`mt-3 text-lg font-black ${isDark ? "text-white" : "text-slate-950"}`}>
                            {diagnosticOwner?.name || "Sem owner"}
                          </div>
                          <div className={`mt-2 text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                            {diagnosticOwner?.email || "--"}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <MiniMetric
                          icon={MessageSquareText}
                          title="Pendentes"
                          value={fmtNumber(diagnosticOfferHealth?.pendingPayment || 0)}
                          subtitle="Propostas aguardando pagamento."
                          tone="warning"
                        />
                        <MiniMetric
                          icon={Activity}
                          title="Aguardando confirmacao"
                          value={fmtNumber(diagnosticOfferHealth?.waitingConfirmation || 0)}
                          subtitle="Pagamentos enviados para confirmacao."
                          tone="inactive"
                        />
                        <MiniMetric
                          icon={AlertTriangle}
                          title="Canceladas"
                          value={fmtNumber(diagnosticOfferHealth?.cancelled || 0)}
                          subtitle="Historico terminal."
                          tone="failed"
                        />
                        <MiniMetric
                          icon={ShieldCheck}
                          title="Pagas"
                          value={fmtNumber(diagnosticOfferHealth?.paid || 0)}
                          subtitle="Propostas pagas."
                          tone="healthy"
                        />
                      </div>
                    </CardBody>
                  </Card>

                  <Card className="rounded-[24px]">
                    <CardHeader
                      title="Acoes leves"
                      subtitle="Aplica o filtro do workspace nas tabelas abaixo."
                    />
                    <CardBody className="space-y-3">
                      <Button variant="secondary" className="w-full justify-between" onClick={() => onOpenUsers(diagnosticWorkspace?._id)}>
                        Abrir usuarios filtrados
                      </Button>
                      <Button variant="secondary" className="w-full justify-between" onClick={() => onOpenClients(diagnosticWorkspace?._id)}>
                        Abrir clientes filtrados
                      </Button>
                      <Button variant="secondary" className="w-full justify-between" onClick={() => onOpenOutbox(diagnosticWorkspace?._id)}>
                        Abrir Outbox filtrado
                      </Button>
                      <Button variant="secondary" className="w-full justify-between" onClick={() => onOpenMessageLogs(diagnosticWorkspace?._id)}>
                        Abrir Message Logs filtrado
                      </Button>
                    </CardBody>
                  </Card>
                </div>
              </div>
            ) : null}

            {diagnosticTab === "channels" ? (
              <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <Card className="rounded-[24px]">
                  <CardHeader
                    title="Canais e configuracoes resolvidas"
                    subtitle="Leitura final do que esta habilitado por ambiente, plano e toggle."
                  />
                  <CardBody className="space-y-3">
                    {channelRows.map((row) => {
                      const capability = row.capability;
                      const tone = capability ? getCapabilityTone(capability) : row.tone || "inactive";
                      const value = capability ? (capability.available === true ? "Disponivel" : "Bloqueado") : row.value;
                      const hint = capability ? capability.reason || "Recurso disponivel para este tenant." : row.hint;
                      return (
                        <div key={row.label} className={`rounded-2xl border px-4 py-4 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-950"}`}>
                                {row.label}
                              </div>
                              <div className={`mt-1 text-xs leading-5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                {hint}
                              </div>
                            </div>
                            <StatusPill tone={tone}>{value}</StatusPill>
                          </div>
                        </div>
                      );
                    })}
                  </CardBody>
                </Card>

                <Card className="rounded-[24px]">
                  <CardHeader title="Contexto do tenant" subtitle="Resumo rapido para suporte sem abrir o banco." />
                  <CardBody className="space-y-4">
                    <div className={`rounded-2xl border px-4 py-4 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}>
                      <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        Assinatura Stripe
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusPill tone="healthy">{diagnosticWorkspace?.subscription?.status || "inactive"}</StatusPill>
                        <StatusPill tone="inactive">{diagnosticWorkspace?.planStatus || "inactive"}</StatusPill>
                      </div>
                    </div>
                    <div className={`rounded-2xl border px-4 py-4 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}>
                      <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        Conta Pix
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <StatusPill tone={diagnosticPix?.connected ? "healthy" : "warning"}>
                          {diagnosticPix?.connected ? "Configurada" : "Pendente"}
                        </StatusPill>
                        <span className={isDark ? "text-slate-200" : "text-slate-700"}>
                          {diagnosticPix?.keyType || "--"} {diagnosticPix?.keyMasked || ""}
                        </span>
                      </div>
                    </div>
                    <div className={`rounded-2xl border px-4 py-4 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}>
                      <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        Timezone da agenda
                      </div>
                      <div className={`mt-3 text-lg font-black ${isDark ? "text-white" : "text-slate-950"}`}>
                        {diagnosticSettings?.agendaTimezone || "America/Sao_Paulo"}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            ) : null}

            {diagnosticTab === "agent" ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MiniMetric
                    icon={Activity}
                    title="Sessoes"
                    value={fmtNumber(diagnosticAgent?.totalSessions || 0)}
                    subtitle={`Ultimos ${tenantDiagnostics?.windowDays || 7} dias`}
                    tone="healthy"
                  />
                  <MiniMetric
                    icon={ShieldCheck}
                    title="Concluidas"
                    value={fmtNumber(diagnosticAgent?.completedSessions || 0)}
                    subtitle="Fluxos finalizados sem erro."
                    tone="healthy"
                  />
                  <MiniMetric
                    icon={AlertTriangle}
                    title="Erro"
                    value={fmtNumber(diagnosticAgent?.errorSessions || 0)}
                    subtitle="Sessoes com falha recente."
                    tone={Number(diagnosticAgent?.errorSessions || 0) > 0 ? "warning" : "healthy"}
                  />
                  <MiniMetric
                    icon={MessageSquareText}
                    title="Canceladas/expiradas"
                    value={fmtNumber(diagnosticAgent?.cancelledOrExpiredSessions || 0)}
                    subtitle="Fluxos encerrados sem conclusao."
                    tone="inactive"
                  />
                </div>

                <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                  <Card className="rounded-[24px]">
                    <CardHeader title="Fluxos mais usados" subtitle="Top flow types do agente neste tenant." />
                    <CardBody className="space-y-3">
                      {diagnosticAgent?.flowCounts?.length ? (
                        diagnosticAgent.flowCounts.map((row) => (
                          <div key={row.key} className={`rounded-2xl border px-4 py-3 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}>
                            <div className="flex items-center justify-between gap-3">
                              <div className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-950"}`}>{row.key}</div>
                              <div className={`text-lg font-black ${isDark ? "text-white" : "text-slate-950"}`}>{fmtNumber(row.count || 0)}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyStateBlock message="Sem uso recente do agente neste workspace." />
                      )}
                    </CardBody>
                  </Card>

                  <Card className="rounded-[24px]">
                    <CardHeader title="Ultimos erros do agente" subtitle="Fluxo, estado e payload bruto para diagnostico." />
                    <CardBody className="space-y-3">
                      {diagnosticAgent?.recentErrors?.length ? (
                        diagnosticAgent.recentErrors.map((item) => (
                          <div key={item._id} className={`rounded-2xl border px-4 py-4 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}>
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-2">
                                  <StatusPill tone="failed">{item.state || "ERROR"}</StatusPill>
                                  <StatusPill tone="warning">{item.flowType || "flow"}</StatusPill>
                                </div>
                                <div className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-950"}`}>
                                  {item.error?.message || "Sessao do agente com erro."}
                                </div>
                                <div className={`text-xs leading-5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                  {item.requesterPhoneDigits || "--"} - {fmtDateTime(item.updatedAt)}
                                </div>
                              </div>
                              <Button variant="secondary" onClick={() => onOpenDetail(`Sessao ${item._id}`, item.error?.message || `Fluxo ${item.flowType || "--"} em ${item.state || "--"}`, item.payload)}>
                                <Eye className="h-4 w-4" />
                                Ver payload
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyStateBlock message="Nenhum erro recente do agente para este tenant." />
                      )}
                    </CardBody>
                  </Card>
                </div>
              </div>
            ) : null}

            {diagnosticTab === "logs" ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MiniMetric icon={MessageSquareText} title="Outbox queued" value={fmtNumber(diagnosticOutbox?.currentStatusCounts?.queued || 0)} subtitle="Itens aguardando processamento." tone="queued" />
                  <MiniMetric icon={AlertTriangle} title="Outbox failed" value={fmtNumber(diagnosticOutbox?.currentStatusCounts?.failed || 0)} subtitle={`Falhas recentes: ${fmtNumber(diagnosticOutbox?.failures?.length || 0)}`} tone={Number(diagnosticOutbox?.currentStatusCounts?.failed || 0) > 0 ? "warning" : "healthy"} />
                  <MiniMetric icon={Activity} title="Logs sent" value={fmtNumber(diagnosticMessageLogs?.recentStatusCounts?.SENT || 0)} subtitle={`Ultimos ${tenantDiagnostics?.windowDays || 7} dias`} tone="healthy" />
                  <MiniMetric icon={AlertTriangle} title="Logs failed" value={fmtNumber(diagnosticMessageLogs?.recentStatusCounts?.FAILED || 0)} subtitle={`Ultimos ${tenantDiagnostics?.windowDays || 7} dias`} tone={Number(diagnosticMessageLogs?.recentStatusCounts?.FAILED || 0) > 0 ? "warning" : "healthy"} />
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <Card className="rounded-[24px]">
                    <CardHeader title="Outbox do tenant" subtitle="Falhas recentes e ultimas mensagens enviadas." right={<Button variant="secondary" onClick={() => onOpenOutbox(diagnosticWorkspace?._id)}>Abrir Outbox filtrado</Button>} />
                    <CardBody className="space-y-3">
                      {(diagnosticOutbox?.failures || []).concat(diagnosticOutbox?.recentMessages || []).slice(0, 6).map((item) => (
                        <div key={item._id} className={`rounded-2xl border px-4 py-4 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}>
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                <StatusPill tone={item.status === "failed" ? "warning" : "healthy"}>{item.status}</StatusPill>
                                <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{item.sourceType || "--"}</span>
                              </div>
                              <div className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-950"}`}>{item.error?.message || item.messagePreview || "--"}</div>
                              <div className={`text-xs leading-5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>{item.to || "--"} - {fmtDateTime(item.sentAt || item.updatedAt)}</div>
                            </div>
                            <Button variant="secondary" onClick={() => onOpenDetail(`Outbox ${item._id}`, item.error?.message || `Status ${item.status}`, item.payload, { message: item.payload?.message })}>
                              <Eye className="h-4 w-4" />
                              Ver
                            </Button>
                          </div>
                        </div>
                      ))}
                      {!((diagnosticOutbox?.failures || []).length || (diagnosticOutbox?.recentMessages || []).length) ? (
                        <EmptyStateBlock message="Sem itens recentes de outbox para este tenant." />
                      ) : null}
                    </CardBody>
                  </Card>

                  <Card className="rounded-[24px]">
                    <CardHeader title="Message logs do tenant" subtitle="Falhas recentes de envio e historico de mensagens." right={<Button variant="secondary" onClick={() => onOpenMessageLogs(diagnosticWorkspace?._id)}>Abrir Message Logs filtrado</Button>} />
                    <CardBody className="space-y-3">
                      {(diagnosticMessageLogs?.failures || []).concat(diagnosticMessageLogs?.recentMessages || []).slice(0, 6).map((item) => (
                        <div key={item._id} className={`rounded-2xl border px-4 py-4 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}>
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                <StatusPill tone={item.status === "FAILED" ? "warning" : "healthy"}>{item.status}</StatusPill>
                                <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{item.eventType || "--"}</span>
                              </div>
                              <div className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-950"}`}>{item.error?.message || item.messagePreview || "--"}</div>
                              <div className={`text-xs leading-5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>{item.to || "--"} - {fmtDateTime(item.sentAt || item.updatedAt)}</div>
                            </div>
                            <Button variant="secondary" onClick={() => onOpenDetail(`Message log ${item._id}`, item.error?.message || `Status ${item.status}`, item.payload, { message: item.payload?.message })}>
                              <Eye className="h-4 w-4" />
                              Ver
                            </Button>
                          </div>
                        </div>
                      ))}
                      {!((diagnosticMessageLogs?.failures || []).length || (diagnosticMessageLogs?.recentMessages || []).length) ? (
                        <EmptyStateBlock message="Sem itens recentes de message logs para este tenant." />
                      ) : null}
                    </CardBody>
                  </Card>
                </div>
              </div>
            ) : null}

            {diagnosticTab === "errors" ? (
              <Card className="rounded-[24px]">
                <CardHeader title="Erros recentes unificados" subtitle="Consolidacao de falhas do agente, outbox, message logs e lembretes." />
                <CardBody className="space-y-3">
                  {diagnosticErrors.length ? (
                    diagnosticErrors.map((item) => (
                      <div key={item._id} className={`rounded-2xl border px-4 py-4 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}>
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              <StatusPill tone="warning">{item.sourceLabel || item.origin}</StatusPill>
                              <StatusPill tone="failed">{item.code || "ERRO"}</StatusPill>
                            </div>
                            <div className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-950"}`}>{item.message || item.summary || "Falha operacional."}</div>
                            <div className={`text-xs leading-5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>{item.summary || "--"} - {fmtDateTime(item.occurredAt)}</div>
                          </div>
                          <Button variant="secondary" onClick={() => onOpenDetail(`${item.sourceLabel || item.origin} ${item.code || ""}`.trim(), item.message || item.summary || "Falha operacional.", item.payload, { message: item.payload?.message || item.payload?.lastError?.message || item.payload?.error?.message || "" })}>
                            <Eye className="h-4 w-4" />
                            Ver payload
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyStateBlock message="Nenhuma falha recente encontrada neste tenant." />
                  )}
                </CardBody>
              </Card>
            ) : null}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
