// src/components/WithdrawModal.jsx
// Design Philosophy: Modern, compact, and efficient
// - Uses tabs to organize settings and manual withdrawal
// - Optimized spacing and layout to fit on smaller screens
// - Smooth animations and visual feedback
// - Gradient accents and refined shadows for polish

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "./appui/Button.jsx";
import { Input } from "./appui/Input.jsx";
import ModalShell from "./appui/ModalShell.jsx";
import {
  createWithdraw,
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

  const [withdraw, setWithdraw] = useState(null);
  const pollRef = useRef(null);

  // Tab state
  const [activeTab, setActiveTab] = useState("withdraw");

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
      setBusy(true);

      const d = await createWithdraw({
        amountCents,
        description: "Saque da LuminorPay",
      });

      setWithdraw(d || null);

      await loadSettings();

      if (d?.status && !isTerminal(d.status)) {
        pollStatus(d.externalId);
      } else {
        setBusy(false);
        onCreated?.(d);
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

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      locked={busy}
      panelClassName="max-w-lg"
    >
      <div
        className="w-full overflow-hidden rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.94))] shadow-[0_32px_80px_-42px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(9,15,28,0.94))] dark:shadow-[0_32px_80px_-42px_rgba(15,23,42,0.82)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(238,245,252,0.88))] px-5 py-4 dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.85),rgba(11,18,32,0.7))]">
          <div>
            <h2 className="bg-[linear-gradient(135deg,#2563eb,#14b8a6)] bg-clip-text text-lg font-black text-transparent">
              Saque
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Gerencie sua carteira e saques
            </p>
          </div>
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/85 text-slate-500 transition hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-cyan-400/20 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={() => (!busy ? onClose?.() : null)}
            type="button"
            aria-label="Fechar"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Wallet Balance Card */}
        <div className="bg-[linear-gradient(135deg,#0f172a,#1d4ed8,#0f766e)] px-5 py-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium opacity-90">Saldo disponível</p>
              <p className="mt-1 text-2xl font-bold">
                {settingsLoading ? "…" : fmtBRL(walletAvailableCents)}
              </p>
              <p className="mt-1 text-xs opacity-75">
                Liberado após confirmação do pagamento
              </p>
            </div>
            <button
              className="px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-sm font-medium"
              type="button"
              onClick={loadSettings}
              disabled={settingsLoading || busy}
            >
              Atualizar
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200/80 bg-slate-50/80 px-5 dark:border-white/10 dark:bg-white/5">
          <button
            onClick={() => setActiveTab("withdraw")}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "withdraw"
                ? "border-cyan-500 bg-white text-slate-950 dark:bg-white/10 dark:text-white"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Saque
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "settings"
                ? "border-cyan-500 bg-white text-slate-950 dark:bg-white/10 dark:text-white"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Configurações
          </button>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto px-5 py-4">
          {/* Withdraw Tab */}
          {activeTab === "withdraw" && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Valor (R$)
                </label>
                <Input
                  value={amountBRL}
                  onChange={(e) => setAmountBRL(e.target.value)}
                  placeholder="Ex.: 100,00"
                  disabled={locked}
                  inputMode="decimal"
                  className="w-full"
                />
                {!hasPixKey ? (
                  <p className="mt-2 text-xs text-amber-700 font-medium">
                    ⚠️ Cadastre uma chave Pix antes de sacar
                  </p>
                ) : null}
                {hasPixKey && amountCents > walletAvailableCents ? (
                  <p className="mt-2 text-xs text-amber-700 font-medium">
                    ⚠️ Saldo insuficiente. Disponível:{" "}
                    {fmtBRL(walletAvailableCents)}
                  </p>
                ) : null}
              </div>

              {/* Preview Card */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700 font-medium">
                  Você receberá
                </p>
                <p className="mt-1 text-xl font-bold text-emerald-900">
                  {fmtBRL(amountCents)}
                </p>
                <p className="mt-2 text-xs text-emerald-700">
                  Destino:{" "}
                  {hasPixKey ? (
                    <span className="font-semibold">
                      {payoutPixKeyType} {payoutPixKeyMasked}
                    </span>
                  ) : (
                    <span className="text-amber-700 font-semibold">
                      sem chave Pix
                    </span>
                  )}
                </p>
              </div>

              {/* Status Card */}
              {withdraw ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-blue-700 font-medium">
                        Status
                      </p>
                      <p className="mt-1 text-sm font-semibold text-blue-900">
                        {statusLabel(withdraw.status)}
                      </p>
                    </div>
                    {withdraw.receiptUrl &&
                    normalizeStatus(withdraw.status) === "COMPLETE" ? (
                      <button
                        className="px-3 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-medium transition-colors"
                        type="button"
                        onClick={() =>
                          window.open(
                            withdraw.receiptUrl,
                            "_blank",
                            "noopener,noreferrer",
                          )
                        }
                      >
                        Comprovante
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Error */}
              {err ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 font-medium">
                  ⚠️ {err}
                </div>
              ) : null}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="space-y-4 animate-fadeIn">
              {/* Pix Key Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  Chave Pix
                </h3>

                {payoutPixKeyMasked ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs text-emerald-700 font-medium">
                      Cadastrada
                    </p>
                    <p className="mt-1 text-sm font-semibold text-emerald-900">
                      {payoutPixKeyType}: {payoutPixKeyMasked}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 font-medium">
                    Nenhuma chave Pix cadastrada
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Tipo
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-300 disabled:bg-gray-100"
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
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Chave
                    </label>
                    <Input
                      value={payoutPixKeyInput}
                      onChange={(e) => setPayoutPixKeyInput(e.target.value)}
                      placeholder="Pix"
                      disabled={savingKey || busy}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                    type="button"
                    onClick={() => setPayoutPixKeyInput("")}
                    disabled={savingKey || busy || !payoutPixKeyInput}
                  >
                    Limpar
                  </button>
                  <Button
                    type="button"
                    onClick={onSavePixKey}
                    disabled={
                      savingKey ||
                      busy ||
                      !String(payoutPixKeyInput || "").trim()
                    }
                    className="text-xs"
                  >
                    {savingKey ? "Salvando…" : "Salvar"}
                  </Button>
                </div>
              </div>

              {/* Auto Transfer Section */}
              <div className="space-y-3 border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900">
                  Transferência automática
                </h3>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-700">
                      Transferir ao receber pagamentos
                    </p>
                    {!hasPixKey ? (
                      <p className="mt-1 text-xs text-amber-700">
                        Cadastre uma chave Pix para habilitar
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    disabled={!hasPixKey || savingAuto || busy}
                    onClick={() => onSaveAuto(!autoPayoutEnabled)}
                    className={`h-7 w-12 rounded-full border-2 transition-all ${
                      autoPayoutEnabled
                        ? "bg-emerald-500 border-emerald-500"
                        : "bg-gray-300 border-gray-300"
                    } ${!hasPixKey || savingAuto || busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    aria-label="Alternar transferência automática"
                  >
                    <span
                      className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                        autoPayoutEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Valor mínimo (opcional)
                  </label>
                  <Input
                    value={autoPayoutMinBRL}
                    onChange={(e) => setAutoPayoutMinBRL(e.target.value)}
                    placeholder="Ex.: 0,00"
                    disabled={savingAuto || busy || !hasPixKey}
                    inputMode="decimal"
                    className="text-xs"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Só transfere quando o Pix for ≥ ao mínimo
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => onSaveAuto(autoPayoutEnabled)}
                    disabled={savingAuto || busy || !hasPixKey}
                    className="text-xs"
                  >
                    {savingAuto ? "Salvando…" : "Salvar"}
                  </Button>
                </div>
              </div>

              {/* Settings Error */}
              {settingsErr ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 font-medium">
                  ⚠️ {settingsErr}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 border-t border-slate-200/80 bg-slate-50/70 px-5 py-4 dark:border-white/10 dark:bg-white/5">
          <Button
            variant="ghost"
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-sm"
          >
            Fechar
          </Button>
          {activeTab === "withdraw" && (
            <Button
              type="button"
              onClick={onConfirmWithdraw}
              disabled={!canWithdraw || busy}
              className="text-sm"
            >
              {busy ? "Processando…" : "Confirmar saque"}
            </Button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </ModalShell>
  );
}
