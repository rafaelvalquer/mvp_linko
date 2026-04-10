import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
} from "recharts";
import Shell from "../components/layout/Shell.jsx";
import { listWorkspaceUsers } from "../app/authApi.js";
import { useAuth } from "../app/AuthContext.jsx";
import { getMyPageReportsAnalytics } from "../app/myPageReportsApi.js";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import Badge from "../components/appui/Badge.jsx";
import useThemeToggle from "../app/useThemeToggle.js";

const GEO_URL =
  "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson";
const BRAZIL_GEO_URL =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";
const GEO_CHART_COLORS = [
  "#2563EB",
  "#0F766E",
  "#F59E0B",
  "#7C3AED",
  "#DB2777",
  "#0891B2",
  "#EA580C",
  "#16A34A",
];
const FUNNEL_HELP_TEXT = {
  page_view:
    "Sessoes que visualizaram alguma pagina publica da Minha Pagina no periodo.",
  cta_click:
    "Sessoes que clicaram em botao principal ou link secundario da pagina.",
  intent_view:
    "Sessoes que entraram em uma etapa de intencao forte: orcamento, agendamento ou pagamento.",
  mid_conversion:
    "Sessoes que enviaram um pedido de orcamento ou selecionaram um horario na agenda.",
  final_conversion:
    "Sessoes que geraram agendamento concluido ou venda atribuida a Minha Pagina.",
};
const DEVICE_LABELS = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
  other: "Outros",
};
const DEVICE_BAR_COLORS = {
  desktop: "#2563EB",
  mobile: "#0F766E",
  tablet: "#F59E0B",
  other: "#94A3B8",
};

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

