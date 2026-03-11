import Card from "../appui/Card.jsx";
import useThemeToggle from "../../app/useThemeToggle.js";

export default function ChartCard({
  title,
  subtitle,
  right,
  className = "",
  bodyClassName = "",
  children,
}) {
  const { isDark } = useThemeToggle();

  return (
    <Card
      className={[
        "overflow-hidden",
        className,
      ].join(" ")}
    >
      <div
        className={[
          "flex items-start justify-between gap-3 border-b px-5 pb-4 pt-5",
          isDark ? "border-white/10" : "border-slate-200/80",
        ].join(" ")}
      >
        <div className="min-w-0">
          <div
            className={[
              "text-sm font-bold tracking-tight",
              isDark ? "text-white" : "text-slate-900",
            ].join(" ")}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              className={[
                "mt-1 text-xs",
                isDark ? "text-slate-400" : "text-slate-500",
              ].join(" ")}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>

      <div className={["px-5 pb-5 pt-4", bodyClassName].join(" ")}>
        {children}
      </div>
    </Card>
  );
}
