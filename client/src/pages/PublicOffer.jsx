import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../app/api.js";
import Button from "../components/appui/Button.jsx";

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
  const t = String(text || "");
  return t;
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

  // Prefer line breaks first
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

    const inferredType =
      (o.offerType && String(o.offerType)) ||
      (Array.isArray(o.items) && o.items.length ? "product" : "service");

    const offerType = inferredType === "product" ? "product" : "service";

    const items = Array.isArray(o.items) ? o.items : [];
    const hasItems = items.length > 0;

    const totalCents =
      (Number.isFinite(o.totalCents) && o.totalCents) ||
      (Number.isFinite(o.amountCents) && o.amountCents) ||
      0;

    // subtotal: prefer explicit, else items sum (if available), else total as fallback
    const itemsSubtotal = sumItemsSubtotalCents(items);
    const subtotalCents =
      Number.isFinite(o.subtotalCents) && o.subtotalCents >= 0
        ? o.subtotalCents
        : itemsSubtotal != null
          ? itemsSubtotal
          : null;

    // discount/freight: show only if exists and >0
    const discountCents =
      Number.isFinite(o.discountCents) && o.discountCents > 0
        ? o.discountCents
        : null;

    const freightCents =
      Number.isFinite(o.freightCents) && o.freightCents > 0
        ? o.freightCents
        : null;

    const depositPctRaw = Number(o.depositPct);
    const depositPct =
      Number.isFinite(depositPctRaw) && depositPctRaw > 0 ? depositPctRaw : 0;

    const depositEnabled =
      o.depositEnabled === false ? false : depositPct > 0 ? true : false;

    const depositCents = depositEnabled
      ? Math.round((totalCents * depositPct) / 100)
      : 0;

    const remainingCents = Math.max(0, totalCents - depositCents);

    const issuedAt = o.createdAt || o.issuedAt || "";
    const validityDays =
      Number.isFinite(o.validityDays) && o.validityDays > 0
        ? o.validityDays
        : 0;

    const validityUntil =
      o.validityUntil || o.validUntil || o.expiresAt || o.validityUntilAt || "";

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
      validityText: validityUntil
        ? `Válida até ${fmtDate(validityUntil)}`
        : validityDays
          ? `Válida por ${validityDays} dia(s)`
          : "",
    };

    const includeBullets = extractBulletsFromText(
      o.description || o.conditionsNotes || "",
      4,
    );

    // Conditions (only show if field exists / non-empty)
    const conditions = {
      validityText: headerMeta.validityText,
      deliveryText: isNonEmpty(o.deliveryText) ? o.deliveryText : "",
      warrantyText: isNonEmpty(o.warrantyText) ? o.warrantyText : "",
      notesText: isNonEmpty(o.conditionsNotes) ? o.conditionsNotes : "",
      policyText: isNonEmpty(o.policyText) ? o.policyText : "",
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

    // Mantém o placeholder de produto (MVP futuro)
    if (view.offerType === "product") {
      alert("MVP: Aceitar e pagar (placeholder).");
      return;
    }

    // Service: POST accept + navegar
    setBusy(true);
    try {
      const res = await api(`/p/${token}/accept`, {
        method: "POST",
        body: JSON.stringify({
          agreeTerms: true,
          ackDeposit: !!ackDeposit,
          acceptedAt: new Date().toISOString(),
        }),
      });

      if (!res?.ok) {
        throw new Error(res?.error || "Falha ao registrar aceite.");
      }

      navigate(`/p/${token}/schedule`);
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

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-sm font-semibold text-white">
              P
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-900">PayLink</div>
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
                ) : Number.isFinite(offer.durationMin) &&
                  offer.durationMin > 0 ? (
                  <>
                    Duração estimada:{" "}
                    <span className="font-semibold text-zinc-900">
                      {offer.durationMin} min
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
            title="Descrição do serviço"
            subtitle={
              Number.isFinite(offer.durationMin)
                ? "Detalhes e observações do atendimento."
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

            {Number.isFinite(offer.durationMin) && offer.durationMin > 0 ? (
              <div className="mt-4 rounded-xl border bg-zinc-50 p-3 text-sm text-zinc-700">
                Duração estimada:{" "}
                <span className="font-semibold text-zinc-900">
                  {offer.durationMin} min
                </span>
              </div>
            ) : null}
          </SectionCard>
        ) : (
          <SectionCard
            title="Itens do orçamento"
            subtitle="Confira os itens, quantidades e valores."
          >
            {/* Mobile list */}
            <div className="space-y-2 sm:hidden">
              {view.items.map((it, idx) => {
                const desc = it?.description || `Item ${idx + 1}`;
                const qty = Number(it?.qty) || 1;
                const unit = Number.isFinite(it?.unitPriceCents)
                  ? it.unitPriceCents
                  : null;
                const line = Number.isFinite(it?.lineTotalCents)
                  ? it.lineTotalCents
                  : null;
                return (
                  <div key={idx} className="rounded-xl border bg-white p-3">
                    <div className="text-sm font-semibold text-zinc-900">
                      {desc}
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">
                      Qtd:{" "}
                      <span className="font-semibold text-zinc-900">{qty}</span>
                      {" • "}
                      Unit:{" "}
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

            {/* Desktop table */}
            <div className="hidden overflow-auto rounded-xl border sm:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold text-zinc-600">
                  <tr>
                    <th className="px-3 py-2">Descrição</th>
                    <th className="px-3 py-2">Qtd</th>
                    <th className="px-3 py-2">Valor unit.</th>
                    <th className="px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {view.items.map((it, idx) => {
                    const desc = it?.description || `Item ${idx + 1}`;
                    const qty = Number(it?.qty) || 1;
                    const unit = Number.isFinite(it?.unitPriceCents)
                      ? it.unitPriceCents
                      : null;
                    const line = Number.isFinite(it?.lineTotalCents)
                      ? it.lineTotalCents
                      : null;
                    return (
                      <tr key={idx}>
                        <td className="px-3 py-2 text-zinc-900">{desc}</td>
                        <td className="px-3 py-2 text-zinc-700">{qty}</td>
                        <td className="px-3 py-2 text-zinc-700">
                          {unit != null ? fmtBRL(unit) : "—"}
                        </td>
                        <td className="px-3 py-2 font-semibold text-zinc-900">
                          {line != null ? fmtBRL(line) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {Number.isFinite(offer.durationMin) && offer.durationMin > 0 ? (
              <div className="mt-4 rounded-xl border bg-zinc-50 p-3 text-sm text-zinc-700">
                Prazo estimado (duração):{" "}
                <span className="font-semibold text-zinc-900">
                  {offer.durationMin} min
                </span>
              </div>
            ) : null}
          </SectionCard>
        )}

        {/* Resumo de valores */}
        <SectionCard
          title="Resumo de valores"
          subtitle="Tudo organizado para você bater o olho e decidir."
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

        {/* Condições e termos (somente o que existir) */}
        {(isNonEmpty(view.conditions.validityText) ||
          isNonEmpty(view.conditions.deliveryText) ||
          isNonEmpty(view.conditions.warrantyText) ||
          isNonEmpty(view.conditions.notesText) ||
          isNonEmpty(view.conditions.policyText)) && (
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

              {isNonEmpty(view.conditions.policyText) ? (
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs font-semibold text-zinc-600">
                    Política
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">
                    {safeLines(view.conditions.policyText)}
                  </div>
                </div>
              ) : null}
            </div>
          </SectionCard>
        )}

        {/* Próximos passos */}
        <SectionCard title="Próximos passos" subtitle="Rápido, sem enrolação.">
          <ol className="grid gap-2 text-sm text-zinc-800">
            <li className="rounded-xl border bg-white p-3">
              <span className="font-semibold">1) </span>Revise os detalhes e
              valores acima.
            </li>
            <li className="rounded-xl border bg-white p-3">
              <span className="font-semibold">2) </span>Confirme o aceite desta
              proposta.
            </li>
            {view.offerType === "service" ? (
              <li className="rounded-xl border bg-white p-3">
                <span className="font-semibold">3) </span>Escolha um horário
                disponível para agendar.
              </li>
            ) : (
              <li className="rounded-xl border bg-white p-3">
                <span className="font-semibold">3) </span>Você recebe as
                instruções de produção/entrega (se aplicável).
              </li>
            )}
            <li className="rounded-xl border bg-white p-3">
              <span className="font-semibold">4) </span>
              Pague via Pix{" "}
              {view.depositEnabled
                ? "(sinal ou conforme combinado)"
                : "(total)"}{" "}
              e finalize.
            </li>
          </ol>
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
                  Li e concordo com as condições e política (quando aplicável).
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
