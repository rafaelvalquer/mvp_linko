import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../app/api.js";
import Button from "../components/appui/Button.jsx";
import { motion, useReducedMotion } from "framer-motion";
import brand from "../assets/brand.png";

/* =========================
   Helpers
========================= */

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

function Badge({ tone = "zinc", children }) {
  const map = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    zinc: "bg-zinc-50 text-zinc-700 border-zinc-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
        map[tone] || map.zinc
      }`}
    >
      {children}
    </span>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-900">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 text-xs text-zinc-500">{subtitle}</div>
          ) : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
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
            icon: "🗓️",
            title: "Escolha um horário",
            desc: "Selecione um horário disponível para agendar.",
          }
        : {
            tone: "violet",
            icon: "📦",
            title: "Receba instruções",
            desc: "Você recebe as instruções de produção/entrega (se aplicável).",
          };

    return [
      {
        tone: "emerald",
        icon: "🧾",
        title: "Revise a proposta",
        desc: "Confira detalhes e valores acima.",
      },
      {
        tone: "amber",
        icon: "✅",
        title: "Confirme o aceite",
        desc: "Aprove e siga para a próxima etapa.",
      },
      step3,
      {
        tone: "rose",
        icon: "⚡",
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

    const contactWhatsApp = pickFirst(o, [
      "customerWhatsApp",
      "sellerWhatsApp",
      "providerWhatsApp",
      "vendorWhatsApp",
      "whatsApp",
      "whatsapp",
    ]);
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
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
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

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <img
              src={brand}
              alt="Luminor Pay"
              className="h-9 w-9 rounded-xl object-contain ring-1 ring-zinc-200 bg-white p-1"
            />
            <div>
              <div className="text-sm font-semibold text-zinc-900">
                LuminorPay
              </div>
              <div className="text-xs text-zinc-500">
                Proposta •{" "}
                {view.offerType === "product" ? "Produto" : "Serviço"} • Link
                público
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
            <div className="text-xs text-zinc-500">
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

      <div className="mx-auto grid max-w-3xl gap-4 px-4 py-6">
        {/* Resumo (primeira dobra) */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Proposta
              </div>
              <div className="mt-1 text-2xl font-semibold text-zinc-900">
                {title}
              </div>
              <div className="mt-1 text-sm text-zinc-600">
                Para:{" "}
                <span className="font-semibold text-zinc-900">
                  {customerName}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border bg-emerald-50 p-4">
              <div className="text-xs font-semibold text-emerald-700">
                Total
              </div>
              <div className="mt-1 text-2xl font-semibold text-zinc-900">
                {fmtBRL(view.totalCents)}
              </div>

              {view.depositEnabled ? (
                <div className="mt-1 text-xs text-zinc-700">
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
                <div className="mt-1 text-xs text-zinc-700">
                  Pagamento integral
                </div>
              )}

              <div className="mt-2 text-xs text-zinc-600">
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
        </div>

        {/* Detalhamento */}
        {view.offerType === "service" ? (
          <SectionCard
            title="Resumo do serviço 🧾"
            subtitle={
              hasAnyConditions
                ? "Detalhes e condições do atendimento."
                : "Detalhes e observações."
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
            title="Itens do orçamento 🧾"
            subtitle="Confira os itens, quantidades e valores."
          >
            {!view.items.length ? (
              <div className="text-sm text-zinc-600">
                Nenhum item informado neste orçamento.
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
          title="Total 🧾"
          subtitle="Subtotal/Desconto/Frete só aparecem se foram definidos."
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
                Você paga agora{" "}
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
                  : " (na finalização, conforme combinado)."}
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
            title="Condições e termos"
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
                    Observações/condições
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">
                    {safeLines(view.conditions.notesText)}
                  </div>
                </div>
              ) : null}
            </div>
          </SectionCard>
        ) : null}

        {/* Próximos passos */}
        <SectionCard title="Próximos passos" subtitle="Rápido, sem enrolação.">
          <NextSteps
            offerType={view.offerType}
            depositEnabled={view.depositEnabled}
          />
        </SectionCard>

        {/* Confirmação + CTA */}
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-zinc-900">
            Confirmar e aceitar
          </div>
          <div className="mt-1 text-sm text-zinc-600">
            Antes de continuar, marque os itens abaixo.
          </div>

          <div className="mt-4 space-y-3">
            <label className="flex items-start gap-3 rounded-xl border bg-zinc-50 p-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
              />
              <div>
                <div className="text-sm font-semibold text-zinc-900">
                  Li e concordo com as condições (quando aplicável).
                </div>
                <div className="text-xs text-zinc-600">
                  Você está aceitando o que foi descrito acima para esta
                  proposta.
                </div>
              </div>
            </label>

            {mustAckDeposit ? (
              <label className="flex items-start gap-3 rounded-xl border bg-amber-50 p-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={ackDeposit}
                  onChange={(e) => setAckDeposit(e.target.checked)}
                />
                <div>
                  <div className="text-sm font-semibold text-zinc-900">
                    Entendo que o sinal é de {fmtBRL(view.depositCents)} (
                    {view.depositPct}%).
                  </div>
                  <div className="text-xs text-zinc-700">
                    O sinal serve para confirmar o compromisso e iniciar o
                    processo.
                  </div>
                </div>
              </label>
            ) : null}

            <div className="rounded-xl border bg-white p-3 text-xs text-zinc-600">
              Este link é exclusivo para esta proposta. Se você recebeu por
              engano, não prossiga.
            </div>

            {ctaError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {ctaError}
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-zinc-500">{view.ctaHint}</div>
            <Button
              type="button"
              onClick={onCta}
              disabled={!ctaEnabled || busy}
            >
              {busy ? "Processando…" : view.ctaLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
