// src/pages/PublicPixPayment.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../app/api.js";
import Button from "../components/appui/Button.jsx";
import { Input } from "../components/appui/Input.jsx";

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
    if (open) {
      // foco acessível no botão principal
      setTimeout(() => btnRef.current?.focus?.(), 0);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Pagamento aprovado"
    >
      <div
        className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-lg"
        // não fecha ao clicar fora
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

export default function PublicPixPayment() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();

  const bookingId = search.get("bookingId") || "";

  const [offer, setOffer] = useState(null);
  const [offerErr, setOfferErr] = useState("");
  const [loadingOffer, setLoadingOffer] = useState(true);

  const [name, setName] = useState("");
  const [cellphone, setCellphone] = useState("");
  const [email, setEmail] = useState("");
  const [taxId, setTaxId] = useState("");

  const [busy, setBusy] = useState(false);
  const [pixErr, setPixErr] = useState("");

  const [pix, setPix] = useState(null); // {id,status,brCode,brCodeBase64,expiresAt,amountCents}
  const pollRef = useRef(null);

  const [showPaidModal, setShowPaidModal] = useState(false);
  const [locked, setLocked] = useState(false);
  const [paidAt, setPaidAt] = useState(null);

  const paidOnceRef = useRef(false);

  const doneUrl = useMemo(() => {
    const q = bookingId ? `?bookingId=${encodeURIComponent(bookingId)}` : "";
    return `/p/${token}/done${q}`;
  }, [token, bookingId]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
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

  useEffect(() => {
    if (!bookingId) {
      setOfferErr(
        "bookingId ausente na URL. Volte e crie a reserva novamente.",
      );
      setLoadingOffer(false);
      return;
    }

    setLoadingOffer(true);
    setOfferErr("");
    api(`/p/${token}`)
      .then((d) => {
        setOffer(d.offer);
        setName(d.offer?.customerName || "");
        setCellphone(
          d.offer?.customerWhatsApp || d.offer?.customerCellphone || "",
        );
        const st = String(d.offer?.status || "").toUpperCase();
        if (st === "PAID" || st === "CONFIRMED") {
          navigate(doneUrl, { replace: true });
          return;
        }
      })
      .catch((e) => {
        setOfferErr(e?.message || "Falha ao carregar proposta.");
        setOffer(null);
      })
      .finally(() => setLoadingOffer(false));
  }, [token, bookingId]);

  const view = useMemo(() => {
    const o = offer || {};

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
      title: o.title || "Pagamento",
      customerName: o.customerName || "",
      totalCents,
      depositEnabled,
      depositPct,
      depositCents,
      amountToChargeCents,
    };
  }, [offer]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, []);

  async function createPix() {
    setPixErr("");

    if (!bookingId) {
      setPixErr("bookingId ausente.");
      return;
    }

    const payload = {
      bookingId,
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
        amountCents: Number.isFinite(res?.pix?.amount)
          ? res.pix.amount
          : undefined,
      };

      setPix(mapped);

      const st = String(mapped?.status || "").toUpperCase();
      if (st === "PAID") {
        markPaidOnce(mapped, res?.paidAt);
      }
    } catch (e) {
      setPix(null);
      setPixErr(e?.message || "Falha ao gerar Pix.");
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
      // fallback simples
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }

  async function refreshStatus(pixId) {
    const d = await api(
      `/p/${token}/pix/status?pixId=${encodeURIComponent(pixId)}`,
    );

    const p = d?.pix || {};
    const st = String(p.status || "").toUpperCase();

    setPix((prev) =>
      prev
        ? {
            ...prev,
            ...p,
            amountCents: Number.isFinite(p.amount)
              ? p.amount
              : prev.amountCents,
          }
        : prev,
    );

    if (st === "PAID") {
      markPaidOnce(p, d?.paidAt);
    }

    return st;
  }

  useEffect(() => {
    if (!pix?.id) return;
    if (locked) return;

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;

    // dispara uma checagem imediata e depois a cada 3s
    let stopped = false;

    (async () => {
      try {
        const st = await refreshStatus(pix.id);
        if (st === "PAID" || st === "EXPIRED") return;
        if (stopped) return;

        pollRef.current = setInterval(async () => {
          try {
            const s = await refreshStatus(pix.id);
            if (s === "PAID" || s === "EXPIRED") {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
            }
          } catch {
            // silencioso: mantém polling
          }
        }, 3000);
      } catch {
        // silencioso: mantém UI
      }
    })();

    return () => {
      stopped = true;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [pix?.id, token, locked]);

  async function devSimulate() {
    if (!pix?.id) return;
    if (locked) return;

    setPixErr("");
    try {
      const res = await api(
        `/p/${token}/pix/dev/simulate?pixId=${encodeURIComponent(pix.id)}`,
        {
          method: "POST",
        },
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
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const status = String(pix?.status || "").toUpperCase();

  const paidDetail =
    pix?.id && bookingId
      ? `Valor: ${fmtBRL(pix?.amountCents ?? pix?.amount)} • Reserva: ${bookingId}`
      : pix?.id
        ? `Valor: ${fmtBRL(pix?.amountCents ?? pix?.amount)}`
        : null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">PayLink</div>
            <div className="text-xs text-zinc-500">
              Pagamento Pix • AbacatePay
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/p/${token}/schedule`)}
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
              <div className="mt-1 text-xs text-zinc-600">
                Reserva: {bookingId}
              </div>
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
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="[email protected]"
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-600">
                    CPF/CNPJ (taxId)
                  </div>
                  <Input
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
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
                <Button type="button" onClick={createPix} disabled={busy}>
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

                    {import.meta.env.DEV && !locked ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={devSimulate}
                      >
                        Simular pagamento (DEV)
                      </Button>
                    ) : null}
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
                Aguardando pagamento… (atualizando automaticamente)
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
                      onClick={() => navigate(`/p/${token}/schedule`)}
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
