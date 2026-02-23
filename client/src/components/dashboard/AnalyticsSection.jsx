// src/components/dashboard/AnalyticsSection.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { api } from "../../app/api.js";
import Skeleton from "../appui/Skeleton.jsx";
import EmptyState from "../appui/EmptyState.jsx";
import ChartCard from "./ChartCard.jsx";
import RangeToggle from "./RangeToggle.jsx";

const TZ_DEFAULT = "America/Sao_Paulo";
const LS_KEY = "dash:analyticsOpen";

const LABEL = {
  PUBLIC: "Público",
  ACCEPTED: "Aceito",
  PAID: "Pago",
  EXPIRED: "Expirado",
  DRAFT: "Rascunho",
  HOLD: "Reservado",
  CONFIRMED: "Confirmado",
  CANCELED: "Cancelado",
  CANCELLED: "Cancelado",
};

const MAP = {
  PUBLIC: "bg-blue-50 text-blue-700 border-blue-200",
  ACCEPTED: "bg-amber-50 text-amber-800 border-amber-200",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  EXPIRED: "bg-zinc-50 text-zinc-600 border-zinc-200",
  DRAFT: "bg-zinc-50 text-zinc-700 border-zinc-200",
  HOLD: "bg-amber-50 text-amber-800 border-amber-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

const SLICE_FILL = {
  PUBLIC: "#3b82f6",
  ACCEPTED: "#f59e0b",
  HOLD: "#f59e0b",
  PAID: "#22c55e",
  CONFIRMED: "#22c55e",
  EXPIRED: "#a1a1aa",
  DRAFT: "#71717a",
  CANCELED: "#ef4444",
  CANCELLED: "#ef4444",
};

const FALLBACK_COLORS = [
  "#0ea5e9",
  "#f59e0b",
  "#a855f7",
  "#22c55e",
  "#ef4444",
  "#06b6d4",
];

function Chevron({ open }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={[
        "h-4 w-4 transition-transform duration-200",
        open ? "rotate-180" : "rotate-0",
      ].join(" ")}
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function readOpenDefault() {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {}
  return true;
}

// ====== AUTH (mesmo padrão do bookingsApi.js) ======
function getAuthToken() {
  try {
    const direct =
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("authToken");
    if (direct) return direct;

    const auth = localStorage.getItem("auth");
    if (auth) {
      const parsed = JSON.parse(auth);
      return (
        parsed?.token ||
        parsed?.accessToken ||
        parsed?.authToken ||
        parsed?.jwt ||
        null
      );
    }
  } catch {}
  return null;
}

function withAuthHeaders(extra) {
  const t = getAuthToken();
  return {
    ...(extra || {}),
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}
// ================================================

function normStatus(v) {
  const s = String(v || "")
    .trim()
    .toUpperCase();
  if (!s) return "PUBLIC";
  if (s === "CANCELED") return "CANCELLED";
  return s;
}
function statusLabel(v) {
  const code = normStatus(v);
  return LABEL[code] || code;
}
function statusBadgeClass(v) {
  const code = normStatus(v);
  return MAP[code] || "bg-zinc-50 text-zinc-700 border-zinc-200";
}
function statusFill(v, idx = 0) {
  const code = normStatus(v);
  return SLICE_FILL[code] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

function fmtDateShort(ymd) {
  if (!ymd) return "";
  const [y, m, d] = String(ymd).split("-");
  if (!y || !m || !d) return String(ymd);
  return `${d}/${m}`;
}

function fmtBRL(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
}

function TooltipBox({ title, rows }) {
  return (
    <div className="rounded-xl border bg-white/95 backdrop-blur px-3 py-2 shadow-lg">
      {title ? (
        <div className="text-[11px] font-bold text-zinc-900 mb-1">{title}</div>
      ) : null}
      <div className="space-y-0.5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-6"
          >
            <div className="text-[11px] text-zinc-600">{r.label}</div>
            <div className="text-[11px] font-semibold text-zinc-900">
              {r.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const map = new Map(payload.map((p) => [p.dataKey, p.value]));
  return (
    <TooltipBox
      title={fmtDateShort(label)}
      rows={[
        { label: "Vendas", value: String(map.get("salesCount") ?? 0) },
        { label: "Orçamentos", value: String(map.get("quotesCount") ?? 0) },
      ]}
    />
  );
}

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const v = payload?.[0]?.value;
  return (
    <TooltipBox
      title={fmtDateShort(label)}
      rows={[{ label: "Ticket médio", value: fmtBRL(v) }]}
    />
  );
}

function PieTooltipFactory({ total }) {
  return function PieTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const p = payload[0]?.payload;
    const code = normStatus(p?.status);
    const count = Number(p?.count) || 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;

    return (
      <TooltipBox
        title={
          <span
            className={[
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              statusBadgeClass(code),
            ].join(" ")}
          >
            {statusLabel(code)}
          </span>
        }
        rows={[
          { label: "Status", value: String(code) },
          { label: "Quantidade", value: String(count) },
          { label: "%", value: `${pct}%` },
        ]}
      />
    );
  };
}

function ClickLegend({ payload, hiddenKeys, toggle }) {
  if (!payload?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
      {payload.map((it) => {
        const k = it.dataKey;
        const hidden = hiddenKeys.has(k);
        return (
          <button
            key={k}
            type="button"
            onClick={() => toggle(k)}
            className={[
              "inline-flex items-center gap-2 rounded-lg border px-2 py-1 transition",
              hidden ? "opacity-40" : "opacity-100",
            ].join(" ")}
            title="Clique para ocultar/mostrar"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: it.color }}
            />
            <span className="font-semibold text-zinc-700">{it.value}</span>
          </button>
        );
      })}
    </div>
  );
}

function PieLegend({ data, totalAll, hidden, toggle }) {
  if (!data?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {data.map((it, idx) => {
        const code = normStatus(it.status);
        const isHidden = hidden.has(code);
        const count = Number(it.count) || 0;
        const pct = totalAll > 0 ? Math.round((count / totalAll) * 100) : 0;

        return (
          <button
            key={code}
            type="button"
            onClick={() => toggle(code)}
            className={[
              "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
              statusBadgeClass(code),
              isHidden ? "opacity-40" : "opacity-100",
            ].join(" ")}
            title="Clique para ocultar/mostrar"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: statusFill(code, idx) }}
            />
            <span>{statusLabel(code)}</span>
            <span className="opacity-70">•</span>
            <span className="tabular-nums">{count}</span>
            <span className="opacity-70">({pct}%)</span>
          </button>
        );
      })}
    </div>
  );
}

