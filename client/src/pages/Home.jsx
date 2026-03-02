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
  Moon,
  Sun,
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
  const [darkMode, setDarkMode] = useState(false);

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

  const ENTERPRISE_CONTACT = "/contact";

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

  // Dark mode toggle
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const t = reduceMotion ? 0 : 0.6;

  return (
    <div className="min-h-screen bg-surface font-sans text-foreground selection:bg-accent/20 scroll-smooth antialiased">
      {/* Skip link (acessibilidade) */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[999] rounded-xl bg-zinc-900 dark:bg-white px-5 py-3 text-white dark:text-zinc-900 font-semibold shadow-2xl ring-2 ring-accent focus:outline-none"
      >
        Pular para o conteúdo
      </a>

      {/* HEADER */}
      <header
        className={cx(
          "fixed inset-x-0 top-0 z-[100] transition-all duration-300",
          scrolled
            ? "bg-surface-glass backdrop-blur-xl border-b border-border shadow-sm"
            : "bg-transparent",
          "py-3 lg:py-4",
        )}
      >
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          {/* Left: Logo + Badge */}
          <div className="relative flex items-center gap-3">
            <div className="absolute -top-7 left-0 hidden lg:flex items-center gap-1.5 text-[10px] font-extrabold text-accent uppercase tracking-widest whitespace-nowrap">
              <Sparkles className="h-3 w-3" strokeWidth={3} />
              NOVO: AGENDA INTEGRADA
            </div>

            <Link
              to="/"
              className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded-lg"
              aria-label="LuminorPay - Página inicial"
            >
              <img
                src={brandLogo}
                alt=""
                className="h-9 w-9 rounded-xl object-contain transition-transform duration-300 group-hover:scale-110 group-focus-visible:scale-110"
                loading="eager"
                draggable="false"
              />
              <span className="text-xl font-black tracking-tight">
                Luminor<span className="text-accent">Pay</span>
              </span>
            </Link>
          </div>

          {/* Center: Nav links (desktop) */}
          <div className="hidden lg:flex lg:gap-x-8">
            {navLinks.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-sm font-semibold text-muted hover:text-foreground transition-colors focus:outline-none focus-visible:text-accent focus-visible:underline underline-offset-4"
              >
                {item.name}
              </a>
            ))}
          </div>

          {/* Right: Dark Mode + Auth buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Dark mode toggle (opcional) */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="hidden sm:flex p-2.5 rounded-full bg-surface-elevated hover:bg-surface-elevated/80 border border-border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label={darkMode ? "Ativar modo claro" : "Ativar modo escuro"}
            >
              {darkMode ? (
                <Sun className="h-4 w-4 text-muted" />
              ) : (
                <Moon className="h-4 w-4 text-muted" />
              )}
            </button>

            <Link
              to="/login"
              className={cx(
                "inline-flex items-center justify-center rounded-full font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                "h-10 px-5 text-sm lg:h-11 lg:px-6 lg:text-base",
                "text-foreground bg-surface-elevated hover:bg-surface-elevated/80 border border-border hover:border-border-hover",
              )}
            >
              Entrar
            </Link>

            <Link
              to="/register"
              className={cx(
                "relative inline-flex items-center justify-center rounded-full font-bold transition-all overflow-hidden group focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                "h-10 px-5 text-sm lg:h-11 lg:px-6 lg:text-base",
                "bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/25 hover:shadow-xl hover:shadow-accent/30",
              )}
            >
              {/* Sheen effect */}
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
              <span className="relative">Criar conta</span>
            </Link>

            {/* Mobile: menu button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2.5 bg-surface-elevated rounded-full border border-border hover:bg-surface-elevated/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Abrir menu"
              aria-expanded={mobileMenuOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <main
        id="conteudo"
        className="relative pt-32 sm:pt-40 pb-20 lg:pt-48 overflow-hidden"
      >
        {/* Premium background with grid + gradients */}
        <div className="absolute inset-0 -z-10">
          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
            style={{
              backgroundImage: `
                linear-gradient(to right, currentColor 1px, transparent 1px),
                linear-gradient(to bottom, currentColor 1px, transparent 1px)
              `,
              backgroundSize: "64px 64px",
            }}
          />

          {/* Hero glow */}
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-radial from-accent/10 via-accent/5 to-transparent blur-3xl" />
          <div className="absolute top-1/4 -right-48 w-[600px] h-[600px] bg-gradient-radial from-purple-500/5 via-transparent to-transparent blur-3xl" />

          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-surface via-surface to-surface-elevated" />
        </div>

        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: t, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-4xl mx-auto"
            >
              {/* Trust badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-glass backdrop-blur-sm px-4 py-2 text-xs font-bold text-accent shadow-sm">
                <BadgeCheck className="h-4 w-4" />
                Propostas, Pix e agenda em um único fluxo
              </div>

              {/* Headline */}
              <h1 className="mt-8 text-[clamp(2.5rem,6vw,5rem)] font-black leading-[1.05] tracking-tight">
                Crie propostas que viram{" "}
                <span className="bg-gradient-to-r from-accent via-emerald-500 to-accent bg-clip-text text-transparent">
                  pagamento
                </span>
                .
              </h1>

              {/* Subheadline */}
              <p className="mt-6 text-lg sm:text-xl text-muted leading-relaxed max-w-2xl mx-auto font-medium">
                Orçamento, aceite, Pix e agenda em um único link. Feito para
                quem não tem tempo a perder.
              </p>

              {/* CTAs */}
              <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
                <Link
                  to="/register"
                  className="group relative overflow-hidden rounded-full bg-accent px-8 py-4 text-base lg:text-lg font-bold text-white shadow-2xl shadow-accent/30 hover:shadow-accent/40 transition-all duration-300 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface hover:scale-[1.02]"
                >
                  {/* Sheen */}
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                  <span className="relative">Começar agora</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>

                <a
                  href="#planos"
                  className="rounded-full bg-surface-elevated hover:bg-surface-elevated/80 border border-border hover:border-border-hover px-8 py-4 text-base lg:text-lg font-bold text-foreground transition-all flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  Ver planos
                  <ChevronDown className="w-5 h-5" />
                </a>
              </div>

              {/* Trust row */}
              <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
                {[
                  { icon: Lock, label: "Sem cartão de crédito" },
                  { icon: Zap, label: "Setup em minutos" },
                  { icon: Link2, label: "Link público no WhatsApp" },
                ].map((it, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-center gap-2.5 rounded-2xl border border-border bg-surface-glass backdrop-blur-sm px-4 py-3.5 text-sm font-semibold text-muted shadow-sm"
                  >
                    <it.icon
                      className="h-4 w-4 text-accent"
                      strokeWidth={2.5}
                    />
                    {it.label}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Hero preview */}
            <motion.div
              style={{ y: reduceMotion ? 0 : yParallax }}
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-120px" }}
              transition={{
                duration: reduceMotion ? 0 : 0.8,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="mt-16 sm:mt-20 lg:mt-24 max-w-6xl mx-auto"
            >
              <div className="rounded-[32px] border border-border bg-surface-elevated shadow-[0_20px_80px_-20px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_80px_-20px_rgba(0,0,0,0.4)] overflow-hidden ring-1 ring-border/50">
                <HeroPreview />
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* RECURSOS */}
      <section id="recursos" className="py-24 sm:py-32 scroll-mt-24 relative">
        {/* Subtle bg */}
        <div className="absolute inset-0 bg-gradient-to-b from-surface-elevated/50 to-surface -z-10" />

        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
            <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-black leading-tight tracking-tight">
              Tudo para escalar sua operação
            </h2>
            <p className="mt-5 text-base sm:text-lg text-muted font-medium leading-relaxed">
              Elimine a confusão de planilhas e mensagens soltas no WhatsApp.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <AnimatedSection key={i} delay={reduceMotion ? 0 : i * 0.05}>
                <div className="group h-full rounded-3xl border border-border bg-surface-glass backdrop-blur-sm p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-accent/5 hover:border-accent/30 hover:bg-surface-elevated/80 focus-within:ring-2 focus-within:ring-accent">
                  <div className="inline-flex p-4 rounded-2xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-all duration-300">
                    <f.icon className="w-6 h-6" strokeWidth={2.5} />
                  </div>
                  <h3 className="mt-6 font-bold text-xl leading-tight">
                    {f.title}
                  </h3>
                  <p className="mt-3 text-base text-muted leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section
        id="como-funciona"
        className="py-24 sm:py-32 scroll-mt-24 relative"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="text-center mb-16 sm:mb-20">
            <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-black leading-tight tracking-tight">
              Como funciona?
            </h2>
            <p className="mt-5 text-base sm:text-lg text-muted font-medium leading-relaxed">
              Simples, rápido e profissional para você e seu cliente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {steps.map((step, i) => (
              <div
                key={i}
                className="group rounded-3xl border border-border bg-surface-glass backdrop-blur-sm p-8 hover:shadow-2xl hover:shadow-accent/5 hover:border-accent/30 transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all duration-300">
                  <step.icon className="w-7 h-7" strokeWidth={2.5} />
                </div>
                <h3 className="mt-6 text-xl font-bold leading-tight">
                  {step.title}
                </h3>
                <p className="mt-3 text-muted text-base leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="py-24 sm:py-32 scroll-mt-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-surface-elevated/50 to-surface -z-10" />

        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="text-center mb-16 sm:mb-20">
            <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-black leading-tight tracking-tight">
              Planos transparentes
            </h2>
            <p className="mt-5 text-base sm:text-lg text-muted font-medium leading-relaxed">
              Escolha o plano ideal e evolua conforme crescer.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
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
                  delay={reduceMotion ? 0 : i * 0.05}
                  className={cx(
                    "relative flex flex-col rounded-[32px] p-8 bg-surface-glass backdrop-blur-sm border transition-all duration-300",
                    plan.popular
                      ? "border-accent shadow-2xl shadow-accent/10 lg:scale-[1.02]"
                      : "border-border hover:shadow-xl hover:shadow-accent/5 hover:border-accent/30",
                  )}
                >
                  {plan.popular && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-extrabold px-5 py-2 rounded-full uppercase tracking-wide shadow-lg">
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
                          <div className="mt-1.5 text-sm font-semibold text-muted">
                            {plan.subtitle}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mt-6">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black">
                          {plan.price || "Sob consulta"}
                        </span>
                        {plan.price && (
                          <span className="text-muted text-base font-semibold">
                            /mês
                          </span>
                        )}
                      </div>

                      {/* Pix info */}
                      {!isEnterprise && (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent border border-accent/20">
                            <QrCode className="h-3.5 w-3.5" />
                            {plan.includedPix} Pix/mês
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-muted border border-border">
                            Extra:{" "}
                            <span className="font-bold text-foreground">
                              {plan.extraPix}
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Microcopy */}
                      {plan.microcopy && (
                        <p className="mt-4 text-sm text-muted leading-relaxed">
                          {plan.microcopy}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Benefits */}
                  <div className="flex-1">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-muted mb-4">
                      Benefícios
                    </div>
                    <ul className="space-y-3">
                      {plan.benefits.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-3 text-sm text-foreground"
                        >
                          <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-accent flex-shrink-0">
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          </span>
                          <span className="leading-snug font-medium">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA */}
                  <div className="mt-8">
                    <CTA
                      className={cx(
                        "group relative w-full overflow-hidden text-center py-4 rounded-2xl font-bold text-base transition-all duration-300 block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                        plan.popular
                          ? "bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/30 hover:shadow-xl hover:shadow-accent/40"
                          : "bg-foreground text-surface hover:bg-foreground/90 shadow-md",
                      )}
                    >
                      {/* Sheen */}
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                      <span className="relative">
                        {plan.cta?.label ||
                          (isEnterprise
                            ? "Falar com especialista"
                            : "Começar agora")}
                      </span>
                    </CTA>

                    {!isEnterprise && (
                      <div className="mt-3 text-[11px] text-muted text-center font-medium">
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

      {/* FAQ */}
      <section id="faq" className="py-24 sm:py-32 scroll-mt-24">
        <div className="mx-auto max-w-4xl px-5 sm:px-6">
          <h2 className="text-center text-[clamp(2rem,5vw,3.5rem)] font-black mb-14 sm:mb-16 tracking-tight">
            Dúvidas comuns
          </h2>

          <div className="space-y-4">
            {faqs.map((item, i) => {
              const open = faqOpen === i;
              return (
                <div
                  key={i}
                  className="rounded-3xl border border-border bg-surface-glass backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-accent/30"
                >
                  <button
                    type="button"
                    onClick={() => setFaqOpen(open ? -1 : i)}
                    className="w-full flex items-center justify-between gap-4 p-6 sm:p-7 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                    aria-expanded={open}
                  >
                    <span className="font-bold text-lg sm:text-xl text-foreground leading-tight">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={cx(
                        "h-5 w-5 shrink-0 transition-transform duration-300 text-muted",
                        open ? "rotate-180 text-accent" : "rotate-0",
                      )}
                      strokeWidth={2.5}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                          duration: reduceMotion ? 0 : 0.3,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                      >
                        <div className="px-6 sm:px-7 pb-6 sm:pb-7 text-muted leading-relaxed font-medium">
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

      {/* FOOTER */}
      <footer className="py-16 border-t border-border bg-surface-elevated/50">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="flex justify-center items-center gap-2.5 mb-6">
            <img
              src={brandLogo}
              alt=""
              className="h-10 w-10 rounded-xl object-contain"
              loading="lazy"
              draggable="false"
            />
            <span className="font-black text-foreground text-lg tracking-tight">
              LuminorPay
            </span>
          </div>
          <p className="text-sm text-muted font-medium">
            © {new Date().getFullYear()} LuminorPay. Todos os direitos
            reservados.
          </p>
        </div>
      </footer>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.button
              aria-label="Fechar menu"
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-[109] bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
            />

            <motion.aside
              role="dialog"
              aria-modal="true"
              className="fixed right-0 top-0 bottom-0 z-[110] w-[90%] max-w-sm bg-surface border-l border-border shadow-2xl p-6 overflow-y-auto"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{
                duration: reduceMotion ? 0 : 0.3,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className="flex justify-between items-center mb-10">
                <Link
                  to="/"
                  className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Logo className="h-8 w-8" />
                  <span className="font-black text-foreground text-base tracking-tight">
                    LuminorPay
                  </span>
                </Link>

                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 bg-surface-elevated rounded-full border border-border hover:bg-surface-elevated/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="Fechar menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex flex-col gap-3">
                {navLinks.map((it) => (
                  <a
                    key={it.name}
                    href={it.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-2xl px-5 py-4 text-base font-bold text-foreground hover:bg-surface-elevated border border-border hover:border-accent/30 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                  >
                    {it.name}
                  </a>
                ))}

                <div className="pt-6 mt-6 border-t border-border flex flex-col gap-3">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-foreground text-center py-4 rounded-2xl border border-border bg-surface-elevated hover:bg-surface-elevated/80 font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Entrar
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="bg-accent text-white text-center py-4 rounded-2xl shadow-lg shadow-accent/30 font-bold hover:bg-accent-hover transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
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
