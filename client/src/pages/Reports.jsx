// src/pages/Reports.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
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
  Legend,
} from "recharts";

import Shell from "../components/layout/Shell.jsx";
import { api } from "../app/api.js";
import { listWorkspaceUsers } from "../app/authApi.js";
import { useAuth } from "../app/AuthContext.jsx";

import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import Badge from "../components/appui/Badge.jsx";
import { downloadReportFile } from "../utils/reportDownloads.js";

/* ========= helpers ========= */
function pad2(n) {
  return String(n).padStart(2, "0");
}
function toYMD(d) {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}
function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function formatBRLFromCents(cents) {
  const v = Number(cents || 0) / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDateLabel(ymd) {
  if (!ymd) return "";
  const [, m, d] = String(ymd).split("-");
  return `${d}/${m}`;
}

const chartTooltipStyle = {
  background: "rgba(9,12,20,.92)",
  border: "1px solid rgba(148,163,184,.25)",
  borderRadius: 12,
  padding: "10px 12px",
  color: "#e5e7eb",
  fontSize: 12,
};

function DarkTooltip({ active, payload, label, formatter, labelFormatter }) {
  if (!active || !payload?.length) return null;
  const lbl = labelFormatter ? labelFormatter(label) : label;

  return (
    <div style={chartTooltipStyle}>
      <div
        style={{
          fontSize: 11,
          color: "rgba(148,163,184,.95)",
          marginBottom: 6,
        }}
      >
        {lbl}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {payload.map((p, i) => {
          const name = p.name || p.dataKey || "Valor";
          const val = formatter ? formatter(p.value, name, p) : p.value;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <span style={{ color: "rgba(229,231,235,.95)" }}>{name}</span>
              <span style={{ color: "rgba(229,231,235,.95)", fontWeight: 600 }}>
                {val}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ========= page ========= */
export default function Reports() {
  const { perms, user } = useAuth();
  const isOwnerTeamView =
    perms?.isWorkspaceOwner === true && perms?.isWorkspaceTeamPlan === true;
  const ownerId = String(user?._id || "").trim();

  // presets
  const [preset, setPreset] = useState("30d"); // 7d | 30d | month | custom
  const [onlyPaid, setOnlyPaid] = useState(true);
  const [type, setType] = useState("all"); // all | service | product

  const today = useMemo(() => new Date(), []);
  const defaultTo = useMemo(() => toYMD(today), [today]);
  const defaultFrom30 = useMemo(() => toYMD(addDays(today, -29)), [today]);

  const [from, setFrom] = useState(defaultFrom30);
  const [to, setTo] = useState(defaultTo);
  const [scopeTab, setScopeTab] = useState("mine");
  const [teamOwnerFilter, setTeamOwnerFilter] = useState("all");
  const [workspaceUsers, setWorkspaceUsers] = useState([]);
  const [teamUsersBusy, setTeamUsersBusy] = useState(false);

  const [applying, setApplying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [summary, setSummary] = useState(null);
  const [revenueDaily, setRevenueDaily] = useState([]);
  const [createdVsPaidDaily, setCreatedVsPaidDaily] = useState([]);
  const [topClients, setTopClients] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [performanceByUser, setPerformanceByUser] = useState([]);

  // evita warning do Recharts (container 0)
  const [mounted, setMounted] = useState(false);
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

  function buildQS({ from, to, type, onlyPaid, scope, ownerUserId }) {
    const p = new URLSearchParams();
    p.set("from", from);
    p.set("to", to);
    p.set("type", type);
    p.set("onlyPaid", onlyPaid ? "1" : "0");
    p.set("scope", scope || "mine");
    if (ownerUserId) p.set("ownerUserId", ownerUserId);
    return p.toString();
  }

  function applyPreset(nextPreset) {
    const now = new Date();
    let nextFrom = from;
    let nextTo = to;

    if (nextPreset === "7d") {
      nextFrom = toYMD(addDays(now, -6));
      nextTo = toYMD(now);
    } else if (nextPreset === "30d") {
      nextFrom = toYMD(addDays(now, -29));
      nextTo = toYMD(now);
    } else if (nextPreset === "month") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      nextFrom = toYMD(first);
      nextTo = toYMD(last);
    }

    setPreset(nextPreset);
    setFrom(nextFrom);
    setTo(nextTo);

    // ✅ já recarrega usando os valores calculados
    loadAllWith({ from: nextFrom, to: nextTo });
  }

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("from", from);
    p.set("to", to);
    p.set("type", type);
    p.set("onlyPaid", onlyPaid ? "1" : "0");
    p.set("scope", appliedScope);
    if (selectedOwnerUserId) p.set("ownerUserId", selectedOwnerUserId);
    return p.toString();
  }, [from, to, type, onlyPaid, appliedScope, selectedOwnerUserId]);

  const loadWorkspaceTeam = useCallback(async () => {
    if (!isOwnerTeamView) {
      setWorkspaceUsers([]);
      return;
    }

    try {
      setTeamUsersBusy(true);
      const data = await listWorkspaceUsers();
      const rawItems = Array.isArray(data?.items) ? data.items : [];
      setWorkspaceUsers(
        rawItems.filter(
          (item) =>
            String(item?._id || "") !== ownerId && item?.status !== "disabled",
        ),
      );
    } catch {
      setWorkspaceUsers([]);
    } finally {
      setTeamUsersBusy(false);
    }
  }, [isOwnerTeamView, ownerId]);

  const loadAllWith = useCallback(async (next = {}) => {
    const q = buildQS({
      from: next.from ?? from,
      to: next.to ?? to,
      type: next.type ?? type,
      onlyPaid: next.onlyPaid ?? onlyPaid,
      scope: next.scope ?? appliedScope,
      ownerUserId:
        next.ownerUserId !== undefined ? next.ownerUserId : selectedOwnerUserId,
    });

    setErr("");
    setApplying(true);

    try {
      const [s, rev, cvp, tc, ti, tx, pbu] = await Promise.all([
        api(`/reports/summary?${q}`),
        api(`/reports/revenue-daily?${q}`),
        api(`/reports/created-vs-paid-daily?${q}`),
        api(`/reports/top-clients?${q}`),
        api(`/reports/top-items?${q}`),
        api(`/reports/transactions?${q}`),
        isOwnerTeamView
          ? api(`/reports/performance-by-user?${q}`)
          : Promise.resolve({ items: [] }),
      ]);

      setSummary(s?.summary || null);
      setRevenueDaily(
        (rev?.items || []).map((x) => ({
          ...x,
          label: formatDateLabel(x.date),
        })),
      );
      setCreatedVsPaidDaily(
        (cvp?.items || []).map((x) => ({
          ...x,
          label: formatDateLabel(x.date),
        })),
      );
      setTopClients(tc?.items || []);
      setTopItems(ti?.items || []);
      setTransactions(tx?.items || []);
      setPerformanceByUser(pbu?.items || []);
    } catch (e) {
      setErr(e?.data?.error || e?.message || "Falha ao carregar relatórios");
    } finally {
      setApplying(false);
      setLoading(false);
    }
  }, [from, to, type, onlyPaid, appliedScope, selectedOwnerUserId, isOwnerTeamView]);

  useEffect(() => {
    loadWorkspaceTeam();
  }, [loadWorkspaceTeam]);

  useEffect(() => {
    loadAllWith({
      scope: appliedScope,
      ownerUserId: selectedOwnerUserId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedScope, selectedOwnerUserId]);

  async function onApply() {
    await loadAllWith();
  }

  async function downloadCSV() {
    try {
      await downloadReportFile(
        `/reports/export.csv?${qs}`,
        `relatorios_${from}_a_${to}.csv`,
      );
    } catch (e) {
      setErr(e?.message || "Falha ao baixar CSV");
    }
  }

  async function downloadPDF() {
    try {
      await downloadReportFile(
        `/reports/export.pdf?${qs}`,
        `relatorios_${from}_a_${to}.pdf`,
      );
    } catch (e) {
      setErr(e?.message || "Falha ao baixar PDF");
    }
  }

  const kpis = useMemo(() => {
    const s = summary || {};
    return {
      paidRevenueCents: s.paidRevenueCents || 0,
      paidCount: s.paidCount || 0,
      createdCount: s.createdCount || 0,
      conversionPct: Number(s.conversionPct || 0),
      avgTicketCents: s.avgTicketCents || 0,
    };
  }, [summary]);

  const shouldShowPerformanceBlock =
    isOwnerTeamView && appliedScope === "workspace" && !selectedOwnerUserId;

  return (
    <Shell>
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* HEADER no mesmo padrão do Dashboard */}
        <div className="relative">
          <div className="bg-white border border-zinc-200 rounded-3xl p-5 sm:p-6 shadow-sm ring-1 ring-zinc-50">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
                    Relatórios
                  </h1>
                  <Badge tone="neutral">{scopeSummaryLabel}</Badge>
                </div>

                <p className="text-zinc-500 text-sm sm:text-base leading-relaxed max-w-2xl">
                  Vendas e receita — filtros e exportação
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Link to="/reports/recurring" className="flex-1 sm:flex-none">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full justify-center items-center gap-2 h-11 px-4 active:scale-95 transition-all"
                    >
                      <span className="font-semibold">Relatorio de recorrencia</span>
                    </Button>
                  </Link>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onApply}
                    disabled={applying}
                    className="flex-1 sm:flex-none justify-center items-center gap-2 h-11 px-4 active:scale-95 transition-all"
                  >
                    <span className="font-semibold">
                      {applying ? "Aplicando..." : "Aplicar"}
                    </span>
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={downloadCSV}
                    disabled={applying}
                    className="flex-1 sm:flex-none justify-center items-center gap-2 h-11 px-4 active:scale-95 transition-all"
                  >
                    <span className="font-semibold">Baixar CSV</span>
                  </Button>
                </div>

                <Button
                  size="sm"
                  onClick={downloadPDF}
                  disabled={applying}
                  className="w-full sm:w-auto justify-center items-center gap-2 h-11 px-6 font-bold"
                >
                  Baixar PDF
                </Button>
              </div>
            </div>
          </div>
        </div>

        {isOwnerTeamView ? (
          <Card>
            <CardHeader
              title="Escopo dos relatórios"
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
                  variant={effectiveScopeTab === "workspace" ? "primary" : "secondary"}
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
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-200 sm:w-[240px]"
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
                <Badge tone="neutral">{scopeSummaryLabel}</Badge>
              </div>
            </CardBody>
          </Card>
        ) : null}

        {err && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 flex justify-between items-center">
            <span>{err}</span>
            <button onClick={onApply} className="font-bold underline">
              Tentar de novo
            </button>
          </div>
        )}

        {/* Filtros */}
        <Card>
          <CardHeader
            title="Filtros"
            subtitle="Selecione período e critérios"
          />
          <CardBody>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={preset === "7d" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => applyPreset("7d")}
                >
                  7 dias
                </Button>
                <Button
                  variant={preset === "30d" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => applyPreset("30d")}
                >
                  30 dias
                </Button>
                <Button
                  variant={preset === "month" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => applyPreset("month")}
                >
                  Este mês
                </Button>
                <Button
                  variant={preset === "custom" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setPreset("custom")}
                >
                  Personalizado
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-3">
                  <label className="mb-1 block text-xs font-semibold text-zinc-600">
                    Tipo
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="all">Todos</option>
                    <option value="service">Serviços</option>
                    <option value="product">Produtos</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="mb-1 block text-xs font-semibold text-zinc-600">
                    Status
                  </label>
                  <select
                    value={onlyPaid ? "paid" : "all"}
                    onChange={(e) => setOnlyPaid(e.target.value === "paid")}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="paid">Somente pagos</option>
                    <option value="all">Todos</option>
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
                    disabled={preset !== "custom" && preset !== "month"}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:bg-zinc-50 disabled:text-zinc-400"
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
                    disabled={preset !== "custom" && preset !== "month"}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:bg-zinc-50 disabled:text-zinc-400"
                  />
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader title="Receita paga" subtitle="No período filtrado" />
            <CardBody>
              {loading ? (
                <Skeleton className="h-9 w-44" />
              ) : (
                <div className="text-2xl font-bold text-zinc-900">
                  {formatBRLFromCents(kpis.paidRevenueCents)}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Vendas pagas" subtitle="No período filtrado" />
            <CardBody>
              {loading ? (
                <Skeleton className="h-9 w-24" />
              ) : (
                <div className="text-2xl font-bold text-zinc-900">
                  {kpis.paidCount}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Ticket médio"
              subtitle="Receita / vendas pagas"
            />
            <CardBody>
              {loading ? (
                <Skeleton className="h-9 w-36" />
              ) : (
                <div className="text-2xl font-bold text-zinc-900">
                  {formatBRLFromCents(kpis.avgTicketCents)}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Conversão" subtitle="Pagas / emitidas" />
            <CardBody>
              {loading ? (
                <Skeleton className="h-9 w-24" />
              ) : (
                <div className="text-2xl font-bold text-zinc-900">
                  {Number.isFinite(kpis.conversionPct)
                    ? `${kpis.conversionPct.toFixed(1)}%`
                    : "0%"}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Gráficos */}
        {shouldShowPerformanceBlock ? (
          <Card>
            <CardHeader
              title="Desempenho por usuario"
              subtitle="Resumo nominal da equipe no periodo visivel"
            />
            <CardBody>
              {applying && performanceByUser.length === 0 ? (
                <Skeleton className="h-40 w-full" />
              ) : performanceByUser.length === 0 ? (
                <EmptyState
                  title="Sem desempenho consolidado"
                  subtitle="Ainda nao ha dados suficientes para comparar a equipe neste periodo."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-zinc-500">
                      <tr className="border-b border-zinc-100">
                        <th className="py-2 pr-3 font-semibold">Usuario</th>
                        <th className="py-2 pr-3 font-semibold">Criadas</th>
                        <th className="py-2 pr-3 font-semibold">Pagas</th>
                        <th className="py-2 pr-3 font-semibold">Conversao</th>
                        <th className="py-2 pr-0 font-semibold">Receita</th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-900">
                      {performanceByUser.map((item) => (
                        <tr key={item.ownerUserId} className="border-b border-zinc-50">
                          <td className="py-2 pr-3 font-semibold">
                            {item?.responsibleUser?.name || "Usuario"}
                          </td>
                          <td className="py-2 pr-3">{item.createdCount || 0}</td>
                          <td className="py-2 pr-3">{item.paidCount || 0}</td>
                          <td className="py-2 pr-3">{Number(item.conversionPct || 0).toFixed(1)}%</td>
                          <td className="py-2 pr-0">
                            {formatBRLFromCents(item.paidRevenueCents || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader
              title="Receita diária (R$)"
              subtitle="Agrupado por dia (pagamentos confirmados)"
            />
            <CardBody>
              <div className="h-[280px] min-w-0">
                {!mounted || loading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart data={revenueDaily}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(220,14%,16%)"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        width={45}
                        tickFormatter={(v) =>
                          `${Math.round(Number(v || 0) / 100)}`
                        }
                      />
                      <Tooltip
                        content={
                          <DarkTooltip
                            labelFormatter={(l) => `Dia ${l}`}
                            formatter={(val) => formatBRLFromCents(val)}
                          />
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="paidRevenueCents"
                        name="Receita paga"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Criadas vs Pagas"
              subtitle="Quantidade por dia no período"
            />
            <CardBody>
              <div className="h-[280px] min-w-0">
                {!mounted || loading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={createdVsPaidDaily}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(220,14%,16%)"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        width={35}
                      />
                      <Tooltip
                        content={
                          <DarkTooltip
                            labelFormatter={(l) => `Dia ${l}`}
                            formatter={(val) => `${val}`}
                          />
                        }
                      />
                      <Bar
                        dataKey="createdCount"
                        name="Criadas"
                        fill="#9ca3af" // cinza
                        radius={[4, 4, 0, 0]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar
                        dataKey="paidCount"
                        name="Pagas"
                        fill="#22c55e" // verde
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Tabelas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader
              title="Top Clientes"
              subtitle="Total pago e número de vendas no período"
            />
            <CardBody>
              {loading ? (
                <Skeleton className="h-40 w-full" />
              ) : topClients.length === 0 ? (
                <EmptyState
                  title="Sem dados"
                  subtitle="Não há informações no período selecionado."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-zinc-500">
                      <tr className="border-b border-zinc-100">
                        <th className="py-2 pr-3 font-semibold">Cliente</th>
                        <th className="py-2 pr-3 font-semibold">Total pago</th>
                        <th className="py-2 pr-0 font-semibold">Vendas</th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-900">
                      {topClients.map((r, idx) => (
                        <tr key={idx} className="border-b border-zinc-50">
                          <td className="py-2 pr-3">{r.customerName || "-"}</td>
                          <td className="py-2 pr-3">
                            {formatBRLFromCents(r.paidRevenueCents)}
                          </td>
                          <td className="py-2 pr-0">{r.paidCount || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Top Serviços/Produtos"
              subtitle="Itens mais vendidos no período"
            />
            <CardBody>
              {loading ? (
                <Skeleton className="h-40 w-full" />
              ) : topItems.length === 0 ? (
                <EmptyState
                  title="Sem dados"
                  subtitle="Não há informações no período selecionado."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-zinc-500">
                      <tr className="border-b border-zinc-100">
                        <th className="py-2 pr-3 font-semibold">Item</th>
                        <th className="py-2 pr-3 font-semibold">Total pago</th>
                        <th className="py-2 pr-0 font-semibold">Qtd</th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-900">
                      {topItems.map((r, idx) => (
                        <tr key={idx} className="border-b border-zinc-50">
                          <td className="py-2 pr-3">{r.description || "-"}</td>
                          <td className="py-2 pr-3">
                            {formatBRLFromCents(r.paidRevenueCents)}
                          </td>
                          <td className="py-2 pr-0">{r.qty || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader
                title="Transações"
                subtitle="Lista do período filtrado (MVP)"
                right={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={downloadCSV}
                    disabled={applying}
                    className="h-10"
                  >
                    Exportar CSV
                  </Button>
                }
              />
              <CardBody>
                {loading ? (
                  <Skeleton className="h-56 w-full" />
                ) : transactions.length === 0 ? (
                  <EmptyState
                    title="Sem transações"
                    subtitle="Nada encontrado no período selecionado."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs text-zinc-500">
                        <tr className="border-b border-zinc-100">
                          <th className="py-2 pr-3 font-semibold">Data</th>
                          <th className="py-2 pr-3 font-semibold">Cliente</th>
                          <th className="py-2 pr-3 font-semibold">Título</th>
                          <th className="py-2 pr-3 font-semibold">Status</th>
                          <th className="py-2 pr-0 font-semibold">
                            Valor pago
                          </th>
                        </tr>
                      </thead>
                      <tbody className="text-zinc-900">
                        {transactions.map((t, idx) => (
                          <tr key={idx} className="border-b border-zinc-50">
                            <td className="py-2 pr-3">
                              {t.paidDate ? formatDateLabel(t.paidDate) : "-"}
                            </td>
                            <td className="py-2 pr-3">
                              {t.customerName || "-"}
                            </td>
                            <td className="py-2 pr-3">{t.title || "-"}</td>
                            <td className="py-2 pr-3">
                              {t.paymentStatus || t.status || "-"}
                            </td>
                            <td className="py-2 pr-0">
                              {formatBRLFromCents(t.paidCents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>

        <div className="text-xs text-zinc-400">
          Período: <span className="font-semibold text-zinc-600">{from}</span>{" "}
          até <span className="font-semibold text-zinc-600">{to}</span>
        </div>
      </div>
    </Shell>
  );
}
