// src/components/WithdrawModal.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "./appui/Button.jsx";
import { Input } from "./appui/Input.jsx";
import {
  createWithdraw,
  getPayoutSettings,
  getWithdraw,
  getWithdrawConfig,
  updatePayoutSettings,
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
  if (!s) return "";
  if (s === "CANCELED") return "CANCELLED";
  if (s === "COMPLETED" || s === "SUCCESS" || s === "PAID") return "COMPLETE";
  return s;
}

function isTerminal(st) {
  const s = normalizeStatus(st);
  return (
    s === "COMPLETE" ||
    s === "EXPIRED" ||
    s === "CANCELLED" ||
    s === "REFUNDED" ||
    s === "FAILED"
  );
}

function statusLabel(st) {
  const s = normalizeStatus(st);
  if (s === "PENDING" || s === "PROCESSING") return "Processando…";
  if (s === "COMPLETE") return "Concluído";
  if (s === "FAILED") return "Falhou";
  if (s === "EXPIRED") return "Expirado";
  if (s === "CANCELLED") return "Cancelado";
  if (s === "REFUNDED") return "Estornado";
  return s;
}

function parseBRLToCents(input) {
  const s = String(input || "").trim();
  if (!s) return 0;

  let t = s.replace(/[^\d.,-]/g, "");

  if (t.includes(",")) {
    t = t.replace(/\./g, "");
    t = t.replace(",", ".");
  }

  const n = Number(t);
  if (!Number.isFinite(n)) return 0;

  return Math.max(0, Math.round(n * 100));
}

function genIdemKey() {
  try {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  } catch {
    return String(Date.now());
  }
}

