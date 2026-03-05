// src/components/PixSettingsModal.jsx
import { useEffect, useMemo, useState } from "react";
import Button from "./appui/Button.jsx";
import { Input } from "./appui/Input.jsx";
import { getPayoutSettings, updatePayoutSettings } from "../app/withdrawApi.js";

const PIX_TYPES = ["CPF", "CNPJ", "PHONE", "EMAIL", "EVP"];

export default function PixSettingsModal({ open, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [payoutPixKeyType, setPayoutPixKeyType] = useState("CPF");
  const [payoutPixKeyMasked, setPayoutPixKeyMasked] = useState("");
  const [payoutPixKeyInput, setPayoutPixKeyInput] = useState("");

  const hasKey = useMemo(
    () => !!String(payoutPixKeyMasked || "").trim(),
    [payoutPixKeyMasked],
  );

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const d = await getPayoutSettings();
      setPayoutPixKeyType(String(d?.payoutPixKeyType || "CPF"));
      setPayoutPixKeyMasked(String(d?.payoutPixKeyMasked || ""));
      setPayoutPixKeyInput("");
    } catch (e) {
      setErr(e?.message || "Falha ao carregar configurações do Pix.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSave() {
    try {
      setErr("");
      setSaving(true);

      const d = await updatePayoutSettings({
        payoutPixKeyType,
        payoutPixKey: payoutPixKeyInput,
      });

      setPayoutPixKeyType(String(d?.payoutPixKeyType || payoutPixKeyType));
      setPayoutPixKeyMasked(String(d?.payoutPixKeyMasked || ""));
      setPayoutPixKeyInput("");

      onSaved?.(d);
    } catch (e) {
      setErr(e?.message || "Falha ao salvar chave Pix.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const locked = loading || saving;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Conta Pix"
      onClick={() => (!locked ? onClose?.() : null)}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-emerald-900">Conta Pix</h2>
            <p className="mt-1 text-xs text-emerald-700">
              Configure a chave Pix exibida no pagamento público
            </p>
          </div>
          <button
            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-60"
            onClick={() => (!locked ? onClose?.() : null)}
            type="button"
            aria-label="Fechar"
            disabled={locked}
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

        {/* Status */}
        <div className="px-5 py-4 bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium opacity-90">Status</p>
              <p className="mt-1 text-xl font-bold">
                {loading
                  ? "…"
                  : hasKey
                    ? "Chave configurada"
                    : "Chave pendente"}
              </p>
              <p className="mt-1 text-xs opacity-80">
                Pagamento cai direto no Pix do vendedor (sem saque na
                plataforma)
              </p>
            </div>
            <button
              className="px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-sm font-medium disabled:opacity-60"
              type="button"
              onClick={load}
              disabled={locked}
            >
              Atualizar
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4">
          {hasKey ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700 font-medium">
                Chave atual
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
                disabled={locked}
              >
                {PIX_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Nova chave
              </label>
              <Input
                value={payoutPixKeyInput}
                onChange={(e) => setPayoutPixKeyInput(e.target.value)}
                placeholder="CPF/CNPJ/Telefone/E-mail/EVP"
                disabled={locked}
                className="text-xs"
              />
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
            <div className="font-semibold text-zinc-900">Como funciona</div>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>O cliente paga para sua chave Pix.</li>
              <li>O cliente anexa o comprovante no link público.</li>
              <li>Você confirma manualmente o recebimento na proposta.</li>
            </ul>
          </div>

          {err ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 font-medium">
              ⚠️ {err}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-2">
          <button
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-xs font-medium hover:bg-white transition-colors disabled:opacity-60"
            type="button"
            onClick={() => (!locked ? onClose?.() : null)}
            disabled={locked}
          >
            Fechar
          </button>

          <Button
            onClick={onSave}
            disabled={locked || !String(payoutPixKeyInput || "").trim()}
            className="h-9 px-4 text-sm"
          >
            {saving ? "Salvando…" : "Salvar chave Pix"}
          </Button>
        </div>
      </div>
    </div>
  );
}
