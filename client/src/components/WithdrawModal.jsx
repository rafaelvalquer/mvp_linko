// src/components/WithdrawModal.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "./appui/Button.jsx";
import { Input } from "./appui/Input.jsx";
import {
  createWithdraw,
  getPayoutSettings,
  getWithdraw,
  getWithdrawConfig,
  getPayoutSettings,
  updatePayoutSettings,
} from "../app/withdrawApi.js";

function fmtBRL(cents) {
  const v = Number.isFinite(Number(cents)) ? Number(cents) : 0;
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
  if (s === "COMPLETED" || s === "SUCCESS") return "COMPLETE";
  return s;
}

function isTerminal(st) {
  const s = normalizeStatus(st);
  return (
    s === "COMPLETE" ||
    s === "PAID" ||
    s === "FAILED" ||
    s === "EXPIRED" ||
    s === "CANCELLED" ||
    s === "REFUNDED"
  );
}

function statusLabel(st) {
  const s = normalizeStatus(st);
  if (s === "PENDING" || s === "PROCESSING") return "Processando…";
  if (s === "COMPLETE" || s === "PAID") return "Concluído";
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
  // payout settings
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsErr, setSettingsErr] = useState("");

  const [walletAvailableCents, setWalletAvailableCents] = useState(0);

  const [payoutPixKeyType, setPayoutPixKeyType] = useState("CPF");
  const [payoutPixKeyMasked, setPayoutPixKeyMasked] = useState("");
  const [payoutPixKeyInput, setPayoutPixKeyInput] = useState("");

  const [autoPayoutEnabled, setAutoPayoutEnabled] = useState(false);
  const [autoPayoutMinBRL, setAutoPayoutMinBRL] = useState("");

  const [savingKey, setSavingKey] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);

  // saque manual
  const [amountBRL, setAmountBRL] = useState("");
  const [minNetCents, setMinNetCents] = useState(350);

  // status do withdraw
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [withdraw, setWithdraw] = useState(null);
  const pollRef = useRef(null);

  const amountCents = useMemo(() => parseBRLToCents(amountBRL), [amountBRL]);
  const autoMinCents = useMemo(
    () => parseBRLToCents(autoPayoutMinBRL),
    [autoPayoutMinBRL],
  );

  const hasPixKey = useMemo(
    () => !!String(payoutPixKeyMasked || "").trim(),
    [payoutPixKeyMasked],
  );

  const canWithdraw = useMemo(() => {
    if (!hasPixKey) return false;
    if (!Number.isFinite(amountCents) || amountCents <= 0) return false;
    if (amountCents < minNetCents) return false;
    if (amountCents > Number(walletAvailableCents || 0)) return false;
    return true;
  }, [hasPixKey, amountCents, minNetCents, walletAvailableCents]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsErr("");
    try {
      const d = await getPayoutSettings();
      setWalletAvailableCents(Number(d?.walletAvailableCents || 0));
      setPayoutPixKeyType(String(d?.payoutPixKeyType || "CPF"));
      setPayoutPixKeyMasked(String(d?.payoutPixKeyMasked || ""));
      setAutoPayoutEnabled(!!d?.autoPayoutEnabled);
      setAutoPayoutMinBRL(
        d?.autoPayoutMinCents
          ? String((Number(d.autoPayoutMinCents) / 100).toFixed(2)).replace(
              ".",
              ",",
            )
          : "",
      );
    } catch (e) {
      setSettingsErr(e?.message || "Falha ao carregar configurações.");
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopPolling();
      setBusy(false);
      setErr("");
      setSettingsErr("");
      setWithdraw(null);
      setAmountBRL("");
      setPayoutPixKeyInput("");
      return;
    }

    (async () => {
      try {
        const cfg = await getWithdrawConfig();
        if (Number.isFinite(Number(cfg?.minNetCents)))
          setMinNetCents(Number(cfg.minNetCents));
      } catch {
        // mantém defaults
      }
    })();

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
              // atualiza wallet (pode ter debitado)
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

  async function onSavePixKey() {
    try {
      setSettingsErr("");
      setSavingKey(true);

      const d = await updatePayoutSettings({
        payoutPixKeyType,
        payoutPixKey: payoutPixKeyInput,
      });

      setPayoutPixKeyType(String(d?.payoutPixKeyType || payoutPixKeyType));
      setPayoutPixKeyMasked(String(d?.payoutPixKeyMasked || ""));
      setWalletAvailableCents(Number(d?.walletAvailableCents || 0));
      setPayoutPixKeyInput("");
    } catch (e) {
      setSettingsErr(e?.message || "Falha ao salvar chave Pix.");
    } finally {
      setSavingKey(false);
    }
  }

  async function onSaveAuto(nextEnabled) {
    try {
      setSettingsErr("");
      setSavingAuto(true);

      const d = await updatePayoutSettings({
        autoPayoutEnabled: !!nextEnabled,
        autoPayoutMinCents: Number.isFinite(autoMinCents) ? autoMinCents : 0,
      });

      setAutoPayoutEnabled(!!d?.autoPayoutEnabled);
      setWalletAvailableCents(Number(d?.walletAvailableCents || 0));
    } catch (e) {
      setSettingsErr(e?.message || "Falha ao salvar transferência automática.");
    } finally {
      setSavingAuto(false);
    }
  }

  async function onConfirmWithdraw() {
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

      // atualiza wallet imediatamente (debita antes do gateway)
      await loadSettings();

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
      // recarrega wallet para refletir eventual estorno
      loadSettings();
    }
  }

  if (!open) return null;

  const locked = busy || (withdraw && normalizeStatus(withdraw.status) === "PENDING");

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
              Configure sua conta Pix e escolha entre transferência automática ou saque manual.
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
        <div className="mt-4 rounded-2xl border bg-zinc-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-zinc-600">Carteira</div>
              <div className="mt-1 text-lg font-bold text-zinc-900">
                {settingsLoading ? "…" : fmtBRL(walletAvailableCents)}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Saldo liberado após confirmação do pagamento (Pix pago).
              </div>
            </div>

            <Button
              variant="secondary"
              type="button"
              onClick={loadSettings}
              disabled={settingsLoading || busy}
            >
              Atualizar
            </Button>
          </div>

          {settingsErr ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {settingsErr}
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* CONTA PIX */}
          <div className="rounded-2xl border p-4">
            <div className="text-sm font-semibold text-zinc-900">Conta Pix</div>
            <div className="mt-1 text-xs text-zinc-500">
              Cadastre uma chave Pix para receber seus saques.
            </div>

            {payoutPixKeyMasked ? (
              <div className="mt-3 rounded-xl border bg-zinc-50 p-3">
                <div className="text-[11px] font-semibold text-zinc-600">
                  Chave cadastrada
                </div>
                <div className="mt-1 text-sm font-semibold text-zinc-900">
                  {payoutPixKeyType}: {payoutPixKeyMasked}
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Nenhuma chave Pix cadastrada.
              </div>
            )}

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-zinc-600">
                  Tipo de chave
                </div>
                <select
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 disabled:bg-zinc-100"
                  value={payoutPixKeyType}
                  onChange={(e) => setPayoutPixKeyType(e.target.value)}
                  disabled={savingKey || busy}
                >
                  {["CPF", "CNPJ", "PHONE", "EMAIL", "EVP"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs font-semibold text-zinc-600">Chave</div>
                <Input
                  value={payoutPixKeyInput}
                  onChange={(e) => setPayoutPixKeyInput(e.target.value)}
                  placeholder="Digite a chave Pix"
                  disabled={savingKey || busy}
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setPayoutPixKeyInput("")}
                disabled={savingKey || busy || !payoutPixKeyInput}
              >
                Limpar
              </Button>
              <Button
                type="button"
                onClick={onSavePixKey}
                disabled={savingKey || busy || !String(payoutPixKeyInput || "").trim()}
              >
                {savingKey ? "Salvando…" : "Salvar chave"}
              </Button>
            </div>
          </div>

          {/* AUTO TRANSFERÊNCIA */}
          <div className="rounded-2xl border p-4">
            <div className="text-sm font-semibold text-zinc-900">
              Transferência automática
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              Quando ativada, cada novo Pix confirmado dispara um saque automático do valor recém confirmado.
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border bg-zinc-50 p-3">
              <div>
                <div className="text-xs font-semibold text-zinc-700">
                  Transferir automaticamente ao receber pagamentos
                </div>
                {!hasPixKey ? (
                  <div className="mt-1 text-xs text-amber-800">
                    Cadastre uma chave Pix para habilitar.
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                disabled={!hasPixKey || savingAuto || busy}
                onClick={() => onSaveAuto(!autoPayoutEnabled)}
                className={[
                  "h-8 w-14 rounded-full border transition",
                  autoPayoutEnabled ? "bg-emerald-500 border-emerald-500" : "bg-zinc-200 border-zinc-300",
                  (!hasPixKey || savingAuto || busy) ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                ].join(" ")}
                aria-label="Alternar transferência automática"
              >
                <span
                  className={[
                    "block h-7 w-7 translate-x-0 rounded-full bg-white shadow transition",
                    autoPayoutEnabled ? "translate-x-6" : "translate-x-0",
                  ].join(" ")}
                />
              </button>
            </div>

            <div className="mt-3">
              <div className="text-xs font-semibold text-zinc-600">
                Valor mínimo para auto (opcional)
              </div>
              <Input
                value={autoPayoutMinBRL}
                onChange={(e) => setAutoPayoutMinBRL(e.target.value)}
                placeholder="Ex.: 0,00"
                disabled={savingAuto || busy || !hasPixKey}
                inputMode="decimal"
              />
              <div className="mt-1 text-[11px] text-zinc-500">
                Se definido, só transfere automaticamente quando o Pix confirmado for maior/igual ao mínimo.
              </div>

              <div className="mt-3 flex justify-end">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => onSaveAuto(autoPayoutEnabled)}
                  disabled={savingAuto || busy || !hasPixKey}
                >
                  {savingAuto ? "Salvando…" : "Salvar auto"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* SAQUE MANUAL */}
        <div className="mt-4 rounded-2xl border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-900">
                Saque manual
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Debita a carteira antes de chamar o gateway (segurança). Valor mínimo: {fmtBRL(minNetCents)}.
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-zinc-600">
                Valor (R$)
              </div>
              <Input
                value={amountBRL}
                onChange={(e) => setAmountBRL(e.target.value)}
                placeholder="Ex.: 100,00"
                disabled={locked}
                inputMode="decimal"
              />
              {!hasPixKey ? (
                <div className="mt-2 text-xs text-amber-800">
                  Cadastre uma chave Pix antes de sacar.
                </div>
              ) : null}
              {hasPixKey && amountCents > walletAvailableCents ? (
                <div className="mt-2 text-xs text-amber-800">
                  Saldo insuficiente. Disponível: {fmtBRL(walletAvailableCents)}.
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border bg-zinc-50 p-4">
              <div className="text-[11px] text-zinc-500">Você receberá</div>
              <div className="mt-1 text-lg font-bold text-zinc-900">
                {fmtBRL(amountCents)}
              </div>
              <div className="mt-2 text-[11px] text-zinc-500">
                Destino:{" "}
                {hasPixKey ? (
                  <span className="font-semibold text-zinc-800">
                    {payoutPixKeyType} {payoutPixKeyMasked}
                  </span>
                ) : (
                  <span className="text-amber-800 font-semibold">
                    sem chave Pix
                  </span>
                )}
              </div>
            </div>
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

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
              onClick={onConfirmWithdraw}
              disabled={!canWithdraw || busy}
            >
              {busy ? "Processando…" : "Confirmar saque"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
