import { useEffect, useMemo, useRef, useState } from "react";

import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Badge from "../components/appui/Badge.jsx";
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

function StatCard({ title, value, subtitle }) {
  return (
    <Card>
      <CardBody className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {title}
        </div>
        <div className="text-2xl font-black text-slate-950">{value}</div>
        <div className="text-sm text-slate-500">{subtitle}</div>
      </CardBody>
    </Card>
  );
}

function InfoLine({ label, value }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <span className="text-sm text-slate-700">{value}</span>
    </div>
  );
}

function FilterButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border px-3 py-2 text-sm font-semibold transition",
        active
          ? "border-sky-300 bg-[linear-gradient(135deg,rgba(37,99,235,0.12),rgba(20,184,166,0.16))] text-slate-950 shadow-[0_16px_30px_-26px_rgba(37,99,235,0.45)]"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950",
      ].join(" ")}
    >
      {children}
    </button>
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
  const [dashboard, setDashboard] = useState(null);
  const [form, setForm] = useState({
    templateKey: "",
    channel: "whatsapp",
    frequency: "daily",
    dayOfWeek: "monday",
    timeOfDay: "09:00",
  });

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
  const visibleItems = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  function focusCreateCard() {
    createCardRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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
          title="Automações"
          subtitle="Crie rotinas pessoais para receber agenda, resumo semanal e pendencias direto por WhatsApp, e-mail ou ambos."
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
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {flash ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {flash}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Plano"
            value={String(perms?.plan || workspace?.plan || "start").toUpperCase()}
            subtitle="Automações pessoais liberadas nos planos pagos."
          />
          <StatCard
            title="Ativas"
            value={`${activeCount}/${activeLimit || 0}`}
            subtitle="Quantidade de automacoes em execucao agora."
          />
          <StatCard
            title="Espaco livre"
            value={String(remainingSlots)}
            subtitle="Novas automacoes que ainda cabem no seu plano."
          />
          <StatCard
            title="Historico"
            value={`${Number(planSummary?.historyDays || 0)} dias`}
            subtitle="Retencao de execucoes conforme o seu plano."
          />
          <StatCard
            title="Pausadas"
            value={String(pausedCount + errorCount)}
            subtitle="Itens que pedem retomada ou revisao manual."
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[380px,minmax(0,1fr)]">
          <Card>
            <div ref={createCardRef}>
              <CardHeader
                title="Criacao manual"
                subtitle="Escolha o template, o canal e o horario. A Lumina agenda o resto."
              />
            </div>
            <CardBody>
              <form className="space-y-4" onSubmit={handleCreate}>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-slate-700">Template</span>
                  <select
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-300"
                    value={form.templateKey}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        templateKey: event.target.value,
                      }))
                    }
                  >
                    {templates.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-500">
                    {selectedTemplate?.description || "Selecione um template para esta rotina."}
                  </span>
                </label>

                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-slate-700">Canal</span>
                  <select
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-300"
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
                    <span className="text-sm font-semibold text-slate-700">Frequencia</span>
                    <select
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-300"
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
                    <span className="text-sm font-semibold text-slate-700">Horario</span>
                    <input
                      type="time"
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-300"
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
                    <span className="text-sm font-semibold text-slate-700">Dia da semana</span>
                    <select
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-300"
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

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
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

          <Card>
            <CardHeader
              title="Painel manual"
              subtitle="Acompanhe as rotinas ativas, execute manualmente ou ajuste o status sem abrir a Lumina."
              right={<Badge tone="PUBLIC">{items.length} itens</Badge>}
            />
            <CardBody className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map((filter) => (
                  <FilterButton
                    key={filter.value}
                    active={statusFilter === filter.value}
                    onClick={() => setStatusFilter(filter.value)}
                  >
                    {filter.label}
                  </FilterButton>
                ))}
              </div>

              {loading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                  Carregando automacoes...
                </div>
              ) : null}

              {!loading && visibleItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
                  <div className="text-base font-semibold text-slate-900">
                    Nenhuma automacao nesse filtro
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    Ajuste os filtros acima ou crie uma nova automacao pelo painel ao lado.
                  </div>
                </div>
              ) : null}

              {!loading
                ? visibleItems.map((item) => {
                    const lastHistory = Array.isArray(item.history) ? item.history[0] : null;
                    const busy = actingId === item.id;

                    return (
                      <div
                        key={item.id}
                        className="rounded-[24px] border border-slate-200 bg-white/80 p-4 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.14)]"
                      >
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-lg font-bold text-slate-950">
                                {item.name}
                              </div>
                              <Badge tone={statusTone(item.status)}>
                                {statusLabel(item.status)}
                              </Badge>
                              <Badge tone="PUBLIC">{item.templateLabel}</Badge>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                              <InfoLine label="Canal" value={formatChannelLabel(item.channel)} />
                              <InfoLine
                                label="Frequencia"
                                value={formatFrequencyLabel(item.frequency, item.dayOfWeek)}
                              />
                              <InfoLine label="Horario" value={item.timeOfDay || "-"} />
                              <InfoLine label="Proxima execucao" value={formatDateTime(item.nextRunAt)} />
                              <InfoLine label="Ultima execucao" value={formatDateTime(item.lastRunAt)} />
                              <InfoLine
                                label="Execucoes"
                                value={`${Number(item.runCount || 0)} total`}
                              />
                            </div>

                            {item.lastError?.message ? (
                              <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                Ultimo erro: {item.lastError.message}
                              </div>
                            ) : null}

                            {lastHistory?.message ? (
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                Ultimo resultado: {lastHistory.message}
                              </div>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-2 xl:max-w-[280px] xl:justify-end">
                            {item.status === "active" ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={busy}
                                onClick={() => handleAction(item.id, "pause")}
                              >
                                Pausar
                              </Button>
                            ) : null}

                            {item.status !== "active" ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={busy}
                                onClick={() => handleAction(item.id, "resume")}
                              >
                                Retomar
                              </Button>
                            ) : null}

                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={busy}
                              onClick={() => handleAction(item.id, "run")}
                            >
                              Executar agora
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() => handleAction(item.id, "duplicate")}
                            >
                              Duplicar
                            </Button>

                            <Button
                              variant="danger"
                              size="sm"
                              disabled={busy}
                              onClick={() => handleAction(item.id, "delete")}
                            >
                              Excluir
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
