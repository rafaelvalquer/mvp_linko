// src/pages/PublicPixPayment.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../app/api.js";
import Button from "../components/appui/Button.jsx";
import { Input } from "../components/appui/Input.jsx";
import brand from "../assets/brand.png";

// ✅ QR Code local (não chama gateway)
// Instale: npm i qrcode.react
import { QRCodeCanvas } from "qrcode.react";

function fmtBRL(cents) {
  const v = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v / 100);
}

const API_BASE = (
  import.meta.env.VITE_API_BASE || "http://localhost:8011/api"
).replace(/\/$/, "");

async function sendProof(token, file, note) {
  const fd = new FormData();
  fd.append("file", file);
  if (note) fd.append("note", note);

  const resp = await fetch(`${API_BASE}/p/${token}/payment/proof`, {
    method: "POST",
    body: fd,
  });

  // tenta ler json mesmo em erro
  const text = await resp.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {}

  if (!resp.ok) {
    throw new Error(data?.error || `HTTP ${resp.status}`);
  }
  return data;
}

async function postForm(path, formData) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || "Falha na requisição.");
  }
  return data;
}

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        {label}
      </div>

      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="break-all text-xs text-zinc-800">{value || "—"}</div>
        </div>

        <Button
          variant={copied ? "primary" : "secondary"}
          size="sm"
          className="shrink-0"
          onClick={copy}
          disabled={!value}
        >
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
    </div>
  );
}

export default function PublicPixPayment() {
  const { token } = useParams();
  const nav = useNavigate();
  const [search] = useSearchParams();
  const bookingId = search.get("bookingId") || "";

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    if (bookingId) q.set("bookingId", bookingId);
    const s = q.toString();
    return s ? `?${s}` : "";
  }, [bookingId]);

  const doneUrl = useMemo(() => `/p/${token}/done${qs}`, [token, qs]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [details, setDetails] = useState(null);
  const [status, setStatus] = useState("PENDING");

  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  async function refreshStatus() {
    const d = await api(`/p/${token}/payment/proof/status`);
    const st = String(d?.paymentStatus || "PENDING")
      .trim()
      .toUpperCase();
    setStatus(st);

    if (st === "CONFIRMED" || st === "PAID") {
      nav(doneUrl, { replace: true });
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const d = await api(`/p/${token}/payment/details`);
        if (!d?.ok) throw new Error(d?.error || "Falha ao carregar pagamento.");

        if (!alive) return;

        setDetails(d);
        setStatus(String(d?.paymentStatus || "PENDING").toUpperCase());

        await refreshStatus();
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Falha ao carregar pagamento.");
        setDetails(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (status !== "WAITING_CONFIRMATION") return;

    const t = setInterval(() => {
      refreshStatus().catch(() => {});
    }, 5000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, token, doneUrl]);

  async function uploadProof() {
    if (!file) return setUploadErr("Selecione um arquivo (JPG/PNG/PDF).");

    setUploadErr("");
    setUploadBusy(true);

    try {
      const fd = new FormData();
      fd.append("file", file);
      if (note.trim()) fd.append("note", note.trim());

      await postForm(`/p/${token}/payment/proof`, fd);

      setFile(null);
      setNote("");
      setStatus("WAITING_CONFIRMATION");
    } catch (e) {
      setUploadErr(e?.message || "Falha ao enviar comprovante.");
    } finally {
      setUploadBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-4 text-sm text-zinc-600">
          Carregando…
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {err}
        </div>
        <div className="mx-auto mt-3 max-w-2xl">
          <Button variant="secondary" onClick={() => nav(`/p/${token}`)}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const amountCents = Number(details?.amountCents || 0) || 0;
  const pixKey = details?.pixKey || "";
  const brCode = details?.brCode || "";
  const receiverName = details?.receiverName || "";
  const receiverCity = details?.receiverCity || "";

  const canUpload =
    status === "PENDING" || status === "REJECTED" || status === "WAITING_PROOF";

  const statusLabel =
    status === "CONFIRMED" || status === "PAID"
      ? "Pago (confirmado)"
      : status === "WAITING_CONFIRMATION"
        ? "Aguardando confirmação"
        : status === "REJECTED"
          ? "Comprovante recusado"
          : "Aguardando pagamento";

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={brand} alt="brand" className="h-8 w-8 rounded-lg" />
            <div>
              <div className="text-sm font-semibold text-zinc-900">
                Pagamento via Pix
              </div>
              <div className="text-xs text-zinc-500">{statusLabel}</div>
            </div>
          </div>

          <Button variant="secondary" onClick={() => nav(`/p/${token}${qs}`)}>
            Voltar
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Valor
              </div>
              <div className="mt-1 text-2xl font-extrabold text-zinc-900 tabular-nums">
                {fmtBRL(amountCents)}
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                Recebedor: <span className="font-semibold">{receiverName}</span>{" "}
                • {receiverCity}
              </div>
            </div>

            <div className="hidden sm:block">
              {brCode ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-2">
                  <QRCodeCanvas value={brCode} size={132} includeMargin />
                </div>
              ) : null}
            </div>
          </div>

          {brCode ? (
            <div className="mt-4 sm:hidden">
              <div className="rounded-xl border border-zinc-200 bg-white p-2 inline-block">
                <QRCodeCanvas value={brCode} size={180} includeMargin />
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-3">
            <CopyRow label="Chave Pix" value={pixKey} />
            <CopyRow label="Copia e cola" value={brCode} />
          </div>

          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
            <div className="font-semibold text-zinc-900">
              Como finalizar o pagamento
            </div>
            <ol className="mt-2 list-decimal pl-5 space-y-1">
              <li>Abra o app do seu banco e faça um Pix no valor acima.</li>
              <li>Use a chave Pix ou o “copia e cola” (QR Code opcional).</li>
              <li>Anexe o comprovante abaixo para o vendedor confirmar.</li>
            </ol>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-900">
                Anexar comprovante
              </div>
              <div className="text-xs text-zinc-500">
                Aceita JPG/PNG/PDF (até 10MB)
              </div>
            </div>

            {status === "WAITING_CONFIRMATION" ? (
              <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                Aguardando confirmação
              </div>
            ) : null}

            {status === "REJECTED" ? (
              <div className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-800 border border-red-200">
                Recusado — reenvie
              </div>
            ) : null}

            {status === "CONFIRMED" || status === "PAID" ? (
              <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                Pago (confirmado)
              </div>
            ) : null}
          </div>

          {!canUpload ? (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              Seu comprovante já foi enviado. Aguarde a confirmação do vendedor.
              Se o comprovante for recusado, você poderá reenviar.
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-1 gap-3">
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-zinc-800 hover:file:bg-zinc-200"
                />

                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Mensagem opcional para o vendedor…"
                  className="h-10 text-sm"
                />
              </div>

              {file ? (
                <div className="mt-3 text-xs text-zinc-600">
                  Arquivo: <span className="font-semibold">{file.name}</span>
                </div>
              ) : null}

              {uploadErr ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {uploadErr}
                </div>
              ) : null}

              <div className="mt-4 flex justify-end">
                <Button disabled={uploadBusy || !file} onClick={uploadProof}>
                  {uploadBusy ? "Enviando…" : "Enviar comprovante"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
