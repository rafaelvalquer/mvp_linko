import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Check,
  ChevronDown,
  CreditCard,
  Link2,
  Lock,
  Menu,
  Moon,
  MousePointer2,
  QrCode,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  Wallet,
  X,
  Zap,
} from "lucide-react";

import AnimatedSection from "../components/marketing/AnimatedSection";
import HeroPreview from "../components/marketing/HeroPreview";
import brandLogo from "../assets/brand.png";
import useThemeToggle from "../app/useThemeToggle.js";

const EASE_OUT = [0.16, 1, 0.3, 1];

const NAV_LINKS = [
  { name: "Recursos", href: "#recursos" },
  { name: "Como funciona", href: "#como-funciona" },
  { name: "Planos", href: "#planos" },
  { name: "FAQ", href: "#faq" },
];

const HERO_METRICS = [
  { value: "+32%", label: "mais chances de fechar com proposta e Pix no mesmo fluxo" },
  { value: "24h", label: "para organizar cobranca, agenda e acompanhamento" },
  { value: "1 lugar", label: "para vender, receber e acompanhar cada cliente" },
];

const TRUST_POINTS = [
  "Envie proposta e receba no mesmo link",
  "Pix com confirmacao em tempo real",
  "Agenda integrada para servicos e atendimentos",
];

const FEATURES = [
  {
    icon: Link2,
    title: "Orcamentos que ajudam a vender",
    description:
      "Monte propostas claras, com boa apresentacao e prontas para enviar em segundos pelo WhatsApp.",
    highlight: "Mais rapidez no atendimento",
  },
  {
    icon: QrCode,
    title: "Pix sem complicacao",
    description:
      "O cliente aprova e paga no mesmo fluxo, sem perder tempo com comprovante, copia e cola ou mensagem solta.",
    highlight: "Receba no momento da decisao",
  },
  {
    icon: CalendarClock,
    title: "Agenda junto com a proposta",
    description:
      "Para servicos, o cliente ja escolhe horario e confirma a reserva sem gerar ida e volta no atendimento.",
    highlight: "Menos retrabalho no dia a dia",
  },
  {
    icon: BarChart3,
    title: "Controle simples do que esta acontecendo",
    description:
      "Veja propostas enviadas, pagamentos recebidos e andamento do dia em um painel facil de acompanhar.",
    highlight: "Tudo visivel em poucos cliques",
  },
  {
    icon: Wallet,
    title: "Recebimentos mais organizados",
    description:
      "Saiba o que entrou, o que esta pendente e o que falta cobrar sem depender de planilha paralela.",
    highlight: "Mais previsao de caixa",
  },
  {
    icon: ShieldCheck,
    title: "Historico de ponta a ponta",
    description:
      "Cada envio, pagamento e atualizacao fica salvo para voce ter mais controle e menos desencontro com clientes.",
    highlight: "Mais organizacao e seguranca",
  },
];

const STEPS = [
  {
    icon: MousePointer2,
    title: "Monte a proposta em minutos",
    description:
      "Adicione itens, valores e condicoes de forma simples para responder mais rapido e nao perder venda.",
  },
  {
    icon: Send,
    title: "Envie um link pronto para vender",
    description:
      "O cliente abre no celular, entende a proposta e segue o atendimento sem precisar criar conta.",
  },
  {
    icon: CreditCard,
    title: "Receba via Pix e acompanhe o status",
    description:
      "Depois da aprovacao, voce acompanha pagamento e agenda no mesmo lugar, sem perder o controle.",
  },
];

