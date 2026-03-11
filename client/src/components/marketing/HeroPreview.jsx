import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, CheckCircle2, FileText, QrCode } from "lucide-react";

const STAGES = [
  {
    id: "offer",
    title: "Proposta enviada",
    icon: <FileText className="h-4 w-4" />,
    content: (
      <div className="space-y-3">
        <div className="h-3 w-3/4 animate-pulse rounded bg-emerald-100" />
        <div className="space-y-2">
          <div className="h-2 w-full rounded bg-zinc-100" />
          <div className="h-2 w-5/6 rounded bg-zinc-100" />
        </div>
        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            Total da proposta
          </div>
          <div className="text-xl font-black text-emerald-900">R$ 1.250,00</div>
        </div>
      </div>
    ),
  },
  {
    id: "pix",
    title: "Pagamento Pix",
    icon: <QrCode className="h-4 w-4" />,
    content: (
      <div className="flex flex-col items-center justify-center py-2 text-center">
        <div className="mb-3 flex h-24 w-24 items-center justify-center rounded-xl bg-zinc-900 shadow-lg">
          <QrCode className="h-16 w-16 text-white" />
        </div>
        <div className="text-xs font-bold italic text-zinc-900">
          Aguardando confirmacao...
        </div>
      </div>
    ),
  },
  {
    id: "agenda",
    title: "Agenda confirmada",
    icon: <CalendarCheck className="h-4 w-4" />,
    content: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 p-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <div className="text-[10px] font-bold text-emerald-900">
            Horario reservado com sucesso!
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 opacity-40">
          {[...Array(14)].map((_, index) => (
            <div
              key={index}
              className={`h-4 rounded-sm ${index === 11 ? "bg-emerald-500 opacity-100" : "bg-zinc-200"}`}
            />
          ))}
        </div>
      </div>
    ),
  },
];

export default function HeroPreview() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setIndex((previous) => (previous + 1) % STAGES.length),
      3500,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-[480px] lg:ml-auto">
      <div className="absolute -inset-2 rounded-[2rem] bg-gradient-to-r from-emerald-500/10 to-teal-500/10 blur-xl" />

      <div className="relative overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-50 bg-zinc-50/50 px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
            <div className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
          </div>
          <div className="w-40 truncate rounded border border-zinc-100 bg-white px-3 py-1 text-center font-mono text-[9px] text-zinc-400">
            luminorpay.com/p/venda-01
          </div>
          <div className="w-4" />
        </div>

        <div className="relative h-[260px] bg-white p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={STAGES[index].id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
            >
              <div className="mb-4 flex items-center gap-2 text-emerald-600">
                {STAGES[index].icon}
                <span className="text-xs font-bold uppercase tracking-widest">
                  {STAGES[index].title}
                </span>
              </div>
              {STAGES[index].content}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex justify-center gap-1.5 bg-white pb-4">
          {STAGES.map((_, itemIndex) => (
            <div
              key={itemIndex}
              className={`h-1 rounded-full transition-all duration-500 ${itemIndex === index ? "w-6 bg-emerald-500" : "w-1.5 bg-zinc-200"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
