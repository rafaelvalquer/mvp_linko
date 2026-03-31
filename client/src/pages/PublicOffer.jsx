import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Check,
  FileText,
  Package2,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { api } from "../app/api.js";
import useThemeToggle from "../app/useThemeToggle.js";
import Button from "../components/appui/Button.jsx";
import brand from "../assets/brand.png";

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function fmtBRL(cents) {
  const v = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v / 100);
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function isNonEmpty(s) {
  return String(s || "").trim().length > 0;
}

function safeLines(text) {
  return String(text || "");
}

function sumItemsSubtotalCents(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  let total = 0;
  let hasAny = false;
  for (const it of items) {
    const line =
      Number.isFinite(it?.lineTotalCents) && it.lineTotalCents >= 0
        ? it.lineTotalCents
        : null;
    if (line == null) continue;
    hasAny = true;
    total += line;
  }
  return hasAny ? total : null;
}

function extractBulletsFromText(text, max = 4) {
  const t = String(text || "").trim();
  if (!t) return [];

  const lines = t
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  const candidates = (lines.length >= 2 ? lines : t.split("."))
    .map((x) => x.replace(/^[-•\d)\s]+/, "").trim())
    .filter((x) => x.length >= 8);

  const uniq = [];
  for (const c of candidates) {
    if (!uniq.includes(c)) uniq.push(c);
    if (uniq.length >= max) break;
  }
  return uniq;
}

function pickFirst(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (isNonEmpty(v)) return v;
  }
  return "";
}

function Badge({ tone = "zinc", className = "", children }) {
  const { isDark } = useThemeToggle();

  const map = isDark
    ? {
        emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
        amber: "border-amber-400/20 bg-amber-400/10 text-amber-100",
        red: "border-red-400/20 bg-red-400/10 text-red-100",
        blue: "border-sky-400/20 bg-sky-400/10 text-sky-100",
        violet: "border-violet-400/20 bg-violet-400/10 text-violet-100",
        zinc: "border-white/10 bg-white/5 text-slate-200",
      }
    : {
        emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
        amber: "border-amber-200 bg-amber-50 text-amber-700",
        red: "border-red-200 bg-red-50 text-red-700",
        blue: "border-sky-200 bg-sky-50 text-sky-700",
        violet: "border-violet-200 bg-violet-50 text-violet-700",
        zinc: "border-slate-200 bg-white text-slate-700",
      };

  return (
    <span
      className={cls(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]",
        map[tone] || map.zinc,
        className,
      )}
    >
      {children}
    </span>
  );
}

function SectionCard({
  eyebrow,
  title,
  subtitle,
  className = "",
  children,
}) {
  const { isDark } = useThemeToggle();

  return (
    <section
      className={cls(
        "relative overflow-hidden rounded-[30px] border p-5 sm:p-6",
        isDark
          ? "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,15,28,0.84))] shadow-[0_28px_70px_-46px_rgba(15,23,42,0.82)]"
          : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.9))] shadow-[0_28px_70px_-46px_rgba(15,23,42,0.2)]",
        className,
      )}
    >
      <div
        className={cls(
          "pointer-events-none absolute inset-x-0 top-0 h-24",
          isDark
            ? "bg-[linear-gradient(180deg,rgba(34,211,238,0.08),transparent)]"
            : "bg-[linear-gradient(180deg,rgba(37,99,235,0.08),transparent)]",
        )}
      />

      <div className="relative">
        {eyebrow ? (
          <div
            className={cls(
              "text-[11px] font-bold uppercase tracking-[0.18em]",
              isDark ? "text-sky-200/80" : "text-sky-700",
            )}
          >
            {eyebrow}
          </div>
        ) : null}

        <div className={cls(eyebrow ? "mt-2" : "", "flex flex-col gap-1")}>
          <div
            className={cls(
              "text-lg font-black tracking-[-0.03em]",
              isDark ? "text-white" : "text-slate-950",
            )}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              className={cls(
                "text-sm leading-6",
                isDark ? "text-slate-300" : "text-slate-600",
              )}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </section>
  );
}

