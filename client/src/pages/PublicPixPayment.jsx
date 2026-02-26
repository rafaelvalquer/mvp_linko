// src/pages/PublicPixPayment.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../app/api.js";
import Button from "../components/appui/Button.jsx";
import { Input } from "../components/appui/Input.jsx";
import {
  isQuotaExceededError,
  quotaExceededMessage,
} from "../utils/planQuota.js";
import brand from "../assets/brand.png";

function fmtBRL(cents) {
  const v = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v / 100);
}

function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR");
}

function onlyDigits(s) {
  return String(s || "").replace(/\D+/g, "");
}

function SuccessModal({ open, title, sub, detail, onConfirm }) {
  const btnRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => btnRef.current?.focus?.(), 0);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Pagamento aprovado"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xl font-semibold text-zinc-900">{title}</div>
        <div className="mt-2 text-sm text-zinc-700">{sub}</div>
        {detail ? (
          <div className="mt-3 rounded-xl border bg-zinc-50 p-3 text-xs text-zinc-700">
            {detail}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end">
          <button
            ref={btnRef}
            type="button"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            onClick={onConfirm}
          >
            Ok, entendi
          </button>
        </div>
      </div>
    </div>
  );
}

function isNonEmpty(s) {
  return String(s || "").trim().length > 0;
}

function normalizeStatus(st) {
  const s = String(st || "")
    .trim()
    .toUpperCase();
  // compat: alguns gateways usam "CANCELED" (1 L)
  if (s === "CANCELED") return "CANCELLED";
  return s;
}

function isTerminalPixStatus(st) {
  const s = normalizeStatus(st);
  return (
    s === "PAID" || s === "EXPIRED" || s === "CANCELLED" || s === "REFUNDED"
  );
}

function msUntil(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return t - Date.now();
}

