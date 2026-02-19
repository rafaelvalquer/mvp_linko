import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Check,
  Link2,
  Menu,
  QrCode,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";

function cx(...c) {
  return c.filter(Boolean).join(" ");
}

function Section({ id, eyebrow, title, subtitle, children }) {
  return (
    <section id={id} className="scroll-mt-24 py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          {eyebrow ? (
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{eyebrow}</div>
          ) : null}
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">{title}</h2>
          {subtitle ? <p className="mt-3 text-sm leading-6 text-zinc-600 sm:text-base">{subtitle}</p> : null}
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

function IconCard({ icon: Icon, title, desc }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-emerald-700">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-900">{title}</div>
          <div className="mt-1 text-sm leading-6 text-zinc-600">{desc}</div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ name, popular, microcopy, price, limit, extraPix, items, ctaLabel, ctaTo, ctaHref }) {
  const Cta = ctaHref ? "a" : Link;
  const ctaProps = ctaHref
    ? { href: ctaHref, target: "_blank", rel: "noopener noreferrer" }
    : { to: ctaTo || "/register" };

  return (
    <div className={cx("relative rounded-2xl border bg-white p-6 shadow-sm", popular ? "border-emerald-300 ring-2 ring-emerald-200" : "border-zinc-200")}>
      {popular ? (
        <div className="absolute -top-3 right-4 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
          Mais popular
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-zinc-900">{name}</div>
          <div className="mt-1 text-sm text-zinc-600">{microcopy}</div>
        </div>
        {popular ? (
          <div className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 sm:inline-flex">
            Recomendado
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        {price ? (
          <div className="flex items-end gap-2">
            <div className="text-3xl font-semibold tracking-tight text-zinc-900">{price}</div>
            <div className="pb-1 text-sm text-zinc-500">/mês</div>
          </div>
        ) : (
          <div className="text-3xl font-semibold tracking-tight text-zinc-900">Fale com a gente</div>
        )}
        {limit ? (
          <div className="mt-2 text-sm text-zinc-600">
            <span className="font-semibold text-zinc-900">{limit}</span> Pix/mês
          </div>
        ) : null}
        {extraPix ? (
          <div className="mt-1 text-sm text-zinc-600">
            Pix extra: <span className="font-semibold">{extraPix}</span>
          </div>
        ) : null}
      </div>

      <ul className="mt-5 space-y-2 text-sm text-zinc-700">
        {items.map((t) => (
          <li key={t} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span className="leading-6">{t}</span>
          </li>
        ))}
      </ul>

      <Cta
        {...ctaProps}
        className={cx(
          "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
          popular ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
        )}
      >
        {ctaLabel}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Cta>
    </div>
  );
}

export default function Home() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const bullets = useMemo(
    () => [
      "Link público com proposta clara",
      "Pix com QR Code e copia e cola",
      "Sinal/entrada para serviços",
      "Itens de produtos com totais automáticos",
      "Dashboard com conversão e pagos do dia",
      "Agenda para organizar serviços",
    ],
    [],
  );

  const features = useMemo(
    () => [
      { icon: Link2, title: "Link público sem fricção", desc: "Envie pelo WhatsApp/Instagram/e-mail. O cliente abre, confere e aceita sem criar conta." },
      { icon: QrCode, title: "Pix com QR Code e copia e cola", desc: "Checkout direto com status de pagamento (pendente/pago/expirado/cancelado)." },
      { icon: CalendarClock, title: "Agenda para serviços", desc: "Proposta → reserva → pagamento. Reduza no-shows e organize a semana." },
      { icon: BarChart3, title: "Dashboard (MVP)", desc: "KPIs essenciais: propostas, volume, conversão e pagos do dia." },
      { icon: Wallet, title: "Saques/repasse e taxas", desc: "Visão de taxas e repasse via Pix com organização por workspace (multi-tenant)." },
      { icon: ShieldCheck, title: "Rastreabilidade total", desc: "Cliente, itens, valores, status e histórico para reduzir retrabalho e erros." },
    ],
    [],
  );

  const plans = useMemo(
    () => [
      {
        name: "Start",
        microcopy: "Para começar a fechar e receber via Pix em minutos.",
        price: "R$ 35,90",
        limit: "20",
        extraPix: "R$ 1,59 / Pix",
        ctaLabel: "Criar conta",
        ctaTo: "/register",
        items: [
          "Propostas/orçamentos (serviço ou produtos)",
          "Link público para o cliente (sem login)",
          "Pix com QR Code + copia e cola",
          "Status do pagamento",
          "Agenda básica (serviços)",
          "Dashboard básico",
          "Histórico e ações rápidas",
        ],
      },
      {
        name: "Pro",
        popular: true,
        microcopy: "Para quem quer velocidade com clientes e catálogo.",
        price: "R$ 99,90",
        limit: "50",
        extraPix: "R$ 1,39 / Pix",
        ctaLabel: "Começar pelo Pro",
        ctaTo: "/register",
        items: [
          "Tudo do Start",
          "Cadastro de Clientes",
          "Cadastro de Produtos/Serviços",
          "Sinal/entrada (%) e condições",
          "Dashboard avançado",
          "Agenda com status (hold/confirmado)",
        ],
      },
      {
        name: "Business",
        microcopy: "Para equipes que precisam de controle e escala.",
        price: "R$ 279,90",
        limit: "120",
        extraPix: "R$ 1,19 / Pix",
        ctaLabel: "Criar conta",
        ctaTo: "/register",
        items: [
          "Tudo do Pro",
          "Multiusuário / equipe (perfis e permissões)",
          "Relatórios e indicadores por período",
          "Visão consolidada da operação",
          "Prioridade no suporte",
        ],
      },
      {
        name: "Enterprise",
        microcopy: "Personalizado para alto volume e integrações.",
        price: null,
        limit: null,
        extraPix: null,
        ctaLabel: "Falar com especialista",
        ctaHref: "mailto:contato@seu-dominio.com?subject=Enterprise%20LuminorsPay",
        items: [
          "Limites e taxas personalizados",
          "Integrações (WhatsApp, ERP/CRM, webhooks)",
          "SLA e suporte dedicado",
          "Regras e permissões avançadas",
        ],
      },
    ],
    [],
  );

  const faqs = useMemo(
    () => [
      { q: "O cliente precisa criar conta?", a: "Não. Ele acessa o link público, revisa a proposta, aceita e paga via Pix sem login." },
      { q: "Funciona para produtos e serviços?", a: "Sim. Produtos com itens/quantidade/total. Serviços com agenda, sinal e controle de status." },
      { q: "Dá para enviar pelo WhatsApp?", a: "Sim. Copie o link e envie por WhatsApp, Instagram ou e-mail — pensado para conversão." },
      { q: "O que eu vejo no dashboard?", a: "KPIs essenciais: propostas, volume, conversão, pagos do dia e visão de agendamentos (conforme plano)." },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-50 border-b border-zinc-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 font-semibold text-white">L</div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">LuminorsPay</div>
                <div className="text-xs text-zinc-500">Propostas que viram pagamento</div>
              </div>
            </Link>

            <nav className="hidden items-center gap-6 text-sm text-zinc-600 md:flex">
              <a className="hover:text-zinc-900" href="#recursos">Recursos</a>
              <a className="hover:text-zinc-900" href="#como-funciona">Como funciona</a>
              <a className="hover:text-zinc-900" href="#planos">Planos</a>
              <a className="hover:text-zinc-900" href="#faq">FAQ</a>
            </nav>

            <div className="hidden items-center gap-2 md:flex">
              <Link to="/login" className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">
                Entrar
              </Link>
              <Link to="/register" className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">
                Criar conta
              </Link>
            </div>

            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white p-2 text-zinc-900 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 md:hidden"
              aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>

          {mobileOpen ? (
            <div className="pb-4 md:hidden">
              <div className="grid gap-2 rounded-2xl border border-zinc-200 bg-white p-3">
                {[
                  { href: "#recursos", label: "Recursos" },
                  { href: "#como-funciona", label: "Como funciona" },
                  { href: "#planos", label: "Planos" },
                  { href: "#faq", label: "FAQ" },
                ].map((it) => (
                  <a key={it.href} href={it.href} className="rounded-xl px-3 py-2 text-sm font-semibold hover:bg-zinc-50" onClick={() => setMobileOpen(false)}>
                    {it.label}
                  </a>
                ))}
                <div className="grid gap-2 pt-2">
                  <Link to="/login" className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50" onClick={() => setMobileOpen(false)}>
                    Entrar
                  </Link>
                  <Link to="/register" className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700" onClick={() => setMobileOpen(false)}>
                    Criar conta
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute -top-28 right-0 h-80 w-80 rounded-full bg-emerald-200/60 blur-3xl" />
            <div className="absolute -bottom-28 left-0 h-80 w-80 rounded-full bg-zinc-200/70 blur-3xl" />
          </div>

          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Feche mais rápido com um link
                </span>

                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
                  Crie propostas profissionais e receba via Pix em um link.
                </h1>

                <p className="mt-4 text-sm leading-6 text-zinc-600 sm:text-base">
                  Orçamento, aceite, pagamento e agenda em um fluxo simples — feito para autônomos e PMEs que querem fechar mais e perder menos tempo.
                </p>

                <ul className="mt-6 space-y-2 text-sm text-zinc-700">
                  {bullets.map((t) => (
                    <li key={t} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-emerald-700" aria-hidden="true" />
                      <span className="leading-6">{t}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">
                    Criar minha primeira proposta <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">
                    Ver demonstração <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>

                <div className="mt-6 text-xs text-zinc-500">
                  Sem PDF perdido no WhatsApp. Tudo registrado (cliente, itens, valores e status).
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-zinc-500">Preview do link público</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-900">Proposta • Serviço / Produtos</div>
                    <div className="mt-1 text-sm text-zinc-600">
                      Cliente: <span className="font-semibold">Cliente X</span>
                    </div>
                  </div>
                  <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                    Pix disponível
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-xs font-semibold text-zinc-500">Itens</div>
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-900">Serviço A</div>
                        <div className="text-xs text-zinc-500">1× • R$ 120,00</div>
                      </div>
                      <div className="font-semibold">R$ 120,00</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-900">Produto B</div>
                        <div className="text-xs text-zinc-500">2× • R$ 40,00</div>
                      </div>
                      <div className="font-semibold">R$ 80,00</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-zinc-200 pt-3 text-sm">
                    <div className="text-zinc-600">Total</div>
                    <div className="text-lg font-semibold text-zinc-900">R$ 200,00</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-200 p-4">
                    <div className="text-sm font-semibold text-zinc-900">Pagar via Pix</div>
                    <div className="mt-1 text-xs text-zinc-500">QR Code + copia e cola</div>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 p-4">
                    <div className="text-sm font-semibold text-zinc-900">Agenda (serviços)</div>
                    <div className="mt-1 text-xs text-zinc-500">Reserva e confirmação</div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-zinc-500">
                  Status: <span className="font-semibold">Pendente</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Section id="recursos" eyebrow="Tudo que você precisa" title="Feche mais e organize sua operação" subtitle="Um fluxo único: proposta → aceite → Pix → agenda → dashboard.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <IconCard key={f.title} {...f} />
            ))}
          </div>

          <div className="mt-10 grid gap-3 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm md:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Confiável para PMEs", desc: "Fluxo claro, status explícitos e foco em reduzir erros no atendimento." },
              { icon: Users, title: "Serviço e produto", desc: "Serviços com agenda e sinal; produtos com itens, quantidades e totais." },
              { icon: BarChart3, title: "Decisão por dados", desc: "KPIs essenciais para ver pendentes, pagos e agendados no dia." },
            ].map((it) => (
              <div key={it.title} className="flex items-start gap-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-emerald-700">
                  <it.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-zinc-900">{it.title}</div>
                  <div className="mt-1 text-sm text-zinc-600">{it.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="como-funciona" eyebrow="Em 3 passos" title="Como funciona" subtitle="Criar, enviar e receber — com controle de status e agenda.">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { n: "1", t: "Crie a proposta em minutos", d: "Serviço ou produtos, itens com totais automáticos, sinal e condições (quando aplicável)." },
              { n: "2", t: "Envie o link", d: "Link público pronto para WhatsApp/Instagram/e-mail. O cliente revisa e aceita." },
              { n: "3", t: "Pix + organização", d: "O cliente paga via Pix, você acompanha status e mantém a agenda sob controle." },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white">{s.n}</div>
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">{s.t}</div>
                    <div className="mt-1 text-sm leading-6 text-zinc-600">{s.d}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="planos" eyebrow="Planos" title="Escolha o plano ideal" subtitle="Comece no Start e evolua para Pro/Business conforme seu volume.">
          <div className="grid gap-4 lg:grid-cols-4">
            {plans.map((p) => (
              <PlanCard key={p.name} {...p} />
            ))}
          </div>
        </Section>

        <Section id="faq" eyebrow="FAQ" title="Perguntas frequentes" subtitle="Respostas objetivas para você decidir com confiança.">
          <div className="grid gap-3 md:grid-cols-2">
            {faqs.map((f) => (
              <div key={f.q} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-zinc-900">{f.q}</div>
                <div className="mt-2 text-sm leading-6 text-zinc-600">{f.a}</div>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="text-lg font-semibold text-zinc-900">Pronto para fechar mais rápido?</div>
                <div className="mt-1 text-sm text-zinc-600">Crie sua primeira proposta e envie o link para o próximo cliente.</div>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">
                  Criar conta <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link to="/login" className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">
                  Entrar
                </Link>
              </div>
            </div>
          </div>
        </Section>
      </main>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-sm font-semibold text-zinc-900">LuminorsPay</div>
              <div className="mt-2 text-sm text-zinc-600">Propostas que viram pagamento e agenda em minutos.</div>
              <div className="mt-4 text-xs text-zinc-500">© {new Date().getFullYear()} LuminorsPay. Todos os direitos reservados.</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-zinc-900">Produto</div>
              <a className="block text-sm text-zinc-600 hover:text-zinc-900" href="#recursos">Recursos</a>
              <a className="block text-sm text-zinc-600 hover:text-zinc-900" href="#como-funciona">Como funciona</a>
              <a className="block text-sm text-zinc-600 hover:text-zinc-900" href="#planos">Planos</a>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-zinc-900">Legal</div>
              <div className="text-sm text-zinc-600">Termos (placeholder)</div>
              <div className="text-sm text-zinc-600">Privacidade (placeholder)</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-zinc-900">Contato</div>
              <div className="text-sm text-zinc-600">
                E-mail: <span className="font-semibold">contato@seu-dominio.com</span>
              </div>
              <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                <div className="font-semibold text-zinc-900">Dica</div>
                <div className="mt-1">Use o link público para fechar no WhatsApp com proposta clara e Pix pronto.</div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
