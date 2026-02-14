// src/components/WithdrawModal.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "./appui/Button.jsx";
import { Input } from "./appui/Input.jsx";
import {
  createWithdraw,
  getWithdraw,
  getWithdrawConfig,
} from "../app/withdrawApi.js";

function fmtBRL(cents) {
  const v = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v / 100);
}

function normalizeStatus(st) {
  const s = String(st || "")
    .trim()
    .toUpperCase();
  if (!s) return ""; // <-- IMPORTANTE: vazio quando ainda não existe saque
  if (s === "CANCELED") return "CANCELLED";
  if (s === "COMPLETED" || s === "SUCCESS" || s === "PAID") return "COMPLETE";
  return s;
}

function isTerminal(st) {
  const s = normalizeStatus(st);
  return (
    s === "COMPLETE" || s === "EXPIRED" || s === "CANCELLED" || s === "REFUNDED"
  );
}

function statusLabel(st) {
  const s = normalizeStatus(st);
  if (s === "PENDING") return "Processando…";
  if (s === "COMPLETE") return "Concluído";
  if (s === "EXPIRED") return "Expirado";
  if (s === "CANCELLED") return "Cancelado";
  if (s === "REFUNDED") return "Estornado";
  return s;
}

function parseBRLToCents(input) {
  const s = String(input || "").trim();
  if (!s) return 0;

  let t = s.replace(/[^\d.,-]/g, "");

  // se tiver vírgula, assume vírgula como decimal e remove pontos
  if (t.includes(",")) {
    t = t.replace(/\./g, "");
    t = t.replace(",", ".");
  }

  const n = Number(t);
  if (!Number.isFinite(n)) return 0;

  return Math.max(0, Math.round(n * 100));
}

export default function WithdrawModal({ open, onClose, onCreated }) {
  const [pixType, setPixType] = useState("CPF");
  const [pixKey, setPixKey] = useState("");
  const [amountBRL, setAmountBRL] = useState("");

  const [feePct, setFeePct] = useState(3.5);
  const [minNetCents, setMinNetCents] = useState(350);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [withdraw, setWithdraw] = useState(null);
  const pollRef = useRef(null);

  const grossCents = useMemo(() => parseBRLToCents(amountBRL), [amountBRL]);

  const feeCents = useMemo(
    () => Math.round(grossCents * (feePct / 100)),
    [grossCents, feePct],
  );

  const netCents = useMemo(() => grossCents - feeCents, [grossCents, feeCents]);

  const canConfirm = useMemo(() => {
    if (!pixType) return false;
    if (!String(pixKey || "").trim()) return false;
    if (!grossCents || grossCents <= 0) return false;
    if (netCents < minNetCents) return false;
    return true;
  }, [pixType, pixKey, grossCents, netCents, minNetCents]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stopPolling();
      setBusy(false);
      setErr("");
      setWithdraw(null);
      setPixType("CPF");
      setPixKey("");
      setAmountBRL("");
      return;
    }

    (async () => {
      try {
        const cfg = await getWithdrawConfig();
        if (Number.isFinite(Number(cfg?.feePct))) setFeePct(Number(cfg.feePct));
        if (Number.isFinite(Number(cfg?.minNetCents)))
          setMinNetCents(Number(cfg.minNetCents));
      } catch {
        // mantém defaults
      }
    })();

    return () => stopPolling();
  }, [open, stopPolling]);

  const pollStatus = useCallback(
    (externalId) => {
      stopPolling();

      pollRef.current = setInterval(async () => {
        try {
          const d = await getWithdraw(externalId);
          const w = d?.withdraw || null;
          if (w) {
            setWithdraw(w);
            if (isTerminal(w.status)) {
              stopPolling();
              setBusy(false);
              onCreated?.(w);
            }
          }
        } catch {
          // mantém polling
        }
      }, 2500);
    },
    [stopPolling, onCreated],
  );

  async function onConfirm() {
    try {
      setErr("");
      setBusy(true);

      const d = await createWithdraw({
        pixType,
        pixKey,
        grossAmountCents: grossCents,
        description: "Saque do PayLink",
      });

      const w = d?.withdraw;
      setWithdraw(w || null);

      if (w?.status && !isTerminal(w.status)) {
        pollStatus(w.externalId);
      } else {
        setBusy(false);
        onCreated?.(w);
      }
    } catch (e) {
      setBusy(false);
      setErr(e?.message || "Falha ao solicitar saque.");
    }
  }

  if (!open) return null;

  const locked =
    busy || (withdraw && normalizeStatus(withdraw.status) === "PENDING");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Solicitar saque"
      onClick={() => (!busy ? onClose?.() : null)}
    >
      <div
        className="w-full max-w-lg rounded-2xl border bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-900">Saque</div>
            <div className="mt-1 text-sm text-zinc-600">
              Transferência via Pix (valor líquido enviado ao gateway).
            </div>
          </div>

          <button
            className="rounded-xl px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
            onClick={() => (!busy ? onClose?.() : null)}
            type="button"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-zinc-600">
              Tipo de chave Pix
            </div>
            <select
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 disabled:bg-zinc-100"
              value={pixType}
              onChange={(e) => setPixType(e.target.value)}
              disabled={locked}
            >
              {["CPF", "CNPJ", "PHONE", "EMAIL", "RANDOM", "BR_CODE"].map(
                (t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <div className="text-xs font-semibold text-zinc-600">Chave</div>
            <Input
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="Digite a chave Pix"
              disabled={locked}
            />
          </div>

          <div className="sm:col-span-2">
            <div className="text-xs font-semibold text-zinc-600">
              Valor bruto (R$)
            </div>
            <Input
              value={amountBRL}
              onChange={(e) => setAmountBRL(e.target.value)}
              placeholder="Ex.: 100,00"
              disabled={locked}
              inputMode="decimal"
            />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border bg-zinc-50 p-4">
          <div className="text-xs text-zinc-600">
            Taxa da plataforma: <span className="font-semibold">{feePct}%</span>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <div className="text-[11px] text-zinc-500">Bruto</div>
              <div className="text-sm font-semibold">{fmtBRL(grossCents)}</div>
            </div>
            <div>
              <div className="text-[11px] text-zinc-500">Taxa</div>
              <div className="text-sm font-semibold">{fmtBRL(feeCents)}</div>
            </div>
            <div>
              <div className="text-[11px] text-zinc-500">Você receberá</div>
              <div className="text-sm font-semibold">{fmtBRL(netCents)}</div>
            </div>
          </div>

          {netCents < minNetCents ? (
            <div className="mt-3 text-xs text-amber-800">
              Valor líquido mínimo: {fmtBRL(minNetCents)}.
            </div>
          ) : null}
        </div>

        {withdraw ? (
          <div className="mt-4 rounded-2xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-zinc-600">
                  Status
                </div>
                <div className="mt-1 text-sm font-semibold text-zinc-900">
                  {statusLabel(withdraw.status)}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  ExternalId: {withdraw.externalId}
                </div>
              </div>

              {withdraw.receiptUrl &&
              normalizeStatus(withdraw.status) === "COMPLETE" ? (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() =>
                    window.open(
                      withdraw.receiptUrl,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  Abrir comprovante
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {err ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {err}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Fechar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || busy}
          >
            {busy ? "Processando…" : "Confirmar saque"}
          </Button>
        </div>
      </div>
    </div>
  );
}
