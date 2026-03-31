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
    <div
      className={`relative overflow-hidden rounded-[28px] border border-dashed p-6 text-center ${
        isDark
          ? "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.48),rgba(15,23,42,0.26))]"
          : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(241,245,249,0.82))] shadow-[0_20px_45px_-36px_rgba(15,23,42,0.16)]"
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-16 ${
          isDark
            ? "bg-[linear-gradient(180deg,rgba(56,189,248,0.08),transparent)]"
            : "bg-[linear-gradient(180deg,rgba(37,99,235,0.08),transparent)]"
        }`}
      />
      <div className={`relative text-sm font-bold ${isDark ? "text-white" : "text-slate-950"}`}>
        {title}
      </div>
      <div className={`relative mt-2 text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>
        {description}
      </div>
      {ctaLabel ? (
        <div className="relative mt-5">
          <Button onClick={onCta}>{ctaLabel}</Button>
        </div>
      ) : null}
    </div>
  );
}
