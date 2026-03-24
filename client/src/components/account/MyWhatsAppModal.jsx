import ModalShell from "../appui/ModalShell.jsx";
import MyWhatsAppPanel from "./MyWhatsAppPanel.jsx";

export default function MyWhatsAppModal({ open, onClose }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      panelClassName="max-w-[560px] px-4 sm:px-0"
    >
      <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,251,0.94))] shadow-[0_28px_72px_-40px_rgba(15,23,42,0.3)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(8,15,30,0.92))] dark:shadow-[0_30px_80px_-42px_rgba(15,23,42,0.85)]">
        <div className="border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
          <div className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-200">
            Meu WhatsApp
          </div>
          <div className="mt-1.5 text-lg font-semibold text-slate-950 dark:text-white">
            Configure seu numero pessoal
          </div>
          <div className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Use este numero para falar com o agente e receber avisos da sua propria carteira, sem depender do acesso a Configuracoes.
          </div>
        </div>

        <div className="px-5 py-4">
          <MyWhatsAppPanel mode="modal" onClose={onClose} />
        </div>
      </div>
    </ModalShell>
  );
}