function number(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function percent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function normalizeCountryName(value) {
  const base = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const aliases = {
    "united states of america": "united states",
    "united kingdom of great britain and northern ireland": "united kingdom",
    "russian federation": "russia",
    "czechia": "czech republic",
    "korea republic of": "south korea",
    "iran islamic republic of": "iran",
    "syrian arab republic": "syria",
    "moldova republic of": "moldova",
    "viet nam": "vietnam",
    "lao people s democratic republic": "laos",
    "brunei darussalam": "brunei",
    "bolivia plurinational state of": "bolivia",
    "venezuela bolivarian republic of": "venezuela",
    "tanzania united republic of": "tanzania",
  };

  return aliases[base] || base;
}

const BRAZIL_STATE_LABELS = {
  acre: "Acre",
  alagoas: "Alagoas",
  amapa: "Amapá",
  amazonas: "Amazonas",
  bahia: "Bahia",
  ceara: "Ceará",
  "distrito federal": "Distrito Federal",
  "espirito santo": "Espírito Santo",
  goias: "Goiás",
  maranhao: "Maranhão",
  "mato grosso": "Mato Grosso",
  "mato grosso do sul": "Mato Grosso do Sul",
  "minas gerais": "Minas Gerais",
  para: "Pará",
  paraiba: "Paraíba",
  parana: "Paraná",
  pernambuco: "Pernambuco",
  piaui: "Piauí",
  "rio de janeiro": "Rio de Janeiro",
  "rio grande do norte": "Rio Grande do Norte",
  "rio grande do sul": "Rio Grande do Sul",
  rondonia: "Rondônia",
  roraima: "Roraima",
  "santa catarina": "Santa Catarina",
  "sao paulo": "São Paulo",
  sergipe: "Sergipe",
  tocantins: "Tocantins",
};

const BRAZIL_STATE_ALIASES = {
  ac: "acre",
  al: "alagoas",
  ap: "amapa",
  am: "amazonas",
  ba: "bahia",
  ce: "ceara",
  df: "distrito federal",
  es: "espirito santo",
  go: "goias",
  ma: "maranhao",
  mt: "mato grosso",
  ms: "mato grosso do sul",
  mg: "minas gerais",
  pa: "para",
  pb: "paraiba",
  pr: "parana",
  pe: "pernambuco",
  pi: "piaui",
  rj: "rio de janeiro",
  rn: "rio grande do norte",
  rs: "rio grande do sul",
  ro: "rondonia",
  rr: "roraima",
  sc: "santa catarina",
  sp: "sao paulo",
  se: "sergipe",
  to: "tocantins",
  "state of sao paulo": "sao paulo",
  "state of rio de janeiro": "rio de janeiro",
  "state of minas gerais": "minas gerais",
  "state of bahia": "bahia",
};

function normalizeStateName(value) {
  const base = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return "";
  return BRAZIL_STATE_ALIASES[base] || base;
}

function getStateDisplayName(value) {
  const normalized = normalizeStateName(value);
  return BRAZIL_STATE_LABELS[normalized] || String(value || "").trim() || "Estado";
}

function selectClassName(isDark) {
  return [
    "h-10 rounded-2xl border px-3 text-sm outline-none transition",
    isDark
      ? "border-white/10 bg-white/5 text-white"
      : "border-slate-200 bg-white text-slate-900",
  ].join(" ");
}

function inputClassName(isDark) {
  return [
    "h-10 rounded-2xl border px-3 text-sm outline-none transition",
    isDark
      ? "border-white/10 bg-white/5 text-white"
      : "border-slate-200 bg-white text-slate-900",
  ].join(" ");
}

function MetricCard({ title, subtitle, value, loading }) {
  return (
    <Card variant="quiet" className="overflow-hidden">
      <CardHeader title={title} subtitle={subtitle} />
      <CardBody>
        {loading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <div className="text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">
            {value}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function TableCard({ title, subtitle, columns, rows, loading, emptyText }) {
  return (
    <Card className="rounded-[24px]">
      <CardHeader title={title} subtitle={subtitle} />
      <CardBody className="space-y-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-2xl" />
            ))}
          </div>
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 text-left text-xs uppercase tracking-[0.14em] text-slate-500 dark:border-white/10 dark:text-slate-400">
                  {columns.map((column) => (
                    <th key={column.key} className="px-3 py-3 first:pl-0 last:pr-0">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.key || index}
                    className="border-b border-slate-100/90 last:border-b-0 dark:border-white/6"
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className="px-3 py-3 align-top text-slate-700 first:pl-0 last:pr-0 dark:text-slate-200"
                      >
                        {column.render ? column.render(row) : row[column.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Sem dados suficientes"
            description={emptyText}
          />
        )}
      </CardBody>
    </Card>
  );
}

function DeviceBreakdownTooltip({ active, payload }) {
  const { isDark } = useThemeToggle();
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div
      className={[
        "rounded-2xl border px-3 py-2 text-xs shadow-lg",
        isDark
          ? "border-white/10 bg-slate-950 text-slate-100"
          : "border-slate-200 bg-white text-slate-700",
      ].join(" ")}
    >
      <div className="font-semibold">{item.label}</div>
      <div className="mt-1">Sessoes: {number(item.sessions)}</div>
      <div>Participacao: {percent(item.share)}</div>
    </div>
  );
}

function DeviceBreakdownCard({ deviceBreakdown, loading }) {
  const { isDark } = useThemeToggle();
  const totalSessions = Number(deviceBreakdown?.totalSessions || 0);
  const chartData = ["desktop", "mobile", "tablet", "other"]
    .map((key) => ({
      key,
      label: DEVICE_LABELS[key],
      sessions: Number(deviceBreakdown?.[key] || 0),
      fill: DEVICE_BAR_COLORS[key],
    }))
    .filter((item) => item.sessions > 0);

  const chartDataWithShare = chartData.map((item) => ({
    ...item,
    share:
      totalSessions > 0
        ? Number(((item.sessions / totalSessions) * 100).toFixed(2))
        : 0,
  }));

  return (
    <Card className="rounded-[24px]">
      <CardHeader
        title="Desktop vs Mobile"
        subtitle="Sessoes unicas por dispositivo no periodo."
      />
      <CardBody className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-72 w-full rounded-[24px]" />
          </div>
        ) : chartDataWithShare.length ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div
                className={[
                  "rounded-[22px] border px-4 py-4",
                  isDark
                    ? "border-white/10 bg-white/[0.03]"
                    : "border-slate-200/80 bg-slate-50/80",
                ].join(" ")}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Desktop
                </div>
                <div className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">
                  {number(deviceBreakdown?.desktop)}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {percent(
                    totalSessions > 0
                      ? (Number(deviceBreakdown?.desktop || 0) / totalSessions) * 100
                      : 0,
                  )}{" "}
                  das sessoes
                </div>
              </div>
              <div
                className={[
                  "rounded-[22px] border px-4 py-4",
                  isDark
                    ? "border-white/10 bg-white/[0.03]"
                    : "border-slate-200/80 bg-slate-50/80",
                ].join(" ")}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Mobile
                </div>
                <div className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">
                  {number(deviceBreakdown?.mobile)}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {percent(
                    totalSessions > 0
                      ? (Number(deviceBreakdown?.mobile || 0) / totalSessions) * 100
                      : 0,
                  )}{" "}
                  das sessoes
                </div>
              </div>
            </div>

            <div
              className={[
                "h-80 rounded-[24px] border p-3",
                isDark
                  ? "border-white/10 bg-white/[0.02]"
                  : "border-slate-200/80 bg-white/80",
              ].join(" ")}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartDataWithShare}
                  margin={{ top: 16, right: 12, left: -12, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0"}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: isDark ? "#CBD5E1" : "#475569", fontSize: 12 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: isDark ? "#94A3B8" : "#64748B", fontSize: 12 }}
                  />
                  <RechartsTooltip content={<DeviceBreakdownTooltip />} />
                  <Bar
                    dataKey="sessions"
                    radius={[12, 12, 0, 0]}
                    maxBarSize={72}
                    isAnimationActive={false}
                  >
                    {chartDataWithShare.map((item) => (
                      <Cell key={item.key} fill={item.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              Total considerado: {number(totalSessions)} sessoes com page view.
            </div>
          </>
        ) : (
          <EmptyState
            title="Sem dados de dispositivo"
            description="O grafico vai aparecer quando houver sessoes registradas com page view no periodo."
          />
        )}
      </CardBody>
    </Card>
  );
}

function InlineHelpTooltip({ id, text }) {
  const { isDark } = useThemeToggle();

  return (
    <span className="group relative inline-flex shrink-0 align-middle">
      <button
        type="button"
        aria-label={text}
        aria-describedby={id}
        className={[
          "inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold transition outline-none",
          isDark
            ? "border-white/14 bg-white/6 text-slate-200 hover:bg-white/10 focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-400/30"
            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500/20",
        ].join(" ")}
      >
        ?
      </button>
      <span
        id={id}
        role="tooltip"
        className={[
          "pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-60 -translate-x-1/2 rounded-2xl px-3 py-2 text-left text-xs font-medium leading-5 opacity-0 shadow-lg transition duration-150 translate-y-1",
          "group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100",
          isDark
            ? "border border-white/10 bg-slate-950 text-slate-100"
            : "border border-slate-200 bg-white text-slate-700",
        ].join(" ")}
      >
        {text}
      </span>
    </span>
  );
}

function FunnelCard({ funnel = [], loading }) {
  const maxSessions = Math.max(
    1,
    ...funnel.map((item) => Number(item?.sessions || 0)),
  );

  return (
    <Card className="rounded-[24px]">
      <CardHeader
        title="Funil e abandono"
        subtitle="Queda entre entrada, clique, intencao e conversao."
      />
      <CardBody className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-2xl" />
          ))
        ) : funnel.length ? (
          funnel.map((item) => (
            <div key={item.key} className="rounded-[22px] border border-slate-200/80 px-4 py-4 dark:border-white/10">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-slate-950 dark:text-white">
                      {item.label}
                    </div>
                    {FUNNEL_HELP_TEXT[item.key] ? (
                      <InlineHelpTooltip
                        id={`funnel-help-${item.key}`}
                        text={FUNNEL_HELP_TEXT[item.key]}
                      />
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {number(item.sessions)} sessoes
                  </div>
                </div>
                <Badge tone={item.dropoffPct > 0 ? "ACCEPTED" : "PAID"}>
                  {item.dropoffPct > 0
                    ? `Drop-off ${percent(item.dropoffPct)}`
                    : "Etapa inicial"}
                </Badge>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(135deg,#2563eb,#0f766e)]"
                  style={{
                    width: `${Math.max(
                      8,
                      Math.round((Number(item.sessions || 0) / maxSessions) * 100),
                    )}%`,
                  }}
                />
              </div>

              <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Perda na etapa: {number(item.dropoffCount)} sessoes
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            title="Funil ainda vazio"
            description="Os eventos detalhados vao aparecer conforme o novo tracking entrar em uso."
          />
        )}
      </CardBody>
    </Card>
  );
}

function getCountryFill(clicks, maxClicks, isDark) {
  const value = Number(clicks || 0);
  if (value <= 0) return isDark ? "rgba(148,163,184,0.12)" : "#E2E8F0";
  const intensity = Math.max(0.18, value / Math.max(maxClicks, 1));
  if (isDark) {
    return `rgba(34,197,94,${Math.min(0.9, 0.16 + intensity * 0.84)})`;
  }
  return `rgba(37,99,235,${Math.min(0.9, 0.12 + intensity * 0.88)})`;
}

function GeoPieTooltip({ active, payload }) {
  const { isDark } = useThemeToggle();
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;
  return (
    <div
      className={[
        "rounded-2xl border px-3 py-2 text-xs shadow-lg",
        isDark
          ? "border-white/10 bg-slate-950 text-slate-100"
          : "border-slate-200 bg-white text-slate-700",
      ].join(" ")}
    >
      <div className="font-semibold">{item.label}</div>
      <div className="mt-1">Cliques: {number(item.value)}</div>
      <div>Participação: {percent(item.share)}</div>
    </div>
  );
}

function GeoHoverTooltip({ item, mode, position }) {
  const { isDark } = useThemeToggle();
  if (!item || !position) return null;
  const tooltipWidth = 208;
  const tooltipHeight = 124;
  const offsetX = 14;
  const offsetY = 14;
  const containerWidth = Number(position.containerWidth || 0);
  const containerHeight = Number(position.containerHeight || 0);
  const cursorX = Number(position.x || 0);
  const cursorY = Number(position.y || 0);
  const maxLeft = Math.max(12, containerWidth - tooltipWidth - 12);
  const maxTop = Math.max(12, containerHeight - tooltipHeight - 12);
  const preferredRightLeft = cursorX + offsetX;
  const preferredLeftLeft = cursorX - tooltipWidth - offsetX;
  const preferredTop = cursorY - tooltipHeight - offsetY;
  const preferredBottom = cursorY + offsetY;
  const left =
    preferredRightLeft <= maxLeft
      ? Math.max(12, preferredRightLeft)
      : Math.max(12, Math.min(maxLeft, preferredLeftLeft));
  const top =
    preferredTop >= 12
      ? preferredTop
      : Math.max(12, Math.min(maxTop, preferredBottom));

  const title =
    mode === "world"
      ? item.countryName || item.countryCode || "Desconhecido"
      : getStateDisplayName(item.state);

  return (
    <div
      className={[
        "pointer-events-none absolute z-20 w-52 rounded-[20px] border px-3 py-3 text-xs shadow-xl",
        isDark
          ? "border-white/10 bg-slate-950/96 text-slate-100"
          : "border-slate-200 bg-white/96 text-slate-700",
      ].join(" ")}
      style={{
        left,
        top,
      }}
    >
      <div className="font-semibold text-slate-950 dark:text-white">{title}</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Visitas
          </div>
          <div className="mt-1 font-bold">{number(item.visits)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Cliques
          </div>
          <div className="mt-1 font-bold">{number(item.clicks)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Leads
          </div>
          <div className="mt-1 font-bold">{number(item.leads)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Vendas
          </div>
          <div className="mt-1 font-bold">{number(item.sales)}</div>
        </div>
      </div>
    </div>
  );
}

function GeoMiniList({
  title,
  subtitle,
  items = [],
  loading = false,
  emptyText,
  onSelect = null,
  selectedKey = "",
  getItemKey = (item) => item?.key || "",
  getItemLabel = (item) => item?.label || "",
  getItemMeta = () => "",
}) {
  const { isDark } = useThemeToggle();

  return (
    <div
      className={[
        "rounded-[24px] border p-4",
        isDark
          ? "border-white/10 bg-white/[0.03]"
          : "border-slate-200/80 bg-white/80",
      ].join(" ")}
    >
      <div className="text-sm font-semibold text-slate-950 dark:text-white">{title}</div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>
      {loading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length ? (
        <div className="mt-4 space-y-2">
          {items.map((item, index) => {
            const key = getItemKey(item) || `${title}:${index}`;
            const selected = selectedKey && selectedKey === key;
            const Component = onSelect ? "button" : "div";
            return (
              <Component
                key={key}
                type={onSelect ? "button" : undefined}
                onClick={onSelect ? () => onSelect(item) : undefined}
                className={[
                  "flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition",
                  selected
                    ? isDark
                      ? "border-sky-400/40 bg-sky-500/10"
                      : "border-sky-300 bg-sky-50"
                    : isDark
                      ? "border-white/8 bg-white/[0.02] hover:bg-white/[0.05]"
                      : "border-slate-200/70 bg-slate-50/70 hover:bg-slate-100/80",
                  onSelect ? "cursor-pointer" : "",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                    {getItemLabel(item)}
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                    {getItemMeta(item)}
                  </div>
                </div>
                <div className="pl-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                  {number(item?.clicks)}
                </div>
              </Component>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">{emptyText}</div>
      )}
    </div>
  );
}

function GeographyMap({
  countries = [],
  states = [],
  cities = [],
  loading = false,
  coverageStartedAt = null,
}) {
  const { isDark } = useThemeToggle();
  const mapContainerRef = useRef(null);
  const [mode, setMode] = useState("world");
  const [selectedCountryKey, setSelectedCountryKey] = useState("");
  const [selectedStateKey, setSelectedStateKey] = useState("");
  const [hoveredGeoMeta, setHoveredGeoMeta] = useState(null);

  useEffect(() => {
    setSelectedCountryKey("");
    setSelectedStateKey("");
    setHoveredGeoMeta(null);
  }, [mode]);

  const countryMap = useMemo(
    () =>
      new Map(
        countries.map((item) => [
          normalizeCountryName(item?.countryName || item?.countryCode || ""),
          item,
        ]),
      ),
    [countries],
  );

  const stateMap = useMemo(
    () =>
      new Map(
        states.map((item) => [normalizeStateName(item?.state || ""), item]),
      ),
    [states],
  );

  const selectedCountry = useMemo(
    () =>
      countries.find(
        (item) =>
          normalizeCountryName(item?.countryName || item?.countryCode || "") ===
          selectedCountryKey,
      ) || null,
    [countries, selectedCountryKey],
  );

  const selectedState = useMemo(
    () =>
      states.find((item) => normalizeStateName(item?.state || "") === selectedStateKey) ||
      null,
    [states, selectedStateKey],
  );

  const brazilCities = useMemo(
    () => cities.filter((item) => String(item?.countryCode || "") === "BR"),
    [cities],
  );

  const filteredCities = useMemo(() => {
    if (mode === "world") {
      if (!selectedCountry) return cities;
      return cities.filter(
        (item) =>
          String(item?.countryCode || "") === String(selectedCountry.countryCode || "") ||
          normalizeCountryName(item?.countryName || "") ===
            normalizeCountryName(selectedCountry.countryName || ""),
      );
    }
    if (!selectedState) return brazilCities;
    return brazilCities.filter(
      (item) => normalizeStateName(item?.region || "") === selectedStateKey,
    );
  }, [brazilCities, cities, mode, selectedCountry, selectedState, selectedStateKey]);

  const pieData = useMemo(() => {
    const source =
      mode === "world"
        ? countries
        : selectedState
          ? filteredCities
          : states;
    const total = source.reduce((sum, item) => sum + Number(item?.clicks || 0), 0);
    return source
      .filter((item) => Number(item?.clicks || 0) > 0)
      .slice(0, 8)
      .map((item, index) => ({
        key:
          mode === "world"
            ? item?.countryCode || `country:${index}`
            : selectedState
              ? `${item?.city || "cidade"}:${index}`
              : normalizeStateName(item?.state || ""),
        label:
          mode === "world"
            ? item?.countryName || item?.countryCode || "Desconhecido"
            : selectedState
              ? item?.city || "Cidade"
              : getStateDisplayName(item?.state),
        value: Number(item?.clicks || 0),
        share:
          total > 0 ? Number(((Number(item?.clicks || 0) / total) * 100).toFixed(2)) : 0,
        fill: GEO_CHART_COLORS[index % GEO_CHART_COLORS.length],
      }));
  }, [countries, filteredCities, mode, selectedState, states]);

  const activeMapRows = mode === "world" ? countries : states;
  const maxClicks = useMemo(
    () => Math.max(1, ...activeMapRows.map((item) => Number(item?.clicks || 0))),
    [activeMapRows],
  );

  const insightItem = mode === "world" ? selectedCountry : selectedState;
  const geoTitle = mode === "world" ? "Mapa mundi" : "Brasil por estado";
  const geoSubtitle =
    mode === "world"
      ? "Distribuicao visual dos cliques por pais."
      : selectedState
        ? `Distribuicao dos cliques em ${getStateDisplayName(selectedState.state)} com foco nas cidades.`
        : "Distribuicao visual dos cliques por estado do Brasil.";
  const topAreaTitle = mode === "world" ? "Top paises" : "Top estados";
  const topAreaSubtitle =
    mode === "world"
      ? "Paises com maior volume recente."
      : "Estados brasileiros com maior volume recente.";

  function buildHoverPosition(event, item) {
    const container = mapContainerRef.current;
    if (!item || !container) return null;
    const rect = container.getBoundingClientRect();
    return {
      item,
      x: Number(event?.clientX || 0) - rect.left,
      y: Number(event?.clientY || 0) - rect.top,
      containerWidth: rect.width,
      containerHeight: rect.height,
    };
  }

  return (
    <Card className="rounded-[24px]">
      <CardHeader
        title={geoTitle}
        subtitle={geoSubtitle}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-white/[0.04]">
              <button
                type="button"
                onClick={() => setMode("world")}
                className={[
                  "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                  mode === "world"
                    ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                    : "text-slate-600 dark:text-slate-300",
                ].join(" ")}
              >
                Mundo
              </button>
              <button
                type="button"
                onClick={() => setMode("brazil")}
                className={[
                  "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                  mode === "brazil"
                    ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                    : "text-slate-600 dark:text-slate-300",
                ].join(" ")}
              >
                Brasil
              </button>
            </div>
            {coverageStartedAt ? (
              <Badge tone="INFO">
                Tracking detalhado desde{" "}
                {new Date(coverageStartedAt).toLocaleDateString("pt-BR")}
              </Badge>
            ) : null}
          </div>
        }
      />
      <CardBody className="space-y-5">
        {loading ? (
          <Skeleton className="h-[380px] w-full rounded-[28px]" />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_360px]">
            <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_36%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.72))] p-4 dark:border-white/10 dark:bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.18),transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.56))]">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Visual geografico
                  </div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {mode === "world"
                      ? selectedCountry
                        ? `Pais ativo: ${selectedCountry.countryName || selectedCountry.countryCode}`
                        : "Clique em um pais para filtrar as cidades ao lado."
                      : selectedState
                        ? `Estado ativo: ${getStateDisplayName(selectedState.state)}`
                        : "Clique em um estado para focar nas cidades da regiao."}
                  </div>
                </div>
                {(selectedCountryKey || selectedStateKey) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedCountryKey("");
                      setSelectedStateKey("");
                      setHoveredGeoMeta(null);
                    }}
                  >
                    Limpar foco
                  </Button>
                )}
              </div>
              <div ref={mapContainerRef} className="relative">
                <ComposableMap
                  projection={mode === "world" ? undefined : "geoMercator"}
                  projectionConfig={
                    mode === "world"
                      ? { scale: 150 }
                      : {
                          scale: 620,
                          center: [-54, -15],
                        }
                  }
                  className="h-[360px] w-full"
                >
                  <Geographies geography={mode === "world" ? GEO_URL : BRAZIL_GEO_URL}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const geoName =
                          geo?.properties?.name ||
                          geo?.properties?.NAME ||
                          geo?.properties?.admin ||
                          "";
                        const item =
                          mode === "world"
                            ? countryMap.get(normalizeCountryName(geoName))
                            : stateMap.get(normalizeStateName(geoName));
                        const isSelected =
                          mode === "world"
                            ? selectedCountryKey &&
                              selectedCountryKey === normalizeCountryName(geoName)
                            : selectedStateKey &&
                              selectedStateKey === normalizeStateName(geoName);
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onMouseEnter={(event) => {
                              if (!item) return;
                              setHoveredGeoMeta(buildHoverPosition(event, item));
                            }}
                            onMouseMove={(event) => {
                              if (!item) return;
                              setHoveredGeoMeta(buildHoverPosition(event, item));
                            }}
                            onMouseLeave={() => setHoveredGeoMeta(null)}
                            onClick={() => {
                              if (!item) return;
                              if (mode === "world") {
                                const nextKey = normalizeCountryName(
                                  item.countryName || item.countryCode || geoName,
                                );
                                setSelectedCountryKey((current) =>
                                  current === nextKey ? "" : nextKey,
                                );
                                return;
                              }
                              const nextKey = normalizeStateName(item.state || geoName);
                              setSelectedStateKey((current) =>
                                current === nextKey ? "" : nextKey,
                              );
                            }}
                            style={{
                              default: {
                                fill: isSelected
                                  ? isDark
                                    ? "rgba(125,211,252,0.82)"
                                    : "#0EA5E9"
                                  : getCountryFill(item?.clicks, maxClicks, isDark),
                                stroke: isDark ? "rgba(255,255,255,0.1)" : "#CBD5E1",
                                strokeWidth: isSelected ? 1.2 : 0.6,
                                outline: "none",
                                cursor: item ? "pointer" : "default",
                              },
                              hover: {
                                fill: isDark ? "rgba(56,189,248,0.72)" : "#38BDF8",
                                stroke: isDark ? "rgba(255,255,255,0.16)" : "#94A3B8",
                                strokeWidth: 0.9,
                                outline: "none",
                                cursor: item ? "pointer" : "default",
                              },
                              pressed: {
                                fill: isDark ? "rgba(56,189,248,0.82)" : "#0EA5E9",
                                outline: "none",
                              },
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ComposableMap>
                <GeoHoverTooltip
                  item={hoveredGeoMeta?.item || null}
                  mode={mode}
                  position={hoveredGeoMeta}
                />
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Contexto atual
                </div>
                {insightItem ? (
                  <div className="mt-4 space-y-2">
                    <div className="text-lg font-semibold text-slate-950 dark:text-white">
                      {mode === "world"
                        ? insightItem.countryName || insightItem.countryCode
                        : getStateDisplayName(insightItem.state)}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-white/[0.04]">
                        <div className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          Visitas
                        </div>
                        <div className="mt-1 font-bold text-slate-900 dark:text-white">
                          {number(insightItem.visits)}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-white/[0.04]">
                        <div className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          Cliques
                        </div>
                        <div className="mt-1 font-bold text-slate-900 dark:text-white">
                          {number(insightItem.clicks)}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-white/[0.04]">
                        <div className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          Leads
                        </div>
                        <div className="mt-1 font-bold text-slate-900 dark:text-white">
                          {number(insightItem.leads)}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-white/[0.04]">
                        <div className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          Vendas
                        </div>
                        <div className="mt-1 font-bold text-slate-900 dark:text-white">
                          {number(insightItem.sales)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                    {mode === "world"
                      ? "Clique em um pais para fixar o contexto e ver detalhes."
                      : "Clique em um estado para fixar o contexto e aprofundar a leitura."}
                  </div>
                )}
              </div>

              <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Distribuicao de cliques
                </div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {mode === "world"
                    ? "Participacao por pais."
                    : selectedState
                      ? `Participacao por cidade em ${getStateDisplayName(selectedState.state)}.`
                      : "Participacao por estado no Brasil."}
                </div>
                {pieData.length ? (
                  <div className="mt-4 h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="label"
                          innerRadius={58}
                          outerRadius={92}
                          paddingAngle={2}
                        >
                          {pieData.map((item) => (
                            <Cell key={item.key} fill={item.fill} />
                          ))}
                        </Pie>
                        <RechartsTooltip content={<GeoPieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                    Ainda nao ha cliques suficientes para montar o grafico neste recorte.
                  </div>
                )}
                {pieData.length ? (
                  <div className="mt-3 space-y-2">
                    {pieData.slice(0, 5).map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: item.fill }}
                          />
                          <span className="truncate text-slate-700 dark:text-slate-200">
                            {item.label}
                          </span>
                        </div>
                        <span className="shrink-0 font-semibold text-slate-900 dark:text-white">
                          {percent(item.share)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-2">
          <GeoMiniList
            title={topAreaTitle}
            subtitle={topAreaSubtitle}
            loading={loading}
            items={(mode === "world" ? countries : states).slice(0, 8)}
            emptyText={
              mode === "world"
                ? "Os paises vao aparecer conforme os eventos detalhados forem sendo coletados."
                : "Os estados vao aparecer conforme eventos do Brasil forem acumulados."
            }
            onSelect={(item) => {
              if (mode === "world") {
                const nextKey = normalizeCountryName(
                  item?.countryName || item?.countryCode || "",
                );
                setSelectedCountryKey((current) => (current === nextKey ? "" : nextKey));
                return;
              }
              const nextKey = normalizeStateName(item?.state || "");
              setSelectedStateKey((current) => (current === nextKey ? "" : nextKey));
            }}
            selectedKey={mode === "world" ? selectedCountryKey : selectedStateKey}
            getItemKey={(item) =>
              mode === "world"
                ? normalizeCountryName(item?.countryName || item?.countryCode || "")
                : normalizeStateName(item?.state || "")
            }
            getItemLabel={(item) =>
              mode === "world"
                ? item?.countryName || item?.countryCode || "Desconhecido"
                : getStateDisplayName(item?.state)
            }
            getItemMeta={(item) =>
              `Visitas ${number(item?.visits)} • Leads ${number(item?.leads)} • Vendas ${number(item?.sales)}`
            }
          />
          <GeoMiniList
            title={selectedState ? "Cidades do estado" : "Top cidades"}
            subtitle={
              selectedState
                ? `Cidades com mais cliques em ${getStateDisplayName(selectedState.state)}.`
                : mode === "world" && selectedCountry
                  ? `Cidades com mais cliques em ${selectedCountry.countryName || selectedCountry.countryCode}.`
                  : "Cidades com maior volume recente."
            }
            loading={loading}
            items={filteredCities.slice(0, 8).map((item, index) => ({
              ...item,
              key: `${item?.city || "cidade"}:${item?.region || ""}:${index}`,
            }))}
            emptyText="As cidades vao aparecer conforme o geo tracking comecar a acumular dados."
            getItemKey={(item) => item?.key || ""}
            getItemLabel={(item) =>
              [item?.city, item?.region, item?.countryName].filter(Boolean).join(", ")
            }
            getItemMeta={(item) =>
              `Pais ${item?.countryName || item?.countryCode || "Desconhecido"}`
            }
          />
        </div>
      </CardBody>
    </Card>
  );
}

export default function MyPageReportsPage() {
  const { isDark } = useThemeToggle();
  const { perms, user } = useAuth();
  const now = useMemo(() => new Date(), []);
  const ownerId = String(user?._id || "").trim();
  const isOwnerTeamView =
    perms?.isWorkspaceOwner === true && perms?.isWorkspaceTeamPlan === true;

  const [range, setRange] = useState("30d");
  const [from, setFrom] = useState(toYMD(addDays(now, -29)));
  const [to, setTo] = useState(toYMD(now));
  const [pageId, setPageId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [scopeTab, setScopeTab] = useState("mine");
  const [teamOwnerFilter, setTeamOwnerFilter] = useState("all");
  const [workspaceUsers, setWorkspaceUsers] = useState([]);
  const [teamUsersBusy, setTeamUsersBusy] = useState(false);

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

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const response = await getMyPageReportsAnalytics({
          range,
          from,
          to,
          pageId,
          scope: appliedScope,
          ownerUserId: selectedOwnerUserId,
        });
        if (!alive) return;
        setData(response || null);
      } catch (err) {
        if (!alive) return;
        setError(err?.data?.error || err?.message || "Falha ao carregar analytics.");
        setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [appliedScope, from, pageId, range, selectedOwnerUserId, to]);

  function applyPreset(nextRange) {
    setRange(nextRange);
    if (nextRange === "custom") return;

    const endDate = new Date();
    const nextTo = toYMD(endDate);
    const offsets = {
      "7d": -6,
      "30d": -29,
      "90d": -89,
    };
    setFrom(toYMD(addDays(endDate, offsets[nextRange] || -29)));
    setTo(nextTo);
  }

  const overview = data?.overview || {};
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  const sources = Array.isArray(data?.sources) ? data.sources : [];
  const topButtons = Array.isArray(data?.topButtons) ? data.topButtons : [];
  const topBlocks = Array.isArray(data?.topBlocks) ? data.topBlocks : [];
  const topServices = Array.isArray(data?.topServices) ? data.topServices : [];
  const topProducts = Array.isArray(data?.topProducts) ? data.topProducts : [];
  const topPages = Array.isArray(data?.topPages) ? data.topPages : [];
  const funnel = Array.isArray(data?.funnel) ? data.funnel : [];
  const deviceBreakdown =
    data?.deviceBreakdown && typeof data.deviceBreakdown === "object"
      ? data.deviceBreakdown
      : {
          totalSessions: 0,
          desktop: 0,
          mobile: 0,
          tablet: 0,
          other: 0,
        };
  const countries = Array.isArray(data?.geography?.countries)
    ? data.geography.countries
    : [];
  const states = Array.isArray(data?.geography?.states) ? data.geography.states : [];
  const cities = Array.isArray(data?.geography?.cities) ? data.geography.cities : [];
  const notices = Array.isArray(data?.notices) ? data.notices : [];

  return (
    <Shell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Relatorios"
          title="Minha Pagina"
          subtitle="Aquisicao, cliques, conversao, funil e origem das vendas da sua pagina publica."
          actions={
            <Link
              to="/reports"
              className={[
                "inline-flex h-10 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition",
                isDark
                  ? "border-white/10 bg-white/5 text-white hover:bg-white/10"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              Voltar aos relatorios
            </Link>
          }
        />

        <Card className="rounded-[24px]">
          <CardHeader
            title="Filtros"
            subtitle="Ajuste periodo, pagina e escopo do relatorio."
          />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {["7d", "30d", "90d", "custom"].map((preset) => (
                <Button
                  key={preset}
                  variant={range === preset ? "primary" : "secondary"}
                  onClick={() => applyPreset(preset)}
                >
                  {preset === "custom" ? "Custom" : preset.toUpperCase()}
                </Button>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-4">
              <label className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Pagina
                </div>
                <select
                  value={pageId}
                  onChange={(event) => setPageId(event.target.value)}
                  className={selectClassName(isDark)}
                >
                  <option value="all">Todas</option>
                  {pages.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.title || item.slug || item._id}
                    </option>
                  ))}
                </select>
              </label>

              {range === "custom" ? (
                <>
                  <label className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      De
                    </div>
                    <input
                      type="date"
                      value={from}
                      onChange={(event) => setFrom(event.target.value)}
                      className={inputClassName(isDark)}
                    />
                  </label>
                  <label className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      Ate
                    </div>
                    <input
                      type="date"
                      value={to}
                      onChange={(event) => setTo(event.target.value)}
                      className={inputClassName(isDark)}
                    />
                  </label>
                </>
              ) : null}

              {isOwnerTeamView ? (
                <>
                  <label className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      Escopo
                    </div>
                    <select
                      value={scopeTab}
                      onChange={(event) => setScopeTab(event.target.value)}
                      className={selectClassName(isDark)}
                    >
                      <option value="mine">Minha carteira</option>
                      <option value="workspace">Equipe</option>
                    </select>
                  </label>

                  {scopeTab === "workspace" ? (
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Responsavel
                      </div>
                      <select
                        value={teamOwnerFilter}
                        onChange={(event) => setTeamOwnerFilter(event.target.value)}
                        className={selectClassName(isDark)}
                        disabled={teamUsersBusy}
                      >
                        <option value="all">Toda a equipe</option>
                        <option value="me">Somente eu</option>
                        {workspaceUsers.map((item) => (
                          <option key={item._id} value={item._id}>
                            {item.name || item.email || item._id}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </>
              ) : null}
            </div>

            {notices.length ? (
              <div className="rounded-[22px] border border-sky-200/80 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">
                {notices[0]}
              </div>
            ) : null}
          </CardBody>
        </Card>

        {error ? (
          <EmptyState
            title="Nao foi possivel carregar"
            description={error}
          />
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Visitas"
            subtitle="Sessoes com page view."
            value={number(overview.visits)}
            loading={loading}
          />
          <MetricCard
            title="Visitantes unicos"
            subtitle="visitorId distintos."
            value={number(overview.uniqueVisitors)}
            loading={loading}
          />
          <MetricCard
            title="Cliques"
            subtitle="CTAs e links secundarios."
            value={number(overview.clicks)}
            loading={loading}
          />
          <MetricCard
            title="Pedidos de orcamento"
            subtitle="quote_submit."
            value={number(overview.quoteRequests)}
            loading={loading}
          />
          <MetricCard
            title="Agendamentos"
            subtitle="booking_submit."
            value={number(overview.bookings)}
            loading={loading}
          />
          <MetricCard
            title="Vendas"
            subtitle="Ofertas pagas atribuidas."
            value={number(overview.sales)}
            loading={loading}
          />
          <MetricCard
            title="Receita"
            subtitle="Total atribuido a Minha Pagina."
            value={money(overview.revenueCents)}
            loading={loading}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
          <TableCard
            title="Origem"
            subtitle="Aquisicao por fonte da sessao."
            loading={loading}
            rows={sources.map((item) => ({ key: item.sourceBucket, ...item }))}
            emptyText="As origens detalhadas vao aparecer conforme o novo tracking entrar em uso."
            columns={[
              {
                key: "sourceBucket",
                label: "Origem",
              },
              {
                key: "visits",
                label: "Visitas",
                render: (row) => number(row.visits),
              },
              {
                key: "leads",
                label: "Leads",
                render: (row) => number(row.leads),
              },
              {
                key: "sales",
                label: "Vendas",
                render: (row) => number(row.sales),
              },
              {
                key: "revenueCents",
                label: "Receita",
                render: (row) => money(row.revenueCents),
              },
            ]}
          />

          <DeviceBreakdownCard
            deviceBreakdown={deviceBreakdown}
            loading={loading}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <TableCard
            title="Top botoes"
            subtitle="Quais botoes recebem mais clique."
            loading={loading}
            rows={topButtons.map((item, index) => ({ key: `${item.buttonKey}:${index}`, ...item }))}
            emptyText="Os botoes mais clicados aparecem assim que o tracking detalhado comecar a registrar toques."
            columns={[
              {
                key: "buttonLabel",
                label: "Botao",
                render: (row) => row.buttonLabel || row.buttonKey || "Botao sem nome",
              },
              {
                key: "buttonType",
                label: "Tipo",
                render: (row) => row.buttonType || "-",
              },
              {
                key: "clicks",
                label: "Cliques",
                render: (row) => number(row.clicks),
              },
            ]}
          />

          <TableCard
            title="Top blocos"
            subtitle="Blocos com melhor geracao de lead."
            loading={loading}
            rows={topBlocks.map((item) => ({ key: item.blockKey, ...item }))}
            emptyText="Os blocos mais fortes aparecem quando o novo tracking registrar page views, block views e conversoes."
            columns={[
              {
                key: "label",
                label: "Bloco",
              },
              {
                key: "views",
                label: "Views",
                render: (row) => number(row.views),
              },
              {
                key: "leads",
                label: "Leads",
                render: (row) => number(row.leads),
              },
              {
                key: "conversionRate",
                label: "Conv.",
                render: (row) => percent(row.conversionRate),
              },
            ]}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <TableCard
            title="Top produtos"
            subtitle="Produtos com mais abertura, lead e venda."
            loading={loading}
            rows={topProducts.map((item) => ({ key: item.productId, ...item }))}
            emptyText="Os produtos entram no ranking conforme catalogo, orcamento e vendas atribuidas forem se conectando."
            columns={[
              {
                key: "label",
                label: "Produto",
              },
              {
                key: "opens",
                label: "Aberturas",
                render: (row) => number(row.opens),
              },
              {
                key: "leads",
                label: "Leads",
                render: (row) => number(row.leads),
              },
              {
                key: "sales",
                label: "Vendas",
                render: (row) => number(row.sales),
              },
            ]}
          />

          <TableCard
            title="Top servicos e fluxos"
            subtitle="Entradas que mais geram lead, venda e receita."
            loading={loading}
            rows={topServices.map((item) => ({ key: item.key, ...item }))}
            emptyText="Os servicos e fluxos vao aparecer conforme os envios, agendamentos e vendas com tracking detalhado forem entrando."
            columns={[
              {
                key: "label",
                label: "Fluxo",
              },
              {
                key: "kind",
                label: "Tipo",
                render: (row) => row.kind || "-",
              },
              {
                key: "leads",
                label: "Leads",
                render: (row) => number(row.leads),
              },
              {
                key: "sales",
                label: "Vendas",
                render: (row) => number(row.sales),
              },
            ]}
          />

          <TableCard
            title="Top paginas"
            subtitle="Quais paginas da experiencia convertem melhor."
            loading={loading}
            rows={topPages.map((item) => ({ key: item.pageId, ...item }))}
            emptyText="As paginas vao aparecer conforme o tracking detalhado registrar fluxo entre home, quote, schedule, catalogo e pay."
            columns={[
              {
                key: "label",
                label: "Pagina",
                render: (row) => (
                  <div>
                    <div>{row.label}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {row.subtitle || "-"}
                    </div>
                  </div>
                ),
              },
              {
                key: "visits",
                label: "Visitas",
                render: (row) => number(row.visits),
              },
              {
                key: "leads",
                label: "Leads",
                render: (row) => number(row.leads),
              },
              {
                key: "revenueCents",
                label: "Receita",
                render: (row) => money(row.revenueCents),
              },
            ]}
          />
        </div>

        <FunnelCard funnel={funnel} loading={loading} />

        <GeographyMap
          countries={countries}
          states={states}
          cities={cities}
          loading={loading}
          coverageStartedAt={data?.coverage?.startedAt || null}
        />
      </div>
    </Shell>
  );
}
