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
  Legend,
} from "recharts";
import Shell from "../components/layout/Shell.jsx";
import { api } from "../app/api.js";
import { listWorkspaceUsers } from "../app/authApi.js";
import { useAuth } from "../app/AuthContext.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import Badge from "../components/appui/Badge.jsx";
import { downloadReportFile } from "../utils/reportDownloads.js";

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

function money(cents) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dayLabel(ymd) {
  if (!ymd) return "";
  const [, month, day] = String(ymd).split("-");
  return `${day}/${month}`;
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
        {payload.map((item, index) => {
          const name = item.name || item.dataKey || "Valor";
          const value = formatter ? formatter(item.value, name, item) : item.value;
          return (
            <div
              key={index}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <span style={{ color: "rgba(229,231,235,.95)" }}>{name}</span>
              <span style={{ color: "rgba(229,231,235,.95)", fontWeight: 600 }}>
                {value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ title, subtitle, value, loading }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <CardBody>
        {loading ? <Skeleton className="h-8 w-32" /> : <div className="text-2xl font-bold text-zinc-900">{value}</div>}
      </CardBody>
    </Card>
  );
}

export default function ReportsDashboard() {
  const { perms, user } = useAuth();
  const isOwnerTeamView =
    perms?.isWorkspaceOwner === true && perms?.isWorkspaceTeamPlan === true;
  const ownerId = String(user?._id || "").trim();
  const now = useMemo(() => new Date(), []);
  const [mounted, setMounted] = useState(false);
  const [preset, setPreset] = useState("30d");
  const [onlyPaid, setOnlyPaid] = useState(true);
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
  const [summary, setSummary] = useState(null);
  const [revenueDaily, setRevenueDaily] = useState([]);
  const [createdVsPaidDaily, setCreatedVsPaidDaily] = useState([]);
  const [topClients, setTopClients] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [transactions, setTransactions] = useState([]);

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

  function buildQS(next = {}) {
    const params = new URLSearchParams();
    params.set("from", next.from ?? from);
    params.set("to", next.to ?? to);
    params.set("type", next.type ?? type);
    params.set("onlyPaid", (next.onlyPaid ?? onlyPaid) ? "1" : "0");
    params.set("scope", next.scope ?? appliedScope);
    if (next.ownerUserId ?? selectedOwnerUserId) {
      params.set("ownerUserId", next.ownerUserId ?? selectedOwnerUserId);
    }
    return params.toString();
  }

  const qs = useMemo(
    () =>
      buildQS({
        from,
        to,
        type,
        onlyPaid,
        scope: appliedScope,
        ownerUserId: selectedOwnerUserId,
      }),
    [from, to, type, onlyPaid, appliedScope, selectedOwnerUserId],
  );

  async function load(next = {}) {
    const query = buildQS(next);
    setApplying(true);
    setError("");

    try {
      const [summaryRes, revenueRes, createdVsPaidRes, topClientsRes, topItemsRes, transactionsRes] =
        await Promise.all([
          api(`/reports/summary?${query}`),
          api(`/reports/revenue-daily?${query}`),
          api(`/reports/created-vs-paid-daily?${query}`),
          api(`/reports/top-clients?${query}`),
          api(`/reports/top-items?${query}`),
          api(`/reports/transactions?${query}`),
        ]);

      setSummary(summaryRes?.summary || null);
      setRevenueDaily(
        (revenueRes?.items || []).map((item) => ({
          ...item,
          label: dayLabel(item.date),
        })),
      );
      setCreatedVsPaidDaily(
        (createdVsPaidRes?.items || []).map((item) => ({
          ...item,
          label: dayLabel(item.date),
        })),
      );
      setTopClients(topClientsRes?.items || []);
      setTopItems(topItemsRes?.items || []);
      setTransactions(transactionsRes?.items || []);
    } catch (err) {
      setError(err?.data?.error || err?.message || "Falha ao carregar relatorios.");
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
        const data = await listWorkspaceUsers();
        if (!alive) return;
        const rawItems = Array.isArray(data?.items) ? data.items : [];
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

  async function downloadCsv() {
    try {
      await downloadReportFile(
        `/reports/export.csv?${qs}`,
        `relatorios_${from}_a_${to}.csv`,
      );
    } catch (err) {
      setError(err?.message || "Falha ao baixar CSV.");
    }
  }

  async function downloadPdf() {
    try {
      await downloadReportFile(
        `/reports/export.pdf?${qs}`,
        `relatorios_${from}_a_${to}.pdf`,
      );
    } catch (err) {
      setError(err?.message || "Falha ao baixar PDF.");
    }
  }

  const kpis = useMemo(() => {
    const current = summary || {};
    return {
      paidRevenueCents: current.paidRevenueCents || 0,
      paidCount: current.paidCount || 0,
      createdCount: current.createdCount || 0,
      conversionPct: Number(current.conversionPct || 0),
      avgTicketCents: current.avgTicketCents || 0,
    };
  }, [summary]);

  const hasData =
    Number(kpis.createdCount || 0) > 0 ||
    revenueDaily.length > 0 ||
    createdVsPaidDaily.length > 0 ||
    topClients.length > 0 ||
    topItems.length > 0 ||
    transactions.length > 0;

  return (
    <Shell>
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <PageHeader
          eyebrow="Relatórios"
          title="Relatórios"
          subtitle="Acompanhe receita, conversão, clientes e operação em um painel comercial mais executivo."
          actions={
            <>
              <Link to="/reports/recurring">
                <Button variant="secondary">Relatórios de recorrência</Button>
              </Link>
              <Button variant="secondary" onClick={() => load()} disabled={applying}>
                {applying ? "Atualizando..." : "Atualizar"}
              </Button>
              <Button variant="secondary" onClick={downloadCsv} disabled={applying}>
                Baixar CSV
              </Button>
              <Button onClick={downloadPdf} disabled={applying}>
                Baixar PDF
              </Button>
            </>
          }
        />

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

        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

        <Card>
          <CardHeader title="Filtros" subtitle="Defina periodo, tipo e escopo do painel." />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant={preset === "7d" ? "primary" : "secondary"} onClick={() => applyPreset("7d")}>7 dias</Button>
              <Button variant={preset === "30d" ? "primary" : "secondary"} onClick={() => applyPreset("30d")}>30 dias</Button>
              <Button variant={preset === "month" ? "primary" : "secondary"} onClick={() => applyPreset("month")}>Este mes</Button>
              <Button variant={preset === "custom" ? "primary" : "secondary"} onClick={() => setPreset("custom")}>Personalizado</Button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-semibold text-zinc-600">Tipo</label>
                <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-200">
                  <option value="all">Todos</option>
                  <option value="service">Servicos</option>
                  <option value="product">Produtos</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-semibold text-zinc-600">Escopo</label>
                <select value={onlyPaid ? "paid" : "all"} onChange={(e) => setOnlyPaid(e.target.value === "paid")} className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-200">
                  <option value="paid">Somente pagos</option>
                  <option value="all">Todos os status</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-zinc-600">De</label>
                <input type="date" value={from} onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }} className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-zinc-600">Ate</label>
                <input type="date" value={to} onChange={(e) => { setPreset("custom"); setTo(e.target.value); }} className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
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
          <CardBody className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
            <span>
              Periodo: <strong className="text-zinc-900">{from}</strong> ate <strong className="text-zinc-900">{to}</strong>
            </span>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">Tipo: {type === "all" ? "Todos" : type === "service" ? "Servicos" : "Produtos"}</span>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">{onlyPaid ? "Painel filtrado por pagamentos" : "Painel com todos os status"}</span>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">Emitidas: {Number(kpis.createdCount || 0)}</span>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Receita paga" subtitle="Valor recebido no periodo" value={money(kpis.paidRevenueCents)} loading={loading} />
          <MetricCard title="Vendas pagas" subtitle="Pedidos confirmados" value={String(kpis.paidCount || 0)} loading={loading} />
          <MetricCard title="Ticket medio" subtitle="Receita por venda paga" value={money(kpis.avgTicketCents)} loading={loading} />
          <MetricCard title="Conversao" subtitle="Pagas sobre emitidas" value={`${Number(kpis.conversionPct || 0).toFixed(1)}%`} loading={loading} />
        </div>

        {!hasData && !loading ? (
          <EmptyState title="Sem dados no periodo" description="Ajuste os filtros ou aguarde novas transacoes para visualizar os relatorios." />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader title="Receita diaria" subtitle="Pagamentos confirmados por dia." />
                <CardBody>
                  <div className="h-[300px] min-w-0">
                    {!mounted || loading ? (
                      <Skeleton className="h-full w-full" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <LineChart data={revenueDaily}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,16%)" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={50} tickFormatter={(value) => `${Math.round(Number(value || 0) / 100)}`} />
                          <Tooltip content={<DarkTooltip labelFormatter={(label) => `Dia ${label}`} formatter={(value) => money(value)} />} />
                          <Line type="monotone" dataKey="paidRevenueCents" name="Receita paga" stroke="#14b8a6" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Criadas vs pagas" subtitle="Comparativo diario do periodo." />
                <CardBody>
                  <div className="h-[300px] min-w-0">
                    {!mounted || loading ? (
                      <Skeleton className="h-full w-full" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <BarChart data={createdVsPaidDaily}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,16%)" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={35} />
                          <Tooltip content={<DarkTooltip labelFormatter={(label) => `Dia ${label}`} formatter={(value) => `${value}`} />} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="createdCount" name="Criadas" fill="#94a3b8" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="paidCount" name="Pagas" fill="#22c55e" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-5">
              <div className="2xl:col-span-2">
                <Card className="h-full">
                  <CardHeader title="Top clientes" subtitle="Quem mais gerou receita no periodo." />
                  <CardBody>
                    {loading ? (
                      <Skeleton className="h-56 w-full" />
                    ) : topClients.length === 0 ? (
                      <EmptyState title="Sem clientes no periodo" description="Nenhum cliente com receita registrada para os filtros atuais." />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[520px] text-left text-sm">
                          <thead className="text-xs text-zinc-500">
                            <tr className="border-b border-zinc-100">
                              <th className="py-2 pr-3 font-semibold">Cliente</th>
                              <th className="py-2 pr-3 font-semibold">Total pago</th>
                              <th className="py-2 pr-0 font-semibold">Vendas</th>
                            </tr>
                          </thead>
                          <tbody className="text-zinc-900">
                            {topClients.map((item, index) => (
                              <tr key={`${item.customerName || "cliente"}:${index}`} className="border-b border-zinc-50">
                                <td className="py-3 pr-3 font-medium">{item.customerName || "-"}</td>
                                <td className="py-3 pr-3 font-semibold">{money(item.paidRevenueCents)}</td>
                                <td className="py-3 pr-0">{item.paidCount || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>

              <div className="2xl:col-span-3">
                <Card className="h-full">
                  <CardHeader title="Top servicos e produtos" subtitle="Itens que mais puxaram receita no periodo." />
                  <CardBody>
                    {loading ? (
                      <Skeleton className="h-56 w-full" />
                    ) : topItems.length === 0 ? (
                      <EmptyState title="Sem itens no periodo" description="Nenhum item com receita registrada para os filtros atuais." />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-sm">
                          <thead className="text-xs text-zinc-500">
                            <tr className="border-b border-zinc-100">
                              <th className="py-2 pr-3 font-semibold">Item</th>
                              <th className="py-2 pr-3 font-semibold">Receita</th>
                              <th className="py-2 pr-0 font-semibold">Quantidade</th>
                            </tr>
                          </thead>
                          <tbody className="text-zinc-900">
                            {topItems.map((item, index) => (
                              <tr key={`${item.description || "item"}:${index}`} className="border-b border-zinc-50">
                                <td className="py-3 pr-3 font-medium">{item.description || "-"}</td>
                                <td className="py-3 pr-3 font-semibold">{money(item.paidRevenueCents)}</td>
                                <td className="py-3 pr-0">{item.qty || 0}</td>
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

            <Card>
              <CardHeader
                title="Transacoes"
                subtitle="Operacao recente do periodo filtrado."
                right={
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={downloadCsv} disabled={applying}>
                      CSV
                    </Button>
                    <Button onClick={downloadPdf} disabled={applying}>
                      PDF
                    </Button>
                  </div>
                }
              />
              <CardBody>
                {loading ? (
                  <Skeleton className="h-64 w-full" />
                ) : transactions.length === 0 ? (
                  <EmptyState title="Sem transacoes no periodo" description="Nada encontrado para os filtros selecionados." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-left text-sm">
                      <thead className="text-xs text-zinc-500">
                        <tr className="border-b border-zinc-100">
                          <th className="py-2 pr-3 font-semibold">Data</th>
                          <th className="py-2 pr-3 font-semibold">Cliente</th>
                          <th className="py-2 pr-3 font-semibold">Titulo</th>
                          <th className="py-2 pr-3 font-semibold">Status</th>
                          <th className="py-2 pr-0 font-semibold">Valor pago</th>
                        </tr>
                      </thead>
                      <tbody className="text-zinc-900">
                        {transactions.map((item, index) => (
                          <tr key={`${item.publicToken || "tx"}:${index}`} className="border-b border-zinc-50">
                            <td className="py-3 pr-3">{item.paidDate ? dayLabel(item.paidDate) : "-"}</td>
                            <td className="py-3 pr-3">{item.customerName || "-"}</td>
                            <td className="py-3 pr-3">{item.title || "-"}</td>
                            <td className="py-3 pr-3">{item.paymentStatus || item.status || "-"}</td>
                            <td className="py-3 pr-0 font-semibold">{money(item.paidCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </Shell>
  );
}
