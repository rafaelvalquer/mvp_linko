import { useEffect, useMemo, useState } from "react";
import Button from "../appui/Button.jsx";

function fmtBRL(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents) || 0) / 100);
}

function parseBRLToCents(input) {
  const s = String(input || "").trim();
  if (!s) return 0;
  // aceita "10,50" ou "10.50" ou "1.234,56"
  const norm = s.replace(/\./g, "").replace(",", ".");
  const n = Number(norm);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export default function ProductModal({
  open,
  mode, // "create" | "edit"
  initial, // { _id, productId, name, description, priceCents, imageUrl }
  onClose,
  onSave, // (payload) => Promise
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
      if (imageFile) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFile]);

  if (!open) return null;

  async function submit(e) {
    e.preventDefault();
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

      if (!payload.name) throw new Error("Nome é obrigatório.");
      if (!isEdit && !payload.productId)
        throw new Error("ID do produto é obrigatório.");

      await onSave(payload);
      onClose?.();
    } catch (e2) {
      setErr(e2?.message || "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={() => !busy && onClose?.()}
      />

      <div className="relative w-full max-w-lg rounded-2xl border bg-white p-5 shadow-xl">
        <div className="text-lg font-semibold text-zinc-900">
          {isEdit ? "Editar produto" : "Novo produto"}
        </div>
        <div className="mt-1 text-sm text-zinc-500">
          {isEdit
            ? "Atualize as informações do produto."
            : "Cadastre um novo produto na sua loja."}
        </div>

        {err ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {err}
          </div>
        ) : null}

        <form className="mt-4 space-y-3" onSubmit={submit}>
          <div>
            <label className="text-sm text-zinc-700">ID do produto</label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-300 disabled:bg-zinc-50"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              disabled={isEdit}
              placeholder="Ex.: PROD-001"
              required={!isEdit}
            />
            {isEdit ? (
              <div className="mt-1 text-xs text-zinc-500">
                O ID não pode ser alterado.
              </div>
            ) : null}
          </div>

          <div>
            <label className="text-sm text-zinc-700">Nome do produto</label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-300"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-sm text-zinc-700">Descrição</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-300"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Opcional"
            />
          </div>

          <div>
            <label className="text-sm text-zinc-700">Valor</label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-300"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="0,00"
            />
            <div className="mt-1 text-xs text-zinc-500">
              Prévia:{" "}
              <span className="font-semibold">
                {fmtBRL(parseBRLToCents(priceInput))}
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm text-zinc-700">Imagem do produto</label>
            <div className="mt-2 flex items-start gap-3">
              <div className="h-24 w-24 overflow-hidden rounded-xl border bg-zinc-50">
                {previewUrl ? (
                  // previewUrl pode ser path do servidor ou blob URL
                  <img
                    src={previewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                    Sem foto
                  </div>
                )}
              </div>

              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />
                <div className="mt-1 text-xs text-zinc-500">
                  PNG/JPG/WebP/GIF até 3MB.
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => !busy && onClose?.()}
            >
              Voltar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
