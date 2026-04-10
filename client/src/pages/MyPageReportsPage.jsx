import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
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

function GeographyMap({
  countries = [],
  cities = [],
  loading = false,
  coverageStartedAt = null,
}) {
  const { isDark } = useThemeToggle();
  const [hoveredCountry, setHoveredCountry] = useState(null);

  const countryMap = useMemo(() => {
    return new Map(
      countries.map((item) => [
        normalizeCountryName(item?.countryName || item?.countryCode || ""),
        item,
      ]),
    );
  }, [countries]);

  const maxClicks = useMemo(
    () => Math.max(1, ...countries.map((item) => Number(item?.clicks || 0))),
    [countries],
  );

  return (
    <Card className="rounded-[24px]">
      <CardHeader
        title="Mapa mundi"
        subtitle="Distribuicao visual dos cliques por pais."
        right={
          coverageStartedAt ? (
            <Badge tone="INFO">
              Tracking detalhado desde{" "}
              {new Date(coverageStartedAt).toLocaleDateString("pt-BR")}
            </Badge>
          ) : null
        }
      />
      <CardBody className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_320px]">
        {loading ? (
          <Skeleton className="h-[380px] w-full rounded-[28px]" />
        ) : (
          <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.88),rgba(255,255,255,0.72))] p-3 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.6),rgba(2,6,23,0.45))]">
            <ComposableMap
              projectionConfig={{ scale: 150 }}
              className="h-[340px] w-full"
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const geoName =
                      geo?.properties?.name ||
                      geo?.properties?.NAME ||
                      geo?.properties?.admin ||
                      "";
                    const country = countryMap.get(normalizeCountryName(geoName));
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onMouseEnter={() => setHoveredCountry(country || null)}
                        onMouseLeave={() => setHoveredCountry(null)}
                        style={{
                          default: {
                            fill: getCountryFill(country?.clicks, maxClicks, isDark),
                            stroke: isDark ? "rgba(255,255,255,0.08)" : "#CBD5E1",
                            strokeWidth: 0.5,
                            outline: "none",
                          },
                          hover: {
                            fill: isDark ? "rgba(56,189,248,0.65)" : "#38BDF8",
                            stroke: isDark ? "rgba(255,255,255,0.12)" : "#94A3B8",
                            strokeWidth: 0.7,
                            outline: "none",
                          },
                          pressed: {
                            fill: isDark ? "rgba(56,189,248,0.75)" : "#0EA5E9",
                            outline: "none",
                          },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            </ComposableMap>
          </div>
        )}

        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200/80 p-4 dark:border-white/10">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Tooltip
            </div>
            {hoveredCountry ? (
              <div className="mt-3 space-y-2 text-sm">
                <div className="text-base font-semibold text-slate-950 dark:text-white">
                  {hoveredCountry.countryName || hoveredCountry.countryCode}
                </div>
                <div className="text-slate-600 dark:text-slate-300">
                  Visitas: {number(hoveredCountry.visits)}
                </div>
                <div className="text-slate-600 dark:text-slate-300">
                  Cliques: {number(hoveredCountry.clicks)}
                </div>
                <div className="text-slate-600 dark:text-slate-300">
                  Leads: {number(hoveredCountry.leads)}
                </div>
                <div className="text-slate-600 dark:text-slate-300">
                  Vendas: {number(hoveredCountry.sales)}
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Passe o mouse sobre um pais para ver os detalhes.
              </div>
            )}
          </div>

          <TableCard
            title="Top paises"
            subtitle="Paises com maior volume recente."
            loading={loading}
            rows={countries.slice(0, 8).map((item) => ({
              key: item.countryCode,
              ...item,
            }))}
            emptyText="Os paises vao aparecer conforme os eventos detalhados forem sendo coletados."
            columns={[
              {
                key: "countryName",
                label: "Pais",
                render: (row) => row.countryName || row.countryCode || "Desconhecido",
              },
              {
                key: "clicks",
                label: "Cliques",
                render: (row) => number(row.clicks),
              },
              {
                key: "sales",
                label: "Vendas",
                render: (row) => number(row.sales),
              },
            ]}
          />

          <TableCard
            title="Top cidades"
            subtitle="Cidades com mais cliques."
            loading={loading}
            rows={cities.map((item, index) => ({
              key: `${item.city}:${index}`,
              ...item,
            }))}
            emptyText="As cidades vao aparecer conforme o geo tracking comecar a acumular dados."
            columns={[
              {
                key: "city",
                label: "Cidade",
                render: (row) =>
                  [row.city, row.region, row.countryName].filter(Boolean).join(", "),
              },
              {
                key: "clicks",
                label: "Cliques",
                render: (row) => number(row.clicks),
              },
            ]}
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
  const countries = Array.isArray(data?.geography?.countries)
    ? data.geography.countries
    : [];
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
          cities={cities}
          loading={loading}
          coverageStartedAt={data?.coverage?.startedAt || null}
        />
      </div>
    </Shell>
  );
}
