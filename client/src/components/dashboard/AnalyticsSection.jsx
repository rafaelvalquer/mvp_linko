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
import useThemeToggle from "../../app/useThemeToggle.js";

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

// Light + dark friendly badges (used in legend + tooltip)
const MAP = {
  PUBLIC:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:border-blue-500/30",
  ACCEPTED:
    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/30",
  EXPIRED:
    "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-500/10 dark:text-zinc-200 dark:border-zinc-500/25",
  DRAFT:
    "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-500/10 dark:text-zinc-200 dark:border-zinc-500/25",
  HOLD: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30",
  CONFIRMED:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/30",
  CANCELED:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-200 dark:border-red-500/30",
  CANCELLED:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-200 dark:border-red-500/30",
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

const CHART_GRID_STROKE = "#d9e2ef";
const AXIS_TICK = { fontSize: 11, fill: "#64748b" };

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

// ====== AUTH ======
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
// ===================

function normStatus(v) {
  const s = String(v || "")
    .trim()
    .toUpperCase();
  if (!s) return "PUBLIC";
  if (s === "CANCELED") return "CANCELLED";
  return s;
}

function isPaidCode(code) {
  const s = normStatus(code);
  return s === "PAID" || s === "CONFIRMED";
}

// BUG FIX: pago se paymentStatus OU status
function isOfferPaid(offer) {
  const flow = offer?.status ?? offer?.offerStatus;
  const pay =
    offer?.paymentStatus ??
    offer?.payment?.status ??
    offer?.payment?.lastPixStatus ??
    offer?.pix?.status;
  return isPaidCode(flow) || isPaidCode(pay);
}

function ymdFromAny(value) {
  if (!value) return null;

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const dt = new Date(value);
  if (!Number.isFinite(dt.getTime())) return null;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_DEFAULT,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
}

function lastNDaysYMD(n) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ_DEFAULT,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d),
    );
  }
  return out;
}

function getPaidDateYMD(offer) {
  return (
    ymdFromAny(offer?.paidAt) ||
    ymdFromAny(offer?.payment?.lastPixUpdatedAt) ||
    ymdFromAny(offer?.payment?.updatedAt) ||
    ymdFromAny(offer?.updatedAt ?? offer?.updated_at) ||
    null
  );
}

function getCreatedDateYMD(offer) {
  return (
    ymdFromAny(offer?.createdAt ?? offer?.created_at) ||
    ymdFromAny(offer?.date) ||
    null
  );
}

// valor: paidAmountCents -> totalCents -> amountCents
function offerPaidAmountToCents(offer) {
  if (!offer || typeof offer !== "object") return 0;

  const cents =
    offer.paidAmountCents ??
    offer.totalCents ??
    offer.amountCents ??
    offer.total_cents ??
    offer.amount_cents;

  const nCents = Number(cents);
  if (Number.isFinite(nCents)) return Math.round(nCents);

  const brl =
    offer.paidAmount ??
    offer.total ??
    offer.amount ??
    offer.value ??
    offer.price;
  const nBrl = Number(brl);
  if (Number.isFinite(nBrl)) return Math.round(nBrl * 100);

  return 0;
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
  if (!Number.isFinite(n)) return "--";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
}

function fmtCompact(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

function fmtCompactBRL(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return `R$ ${fmtCompact(n)}`;
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function findField(rows, candidates) {
  for (const k of candidates) {
    for (const r of rows || []) {
      if (r && r[k] != null && r[k] !== "") return k;
    }
  }
  return null;
}

function normalizeMaybeCents(value, key) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (key && /cents/i.test(key)) return n / 100;
  return n;
}

function TooltipShell({ title, rows }) {
  const { isDark } = useThemeToggle();

  return (
    <div
      className={[
        "rounded-2xl border px-3 py-2",
        isDark
          ? "border-white/10 bg-slate-950 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.75)]"
          : "border-slate-200 bg-white shadow-[0_20px_40px_-24px_rgba(15,23,42,0.35)]",
      ].join(" ")}
    >
      {title ? (
        <div
          className={[
            "mb-1 text-[11px] font-semibold",
            isDark ? "text-white" : "text-slate-900",
          ].join(" ")}
        >
          {title}
        </div>
      ) : null}
      <div className="space-y-1">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-6"
          >
            <div
              className={[
                "inline-flex items-center gap-2 text-[11px]",
                isDark ? "text-slate-400" : "text-slate-500",
              ].join(" ")}
            >
              {r.color ? (
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: r.color }}
                />
              ) : null}
              <span>{r.label}</span>
            </div>
            <div
              className={[
                "text-[11px] font-semibold tabular-nums",
                isDark ? "text-white" : "text-slate-900",
              ].join(" ")}
            >
              {r.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StandardTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
}) {
  if (!active || !payload?.length) return null;
  const title = labelFormatter ? labelFormatter(label) : label;

  const rows = payload.map((p) => ({
    label: p.name || String(p.dataKey),
    value: valueFormatter ? valueFormatter(p.value) : String(p.value ?? "--"),
    color: p.color,
  }));

  return <TooltipShell title={title} rows={rows} />;
}

