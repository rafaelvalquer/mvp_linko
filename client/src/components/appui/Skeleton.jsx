import useThemeToggle from "../../app/useThemeToggle.js";

export default function Skeleton({ className = "" }) {
  const { isDark } = useThemeToggle();

  return (
    <div
      className={`animate-pulse rounded-xl ${isDark ? "bg-white/10" : "bg-slate-200/80"} ${className}`}
    />
  );
}
