import Button from "./Button.jsx";
import useThemeToggle from "../../app/useThemeToggle.js";

export default function EmptyState({
  title = "Nada por aqui",
  description = "Crie seu primeiro item para comecar.",
  ctaLabel,
  onCta,
}) {
  const { isDark } = useThemeToggle();

  return (
    <div className={`rounded-[28px] border border-dashed p-6 text-center ${isDark ? "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.4),rgba(15,23,42,0.24))]" : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(241,245,249,0.74))] shadow-[0_20px_45px_-36px_rgba(15,23,42,0.2)]"}`}>
      <div className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-950"}`}>
        {title}
      </div>
      <div className={`mt-2 text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>
        {description}
      </div>
      {ctaLabel ? (
        <div className="mt-5">
          <Button onClick={onCta}>{ctaLabel}</Button>
        </div>
      ) : null}
    </div>
  );
}