function PieTooltipFactory({ total }) {
  return function PieTooltip({ active, payload }) {
    const { isDark } = useThemeToggle();

    if (!active || !payload?.length) return null;
    const p = payload[0]?.payload;
    const code = normStatus(p?.status);
    const count = Number(p?.count) || 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;

    return (
      <div
        className={[
          "rounded-2xl border px-3 py-2",
          isDark
            ? "border-white/10 bg-slate-950 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.75)]"
            : "border-slate-200 bg-white shadow-[0_20px_40px_-24px_rgba(15,23,42,0.35)]",
        ].join(" ")}
      >
        <div className="mb-2 flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: statusFill(code, 0) }}
          />
          <span
            className={[
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              statusBadgeClass(code),
            ].join(" ")}
          >
            {statusLabel(code)}
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-6">
            <div className={isDark ? "text-[11px] text-slate-400" : "text-[11px] text-slate-500"}>
              Quantidade
            </div>
            <div className={isDark ? "text-[11px] font-semibold text-white tabular-nums" : "text-[11px] font-semibold text-slate-900 tabular-nums"}>
              {count}
            </div>
          </div>
          <div className="flex items-center justify-between gap-6">
            <div className={isDark ? "text-[11px] text-slate-400" : "text-[11px] text-slate-500"}>%</div>
            <div className={isDark ? "text-[11px] font-semibold text-white tabular-nums" : "text-[11px] font-semibold text-slate-900 tabular-nums"}>
              {pct}%
            </div>
          </div>
        </div>
      </div>
    );
  };
}

function ClickLegend({ payload, hiddenKeys, toggle }) {
  const { isDark } = useThemeToggle();

  if (!payload?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      {payload.map((it) => {
        const k = it.dataKey;
        const hidden = hiddenKeys.has(k);
        return (
          <button
            key={k}
            type="button"
            onClick={() => toggle(k)}
            className={[
              "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 transition",
              isDark
                ? "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              hidden ? "opacity-40" : "opacity-100",
            ].join(" ")}
            title="Clique para ocultar/mostrar"
            aria-pressed={!hidden}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: it.color }}
            />
            <span className="font-semibold">{it.value}</span>
          </button>
        );
      })}
    </div>
  );
}

function PieLegend({ data, totalAll, hidden, toggle }) {
  const { isDark } = useThemeToggle();

  if (!data?.length) return null;

  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
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
              "w-full flex items-center justify-between gap-3 rounded-lg border px-2.5 py-1.5 text-[11px] transition",
              isDark
                ? "border-white/10 bg-white/5 hover:bg-white/10"
                : "border-slate-200 bg-white hover:bg-slate-50",
              isHidden ? "opacity-40" : "opacity-100",
            ].join(" ")}
            title="Clique para ocultar/mostrar"
            aria-pressed={!isHidden}
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: statusFill(code, idx) }}
              />
              <span className={isDark ? "truncate font-semibold text-white" : "truncate font-semibold text-slate-800"}>
                {statusLabel(code)}
              </span>
            </span>

            <span className={isDark ? "tabular-nums text-slate-300" : "tabular-nums text-slate-600"}>
              {count} <span className="opacity-70">({pct}%)</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function sortByDateAsc(rows, key = "date") {
  const arr = Array.isArray(rows) ? [...rows] : [];
  arr.sort((a, b) =>
    String(a?.[key] || "").localeCompare(String(b?.[key] || "")),
  );
  return arr;
}

function sliceByRange(rows, range) {
  const n = range === "last7" ? 7 : 30;
  if (!Array.isArray(rows)) return [];
  return rows.slice(-n);
}

