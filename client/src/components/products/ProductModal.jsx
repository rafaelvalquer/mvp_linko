import { useEffect, useMemo, useState } from "react";

import Button from "../appui/Button.jsx";
import ModalShell from "../appui/ModalShell.jsx";

function fmtBRL(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents) || 0) / 100);
}

function parseBRLToCents(input) {
  const value = String(input || "").trim();
  if (!value) return 0;
  const normalized = value.replace(/./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export default function ProductModal({
  open,
  mode,
  initial,
  onClose,
  onSave,
}) {
  const isEdit = mode === "edit";

  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr("");
    setBusy(false);

    setProductId(String(initial?.productId || ""));
    setName(String(initial?.name || ""));
    setDescription(String(initial?.description || ""));
    setPriceInput(
      initial?.priceCents != null
        ? String((Number(initial.priceCents) / 100).toFixed(2)).replace(
            ".",
            ",",
          )
        : "",
    );
    setImageFile(null);
  }, [open, initial]);

  const previewUrl = useMemo(() => {
    if (imageFile) return URL.createObjectURL(imageFile);
    return initial?.imageUrl || "";
  }, [imageFile, initial?.imageUrl]);

  useEffect(() => {
    return () => {
      if (imageFile && previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [imageFile, previewUrl]);

  if (!open) return null;

  async function submit(event) {
    event.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const priceCents = parseBRLToCents(priceInput);
      const payload = {
        productId: String(productId || "").trim(),
        name: String(name || "").trim(),
        description: String(description || "").trim(),
        priceCents,
        imageFile,
      };

      if (!payload.name) throw new Error("Nome e obrigatorio.");
      if (!isEdit && !payload.productId) {
        throw new Error("ID do produto e obrigatorio.");
      }

      await onSave(payload);
      onClose?.();
    } catch (error) {
      setErr(error?.message || "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      locked={busy}
      panelClassName="max-w-lg"
    >
      <div className="relative w-full rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.94))] p-5 shadow-[0_32px_80px_-42px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(9,15,28,0.94))] dark:shadow-[0_32px_80px_-42px_rgba(15,23,42,0.82)]">
        <div className="text-lg font-bold text-slate-950 dark:text-white">
          {isEdit ? "Editar produto" : "Novo produto"}
        </div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-300">
          {isEdit
            ? "Atualize as informacoes do produto no catalogo do workspace."
            : "Cadastre um novo produto no catalogo do workspace."}
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100">
            {err}
          </div>
        ) : null}

        <form className="mt-4 space-y-3" onSubmit={submit}>
          <div>
            <label className="text-sm text-slate-700 dark:text-slate-300">ID do produto</label>
            <input
              className="mt-1 w-full rounded-2xl border border-slate-200/80 bg-white/92 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/30 disabled:bg-slate-50 dark:border-white/10 dark:bg-white/6 dark:text-slate-100 dark:disabled:bg-white/5"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              disabled={isEdit}
              placeholder="Ex.: PROD-001"
              required={!isEdit}
            />
            {isEdit ? (
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                O ID nao pode ser alterado.
              </div>
            ) : null}
          </div>

          <div>
            <label className="text-sm text-slate-700 dark:text-slate-300">Nome do produto</label>
            <input
              className="mt-1 w-full rounded-2xl border border-slate-200/80 bg-white/92 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/30 dark:border-white/10 dark:bg-white/6 dark:text-slate-100"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-sm text-slate-700 dark:text-slate-300">Descricao</label>
            <textarea
              className="mt-1 w-full rounded-2xl border border-slate-200/80 bg-white/92 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/30 dark:border-white/10 dark:bg-white/6 dark:text-slate-100"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Opcional"
            />
          </div>

          <div>
            <label className="text-sm text-slate-700 dark:text-slate-300">Valor</label>
            <input
              className="mt-1 w-full rounded-2xl border border-slate-200/80 bg-white/92 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/30 dark:border-white/10 dark:bg-white/6 dark:text-slate-100"
              value={priceInput}
              onChange={(event) => setPriceInput(event.target.value)}
              placeholder="0,00"
            />
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Previa: <span className="font-semibold">{fmtBRL(parseBRLToCents(priceInput))}</span>
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-700 dark:text-slate-300">Imagem do produto</label>
            <div className="mt-2 flex items-start gap-3">
              <div className="h-24 w-24 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-400 dark:text-slate-500">
                    Sem foto
                  </div>
                )}
              </div>

              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-2xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800 dark:text-slate-300 dark:file:bg-white dark:file:text-slate-950 dark:hover:file:bg-slate-100"
                />
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  PNG, JPG, WebP ou GIF ate 3MB.
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => !busy && onClose?.()}
            >
              Voltar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </div>
    </ModalShell>
  );
}
