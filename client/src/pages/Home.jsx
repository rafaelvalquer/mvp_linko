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
  Sun,
  Moon,
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

const EASE_OUT = [0.16, 1, 0.3, 1];

function useThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem("theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      window.localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {
      // ignore
    }
  }, [isDark]);

  return { isDark, setIsDark };
}

function AetherBackdrop() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_-10%,rgb(var(--accent)/0.18),transparent_55%),radial-gradient(900px_circle_at_90%_10%,rgb(56_189_248/0.10),transparent_55%),radial-gradient(700px_circle_at_10%_90%,rgb(15_23_42/0.06),transparent_55%)] dark:bg-[radial-gradient(1200px_circle_at_50%_-10%,rgb(var(--accent)/0.22),transparent_55%),radial-gradient(900px_circle_at_90%_10%,rgb(56_189_248/0.12),transparent_55%),radial-gradient(700px_circle_at_10%_90%,rgb(0_0_0/0.35),transparent_55%)]" />

      <div
        className="absolute inset-0 opacity-[0.22] dark:opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(var(--grid) / 0.55) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--grid) / 0.55) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(60% 55% at 50% 30%, black 0%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(60% 55% at 50% 30%, black 0%, transparent 70%)",
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-[rgb(var(--bg))] via-[rgb(var(--bg))] to-[rgb(var(--surface-2))]" />
    </div>
  );
}

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [faqOpen, setFaqOpen] = useState(0);

  const { isDark, setIsDark } = useThemeToggle();

  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const yParallax = useTransform(
    scrollYProgress,
    [0, 1],
    [0, reduceMotion ? 0 : -120],
  );

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
        title: "Saques e repasses",
        desc: "Visão clara dos recebimentos e movimentações do workspace.",
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
        subtitle: "Essencial",
        price: "R$ 35,90",
        description:
          "Para quem quer sair do improviso e começar com uma operação profissional.",
        audience: "Autônomos e iniciantes",
        badge: "Entrada ideal",
        cta: { label: "Começar agora", to: "/register" },
        benefits: [
          "Propostas e orçamentos",
          "Link público sem login",
          "Pix com QR Code",
          "Status de pagamento",
          "Agenda básica",
          "Dashboard essencial",
        ],
      },
      {
        name: "Pro",
        subtitle: "Profissional",
        price: "R$ 99,90",
        popular: true,
        description:
          "Mais velocidade comercial, organização e apresentação para vender melhor.",
        audience: "Prestadores em crescimento",
        badge: "Mais escolhido",
        cta: { label: "Começar agora", to: "/register" },
        benefits: [
          "Tudo do Start",
          "Cadastro de clientes",
          "Cadastro de produtos e serviços",
          "Sinal/entrada e condições de pagamento",
          "Dashboard avançado",
          "Agenda com mais controle",
        ],
      },
      {
        name: "Business",
        subtitle: "Equipe",
        price: "R$ 279,90",
        description:
          "Para operações com equipe, mais volume e necessidade de visão consolidada.",
        audience: "Pequenas empresas e times",
        badge: "Escala operacional",
        cta: { label: "Começar agora", to: "/register" },
        benefits: [
          "Tudo do Pro",
          "Multiusuário com permissões",
          "Relatórios mais completos",
          "Visão consolidada da operação",
          "Mais controle para o time",
          "Prioridade no suporte",
        ],
      },
      {
        name: "Enterprise",
        subtitle: "Sob medida",
        price: null,
        description:
          "Modelo personalizado para fluxos robustos, integrações e operação avançada.",
        audience: "Empresas com alta complexidade",
        badge: "Customizado",
        cta: { label: "Falar com especialista", to: ENTERPRISE_CONTACT },
        benefits: [
          "Implantação personalizada",
          "Integrações e automações",
          "SLA e suporte dedicado",
          "Permissões e regras avançadas",
          "Arquitetura orientada à operação",
          "Condições sob consulta",
        ],
      },
    ],
    [],
  );

  const comparisonRows = useMemo(
    () => [
      {
        label: "Propostas e link público",
        values: [true, true, true, true],
      },
      {
        label: "Pix ilimitado",
        values: [true, true, true, true],
      },
      {
        label: "Agenda integrada",
        values: [true, true, true, true],
      },
      {
        label: "Cadastro de clientes",
        values: [false, true, true, true],
      },
      {
        label: "Cadastro de produtos/serviços",
        values: [false, true, true, true],
      },
      {
        label: "Dashboard avançado",
        values: [false, true, true, true],
      },
      {
        label: "Multiusuário e permissões",
        values: [false, false, true, true],
      },
      {
        label: "Relatórios mais completos",
        values: [false, false, true, true],
      },
      {
        label: "Suporte dedicado / sob medida",
        values: [false, false, false, true],
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

  const t = reduceMotion ? 0 : 0.65;

  const ui = {
    page: "min-h-screen font-sans text-[rgb(var(--text))] bg-[rgb(var(--bg))] selection:bg-emerald-200/30 selection:text-[rgb(var(--text))]",
    container: "mx-auto max-w-7xl px-5 sm:px-6 lg:px-8",
    focusRing:
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--bg))]",
    glass:
      "backdrop-blur-xl bg-[rgb(var(--surface)/0.72)] border border-[rgb(var(--border)/0.75)] shadow-[0_10px_40px_-28px_rgba(0,0,0,0.25)] dark:shadow-[0_10px_40px_-28px_rgba(0,0,0,0.55)]",
    glassSoft:
      "backdrop-blur-xl bg-[rgb(var(--surface)/0.62)] border border-[rgb(var(--border)/0.65)]",
    subtleText: "text-[rgb(var(--muted))]",
  };

  return (
    <div className={ui.page}>
      <a
        href="#conteudo"
        className={cx(
          "sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[999]",
          "rounded-xl bg-[rgb(var(--text))] px-4 py-2 text-[rgb(var(--bg))]",
          ui.focusRing,
        )}
      >
        Pular para o conteúdo
      </a>

      <header
        className={cx(
          "fixed inset-x-0 top-0 z-[100] transition-all duration-300",
          scrolled
            ? cx(
                "py-3",
                "bg-[rgb(var(--surface)/0.72)] backdrop-blur-xl",
                "border-b border-[rgb(var(--border)/0.7)]",
                "shadow-[0_10px_30px_-22px_rgba(0,0,0,0.35)]",
              )
            : "py-5 bg-transparent",
        )}
      >
        <nav className={cx(ui.container, "flex items-center")}>
          <div className="relative flex items-center gap-3">
            <div
              className={cx(
                "absolute -top-6 left-0 hidden lg:flex items-center gap-1",
                "text-[10px] font-extrabold uppercase tracking-[0.22em] whitespace-nowrap",
                "text-emerald-700/90 dark:text-emerald-300/90",
              )}
            />

            <Link
              to="/"
              className={cx(
                "flex items-center gap-2 group",
                "rounded-2xl",
                ui.focusRing,
              )}
              aria-label="LuminorPay"
            >
              <img
                src={brandLogo}
                alt="LuminorPay"
                className="h-9 w-9 rounded-xl object-contain transition-transform group-hover:scale-110"
                loading="eager"
                draggable="false"
              />
              <span className="text-xl font-black tracking-tight">
                Luminor<span className="text-emerald-500">Pay</span>
              </span>
            </Link>
          </div>

          <div className="hidden lg:flex lg:gap-x-10 ml-10">
            {navLinks.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className={cx(
                  "text-sm font-semibold tracking-wide",
                  "text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]",
                  "relative py-2",
                  "after:absolute after:left-0 after:right-0 after:-bottom-1 after:h-px after:scale-x-0 after:bg-emerald-400/70 after:transition-transform after:duration-300 after:origin-left hover:after:scale-x-100",
                  ui.focusRing,
                )}
              >
                {item.name}
              </a>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsDark((v) => !v)}
              className={cx(
                "hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-full",
                ui.glassSoft,
                "transition-colors",
                "hover:bg-[rgb(var(--surface)/0.78)]",
                ui.focusRing,
              )}
              aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
            >
              {isDark ? (
                <Sun className="h-5 w-5 text-emerald-300" />
              ) : (
                <Moon className="h-5 w-5 text-emerald-700" />
              )}
            </button>

            <Link
              to="/login"
              className={cx(
                "inline-flex items-center justify-center rounded-full font-extrabold transition-all",
                "h-10 px-4 text-sm sm:h-11 sm:px-5 sm:text-base",
                ui.glassSoft,
                "text-[rgb(var(--text))]",
                "hover:bg-[rgb(var(--surface)/0.78)]",
                ui.focusRing,
              )}
            >
              Entrar
            </Link>

            <Link
              to="/register"
              className={cx(
                "group relative inline-flex items-center justify-center rounded-full font-extrabold transition-all",
                "h-10 px-4 text-sm sm:h-11 sm:px-6 sm:text-base",
                "bg-emerald-500 text-white hover:bg-emerald-600",
                "shadow-[0_18px_40px_-18px_rgb(var(--accent)/0.55)]",
                "overflow-hidden",
                ui.focusRing,
              )}
            >
              <span className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="absolute -inset-y-10 -left-24 w-24 rotate-12 bg-white/25 blur-md group-hover:animate-[sheen_1.1s_ease-in-out] motion-reduce:animate-none" />
              </span>
              Criar conta
            </Link>

            <button
              onClick={() => setMobileMenuOpen(true)}
              className={cx(
                "lg:hidden p-2 rounded-full",
                ui.glassSoft,
                "hover:bg-[rgb(var(--surface)/0.78)]",
                ui.focusRing,
              )}
              aria-label="Abrir menu"
              aria-expanded={mobileMenuOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </nav>
      </header>

      <main id="conteudo" className="relative pt-32 sm:pt-36 pb-20 lg:pt-44">
        <AetherBackdrop />

        <div className={ui.container}>
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: t, ease: EASE_OUT }}
              className="max-w-3xl mx-auto"
            >
              <div
                className={cx(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold",
                  ui.glass,
                  "text-emerald-700 dark:text-emerald-300",
                )}
              >
                <BadgeCheck className="h-4 w-4" />
                Propostas, Pix e agenda em um único fluxo
              </div>

              <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
                Crie propostas que viram{" "}
                <span className="text-emerald-500">pagamento</span>.
              </h1>

              <p
                className={cx(
                  "mt-6 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto",
                  ui.subtleText,
                )}
              >
                Orçamento, aceite, Pix e agenda em um único link. Feito para
                quem não tem tempo a perder.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
                <Link
                  to="/register"
                  className={cx(
                    "group relative rounded-full px-8 py-4 text-lg font-extrabold text-white",
                    "bg-emerald-500 hover:bg-emerald-600",
                    "shadow-[0_22px_50px_-24px_rgb(var(--accent)/0.75)]",
                    "transition-colors overflow-hidden",
                    "inline-flex items-center justify-center gap-2",
                    ui.focusRing,
                  )}
                >
                  <span className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="absolute -inset-y-10 -left-28 w-28 rotate-12 bg-white/25 blur-md group-hover:animate-[sheen_1.1s_ease-in-out] motion-reduce:animate-none" />
                  </span>
                  Começar agora
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>

                <a
                  href="#planos"
                  className={cx(
                    "rounded-full px-8 py-4 text-lg font-extrabold",
                    ui.glass,
                    "hover:bg-[rgb(var(--surface)/0.78)]",
                    "transition-colors flex items-center justify-center gap-2",
                    ui.focusRing,
                  )}
                >
                  Ver planos
                  <ChevronDown className="w-5 h-5" />
                </a>
              </div>

              <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
                {[
                  { icon: Lock, label: "Sem cartão de crédito" },
                  { icon: Zap, label: "Setup em minutos" },
                  { icon: Link2, label: "Link público no WhatsApp" },
                ].map((it, idx) => (
                  <div
                    key={idx}
                    className={cx(
                      "flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold",
                      ui.glass,
                      "text-[rgb(var(--muted))]",
                    )}
                  >
                    <it.icon className="h-4 w-4 text-emerald-500" />
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
              transition={{ duration: reduceMotion ? 0 : 0.85, ease: EASE_OUT }}
              className="mt-14 sm:mt-16 lg:mt-20 max-w-6xl mx-auto"
            >
              <div
                className={cx(
                  "rounded-[28px] overflow-hidden",
                  ui.glass,
                  "shadow-[0_18px_70px_-50px_rgba(0,0,0,0.45)]",
                )}
              >
                <HeroPreview />
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      <section
        id="recursos"
        className="py-24 sm:py-28 scroll-mt-28 bg-[rgb(var(--surface-2))]"
      >
        <div className={ui.container}>
          <AnimatedSection className="text-center max-w-3xl mx-auto mb-14 sm:mb-16">
            <h2 className="text-3xl font-black sm:text-4xl lg:text-5xl">
              Tudo para escalar sua operação
            </h2>
            <p className={cx("mt-5 text-base sm:text-lg", ui.subtleText)}>
              Elimine a confusão de planilhas e mensagens soltas no WhatsApp.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <AnimatedSection key={i} delay={reduceMotion ? 0 : i * 0.06}>
                <div
                  className={cx(
                    "h-full rounded-3xl p-8 sm:p-9 transition-all group",
                    ui.glass,
                    "hover:-translate-y-1 hover:shadow-[0_24px_60px_-50px_rgba(0,0,0,0.55)]",
                  )}
                >
                  <div
                    className={cx(
                      "inline-flex p-4 rounded-2xl transition-colors",
                      "bg-emerald-500/10 text-emerald-600",
                      "group-hover:bg-emerald-500 group-hover:text-white",
                    )}
                  >
                    <f.icon className="w-7 h-7" />
                  </div>
                  <h3 className="mt-7 font-black text-xl">{f.title}</h3>
                  <p
                    className={cx(
                      "mt-3 text-base leading-relaxed",
                      ui.subtleText,
                    )}
                  >
                    {f.desc}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="py-24 sm:py-28 scroll-mt-28">
        <div className={ui.container}>
          <div className="text-center mb-14 sm:mb-16">
            <h2 className="text-3xl font-black lg:text-5xl">Como funciona?</h2>
            <p className={cx("mt-5 text-base sm:text-lg", ui.subtleText)}>
              Simples, rápido e profissional para você e seu cliente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {steps.map((step, i) => (
              <div
                key={i}
                className={cx(
                  "rounded-3xl p-8 sm:p-9 transition-all",
                  ui.glass,
                  "hover:shadow-[0_24px_60px_-50px_rgba(0,0,0,0.55)]",
                )}
              >
                <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
                  <step.icon className="w-7 h-7" />
                </div>
                <h3 className="mt-6 text-xl sm:text-2xl font-black">
                  {step.title}
                </h3>
                <p
                  className={cx(
                    "mt-3 text-base leading-relaxed",
                    ui.subtleText,
                  )}
                >
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="planos"
        className="relative py-24 sm:py-28 scroll-mt-28 bg-[rgb(var(--surface-2))]"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute right-0 top-1/3 h-56 w-56 rounded-full bg-sky-400/10 blur-3xl" />
        </div>

        <div className={ui.container}>
          <div className="text-center mb-14 sm:mb-16">
            <div
              className={cx(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold",
                ui.glass,
                "text-emerald-700 dark:text-emerald-300",
              )}
            >
              <Sparkles className="h-4 w-4" />
              Pix ilimitado em todos os planos
            </div>

            <h2 className="mt-6 text-3xl font-black lg:text-5xl">
              Escolha o plano certo para o seu momento
            </h2>

            <p
              className={cx(
                "mt-5 text-base sm:text-lg max-w-3xl mx-auto",
                ui.subtleText,
              )}
            >
              Todos os planos mantêm a mesma experiência profissional para o
              cliente. O que muda é o nível de estrutura, gestão e escala para
              sua operação.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-4">
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
                    "relative flex h-full flex-col overflow-hidden rounded-[30px] p-8 sm:p-9",
                    ui.glass,
                    plan.popular
                      ? "border-2 border-emerald-500/90 shadow-[0_26px_70px_-55px_rgb(var(--accent)/0.85)] lg:-translate-y-2"
                      : "hover:-translate-y-1 hover:shadow-[0_24px_60px_-50px_rgba(0,0,0,0.55)]",
                  )}
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-500/10 to-transparent" />

                  {plan.popular && (
                    <div className="absolute right-5 top-5">
                      <span className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white shadow-[0_18px_40px_-24px_rgb(var(--accent)/0.75)]">
                        Mais popular
                      </span>
                    </div>
                  )}

                  <div className="relative">
                    <div className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                      {plan.subtitle}
                    </div>

                    <div className="mt-5 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-2xl font-black leading-tight">
                          {plan.name}
                        </h3>
                        <p
                          className={cx(
                            "mt-3 text-sm leading-relaxed",
                            ui.subtleText,
                          )}
                        >
                          {plan.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="flex items-end gap-2">
                        <span className="text-4xl font-black">
                          {plan.price || "Sob consulta"}
                        </span>
                        {plan.price && (
                          <span
                            className={cx(
                              "pb-1 text-base font-semibold",
                              ui.subtleText,
                            )}
                          >
                            /mês
                          </span>
                        )}
                      </div>

                      <div className="mt-4 inline-flex items-center rounded-full border border-emerald-500/15 bg-emerald-500/8 px-3 py-1.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                        {plan.badge}
                      </div>
                    </div>

                    <div
                      className={cx(
                        "mt-6 rounded-2xl p-4",
                        "border border-[rgb(var(--border)/0.65)] bg-[rgb(var(--surface)/0.75)]",
                      )}
                    >
                      <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[rgb(var(--muted-2))]">
                        Ideal para
                      </div>
                      <div className="mt-2 text-sm font-semibold text-[rgb(var(--text))]">
                        {plan.audience}
                      </div>
                    </div>
                  </div>

                  <div className="mt-7 flex-1">
                    <div className="mb-3 text-xs font-extrabold uppercase tracking-[0.22em] text-[rgb(var(--muted-2))]">
                      Recursos principais
                    </div>

                    <ul className="space-y-3">
                      {plan.benefits.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-3 text-sm text-[rgb(var(--muted))]"
                        >
                          <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                            <Check className="h-4 w-4" />
                          </span>
                          <span className="leading-snug">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8">
                    <CTA
                      className={cx(
                        "group relative block w-full overflow-hidden rounded-2xl py-4 text-center text-base font-extrabold transition-colors",
                        ui.focusRing,
                        plan.popular
                          ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_18px_40px_-24px_rgb(var(--accent)/0.75)]"
                          : "bg-[rgb(var(--text))] text-[rgb(var(--bg))] hover:opacity-95",
                      )}
                    >
                      <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="absolute -inset-y-10 -left-28 w-28 rotate-12 bg-white/25 blur-md group-hover:animate-[sheen_1.1s_ease-in-out] motion-reduce:animate-none" />
                      </span>
                      {plan.cta?.label ||
                        (isEnterprise
                          ? "Falar com especialista"
                          : "Começar agora")}
                    </CTA>
                  </div>
                </AnimatedSection>
              );
            })}
          </div>

          <div
            className={cx(
              "mt-8 rounded-[28px] p-4 sm:p-5 lg:p-6 overflow-hidden",
              ui.glass,
            )}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-5">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-[rgb(var(--muted-2))]">
                  Comparativo rápido
                </div>
                <h3 className="mt-2 text-xl sm:text-2xl font-black">
                  Compare os planos lado a lado
                </h3>
              </div>

              <div className={cx("text-sm", ui.subtleText)}>
                Mesmo fluxo de propostas, pagamentos e Pix ilimitado em toda a
                plataforma.
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[840px]">
                <div className="grid grid-cols-[1.5fr_repeat(4,1fr)] gap-3 mb-3">
                  <div />
                  {plans.map((plan) => (
                    <div
                      key={plan.name}
                      className={cx(
                        "rounded-2xl px-4 py-4 text-center",
                        plan.popular
                          ? "border border-emerald-500/40 bg-emerald-500/10"
                          : "border border-[rgb(var(--border)/0.65)] bg-[rgb(var(--surface)/0.72)]",
                      )}
                    >
                      <div className="text-sm font-black">{plan.name}</div>
                      <div className={cx("mt-1 text-xs", ui.subtleText)}>
                        {plan.price || "Sob consulta"}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  {comparisonRows.map((row) => (
                    <div
                      key={row.label}
                      className="grid grid-cols-[1.5fr_repeat(4,1fr)] gap-3"
                    >
                      <div
                        className={cx(
                          "rounded-2xl px-4 py-4 text-sm font-semibold",
                          "border border-[rgb(var(--border)/0.65)] bg-[rgb(var(--surface)/0.72)]",
                        )}
                      >
                        {row.label}
                      </div>

                      {row.values.map((value, idx) => (
                        <div
                          key={`${row.label}-${idx}`}
                          className={cx(
                            "rounded-2xl px-4 py-4 flex items-center justify-center",
                            "border border-[rgb(var(--border)/0.65)] bg-[rgb(var(--surface)/0.72)]",
                          )}
                        >
                          {value ? (
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                              <Check className="h-4 w-4" />
                            </span>
                          ) : (
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--surface-2))] text-[rgb(var(--muted-2))]">
                              <X className="h-4 w-4" />
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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
                  className={cx("rounded-3xl overflow-hidden", ui.glass)}
                >
                  <button
                    type="button"
                    onClick={() => setFaqOpen(open ? -1 : i)}
                    className={cx(
                      "w-full flex items-center justify-between gap-4 p-6 sm:p-7 text-left",
                      "hover:bg-[rgb(var(--surface)/0.78)] transition-colors",
                      ui.focusRing,
                    )}
                    aria-expanded={open}
                  >
                    <span className="font-black text-lg sm:text-xl">
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
                        transition={{
                          duration: reduceMotion ? 0 : 0.28,
                          ease: EASE_OUT,
                        }}
                      >
                        <div
                          className={cx(
                            "px-6 sm:px-7 pb-6 sm:pb-7 leading-relaxed",
                            ui.subtleText,
                          )}
                        >
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

      <footer className="py-14 border-t border-[rgb(var(--border)/0.65)]">
        <div
          className={cx(
            ui.container,
            "text-center text-sm text-[rgb(var(--muted-2))]",
          )}
        >
          <div className="flex justify-center items-center gap-2 mb-5">
            <img
              src={brandLogo}
              alt="LuminorPay"
              className="h-9 w-9 rounded-xl object-contain transition-transform group-hover:scale-110"
              loading="eager"
              draggable="false"
            />
            <span className="font-black text-[rgb(var(--text))] text-base">
              LuminorPay
            </span>
          </div>
          <p>
            © {new Date().getFullYear()} LuminorPay. Todos os direitos
            reservados.
          </p>
        </div>
      </footer>

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
              transition={{ duration: reduceMotion ? 0 : 0.18, ease: EASE_OUT }}
            />

            <motion.aside
              role="dialog"
              aria-modal="true"
              className={cx(
                "fixed right-0 top-0 bottom-0 z-[110] w-[92%] max-w-sm",
                "p-6 overflow-y-auto",
                "shadow-2xl",
                ui.glass,
              )}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: reduceMotion ? 0 : 0.28, ease: EASE_OUT }}
            >
              <div className="flex justify-between items-center mb-10">
                <Link
                  to="/"
                  className={cx(
                    "flex items-center gap-2 rounded-2xl",
                    ui.focusRing,
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Logo className="h-8 w-8" />
                  <span className="font-black text-[rgb(var(--text))] text-base">
                    LuminorPay
                  </span>
                </Link>

                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className={cx(
                    "p-2 rounded-full",
                    ui.glassSoft,
                    "hover:bg-[rgb(var(--surface)/0.78)] transition-colors",
                    ui.focusRing,
                  )}
                  aria-label="Fechar"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6 sm:hidden">
                <button
                  type="button"
                  onClick={() => setIsDark((v) => !v)}
                  className={cx(
                    "inline-flex w-full items-center justify-between rounded-2xl px-4 py-4",
                    ui.glassSoft,
                    ui.focusRing,
                  )}
                  aria-label={
                    isDark ? "Ativar tema claro" : "Ativar tema escuro"
                  }
                >
                  <span className="text-sm font-extrabold tracking-wide">
                    {isDark ? "Tema claro" : "Tema escuro"}
                  </span>
                  {isDark ? (
                    <Sun className="h-5 w-5 text-emerald-300" />
                  ) : (
                    <Moon className="h-5 w-5 text-emerald-700" />
                  )}
                </button>
              </div>

              <nav className="flex flex-col gap-4">
                {navLinks.map((it) => (
                  <a
                    key={it.name}
                    href={it.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cx(
                      "rounded-2xl px-4 py-4 text-lg font-extrabold",
                      ui.glassSoft,
                      "hover:bg-[rgb(var(--surface)/0.78)] transition-colors",
                      ui.focusRing,
                    )}
                  >
                    {it.name}
                  </a>
                ))}

                <div className="pt-6 mt-6 border-t border-[rgb(var(--border)/0.65)] flex flex-col gap-3">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cx(
                      "text-center py-4 rounded-2xl font-extrabold",
                      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
                      "border border-emerald-500/20",
                      ui.focusRing,
                    )}
                  >
                    Entrar
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cx(
                      "group relative bg-emerald-500 text-white text-center py-4 rounded-2xl",
                      "shadow-[0_18px_40px_-24px_rgb(var(--accent)/0.75)]",
                      "font-extrabold overflow-hidden",
                      ui.focusRing,
                    )}
                  >
                    <span className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="absolute -inset-y-10 -left-28 w-28 rotate-12 bg-white/25 blur-md group-hover:animate-[sheen_1.1s_ease-in-out] motion-reduce:animate-none" />
                    </span>
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