function MiniRangeToggle({ value, onChange }) {
  const { isDark } = useThemeToggle();

  return (
    <div
      className={[
        "inline-flex items-center rounded-lg border p-0.5",
        isDark
          ? "border-white/10 bg-white/5"
          : "border-slate-200 bg-white/90 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.25)]",
      ].join(" ")}
      role="group"
      aria-label="Selecionar período"
    >
      <button
        type="button"
        onClick={() => onChange("last7")}
        className={[
          "px-2.5 py-1 text-[11px] font-semibold rounded-md transition",
          value === "last7"
            ? "bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white shadow-[0_12px_24px_-16px_rgba(37,99,235,0.65)]"
            : isDark
              ? "text-slate-300 hover:bg-white/10"
              : "text-slate-700 hover:bg-slate-50",
        ].join(" ")}
        aria-pressed={value === "last7"}
      >
        7 dias
      </button>
      <button
        type="button"
        onClick={() => onChange("last30")}
        className={[
          "px-2.5 py-1 text-[11px] font-semibold rounded-md transition",
          value === "last30"
            ? "bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white shadow-[0_12px_24px_-16px_rgba(37,99,235,0.65)]"
            : isDark
              ? "text-slate-300 hover:bg-white/10"
              : "text-slate-700 hover:bg-slate-50",
        ].join(" ")}
        aria-pressed={value === "last30"}
      >
        30 dias
      </button>
    </div>
  );
}