function JourneyStat({ label, value, hint, tone = "zinc" }) {
  const { isDark } = useThemeToggle();
  const tones = isDark
    ? {
        emerald: "border-emerald-400/20 bg-emerald-400/10",
        blue: "border-sky-400/20 bg-sky-400/10",
        amber: "border-amber-400/20 bg-amber-400/10",
        zinc: "border-white/10 bg-white/[0.05]",
      }
    : {
        emerald: "border-emerald-200 bg-white/90",
        blue: "border-sky-200 bg-white/90",
        amber: "border-amber-200 bg-white/90",
        zinc: "border-white/80 bg-white/85",
      };

  return (
    <div className={cls("rounded-[24px] border p-4", tones[tone] || tones.zinc)}>
      <div
        className={cls(
          "text-[11px] font-bold uppercase tracking-[0.18em]",
          isDark ? "text-slate-400" : "text-slate-500",
        )}
      >
        {label}
      </div>
      <div className={cls("mt-2 text-base font-black tracking-[-0.03em]", isDark ? "text-white" : "text-slate-950")}>
        {value}
      </div>
      {hint ? (
        <div className={cls("mt-2 text-xs leading-5", isDark ? "text-slate-300" : "text-slate-600")}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function NextSteps({ offerType, depositEnabled }) {
  const reduce = useReducedMotion();

  const steps = useMemo(() => {
    const step3 =
      offerType === "service"
        ? {
            tone: "blue",
            icon: "3",
            title: "Escolha um horario",
            desc: "Selecione um horario disponivel para agendar.",
          }
        : {
            tone: "violet",
            icon: "3",
            title: "Receba instrucoes",
            desc: "Voce recebe as instrucoes de producao ou entrega, quando aplicavel.",
          };

    return [
      {
        tone: "emerald",
        icon: "1",
        title: "Revise a proposta",
        desc: "Confira detalhes e valores acima.",
      },
      {
        tone: "amber",
        icon: "2",
        title: "Confirme o aceite",
        desc: "Aprove e siga para a proxima etapa.",
      },
      step3,
      {
        tone: "rose",
        icon: "4",
        title: "Pague via Pix",
        desc: depositEnabled
          ? "Pague o sinal (ou conforme combinado) e finalize."
          : "Pague o total via Pix e finalize.",
        attention: true,
      },
    ];
  }, [offerType, depositEnabled]);

  const tones = {
    emerald: {
      ring: "ring-emerald-200/70",
      bg: "from-emerald-50 via-white to-emerald-50",
      pill: "bg-emerald-600 text-white",
      bar: "bg-emerald-500",
      text: "text-emerald-700",
    },
    amber: {
      ring: "ring-amber-200/70",
      bg: "from-amber-50 via-white to-amber-50",
      pill: "bg-amber-600 text-white",
      bar: "bg-amber-500",
      text: "text-amber-700",
    },
    blue: {
      ring: "ring-blue-200/70",
      bg: "from-blue-50 via-white to-blue-50",
      pill: "bg-blue-600 text-white",
      bar: "bg-blue-500",
      text: "text-blue-700",
    },
    violet: {
      ring: "ring-violet-200/70",
      bg: "from-violet-50 via-white to-violet-50",
      pill: "bg-violet-600 text-white",
      bar: "bg-violet-500",
      text: "text-violet-700",
    },
    rose: {
      ring: "ring-rose-200/70",
      bg: "from-rose-50 via-white to-rose-50",
      pill: "bg-rose-600 text-white",
      bar: "bg-rose-500",
      text: "text-rose-700",
    },
  };

  const container = {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: reduce
        ? { duration: 0 }
        : { duration: 0.35, staggerChildren: 0.08 },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 10, scale: 0.98 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: reduce ? { duration: 0 } : { duration: 0.28 },
    },
  };

  return (
    <motion.ol
      variants={container}
      initial="hidden"
      animate="show"
      className="grid gap-3 sm:grid-cols-2"
    >
      {steps.map((s, i) => {
        const t = tones[s.tone] || tones.emerald;

        // “tremidinha” só no hover/focus (sem ficar tremendo o tempo todo)
        const hoverAnim = reduce
          ? undefined
          : {
              y: -2,
              rotate: [0, -0.7, 0.7, -0.4, 0],
              x: [0, -1, 1, -1, 0],
              transition: { duration: 0.35 },
            };

        // destaque sutil contínuo só no último passo (Pix)
        const attentionAnim =
          !reduce && s.attention
            ? {
                boxShadow: [
                  "0 0 0 0 rgba(244,63,94,0.0)",
                  "0 0 0 6px rgba(244,63,94,0.10)",
                  "0 0 0 0 rgba(244,63,94,0.0)",
                ],
              }
            : undefined;

        const attentionTransition =
          !reduce && s.attention
            ? { duration: 1.6, repeat: Infinity, repeatDelay: 2.2 }
            : undefined;

        return (
          <motion.li
            key={i}
            variants={item}
            whileHover={hoverAnim}
            whileFocus={hoverAnim}
            animate={attentionAnim}
            transition={attentionTransition}
            className={[
              "relative overflow-hidden rounded-2xl border bg-white p-4",
              "ring-1",
              t.ring,
              "shadow-sm",
            ].join(" ")}
          >
            {/* fundo com gradiente leve */}
            <div
              className={[
                "pointer-events-none absolute inset-0 opacity-70",
                "bg-gradient-to-br",
                t.bg,
              ].join(" ")}
            />
            {/* barra lateral */}
            <div
              className={["absolute left-0 top-0 h-full w-1.5", t.bar].join(
                " ",
              )}
            />

            <div className="relative flex items-start gap-3">
              <div
                className={[
                  "flex h-10 w-10 items-center justify-center rounded-2xl",
                  t.pill,
                  "shadow-sm",
                ].join(" ")}
                aria-hidden="true"
              >
                <span className="text-base">{s.icon}</span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={["text-xs font-bold", t.text].join(" ")}>
                    PASSO {i + 1}
                  </span>
                  <span className="text-xs text-zinc-400">•</span>
                  <span className="text-xs text-zinc-500">Próxima ação</span>
                </div>

                <div className="mt-1 text-sm font-semibold text-zinc-900">
                  {s.title}
                </div>
                <div className="mt-1 text-sm text-zinc-700">{s.desc}</div>
              </div>
            </div>
          </motion.li>
        );
      })}
    </motion.ol>
  );
}

export default function PublicOffer() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isDark } = useThemeToggle();

  const [offer, setOffer] = useState(null);
  const [error, setError] = useState("");

  // acceptance (CTA)
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [ackDeposit, setAckDeposit] = useState(false);
  const [ctaError, setCtaError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAgreeTerms(false);
    setAckDeposit(false);
    setCtaError("");
    setBusy(false);

    api(`/p/${token}`)
      .then((d) => {
        setError("");
        setOffer(d.offer);
      })
      .catch((e) => {
        setError(e?.message || "Falha ao carregar proposta.");
        setOffer(null);
      });
  }, [token]);

  const view = useMemo(() => {
    const o = offer || {};

    const items = Array.isArray(o.items) ? o.items : [];
    const hasItems = items.length > 0;

    // Compat: infer product if items exist (even if offerType is missing)
    const rawType = isNonEmpty(o.offerType)
      ? String(o.offerType).trim().toLowerCase()
      : "";
    const offerType = rawType === "product" || hasItems ? "product" : "service";

    // subtotal: prefer explicit, else items sum (if available), else null
    const itemsSubtotal = sumItemsSubtotalCents(items);
    const subtotalCents =
      Number.isFinite(Number(o.subtotalCents)) && Number(o.subtotalCents) >= 0
        ? Number(o.subtotalCents)
        : itemsSubtotal != null
          ? itemsSubtotal
          : null;

    // discount/freight: show only if exists and >0
    const discountCents =
      Number.isFinite(Number(o.discountCents)) && Number(o.discountCents) > 0
        ? Number(o.discountCents)
        : null;

    const freightCents =
      Number.isFinite(Number(o.freightCents)) && Number(o.freightCents) > 0
        ? Number(o.freightCents)
        : null;

    // total: prefer explicit totalCents, else amountCents; if missing, compute from subtotal/discount/freight
    const explicitTotalCents =
      Number.isFinite(Number(o.totalCents)) && Number(o.totalCents) >= 0
        ? Number(o.totalCents)
        : Number.isFinite(Number(o.amountCents)) && Number(o.amountCents) >= 0
          ? Number(o.amountCents)
          : null;

    const computedTotalCents =
      subtotalCents != null
        ? Math.max(
            0,
            subtotalCents - (discountCents ?? 0) + (freightCents ?? 0),
          )
        : null;

    const totalCents =
      explicitTotalCents != null
        ? explicitTotalCents
        : computedTotalCents != null
          ? computedTotalCents
          : 0;

    const depositPctRaw = Number(o.depositPct);
    const depositPct =
      Number.isFinite(depositPctRaw) && depositPctRaw > 0 ? depositPctRaw : 0;

    const depositEnabled =
      o.depositEnabled === false ? false : depositPct > 0 ? true : false;

    const depositCents = depositEnabled
      ? Math.round((totalCents * depositPct) / 100)
      : 0;

    const remainingCents = Math.max(0, totalCents - depositCents);

    /* =========================
       ✅ Condições (respeitar "ticado" + preenchido)
       - Se existir flag booleana no backend, ela manda.
       - Se não existir (legacy), inferimos pelo conteúdo.
    ========================= */

    // Duração (somente service)
    const hasDurationFlag = typeof o.durationEnabled === "boolean";
    const durationEnabledLegacy =
      !hasDurationFlag &&
      Number.isFinite(Number(o.durationMin)) &&
      Number(o.durationMin) > 0;
    const durationEnabled = hasDurationFlag
      ? o.durationEnabled
      : durationEnabledLegacy;

    const durationMin =
      offerType === "service" &&
      durationEnabled &&
      Number.isFinite(Number(o.durationMin)) &&
      Number(o.durationMin) > 0
        ? Number(o.durationMin)
        : null;

    // Validade (NÃO usar expiresAt como “validade” — é expiração técnica do link)
    const hasValidityFlag = typeof o.validityEnabled === "boolean";
    const validityDaysRaw = Number(o.validityDays);
    const validityDays =
      Number.isFinite(validityDaysRaw) && validityDaysRaw > 0
        ? validityDaysRaw
        : null;

    const validityUntil = pickFirst(o, [
      "validityUntil",
      "validUntil",
      "validityUntilAt",
    ]);

    const validityEnabledLegacy =
      !hasValidityFlag && (validityDays != null || isNonEmpty(validityUntil));
    const validityEnabled = hasValidityFlag
      ? o.validityEnabled
      : validityEnabledLegacy;

    const validityText = validityEnabled
      ? validityUntil
        ? `Válida até ${fmtDate(validityUntil)}`
        : validityDays != null
          ? `Válida por ${validityDays} dia(s)`
          : ""
      : "";

    // Prazo de entrega
    const deliveryTextRaw = pickFirst(o, ["deliveryText", "delivery"]);
    const hasDeliveryFlag = typeof o.deliveryEnabled === "boolean";
    const deliveryEnabled = hasDeliveryFlag
      ? o.deliveryEnabled
      : isNonEmpty(deliveryTextRaw);
    const deliveryText =
      deliveryEnabled && isNonEmpty(deliveryTextRaw) ? deliveryTextRaw : "";

    // Garantia
    const warrantyTextRaw = pickFirst(o, ["warrantyText", "warranty"]);
    const hasWarrantyFlag = typeof o.warrantyEnabled === "boolean";
    const warrantyEnabled = hasWarrantyFlag
      ? o.warrantyEnabled
      : isNonEmpty(warrantyTextRaw);
    const warrantyText =
      warrantyEnabled && isNonEmpty(warrantyTextRaw) ? warrantyTextRaw : "";

    // Observações/condições
    const notesTextRaw = pickFirst(o, [
      "conditionsNotes",
      "notes",
      "observations",
      "termsNotes",
      "notesText",
    ]);
    const hasNotesFlag = typeof o.notesEnabled === "boolean";
    const notesEnabled = hasNotesFlag
      ? o.notesEnabled
      : isNonEmpty(notesTextRaw);
    const notesText =
      notesEnabled && isNonEmpty(notesTextRaw) ? notesTextRaw : "";

    // Desconto/Frete (respeitar flags quando existirem)
    const hasDiscountFlag = typeof o.discountEnabled === "boolean";
    const discountEnabled = hasDiscountFlag
      ? o.discountEnabled
      : discountCents != null;

    const hasFreightFlag = typeof o.freightEnabled === "boolean";
    const freightEnabled = hasFreightFlag
      ? o.freightEnabled
      : freightCents != null;

    const issuedAt = o.createdAt || o.issuedAt || "";
    const status = o.status || "";

    const contactWhatsApp = pickFirst(o?.user || {}, ["whatsappPhone"]);
    const contactEmail = pickFirst(o, [
      "sellerEmail",
      "providerEmail",
      "vendorEmail",
      "email",
    ]);

    const headerMeta = {
      status,
      issuedAt: fmtDate(issuedAt),
      validityText,
    };

    const includeBullets = extractBulletsFromText(
      o.description || notesTextRaw || "",
      4,
    );

    const conditions = {
      durationEnabled,
      durationMin,
      validityText,
      deliveryText,
      warrantyText,
      notesText,
      discountEnabled,
      discountCents,
      freightEnabled,
      freightCents,
    };

    const ctaLabel =
      offerType === "product" ? "Aceitar e pagar" : "Aceitar e agendar";
    const ctaHint =
      offerType === "product"
        ? "Após aceitar, você confirma e segue para o pagamento via Pix."
        : "Após aceitar, você escolhe um horário disponível e finaliza via Pix.";

    return {
      offerType,
      hasItems,
      items,
      totalCents,
      subtotalCents,
      discountCents,
      freightCents,
      depositEnabled,
      depositPct,
      depositCents,
      remainingCents,
      headerMeta,
      contactWhatsApp,
      contactEmail,
      includeBullets,
      conditions,
      ctaLabel,
      ctaHint,
    };
  }, [offer]);

  const mustAckDeposit = !!view.depositEnabled;
  const ctaEnabled = agreeTerms && (!mustAckDeposit || ackDeposit);

  async function onCta() {
    setCtaError("");
    setBusy(true);

    try {
      // registra aceite para SERVICE e PRODUCT
      const res = await api(`/p/${token}/accept`, {
        method: "POST",
        body: JSON.stringify({
          agreeTerms: true,
          ackDeposit: !!ackDeposit,
          acceptedAt: new Date().toISOString(),
        }),
      });

      if (!res?.ok) throw new Error(res?.error || "Falha ao registrar aceite.");

      // ✅ fluxo:
      // - service -> agenda
      // - product -> pagamento direto
      if (view.offerType === "product") {
        navigate(`/p/${token}/pay`);
      } else {
        navigate(`/p/${token}/schedule`);
      }
    } catch (e) {
      setCtaError(e?.message || "Falha ao registrar aceite.");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className={cls("min-h-screen p-6", isDark ? "bg-slate-950" : "bg-slate-100")}>
        <div
          className={cls(
            "mx-auto max-w-3xl rounded-[28px] border p-5 text-sm",
            isDark
              ? "border-red-400/20 bg-[linear-gradient(135deg,rgba(127,29,29,0.26),rgba(69,10,10,0.18))] text-red-100"
              : "border-red-200/80 bg-[linear-gradient(135deg,#fff1f2,#fff7f7)] text-red-700 shadow-[0_20px_40px_-30px_rgba(239,68,68,0.35)]",
          )}
        >
          {error}
        </div>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-4 text-sm text-zinc-600">
          Carregando proposta…
        </div>
      </div>
    );
  }

  const title = offer.title || "Proposta";
  const description = offer.description || "";
  const customerName = offer.customerName || "Cliente";
  const descriptionPreview = String(description).replace(/\s+/g, " ").trim();

  const statusTone = (() => {
    const s = String(view.headerMeta.status || "").toLowerCase();
    if (!s) return "zinc";
    if (s.includes("paid") || s.includes("pago") || s.includes("confirm"))
      return "emerald";
    if (s.includes("hold") || s.includes("aguard") || s.includes("pend"))
      return "amber";
    if (s.includes("cancel") || s.includes("expir")) return "red";
    return "blue";
  })();

  const hasAnyConditions =
    isNonEmpty(view.conditions.validityText) ||
    isNonEmpty(view.conditions.deliveryText) ||
    isNonEmpty(view.conditions.warrantyText) ||
    isNonEmpty(view.conditions.notesText) ||
    (view.conditions.durationEnabled && view.conditions.durationMin != null) ||
    (view.offerType === "service" &&
      view.conditions.discountEnabled &&
      Number.isFinite(view.conditions.discountCents)) ||
    (view.offerType === "service" &&
      view.conditions.freightEnabled &&
      Number.isFinite(view.conditions.freightCents));

  const heroMetrics = [
    {
      icon: view.offerType === "product" ? Package2 : CalendarClock,
      label: view.offerType === "product" ? "Escopo" : "Atendimento",
      value:
        view.offerType === "product"
          ? `${view.items.length} item${view.items.length === 1 ? "" : "s"}`
          : view.conditions.durationEnabled && view.conditions.durationMin != null
            ? `${view.conditions.durationMin} min`
            : "Personalizado",
      hint:
        view.offerType === "product"
          ? "Itens detalhados com quantidade e valor."
          : hasAnyConditions
            ? "Condições do atendimento descritas abaixo."
            : "Fluxo simples para aceite, agenda e pagamento.",
      tone: "sky",
    },
    {
      icon: Wallet,
      label: view.depositEnabled ? "Entrada" : "Pagamento",
      value: view.depositEnabled
        ? `${fmtBRL(view.depositCents)} agora`
        : "Integral via Pix",
      hint: view.depositEnabled
        ? `Saldo de ${fmtBRL(view.remainingCents)} na etapa final.`
        : "Sem complemento posterior para finalizar a proposta.",
      tone: "emerald",
    },
    {
      icon: view.headerMeta.validityText ? ShieldCheck : Sparkles,
      label: view.headerMeta.validityText ? "Validade" : "Fluxo",
      value:
        view.headerMeta.validityText ||
        (view.offerType === "product"
          ? "Aceite + pagamento"
          : "Aceite + agenda + pagamento"),
      hint: view.headerMeta.issuedAt
        ? `Emitida em ${view.headerMeta.issuedAt}.`
        : "Link exclusivo para esta proposta.",
      tone: "violet",
    },
  ];

  return (
    <div
      className={cls(
        "relative min-h-screen overflow-hidden bg-zinc-50",
        isDark && "bg-slate-950",
      )}
    >
      {/* Header */}
      <div
        className={cls(
          "border-b",
          isDark
            ? "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(9,15,28,0.88))]"
            : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.92))]",
        )}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
              <img
                src={brand}
                alt="LuminorPay"
                className={cls(
                  "h-11 w-11 rounded-2xl object-contain p-1.5",
                  isDark
                    ? "border border-white/10 bg-white/5"
                    : "border border-slate-200/80 bg-white shadow-[0_18px_36px_-28px_rgba(15,23,42,0.25)]",
                )}
              />
            <div>
              <div
                className={cls(
                  "text-sm font-bold",
                  isDark ? "text-white" : "text-slate-950",
                )}
              >
                LuminorPay
              </div>
              <div
                className={cls(
                  "text-xs",
                  isDark ? "text-slate-400" : "text-slate-500",
                )}
              >
                Proposta |{" "}
                {view.offerType === "product" ? "Produto" : "Servico"} | Link
                publico
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              {isNonEmpty(view.headerMeta.status) ? (
                <Badge tone={statusTone}>{view.headerMeta.status}</Badge>
              ) : (
                <Badge>Proposta</Badge>
              )}
            </div>
            <div
              className={cls(
                "text-xs",
                isDark ? "text-slate-400" : "text-slate-500",
              )}
            >
              {view.headerMeta.issuedAt
                ? `Emitida em ${view.headerMeta.issuedAt}`
                : ""}
              {view.headerMeta.issuedAt && view.headerMeta.validityText
                ? " • "
                : ""}
              {view.headerMeta.validityText || ""}
            </div>
          </div>
        </div>

        {(isNonEmpty(view.contactWhatsApp) ||
          isNonEmpty(view.contactEmail)) && (
          <div className="border-t bg-zinc-50">
            <div className="mx-auto flex max-w-3xl flex-col gap-1 px-4 py-2 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
              <div className="font-semibold text-zinc-800">Dúvidas?</div>
              <div className="flex flex-wrap gap-2">
                {isNonEmpty(view.contactWhatsApp) ? (
                  <span className="rounded-full border bg-white px-2.5 py-1">
                    WhatsApp:{" "}
                    <span className="font-semibold">
                      {view.contactWhatsApp}
                    </span>
                  </span>
                ) : null}
                {isNonEmpty(view.contactEmail) ? (
                  <span className="rounded-full border bg-white px-2.5 py-1">
                    Email:{" "}
                    <span className="font-semibold">{view.contactEmail}</span>
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 pb-28 sm:pb-32 md:pb-6">
        {/* Resumo (primeira dobra) */}
        <div
          className={cls(
            "rounded-[34px] border p-6 shadow-[0_28px_80px_-48px_rgba(15,23,42,0.28)] sm:p-8",
            isDark
              ? "border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(10,18,36,0.88))]"
              : "border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.99),rgba(238,245,252,0.92))]",
          )}
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div
                className={cls(
                  "text-[11px] font-bold uppercase tracking-[0.22em]",
                  isDark ? "text-sky-200/80" : "text-sky-700",
                )}
              >
                Proposta
              </div>
              <div
                className={cls(
                  "mt-2 text-3xl font-black tracking-[-0.04em]",
                  isDark ? "text-white" : "text-slate-950",
                )}
              >
                {title}
              </div>
              <div
                className={cls(
                  "mt-2 text-sm",
                  isDark ? "text-slate-300" : "text-zinc-600",
                )}
              >
                Para:{" "}
                <span
                  className={cls(
                    "font-semibold",
                    isDark ? "text-white" : "text-zinc-900",
                  )}
                >
                  {customerName}
                </span>
              </div>

              <div
                className={cls(
                  "mt-3 max-w-2xl text-sm leading-6",
                  isDark ? "text-slate-300" : "text-zinc-600",
                )}
              >
                {descriptionPreview
                  ? descriptionPreview
                  : view.offerType === "product"
                    ? "Confira os itens, os termos e o investimento final antes de seguir com o aceite e o pagamento."
                    : "Confira o escopo, as condicoes do atendimento e siga com aceite, agenda e pagamento no mesmo fluxo."}
              </div>

            </div>

            <div
              className={cls(
                "rounded-[28px] border p-5",
                isDark
                  ? "border-cyan-400/20 bg-[linear-gradient(160deg,rgba(8,47,73,0.42),rgba(6,78,59,0.28),rgba(15,23,42,0.9))]"
                  : "border-cyan-200/80 bg-[linear-gradient(160deg,rgba(239,246,255,0.98),rgba(236,253,245,0.92),rgba(255,255,255,0.96))]",
              )}
            >
              <div
                className={cls(
                  "text-[11px] font-bold uppercase tracking-[0.18em]",
                  isDark ? "text-cyan-100/80" : "text-emerald-700",
                )}
              >
                Total
              </div>
              <div
                className={cls(
                  "mt-2 text-3xl font-black tracking-[-0.04em]",
                  isDark ? "text-white" : "text-slate-950",
                )}
              >
                {fmtBRL(view.totalCents)}
              </div>

              {view.depositEnabled ? (
                <div className={cls("mt-2 text-xs", isDark ? "text-slate-200" : "text-zinc-700")}>
                  Sinal:{" "}
                  <span className="font-semibold">
                    {fmtBRL(view.depositCents)}
                  </span>{" "}
                  <span className="text-zinc-600">({view.depositPct}%)</span> •
                  Restante:{" "}
                  <span className="font-semibold">
                    {fmtBRL(view.remainingCents)}
                  </span>
                </div>
              ) : (
                <div className={cls("mt-2 text-xs", isDark ? "text-slate-200" : "text-zinc-700")}>
                  Pagamento integral
                </div>
              )}

              <div className={cls("mt-3 text-xs", isDark ? "text-slate-300" : "text-zinc-600")}>
                {view.offerType === "product" ? (
                  <>
                    Itens:{" "}
                    <span className="font-semibold text-zinc-900">
                      {view.items.length}
                    </span>
                  </>
                ) : view.conditions.durationEnabled &&
                  view.conditions.durationMin != null ? (
                  <>
                    Duração estimada:{" "}
                    <span className="font-semibold text-zinc-900">
                      {view.conditions.durationMin} min
                    </span>
                  </>
                ) : (
                  " "
                )}
              </div>
            </div>
          </div>

          {/* O que está incluso */}
          {view.includeBullets.length ? (
            <div className="mt-5 rounded-2xl border bg-zinc-50 p-4">
              <div className="text-xs font-semibold text-zinc-600">
                O que está incluso
              </div>
              <ul className="mt-2 space-y-1 text-sm text-zinc-800">
                {view.includeBullets.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <JourneyStat
              label="Proximo passo"
              value={view.offerType === "product" ? "Aceitar e pagar" : "Aceitar e agendar"}
              hint={view.offerType === "product" ? "Voce segue direto para o Pix." : "Voce escolhe um horario antes do Pix."}
              tone="blue"
            />
            <JourneyStat
              label="Validade"
              value={view.headerMeta.validityText || "Sem prazo informado"}
              hint="Confira o prazo antes de concluir."
              tone="amber"
            />
            <JourneyStat
              label="Seguranca"
              value="Link oficial"
              hint="Aceite e pagamento protegidos dentro do fluxo da proposta."
              tone="emerald"
            />
          </div>
        </div>

        {/* Detalhamento */}
        {view.offerType === "service" ? (
          <SectionCard
            title="Resumo do servico"
            subtitle={
              hasAnyConditions
                ? "Detalhes e condicoes do atendimento."
                : "Detalhes e observacoes."
            }
          >
            {isNonEmpty(description) ? (
              <div className="whitespace-pre-wrap text-sm text-zinc-800">
                {safeLines(description)}
              </div>
            ) : (
              <div className="text-sm text-zinc-600">
                Nenhuma descrição adicional informada.
              </div>
            )}

            {/* ✅ Condições (opcional) dentro do resumo do serviço */}
            {hasAnyConditions ? (
              <div className="mt-4 space-y-3">
                {view.conditions.durationEnabled &&
                view.conditions.durationMin != null ? (
                  <div className="rounded-xl border bg-zinc-50 p-3 text-sm">
                    <div className="text-xs font-semibold text-zinc-600">
                      Duração estimada
                    </div>
                    <div className="mt-1 text-zinc-800">
                      <span className="font-semibold text-zinc-900">
                        {view.conditions.durationMin} min
                      </span>
                    </div>
                  </div>
                ) : null}

                {isNonEmpty(view.conditions.validityText) ? (
                  <div className="rounded-xl border bg-zinc-50 p-3 text-sm">
                    <div className="text-xs font-semibold text-zinc-600">
                      Validade
                    </div>
                    <div className="mt-1 text-zinc-800">
                      {view.conditions.validityText}
                    </div>
                  </div>
                ) : null}

                {isNonEmpty(view.conditions.deliveryText) ? (
                  <div className="rounded-xl border bg-zinc-50 p-3 text-sm">
                    <div className="text-xs font-semibold text-zinc-600">
                      Prazo de entrega
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-zinc-800">
                      {safeLines(view.conditions.deliveryText)}
                    </div>
                  </div>
                ) : null}

                {isNonEmpty(view.conditions.warrantyText) ? (
                  <div className="rounded-xl border bg-zinc-50 p-3 text-sm">
                    <div className="text-xs font-semibold text-zinc-600">
                      Garantia
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-zinc-800">
                      {safeLines(view.conditions.warrantyText)}
                    </div>
                  </div>
                ) : null}

                {isNonEmpty(view.conditions.notesText) ? (
                  <div className="rounded-xl border bg-zinc-50 p-3 text-sm">
                    <div className="text-xs font-semibold text-zinc-600">
                      Observações/condições
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-zinc-800">
                      {safeLines(view.conditions.notesText)}
                    </div>
                  </div>
                ) : null}

                {view.conditions.discountEnabled &&
                Number.isFinite(view.conditions.discountCents) ? (
                  <div className="rounded-xl border bg-zinc-50 p-3 text-sm">
                    <div className="text-xs font-semibold text-zinc-600">
                      Desconto
                    </div>
                    <div className="mt-1 text-zinc-800">
                      <span className="font-semibold text-zinc-900">
                        - {fmtBRL(view.conditions.discountCents)}
                      </span>
                    </div>
                  </div>
                ) : null}

                {view.conditions.freightEnabled &&
                Number.isFinite(view.conditions.freightCents) ? (
                  <div className="rounded-xl border bg-zinc-50 p-3 text-sm">
                    <div className="text-xs font-semibold text-zinc-600">
                      Frete
                    </div>
                    <div className="mt-1 text-zinc-800">
                      <span className="font-semibold text-zinc-900">
                        {fmtBRL(view.conditions.freightCents)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </SectionCard>
        ) : (
          <SectionCard
            title="Itens do orcamento"
            subtitle="Confira itens, quantidades e valores antes de seguir."
          >
            {!view.items.length ? (
              <div className="text-sm text-zinc-600">
                Nenhum item informado neste orcamento.
              </div>
            ) : (
              <>
                {/* Mobile */}
                <div className="space-y-2 sm:hidden">
                  {view.items.map((it, idx) => {
                    const desc = isNonEmpty(it?.description)
                      ? it.description
                      : "—";
                    const qty =
                      Number.isFinite(it?.qty) && it.qty >= 0 ? it.qty : null;
                    const unit =
                      Number.isFinite(it?.unitPriceCents) &&
                      it.unitPriceCents >= 0
                        ? it.unitPriceCents
                        : null;
                    const line =
                      Number.isFinite(it?.lineTotalCents) &&
                      it.lineTotalCents >= 0
                        ? it.lineTotalCents
                        : null;
                    return (
                      <div key={idx} className="rounded-xl border bg-white p-3">
                        <div className="text-sm font-semibold text-zinc-900">
                          {desc}
                        </div>
                        <div className="mt-1 text-xs text-zinc-600">
                          Qtd:{" "}
                          <span className="font-semibold text-zinc-900">
                            {qty != null ? qty : "—"}
                          </span>
                          {" • "}Unit:{" "}
                          <span className="font-semibold text-zinc-900">
                            {unit != null ? fmtBRL(unit) : "—"}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-zinc-700">
                          Total do item:{" "}
                          <span className="font-semibold text-zinc-900">
                            {line != null ? fmtBRL(line) : "—"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop */}
                <div className="hidden overflow-auto rounded-xl border sm:block">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-zinc-50 text-xs font-semibold text-zinc-600">
                      <tr>
                        <th className="px-3 py-2">Descrição</th>
                        <th className="px-3 py-2 text-right">Qtd</th>
                        <th className="px-3 py-2 text-right">Valor unit.</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-white">
                      {view.items.map((it, idx) => {
                        const desc = isNonEmpty(it?.description)
                          ? it.description
                          : "—";
                        const qty =
                          Number.isFinite(it?.qty) && it.qty >= 0
                            ? it.qty
                            : null;
                        const unit =
                          Number.isFinite(it?.unitPriceCents) &&
                          it.unitPriceCents >= 0
                            ? it.unitPriceCents
                            : null;
                        const line =
                          Number.isFinite(it?.lineTotalCents) &&
                          it.lineTotalCents >= 0
                            ? it.lineTotalCents
                            : null;
                        return (
                          <tr
                            key={idx}
                            className={`${
                              idx % 2 ? "bg-zinc-50/40" : ""
                            } hover:bg-zinc-50`}
                          >
                            <td className="px-3 py-2 text-zinc-900">{desc}</td>
                            <td className="px-3 py-2 text-right text-zinc-700">
                              {qty != null ? qty : "—"}
                            </td>
                            <td className="px-3 py-2 text-right text-zinc-700">
                              {unit != null ? fmtBRL(unit) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-zinc-900">
                              {line != null ? fmtBRL(line) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="mt-4 flex items-center justify-between rounded-xl border bg-zinc-50 p-3 text-sm">
              <div className="text-zinc-600">Total geral</div>
              <div className="font-semibold text-zinc-900">
                {fmtBRL(view.totalCents)}
              </div>
            </div>
          </SectionCard>
        )}

        {/* Total (e extras, se existirem) */}
        <SectionCard
          title="Resumo financeiro"
          subtitle="Subtotal, desconto e frete so aparecem quando foram definidos."
        >
          <div className="space-y-2 text-sm">
            {Number.isFinite(view.subtotalCents) ? (
              <div className="flex items-center justify-between">
                <div className="text-zinc-600">Subtotal</div>
                <div className="font-semibold text-zinc-900">
                  {fmtBRL(view.subtotalCents)}
                </div>
              </div>
            ) : null}

            {Number.isFinite(view.discountCents) ? (
              <div className="flex items-center justify-between">
                <div className="text-zinc-600">Desconto</div>
                <div className="font-semibold text-zinc-900">
                  - {fmtBRL(view.discountCents)}
                </div>
              </div>
            ) : null}

            {Number.isFinite(view.freightCents) ? (
              <div className="flex items-center justify-between">
                <div className="text-zinc-600">Frete</div>
                <div className="font-semibold text-zinc-900">
                  {fmtBRL(view.freightCents)}
                </div>
              </div>
            ) : null}

            <div className="mt-2 flex items-center justify-between border-t pt-3">
              <div className="text-zinc-900">Total final</div>
              <div className="text-lg font-semibold text-zinc-900">
                {fmtBRL(view.totalCents)}
              </div>
            </div>
          </div>

          {view.depositEnabled ? (
            <div className="mt-4 rounded-2xl border bg-amber-50 p-4">
              <div className="text-sm font-semibold text-zinc-900">Sinal</div>
              <div className="mt-1 text-sm text-zinc-700">
                Voce paga agora{" "}
                <span className="font-semibold text-zinc-900">
                  {fmtBRL(view.depositCents)}
                </span>{" "}
                para confirmar o compromisso.
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                Restante:{" "}
                <span className="font-semibold text-zinc-900">
                  {fmtBRL(view.remainingCents)}
                </span>
                {view.offerType === "service"
                  ? " (no dia do atendimento, conforme combinado)."
                  : " (na finalizacao, conforme combinado)."}
              </div>
            </div>
          ) : null}
        </SectionCard>

        {/* ✅ Condições e termos: mantém para PRODUTO */}
        {view.offerType === "product" &&
        (isNonEmpty(view.conditions.validityText) ||
          isNonEmpty(view.conditions.deliveryText) ||
          isNonEmpty(view.conditions.warrantyText) ||
          isNonEmpty(view.conditions.notesText)) ? (
          <SectionCard
            title="Condicoes e termos"
            subtitle="Somente o que foi definido para esta proposta."
          >
            <div className="space-y-3 text-sm text-zinc-800">
              {isNonEmpty(view.conditions.validityText) ? (
                <div className="rounded-xl border bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-600">
                    Validade
                  </div>
                  <div className="mt-1">{view.conditions.validityText}</div>
                </div>
              ) : null}

              {isNonEmpty(view.conditions.deliveryText) ? (
                <div className="rounded-xl border bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-600">
                    Prazo de entrega
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">
                    {safeLines(view.conditions.deliveryText)}
                  </div>
                </div>
              ) : null}

              {isNonEmpty(view.conditions.warrantyText) ? (
                <div className="rounded-xl border bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-600">
                    Garantia
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">
                    {safeLines(view.conditions.warrantyText)}
                  </div>
                </div>
              ) : null}

              {isNonEmpty(view.conditions.notesText) ? (
                <div className="rounded-xl border bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-600">
                    Observacoes e condicoes
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">
                    {safeLines(view.conditions.notesText)}
                  </div>
                </div>
              ) : null}
            </div>
          </SectionCard>
        ) : null}

        {/* Confirmação + CTA */}
        <div
          className={cls(
            "rounded-[30px] border p-5 shadow-[0_28px_70px_-46px_rgba(15,23,42,0.22)] sm:p-6",
            isDark
              ? "border-cyan-400/20 bg-[linear-gradient(160deg,rgba(8,47,73,0.42),rgba(15,23,42,0.92))]"
              : "border-cyan-200/80 bg-[linear-gradient(160deg,rgba(239,246,255,0.98),rgba(255,255,255,0.96))]",
          )}
        >
          <div
            className={cls(
              "text-lg font-black tracking-[-0.03em]",
              isDark ? "text-white" : "text-slate-950",
            )}
          >
            Confirmar esta proposta
          </div>
          <div
            className={cls(
              "mt-2 text-sm leading-6",
              isDark ? "text-slate-300" : "text-zinc-600",
            )}
          >
            Antes de continuar, revise e confirme os pontos abaixo.
          </div>

          <div className="mt-4 space-y-3">
            <label
              className={cls(
                "flex items-start gap-3 rounded-[24px] border p-4",
                agreeTerms
                  ? isDark
                    ? "border-emerald-400/20 bg-emerald-400/10"
                    : "border-emerald-200 bg-emerald-50"
                  : isDark
                    ? "border-white/10 bg-white/5"
                    : "border-slate-200/80 bg-white/85",
              )}
            >
              <input
                type="checkbox"
                className={cls(
                  "mt-1 h-4 w-4 rounded border text-cyan-600 focus:ring-cyan-500",
                  isDark ? "border-white/20 bg-slate-950" : "border-slate-300 bg-white",
                )}
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
              />
              <div>
                <div className={cls("text-sm font-semibold", isDark ? "text-white" : "text-zinc-900")}>
                  Li e concordo com as condicoes descritas para esta proposta.
                </div>
                <div className={cls("text-xs", isDark ? "text-slate-300" : "text-zinc-600")}>
                  Voce esta seguindo com o aceite do que foi descrito acima para
                  esta proposta.
                </div>
              </div>
            </label>

            {mustAckDeposit ? (
              <label
                className={cls(
                  "flex items-start gap-3 rounded-[24px] border p-4",
                  ackDeposit
                    ? isDark
                      ? "border-amber-400/20 bg-amber-400/10"
                      : "border-amber-200 bg-amber-50"
                    : isDark
                      ? "border-white/10 bg-white/5"
                      : "border-slate-200/80 bg-white/85",
                )}
              >
                <input
                  type="checkbox"
                  className={cls(
                    "mt-1 h-4 w-4 rounded border text-cyan-600 focus:ring-cyan-500",
                    isDark ? "border-white/20 bg-slate-950" : "border-slate-300 bg-white",
                  )}
                  checked={ackDeposit}
                  onChange={(e) => setAckDeposit(e.target.checked)}
                />
                <div>
                  <div className={cls("text-sm font-semibold", isDark ? "text-white" : "text-zinc-900")}>
                    Entendo que o sinal e de {fmtBRL(view.depositCents)} (
                    {view.depositPct}%).
                  </div>
                  <div className={cls("text-xs", isDark ? "text-slate-300" : "text-zinc-700")}>
                    O sinal confirma o compromisso e inicia esta etapa do
                    processo.
                  </div>
                </div>
              </label>
            ) : null}

            <div
              className={cls(
                "rounded-[24px] border p-3 text-xs",
                isDark
                  ? "border-white/10 bg-white/5 text-slate-400"
                  : "border-slate-200/80 bg-white/85 text-zinc-600",
              )}
            >
              Este link e exclusivo desta proposta. Se voce recebeu por engano,
              nao prossiga.
            </div>

            {ctaError ? (
              <div
                className={cls(
                  "rounded-[24px] border p-3 text-sm",
                  isDark
                    ? "border-red-400/20 bg-red-400/10 text-red-100"
                    : "border-red-200 bg-red-50 text-red-800",
                )}
              >
                {ctaError}
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className={cls("text-xs", isDark ? "text-slate-300" : "text-zinc-500")}>
              {view.ctaHint}
            </div>
            <Button
              type="button"
              onClick={onCta}
              disabled={!ctaEnabled || busy}
              className="justify-between gap-3 rounded-2xl px-5"
            >
              {busy ? "Processando..." : view.ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div
        className={cls(
          "fixed inset-x-0 bottom-0 z-40 border-t px-4 py-3 md:hidden",
          isDark
            ? "border-white/10 bg-[rgba(2,6,23,0.94)] backdrop-blur-xl"
            : "border-slate-200/80 bg-white/95 backdrop-blur-xl",
        )}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className={cls("text-[11px] font-bold uppercase tracking-[0.18em]", isDark ? "text-slate-400" : "text-slate-500")}>
              Total desta proposta
            </div>
            <div className={cls("text-base font-black tracking-[-0.03em]", isDark ? "text-white" : "text-slate-950")}>
              {fmtBRL(view.totalCents)}
            </div>
          </div>

          <Button
            type="button"
            onClick={onCta}
            disabled={!ctaEnabled || busy}
            className="shrink-0 rounded-2xl px-4"
          >
            {busy ? "Processando..." : view.ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