const PLANS = [
  {
    name: "Start",
    subtitle: "Essencial",
    price: "R$ 35,90",
    badge: "Para estruturar a base",
    description:
      "Ideal para quem quer parar de improvisar, vender com mais organizacao e receber no Pix com facilidade.",
    audience: "MEI, autonomos e quem esta comecando",
    ctaLabel: "Comecar agora",
    ctaTo: "/register",
    benefits: [
      "Propostas e orcamentos",
      "Link publico sem login",
      "Pix com QR Code",
      "Status de pagamento",
      "Agenda basica",
      "Dashboard essencial",
    ],
  },
  {
    name: "Pro",
    subtitle: "Profissional",
    price: "R$ 99,90",
    badge: "Mais escolhido",
    popular: true,
    description:
      "Mais recursos para quem vende toda semana e quer ganhar velocidade sem perder o controle do atendimento.",
    audience: "MEI e pequenos negocios em crescimento",
    ctaLabel: "Escalar operacao",
    ctaTo: "/register",
    benefits: [
      "Tudo do Start",
      "Cadastro de clientes",
      "Cadastro de produtos e servicos",
      "Dashboard avancado",
      "Cobrancas recorrentes",
      "Notificacoes por WhatsApp",
      "Confirmacao automatica de pagamento",
    ],
  },
  {
    name: "Business",
    subtitle: "Equipe",
    price: "R$ 279,90",
    badge: "Mais governanca",
    description:
      "Pensado para pequenas empresas com equipe, mais volume de vendas e necessidade de padronizar a operacao.",
    audience: "Pequenas empresas e times comerciais",
    ctaLabel: "Ativar time",
    ctaTo: "/register",
    benefits: [
      "Tudo do Pro",
      "Multiusuario com permissoes",
      "Relatorios mais completos",
      "Visao consolidada da operacao",
      "Lembretes de pagamento por WhatsApp",
      "Historico de interacoes",
      "Suporte prioritario",
    ],
  },
  {
    name: "Enterprise",
    subtitle: "Sob medida",
    price: "Sob consulta",
    badge: "Projeto customizado",
    description:
      "Para operacoes com regras proprias, maior volume e necessidade de integracoes e processos personalizados.",
    audience: "Empresas com alta complexidade",
    ctaLabel: "Solicitar demonstracao",
    ctaTo: "/register",
    benefits: [
      "Implantacao personalizada",
      "Integracoes e automacoes",
      "Regras avancadas de operacao",
      "SLA dedicado",
      "Arquitetura para maior volume",
      "Fluxos avancados de cobranca e WhatsApp",
      "Condicoes comerciais sob consulta",
    ],
  },
];

const FAQS = [
  {
    question: "O cliente precisa criar conta para pagar?",
    answer:
      "Nao. Ele acessa o link publico, revisa a proposta e conclui o Pix sem precisar criar login.",
  },
  {
    question: "Funciona para produtos e tambem para servicos?",
    answer:
      "Sim. Voce pode vender itens com quantidade ou usar agenda integrada para servicos, reservas e horarios.",
  },
  {
    question: "Como acompanho o pagamento e o andamento?",
    answer:
      "A plataforma atualiza os status da proposta, do Pix e da agenda para voce enxergar rapidamente o que avancou.",
  },
  {
    question: "Posso evoluir de plano quando a operacao crescer?",
    answer:
      "Sim. A estrutura da plataforma foi pensada para acompanhar a maturidade da operacao sem trocar de ferramenta.",
  },
];

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function PremiumBackdrop() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 16% 18%, rgb(var(--accent-2) / 0.20), transparent 0 32%), radial-gradient(circle at 84% 14%, rgb(var(--glow) / 0.16), transparent 0 28%), radial-gradient(circle at 50% 62%, rgb(var(--accent) / 0.18), transparent 0 35%), linear-gradient(180deg, rgb(var(--bg)) 0%, rgb(var(--surface-2)) 58%, rgb(var(--bg)) 100%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(var(--grid) / 0.48) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--grid) / 0.48) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(72% 58% at 50% 28%, black 0%, transparent 72%)",
          WebkitMaskImage:
            "radial-gradient(72% 58% at 50% 28%, black 0%, transparent 72%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.08] mix-blend-soft-light"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />
    </div>
  );
}