export default function PublicPixPayment() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();

  const bookingIdFromUrl = search.get("bookingId") || "";
  const [bookingId, setBookingId] = useState(() => bookingIdFromUrl);

  const [offer, setOffer] = useState(null);
  const [offerErr, setOfferErr] = useState("");
  const [loadingOffer, setLoadingOffer] = useState(true);

  const [name, setName] = useState("");
  const [cellphone, setCellphone] = useState("");
  const [email, setEmail] = useState("");
  const [taxId, setTaxId] = useState("");

  // ✅ Dirty-guard (não sobrescrever edição do usuário)
  const emailDirtyRef = useRef(false);
  const taxDirtyRef = useRef(false);
  const [prefillHint, setPrefillHint] = useState(false);
  const prefilledOnceRef = useRef(false);

  const [busy, setBusy] = useState(false);
  const [pixErr, setPixErr] = useState("");
  const [quotaBlocked, setQuotaBlocked] = useState(false);

  const [pix, setPix] = useState(null);
  const pollRef = useRef(null);
  const expireTimerRef = useRef(null);

  const [showPaidModal, setShowPaidModal] = useState(false);
  const [locked, setLocked] = useState(false);
  const [paidAt, setPaidAt] = useState(null);

  const paidOnceRef = useRef(false);

  const doneUrl = useMemo(() => {
    const q = bookingId ? `?bookingId=${encodeURIComponent(bookingId)}` : "";
    return `/p/${token}/done${q}`;
  }, [token, bookingId]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = null;
    if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
    expireTimerRef.current = null;
  }, []);

  const markPaidOnce = useCallback(
    (pixData, paidAtIso) => {
      if (paidOnceRef.current) return;
      paidOnceRef.current = true;

      stopPolling();
      setLocked(true);
      setPaidAt(
        paidAtIso ||
          pixData?.paidAt ||
          pixData?.updatedAt ||
          new Date().toISOString(),
      );
      setShowPaidModal(true);
    },
    [stopPolling],
  );

  const view = useMemo(() => {
    const o = offer || {};
    const items = Array.isArray(o.items) ? o.items : [];
    const hasItems = items.length > 0;

    // infer offerType (compat)
    const rawType = isNonEmpty(o.offerType)
      ? String(o.offerType).trim().toLowerCase()
      : "";
    const offerType = rawType === "product" || hasItems ? "product" : "service";
    const requiresBooking = offerType === "service";

    const totalCents =
      (Number.isFinite(o.totalCents) && o.totalCents) ||
      (Number.isFinite(o.amountCents) && o.amountCents) ||
      0;

    const depositPctRaw = Number(o.depositPct);
    const depositPct =
      Number.isFinite(depositPctRaw) && depositPctRaw > 0 ? depositPctRaw : 0;

    const depositEnabled = o.depositEnabled === false ? false : depositPct > 0;

    const depositCents = depositEnabled
      ? Math.round((totalCents * depositPct) / 100)
      : 0;

    const amountToChargeCents = depositEnabled ? depositCents : totalCents;

    return {
      offerType,
      requiresBooking,
      title: o.title || "Pagamento",
      customerName: o.customerName || "",
      totalCents,
      depositEnabled,
      depositPct,
      depositCents,
      amountToChargeCents,
    };
  }, [offer]);

  // Load offer (e respeita flowState)
  useEffect(() => {
    setLoadingOffer(true);
    setOfferErr("");
    setPixErr("");
    setQuotaBlocked(false);
    setPrefillHint(false);
    prefilledOnceRef.current = false;
    paidOnceRef.current = false;
    setLocked(false);
    setShowPaidModal(false);
    setPaidAt(null);

    api(`/p/${token}`)
      .then((d) => {
        const step = String(d?.flow?.step || "").toUpperCase();

        const flowBookingId = String(
          d?.flow?.bookingId || d?.booking?.id || bookingId || "",
        ).trim();

        const q = flowBookingId
          ? `?bookingId=${encodeURIComponent(flowBookingId)}`
          : "";

        // ✅ se abrir /pay indevidamente, redireciona para o passo correto
        if (step && step !== "PAYMENT") {
          if (step === "SCHEDULE") {
            navigate(`/p/${token}/schedule`, { replace: true });
            return;
          }
          if (step === "DONE") {
            navigate(`/p/${token}/done${q}`, { replace: true });
            return;
          }
          // ACCEPT / EXPIRED / CANCELED -> rota base (guard decide)
          navigate(`/p/${token}`, { replace: true });
          return;
        }

        const o = d.offer || null;
        setOffer(o);

        // ✅ backend pode devolver booking existente para SERVICE
        if (!bookingId && flowBookingId) setBookingId(flowBookingId);

        setName(o?.customerName || "");
        setCellphone(o?.customerWhatsApp || o?.customerCellphone || "");

        // ✅ Prefill (não sobrescreve se usuário já digitou)
        const snapEmail = String(o?.customerEmail || "").trim();
        const snapDoc = String(o?.customerDoc || "").trim();

        if (!emailDirtyRef.current) {
          setEmail((prev) => {
            if (String(prev || "").trim()) return prev;
            if (snapEmail) {
              setPrefillHint(true);
              return snapEmail;
            }
            return prev;
          });
        }

        if (!taxDirtyRef.current) {
          setTaxId((prev) => {
            if (String(prev || "").trim()) return prev;
            if (snapDoc) {
              setPrefillHint(true);
              return snapDoc;
            }
            return prev;
          });
        }

        // evita “piscar” de hint em re-renders
        if (
          !prefilledOnceRef.current &&
          (isNonEmpty(snapEmail) || isNonEmpty(snapDoc))
        ) {
          prefilledOnceRef.current = true;
          setPrefillHint(true);
        }

        // segurança extra (caso algum status antigo não venha com flow)
        const st = normalizeStatus(o?.status);
        if (st === "PAID" || st === "CONFIRMED") {
          navigate(`/p/${token}/done${q}`, { replace: true });
          return;
        }
      })
      .catch((e) => {
        setOfferErr(e?.message || "Falha ao carregar proposta.");
        setOffer(null);
      })
      .finally(() => setLoadingOffer(false));
  }, [token, bookingId, navigate]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;

      if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
      expireTimerRef.current = null;
    };
  }, []);

  const refreshStatus = useCallback(
    async (pixId) => {
      const d = await api(
        `/p/${token}/pix/status?pixId=${encodeURIComponent(pixId)}`,
      );

      const p = d?.pix || {};
      const st = normalizeStatus(p.status);

      setPix((prev) =>
        prev
          ? {
              ...prev,
              ...p,
              status: st,
              amountCents: Number.isFinite(p.amount)
                ? p.amount
                : prev.amountCents,
            }
          : prev,
      );

      if (st === "PAID") {
        markPaidOnce(p, d?.paidAt);
      }

      if (st === "PAID" || d?.locked) {
        markPaidOnce({ ...p, status: "PAID" }, d?.paidAt);
        return "PAID";
      }

      // ✅ CANCELLED / REFUNDED / EXPIRED: terminal (para o polling)
      if (st === "EXPIRED" || st === "CANCELLED" || st === "REFUNDED") {
        stopPolling();
      }

      return st;
    },
    [token, markPaidOnce, stopPolling],
  );

  async function createPix() {
    if (quotaBlocked) {
      setPixErr(quotaExceededMessage("public"));
      return;
    }

    const payload = {
      ...(view.requiresBooking && bookingId ? { bookingId } : {}),
      customer: {
        name: String(name || "").trim(),
        cellphone: onlyDigits(cellphone),
        email: String(email || "").trim(),
        taxId: onlyDigits(taxId),
      },
    };

    if (!payload.customer.name) return setPixErr("Informe o nome.");
    if (!payload.customer.email) return setPixErr("Informe o email.");
    if (!payload.customer.taxId)
      return setPixErr("Informe o CPF/CNPJ (taxId).");

    setBusy(true);
    try {
      const res = await api(`/p/${token}/pix/create`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res?.ok) throw new Error(res?.error || "Falha ao gerar Pix.");

      const mapped = {
        ...res.pix,
        status: normalizeStatus(res?.pix?.status),
        amountCents: Number.isFinite(res?.pix?.amount)
          ? res.pix.amount
          : undefined,
      };

      setPix(mapped);

      const st = normalizeStatus(mapped?.status);
      if (st === "PAID") {
        markPaidOnce(mapped, res?.paidAt);
      }
    } catch (e) {
      setPix(null);

      if (isQuotaExceededError(e)) {
        setQuotaBlocked(true);
        setPixErr(quotaExceededMessage("public"));
      } else {
        setPixErr(e?.message || "Falha ao gerar Pix.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyBrCode() {
    const code = pix?.brCode || "";
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }

  // ✅ Polling + timeout por expiresAt (encerra automaticamente ao expirar)
  useEffect(() => {
    if (!pix?.id) return;
    if (locked) return;

    const currentStatus = normalizeStatus(pix?.status);
    if (isTerminalPixStatus(currentStatus)) return;

    stopPolling();

    let stopped = false;

    // timer local de expiração (timeout por expiresAt)
    const ms = msUntil(pix?.expiresAt);
    if (ms != null) {
      if (ms <= 0) {
        // já passou do prazo: marca como EXPIRED localmente
        setPix((prev) => (prev ? { ...prev, status: "EXPIRED" } : prev));
        return;
      }

      expireTimerRef.current = setTimeout(() => {
        if (stopped) return;
        setPix((prev) =>
          prev && prev.id === pix.id && !isTerminalPixStatus(prev.status)
            ? { ...prev, status: "EXPIRED" }
            : prev,
        );
        stopPolling();
      }, ms + 250); // pequena folga para evitar edge de relógio
    }

    const tick = async () => {
      if (stopped) return;
      try {
        const st = await refreshStatus(pix.id);
        if (isTerminalPixStatus(st)) return; // PAID/EXPIRED/CANCELLED/REFUNDED
      } catch {
        // ignora e tenta de novo
      }
      if (stopped) return;
      pollRef.current = setTimeout(tick, 3000);
    };

    tick();

    return () => {
      stopped = true;
      stopPolling();
    };
  }, [
    pix?.id,
    pix?.expiresAt,
    pix?.status,
    locked,
    refreshStatus,
    stopPolling,
  ]);

  async function devSimulate() {
    if (!pix?.id) return;
    if (locked) return;

    const st = normalizeStatus(pix?.status);
    if (isTerminalPixStatus(st)) return;

    setPixErr("");
    try {
      const res = await api(
        `/p/${token}/pix/dev/simulate?pixId=${encodeURIComponent(pix.id)}`,
        { method: "POST" },
      );
      if (!res?.ok)
        throw new Error(res?.error || "Falha ao simular pagamento.");
      await refreshStatus(pix.id);
    } catch (e) {
      setPixErr(e?.message || "Falha ao simular pagamento.");
    }
  }

  if (loadingOffer) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-4 text-sm text-zinc-600">
          Carregando…
        </div>
      </div>
    );
  }

  if (offerErr) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {offerErr}
        </div>
        <div className="mx-auto mt-3 max-w-2xl">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/p/${token}`)}
          >
            Voltar para a proposta
          </Button>
        </div>
      </div>
    );
  }

  const status = normalizeStatus(pix?.status);

  const paidDetail = pix?.id
    ? `Valor: ${fmtBRL(pix?.amountCents ?? pix?.amount)}${
        view.requiresBooking && bookingId ? ` • Reserva: ${bookingId}` : ""
      }`
    : null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <SuccessModal
        open={showPaidModal}
        title="Pagamento aprovado"
        sub={
          paidAt
            ? `Pagamento confirmado em ${fmtDateTime(paidAt)}.`
            : "Pagamento confirmado."
        }
        detail={paidDetail}
        onConfirm={() => {
          setShowPaidModal(false);
          navigate(doneUrl, { replace: true });
        }}
      />

      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div>
            <img
              src={brand}
              alt="Luminor Pay"
              className="h-9 w-9 rounded-xl object-contain ring-1 ring-zinc-200 bg-white p-1"
            />
            <div className="text-sm font-semibold text-zinc-900">
              LuminorPay
            </div>
            <div className="text-xs text-zinc-500">Pagamento Pix</div>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              view.offerType === "product"
                ? navigate(`/p/${token}`)
                : navigate(`/p/${token}/schedule`)
            }
          >
            Voltar
          </Button>
        </div>
      </div>

      <div className="mx-auto grid max-w-2xl gap-4 px-4 py-6">
        {/* Resumo */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold text-zinc-500">Resumo</div>
          <div className="mt-1 text-xl font-semibold text-zinc-900">
            {view.title}
          </div>

          {view.customerName ? (
            <div className="mt-1 text-sm text-zinc-600">
              Para:{" "}
              <span className="font-semibold text-zinc-900">
                {view.customerName}
              </span>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border bg-zinc-50 p-4">
              <div className="text-xs font-semibold text-zinc-500">Total</div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">
                {fmtBRL(view.totalCents)}
              </div>
              {view.depositEnabled ? (
                <div className="mt-1 text-xs text-zinc-600">
                  Sinal:{" "}
                  <span className="font-semibold">
                    {fmtBRL(view.depositCents)}
                  </span>{" "}
                  ({view.depositPct}%)
                </div>
              ) : (
                <div className="mt-1 text-xs text-zinc-600">
                  Pagamento integral
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-emerald-50 p-4">
              <div className="text-xs font-semibold text-emerald-700">
                Valor a pagar agora
              </div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">
                {fmtBRL(view.amountToChargeCents)}
              </div>

              {view.requiresBooking ? (
                <div className="mt-1 text-xs text-zinc-600">
                  Reserva: {bookingId || "—"}
                </div>
              ) : (
                <div className="mt-1 text-xs text-zinc-600">
                  Produto (sem agendamento)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dados do pagador + gerar pix */}
        {!pix?.id ? (
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold text-zinc-900">
              Dados do pagador
            </div>
            <div className="mt-1 text-xs text-zinc-600">
              Email e CPF/CNPJ são obrigatórios para gerar o Pix.
            </div>

            {prefillHint ? (
              <div className="mt-2 text-[11px] text-zinc-500">
                Pré-preenchido com dados do cliente.
              </div>
            ) : null}

            <div className="mt-4 grid gap-3">
              <div>
                <div className="text-xs font-semibold text-zinc-600">Nome</div>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <div className="text-xs font-semibold text-zinc-600">
                  WhatsApp/Telefone
                </div>
                <Input
                  value={cellphone}
                  onChange={(e) => setCellphone(e.target.value)}
                  placeholder="(DDD) 99999-9999"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-zinc-600">
                    Email
                  </div>
                  <Input
                    value={email}
                    onChange={(e) => {
                      emailDirtyRef.current = true;
                      setEmail(e.target.value);
                    }}
                    placeholder="[email protected]"
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-600">
                    CPF/CNPJ (taxId)
                  </div>
                  <Input
                    value={taxId}
                    onChange={(e) => {
                      taxDirtyRef.current = true;
                      setTaxId(e.target.value);
                    }}
                    placeholder="Somente números"
                  />
                </div>
              </div>

              {pixErr ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {pixErr}
                </div>
              ) : null}

              <div className="mt-2 flex items-center justify-between">
                <div className="text-xs text-zinc-500">
                  Gera o QR Code e acompanha o status.
                </div>
                <Button
                  type="button"
                  onClick={createPix}
                  disabled={busy || quotaBlocked}
                >
                  {busy ? "Gerando…" : "Gerar Pix"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-900">
                  Pagamento Pix
                </div>
                <div className="mt-1 text-xs text-zinc-600">
                  Status: <span className="font-semibold">{status || "—"}</span>
                  {pix?.expiresAt ? (
                    <> • Expira em {fmtDateTime(pix.expiresAt)}</>
                  ) : null}
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-zinc-500">Valor</div>
                <div className="text-sm font-semibold text-zinc-900">
                  {fmtBRL(pix.amountCents)}
                </div>
              </div>
            </div>

            {pix?.brCodeBase64 ? (
              <div className="mt-4 flex flex-col items-center gap-3">
                <img
                  src={pix.brCodeBase64}
                  alt="QR Code Pix"
                  className="h-56 w-56 rounded-xl border bg-white p-3"
                />
                <div className="w-full rounded-xl border bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-600">
                    Copia e cola
                  </div>
                  <div className="mt-1 break-all text-xs text-zinc-800">
                    {pix.brCode}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={copyBrCode}
                    >
                      Copiar código Pix
                    </Button>

                    {import.meta.env.VITE_SHOW_DEV_SIMULATE === "1" &&
                    !locked ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={devSimulate}
                      >
                        Simular pagamento (DEV)
                      </Button>
                    ) : null}

                    {/* AJUSTAR ANTES                 
                    {import.meta.env.DEV && !locked ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={devSimulate}
                      >
                        Simular pagamento (DEV)
                      </Button>
                    ) : null} 
                     */}
                  </div>
                </div>
              </div>
            ) : null}

            {pixErr ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {pixErr}
              </div>
            ) : null}

            {status === "PENDING" ? (
              <div className="mt-4 rounded-xl border bg-amber-50 p-3 text-sm text-amber-900">
                Aguardando pagamento… (atualizando automaticamente até expirar)
              </div>
            ) : null}

            {status === "PAID" ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-sm font-semibold text-emerald-800">
                  Pagamento confirmado
                </div>
                <div className="mt-1 text-xs text-emerald-800">
                  Você pode concluir e voltar para a proposta.
                </div>
                <div className="mt-3">
                  <Button
                    type="button"
                    onClick={() => navigate(doneUrl, { replace: true })}
                  >
                    Concluir
                  </Button>
                </div>
              </div>
            ) : null}

            {/* ✅ CANCELLED */}
            {status === "CANCELLED" && !locked ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="text-sm font-semibold text-red-800">
                  Pix cancelado
                </div>
                <div className="mt-1 text-xs text-red-800">
                  Este Pix foi cancelado. Gere um novo Pix para continuar.
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      paidOnceRef.current = false;
                      setLocked(false);
                      setPaidAt(null);
                      setShowPaidModal(false);
                      setPix(null);
                      setPixErr("");
                    }}
                  >
                    Gerar novo Pix
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      view.offerType === "product"
                        ? navigate(`/p/${token}`)
                        : navigate(`/p/${token}/schedule`)
                    }
                  >
                    Voltar
                  </Button>
                </div>
              </div>
            ) : null}

            {/* ✅ REFUNDED */}
            {status === "REFUNDED" && !locked ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-semibold text-amber-900">
                  Pagamento estornado
                </div>
                <div className="mt-1 text-xs text-amber-900">
                  Este Pix consta como estornado (REFUNDED). Se precisar pagar
                  novamente, gere um novo Pix.
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      paidOnceRef.current = false;
                      setLocked(false);
                      setPaidAt(null);
                      setShowPaidModal(false);
                      setPix(null);
                      setPixErr("");
                    }}
                  >
                    Gerar novo Pix
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      view.offerType === "product"
                        ? navigate(`/p/${token}`)
                        : navigate(`/p/${token}/schedule`)
                    }
                  >
                    Voltar
                  </Button>
                </div>
              </div>
            ) : null}

            {/* ✅ EXPIRED (inclui timeout por expiresAt) */}
            {status === "EXPIRED" && !locked ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="text-sm font-semibold text-red-800">
                  Pix expirado
                </div>
                <div className="mt-1 text-xs text-red-800">
                  Gere um novo Pix para continuar.
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      paidOnceRef.current = false;
                      setLocked(false);
                      setPaidAt(null);
                      setShowPaidModal(false);
                      setPix(null);
                      setPixErr("");
                    }}
                  >
                    Gerar novo Pix
                  </Button>
                  {!locked ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        view.offerType === "product"
                          ? navigate(`/p/${token}`)
                          : navigate(`/p/${token}/schedule`)
                      }
                    >
                      Voltar
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