export default function AnalyticsSection() {
  const [open, setOpen] = useState(() => readOpenDefault());

  const fetchedRef = useRef(false);
  const inflightRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  const [pieRange, setPieRange] = useState("today");
  const [hiddenSeries, setHiddenSeries] = useState(() => new Set());
  const [hiddenPie, setHiddenPie] = useState(() => new Set());

  async function fetchAnalytics() {
    // evita duplicar requests
    if (inflightRef.current) return inflightRef.current;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const promise = (async () => {
      try {
        setLoading(true);
        setErr("");

        const res = await api(
          `/analytics/dashboard?tz=${encodeURIComponent(TZ_DEFAULT)}`,
          {
            headers: withAuthHeaders(),
            signal: controller.signal, // se api.js usa fetch, isso funciona
          },
        );

        if (!res?.ok) {
          throw new Error(res?.error || "Falha ao carregar analytics");
        }

        setData(res);
        fetchedRef.current = true;
      } catch (e) {
        // permite retry
        fetchedRef.current = false;

        // abort -> mensagem amigável
        if (e?.name === "AbortError") {
          setErr("Tempo esgotado ao carregar analytics. Tente novamente.");
        } else {
          setErr(e?.message || "Não foi possível carregar analytics.");
        }
      } finally {
        clearTimeout(timeout);
        setLoading(false);
        inflightRef.current = null;
      }
    })();

    inflightRef.current = promise;
    return promise;
  }

  useEffect(() => {
    if (open && !fetchedRef.current && !loading) {
      fetchAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggleOpen() {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LS_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  const monthDaily = data?.monthDaily || [];
  const last30Ticket = data?.last30Ticket || [];
  const paymentDist = data?.paymentDist || {};

  const pieData = useMemo(() => {
    const rows = paymentDist?.[pieRange] || [];
    const acc = new Map();
    for (const r of rows) {
      const status = normStatus(r.status);
      const count = Number(r.count) || 0;
      acc.set(status, (acc.get(status) || 0) + count);
    }
    return Array.from(acc.entries()).map(([status, count]) => ({
      status,
      count,
    }));
  }, [paymentDist, pieRange]);

  const pieDataVisible = useMemo(
    () =>
      pieData.filter(
        (r) =>
          !hiddenPie.has(normStatus(r.status)) && (Number(r.count) || 0) > 0,
      ),
    [pieData, hiddenPie],
  );

  const pieTotalAll = useMemo(
    () => pieData.reduce((acc, r) => acc + (Number(r.count) || 0), 0),
    [pieData],
  );

  const pieTotalVisible = useMemo(
    () => pieDataVisible.reduce((acc, r) => acc + (Number(r.count) || 0), 0),
    [pieDataVisible],
  );

  const pieTooltip = useMemo(
    () => PieTooltipFactory({ total: pieTotalVisible }),
    [pieTotalVisible],
  );

  function toggleSeries(key) {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function togglePieStatus(code) {
    setHiddenPie((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  const showSkeleton = open && loading && !data && !err;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white shadow-sm ring-1 ring-zinc-200 overflow-hidden">
        <button
          type="button"
          onClick={toggleOpen}
          className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-zinc-50/60 transition"
          aria-expanded={open}
        >
          <div className="text-left">
            <div className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              Desempenho de vendas
              {err ? (
                <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                  erro
                </span>
              ) : null}
              {open && loading ? (
                <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                  carregando…
                </span>
              ) : null}
            </div>
            <div className="text-xs text-zinc-500">
              Clique para {open ? "ocultar" : "mostrar"} os gráficos.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-700">
              {open ? "Ocultar" : "Mostrar"}
            </span>
            <Chevron open={open} />
          </div>
        </button>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5">
                {err ? (
                  <div className="rounded-2xl border bg-white p-6">
                    <EmptyState
                      title="Não foi possível carregar analytics"
                      description={err}
                      ctaLabel="Tentar novamente"
                      onCta={() => fetchAnalytics()}
                    />
                  </div>
                ) : null}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* LINE */}
                  <ChartCard
                    title="Vendas x Orçamentos"
                    subtitle="Mês atual (por dia)"
                    bodyClassName="p-0"
                  >
                    <div className="p-5">
                      {showSkeleton ? (
                        <Skeleton className="h-[280px] w-full rounded-2xl" />
                      ) : (
                        <div className="h-[280px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={monthDaily}
                              margin={{
                                top: 10,
                                right: 16,
                                left: 0,
                                bottom: 0,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey="date"
                                tickFormatter={fmtDateShort}
                                tick={{ fontSize: 11 }}
                                interval="preserveStartEnd"
                              />
                              <YAxis
                                tick={{ fontSize: 11 }}
                                allowDecimals={false}
                              />
                              <Tooltip content={<LineTooltip />} />
                              <Legend
                                verticalAlign="top"
                                align="left"
                                wrapperStyle={{ paddingBottom: 6 }}
                                content={(props) => (
                                  <ClickLegend
                                    {...props}
                                    hiddenKeys={hiddenSeries}
                                    toggle={toggleSeries}
                                  />
                                )}
                              />
                              {!hiddenSeries.has("salesCount") ? (
                                <Line
                                  type="monotone"
                                  dataKey="salesCount"
                                  name="Vendas"
                                  stroke="#22c55e"
                                  strokeWidth={2}
                                  dot={false}
                                  activeDot={{ r: 5 }}
                                />
                              ) : null}
                              {!hiddenSeries.has("quotesCount") ? (
                                <Line
                                  type="monotone"
                                  dataKey="quotesCount"
                                  name="Orçamentos"
                                  stroke="#3b82f6"
                                  strokeWidth={2}
                                  dot={false}
                                  activeDot={{ r: 5 }}
                                />
                              ) : null}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </ChartCard>

                  {/* PIE */}
                  <ChartCard
                    title="Distribuição por status"
                    subtitle={
                      pieRange === "today"
                        ? "Hoje"
                        : pieRange === "last7"
                          ? "Últimos 7 dias"
                          : "Últimos 30 dias"
                    }
                    right={
                      <RangeToggle value={pieRange} onChange={setPieRange} />
                    }
                    bodyClassName="p-0"
                  >
                    <div className="p-5">
                      {showSkeleton ? (
                        <Skeleton className="h-[280px] w-full rounded-2xl" />
                      ) : pieTotalAll === 0 ? (
                        <div className="h-[280px] flex items-center justify-center">
                          <div className="text-xs text-zinc-500">
                            Sem dados no período
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="h-[240px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Tooltip content={pieTooltip} />
                                <Pie
                                  data={pieDataVisible}
                                  dataKey="count"
                                  nameKey="status"
                                  innerRadius="55%"
                                  outerRadius="80%"
                                  paddingAngle={2}
                                >
                                  {pieDataVisible.map((row, idx) => (
                                    <Cell
                                      key={normStatus(row.status)}
                                      fill={statusFill(row.status, idx)}
                                    />
                                  ))}
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                          </div>

                          <PieLegend
                            data={pieData}
                            totalAll={pieTotalAll}
                            hidden={hiddenPie}
                            toggle={togglePieStatus}
                          />
                        </div>
                      )}
                    </div>
                  </ChartCard>

                  {/* BAR (linha inteira) */}
                  <div className="lg:col-span-2">
                    <ChartCard
                      title="Ticket médio"
                      subtitle="Últimos 30 dias (por dia)"
                      bodyClassName="p-0"
                    >
                      <div className="p-5">
                        {showSkeleton ? (
                          <Skeleton className="h-[280px] w-full rounded-2xl" />
                        ) : (
                          <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={last30Ticket}
                                margin={{
                                  top: 10,
                                  right: 16,
                                  left: 0,
                                  bottom: 0,
                                }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                  dataKey="date"
                                  tickFormatter={fmtDateShort}
                                  tick={{ fontSize: 11 }}
                                  interval={6}
                                />
                                <YAxis
                                  tick={{ fontSize: 11 }}
                                  tickFormatter={(v) => {
                                    const n = Number(v);
                                    if (!Number.isFinite(n)) return "";
                                    return new Intl.NumberFormat("pt-BR", {
                                      notation: "compact",
                                      maximumFractionDigits: 0,
                                    }).format(n);
                                  }}
                                />
                                <Tooltip content={<BarTooltip />} />
                                <Bar
                                  dataKey="avgTicket"
                                  name="Ticket médio"
                                  fill="#0ea5e9"
                                  radius={[8, 8, 0, 0]}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    </ChartCard>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