export default function AnalyticsSection({ offers: offersProp = [] }) {
  const { isDark } = useThemeToggle();
  const [open, setOpen] = useState(() => readOpenDefault());

  const fetchedRef = useRef(false);
  const inflightRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  const [pieRange, setPieRange] = useState("today");
  const [volumeRange, setVolumeRange] = useState("last30");
  const [createdPaidRange, setCreatedPaidRange] = useState("last30");

  const [hiddenSeries, setHiddenSeries] = useState(() => new Set());
  const [hiddenPie, setHiddenPie] = useState(() => new Set());

  async function fetchAnalytics() {
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
            signal: controller.signal,
          },
        );

        if (!res?.ok) {
          throw new Error(res?.error || "Falha ao carregar analytics");
        }

        setData(res);
        fetchedRef.current = true;
      } catch (e) {
        fetchedRef.current = false;

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

  const last30Days = useMemo(() => lastNDaysYMD(30), []);
  const last30Set = useMemo(() => new Set(last30Days), [last30Days]);

  const volumeBase = useMemo(() => {
    const offers = Array.isArray(offersProp) ? offersProp : [];

    // principal: vem do Dashboard (/offers)
    if (offers.length) {
      const sums = new Map();
      for (const d of last30Days) sums.set(d, 0);

      for (const o of offers) {
        if (!isOfferPaid(o)) continue;

        const day = getPaidDateYMD(o);
        if (!day || !last30Set.has(day)) continue;

        const cents = offerPaidAmountToCents(o);
        if (!cents) continue;

        sums.set(day, (sums.get(day) || 0) + cents);
      }

      return last30Days.map((date) => ({
        date,
        volume: (sums.get(date) || 0) / 100,
      }));
    }

    // fallback: se backend já entregar volume diário pago em monthDaily
    const rows = Array.isArray(monthDaily) ? monthDaily : [];
    const dateKey = findField(rows, ["date", "day", "label"]) || "date";

    const paidField = findField(rows, [
      "paidAmount",
      "paidValue",
      "salesAmount",
      "salesValue",
      "revenue",
      "volume",
      "paidTotal",
      "salesTotal",
      "revenueTotal",
      "paidCents",
      "paidAmountCents",
      "salesCents",
      "salesAmountCents",
      "revenueCents",
      "volumeCents",
    ]);

    const points = rows
      .map((r) => ({
        date: r?.[dateKey] ?? r?.date,
        volume: paidField ? normalizeMaybeCents(r?.[paidField], paidField) : 0,
      }))
      .filter((p) => p.date);

    return sliceByRange(sortByDateAsc(points, "date"), "last30");
  }, [offersProp, monthDaily, last30Days, last30Set]);

  const volumeSeries = useMemo(
    () => sliceByRange(volumeBase, volumeRange),
    [volumeBase, volumeRange],
  );

  const createdPaidBase = useMemo(() => {
    const offers = Array.isArray(offersProp) ? offersProp : [];

    // principal: deriva de offers
    if (offers.length) {
      const created = new Map();
      const paid = new Map();
      for (const d of last30Days) {
        created.set(d, 0);
        paid.set(d, 0);
      }

      for (const o of offers) {
        const cDay = getCreatedDateYMD(o);
        if (cDay && last30Set.has(cDay))
          created.set(cDay, (created.get(cDay) || 0) + 1);

        if (isOfferPaid(o)) {
          const pDay = getPaidDateYMD(o);
          if (pDay && last30Set.has(pDay))
            paid.set(pDay, (paid.get(pDay) || 0) + 1);
        }
      }

      return last30Days.map((date) => ({
        date,
        created: created.get(date) || 0,
        paid: paid.get(date) || 0,
      }));
    }

    // fallback: tenta pegar counts do monthDaily
    const rows = Array.isArray(monthDaily) ? monthDaily : [];
    const dateKey = findField(rows, ["date", "day", "label"]) || "date";

    const paidCountField = findField(rows, [
      "paidCount",
      "salesCount",
      "paid",
      "pagas",
    ]);
    const createdCountField = findField(rows, [
      "createdCount",
      "quotesCount",
      "created",
      "criadas",
    ]);

    const points = rows
      .map((r) => ({
        date: r?.[dateKey] ?? r?.date,
        created: createdCountField ? safeNum(r?.[createdCountField], 0) : 0,
        paid: paidCountField ? safeNum(r?.[paidCountField], 0) : 0,
      }))
      .filter((p) => p.date);

    return sliceByRange(sortByDateAsc(points, "date"), "last30");
  }, [offersProp, monthDaily, last30Days, last30Set]);

  const createdPaidSeries = useMemo(
    () => sliceByRange(createdPaidBase, createdPaidRange),
    [createdPaidBase, createdPaidRange],
  );

  const showSkeleton = open && loading && !data && !err;

  return (
    <div className="space-y-4">
      <div
        className={[
          "overflow-hidden rounded-[28px]",
          isDark
            ? "border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,15,28,0.82))] shadow-[0_24px_70px_-42px_rgba(15,23,42,0.72)]"
            : "border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,247,252,0.92))] shadow-[0_24px_70px_-42px_rgba(15,23,42,0.35)]",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={toggleOpen}
          className={[
            "flex w-full items-center justify-between gap-3 px-5 py-4 transition",
            isDark ? "hover:bg-white/5" : "hover:bg-slate-50/80",
          ].join(" ")}
          aria-expanded={open}
        >
          <div className="text-left">
            <div
              className={[
                "flex items-center gap-2 text-sm font-bold",
                isDark ? "text-white" : "text-slate-900",
              ].join(" ")}
            >
              Desempenho de vendas
              {err ? (
                <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                  erro
                </span>
              ) : null}
              {open && loading ? (
                <span
                  className={[
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    isDark
                      ? "border-white/10 bg-white/10 text-slate-200"
                      : "border-slate-200 bg-slate-50 text-slate-700",
                  ].join(" ")}
                >
                  carregando...
                </span>
              ) : null}
            </div>
            <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
              Clique para {open ? "ocultar" : "mostrar"} os gráficos.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={isDark ? "text-xs font-semibold text-slate-200" : "text-xs font-semibold text-slate-700"}>
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
                  <div
                    className={[
                      "rounded-[24px] border p-6",
                      isDark
                        ? "border-white/10 bg-white/5"
                        : "border-slate-200/80 bg-white",
                    ].join(" ")}
                  >
                    <EmptyState
                      title="Não foi possível carregar analytics"
                      description={err}
                      ctaLabel="Tentar novamente"
                      onCta={() => fetchAnalytics()}
                    />
                  </div>
                ) : null}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
                  {/* VOLUME */}
                  <ChartCard
                    title="Volume diário (R$)"
                    subtitle={
                      volumeRange === "last7"
                        ? "Últimos 7 dias"
                        : "Últimos 30 dias"
                    }
                    right={
                      <MiniRangeToggle
                        value={volumeRange}
                        onChange={setVolumeRange}
                      />
                    }
                  >
                    {showSkeleton ? (
                      <Skeleton className="h-[220px] w-full rounded-xl" />
                    ) : (
                      <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={volumeSeries}
                            margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid
                              stroke={CHART_GRID_STROKE}
                              strokeDasharray="3 3"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="date"
                              tickFormatter={fmtDateShort}
                              axisLine={false}
                              tickLine={false}
                              tick={AXIS_TICK}
                              interval="preserveStartEnd"
                              minTickGap={12}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={AXIS_TICK}
                              width={55}
                              tickFormatter={(v) => fmtCompactBRL(v)}
                            />
                            <Tooltip
                              cursor={{ stroke: CHART_GRID_STROKE }}
                              content={
                                <StandardTooltip
                                  labelFormatter={(l) => fmtDateShort(l)}
                                  valueFormatter={(v) => fmtBRL(v)}
                                />
                              }
                            />
                            <Legend
                              verticalAlign="top"
                              align="left"
                              wrapperStyle={{ paddingBottom: 8 }}
                              content={(props) => (
                                <ClickLegend
                                  {...props}
                                  hiddenKeys={hiddenSeries}
                                  toggle={toggleSeries}
                                />
                              )}
                            />
                            {!hiddenSeries.has("volume") ? (
                              <Line
                                type="monotone"
                                dataKey="volume"
                                name="Volume"
                                stroke="#14b8a6"
                                strokeWidth={2}
                                dot={{ r: 2 }}
                                activeDot={{ r: 5 }}
                              />
                            ) : null}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </ChartCard>

                  {/* PIE */}
                  <ChartCard
                    title="Status das propostas"
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
                  >
                    {showSkeleton ? (
                      <Skeleton className="h-[220px] w-full rounded-xl" />
                    ) : pieTotalAll === 0 ? (
                      <div className="h-[220px] flex items-center justify-center">
                        <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                          Sem dados no período
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="h-[220px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Tooltip content={pieTooltip} />
                              <Pie
                                data={pieDataVisible}
                                dataKey="count"
                                nameKey="status"
                                innerRadius="58%"
                                outerRadius="86%"
                                paddingAngle={2}
                                stroke="none"
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
                  </ChartCard>

                  {/* BAR (linha inteira) */}
                  <div className="lg:col-span-2">
                    <ChartCard
                      title="Criadas vs Pagas"
                      subtitle={
                        createdPaidRange === "last7"
                          ? "Últimos 7 dias"
                          : "Últimos 30 dias"
                      }
                      right={
                        <MiniRangeToggle
                          value={createdPaidRange}
                          onChange={setCreatedPaidRange}
                        />
                      }
                    >
                      {showSkeleton ? (
                        <Skeleton className="h-[240px] w-full rounded-xl" />
                      ) : (
                        <div className="h-[240px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={createdPaidSeries}
                              margin={{
                                top: 10,
                                right: 16,
                                left: 0,
                                bottom: 0,
                              }}
                              barCategoryGap={18}
                            >
                              <CartesianGrid
                                stroke={CHART_GRID_STROKE}
                                strokeDasharray="3 3"
                                vertical={false}
                              />
                              <XAxis
                                dataKey="date"
                                tickFormatter={fmtDateShort}
                                axisLine={false}
                                tickLine={false}
                                tick={AXIS_TICK}
                                interval={6}
                                minTickGap={12}
                              />
                              <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={AXIS_TICK}
                                width={40}
                                tickFormatter={(v) => fmtCompact(v)}
                              />
                              <Tooltip
                                cursor={{ fill: "rgba(148,163,184,0.10)" }}
                                content={
                                  <StandardTooltip
                                    labelFormatter={(l) => fmtDateShort(l)}
                                    valueFormatter={(v) =>
                                      String(safeNum(v, 0))
                                    }
                                  />
                                }
                              />
                              <Legend
                                verticalAlign="top"
                                align="left"
                                wrapperStyle={{ paddingBottom: 8 }}
                                content={(props) => (
                                  <ClickLegend
                                    {...props}
                                    hiddenKeys={hiddenSeries}
                                    toggle={toggleSeries}
                                  />
                                )}
                              />
                              {!hiddenSeries.has("created") ? (
                                <Bar
                                  dataKey="created"
                                  name="Criadas"
                                  fill="#a1a1aa"
                                  radius={[6, 6, 0, 0]}
                                />
                              ) : null}
                              {!hiddenSeries.has("paid") ? (
                                <Bar
                                  dataKey="paid"
                                  name="Pagas"
                                  fill="#2563eb"
                                  radius={[6, 6, 0, 0]}
                                />
                              ) : null}
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
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

