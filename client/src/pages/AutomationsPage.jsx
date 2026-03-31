import { useEffect, useMemo, useRef, useState } from "react";

import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Badge from "../components/appui/Badge.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import {
  createUserAutomation,
  deleteUserAutomation,
  duplicateUserAutomation,
  getUserAutomationsDashboard,
  pauseUserAutomation,
  resumeUserAutomation,
  runUserAutomationNow,
} from "../app/userAutomationsApi.js";
import { useAuth } from "../app/AuthContext.jsx";

const CHANNEL_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "both", label: "WhatsApp + E-mail" },
];

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Diaria" },
  { value: "weekly", label: "Semanal" },
];

const WEEKDAY_OPTIONS = [
  { value: "monday", label: "Segunda-feira" },
  { value: "tuesday", label: "Terca-feira" },
  { value: "wednesday", label: "Quarta-feira" },
  { value: "thursday", label: "Quinta-feira" },
  { value: "friday", label: "Sexta-feira" },
  { value: "saturday", label: "Sabado" },
  { value: "sunday", label: "Domingo" },
];

const STATUS_FILTERS = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Ativas" },
  { value: "paused", label: "Pausadas" },
  { value: "error", label: "Com erro" },
];

const FILTER_EMPTY_STATE = {
  all: {
    title: "Nenhuma automacao criada ainda",
    description:
      "Monte sua primeira rotina pelo painel manual ao lado e a Lumina cuida do agendamento.",
  },
  active: {
    title: "Nenhuma automacao ativa agora",
    description:
      "As rotinas ativas vao aparecer aqui com proxima execucao e acoes rapidas.",
  },
  paused: {
    title: "Nenhuma automacao pausada",
    description:
      "Quando voce pausar uma rotina, ela fica agrupada aqui para retomada manual.",
  },
  error: {
    title: "Nenhuma automacao com erro",
    description:
      "As automacoes que falharem aparecem aqui para revisao e retomada.",
  },
};

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatChannelLabel(value) {
  return CHANNEL_OPTIONS.find((item) => item.value === value)?.label || "WhatsApp";
}

function formatFrequencyLabel(value, dayOfWeek = "") {
  if (value !== "weekly") return "Diaria";
  const weekday = WEEKDAY_OPTIONS.find((item) => item.value === dayOfWeek)?.label || "Segunda-feira";
  return `Semanal (${weekday})`;
}

function statusTone(value) {
  if (value === "active") return "PAID";
  if (value === "paused") return "EXPIRED";
  return "CANCELLED";
}

function statusLabel(value) {
  if (value === "active") return "Ativa";
  if (value === "paused") return "Pausada";
  return "Com erro";
}

function templateSurfaceClass(key = "") {
  const normalizedKey = String(key || "").trim().toLowerCase();

  if (normalizedKey.includes("agenda")) {
    return "border-sky-200 bg-sky-50/80 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200";
  }
  if (normalizedKey.includes("offer") || normalizedKey.includes("proposta")) {
    return "border-fuchsia-200 bg-fuchsia-50/80 text-fuchsia-700 dark:border-fuchsia-400/20 dark:bg-fuchsia-400/10 dark:text-fuchsia-200";
  }
  if (normalizedKey.includes("billing") || normalizedKey.includes("cobranca")) {
    return "border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200";
  }
  if (normalizedKey.includes("confirmation")) {
    return "border-violet-200 bg-violet-50/80 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200";
  }
  if (normalizedKey.includes("finance")) {
    return "border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200";
  }
  if (normalizedKey.includes("summary") || normalizedKey.includes("resumo")) {
    return "border-indigo-200 bg-indigo-50/80 text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-200";
  }
  if (normalizedKey.includes("priority")) {
    return "border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200";
  }

  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-400/20 dark:bg-slate-900/60 dark:text-slate-100";
}

