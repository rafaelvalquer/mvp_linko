export default function HeroPreview() {
  return (
    <div className="w-full h-96 bg-gradient-to-br from-emerald-50 to-zinc-100 flex items-center justify-center">
      <div className="text-center">
        <div className="text-emerald-600 font-black text-sm uppercase tracking-wider mb-4">
          PROPOSTA ENVIADA
        </div>
        <div className="text-zinc-600 text-sm mb-6">TOTAL DA PROPOSTA</div>
        <div className="text-5xl font-black text-zinc-900 mb-8">
          R$ 1.250,00
        </div>
        <div className="w-16 h-1 bg-emerald-500 rounded-full mx-auto"></div>
      </div>
    </div>
  );
}
