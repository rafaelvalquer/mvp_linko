//src/components/PixSettingsModal.jsx
import { useEffect, useMemo, useState } from "react";

import Button from "./appui/Button.jsx";
import ModalShell from "./appui/ModalShell.jsx";
import { Input } from "./appui/Input.jsx";
import { getPayoutSettings, updatePayoutSettings } from "../app/withdrawApi.js";

const PIX_TYPES = ["CPF", "CNPJ", "PHONE", "EMAIL", "EVP"];

export default function PixSettingsModal({
  open,
  onClose,
  onSaved,
  contextTitle = "",
  contextDescription = "",
}) {
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

  const hasContext = useMemo(
    () =>
      !!String(contextTitle || "").trim() ||
      !!String(contextDescription || "").trim(),
    [contextTitle, contextDescription],
  );

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = await getPayoutSettings();
      setPayoutPixKeyType(String(data?.payoutPixKeyType || "CPF"));
      setPayoutPixKeyMasked(String(data?.payoutPixKeyMasked || ""));
      setPayoutPixKeyInput("");
    } catch (error) {
      setErr(error?.message || "Falha ao carregar configuracoes do Pix.");
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

      const data = await updatePayoutSettings({
        payoutPixKeyType,
        payoutPixKey: payoutPixKeyInput,
      });

      setPayoutPixKeyType(String(data?.payoutPixKeyType || payoutPixKeyType));
      setPayoutPixKeyMasked(String(data?.payoutPixKeyMasked || ""));
      setPayoutPixKeyInput("");

      await onSaved?.(data);
    } catch (error) {
      setErr(error?.message || "Falha ao salvar chave Pix.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const locked = loading || saving;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      locked={locked}
      panelClassName="max-w-2xl"
      contentClassName="pt-6 sm:pt-10"
    >
      <div
        className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.94))] shadow-[0_32px_80px_-42px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(9,15,28,0.94))] dark:shadow-[0_32px_80px_-42px_rgba(15,23,42,0.82)]"
        aria-label="Conta Pix"
      >
        <div className="border-b border-slate-200/80 px-6 py-5 dark:border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Recebimento
              </div>
              <h2 className="mt-2 bg-[linear-gradient(135deg,#2563eb,#14b8a6)] bg-clip-text text-2xl font-black tracking-tight text-transparent">
                Conta Pix
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Configure a chave exibida para o cliente pagar e enviar o
                comprovante no mesmo fluxo.
              </p>
            </div>

            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/90 text-slate-500 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-cyan-400/20 dark:hover:bg-white/10 dark:hover:text-white"
              onClick={() => (!locked ? onClose?.() : null)}
              type="button"
              aria-label="Fechar"
              disabled={locked}
            >
              <svg
                className="h-5 w-5"
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
        </div>

        <div className="px-6 py-5">
          <div className="rounded-[28px] bg-[linear-gradient(135deg,#0f172a,#1d4ed8,#0f766e)] p-5 text-white shadow-[0_24px_50px_-28px_rgba(15,23,42,0.7)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-300">
                  Status atual
                </p>
                <p className="mt-2 text-2xl font-black tracking-[-0.03em]">
                  {loading
                    ? "Carregando..."
                    : hasKey
                      ? "Chave configurada"
                      : "Chave pendente"}
                </p>
                <p className="mt-2 text-sm text-slate-200">
                  O valor pago vai direto para a chave cadastrada no seu fluxo
                  de venda.
                </p>
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={load}
                disabled={locked}
                className="min-w-[132px] dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              >
                Atualizar
              </Button>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {hasContext ? (
              <div className="rounded-[24px] border border-amber-200/80 bg-amber-50 p-4 dark:border-amber-400/20 dark:bg-amber-400/10">
                {contextTitle ? (
                  <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    {contextTitle}
                  </div>
                ) : null}
                {contextDescription ? (
                  <div className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                    {contextDescription}
                  </div>
                ) : null}
              </div>
            ) : null}

            {hasKey ? (
              <div className="rounded-[24px] border border-emerald-200/80 bg-emerald-50/90 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/10">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">
                  Chave atual
                </p>
                <p className="mt-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  {payoutPixKeyType}: {payoutPixKeyMasked}
                </p>
              </div>
            ) : (
              <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/90 p-4 text-sm font-medium text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                Nenhuma chave Pix cadastrada.
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Tipo da chave
                </label>
                <select
                  className="h-12 w-full rounded-2xl border border-slate-200/80 bg-white/92 px-3.5 text-sm text-slate-900 shadow-[0_14px_24px_-22px_rgba(15,23,42,0.2)] outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/30 dark:border-white/10 dark:bg-white/6 dark:text-slate-100 dark:shadow-none dark:focus:border-cyan-400/30 dark:focus:ring-cyan-400/20"
                  value={payoutPixKeyType}
                  onChange={(event) => setPayoutPixKeyType(event.target.value)}
                  disabled={locked}
                >
                  {PIX_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Nova chave
                </label>
                <Input
                  value={payoutPixKeyInput}
                  onChange={(event) => setPayoutPixKeyInput(event.target.value)}
                  placeholder="CPF, CNPJ, telefone, email ou EVP"
                  disabled={locked}
                  className="h-12"
                />
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Como funciona
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li>O cliente paga para a sua chave Pix.</li>
                <li>O comprovante continua sendo anexado no link publico.</li>
                <li>
                  Voce confirma o recebimento na proposta, mantendo o fluxo
                  atual.
                </li>
              </ul>
            </div>

            {err ? (
              <div className="rounded-[24px] border border-red-200/80 bg-red-50 p-4 text-sm font-medium text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100">
                {err}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200/80 px-6 py-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
          <Button
            type="button"
            variant="ghost"
            onClick={() => (!locked ? onClose?.() : null)}
            disabled={locked}
          >
            Fechar
          </Button>

          <Button
            onClick={onSave}
            disabled={locked || !String(payoutPixKeyInput || "").trim()}
            className="h-11 px-5"
          >
            {saving ? "Salvando..." : "Salvar chave Pix"}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