function NavBrand({ onClick, focusRing }) {
  return (
    <Link
      to="/"
      onClick={onClick}
      className={cx("flex items-center gap-3 rounded-2xl", focusRing)}
      aria-label="LuminorPay"
    >
      <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgb(var(--accent-2)),rgb(var(--accent)))] shadow-[0_20px_40px_-22px_rgb(var(--accent-2)/0.8)]">
        <img
          src={brandLogo}
          alt="LuminorPay"
          className="h-8 w-8 rounded-xl object-contain"
          loading="eager"
          draggable="false"
        />
      </div>
      <div>
        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[rgb(var(--muted-2))]">
          Vendas e Pix
        </div>
        <div className="text-lg font-black tracking-tight text-[rgb(var(--text))]">
          LuminorPay
        </div>
      </div>
    </Link>
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
    [0, reduceMotion ? 0 : -90],
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMenuOpen]);

  const palette = isDark
    ? {
        "--bg": "5 10 24",
        "--surface": "10 18 36",
        "--surface-2": "14 25 48",
        "--border": "33 46 76",
        "--text": "235 241 255",
        "--muted": "156 170 196",
        "--muted-2": "104 122 152",
        "--accent": "45 212 191",
        "--accent-2": "96 165 250",
        "--glow": "251 191 36",
        "--grid": "27 38 64",
      }
    : {
        "--bg": "244 247 252",
        "--surface": "255 255 255",
        "--surface-2": "233 239 247",
        "--border": "211 220 233",
        "--text": "11 18 36",
        "--muted": "83 97 122",
        "--muted-2": "118 132 154",
        "--accent": "13 148 136",
        "--accent-2": "37 99 235",
        "--glow": "245 158 11",
        "--grid": "215 223 236",
      };

  const transitionDuration = reduceMotion ? 0 : 0.6;

  const ui = {
    page: "min-h-screen overflow-x-hidden bg-[rgb(var(--bg))] text-[rgb(var(--text))] selection:bg-[rgb(var(--accent)/0.22)] selection:text-[rgb(var(--text))]",
    container: "mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8",
    sectionSpace: "py-20 sm:py-24 lg:py-28",
    glass:
      "border border-[rgb(var(--border)/0.78)] bg-[linear-gradient(180deg,rgb(var(--surface)/0.92),rgb(var(--surface)/0.72))] backdrop-blur-xl shadow-[0_24px_80px_-56px_rgba(15,23,42,0.8)]",
    softPanel:
      "border border-[rgb(var(--border)/0.75)] bg-[rgb(var(--surface)/0.72)] backdrop-blur-xl",
    focusRing:
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-2)/0.42)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--bg))]",
    mutedText: "text-[rgb(var(--muted))]",
    subtleText: "text-[rgb(var(--muted-2))]",
  };

  return (
    <div className={ui.page} style={palette}>
      <a
        href="#conteudo"
        className={cx(
          "sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[999] rounded-full px-4 py-2 text-sm font-semibold",
          "bg-[rgb(var(--text))] text-[rgb(var(--bg))]",
          ui.focusRing,
        )}
      >
        Pular para o conteudo
      </a>

      <header
        className={cx(
          "fixed inset-x-0 top-0 z-[100] transition-all duration-300",
          scrolled
            ? "border-b border-[rgb(var(--border)/0.72)] bg-[rgb(var(--bg)/0.82)] py-3 backdrop-blur-2xl"
            : "bg-transparent py-5",
        )}
      >
        <nav className={cx(ui.container, "flex items-center gap-6")}>
          <NavBrand focusRing={ui.focusRing} />

          <div className="hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className={cx(
                  "group relative py-2 text-sm font-semibold tracking-[0.02em] text-[rgb(var(--muted))] transition-colors hover:text-[rgb(var(--text))]",
                  ui.focusRing,
                )}
              >
                {item.name}
                <span className="absolute inset-x-0 -bottom-1 h-px origin-left scale-x-0 bg-[rgb(var(--accent))] transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsDark((value) => !value)}
              className={cx(
                "hidden h-11 w-11 items-center justify-center rounded-full sm:inline-flex",
                ui.softPanel,
                ui.focusRing,
              )}
              aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
            >
              {isDark ? (
                <Sun className="h-5 w-5 text-[rgb(var(--glow))]" />
              ) : (
                <Moon className="h-5 w-5 text-[rgb(var(--accent-2))]" />
              )}
            </button>

            <Link
              to="/login"
              className={cx(
                "hidden rounded-full px-5 py-3 text-sm font-semibold text-[rgb(var(--text))] transition-colors hover:bg-[rgb(var(--surface)/0.82)] sm:inline-flex",
                ui.softPanel,
                ui.focusRing,
              )}
            >
              Entrar
            </Link>

            <Link
              to="/register"
              className={cx(
                "inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 sm:px-6",
                "bg-[linear-gradient(135deg,rgb(var(--accent-2)),rgb(var(--accent)))] shadow-[0_24px_50px_-24px_rgb(var(--accent-2)/0.75)]",
                ui.focusRing,
              )}
            >
              Criar conta
              <ArrowRight className="h-4 w-4" />
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className={cx(
                "inline-flex h-11 w-11 items-center justify-center rounded-full lg:hidden",
                ui.softPanel,
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

      <main id="conteudo" className="relative pt-28 sm:pt-32 lg:pt-36">
        <PremiumBackdrop />

        <section className="relative pb-20 sm:pb-24 lg:pb-28">
          <div className={ui.container}>
            <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
              <motion.div
                initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: transitionDuration, ease: EASE_OUT }}
                className="relative"
              >
                <div
                  className={cx(
                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold",
                    ui.glass,
                    "text-[rgb(var(--accent))]",
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  Proposta, cobranca e agenda no mesmo lugar
                </div>

                <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[0.96] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
                  Envie orcamentos, feche mais vendas e receba no Pix sem
                  complicacao.
                </h1>

                <p
                  className={cx(
                    "mt-7 max-w-2xl text-lg leading-relaxed sm:text-xl",
                    ui.mutedText,
                  )}
                >
                  O LuminorPay foi feito para MEI e pequenas empresas que
                  precisam vender com mais organizacao, passar confianca e
                  acompanhar cada proposta ate o pagamento.
                </p>

                <div className="mt-10 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
                  <Link
                    to="/register"
                    className={cx(
                      "inline-flex items-center justify-center gap-2 rounded-full px-7 py-4 text-base font-bold text-white transition-transform hover:-translate-y-0.5",
                      "bg-[linear-gradient(135deg,rgb(var(--accent-2)),rgb(var(--accent)))] shadow-[0_28px_60px_-26px_rgb(var(--accent-2)/0.85)]",
                      ui.focusRing,
                    )}
                  >
                    Comecar a vender
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <a
                    href="#planos"
                    className={cx(
                      "inline-flex items-center justify-center rounded-full px-7 py-4 text-base font-semibold text-[rgb(var(--text))] transition-colors hover:bg-[rgb(var(--surface)/0.82)]",
                      ui.glass,
                      ui.focusRing,
                    )}
                  >
                    Ver planos
                  </a>
                </div>

                <div className="mt-10 flex flex-wrap items-center gap-3 text-sm">
                  {TRUST_POINTS.map((item) => (
                    <div
                      key={item}
                      className={cx(
                        "inline-flex items-center gap-2 rounded-full px-3.5 py-2",
                        ui.softPanel,
                        ui.mutedText,
                      )}
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(var(--accent)/0.14)] text-[rgb(var(--accent))]">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-12 grid gap-4 sm:grid-cols-3">
                  {HERO_METRICS.map((item, index) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: transitionDuration,
                        ease: EASE_OUT,
                        delay: reduceMotion ? 0 : 0.08 * index,
                      }}
                      className={cx("rounded-[28px] p-5", ui.glass)}
                    >
                      <div className="text-3xl font-black tracking-[-0.04em] text-[rgb(var(--text))]">
                        {item.value}
                      </div>
                      <p
                        className={cx(
                          "mt-2 text-sm leading-relaxed",
                          ui.mutedText,
                        )}
                      >
                        {item.label}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                style={{ y: yParallax }}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: transitionDuration + 0.1,
                  ease: EASE_OUT,
                  delay: reduceMotion ? 0 : 0.12,
                }}
                className="relative"
              >
                <div className="absolute -left-10 top-8 h-36 w-36 rounded-full bg-[rgb(var(--accent-2)/0.18)] blur-3xl" />
                <div className="absolute -right-8 bottom-4 h-40 w-40 rounded-full bg-[rgb(var(--glow)/0.18)] blur-3xl" />

                <div
                  className={cx(
                    "relative overflow-hidden rounded-[36px] p-4 sm:p-5",
                    ui.glass,
                  )}
                >
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,240px)]">
                    <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgb(var(--surface-2)/0.95),rgb(var(--surface)/0.75))] p-4">
                      <HeroPreview />
                    </div>

                    <div className="grid gap-4">
                      <div
                        className={cx(
                          "rounded-[28px] p-5",
                          "bg-[linear-gradient(180deg,rgb(var(--accent-2)/0.18),rgb(var(--surface)/0.72))] border border-[rgb(var(--accent-2)/0.18)]",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-[0.24em] text-[rgb(var(--muted-2))]">
                            Confirmacao automatica
                          </span>
                          <Zap className="h-4 w-4 text-[rgb(var(--glow))]" />
                        </div>
                        <div className="mt-4 max-w-[8ch] text-3xl font-black leading-[0.92] tracking-[-0.04em] sm:text-4xl">
                          Pix em tempo real
                        </div>
                        <p
                          className={cx(
                            "mt-2 text-sm leading-relaxed",
                            ui.mutedText,
                          )}
                        >
                          O cliente paga e o status atualiza na hora, sem
                          comprovante solto ou checagem manual.
                        </p>
                      </div>

                      <div className={cx("rounded-[28px] p-5", ui.softPanel)}>
                        <div className="flex items-center gap-3">
                          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgb(var(--accent)/0.14)] text-[rgb(var(--accent))]">
                            <Lock className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-sm font-bold">
                              Confianca operacional
                            </div>
                            <div className={cx("text-sm", ui.subtleText)}>
                              Historico completo e status claros
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 space-y-3">
                          {[
                            "Link enviado",
                            "Pix confirmado",
                            "Agenda reservada",
                          ].map((step) => (
                            <div
                              key={step}
                              className="flex items-center justify-between rounded-2xl border border-[rgb(var(--border)/0.65)] bg-[rgb(var(--surface)/0.7)] px-4 py-3"
                            >
                              <span className="text-sm font-medium">
                                {step}
                              </span>
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[rgb(var(--accent)/0.14)] text-[rgb(var(--accent))]">
                                <Check className="h-4 w-4" />
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            <AnimatedSection
              delay={0.1}
              className={cx(
                "mt-14 grid gap-4 rounded-[34px] p-4 sm:p-6 lg:grid-cols-3",
                ui.glass,
              )}
            >
              {[
                {
                  title: "Mais organizacao na venda",
                  text: "Centralize proposta, cobranca e proximos passos para nao depender de conversa espalhada no WhatsApp.",
                },
                {
                  title: "Menos enrolacao para receber",
                  text: "O cliente entende a proposta e paga no mesmo fluxo, sem voce precisar cobrar varias vezes por mensagem.",
                },
                {
                  title: "Mais controle no dia a dia",
                  text: "Tudo fica em um so lugar para voce acompanhar o que foi enviado, pago, agendado e o que ainda falta fechar.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[28px] border border-[rgb(var(--border)/0.75)] bg-[rgb(var(--surface)/0.7)] p-6"
                >
                  <div className="text-sm font-bold uppercase tracking-[0.18em] text-[rgb(var(--accent))]">
                    {item.title}
                  </div>
                  <p
                    className={cx(
                      "mt-3 text-sm leading-relaxed sm:text-base",
                      ui.mutedText,
                    )}
                  >
                    {item.text}
                  </p>
                </div>
              ))}
            </AnimatedSection>
          </div>
        </section>

        <section id="recursos" className={cx(ui.sectionSpace, "scroll-mt-28")}>
          <div className={ui.container}>
            <div className="mx-auto max-w-3xl text-center">
              <div className="text-sm font-bold uppercase tracking-[0.28em] text-[rgb(var(--accent))]">
                Recursos
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-4xl lg:text-5xl">
                Menos improviso nas vendas. Mais clareza para cobrar, receber e
                acompanhar.
              </h2>
              <p
                className={cx(
                  "mt-5 text-base leading-relaxed sm:text-lg",
                  ui.mutedText,
                )}
              >
                O LuminorPay ajuda MEI e pequenos negocios a transformar
                conversas em vendas fechadas, com proposta online, Pix e status
                claros em cada etapa.
              </p>
            </div>

            <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {FEATURES.map((feature, index) => {
                const Icon = feature.icon;

                return (
                  <AnimatedSection
                    key={feature.title}
                    delay={index * 0.04}
                    className={cx(
                      "group rounded-[30px] p-7 transition-transform duration-300 hover:-translate-y-1",
                      ui.glass,
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="inline-flex h-14 w-14 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,rgb(var(--accent-2)/0.18),rgb(var(--accent)/0.18))] text-[rgb(var(--accent))]">
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className="rounded-full border border-[rgb(var(--border)/0.75)] bg-[rgb(var(--surface)/0.72)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[rgb(var(--muted-2))]">
                        {feature.highlight}
                      </span>
                    </div>

                    <h3 className="mt-8 text-2xl font-black tracking-[-0.03em]">
                      {feature.title}
                    </h3>
                    <p
                      className={cx(
                        "mt-4 text-sm leading-relaxed sm:text-base",
                        ui.mutedText,
                      )}
                    >
                      {feature.description}
                    </p>
                  </AnimatedSection>
                );
              })}
            </div>
          </div>
        </section>
        <section
          id="como-funciona"
          className={cx(ui.sectionSpace, "scroll-mt-28 pt-6 sm:pt-10")}
        >
          <div className={ui.container}>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <AnimatedSection
                className={cx("rounded-[34px] p-8 sm:p-10", ui.glass)}
              >
                <div className="text-sm font-bold uppercase tracking-[0.28em] text-[rgb(var(--accent))]">
                  Como funciona
                </div>
                <h2 className="mt-5 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                  Simples para voce vender. Simples para o cliente pagar.
                </h2>
                <p
                  className={cx(
                    "mt-5 max-w-xl text-base leading-relaxed sm:text-lg",
                    ui.mutedText,
                  )}
                >
                  Tudo foi pensado para facilitar a rotina de quem vende todos
                  os dias e precisa responder rapido, cobrar certo e manter a
                  operacao organizada.
                </p>

                <div className="mt-8 space-y-4">
                  {[
                    {
                      title: "Passe mais confianca",
                      text: "Uma proposta clara e bem apresentada ajuda o cliente a entender melhor e decidir mais rapido.",
                    },
                    {
                      title: "Economize tempo no atendimento",
                      text: "Cobranca, confirmacao de pagamento e proximos passos ficam no mesmo fluxo, com menos trabalho manual.",
                    },
                    {
                      title: "Cresca com organizacao",
                      text: "Com historico, painel e status claros, fica mais facil vender mais sem perder o controle.",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-[26px] border border-[rgb(var(--border)/0.75)] bg-[rgb(var(--surface)/0.68)] p-5"
                    >
                      <div className="text-lg font-bold">{item.title}</div>
                      <p
                        className={cx(
                          "mt-2 text-sm leading-relaxed",
                          ui.mutedText,
                        )}
                      >
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </AnimatedSection>

              <div className="grid gap-5">
                {STEPS.map((step, index) => {
                  const Icon = step.icon;

                  return (
                    <AnimatedSection
                      key={step.title}
                      delay={index * 0.06}
                      className={cx("rounded-[30px] p-7 sm:p-8", ui.glass)}
                    >
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                        <div className="inline-flex h-16 w-16 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,rgb(var(--accent-2)/0.16),rgb(var(--accent)/0.16))] text-[rgb(var(--accent))]">
                          <Icon className="h-7 w-7" />
                        </div>

                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-2xl font-black tracking-[-0.03em]">
                              {step.title}
                            </h3>
                            <span className="rounded-full bg-[rgb(var(--glow)/0.12)] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[rgb(var(--glow))]">
                              Etapa {index + 1}
                            </span>
                          </div>
                          <p
                            className={cx(
                              "mt-3 text-sm leading-relaxed sm:text-base",
                              ui.mutedText,
                            )}
                          >
                            {step.description}
                          </p>
                        </div>
                      </div>
                    </AnimatedSection>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="planos" className={cx(ui.sectionSpace, "scroll-mt-28")}>
          <div className={ui.container}>
            <div className="mx-auto max-w-3xl text-center">
              <div className="text-sm font-bold uppercase tracking-[0.28em] text-[rgb(var(--accent))]">
                Planos
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-4xl lg:text-5xl">
                Estrutura para cada estagio de maturidade da operacao
              </h2>
              <p
                className={cx(
                  "mt-5 text-base leading-relaxed sm:text-lg",
                  ui.mutedText,
                )}
              >
                Escolha o plano que faz sentido para o momento da sua operacao.
                Todos ajudam voce a vender com mais organizacao, cobrar no Pix
                e acompanhar o que foi fechado.
              </p>
            </div>

            <div className="mt-14 grid gap-5 xl:grid-cols-4">
              {PLANS.map((plan, index) => (
                <AnimatedSection
                  key={plan.name}
                  delay={index * 0.04}
                  className={cx(
                    "relative flex h-full flex-col overflow-hidden rounded-[32px] p-7 sm:p-8",
                    ui.glass,
                    plan.popular &&
                      "border-[rgb(var(--accent-2)/0.45)] shadow-[0_28px_80px_-52px_rgb(var(--accent-2)/0.82)]",
                  )}
                >
                  <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgb(var(--accent-2)/0.12),transparent)]" />

                  {plan.popular && (
                    <div className="absolute right-5 top-5 rounded-full bg-[linear-gradient(135deg,rgb(var(--accent-2)),rgb(var(--accent)))] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white">
                      Mais escolhido
                    </div>
                  )}

                  <div className="relative">
                    <div className="inline-flex rounded-full bg-[rgb(var(--surface)/0.84)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[rgb(var(--muted-2))]">
                      {plan.subtitle}
                    </div>

                    <h3 className="mt-5 text-2xl font-black tracking-[-0.03em]">
                      {plan.name}
                    </h3>
                    <p
                      className={cx(
                        "mt-3 text-sm leading-relaxed",
                        ui.mutedText,
                      )}
                    >
                      {plan.description}
                    </p>

                    <div className="mt-7">
                      <div className="text-4xl font-black tracking-[-0.04em]">
                        {plan.price}
                      </div>
                      {plan.price !== "Sob consulta" && (
                        <div className={cx("mt-1 text-sm", ui.subtleText)}>
                          por mes
                        </div>
                      )}
                    </div>

                    <div className="mt-5 inline-flex rounded-full border border-[rgb(var(--border)/0.75)] bg-[rgb(var(--surface)/0.7)] px-3 py-1.5 text-xs font-bold text-[rgb(var(--accent))]">
                      {plan.badge}
                    </div>

                    <div className="mt-6 rounded-[24px] border border-[rgb(var(--border)/0.75)] bg-[rgb(var(--surface)/0.7)] p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[rgb(var(--muted-2))]">
                        Ideal para
                      </div>
                      <div className="mt-2 text-sm font-semibold text-[rgb(var(--text))]">
                        {plan.audience}
                      </div>
                    </div>
                  </div>

                  <div className="relative mt-7 flex-1">
                    <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[rgb(var(--muted-2))]">
                      O que esta incluso
                    </div>
                    <ul className="space-y-3">
                      {plan.benefits.map((benefit) => (
                        <li
                          key={benefit}
                          className="flex items-start gap-3 text-sm text-[rgb(var(--muted))]"
                        >
                          <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(var(--accent)/0.14)] text-[rgb(var(--accent))]">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Link
                    to={plan.ctaTo}
                    className={cx(
                      "relative mt-8 inline-flex items-center justify-center rounded-2xl px-5 py-4 text-center text-sm font-bold transition-transform hover:-translate-y-0.5",
                      plan.popular
                        ? "bg-[linear-gradient(135deg,rgb(var(--accent-2)),rgb(var(--accent)))] text-white shadow-[0_24px_50px_-26px_rgb(var(--accent-2)/0.78)]"
                        : "border border-[rgb(var(--border)/0.78)] bg-[rgb(var(--surface)/0.78)] text-[rgb(var(--text))]",
                      ui.focusRing,
                    )}
                  >
                    {plan.ctaLabel}
                  </Link>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-20 sm:pb-24">
          <div className={ui.container}>
            <AnimatedSection
              className={cx(
                "overflow-hidden rounded-[36px] p-8 sm:p-10 lg:p-12",
                "border border-[rgb(var(--accent-2)/0.24)] bg-[linear-gradient(135deg,rgb(var(--accent-2)/0.18),rgb(var(--surface)/0.86),rgb(var(--accent)/0.18))] shadow-[0_30px_90px_-58px_rgba(15,23,42,0.9)]",
              )}
            >
              <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <div className="text-sm font-bold uppercase tracking-[0.28em] text-[rgb(var(--accent))]">
                    Pronto para vender com mais organizacao?
                  </div>
                  <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-[-0.04em] sm:text-4xl lg:text-5xl">
                    Troque planilha, mensagem solta e cobranca manual por um
                    fluxo simples de venda.
                  </h2>
                  <p
                    className={cx(
                      "mt-5 max-w-2xl text-base leading-relaxed sm:text-lg",
                      ui.mutedText,
                    )}
                  >
                    Centralize proposta, Pix e agenda em um lugar so e ganhe
                    tempo para atender melhor e faturar mais.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/register"
                    className={cx(
                      "inline-flex items-center justify-center gap-2 rounded-full px-7 py-4 text-base font-bold text-white transition-transform hover:-translate-y-0.5",
                      "bg-[linear-gradient(135deg,rgb(var(--accent-2)),rgb(var(--accent)))] shadow-[0_24px_50px_-24px_rgb(var(--accent-2)/0.82)]",
                      ui.focusRing,
                    )}
                  >
                    Criar conta
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <a
                    href="#faq"
                    className={cx(
                      "inline-flex items-center justify-center rounded-full px-7 py-4 text-base font-semibold text-[rgb(var(--text))]",
                      ui.softPanel,
                      ui.focusRing,
                    )}
                  >
                    Tirar duvidas
                  </a>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </section>

        <section id="faq" className="scroll-mt-28 pb-24 sm:pb-28">
          <div className="mx-auto max-w-4xl px-5 sm:px-6">
            <div className="text-center">
              <div className="text-sm font-bold uppercase tracking-[0.28em] text-[rgb(var(--accent))]">
                FAQ
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-4xl lg:text-5xl">
                Duvidas comuns antes de comecar
              </h2>
            </div>

            <div className="mt-12 space-y-4">
              {FAQS.map((item, index) => {
                const isOpen = faqOpen === index;

                return (
                  <div
                    key={item.question}
                    className={cx("overflow-hidden rounded-[30px]", ui.glass)}
                  >
                    <button
                      type="button"
                      onClick={() => setFaqOpen(isOpen ? -1 : index)}
                      className={cx(
                        "flex w-full items-center justify-between gap-4 px-6 py-6 text-left sm:px-7 sm:py-7",
                        "transition-colors hover:bg-[rgb(var(--surface)/0.84)]",
                        ui.focusRing,
                      )}
                      aria-expanded={isOpen}
                    >
                      <span className="text-lg font-black sm:text-xl">
                        {item.question}
                      </span>
                      <ChevronDown
                        className={cx(
                          "h-5 w-5 shrink-0 transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{
                            duration: reduceMotion ? 0 : 0.26,
                            ease: EASE_OUT,
                          }}
                        >
                          <div
                            className={cx(
                              "px-6 pb-6 leading-relaxed sm:px-7 sm:pb-7",
                              ui.mutedText,
                            )}
                          >
                            {item.answer}
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
      </main>

      <footer className="border-t border-[rgb(var(--border)/0.7)] py-12">
        <div
          className={cx(
            ui.container,
            "flex flex-col gap-6 text-sm text-[rgb(var(--muted-2))] sm:flex-row sm:items-center sm:justify-between",
          )}
        >
          <div className="flex items-center gap-3">
            <img
              src={brandLogo}
              alt="LuminorPay"
              className="h-11 w-11 rounded-2xl object-contain"
              loading="eager"
              draggable="false"
            />
            <div>
              <div className="font-black text-[rgb(var(--text))]">
                LuminorPay
              </div>
              <div>Propostas, Pix e agenda para MEI e pequenas empresas.</div>
            </div>
          </div>

          <div>
            (c) {new Date().getFullYear()} LuminorPay. Todos os direitos
            reservados.
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Fechar menu"
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-[109] bg-black/45 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: EASE_OUT }}
            />

            <motion.aside
              role="dialog"
              aria-modal="true"
              className={cx(
                "fixed inset-y-0 right-0 z-[110] flex w-[92%] max-w-sm flex-col p-6",
                ui.glass,
              )}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: reduceMotion ? 0 : 0.28, ease: EASE_OUT }}
            >
              <div className="flex items-center justify-between">
                <NavBrand
                  focusRing={ui.focusRing}
                  onClick={() => setMobileMenuOpen(false)}
                />

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cx(
                    "inline-flex h-11 w-11 items-center justify-center rounded-full",
                    ui.softPanel,
                    ui.focusRing,
                  )}
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => setIsDark((value) => !value)}
                  className={cx(
                    "flex w-full items-center justify-between rounded-[24px] px-5 py-4",
                    ui.softPanel,
                    ui.focusRing,
                  )}
                  aria-label={
                    isDark ? "Ativar tema claro" : "Ativar tema escuro"
                  }
                >
                  <span className="text-sm font-bold">
                    {isDark ? "Usar tema claro" : "Usar tema escuro"}
                  </span>
                  {isDark ? (
                    <Sun className="h-5 w-5 text-[rgb(var(--glow))]" />
                  ) : (
                    <Moon className="h-5 w-5 text-[rgb(var(--accent-2))]" />
                  )}
                </button>
              </div>

              <nav className="mt-8 flex flex-col gap-3">
                {NAV_LINKS.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cx(
                      "rounded-[24px] px-5 py-4 text-base font-semibold",
                      ui.softPanel,
                      ui.focusRing,
                    )}
                  >
                    {item.name}
                  </a>
                ))}
              </nav>

              <div className="mt-auto grid gap-3 pt-8">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cx(
                    "inline-flex items-center justify-center rounded-[24px] px-5 py-4 text-sm font-semibold text-[rgb(var(--text))]",
                    ui.softPanel,
                    ui.focusRing,
                  )}
                >
                  Entrar
                </Link>

                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cx(
                    "inline-flex items-center justify-center gap-2 rounded-[24px] px-5 py-4 text-sm font-bold text-white",
                    "bg-[linear-gradient(135deg,rgb(var(--accent-2)),rgb(var(--accent)))] shadow-[0_24px_50px_-24px_rgb(var(--accent-2)/0.82)]",
                    ui.focusRing,
                  )}
                >
                  Criar conta
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

