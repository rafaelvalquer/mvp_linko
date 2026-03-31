import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import Shell from "../components/layout/Shell.jsx";
import { listWorkspaceUsers } from "../app/authApi.js";
import { useAuth } from "../app/AuthContext.jsx";
import { getFeedbackReportsDashboard } from "../app/feedbackReportsApi.js";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import Badge from "../components/appui/Badge.jsx";
import useThemeToggle from "../app/useThemeToggle.js";

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toYMD(date) {
  const current = new Date(date);
  return `${current.getFullYear()}-${pad2(current.getMonth() + 1)}-${pad2(current.getDate())}`;
}

function addDays(date, days) {
  const current = new Date(date);
  current.setDate(current.getDate() + days);
  return current;
}

function dayLabel(ymd) {
  if (!ymd) return "";
  const [, month, day] = String(ymd).split("-");
  return `${day}/${month}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRating(value) {
  return `${Number(value || 0).toFixed(1)}/5`;
}

function scoreTone(rating) {
  const value = Number(rating || 0);
  if (value <= 3) return "CANCELLED";
  if (value >= 4) return "CONFIRMED";
  return "ACCEPTED";
}

const chartTooltipStyle = {
  background: "rgba(9,12,20,.92)",
  border: "1px solid rgba(148,163,184,.25)",
  borderRadius: 12,
  padding: "10px 12px",
  color: "#e5e7eb",
  fontSize: 12,
};

function DarkTooltip({ active, payload, label, labelFormatter }) {
  if (!active || !payload?.length) return null;
  const shownLabel = labelFormatter ? labelFormatter(label) : label;

  return (
    <div style={chartTooltipStyle}>
      <div
        style={{
          fontSize: 11,
          color: "rgba(148,163,184,.95)",
          marginBottom: 6,
        }}
      >
        {shownLabel}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {payload.map((item, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <span style={{ color: "rgba(229,231,235,.95)" }}>
              {item.name || item.dataKey || "Valor"}
            </span>
            <span
              style={{
                color: "rgba(229,231,235,.95)",
                fontWeight: 600,
              }}
            >
              {item.dataKey === "averageRating"
                ? formatRating(item.value)
                : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ title, subtitle, value, loading }) {
  return (
    <Card variant="quiet" className="overflow-hidden">
      <CardHeader title={title} subtitle={subtitle} />
      <CardBody>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <div className="text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">{value}</div>
        )}
      </CardBody>
    </Card>
  );
}

function FeedbackItem({ item, compact = false }) {
  const { isDark } = useThemeToggle();
  const comment = String(item?.comment || "").trim();
  const typeLabel =
    String(item?.offerType || "").trim().toLowerCase() === "product"
      ? "Produto"
      : "Servico";

  return (
    <div className="surface-quiet rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
            {item?.customerName || "Cliente"}
          </div>
          <div className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {item?.title || "Proposta"} • {typeLabel}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={scoreTone(item?.rating)}>{`${item?.rating || 0}/5`}</Badge>
          {item?.contactRequested ? (
            <Badge tone="ACCEPTED">Pediu contato</Badge>
          ) : null}
        </div>
      </div>

      <div className={`mt-3 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        Respondida em {formatDateTime(item?.respondedAt)}
      </div>

      {!compact ? (
        <div className={`mt-3 text-sm leading-6 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
          {comment || "Sem comentario registrado nesta avaliacao."}
        </div>
      ) : null}
    </div>
  );
}

export default function FeedbackReportsPage() {
  const { isDark } = useThemeToggle();
  const { perms, user } = useAuth();
  const isOwnerTeamView =
    perms?.isWorkspaceOwner === true && perms?.isWorkspaceTeamPlan === true;
  const ownerId = String(user?._id || "").trim();
  const now = useMemo(() => new Date(), []);
  const [mounted, setMounted] = useState(false);
  const [preset, setPreset] = useState("30d");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState(toYMD(addDays(now, -29)));
  const [to, setTo] = useState(toYMD(now));
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [scopeTab, setScopeTab] = useState("mine");
  const [teamOwnerFilter, setTeamOwnerFilter] = useState("all");
  const [workspaceUsers, setWorkspaceUsers] = useState([]);
  const [teamUsersBusy, setTeamUsersBusy] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => setMounted(true), []);

  const effectiveScopeTab = isOwnerTeamView ? scopeTab : "mine";
  const appliedScope =
    isOwnerTeamView && effectiveScopeTab === "workspace" ? "workspace" : "mine";
  const selectedOwnerUserId =
    appliedScope !== "workspace"
      ? ""
      : teamOwnerFilter === "me"
        ? ownerId
        : teamOwnerFilter !== "all"
          ? teamOwnerFilter
          : "";

  const selectedTeamMemberName = useMemo(() => {
    if (teamOwnerFilter === "all") return "Toda a equipe";
    if (teamOwnerFilter === "me") return "Somente eu";
    return (
      workspaceUsers.find((item) => String(item?._id || "") === teamOwnerFilter)
        ?.name || "Responsavel"
    );
  }, [teamOwnerFilter, workspaceUsers]);

  const scopeSummaryLabel =
    appliedScope === "workspace"
      ? `Equipe: ${selectedTeamMemberName}`
      : "Minha carteira";

  async function load(next = {}) {
    const params = {
      from: next.from ?? from,
      to: next.to ?? to,
      type: next.type ?? type,
      scope: next.scope ?? appliedScope,
      ownerUserId:
        next.ownerUserId !== undefined ? next.ownerUserId : selectedOwnerUserId,
    };

    setApplying(true);
    setError("");

    try {
      setData(await getFeedbackReportsDashboard(params));
    } catch (err) {
      setError(err?.data?.error || err?.message || "Falha ao carregar relatorio.");
      setData(null);
    } finally {
      setApplying(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    load({
      scope: appliedScope,
      ownerUserId: selectedOwnerUserId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedScope, selectedOwnerUserId]);

  useEffect(() => {
    if (!isOwnerTeamView) {
      setWorkspaceUsers([]);
      return;
    }

    let alive = true;

    (async () => {
      try {
        setTeamUsersBusy(true);
        const result = await listWorkspaceUsers();
        if (!alive) return;
        const rawItems = Array.isArray(result?.items) ? result.items : [];
        setWorkspaceUsers(
          rawItems.filter(
            (item) =>
              String(item?._id || "") !== ownerId && item?.status !== "disabled",
          ),
        );
      } catch {
        if (alive) setWorkspaceUsers([]);
      } finally {
        if (alive) setTeamUsersBusy(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isOwnerTeamView, ownerId]);

  function applyPreset(nextPreset) {
    const base = new Date();
    let nextFrom = from;
    let nextTo = toYMD(base);
    if (nextPreset === "7d") nextFrom = toYMD(addDays(base, -6));
    if (nextPreset === "30d") nextFrom = toYMD(addDays(base, -29));
    if (nextPreset === "month") {
      nextFrom = toYMD(new Date(base.getFullYear(), base.getMonth(), 1));
      nextTo = toYMD(new Date(base.getFullYear(), base.getMonth() + 1, 0));
    }
    setPreset(nextPreset);
    setFrom(nextFrom);
    setTo(nextTo);
    load({ from: nextFrom, to: nextTo });
  }

  const summary = data?.summary || {};
  const distribution = data?.distribution || [];
  const trend = (data?.trend || []).map((item) => ({
    ...item,
    label: dayLabel(item.date),
  }));
  const responses = data?.responses || [];
  const actionRequired = data?.actionRequired || [];
  const hasData =
    Number(summary.responsesCount || 0) > 0 ||
    responses.length > 0 ||
    actionRequired.length > 0;
  const fieldClass = "app-field w-full rounded-2xl px-3 py-2";
  const axisColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark
    ? "rgba(148,163,184,0.18)"
    : "rgba(148,163,184,0.24)";
  const distributionBarColor = isDark ? "#38bdf8" : "#2563eb";
  const trendLineColor = isDark ? "#2dd4bf" : "#0f766e";

  return (
    <Shell>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <PageHeader
          eyebrow="Relatórios"
          title="Satisfação"
          subtitle="Acompanhe notas, comentários e clientes que pediram retorno depois da avaliação."
          actions={
            <>
              <Link to="/reports">
                <Button variant="secondary">Relatórios gerais</Button>
              </Link>
              <Button variant="secondary" onClick={() => load()} disabled={applying}>
                {applying ? "Atualizando..." : "Atualizar"}
              </Button>
            </>
          }
        />

        {isOwnerTeamView ? (
          <Card>
            <CardHeader
              title="Escopo do relatório"
              subtitle="Alterne entre sua carteira e a visão consolidada da equipe."
            />
            <CardBody className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={effectiveScopeTab === "mine" ? "primary" : "secondary"}
                  onClick={() => setScopeTab("mine")}
                >
                  Minha carteira
                </Button>
                <Button
                  size="sm"
                  variant={
                    effectiveScopeTab === "workspace" ? "primary" : "secondary"
                  }
                  onClick={() => setScopeTab("workspace")}
                >
                  Equipe
                </Button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {effectiveScopeTab === "workspace" ? (
                  <select
                    value={teamOwnerFilter}
                    onChange={(e) => setTeamOwnerFilter(e.target.value)}
                    disabled={teamUsersBusy}
                    className={`sm:w-[240px] ${fieldClass}`}
                  >
                    <option value="all">Toda a equipe</option>
                    <option value="me">Somente eu</option>
                    {workspaceUsers.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <Badge tone="NEUTRAL">{scopeSummaryLabel}</Badge>
              </div>
            </CardBody>
          </Card>
        ) : null}

        {error ? (
          <div className="surface-quiet rounded-2xl border border-rose-200/80 p-4 text-sm text-rose-700 dark:border-rose-400/20 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        <Card variant="quiet">
          <CardHeader
            title="Filtros"
            subtitle="Defina período e tipo para acompanhar a percepção do cliente."
          />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={preset === "7d" ? "primary" : "secondary"}
                onClick={() => applyPreset("7d")}
              >
                7 dias
              </Button>
              <Button
                variant={preset === "30d" ? "primary" : "secondary"}
                onClick={() => applyPreset("30d")}
              >
                30 dias
              </Button>
              <Button
                variant={preset === "month" ? "primary" : "secondary"}
                onClick={() => applyPreset("month")}
              >
                Este mês
              </Button>
              <Button
                variant={preset === "custom" ? "primary" : "secondary"}
                onClick={() => setPreset("custom")}
              >
                Personalizado
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-4">
                <label className="mb-1 block text-xs font-semibold text-zinc-600">
                  Tipo
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={fieldClass}
                >
                  <option value="all">Todos</option>
                  <option value="service">Serviços</option>
                  <option value="product">Produtos</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-semibold text-zinc-600">
                  De
                </label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setPreset("custom");
                    setFrom(e.target.value);
                  }}
                  className={fieldClass}
                />
              </div>
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-semibold text-zinc-600">
                  Até
                </label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setPreset("custom");
                    setTo(e.target.value);
                  }}
                  className={fieldClass}
                />
              </div>
              <div className="md:col-span-2 md:flex md:items-end">
                <Button className="w-full" onClick={() => load()} disabled={applying}>
                  {applying ? "Aplicando..." : "Aplicar filtros"}
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span>
              Período: <strong className="text-slate-900 dark:text-white">{from}</strong> até{" "}
              <strong className="text-slate-900 dark:text-white">{to}</strong>
            </span>
            <span className="rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 dark:border-white/10 dark:bg-white/5">
              Tipo: {type === "all" ? "Todos" : type === "service" ? "Serviços" : "Produtos"}
            </span>
            <span className="rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 dark:border-white/10 dark:bg-white/5">
              Respostas: {Number(summary.responsesCount || 0)}
            </span>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Nota média"
            subtitle="Percepção média do período"
            value={formatRating(summary.averageRating || 0)}
            loading={loading}
          />
          <MetricCard
            title="Avaliações respondidas"
            subtitle="Total de respostas recebidas"
            value={String(summary.responsesCount || 0)}
            loading={loading}
          />
          <MetricCard
            title="Notas 4 e 5"
            subtitle="Fatia de clientes satisfeitos"
            value={`${Number(summary.positivePct || 0).toFixed(1)}%`}
            loading={loading}
          />
          <MetricCard
            title="Pedidos de contato"
            subtitle="Clientes pedindo retorno"
            value={String(summary.contactRequestedCount || 0)}
            loading={loading}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Notas baixas"
            subtitle="Avaliações de 1 a 3"
            value={String(summary.lowRatingsCount || 0)}
            loading={loading}
          />
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardBody className="flex flex-col gap-3 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Leitura rápida de CX
                </div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Use esta visão para identificar experiências críticas e clientes que precisam de um retorno humano mais rápido.
                </div>
              </div>
              <Link to="/offers">
                <Button variant="secondary">Ir para propostas</Button>
              </Link>
            </CardBody>
          </Card>
        </div>

        {!hasData && !loading ? (
          <EmptyState
            title="Sem avaliações no período"
            description="Quando os clientes responderem a pesquisa de satisfação, os indicadores de CX aparecem aqui."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader
                  title="Distribuição por nota"
                  subtitle="Entenda como as avaliações estão se espalhando entre 1 e 5."
                />
                <CardBody>
                  <div className="h-[300px] min-w-0">
                    {!mounted || loading ? (
                      <Skeleton className="h-full w-full" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <BarChart data={distribution}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={gridColor}
                          />
                          <XAxis
                            dataKey="rating"
                            tick={{ fontSize: 11, fill: axisColor }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: axisColor }}
                            axisLine={false}
                            tickLine={false}
                            width={35}
                          />
                          <Tooltip
                            content={
                              <DarkTooltip labelFormatter={(label) => `Nota ${label}`} />
                            }
                          />
                          <Bar
                            dataKey="count"
                            name="Respostas"
                            fill={distributionBarColor}
                            radius={[8, 8, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Tendência da satisfação"
                  subtitle="Evolução da nota média ao longo do período filtrado."
                />
                <CardBody>
                  <div className="h-[300px] min-w-0">
                    {!mounted || loading ? (
                      <Skeleton className="h-full w-full" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <LineChart data={trend}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={gridColor}
                          />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11, fill: axisColor }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            domain={[0, 5]}
                            tick={{ fontSize: 11, fill: axisColor }}
                            axisLine={false}
                            tickLine={false}
                            width={35}
                          />
                          <Tooltip
                            content={
                              <DarkTooltip
                                labelFormatter={(label) => `Dia ${label}`}
                              />
                            }
                          />
                          <Line
                            type="monotone"
                            dataKey="averageRating"
                            name="Nota média"
                            stroke={trendLineColor}
                            strokeWidth={2.5}
                            dot={{ r: 2 }}
                            activeDot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-5">
              <div className="2xl:col-span-2">
                <Card className="h-full">
                  <CardHeader
                    title="Ação necessária"
                    subtitle="Clientes com nota baixa ou pedindo contato."
                  />
                  <CardBody className="space-y-3">
                    {loading ? (
                      <Skeleton className="h-56 w-full" />
                    ) : actionRequired.length === 0 ? (
                      <EmptyState
                        title="Nenhum caso crítico no período"
                        description="As avaliações baixas ou pedidos de contato aparecem aqui para facilitar a priorização."
                      />
                    ) : (
                      actionRequired.map((item, index) => (
                        <FeedbackItem
                          key={`${item.offerId || item.publicToken || "action"}:${index}`}
                          item={item}
                        />
                      ))
                    )}
                  </CardBody>
                </Card>
              </div>

              <div className="2xl:col-span-3">
                <Card className="h-full">
                  <CardHeader
                    title="Respostas recentes"
                    subtitle="Últimas avaliações recebidas no período filtrado."
                  />
                  <CardBody className="space-y-3">
                    {loading ? (
                      <Skeleton className="h-56 w-full" />
                    ) : responses.length === 0 ? (
                      <EmptyState
                        title="Sem respostas recentes"
                        description="Quando o cliente responder a pesquisa, a avaliação aparece aqui com nota e comentário."
                      />
                    ) : (
                      responses.map((item, index) => (
                        <FeedbackItem
                          key={`${item.offerId || item.publicToken || "response"}:${index}`}
                          item={item}
                          compact={index > 2}
                        />
                      ))
                    )}
                  </CardBody>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
