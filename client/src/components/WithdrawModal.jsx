// src/components/WithdrawModal.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "./appui/Button.jsx";
import { Input } from "./appui/Input.jsx";
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
  // === ESTADOS ===
  const [activeTab, setActiveTab] = useState("manual"); // 'manual' | 'pix' | 'auto'

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

  const [amountBRL, setAmountBRL] = useState("");
  const [minNetCents, setMinNetCents] = useState(350);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
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

  // === FUNÇÕES ===
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
      setActiveTab("manual"); // Resetar a aba ao fechar
      return;
    }

    (async () => {
      try {
        const cfg = await getWithdrawConfig();
        if (Number.isFinite(Number(cfg?.minNetCents)))
          setMinNetCents(Number(cfg.minNetCents));
      } catch {}
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
        } catch {}
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
      const w = d?.withdraw;
      setWithdraw(w || null);
      await loadSettings();

      if (w?.status && !isTerminal(w.status)) {
        pollStatus(w.externalId);
      } else {
        setBusy(false);
        onCreated?.(w);
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Saque"
      onClick={() => (!busy ? onClose?.() : null)}
    >
      <div
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-all duration-300 scale-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER MODERNO */}
        <div className="flex items-center justify-between border-b px-6 py-5 bg-zinc-50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 flex items-center justify-center text-3xl shadow-inner">
              💸
            </div>
            <div>
              <div className="text-2xl font-semibold text-zinc-900 tracking-tight">
                Saque
              </div>
              <p className="text-sm text-zinc-600 -mt-0.5">
                Configure Pix e retire seu saldo
              </p>
            </div>
          </div>

          <button
            onClick={() => (!busy ? onClose?.() : null)}
            className="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 transition-all active:scale-90"
            disabled={busy}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* CONTEÚDO ROLÁVEL */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* WALLET EM DESTAQUE */}
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="uppercase text-xs font-semibold tracking-widest text-emerald-700">
                  Saldo disponível
                </div>
                <div className="mt-1 text-4xl font-bold text-zinc-900 tracking-tighter">
                  {settingsLoading ? "R$ •••" : fmtBRL(walletAvailableCents)}
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={loadSettings}
                disabled={settingsLoading || busy}
              >
                Atualizar
              </Button>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Liberado após confirmação do pagamento (Pix pago)
            </p>
          </div>

          {settingsErr && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {settingsErr}
            </div>
          )}

          {/* TAB NAVIGATION */}
          <div className="flex p-1 bg-zinc-100 rounded-xl">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === "manual"
                  ? "bg-white shadow text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
              onClick={() => setActiveTab("manual")}
              disabled={busy}
            >
              Saque Manual
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === "pix"
                  ? "bg-white shadow text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
              onClick={() => setActiveTab("pix")}
              disabled={busy}
            >
              Chave Pix
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === "auto"
                  ? "bg-white shadow text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
              onClick={() => setActiveTab("auto")}
              disabled={busy}
            >
              Automático
            </button>
          </div>

          {/* CONTEÚDO DAS ABAS */}

          {/* TAB: SAQUE MANUAL */}
          {activeTab === "manual" && (
            <div className="rounded-2xl border border-zinc-200 p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="font-semibold text-zinc-900 text-lg mb-1">
                Solicitar Saque
              </div>
              <p className="text-xs text-zinc-500 mb-5">
                Mínimo: {fmtBRL(minNetCents)}
              </p>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-5">
                <div className="sm:col-span-3">
                  <div className="text-xs font-semibold text-zinc-600 mb-1">
                    Valor (R$)
                  </div>
                  <Input
                    value={amountBRL}
                    onChange={(e) => setAmountBRL(e.target.value)}
                    placeholder="100,00"
                    disabled={locked}
                    inputMode="decimal"
                    className="text-lg py-3"
                  />
                  {!hasPixKey && (
                    <p className="mt-2 text-xs text-amber-800">
                      Cadastre uma chave Pix antes
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2 rounded-2xl bg-zinc-50 border p-5">
                  <div className="text-xs text-zinc-500">Você receberá</div>
                  <div className="mt-1 text-3xl font-bold text-zinc-900">
                    {fmtBRL(amountCents)}
                  </div>
                  <div className="mt-3 text-sm text-zinc-600">
                    Para:{" "}
                    {hasPixKey ? (
                      <span className="font-semibold">
                        {payoutPixKeyType} {payoutPixKeyMasked}
                      </span>
                    ) : (
                      <span className="text-amber-800">sem chave</span>
                    )}
                  </div>
                </div>
              </div>

              {withdraw && (
                <div className="mt-6 pt-6 border-t">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-xs text-zinc-600">Status</div>
                      <div className="text-lg font-semibold text-zinc-900">
                        {statusLabel(withdraw.status)}
                      </div>
                    </div>
                    {withdraw.receiptUrl &&
                      normalizeStatus(withdraw.status) === "COMPLETE" && (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            window.open(
                              withdraw.receiptUrl,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                        >
                          Ver comprovante
                        </Button>
                      )}
                  </div>
                </div>
              )}

              {err && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  {err}
                </div>
              )}
            </div>
          )}

          {/* TAB: CHAVE PIX */}
          {activeTab === "pix" && (
            <div className="rounded-2xl border border-zinc-200 p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="text-lg font-semibold text-zinc-900 mb-1">
                Conta Pix
              </div>
              <p className="text-xs text-zinc-500 mb-4">
                Cadastre sua chave para receber saques
              </p>

              {payoutPixKeyMasked ? (
                <div className="mb-5 rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                  <div className="text-xs font-semibold text-emerald-700">
                    ✓ Chave cadastrada
                  </div>
                  <div className="mt-1 font-semibold text-zinc-900">
                    {payoutPixKeyType}: {payoutPixKeyMasked}
                  </div>
                </div>
              ) : (
                <div className="mb-5 rounded-xl bg-amber-50 p-4 text-amber-800 text-sm border border-amber-100">
                  Nenhuma chave Pix cadastrada.
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <div className="text-xs font-semibold text-zinc-600 mb-1">
                    Tipo de chave
                  </div>
                  <select
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                  <div className="text-xs font-semibold text-zinc-600 mb-1">
                    Chave Pix
                  </div>
                  <Input
                    value={payoutPixKeyInput}
                    onChange={(e) => setPayoutPixKeyInput(e.target.value)}
                    placeholder="Digite a chave"
                    disabled={savingKey || busy}
                  />
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setPayoutPixKeyInput("")}
                  disabled={savingKey || busy || !payoutPixKeyInput}
                >
                  Limpar
                </Button>
                <Button
                  className="flex-1"
                  onClick={onSavePixKey}
                  disabled={savingKey || busy || !payoutPixKeyInput?.trim()}
                >
                  {savingKey ? "Salvando…" : "Salvar chave"}
                </Button>
              </div>
            </div>
          )}

          {/* TAB: AUTOMÁTICO */}
          {activeTab === "auto" && (
            <div className="rounded-2xl border border-zinc-200 p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="text-lg font-semibold text-zinc-900 mb-1">
                Transferência automática
              </div>
              <p className="text-xs text-zinc-500 mb-4">
                Saque automático ao receber Pix
              </p>

              <div className="flex items-center justify-between rounded-2xl border bg-zinc-50 p-4 mb-5">
                <div>
                  <div className="font-medium">
                    Ativar transferência automática
                  </div>
                  {!hasPixKey && (
                    <div className="text-amber-700 text-xs mt-1">
                      Cadastre uma chave Pix primeiro
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!hasPixKey || savingAuto || busy}
                  onClick={() => onSaveAuto(!autoPayoutEnabled)}
                  className={`relative h-8 w-14 rounded-full border-2 transition-all duration-300 ${
                    autoPayoutEnabled
                      ? "bg-emerald-500 border-emerald-500"
                      : "bg-zinc-200 border-zinc-300"
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-7 w-7 rounded-full bg-white shadow transition-all duration-300 ${
                      autoPayoutEnabled ? "translate-x-6" : ""
                    }`}
                  />
                </button>
              </div>

              <div>
                <div className="text-xs font-semibold text-zinc-600 mb-1">
                  Valor mínimo (opcional)
                </div>
                <Input
                  value={autoPayoutMinBRL}
                  onChange={(e) => setAutoPayoutMinBRL(e.target.value)}
                  placeholder="0,00"
                  disabled={savingAuto || busy || !hasPixKey}
                  inputMode="decimal"
                />
                <p className="mt-2 text-[11px] text-zinc-500">
                  Deixe em branco para qualquer valor
                </p>
              </div>

              <div className="mt-6">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => onSaveAuto(autoPayoutEnabled)}
                  disabled={savingAuto || busy || !hasPixKey}
                >
                  {savingAuto ? "Salvando…" : "Salvar configuração"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER FIXO */}
        <div className="border-t px-6 py-5 flex gap-3 bg-white">
          <Button
            variant="ghost"
            className={activeTab === "manual" ? "flex-1" : "w-full"}
            onClick={onClose}
            disabled={busy}
          >
            Fechar
          </Button>

          {/* Botão de confirmar saque só aparece na aba de saque manual */}
          {activeTab === "manual" && (
            <Button
              className="flex-1 font-semibold"
              onClick={onConfirmWithdraw}
              disabled={!canWithdraw || busy}
            >
              {busy ? "Processando…" : "Confirmar saque"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
