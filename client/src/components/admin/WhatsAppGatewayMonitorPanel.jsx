import { useMemo, useState } from "react";
import {
  Clock3,
  Eye,
  MessageSquareText,
  RefreshCw,
  Server,
  Smartphone,
} from "lucide-react";

import Button from "../appui/Button.jsx";
import Card, { CardBody, CardHeader } from "../appui/Card.jsx";
import Skeleton from "../appui/Skeleton.jsx";
import { Input } from "../appui/Input.jsx";
import useThemeToggle from "../../app/useThemeToggle.js";

function fmtDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function fmtNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function fmtDuration(ms) {
  const totalMs = Number(ms || 0);
  if (!totalMs || totalMs < 1000) return "--";

  const totalMinutes = Math.floor(totalMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
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

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${
        palette[tone] || palette.inactive
      }`}
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

function stateTone(state, { available = true, forwardDegraded = false } = {}) {
  const normalized = String(state || "").trim().toUpperCase();
  if (!available) return "failed";
  if (forwardDegraded || normalized === "FORWARD_DEGRADED") return "warning";
  if (normalized === "READY") return "healthy";
  if (normalized === "QR" || normalized === "STARTING" || normalized === "INIT") {
    return "warning";
  }
  if (normalized === "AUTH_FAILURE" || normalized === "CHROME_MISSING") {
    return "failed";
  }
  if (normalized === "DISCONNECTED") return "failed";
  return "inactive";
}

function stateLabel(state) {
  const normalized = String(state || "").trim().toUpperCase();
  const labels = {
    READY: "Ready",
    QR: "Aguardando QR",
    INIT: "Inicializando",
    STARTING: "Iniciando",
    DISCONNECTED: "Desconectado",
    FORWARD_DEGRADED: "Forward degradado",
    AUTH_FAILURE: "Falha de autenticacao",
    CHROME_MISSING: "Chrome ausente",
  };
  return labels[normalized] || (state || "--");
}

function buildEventSummary(item) {
  const parts = [
    item?.reason,
    item?.route,
    item?.to,
    item?.from,
    item?.chatId,
    item?.providerMessageId,
    item?.messageId,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (!parts.length) return "Sem contexto adicional neste evento.";
  return parts.join(" • ");
}

export default function WhatsAppGatewayMonitorPanel({
  monitorState,
  monitor,
  onRefresh,
  onOpenDetail,
}) {
  const { isDark } = useThemeToggle();
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");

  const gatewayStatus = monitor?.gatewayStatus || null;
  const availability = monitor?.gatewayAvailability || {
    configured: false,
    available: false,
    status: "not_configured",
  };
  const recentEvents = Array.isArray(monitor?.recentEvents) ? monitor.recentEvents : [];

  const eventOptions = useMemo(() => {
    return Array.from(
      new Set(recentEvents.map((item) => String(item?.event || "").trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));
  }, [recentEvents]);

  const levelOptions = useMemo(() => {
    return Array.from(
      new Set(recentEvents.map((item) => String(item?.level || "").trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));
  }, [recentEvents]);

  const filteredEvents = useMemo(() => {
    const searchNormalized = String(search || "").trim().toLowerCase();

    return recentEvents.filter((item) => {
      if (levelFilter && String(item?.level || "") !== levelFilter) return false;
      if (eventFilter && String(item?.event || "") !== eventFilter) return false;
      if (!searchNormalized) return true;

      const haystack = JSON.stringify(item || {}).toLowerCase();
      return haystack.includes(searchNormalized);
    });
  }, [eventFilter, levelFilter, recentEvents, search]);

  const forwardTone = gatewayStatus?.forwardDegraded === true ? "warning" : "healthy";
  const watchdogTone = gatewayStatus?.lastWatchdogError ? "warning" : "healthy";
  const availabilityTone = availability.available ? "healthy" : "failed";
  const gatewayStateTone = stateTone(gatewayStatus?.state, {
    available: availability.available,
    forwardDegraded: gatewayStatus?.forwardDegraded === true,
  });

  const statusRows = [
    {
      label: "Disponibilidade",
      value: availability.available ? "Acessivel" : "Indisponivel",
      hint: availability.available
        ? "Backend conseguiu consultar o wa-gateway."
        : monitor?.error?.message || "Backend nao conseguiu consultar o gateway.",
      tone: availabilityTone,
    },
    {
      label: "Estado atual",
      value: stateLabel(gatewayStatus?.state),
      hint: gatewayStatus?.ready
        ? "Sessao pronta para trafegar mensagens."
        : "Gateway acessivel, mas sem sessao pronta no momento.",
      tone: gatewayStateTone,
    },
    {
      label: "Sessao do WhatsApp",
      value: stateLabel(gatewayStatus?.waSessionState),
      hint: gatewayStatus?.phone
        ? `Numero conectado ${gatewayStatus.phone}.`
        : "Nenhum numero conectado no momento.",
      tone: stateTone(gatewayStatus?.waSessionState, {
        available: availability.available,
      }),
    },
    {
      label: "Forward interno",
      value: gatewayStatus?.forwardDegraded ? "Degradado" : "Saudavel",
      hint:
        gatewayStatus?.lastForwardError ||
        "Sem erro recente ao encaminhar inbound para o backend.",
      tone: forwardTone,
    },
    {
      label: "Watchdog",
      value: gatewayStatus?.watchdogEnabled ? "Ativo" : "Desligado",
      hint: gatewayStatus?.lastWatchdogError
        ? `${gatewayStatus.lastWatchdogError} • ultimo check ${fmtDateTime(gatewayStatus.lastWatchdogAt)}`
        : `Ultimo check ${fmtDateTime(gatewayStatus?.lastWatchdogAt)}`,
      tone: watchdogTone,
    },
    {
      label: "Digitacao inbound",
      value: gatewayStatus?.typingEnabled ? "Ativa" : "Desligada",
      hint: gatewayStatus?.typingEnabled
        ? `Heartbeat de ${fmtNumber(gatewayStatus?.typingHeartbeatMs || 0)} ms.`
        : "Indicador de digitacao nao esta habilitado.",
      tone: gatewayStatus?.typingEnabled ? "healthy" : "inactive",
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="rounded-[24px]">
        <CardHeader
          title="Gateway do WhatsApp"
          subtitle="Monitoramento global do transporte, sessao e eventos recentes do wa-gateway."
          right={
            <Button variant="secondary" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
              Atualizar gateway
            </Button>
          }
        />
        <CardBody className="space-y-4">
          <InlineErrorBlock message={monitorState.error} />

          {monitorState.loading && !monitor ? (
            <Skeleton className="h-[420px] rounded-[28px]" />
          ) : !monitor ? (
            <EmptyStateBlock message="Nao foi possivel carregar o monitor do gateway." />
          ) : (
            <div className="space-y-4">
              {!availability.available ? (
                <div
                  className={`rounded-2xl border px-4 py-4 text-sm ${
                    isDark
                      ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  <div className="font-semibold">
                    Gateway indisponivel para leitura no momento.
                  </div>
                  <div className="mt-1 leading-6">
                    {monitor?.error?.message ||
                      "O backend nao conseguiu consultar o wa-gateway."}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MiniMetric
                  icon={Server}
                  title="Estado"
                  value={stateLabel(gatewayStatus?.state)}
                  subtitle={gatewayStatus?.forwardDegraded ? "Forward degradado." : "Estado global do gateway."}
                  tone={gatewayStateTone}
                />
                <MiniMetric
                  icon={Smartphone}
                  title="Sessao"
                  value={stateLabel(gatewayStatus?.waSessionState)}
                  subtitle={gatewayStatus?.phone || "Sem numero conectado."}
                  tone={stateTone(gatewayStatus?.waSessionState, {
                    available: availability.available,
                  })}
                />
                <MiniMetric
                  icon={Clock3}
                  title="Uptime"
                  value={fmtDuration(gatewayStatus?.uptimeMs)}
                  subtitle={`Ultimo ACK ${fmtDateTime(gatewayStatus?.lastAckAt)}`}
                  tone={availabilityTone}
                />
                <MiniMetric
                  icon={MessageSquareText}
                  title="Eventos"
                  value={fmtNumber(recentEvents.length)}
                  subtitle={`Dedupe ${fmtNumber(gatewayStatus?.recentInboundMessageCount || 0)} • Inflight ${fmtNumber(gatewayStatus?.inflightInboundCount || 0)}`}
                  tone="healthy"
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <Card className="rounded-[24px]">
                  <CardHeader
                    title="Status do gateway"
                    subtitle="Leitura consolidada do transporte e da sessao atual."
                  />
                  <CardBody className="space-y-3">
                    {statusRows.map((row) => (
                      <div
                        key={row.label}
                        className={`rounded-2xl border px-4 py-4 ${
                          isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div
                              className={`text-sm font-semibold ${
                                isDark ? "text-white" : "text-slate-950"
                              }`}
                            >
                              {row.label}
                            </div>
                            <div
                              className={`mt-1 text-xs leading-5 ${
                                isDark ? "text-slate-400" : "text-slate-500"
                              }`}
                            >
                              {row.hint}
                            </div>
                          </div>
                          <StatusPill tone={row.tone}>{row.value}</StatusPill>
                        </div>
                      </div>
                    ))}
                  </CardBody>
                </Card>

                <Card className="rounded-[24px]">
                  <CardHeader
                    title="Saude operacional"
                    subtitle="Campos mais usados em suporte sem abrir o payload bruto."
                  />
                  <CardBody className="space-y-4">
                    <div
                      className={`rounded-2xl border px-4 py-4 ${
                        isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div
                        className={`text-[11px] font-bold uppercase tracking-[0.18em] ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Ultimo erro do gateway
                      </div>
                      <div
                        className={`mt-3 text-sm font-semibold ${
                          isDark ? "text-white" : "text-slate-950"
                        }`}
                      >
                        {gatewayStatus?.lastError || monitor?.error?.message || "Sem erro recente."}
                      </div>
                      <div
                        className={`mt-2 text-xs ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        {fmtDateTime(gatewayStatus?.lastErrorAt)}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div
                        className={`rounded-2xl border px-4 py-4 ${
                          isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
                        }`}
                      >
                        <div
                          className={`text-[11px] font-bold uppercase tracking-[0.18em] ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          Ultimo forward OK
                        </div>
                        <div
                          className={`mt-3 text-lg font-black ${
                            isDark ? "text-white" : "text-slate-950"
                          }`}
                        >
                          {fmtDateTime(gatewayStatus?.lastForwardOkAt)}
                        </div>
                      </div>

                      <div
                        className={`rounded-2xl border px-4 py-4 ${
                          isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
                        }`}
                      >
                        <div
                          className={`text-[11px] font-bold uppercase tracking-[0.18em] ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          Ultimo watchdog
                        </div>
                        <div
                          className={`mt-3 text-lg font-black ${
                            isDark ? "text-white" : "text-slate-950"
                          }`}
                        >
                          {fmtDateTime(gatewayStatus?.lastWatchdogAt)}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div
                        className={`rounded-2xl border px-4 py-4 ${
                          isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
                        }`}
                      >
                        <div
                          className={`text-[11px] font-bold uppercase tracking-[0.18em] ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          Numero conectado
                        </div>
                        <div
                          className={`mt-3 text-lg font-black ${
                            isDark ? "text-white" : "text-slate-950"
                          }`}
                        >
                          {gatewayStatus?.phone || "--"}
                        </div>
                      </div>

                      <div
                        className={`rounded-2xl border px-4 py-4 ${
                          isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
                        }`}
                      >
                        <div
                          className={`text-[11px] font-bold uppercase tracking-[0.18em] ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          Ultima atividade
                        </div>
                        <div
                          className={`mt-3 text-lg font-black ${
                            isDark ? "text-white" : "text-slate-950"
                          }`}
                        >
                          {fmtDateTime(gatewayStatus?.lastSeen)}
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>

              <Card className="rounded-[24px]">
                <CardHeader
                  title="Eventos recentes"
                  subtitle="Troubleshooting rapido do gateway com filtros leves no client."
                />
                <CardBody className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar por evento, erro, telefone ou payload"
                    />
                    <select
                      value={levelFilter}
                      onChange={(event) => setLevelFilter(event.target.value)}
                      className={`w-full rounded-2xl border px-3.5 py-2.5 text-sm outline-none transition ${
                        isDark
                          ? "border-white/10 bg-white/6 text-slate-100"
                          : "border-slate-200/80 bg-white text-slate-900 shadow-[0_14px_24px_-22px_rgba(15,23,42,0.2)]"
                      }`}
                    >
                      <option value="">Todos os levels</option>
                      {levelOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <select
                      value={eventFilter}
                      onChange={(event) => setEventFilter(event.target.value)}
                      className={`w-full rounded-2xl border px-3.5 py-2.5 text-sm outline-none transition ${
                        isDark
                          ? "border-white/10 bg-white/6 text-slate-100"
                          : "border-slate-200/80 bg-white text-slate-900 shadow-[0_14px_24px_-22px_rgba(15,23,42,0.2)]"
                      }`}
                    >
                      <option value="">Todos os eventos</option>
                      {eventOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!filteredEvents.length ? (
                    <EmptyStateBlock message="Nenhum evento encontrado com os filtros atuais." />
                  ) : (
                    <div className="space-y-3">
                      {filteredEvents.map((item, index) => (
                        <div
                          key={`${item.at || item.event || "event"}-${index}`}
                          className={`rounded-2xl border px-4 py-4 ${
                            isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                <StatusPill
                                  tone={
                                    String(item?.level || "").toLowerCase() === "error"
                                      ? "failed"
                                      : String(item?.level || "").toLowerCase() === "warn"
                                        ? "warning"
                                        : "healthy"
                                  }
                                >
                                  {item?.level || "info"}
                                </StatusPill>
                                <StatusPill tone="inactive">{item?.event || "event"}</StatusPill>
                                {item?.state ? (
                                  <StatusPill
                                    tone={stateTone(item.state, {
                                      available: true,
                                      forwardDegraded: item?.forwardDegraded === true,
                                    })}
                                  >
                                    {stateLabel(item.state)}
                                  </StatusPill>
                                ) : null}
                              </div>
                              <div
                                className={`text-sm font-semibold ${
                                  isDark ? "text-white" : "text-slate-950"
                                }`}
                              >
                                {buildEventSummary(item)}
                              </div>
                              <div
                                className={`text-xs leading-5 ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                {fmtDateTime(item?.at)} • {item?.message || item?.reason || "Sem mensagem adicional."}
                              </div>
                            </div>
                            <Button
                              variant="secondary"
                              onClick={() =>
                                onOpenDetail(
                                  `Gateway ${item?.event || "event"}`,
                                  item?.message || buildEventSummary(item),
                                  item,
                                )
                              }
                            >
                              <Eye className="h-4 w-4" />
                              Ver payload
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
