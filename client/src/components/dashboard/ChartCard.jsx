// src/components/dashboard/ChartCard.jsx
import Card from "../appui/Card.jsx";

export default function ChartCard({
  title,
  subtitle,
  right,
  className = "",
  bodyClassName = "",
  children,
}) {
  return (
    <Card
      className={[
        // premium surface (light + dark friendly)
        "overflow-hidden rounded-2xl border border-zinc-200/70 bg-white shadow-sm ring-1 ring-zinc-200/40",
        "dark:border-zinc-800/70 dark:bg-zinc-950/40 dark:ring-zinc-800/40",
        className,
      ].join(" ")}
    >
      <div
        className={[
          "flex items-start justify-between gap-3",
          "px-5 pt-5 pb-3",
          "border-b border-zinc-200/70 dark:border-zinc-800/70",
        ].join(" ")}
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {subtitle}
            </div>
          ) : null}
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>

      <div
        className={[
          // default spacing similar to premium dashboards
          "px-5 pb-5 pt-3",
          bodyClassName,
        ].join(" ")}
      >
        {children}
      </div>
    </Card>
  );
}
