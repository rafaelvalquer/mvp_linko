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
  Cell,
} from "recharts";
import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import Button from "../components/appui/Button.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import Badge from "../components/appui/Badge.jsx";
import { getRecurringReportsDashboard } from "../app/recurringReportsApi.js";
import { getRecurringStatusLabel, getRecurringStatusTone } from "../utils/recurringStatus.js";

const weekdayColors = ["#2563eb", "#0ea5e9", "#14b8a6", "#22c55e", "#84cc16", "#f59e0b", "#f97316"];
const agingColors = ["#f59e0b", "#f97316", "#ef4444", "#dc2626", "#991b1b"];

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
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function compactMoney(cents) {
  const value = Number(cents || 0) / 100;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(Math.abs(value) >= 10000 ? 0 : 1)}k`;
  return `${Math.round(value)}`;
}

function dateOnly(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function dateTime(value) {
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

function portfolioBadge(item) {
  if (Number(item?.overdueCount || 0) > 0) return { tone: "CANCELLED", label: "Em atraso" };
  if (Number(item?.awaitingConfirmationCount || 0) > 0) return { tone: "ACCEPTED", label: "Em analise" };
  if (Number(item?.pendingCount || 0) > 0) return { tone: "DRAFT", label: "Pendente" };
  return { tone: "PAID", label: "Em dia" };
}

function MetricCard({ title, subtitle, value, loading }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <CardBody>{loading ? <Skeleton className="h-8 w-32" /> : <div className="text-2xl font-bold text-zinc-900">{value}</div>}</CardBody>
    </Card>
  );
}

export default function RecurringReportsPage() {
  const now = useMemo(() => new Date(), []);
  const [mounted, setMounted] = useState(false);
  const [preset, setPreset] = useState("30d");
  const [type, setType] = useState("all");
  const [recurringStatus, setRecurringStatus] = useState("all");
  const [from, setFrom] = useState(toYMD(addDays(now, -29)));
  const [to, setTo] = useState(toYMD(now));
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => setMounted(true), []);

  async function load(next = {}) {
    const params = {
      from: next.from ?? from,
      to: next.to ?? to,
      type: next.type ?? type,
      recurringStatus: next.recurringStatus ?? recurringStatus,
    };
    setApplying(true);
    setError("");
    try {
      setData(await getRecurringReportsDashboard(params));
    } catch (err) {
      setError(err?.data?.error || err?.message || "Falha ao carregar relatorios.");
      setData(null);
    } finally {
      setApplying(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPreset(nextPreset) {
    const base = new Date();
    let nextFrom = from;
    let nextTo = toYMD(base);
    if (nextPreset === "30d") nextFrom = toYMD(addDays(base, -29));
    if (nextPreset === "90d") nextFrom = toYMD(addDays(base, -89));
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
  const dueVsPaidDaily = data?.dueVsPaidDaily || [];
  const paymentWeekdayDistribution = data?.paymentWeekdayDistribution || [];
  const overdueAgingBuckets = data?.overdueAgingBuckets || [];
  const delinquentClients = data?.delinquentClients || [];
  const portfolio = data?.portfolio || [];
  const hasData = Number(summary.generatedCount || 0) > 0 || delinquentClients.length > 0 || portfolio.length > 0;

  return (
    <Shell>
      <div className="space-y-6">
        <PageHeader
          title="Relatorios de recorrencia"
          subtitle="Acompanhe cobrancas recorrentes, dias de pagamento e clientes em atraso."
          actions={
            <>
              <Link to="/reports">
                <Button variant="secondary">Relatorios gerais</Button>
              </Link>
              <Button variant="secondary" onClick={() => load()} disabled={applying}>
                {applying ? "Atualizando..." : "Atualizar"}
              </Button>
            </>
          }
        />

        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

        <Card>
          <CardHeader title="Filtros" subtitle="Defina periodo, tipo e status da recorrencia." />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant={preset === "30d" ? "primary" : "secondary"} onClick={() => applyPreset("30d")}>30 dias</Button>
              <Button variant={preset === "90d" ? "primary" : "secondary"} onClick={() => applyPreset("90d")}>90 dias</Button>
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
                <label className="mb-1 block text-xs font-semibold text-zinc-600">Status da recorrencia</label>
                <select value={recurringStatus} onChange={(e) => setRecurringStatus(e.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-200">
                  <option value="all">Todos</option>
                  <option value="active">Ativas</option>
                  <option value="paused">Pausadas</option>
                  <option value="ended">Encerradas</option>
                  <option value="error">Com erro</option>
                  <option value="draft">Rascunho</option>
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
                <Button className="w-full" onClick={() => load()} disabled={applying}>{applying ? "Aplicando..." : "Aplicar filtros"}</Button>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard title="Receita recebida" subtitle="Pagamentos confirmados no periodo" value={money(summary.paidRevenueCents)} loading={loading} />
          <MetricCard title="Cobrancas geradas" subtitle="Parcelas recorrentes criadas" value={String(summary.generatedCount || 0)} loading={loading} />
          <MetricCard title="Em atraso" subtitle="Parcelas vencidas e abertas" value={String(summary.overdueCount || 0)} loading={loading} />
          <MetricCard title="Valor em atraso" subtitle="Risco atual da carteira" value={money(summary.overdueAmountCents)} loading={loading} />
          <MetricCard title="Clientes inadimplentes" subtitle="Clientes com atraso no periodo" value={String(summary.delinquentClientsCount || 0)} loading={loading} />
          <MetricCard title="Pagamento no prazo" subtitle="Pagamentos feitos ate o vencimento" value={`${Number(summary.onTimeRatePct || 0).toFixed(1)}%`} loading={loading} />
        </div>

        <Card>
          <CardBody className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
            <span>Periodo: <strong className="text-zinc-900">{from}</strong> ate <strong className="text-zinc-900">{to}</strong></span>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">Em analise: {Number(summary.awaitingConfirmationCount || 0)}</span>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">Sem vencimento: {Number(summary.pendingNoDueDateCount || 0)}</span>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">Tempo medio: {Number(summary.avgDaysToPay || 0).toFixed(1)} dia(s)</span>
          </CardBody>
        </Card>

        {!hasData && !loading ? (
          <EmptyState title="Sem dados de recorrencia no periodo" description="Ajuste os filtros ou aguarde novas cobrancas recorrentes para visualizar os relatorios." />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader title="Vencendo vs recebido" subtitle="Valor previsto para vencer versus valor pago por dia." />
                <CardBody><div className="h-[300px] min-w-0">{!mounted || loading ? <Skeleton className="h-full w-full" /> : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart data={dueVsPaidDaily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,16%)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={50} tickFormatter={(value) => compactMoney(value)} />
                      <Tooltip formatter={(value) => money(value)} />
                      <Line type="monotone" dataKey="dueAmountCents" name="Vencendo" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="paidAmountCents" name="Recebido" stroke="#14b8a6" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}</div></CardBody>
              </Card>

              <Card>
                <CardHeader title="Dias com mais pagamentos" subtitle="Mostra em quais dias da semana os clientes mais pagam." />
                <CardBody><div className="h-[300px] min-w-0">{!mounted || loading ? <Skeleton className="h-full w-full" /> : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={paymentWeekdayDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,16%)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={35} />
                      <Tooltip formatter={(value, _name, row) => `${value} pagamento(s) • ${money(row?.payload?.amountCents)}`} />
                      <Bar dataKey="count" name="Pagamentos" radius={[8, 8, 0, 0]}>
                        {paymentWeekdayDistribution.map((row, index) => <Cell key={`${row.label}:${index}`} fill={weekdayColors[index % weekdayColors.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}</div></CardBody>
              </Card>

              <Card className="xl:col-span-2">
                <CardHeader title="Faixas da carteira em atraso" subtitle="Valor concentrado por idade do atraso." />
                <CardBody><div className="h-[300px] min-w-0">{!mounted || loading ? <Skeleton className="h-full w-full" /> : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={overdueAgingBuckets}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,14%,16%)" />
                      <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={50} tickFormatter={(value) => compactMoney(value)} />
                      <Tooltip formatter={(value, _name, row) => `${money(value)} (${row?.payload?.count || 0} cobrancas)`} />
                      <Bar dataKey="amountCents" name="Valor em atraso" radius={[8, 8, 0, 0]}>
                        {overdueAgingBuckets.map((row, index) => <Cell key={`${row.bucket}:${index}`} fill={agingColors[index % agingColors.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}</div></CardBody>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-5">
              <div className="2xl:col-span-2">
                <Card className="h-full">
                  <CardHeader title="Clientes inadimplentes" subtitle="Quem mais precisa de atencao agora." />
                  <CardBody>{loading ? <Skeleton className="h-64 w-full" /> : delinquentClients.length === 0 ? (
                    <EmptyState title="Sem clientes inadimplentes" description="Nenhum cliente com parcelas vencidas no periodo filtrado." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="text-xs text-zinc-500"><tr className="border-b border-zinc-100"><th className="py-2 pr-3 font-semibold">Cliente</th><th className="py-2 pr-3 font-semibold">Recorrencias</th><th className="py-2 pr-3 font-semibold">Em atraso</th><th className="py-2 pr-3 font-semibold">Valor</th><th className="py-2 pr-3 font-semibold">Maior atraso</th><th className="py-2 pr-3 font-semibold">Ultimo lembrete</th><th className="py-2 pr-0 font-semibold text-right">Acao</th></tr></thead>
                        <tbody className="text-zinc-900">
                          {delinquentClients.map((item) => (
                            <tr key={item.customerKey} className="border-b border-zinc-50 align-top">
                              <td className="py-3 pr-3 font-medium">{item.customerName}</td>
                              <td className="py-3 pr-3">{item.recurringCount}</td>
                              <td className="py-3 pr-3">{item.overdueCount}</td>
                              <td className="py-3 pr-3 font-semibold">{money(item.overdueAmountCents)}</td>
                              <td className="py-3 pr-3">{item.maxDelayDays} dia(s)</td>
                              <td className="py-3 pr-3">{item.lastReminderAt ? dateTime(item.lastReminderAt) : "Sem envio"}</td>
                              <td className="py-3 pr-0 text-right">{item.primaryRecurringId ? <Link to={`/offers/recurring/${item.primaryRecurringId}`}><Button variant="secondary" className="px-3 py-2 text-xs">Abrir recorrencia</Button></Link> : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}</CardBody>
                </Card>
              </div>

              <div className="2xl:col-span-3">
                <Card className="h-full">
                  <CardHeader title="Carteira por recorrencia" subtitle="Acompanhe a saude de cada automacao recorrente." />
                  <CardBody>{loading ? <Skeleton className="h-64 w-full" /> : portfolio.length === 0 ? (
                    <EmptyState title="Sem recorrencias no periodo" description="As recorrencias com atividade no periodo aparecerao aqui." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1020px] text-left text-sm">
                        <thead className="text-xs text-zinc-500"><tr className="border-b border-zinc-100"><th className="py-2 pr-3 font-semibold">Recorrencia</th><th className="py-2 pr-3 font-semibold">Status</th><th className="py-2 pr-3 font-semibold">Geradas</th><th className="py-2 pr-3 font-semibold">Pagas</th><th className="py-2 pr-3 font-semibold">Pendentes</th><th className="py-2 pr-3 font-semibold">Em atraso</th><th className="py-2 pr-3 font-semibold">Valor em atraso</th><th className="py-2 pr-3 font-semibold">Carteira</th><th className="py-2 pr-3 font-semibold">Ultimo pagamento</th><th className="py-2 pr-3 font-semibold">Proximo vencimento</th><th className="py-2 pr-0 font-semibold text-right">Acao</th></tr></thead>
                        <tbody className="text-zinc-900">
                          {portfolio.map((item) => {
                            const health = portfolioBadge(item);
                            return (
                              <tr key={String(item.recurringOfferId)} className="border-b border-zinc-50 align-top">
                                <td className="py-3 pr-3"><div className="font-semibold">{item.recurringName}</div><div className="mt-1 text-xs text-zinc-500">{item.customerName}</div></td>
                                <td className="py-3 pr-3"><Badge tone={getRecurringStatusTone(item.recurringStatus)}>{getRecurringStatusLabel(item.recurringStatus)}</Badge></td>
                                <td className="py-3 pr-3">{item.generatedCount}</td>
                                <td className="py-3 pr-3">{item.paidCount}</td>
                                <td className="py-3 pr-3">{item.pendingCount}</td>
                                <td className="py-3 pr-3">{item.overdueCount}</td>
                                <td className="py-3 pr-3 font-semibold">{money(item.overdueAmountCents)}</td>
                                <td className="py-3 pr-3"><Badge tone={health.tone}>{health.label}</Badge></td>
                                <td className="py-3 pr-3">{dateOnly(item.lastPaidAt)}</td>
                                <td className="py-3 pr-3">{dateOnly(item.nextDueAt)}</td>
                                <td className="py-3 pr-0 text-right"><Link to={`/offers/recurring/${item.recurringOfferId}`}><Button variant="secondary" className="px-3 py-2 text-xs">Detalhes</Button></Link></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}</CardBody>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
