import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, CalendarCheck, FileText, CheckCircle2 } from "lucide-react";

const STAGES = [
  {
    id: "offer",
    title: "Proposta Enviada",
    icon: <FileText className="w-4 h-4" />,
    content: (
      <div className="space-y-3">
        <div className="h-3 w-3/4 bg-emerald-100 rounded animate-pulse" />
        <div className="space-y-2">
          <div className="h-2 w-full bg-zinc-100 rounded" />
          <div className="h-2 w-5/6 bg-zinc-100 rounded" />
        </div>
        <div className="mt-4 p-3 rounded-xl border border-emerald-100 bg-emerald-50/30 text-center">
          <div className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">
            Total da Proposta
          </div>
          <div className="text-xl font-black text-emerald-900">R$ 1.250,00</div>
        </div>
      </div>
    ),
  },
  {
    id: "pix",
    title: "Pagamento Pix",
    icon: <QrCode className="w-4 h-4" />,
    content: (
      <div className="flex flex-col items-center justify-center py-2 text-center">
        <div className="w-24 h-24 bg-zinc-900 rounded-xl flex items-center justify-center mb-3 shadow-lg">
          <QrCode className="w-16 h-16 text-white" />
        </div>
        <div className="text-xs font-bold text-zinc-900 italic">
          Aguardando confirmação...
        </div>
      </div>
    ),
  },
  {
    id: "agenda",
    title: "Agenda Confirmada",
    icon: <CalendarCheck className="w-4 h-4" />,
    content: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-100 rounded-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <div className="text-[10px] font-bold text-emerald-900">
            Horário reservado com sucesso!
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 opacity-40">
          {[...Array(14)].map((_, i) => (
            <div
              key={i}
              className={`h-4 rounded-sm ${i === 11 ? "bg-emerald-500 opacity-100" : "bg-zinc-200"}`}
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
      () => setIndex((prev) => (prev + 1) % STAGES.length),
      3500,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full max-w-[480px] mx-auto lg:ml-auto">
      <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-[2rem] blur-xl" />

      <div className="relative rounded-[1.5rem] border border-zinc-200 bg-white shadow-2xl overflow-hidden">
        {/* Browser Top Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-50 bg-zinc-50/50">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
          </div>
          <div className="bg-white border border-zinc-100 px-3 py-1 rounded text-[9px] text-zinc-400 font-mono truncate w-40 text-center">
            luminorspay.com/p/venda-01
          </div>
          <div className="w-4" />
        </div>

        {/* Mockup Content */}
        <div className="p-6 h-[260px] relative bg-white">
          <AnimatePresence mode="wait">
            <motion.div
              key={STAGES[index].id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex items-center gap-2 mb-4 text-emerald-600">
                {STAGES[index].icon}
                <span className="text-xs font-bold uppercase tracking-widest">
                  {STAGES[index].title}
                </span>
              </div>
              {STAGES[index].content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress Dots */}
        <div className="flex justify-center gap-1.5 pb-4 bg-white">
          {STAGES.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-500 ${i === index ? "w-6 bg-emerald-500" : "w-1.5 bg-zinc-200"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
