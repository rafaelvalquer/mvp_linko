import { Link } from "react-router-dom";
import { ArrowRight, CircleAlert, RotateCcw } from "lucide-react";
import brandLogo from "../assets/brand.png";

export default function BillingCancelV2() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_34%),linear-gradient(180deg,#fff7ed,#f8fafc_46%,#eef2ff)] px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-center pt-2">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/80 bg-[linear-gradient(135deg,#2563eb,#14b8a6)] shadow-[0_20px_40px_-24px_rgba(37,99,235,0.5)]">
              <img
                src={brandLogo}
                alt="LuminorPay"
                className="h-8 w-8 rounded-xl object-contain"
                draggable="false"
              />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-sky-700">
                Assinatura
              </div>
              <div className="text-lg font-black tracking-tight text-slate-950">
                LuminorPay
              </div>
            </div>
          </Link>
        </div>

        <section className="relative overflow-hidden rounded-[34px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,247,237,0.95),rgba(248,250,252,0.96))] p-5 shadow-[0_36px_100px_-56px_rgba(15,23,42,0.34)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.1),transparent_28%)]" />
          <div className="relative space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl space-y-3">
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
                  Checkout interrompido
                </span>
                <div className="space-y-2">
                  <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                    Nenhuma cobranca foi concluida.
                  </h1>
                  <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                    Seu checkout foi interrompido antes da confirmacao final. Voce pode retomar quando quiser, sem perder o contexto do plano escolhido.
                  </p>
                </div>
              </div>

              <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-amber-50 text-amber-700">
                <CircleAlert className="h-8 w-8" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/80 bg-white/90 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Status
                </div>
                <div className="mt-2 text-lg font-black tracking-[-0.03em] text-slate-950">
                  Nao confirmado
                </div>
                <div className="mt-2 text-xs leading-5 text-slate-600">
                  O plano nao foi ativado nesta tentativa.
                </div>
              </div>

              <div className="rounded-[24px] border border-white/80 bg-white/90 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Cobranca
                </div>
                <div className="mt-2 text-lg font-black tracking-[-0.03em] text-slate-950">
                  Sem captura
                </div>
                <div className="mt-2 text-xs leading-5 text-slate-600">
                  Nada foi concluido nesta pagina de checkout.
                </div>
              </div>

              <div className="rounded-[24px] border border-white/80 bg-white/90 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Retomada
                </div>
                <div className="mt-2 text-lg font-black tracking-[-0.03em] text-slate-950">
                  Quando quiser
                </div>
                <div className="mt-2 text-xs leading-5 text-slate-600">
                  Voce pode revisar planos e tentar novamente sem pressa.
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <section className="rounded-[30px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_28px_70px_-50px_rgba(15,23,42,0.2)] sm:p-6">
            <div className="text-lg font-black tracking-[-0.03em] text-slate-950">
              O que voce pode fazer agora
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              Mantivemos esta etapa simples para reduzir atrito e deixar claro que o fluxo pode ser retomado.
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-[24px] border border-slate-200/80 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-500">
                    <RotateCcw className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Revisar o plano com calma
                    </div>
                    <div className="mt-1 text-sm leading-6 text-slate-600">
                      Compare novamente os recursos e retome o checkout quando fizer sentido para o seu momento.
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200/80 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-500">
                    <CircleAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Sem impacto no ambiente
                    </div>
                    <div className="mt-1 text-sm leading-6 text-slate-600">
                      Como o checkout nao foi concluido, sua assinatura atual e suas configuracoes seguem como estavam antes.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded-[30px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_28px_70px_-50px_rgba(15,23,42,0.2)] sm:p-6">
            <div className="text-lg font-black tracking-[-0.03em] text-slate-950">
              Continuar depois
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              Se quiser, volte aos planos ou siga para o dashboard agora.
            </div>

            <div className="mt-5 space-y-3">
              <Link
                to="/billing/plans"
                className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#2563eb,#14b8a6)] px-4 py-3 text-sm font-bold text-white shadow-[0_20px_40px_-22px_rgba(37,99,235,0.45)] transition hover:-translate-y-0.5"
              >
                Ver planos
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                to="/dashboard"
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Voltar ao dashboard
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
