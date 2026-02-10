export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xl font-semibold text-zinc-900">{title}</div>
          {subtitle ? (
            <div className="mt-1 text-sm text-zinc-600">{subtitle}</div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
