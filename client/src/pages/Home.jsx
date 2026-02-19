import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
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
  Wallet,
  X,
  MousePointer2,
  Send,
  CreditCard,
  BadgeCheck,
  Zap,
  Lock,
  ChevronDown,
} from "lucide-react";

import AnimatedSection from "../components/marketing/AnimatedSection";
import HeroPreview from "../components/marketing/HeroPreview";
import brandLogo from "../assets/brand.png";

const Logo = ({ className }) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M20 30C20 24.4772 24.4772 20 30 20H70C75.5228 20 80 24.4772 80 30V70C80 75.5228 75.5228 80 70 80H30C24.4772 80 20 75.5228 20 70V30Z"
      className="fill-emerald-500"
    />
    <path
      d="M40 35V65M40 65H60M40 50H55"
      stroke="white"
      strokeWidth="8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [faqOpen, setFaqOpen] = useState(0);

  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const yParallax = useTransform(scrollYProgress, [0, 1], [0, -120]);

  const navLinks = useMemo(
    () => [
      { name: "Recursos", href: "#recursos" },
      { name: "Como funciona", href: "#como-funciona" },
      { name: "Planos", href: "#planos" },
      { name: "FAQ", href: "#faq" },
    ],
    [],
  );

  const features = useMemo(
    () => [
      {
        icon: Link2,
        title: "Link público sem fricção",
        desc: "Envie pelo WhatsApp. O cliente abre, confere e aceita sem criar conta.",
      },
      {
        icon: QrCode,
        title: "Pix com QR Code",
        desc: "Checkout direto com status de pagamento automático em tempo real.",
      },
      {
        icon: CalendarClock,
        title: "Agenda para serviços",
        desc: "Proposta → reserva → pagamento. Organize sua semana sem esforço.",
      },
      {
        icon: BarChart3,
        title: "Dashboard intuitivo",
        desc: "KPIs essenciais: propostas, volume, conversão e pagos do dia.",
      },
      {
        icon: Wallet,
        title: "Saques e taxas",
        desc: "Visão clara de repasses via Pix organizados por workspace.",
      },
      {
        icon: ShieldCheck,
        title: "Rastreabilidade total",
        desc: "Histórico completo para reduzir erros e retrabalho na operação.",
      },
    ],
    [],
  );

  const steps = useMemo(
    () => [
      {
        icon: MousePointer2,
        title: "1. Crie a proposta",
        desc: "Adicione itens, prazos e condições em segundos.",
      },
      {
        icon: Send,
        title: "2. Envie o link",
        desc: "Seu cliente recebe um link profissional e otimizado para celular.",
      },
      {
        icon: CreditCard,
        title: "3. Receba via Pix",
        desc: "O cliente aceita, agenda (se necessário) e paga na hora.",
      },
    ],
    [],
  );

  const ENTERPRISE_CONTACT = "/contact"; // ou: "mailto:contato@luminorpay.com"

  const plans = useMemo(
    () => [
      {
        name: "Start",
        subtitle: "Básico",
        price: "R$ 35,90",
        includedPix: 20,
        extraPix: "R$ 1,59 / Pix",
        microcopy: "Para começar a fechar e receber via Pix em minutos.",
        badges: [],
        cta: { label: "Começar agora", to: "/register" },
        benefits: [
          "Propostas/Orçamentos (serviço ou produtos)",
          "Link público para o cliente (sem login)",
          "Pix com QR Code + copia e cola",
          "Status do pagamento (pendente/pago/expirado/cancelado)",
          "Agenda básica para serviços (criar e visualizar agendamentos)",
          "Dashboard básico (pendentes, pagos, agendados)",
          "Histórico da proposta e ações rápidas (copiar link / abrir)",
        ],
      },
      {
        name: "Pro",
        subtitle: "Profissional",
        popular: true,
        price: "R$ 99,90",
        includedPix: 50,
        extraPix: "R$ 1,39 / Pix",
        microcopy: "Para quem quer velocidade com clientes e catálogo.",
        badges: [],
        cta: { label: "Começar agora", to: "/register" },
        benefits: [
          "Tudo do Start",
          "Cadastro de Clientes (busca rápida e histórico)",
          "Cadastro de Produtos/Serviços (itens e preços salvos)",
          "Sinal/entrada (%) e condições de pagamento",
          "Dashboard avançado (conversão, volume, pagos do dia)",
          "Organização de agenda com status (hold/confirmado)",
        ],
      },
      {
        name: "Business",
        subtitle: "PME",
        price: "R$ 279,90",
        includedPix: 120,
        extraPix: "R$ 1,19 / Pix",
        microcopy: "Para equipes que precisam de controle e escala.",
        cta: { label: "Começar agora", to: "/register" },
        benefits: [
          "Tudo do Pro",
          "Multiusuário / equipe (perfis e permissões)",
          "Relatórios e indicadores mais completos (período, performance)",
          "Gestão de operação: visão consolidada de propostas, agenda e pagamentos",
          "Prioridade no suporte",
        ],
      },
      {
        name: "Enterprise",
        subtitle: "Sob medida",
        price: null,
        microcopy: "Personalizado para alto volume e integrações.",
        cta: { label: "Falar com especialista", to: ENTERPRISE_CONTACT },
        benefits: [
          "Limites e taxas personalizados para alto volume",
          "Integrações e automações (WhatsApp, ERP/CRM, webhooks)",
          "SLA e suporte dedicado",
          "Regras e permissões avançadas",
        ],
      },
    ],
    [],
  );

  const faqs = useMemo(
    () => [
      {
        q: "O cliente precisa criar conta?",
        a: "Não. Ele acessa o link público, revisa a proposta e paga via Pix sem burocracia.",
      },
      {
        q: "Funciona para produtos e serviços?",
        a: "Sim. Itens com quantidade para produtos e agenda integrada para serviços.",
      },
      {
        q: "Como recebo o dinheiro?",
        a: "Os pagamentos via Pix caem direto na sua conta configurada na plataforma.",
      },
    ],
    [],
  );

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock scroll + ESC para menu mobile
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMenuOpen]);

  const t = reduceMotion ? 0 : 0.6;

  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900 selection:bg-emerald-100 scroll-smooth">
      {/* Skip link (acessibilidade) */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[999] rounded-xl bg-zinc-900 px-4 py-2 text-white"
      >
        Pular para o conteúdo
      </a>

      <header
        className={cx(
          "fixed inset-x-0 top-0 z-[100] transition-all duration-300",
          scrolled
            ? "bg-white/80 backdrop-blur-md border-b border-zinc-200/70 py-3 shadow-sm"
            : "bg-transparent py-5",
        )}
      >
        <nav className="mx-auto flex max-w-7xl items-center px-5 sm:px-6 lg:px-8">
          {/* Left: Logo */}
          <div className="relative flex items-center gap-3">
            <div className="absolute -top-6 left-0 hidden lg:flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-widest whitespace-nowrap">
              <Sparkles className="h-3 w-3" /> NOVO: AGENDA INTEGRADA
            </div>

            <Link
              to="/"
              className="flex items-center gap-2 group"
              aria-label="LuminorPay"
            >
              <img
                src={brandLogo}
                alt="LuminorPay"
                className="h-9 w-9 rounded-xl object-contain transition-transform group-hover:scale-110"
                loading="eager"
                draggable="false"
              />
              <span className="text-xl font-black tracking-tighter">
                Luminor<span className="text-emerald-500">Pay</span>
              </span>
            </Link>
          </div>
          {/* Center: Nav links (desktop) */}
          <div className="hidden lg:flex lg:gap-x-10 ml-10">
            {navLinks.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-base font-semibold text-zinc-600 hover:text-emerald-600 transition-colors"
              >
                {item.name}
              </a>
            ))}
          </div>
          {/* Right: Auth buttons (always right) */}
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Link
              to="/login"
              className={cx(
                "inline-flex items-center justify-center rounded-full font-black transition-all",
                "h-10 px-4 text-sm sm:h-11 sm:px-5 sm:text-base",
                "text-zinc-800 bg-white/80 ring-1 ring-zinc-200 hover:bg-white hover:ring-zinc-300",
              )}
            >
              Entrar
            </Link>

            <Link
              to="/register"
              className={cx(
                "inline-flex items-center justify-center rounded-full font-black transition-all",
                "h-10 px-4 text-sm sm:h-11 sm:px-6 sm:text-base",
                "bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm",
              )}
            >
              Criar conta
            </Link>

            {/* Mobile: menu button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 bg-zinc-100 rounded-full"
              aria-label="Abrir menu"
              aria-expanded={mobileMenuOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <main id="conteudo" className="relative pt-32 sm:pt-36 pb-20 lg:pt-44">
        {/* Fundo premium */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-200/40 blur-3xl" />
          <div className="absolute -bottom-28 right-[-120px] h-[520px] w-[520px] rounded-full bg-zinc-200/50 blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-zinc-50" />
        </div>

        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: t }}
              className="max-w-3xl mx-auto"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm">
                <BadgeCheck className="h-4 w-4" />
                Propostas, Pix e agenda em um único fluxo
              </div>

              <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight text-zinc-900 sm:text-6xl lg:text-7xl">
                Crie propostas que viram{" "}
                <span className="text-emerald-600 drop-shadow-sm">
                  pagamento
                </span>
                .
              </h1>

              <p className="mt-6 text-lg sm:text-xl text-zinc-600 leading-relaxed max-w-2xl mx-auto">
                Orçamento, aceite, Pix e agenda em um único link. Feito para
                quem não tem tempo a perder.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
                <Link
                  to="/register"
                  className="rounded-full bg-emerald-500 px-8 py-4 text-lg font-black text-white shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 group"
                >
                  Começar agora
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>

                <a
                  href="#planos"
                  className="rounded-full bg-white/80 px-8 py-4 text-lg font-black text-zinc-900 ring-1 ring-zinc-200 hover:bg-white hover:ring-zinc-300 transition-all flex items-center justify-center gap-2"
                >
                  Ver planos
                  <ChevronDown className="w-5 h-5" />
                </a>
              </div>

              {/* Trust row */}
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
                {[
                  { icon: Lock, label: "Sem cartão de crédito" },
                  { icon: Zap, label: "Setup em minutos" },
                  { icon: Link2, label: "Link público no WhatsApp" },
                ].map((it, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white/70 px-4 py-3 text-sm font-semibold text-zinc-700"
                  >
                    <it.icon className="h-4 w-4 text-emerald-600" />
                    {it.label}
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              style={{ y: yParallax }}
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-120px" }}
              transition={{ duration: reduceMotion ? 0 : 0.8 }}
              className="mt-14 sm:mt-16 lg:mt-20 max-w-6xl mx-auto"
            >
              <div className="rounded-[28px] border border-zinc-200 bg-white shadow-[0_10px_40px_-20px_rgba(0,0,0,0.25)] overflow-hidden">
                <HeroPreview />
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* RECURSOS */}
      <section
        id="recursos"
        className="py-24 sm:py-28 bg-zinc-50/60 scroll-mt-28"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center max-w-3xl mx-auto mb-14 sm:mb-16">
            <h2 className="text-3xl font-black sm:text-4xl lg:text-5xl">
              Tudo para escalar sua operação
            </h2>
            <p className="mt-5 text-base sm:text-lg text-zinc-600">
              Elimine a confusão de planilhas e mensagens soltas no WhatsApp.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <AnimatedSection key={i} delay={reduceMotion ? 0 : i * 0.06}>
                <div className="h-full rounded-3xl border border-zinc-200 bg-white p-8 sm:p-9 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-zinc-900/5 hover:ring-1 hover:ring-emerald-200 group">
                  <div className="inline-flex p-4 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                    <f.icon className="w-7 h-7" />
                  </div>
                  <h3 className="mt-7 font-black text-xl">{f.title}</h3>
                  <p className="mt-3 text-base text-zinc-600 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="py-24 sm:py-28 scroll-mt-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="text-center mb-14 sm:mb-16">
            <h2 className="text-3xl font-black lg:text-5xl">Como funciona?</h2>
            <p className="mt-5 text-base sm:text-lg text-zinc-600">
              Simples, rápido e profissional para você e seu cliente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {steps.map((step, i) => (
              <div
                key={i}
                className="rounded-3xl border border-zinc-200 bg-white p-8 sm:p-9 hover:shadow-xl hover:shadow-zinc-900/5 transition-all"
              >
                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-700">
                  <step.icon className="w-7 h-7" />
                </div>
                <h3 className="mt-6 text-xl sm:text-2xl font-black">
                  {step.title}
                </h3>
                <p className="mt-3 text-zinc-600 text-base leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section
        id="planos"
        className="py-24 sm:py-28 bg-zinc-50/60 scroll-mt-28"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="text-center mb-14 sm:mb-16">
            <h2 className="text-3xl font-black lg:text-5xl">
              Planos transparentes
            </h2>
            <p className="mt-5 text-base sm:text-lg text-zinc-600">
              Escolha o plano ideal e evolua conforme crescer.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan, i) => {
              const isEnterprise = !plan.price;
              const ctaTo = plan.cta?.to || "/register";
              const isMailto = String(ctaTo).startsWith("mailto:");

              const CTA = ({ className, children }) =>
                isMailto ? (
                  <a href={ctaTo} className={className}>
                    {children}
                  </a>
                ) : (
                  <Link to={ctaTo} className={className}>
                    {children}
                  </Link>
                );

              return (
                <AnimatedSection
                  key={i}
                  className={cx(
                    "relative flex flex-col rounded-[28px] p-8 sm:p-9 bg-white transition-all",
                    plan.popular ? "pt-11 sm:pt-12" : "", // + espaço no topo para não colidir com a pill
                    plan.popular
                      ? "border-2 border-emerald-500 shadow-xl shadow-emerald-500/10 lg:-translate-y-1"
                      : "border border-zinc-200 hover:shadow-xl hover:shadow-zinc-900/5",
                  )}
                >
                  {plan.popular && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-black px-4 py-2 rounded-full uppercase tracking-tight">
                      Mais Popular
                    </span>
                  )}

                  <div className="mb-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black text-2xl leading-tight">
                          {plan.name}
                        </h3>
                        {plan.subtitle && (
                          <div className="mt-1 text-sm font-semibold text-zinc-500">
                            {plan.subtitle}
                          </div>
                        )}
                      </div>

                      {/* badges */}
                      <div className="flex flex-col items-end gap-2 mt-1">
                        {Array.isArray(plan.badges) &&
                          plan.badges.slice(0, 2).map((b) => (
                            <span
                              key={b}
                              className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700"
                            >
                              {b}
                            </span>
                          ))}
                      </div>
                    </div>

                    {/* price */}
                    <div className="mt-5">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black">
                          {plan.price || "Fale com a gente"}
                        </span>
                        {plan.price && (
                          <span className="text-zinc-500 text-base font-semibold">
                            /mês
                          </span>
                        )}
                      </div>

                      {/* included pix + extra */}
                      {!isEnterprise && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-black text-zinc-800">
                            <QrCode className="h-4 w-4 text-emerald-600" />
                            {plan.includedPix} Pix/mês
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-zinc-600 ring-1 ring-zinc-200">
                            Pix extra:{" "}
                            <span className="font-black text-zinc-900">
                              {plan.extraPix}
                            </span>
                          </span>
                        </div>
                      )}

                      {/* microcopy */}
                      {plan.microcopy && (
                        <p className="mt-4 text-sm text-zinc-600 leading-relaxed">
                          {plan.microcopy}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* benefits */}
                  <div className="flex-1">
                    <div className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-3">
                      Benefícios
                    </div>
                    <ul className="space-y-3">
                      {plan.benefits.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-3 text-sm text-zinc-700"
                        >
                          <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                            <Check className="h-4 w-4" />
                          </span>
                          <span className="leading-snug">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA */}
                  <div className="mt-8">
                    <CTA
                      className={cx(
                        "w-full text-center py-4 rounded-2xl font-black text-base transition-all block",
                        plan.popular
                          ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-200/60"
                          : isEnterprise
                            ? "bg-zinc-900 text-white hover:bg-zinc-800"
                            : "bg-zinc-900 text-white hover:bg-zinc-800",
                      )}
                    >
                      {plan.cta?.label ||
                        (isEnterprise
                          ? "Falar com especialista"
                          : "Começar agora")}
                    </CTA>

                    {!isEnterprise && (
                      <div className="mt-3 text-[11px] text-zinc-500 text-center">
                        Inclui {plan.includedPix} Pix/mês • Pix extra disponível
                      </div>
                    )}
                  </div>
                </AnimatedSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ (Accordion) */}
      <section id="faq" className="py-24 sm:py-28 scroll-mt-28">
        <div className="mx-auto max-w-4xl px-5 sm:px-6">
          <h2 className="text-center text-3xl font-black mb-12 sm:mb-14 lg:text-5xl">
            Dúvidas comuns
          </h2>

          <div className="space-y-4">
            {faqs.map((item, i) => {
              const open = faqOpen === i;
              return (
                <div
                  key={i}
                  className="rounded-3xl border border-zinc-200 bg-white overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setFaqOpen(open ? -1 : i)}
                    className="w-full flex items-center justify-between gap-4 p-6 sm:p-7 text-left"
                    aria-expanded={open}
                  >
                    <span className="font-black text-lg sm:text-xl text-zinc-900">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={cx(
                        "h-5 w-5 shrink-0 transition-transform",
                        open ? "rotate-180" : "rotate-0",
                      )}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.25 }}
                      >
                        <div className="px-6 sm:px-7 pb-6 sm:pb-7 text-zinc-600 leading-relaxed">
                          {item.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="py-14 border-t border-zinc-100">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-zinc-500">
          <div className="flex justify-center items-center gap-2 mb-5">
            <img
              src={brandLogo}
              alt="LuminorPay"
              className="h-9 w-9 rounded-xl object-contain transition-transform group-hover:scale-110"
              loading="eager"
              draggable="false"
            />
            <span className="font-black text-zinc-900 text-base">
              LuminorPay
            </span>
          </div>
          <p>
            © {new Date().getFullYear()} LuminorPay. Todos os direitos
            reservados.
          </p>
        </div>
      </footer>

      {/* MOBILE MENU (overlay + drawer) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.button
              aria-label="Fechar menu"
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-[109] bg-black/30 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            <motion.aside
              role="dialog"
              aria-modal="true"
              className="fixed right-0 top-0 bottom-0 z-[110] w-[92%] max-w-sm bg-white shadow-2xl p-6 overflow-y-auto"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: reduceMotion ? 0 : 0.25 }}
            >
              <div className="flex justify-between items-center mb-10">
                <Link
                  to="/"
                  className="flex items-center gap-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Logo className="h-8 w-8" />
                  <span className="font-black text-zinc-900 text-base">
                    LuminorPay
                  </span>
                </Link>

                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 bg-zinc-100 rounded-full"
                  aria-label="Fechar"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex flex-col gap-4">
                {navLinks.map((it) => (
                  <a
                    key={it.name}
                    href={it.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-2xl px-4 py-4 text-lg font-black text-zinc-900 hover:bg-zinc-50 border border-zinc-100"
                  >
                    {it.name}
                  </a>
                ))}

                <div className="pt-6 mt-6 border-t border-zinc-100 flex flex-col gap-3">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-emerald-700 text-center py-4 rounded-2xl border border-emerald-100 bg-emerald-50 font-black"
                  >
                    Entrar
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="bg-zinc-900 text-white text-center py-4 rounded-2xl shadow-lg font-black"
                  >
                    Criar conta
                  </Link>
                </div>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