function StatCard({ title, value, subtitle }) {
  return (
    <div className="app-kpi-card overflow-hidden">
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          {title}
        </div>
        <div className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">{value}</div>
        <div className="text-sm leading-6 text-slate-500 dark:text-slate-300">{subtitle}</div>
      </div>
    </div>
  );
}

function FilterButton({ active, count, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition",
        active
          ? "border-sky-300 bg-[linear-gradient(135deg,rgba(37,99,235,0.12),rgba(20,184,166,0.16))] text-slate-950 shadow-[0_16px_30px_-26px_rgba(37,99,235,0.45)] dark:border-sky-400/25 dark:bg-[linear-gradient(135deg,rgba(37,99,235,0.22),rgba(20,184,166,0.16))] dark:text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/15 dark:hover:text-white",
      ].join(" ")}
    >
      <span>{children}</span>
      <span
        className={[
          "inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold",
          active
            ? "bg-white/80 text-slate-950 dark:bg-white/12 dark:text-white"
            : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}

function InfoTile({ label, value, strong = false }) {
  return (
    <div className="surface-quiet rounded-[22px] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div
        className={`mt-2 text-sm ${
          strong
            ? "font-semibold text-slate-950 dark:text-white"
            : "text-slate-700 dark:text-slate-200"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ChannelPill({ value }) {
  const label = formatChannelLabel(value);
  const toneClass =
    value === "both"
      ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200"
      : value === "email"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200"
        : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
      {label}
    </span>
  );
}

function ChevronIcon({ expanded }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function TemplatePreview({ template, channel, frequency, timeOfDay, dayOfWeek }) {
  return (
    <div className="surface-secondary rounded-[24px] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        Resumo da rotina
      </div>

      <div className="mt-3">
        <div className="text-base font-semibold text-slate-950 dark:text-white">
          {template?.label || "Escolha um template para continuar"}
        </div>
        <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {template?.description ||
            "A Lumina prepara a rotina com os dados da sua carteira e agenda o envio."}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="surface-quiet rounded-2xl px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Canal
          </div>
          <div className="mt-2">
            <ChannelPill value={channel} />
          </div>
        </div>
        <div className="surface-quiet rounded-2xl px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Horario
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{timeOfDay || "-"}</div>
        </div>
        <div className="surface-quiet rounded-2xl px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Frequencia
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
            {formatFrequencyLabel(frequency, dayOfWeek)}
          </div>
        </div>
      </div>
    </div>
  );
}

function AutomationCard({ item, busy, expanded, onAction, onToggle }) {
  const lastHistory = Array.isArray(item.history) ? item.history[0] : null;
  const showResult = !item.lastError?.message && lastHistory?.message;
  const compactSchedule = `${formatChannelLabel(item.channel)} | ${formatFrequencyLabel(item.frequency, item.dayOfWeek)}`;
  const accordionId = `automation-panel-${item.id}`;

    return (
      <div
        className={[
          "surface-panel overflow-hidden rounded-[28px] transition",
          expanded ? "border-slate-300/90 dark:border-white/15" : "",
          busy && expanded
            ? "border-sky-200 shadow-[0_24px_52px_-34px_rgba(37,99,235,0.28)] dark:border-sky-400/25"
            : "",
        ].join(" ")}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={accordionId}
        className="flex w-full flex-col gap-4 px-5 py-4 text-left transition hover:bg-white/40 dark:hover:bg-white/4 sm:px-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${templateSurfaceClass(item.templateKey || item.templateLabel)}`}
              >
                {item.templateLabel}
              </span>
              <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
              {item.lastError?.message ? (
                  <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
                    Requer revisao
                  </span>
              ) : null}
            </div>

            <div className="space-y-1">
                <div className="text-lg font-black tracking-tight text-slate-950 dark:text-white sm:text-xl">
                  {item.name}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300">{compactSchedule}</div>
                {item.lastError?.message ? (
                  <div className="text-xs leading-5 text-rose-600 dark:text-rose-200">
                    Falha recente detectada. Expanda para revisar os detalhes.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-start gap-3 lg:items-center">
              <div className="surface-quiet min-w-0 rounded-[22px] px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Proxima execucao
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                  {formatDateTime(item.nextRunAt)}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Canal e frequencia prontos para leitura rapida.</div>
              </div>

              <div className="surface-quiet flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-slate-500 dark:text-slate-300">
                <ChevronIcon expanded={expanded} />
              </div>
            </div>
        </div>
      </button>

      <div
        id={accordionId}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-slate-200/80 px-5 pb-5 pt-4 dark:border-white/10 sm:px-6">
            <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_240px] xl:items-start">
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  <InfoTile label="Canal" value={<ChannelPill value={item.channel} />} />
                  <InfoTile label="Horario" value={item.timeOfDay || "-"} strong />
                  <InfoTile
                    label="Frequencia"
                    value={formatFrequencyLabel(item.frequency, item.dayOfWeek)}
                    strong
                  />
                  <InfoTile label="Ultima execucao" value={formatDateTime(item.lastRunAt)} />
                  <InfoTile label="Execucoes" value={`${Number(item.runCount || 0)} no total`} strong />
                  <InfoTile label="Status" value={statusLabel(item.status)} strong />
                </div>

                {item.lastError?.message ? (
                  <div className="surface-quiet rounded-[22px] border border-rose-200/80 px-4 py-3 text-rose-700 dark:border-rose-400/20 dark:text-rose-200">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600 dark:text-rose-200">
                      Ultimo erro
                    </div>
                    <div className="mt-2 text-sm leading-6">{item.lastError.message}</div>
                  </div>
                ) : null}

                {showResult ? (
                  <div className="surface-quiet rounded-[22px] px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Ultimo resultado
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{lastHistory.message}</div>
                  </div>
                ) : null}
              </div>

              <div className="surface-secondary rounded-[24px] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Acoes manuais
                </div>
                <div className="mt-3 space-y-2">
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={busy}
                    onClick={() => onAction(item.id, "run")}
                  >
                    {busy ? "Executando..." : "Executar agora"}
                  </Button>

                  {item.status === "active" ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      disabled={busy}
                      onClick={() => onAction(item.id, "pause")}
                    >
                      Pausar automacao
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      disabled={busy}
                      onClick={() => onAction(item.id, "resume")}
                    >
                      Retomar automacao
                    </Button>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    disabled={busy}
                    onClick={() => onAction(item.id, "duplicate")}
                  >
                    Duplicar
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="w-full"
                    disabled={busy}
                    onClick={() => onAction(item.id, "delete")}
                  >
                    Excluir
                  </Button>
                </div>

                <div className="surface-quiet mt-4 rounded-2xl px-3 py-2 text-xs leading-5 text-slate-500 dark:text-slate-300">
                  {busy
                    ? "A Lumina esta concluindo essa acao neste item."
                    : "Abra a rotina quando quiser pausar, executar ou revisar o ultimo resultado."}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AutomationsPage() {
  const { perms, workspace } = useAuth();
  const createCardRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState("");
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedAutomationId, setExpandedAutomationId] = useState("");
  const [selectedTemplateGroupKey, setSelectedTemplateGroupKey] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [form, setForm] = useState({
    templateKey: "",
    channel: "whatsapp",
    frequency: "daily",
    dayOfWeek: "monday",
    timeOfDay: "09:00",
  });
  const fieldClass = "app-field h-11 w-full px-3";

  async function loadDashboard({ keepFlash = true } = {}) {
    if (!keepFlash) setFlash("");
    setError("");
    try {
      const data = await getUserAutomationsDashboard();
      const firstTemplateKey =
        Array.isArray(data?.templates) && data.templates[0]?.key
          ? data.templates[0].key
          : "";
      setDashboard(data);
      setForm((current) => ({
        ...current,
        templateKey: current.templateKey || firstTemplateKey,
      }));
    } catch (err) {
      setError(err?.data?.error || err?.message || "Nao consegui carregar as automacoes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard({ keepFlash: true });
  }, []);

  const items = Array.isArray(dashboard?.items) ? dashboard.items : [];
  const templates = Array.isArray(dashboard?.templates) ? dashboard.templates : [];
  const templateGroups = useMemo(() => {
    const groups = new Map();

    templates.forEach((template) => {
      const groupKey = String(template?.groupKey || "resumos").trim() || "resumos";
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          label: template?.groupLabel || "Templates",
          description: template?.groupDescription || "",
          items: [],
        });
      }

      groups.get(groupKey).items.push(template);
    });

    return Array.from(groups.values()).filter((group) => group.items.length > 0);
  }, [templates]);
  const planSummary = dashboard?.planSummary || null;
  const activeCount = Number(dashboard?.activeCount || 0);
  const activeLimit = Number(planSummary?.activeLimit || 0);
  const pausedCount = items.filter((item) => item.status === "paused").length;
  const errorCount = items.filter((item) => item.status === "error").length;
  const remainingSlots = Math.max(activeLimit - activeCount, 0);
  const selectedTemplate = useMemo(
    () => templates.find((item) => item.key === form.templateKey) || null,
    [templates, form.templateKey],
  );
  const selectedTemplateGroup = useMemo(
    () =>
      templateGroups.find((group) => group.key === selectedTemplateGroupKey) ||
      templateGroups[0] ||
      null,
    [templateGroups, selectedTemplateGroupKey],
  );
  const visibleTemplates = selectedTemplateGroup?.items || [];
  const filterCounts = useMemo(
    () => ({
      all: items.length,
      active: items.filter((item) => item.status === "active").length,
      paused: items.filter((item) => item.status === "paused").length,
      error: items.filter((item) => item.status === "error").length,
    }),
    [items],
  );
  const visibleItems = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);
  const emptyState = FILTER_EMPTY_STATE[statusFilter] || FILTER_EMPTY_STATE.all;

  useEffect(() => {
    if (!templateGroups.length) {
      if (selectedTemplateGroupKey) setSelectedTemplateGroupKey("");
      return;
    }

    const templateGroupKey = selectedTemplate?.groupKey || templateGroups[0]?.key || "";
    if (templateGroupKey && templateGroupKey !== selectedTemplateGroupKey) {
      setSelectedTemplateGroupKey(templateGroupKey);
    }
  }, [templateGroups, selectedTemplate, selectedTemplateGroupKey]);

  useEffect(() => {
    if (!selectedTemplateGroup?.items?.length) return;
    const selectedInsideGroup = selectedTemplateGroup.items.some(
      (template) => template.key === form.templateKey,
    );
    if (selectedInsideGroup) return;

    setForm((current) => ({
      ...current,
      templateKey: selectedTemplateGroup.items[0]?.key || "",
    }));
  }, [selectedTemplateGroup, form.templateKey]);

  useEffect(() => {
    if (!expandedAutomationId) return;
    const stillVisible = visibleItems.some((item) => item.id === expandedAutomationId);
    if (!stillVisible) {
      setExpandedAutomationId("");
    }
  }, [expandedAutomationId, visibleItems]);

  function focusCreateCard() {
    createCardRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handleTemplateGroupSelect(groupKey) {
    const group = templateGroups.find((item) => item.key === groupKey);
    if (!group?.key) return;
    setSelectedTemplateGroupKey(group.key);
    setForm((current) => ({
      ...current,
      templateKey: group.items.some((template) => template.key === current.templateKey)
        ? current.templateKey
        : group.items[0]?.key || "",
    }));
  }

  function handleTemplateSelect(templateKey) {
    const template = templates.find((item) => item.key === templateKey);
    if (!template?.key) return;
    setSelectedTemplateGroupKey(template.groupKey || "");
    setForm((current) => ({
      ...current,
      templateKey: template.key,
    }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFlash("");

    try {
      await createUserAutomation({
        templateKey: form.templateKey,
        channel: form.channel,
        frequency: form.frequency,
        dayOfWeek: form.frequency === "weekly" ? form.dayOfWeek : "",
        timeOfDay: form.timeOfDay,
      });
      setFlash("Automacao criada com sucesso.");
      await loadDashboard({ keepFlash: true });
    } catch (err) {
      setError(err?.data?.error || err?.message || "Nao consegui criar a automacao.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(id, action) {
    if (!id || !action) return;
    setActingId(id);
    setError("");
    setFlash("");

    try {
      if (action === "pause") {
        await pauseUserAutomation(id);
        setFlash("Automacao pausada.");
      } else if (action === "resume") {
        await resumeUserAutomation(id);
        setFlash("Automacao retomada.");
      } else if (action === "run") {
        const result = await runUserAutomationNow(id);
        setFlash(result?.execution?.message || "Automacao executada.");
      } else if (action === "duplicate") {
        await duplicateUserAutomation(id);
        setFlash("Automacao duplicada.");
      } else if (action === "delete") {
        await deleteUserAutomation(id);
        setFlash("Automacao excluida.");
      }

      await loadDashboard({ keepFlash: true });
    } catch (err) {
      setError(err?.data?.error || err?.message || "Nao consegui concluir essa acao.");
    } finally {
      setActingId("");
    }
  }

  return (
    <Shell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Lumina"
          title="Automacoes"
          subtitle="Central manual para revisar, executar e ajustar suas rotinas pessoais sem depender do chat."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => loadDashboard({ keepFlash: true })}
                disabled={loading}
              >
                Atualizar
              </Button>
              <Button onClick={focusCreateCard}>Nova automacao</Button>
            </div>
          }
        />

        {error ? (
          <div className="surface-quiet rounded-2xl border border-rose-200/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        {flash ? (
          <div className="surface-quiet rounded-2xl border border-emerald-200/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-200">
            {flash}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Plano"
            value={String(perms?.plan || workspace?.plan || "start").toUpperCase()}
            subtitle="Rotinas pessoais liberadas nos planos pagos, com entregas por WhatsApp e e-mail."
          />
          <StatCard
            title="Ativas"
            value={`${activeCount}/${activeLimit || 0}`}
            subtitle="Quantidade de automacoes em execucao dentro do limite atual do seu plano."
          />
          <StatCard
            title="Espaco livre"
            value={String(remainingSlots)}
            subtitle="Novas automacoes que ainda cabem antes de atingir o limite de rotinas ativas."
          />
          <StatCard
            title="Pausadas e com erro"
            value={String(pausedCount + errorCount)}
            subtitle="Itens que podem pedir retomada, revisao rapida ou nova execucao manual."
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[380px,minmax(0,1fr)]">
          <Card variant="elevated" className="overflow-hidden">
            <div ref={createCardRef}>
              <CardHeader
                title="Criacao manual"
                subtitle="Escolha a categoria, selecione a rotina e ajuste o envio em poucos passos."
              />
            </div>
            <CardBody className="space-y-5">
              <form className="space-y-4" onSubmit={handleCreate}>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-slate-700 dark:text-white">Template</div>
                    <div className="text-xs leading-5 text-slate-500 dark:text-slate-300">
                      Escolha a categoria e depois a rotina que voce quer automatizar.
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block space-y-1">
                      <span className="text-sm font-semibold text-slate-700 dark:text-white">Categoria</span>
                      <select
                        className={fieldClass}
                        value={selectedTemplateGroup?.key || ""}
                        onChange={(event) => handleTemplateGroupSelect(event.target.value)}
                      >
                        {templateGroups.map((group) => (
                          <option key={group.key} value={group.key}>
                            {group.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs leading-5 text-slate-500 dark:text-slate-300">
                        {selectedTemplateGroup?.description ||
                          "Escolha uma funcionalidade para ver as rotinas disponiveis."}
                      </span>
                    </label>

                    <label className="block space-y-1">
                      <span className="text-sm font-semibold text-slate-700 dark:text-white">Template</span>
                      <select
                        className={fieldClass}
                        value={form.templateKey}
                        onChange={(event) => handleTemplateSelect(event.target.value)}
                      >
                        {visibleTemplates.map((template) => (
                          <option key={template.key} value={template.key}>
                            {template.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs leading-5 text-slate-500 dark:text-slate-300">
                        {selectedTemplate?.description ||
                          "Escolha uma rotina para continuar a configuracao."}
                      </span>
                    </label>
                  </div>

                  <TemplatePreview
                    template={selectedTemplate}
                    channel={form.channel}
                    frequency={form.frequency}
                    timeOfDay={form.timeOfDay}
                    dayOfWeek={form.dayOfWeek}
                  />
                </div>

                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-slate-700 dark:text-white">Canal</span>
                  <select
                    className={fieldClass}
                    value={form.channel}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        channel: event.target.value,
                      }))
                    }
                  >
                    {CHANNEL_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold text-slate-700 dark:text-white">Frequencia</span>
                    <select
                      className={fieldClass}
                      value={form.frequency}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          frequency: event.target.value,
                        }))
                      }
                    >
                      {FREQUENCY_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-sm font-semibold text-slate-700 dark:text-white">Horario</span>
                    <input
                      type="time"
                      className={fieldClass}
                      value={form.timeOfDay}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          timeOfDay: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                {form.frequency === "weekly" ? (
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold text-slate-700 dark:text-white">Dia da semana</span>
                    <select
                      className={fieldClass}
                      value={form.dayOfWeek}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          dayOfWeek: event.target.value,
                        }))
                      }
                    >
                      {WEEKDAY_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <div className="surface-quiet rounded-[22px] px-4 py-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  A automacao usa por padrao o seu proprio WhatsApp e e-mail cadastrados.
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    submitting ||
                    loading ||
                    !form.templateKey ||
                    (activeLimit > 0 && activeCount >= activeLimit)
                  }
                >
                  {submitting ? "Criando..." : "Criar automacao"}
                </Button>
              </form>
            </CardBody>
          </Card>

          <Card variant="quiet" className="overflow-hidden">
            <CardHeader
              title="Painel manual"
              subtitle="Veja o status de cada rotina, encontre horario e frequencia em segundos e aja daqui quando precisar."
              right={<Badge tone="NEUTRAL">{items.length} itens</Badge>}
            />
            <CardBody className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map((filter) => (
                  <FilterButton
                    key={filter.value}
                    active={statusFilter === filter.value}
                    count={filterCounts[filter.value] || 0}
                    onClick={() => setStatusFilter(filter.value)}
                  >
                    {filter.label}
                  </FilterButton>
                ))}
              </div>

              {loading ? (
                <div className="surface-quiet rounded-[24px] border border-dashed px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-300">
                  Carregando automacoes...
                </div>
              ) : null}

              {!loading && visibleItems.length === 0 ? (
                <EmptyState
                  title={emptyState.title}
                  description={emptyState.description}
                  ctaLabel="Nova automacao"
                  onCta={focusCreateCard}
                />
              ) : null}

              {!loading
                ? visibleItems.map((item) => (
                    <AutomationCard
                      key={item.id}
                      item={item}
                      busy={actingId === item.id}
                      expanded={expandedAutomationId === item.id}
                      onToggle={() =>
                        setExpandedAutomationId((current) => (current === item.id ? "" : item.id))
                      }
                      onAction={handleAction}
                    />
                  ))
                : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