export default function WithdrawModal({ open, onClose, onCreated }) {
  // settings (server)
  const [walletAvailableCents, setWalletAvailableCents] = useState(0);
  const [payoutPixKeyType, setPayoutPixKeyType] = useState(null);
  const [payoutPixKeyMasked, setPayoutPixKeyMasked] = useState(null);
  const [autoPayoutEnabled, setAutoPayoutEnabled] = useState(false);
  const [autoPayoutMinCents, setAutoPayoutMinCents] = useState(0);

  // settings (form)
  const [pixType, setPixType] = useState("CPF");
  const [pixKey, setPixKey] = useState("");
  const [autoEnabledDraft, setAutoEnabledDraft] = useState(false);
  const [autoMinBRL, setAutoMinBRL] = useState("");

  // manual withdraw
  const [amountBRL, setAmountBRL] = useState("");

  const [minNetCents, setMinNetCents] = useState(350);

  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingPix, setSavingPix] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [withdraw, setWithdraw] = useState(null);
  const pollRef = useRef(null);

  const amountCents = useMemo(() => parseBRLToCents(amountBRL), [amountBRL]);

  const hasPixConfigured = useMemo(() => {
    return !!(payoutPixKeyType && payoutPixKeyMasked);
  }, [payoutPixKeyType, payoutPixKeyMasked]);

  const canManualWithdraw = useMemo(() => {
    if (!hasPixConfigured) return false;
    if (!amountCents || amountCents <= 0) return false;
    if (amountCents < minNetCents) return false;
    if (amountCents > walletAvailableCents) return false;
    return true;
  }, [hasPixConfigured, amountCents, minNetCents, walletAvailableCents]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    setErr("");
    setMsg("");

    try {
      const [cfg, s] = await Promise.all([
        getWithdrawConfig(),
        getPayoutSettings(),
      ]);
      if (Number.isFinite(Number(cfg?.minNetCents)))
        setMinNetCents(Number(cfg.minNetCents));

      setWalletAvailableCents(Number(s?.walletAvailableCents || 0));
      setPayoutPixKeyType(s?.payoutPixKeyType || null);
      setPayoutPixKeyMasked(s?.payoutPixKeyMasked || null);
      setAutoPayoutEnabled(!!s?.autoPayoutEnabled);
      setAutoPayoutMinCents(Number(s?.autoPayoutMinCents || 0));

      // drafts
      setPixType((s?.payoutPixKeyType || "CPF").toUpperCase());
      setAutoEnabledDraft(!!s?.autoPayoutEnabled);
      setAutoMinBRL(
        s?.autoPayoutMinCents
          ? String((Number(s.autoPayoutMinCents) / 100).toFixed(2)).replace(
              ".",
              ",",
            )
          : "",
      );
    } catch (e) {
      setErr(e?.message || "Falha ao carregar configurações de saque.");
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopPolling();
      setBusy(false);
      setErr("");
      setMsg("");
      setWithdraw(null);
      setPixType("CPF");
      setPixKey("");
      setAmountBRL("");
      setAutoEnabledDraft(false);
      setAutoMinBRL("");
      return;
    }

    loadSettings();
    return () => stopPolling();
  }, [open, stopPolling, loadSettings]);

  const pollStatus = useCallback(
    (externalId) => {
      stopPolling();

      pollRef.current = setInterval(async () => {
        try {
          const w = await getWithdraw(externalId);
          if (w) {
            setWithdraw(w);
            if (isTerminal(w.status)) {
              stopPolling();
              setBusy(false);
              onCreated?.(w);
              loadSettings();
            }
          }
        } catch {
          // mantém polling
        }
      }, 2500);
    },
    [stopPolling, onCreated, loadSettings],
  );

  async function onSavePix() {
    try {
      setErr("");
      setMsg("");
      setSavingPix(true);

      const payload = {
        payoutPixKeyType: pixType,
        payoutPixKey: pixKey,
      };

      const d = await updatePayoutSettings(payload);

      setPayoutPixKeyType(d?.payoutPixKeyType || null);
      setPayoutPixKeyMasked(d?.payoutPixKeyMasked || null);
      setAutoPayoutEnabled(!!d?.autoPayoutEnabled);
      setAutoEnabledDraft(!!d?.autoPayoutEnabled);

      setPixKey("");
      setMsg("Conta Pix atualizada.");
      loadSettings();
    } catch (e) {
      setErr(e?.message || "Falha ao salvar conta Pix.");
    } finally {
      setSavingPix(false);
    }
  }

  async function onSaveAuto() {
    try {
      setErr("");
      setMsg("");
      setSavingAuto(true);

      const minCents = parseBRLToCents(autoMinBRL);

      const d = await updatePayoutSettings({
        autoPayoutEnabled: autoEnabledDraft,
        autoPayoutMinCents: minCents,
      });

      setAutoPayoutEnabled(!!d?.autoPayoutEnabled);
      setAutoEnabledDraft(!!d?.autoPayoutEnabled);
      setAutoPayoutMinCents(Number(d?.autoPayoutMinCents || 0));
      setMsg("Configuração de transferência automática atualizada.");

      loadSettings();
    } catch (e) {
      setErr(e?.message || "Falha ao salvar transferência automática.");
    } finally {
      setSavingAuto(false);
    }
  }

  async function onConfirmWithdraw() {
    try {
      setErr("");
      setMsg("");
      setBusy(true);

      const d = await createWithdraw({
        amountCents,
        description: "Saque da LuminorPay",
        idempotencyKey: genIdemKey(),
      });

      if (Number.isFinite(Number(d?.walletAvailableCents))) {
        setWalletAvailableCents(Number(d.walletAvailableCents));
      }

      const w = d?.withdraw;
      setWithdraw(w || null);

      if (w?.status && !isTerminal(w.status)) {
        pollStatus(w.externalId);
      } else {
        setBusy(false);
        onCreated?.(w);
        loadSettings();
      }
    } catch (e) {
      setBusy(false);
      setErr(e?.message || "Falha ao solicitar saque.");
      loadSettings();
    }
  }

  if (!open) return null;

  const locked =
    busy || (withdraw && normalizeStatus(withdraw.status) === "PENDING");
  const disablePixInputs = locked || savingPix || loadingSettings;
  const disableAuto = locked || savingAuto || loadingSettings;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Saque"
      onClick={() => (!busy ? onClose?.() : null)}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-900">Saque</div>
            <div className="mt-1 text-sm text-zinc-600">
              Configure sua chave Pix e escolha entre saque manual ou
              transferência automática.
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

        {/* WALLET */}
        <div className="mt-4 rounded-2xl border bg-zinc-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Carteira disponível
            </div>
            <div className="text-lg font-bold text-zinc-900">
              {fmtBRL(walletAvailableCents)}
            </div>
          </div>
          <div className="text-xs text-zinc-500">
            O saldo aumenta apenas quando o pagamento é confirmado.
          </div>
        </div>

        {/* CONTA PIX */}
        <div className="mt-4 rounded-2xl border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-900">
                Conta Pix
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                Essa chave será usada para saques e transferências automáticas.
                Por segurança, exibimos apenas parte da chave.
              </div>
              {payoutPixKeyMasked ? (
                <div className="mt-2 text-xs text-zinc-700">
                  Chave atual:{" "}
                  <span className="font-semibold">{payoutPixKeyMasked}</span>
                </div>
              ) : (
                <div className="mt-2 text-xs text-amber-800">
                  Nenhuma chave cadastrada.
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={onSavePix}
              disabled={
                disablePixInputs || !pixType || !String(pixKey || "").trim()
              }
            >
              {savingPix ? "Salvando…" : "Salvar"}
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-zinc-600">
                Tipo de chave
              </div>
              <select
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 disabled:bg-zinc-100"
                value={pixType}
                onChange={(e) => setPixType(e.target.value)}
                disabled={disablePixInputs}
              >
                {["CPF", "CNPJ", "PHONE", "EMAIL", "EVP"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-xs font-semibold text-zinc-600">
                Chave Pix
              </div>
              <Input
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="Digite a chave (não será exibida depois)"
                disabled={disablePixInputs}
              />
            </div>
          </div>
        </div>

        {/* AUTO PAYOUT */}
        <div className="mt-4 rounded-2xl border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-900">
                Transferência automática
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                {autoEnabledDraft
                  ? "ON: Pagamentos confirmados serão transferidos automaticamente para sua chave Pix."
                  : "OFF: Pagamentos confirmados acumulam na carteira e você saca quando quiser."}
              </div>
              {!hasPixConfigured ? (
                <div className="mt-2 text-xs text-amber-800">
                  Cadastre uma chave Pix para ativar.
                </div>
              ) : null}
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={onSaveAuto}
              disabled={disableAuto || (!hasPixConfigured && autoEnabledDraft)}
            >
              {savingAuto ? "Salvando…" : "Salvar"}
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={autoEnabledDraft}
                onChange={(e) => setAutoEnabledDraft(e.target.checked)}
                disabled={disableAuto || !hasPixConfigured}
              />
              <span className="text-sm text-zinc-800">
                Transferir automaticamente ao receber pagamentos
              </span>
            </label>

            <div>
              <div className="text-xs font-semibold text-zinc-600">
                Mínimo para auto (R$)
              </div>
              <Input
                value={autoMinBRL}
                onChange={(e) => setAutoMinBRL(e.target.value)}
                placeholder="0,00"
                disabled={disableAuto}
                inputMode="decimal"
              />
              <div className="mt-1 text-[11px] text-zinc-500">
                Atual: {fmtBRL(autoPayoutMinCents)}
              </div>
            </div>
          </div>
        </div>

        {/* SAQUE MANUAL */}
        <div className="mt-4 rounded-2xl border p-4">
          <div className="text-sm font-semibold text-zinc-900">
            Saque manual
          </div>
          <div className="mt-1 text-xs text-zinc-600">
            Solicite um saque a qualquer momento, limitado ao saldo disponível.
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-zinc-600">
                Valor (R$)
              </div>
              <Input
                value={amountBRL}
                onChange={(e) => setAmountBRL(e.target.value)}
                placeholder="Ex.: 100,00"
                disabled={locked || loadingSettings}
                inputMode="decimal"
              />
              <div className="mt-1 text-[11px] text-zinc-500">
                Mínimo: {fmtBRL(minNetCents)} • Disponível:{" "}
                {fmtBRL(walletAvailableCents)}
              </div>
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                onClick={onConfirmWithdraw}
                disabled={!canManualWithdraw || busy || loadingSettings}
                className="w-full justify-center"
              >
                {busy ? "Processando…" : "Sacar"}
              </Button>
            </div>
          </div>

          {!hasPixConfigured ? (
            <div className="mt-3 text-xs text-amber-800">
              Cadastre uma chave Pix para habilitar saques.
            </div>
          ) : null}

          {amountCents > walletAvailableCents && amountCents > 0 ? (
            <div className="mt-3 text-xs text-amber-800">
              Valor acima do saldo disponível.
            </div>
          ) : null}

          {amountCents > 0 && amountCents < minNetCents ? (
            <div className="mt-3 text-xs text-amber-800">
              Valor mínimo: {fmtBRL(minNetCents)}.
            </div>
          ) : null}
        </div>

        {withdraw ? (
          <div className="mt-4 rounded-2xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-zinc-600">
                  Status do saque
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

        {loadingSettings ? (
          <div className="mt-4 text-xs text-zinc-500">
            Carregando configurações…
          </div>
        ) : null}

        {msg ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            {msg}
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
        </div>
      </div>
    </div>
  );
}
