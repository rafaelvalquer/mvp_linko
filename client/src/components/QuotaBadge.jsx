// src/components/QuotaBadge.jsx
import { getPlanLabel, formatQuota, quotaPercent } from "../utils/planQuota.js";

export default function QuotaBadge({
  plan,
  remaining,
  limit,
  used,
  cycleKey,
  loading = false,
  compact = false,
}) {
  if (loading) {
    return <div className="h-9 w-44 animate-pulse rounded-full bg-zinc-100" />;
  }

  const planLabel = getPlanLabel(plan);
  const quotaText = formatQuota(remaining, limit);
  const pct = quotaPercent(used, limit);

  return (
    <div
      className={[
        "rounded-2xl border border-zinc-200 bg-white px-3 py-2 shadow-sm",
        compact ? "px-2 py-1" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-zinc-700">
          Plano: {planLabel}
        </span>

        <span className="h-3 w-px bg-zinc-200" />

        <span className="text-[11px] font-semibold text-zinc-900">
          {quotaText}
        </span>

        {cycleKey ? (
          <span className="hidden sm:inline text-[10px] text-zinc-400">
            • {cycleKey}
          </span>
        ) : null}
      </div>

      <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100">
        <div
          className="h-1.5 rounded-full bg-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
