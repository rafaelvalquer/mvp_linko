export default function Topbar() {
  return (
    <div className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-emerald-500" />
          <div>
            <div className="text-sm font-semibold">PayLink</div>
            <div className="text-xs text-zinc-500">
              Propostas • Agenda • Pix
            </div>
          </div>
        </div>
        <div className="text-xs text-zinc-500">MVP (sem login)</div>
      </div>
    </div>
  );
}
