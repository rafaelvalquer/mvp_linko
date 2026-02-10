import Button from "./Button.jsx";

export default function EmptyState({
  title = "Nada por aqui",
  description = "Crie seu primeiro item para começar.",
  ctaLabel,
  onCta,
}) {
  return (
    <div className="rounded-2xl border bg-zinc-50 p-6 text-center">
      <div className="text-sm font-semibold text-zinc-900">{title}</div>
      <div className="mt-1 text-sm text-zinc-600">{description}</div>
      {ctaLabel ? (
        <div className="mt-4">
          <Button onClick={onCta}>{ctaLabel}</Button>
        </div>
      ) : null}
    </div>
  );
}
