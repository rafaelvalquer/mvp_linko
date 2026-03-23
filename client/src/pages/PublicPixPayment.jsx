import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Copy,
  FileUp,
  QrCode,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useRef } from "react";
import { api } from "../app/api.js";
import useThemeToggle from "../app/useThemeToggle.js";
import brand from "../assets/brand.png";
import Button from "../components/appui/Button.jsx";
import { Input } from "../components/appui/Input.jsx";

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function fmtBRL(cents) {
  const v = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v / 100);
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

const API_BASE = (
  import.meta.env.VITE_API_BASE || "http://localhost:8011/api"
).replace(/\/$/, "");
const MAX_PROOF_FILE_SIZE = 10 * 1024 * 1024;
const AUTO_OPTIMIZE_IMAGE_THRESHOLD = 1.5 * 1024 * 1024;
const TARGET_PROOF_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_PROOF_IMAGE_DIMENSION = 1800;
const MIN_PROOF_IMAGE_DIMENSION = 1080;
const INITIAL_PROOF_IMAGE_QUALITY = 0.86;
const MIN_PROOF_IMAGE_QUALITY = 0.52;
const ALLOWED_PROOF_MIME = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);
const ALLOWED_PROOF_EXT = new Set(["jpg", "jpeg", "png", "pdf"]);

const STATUS_META = {
  PENDING: {
    label: "Aguardando pagamento",
    tone: "amber",
    summary: "Pague o valor exato abaixo e envie o comprovante para confirmar.",
    uploadTitle: "Enviar comprovante",
    uploadSubtitle: "Anexe o comprovante logo apos o Pix para liberar a confirmacao.",
  },
  WAITING_PROOF: {
    label: "Aguardando pagamento",
    tone: "amber",
    summary: "Use o QR Code ou o copia e cola e envie o comprovante em seguida.",
    uploadTitle: "Enviar comprovante",
    uploadSubtitle: "Anexe o comprovante logo apos o Pix para liberar a confirmacao.",
  },
  WAITING_CONFIRMATION: {
    label: "Comprovante enviado",
    tone: "blue",
    summary: "Seu comprovante foi recebido e esta em analise.",
    uploadTitle: "Comprovante em analise",
    uploadSubtitle:
      "Nao precisa reenviar agora. Assim que o pagamento for confirmado, seguimos automaticamente.",
  },
  REJECTED: {
    label: "Comprovante recusado",
    tone: "red",
    summary: "Envie um novo comprovante legivel para concluir o pagamento.",
    uploadTitle: "Reenviar comprovante",
    uploadSubtitle:
      "O arquivo anterior nao foi validado. Envie um novo comprovante para continuar.",
  },
  CONFIRMED: {
    label: "Pagamento confirmado",
    tone: "emerald",
    summary: "Pagamento confirmado com sucesso.",
    uploadTitle: "Pagamento confirmado",
    uploadSubtitle:
      "Recebemos seu pagamento. O processo sera concluido automaticamente.",
  },
  PAID: {
    label: "Pagamento confirmado",
    tone: "emerald",
    summary: "Pagamento confirmado com sucesso.",
    uploadTitle: "Pagamento confirmado",
    uploadSubtitle:
      "Recebemos seu pagamento. O processo sera concluido automaticamente.",
  },
};

function getFileExtension(name) {
  const raw = String(name || "").trim().toLowerCase();
  const parts = raw.split(".");
  return parts.length > 1 ? parts.pop() : "";
}

function inferProofMimeType(file) {
  const mime = String(file?.type || "")
    .trim()
    .toLowerCase();
  if (mime) return mime;

  const ext = getFileExtension(file?.name);
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "pdf") return "application/pdf";
  return "application/octet-stream";
}

function validateProofFile(file) {
  if (!file) {
    return {
      ok: false,
      code: "MISSING_FILE",
      message: "Selecione um arquivo JPG, PNG ou PDF.",
    };
  }

  const mime = String(file.type || "").trim().toLowerCase();
  const ext = getFileExtension(file.name);
  const mimeAllowed = mime ? ALLOWED_PROOF_MIME.has(mime) : true;
  const extAllowed = ext ? ALLOWED_PROOF_EXT.has(ext) : false;

  if (!mimeAllowed && !extAllowed) {
    return {
      ok: false,
      code: "INVALID_FILE_TYPE",
      message: "Formato invalido. Envie um comprovante em JPG, PNG ou PDF.",
    };
  }

  if (Number(file.size || 0) > MAX_PROOF_FILE_SIZE) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: `Arquivo muito grande (${formatFileSize(file.size)}). Envie um comprovante com ate 10MB. No celular, imagens PNG podem ficar pesadas; se precisar, reduza o arquivo ou envie em JPG/PDF.`,
    };
  }

  return { ok: true };
}

function isImageProofFile(file) {
  const mime = String(file?.type || "")
    .trim()
    .toLowerCase();
  const ext = getFileExtension(file?.name);

  if (mime.startsWith("image/")) return true;
  return ext === "jpg" || ext === "jpeg" || ext === "png";
}

function shouldOptimizeProofImage(file) {
  if (!isImageProofFile(file)) return false;

  const mime = String(file?.type || "")
    .trim()
    .toLowerCase();

  return (
    mime === "image/png" || Number(file?.size || 0) > AUTO_OPTIMIZE_IMAGE_THRESHOLD
  );
}

function replaceFileExtension(name, nextExt) {
  const raw = String(name || "comprovante").trim();
  const base = raw.replace(/\.[^.]+$/, "") || "comprovante";
  return `${base}.${nextExt}`;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Nao foi possivel preparar a imagem para envio."));
        return;
      }

      resolve(blob);
    }, type, quality);
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Nao foi possivel ler a imagem selecionada."));
    };

    img.src = url;
  });
}

function buildUploadFile(blob, name, type) {
  try {
    return new File([blob], name, {
      type,
      lastModified: Date.now(),
    });
  } catch {
    blob.name = name;
    blob.lastModified = Date.now();
    return blob;
  }
}

async function readProofFileBuffer(file) {
  if (typeof file?.arrayBuffer === "function") {
    return file.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }

      reject(new Error("Nao foi possivel ler o arquivo selecionado."));
    };

    reader.onerror = () => {
      reject(reader.error || new Error("Nao foi possivel ler o arquivo selecionado."));
    };

    reader.readAsArrayBuffer(file);
  });
}

async function materializeProofFile(file) {
  try {
    const buffer = await readProofFileBuffer(file);
    const type = inferProofMimeType(file);
    const blob = new Blob([buffer], { type });

    return buildUploadFile(blob, file?.name || "comprovante", type);
  } catch (error) {
    const materializeError = new Error(
      "Nao foi possivel acessar esse arquivo diretamente da nuvem. Salve ou baixe o comprovante para o aparelho e tente novamente.",
    );
    materializeError.code = "CLOUD_FILE_UNAVAILABLE";
    materializeError.cause = error;
    throw materializeError;
  }
}

async function optimizeProofImageFile(file) {
  if (!shouldOptimizeProofImage(file)) {
    return {
      file,
      optimized: false,
      originalSize: Number(file?.size || 0),
    };
  }

  const image = await loadImageFromFile(file);
  const sourceWidth = Math.max(1, Number(image.naturalWidth || image.width || 1));
  const sourceHeight = Math.max(1, Number(image.naturalHeight || image.height || 1));
  const sourceLongestSide = Math.max(sourceWidth, sourceHeight);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Nao foi possivel preparar a imagem para envio.");
  }

  let quality = INITIAL_PROOF_IMAGE_QUALITY;
  let longestSide = Math.min(sourceLongestSide, MAX_PROOF_IMAGE_DIMENSION);
  let bestBlob = null;

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const scale = longestSide / sourceLongestSide;
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (!bestBlob || blob.size < bestBlob.size) {
      bestBlob = blob;
    }

    if (blob.size <= TARGET_PROOF_IMAGE_BYTES) {
      break;
    }

    if (blob.size <= MAX_PROOF_FILE_SIZE && quality <= 0.62) {
      break;
    }

    if (quality > MIN_PROOF_IMAGE_QUALITY) {
      quality = Math.max(MIN_PROOF_IMAGE_QUALITY, quality - 0.12);
      continue;
    }

    if (longestSide <= MIN_PROOF_IMAGE_DIMENSION) {
      break;
    }

    longestSide = Math.max(
      MIN_PROOF_IMAGE_DIMENSION,
      Math.round(longestSide * 0.82),
    );
    quality = 0.74;
  }

  if (!bestBlob) {
    throw new Error("Nao foi possivel preparar a imagem para envio.");
  }

  const optimizedFile = buildUploadFile(
    bestBlob,
    replaceFileExtension(file.name, "jpg"),
    "image/jpeg",
  );

  const originalValidation = validateProofFile(file);
  if (optimizedFile.size >= Number(file?.size || 0) && originalValidation.ok) {
    return {
      file,
      optimized: false,
      originalSize: Number(file?.size || 0),
    };
  }

  return {
    file: optimizedFile,
    optimized: true,
    originalSize: Number(file?.size || 0),
  };
}

async function prepareProofFile(file, { onStageChange } = {}) {
  const setStage = typeof onStageChange === "function" ? onStageChange : () => {};

  setStage("materializing");
  const materializedFile = await materializeProofFile(file);
  const materializedValidation = validateProofFile(materializedFile);

  if (!materializedValidation.ok) {
    const error = new Error(materializedValidation.message);
    error.code = materializedValidation.code;
    throw error;
  }

  if (!shouldOptimizeProofImage(materializedFile)) {
    setStage("ready");
    return {
      file: materializedFile,
      materialized: true,
      optimized: false,
      optimizationFailed: false,
      originalSize: Number(file?.size || 0),
      materializedSize: Number(materializedFile.size || 0),
    };
  }

  try {
    setStage("optimizing");
    const optimized = await optimizeProofImageFile(materializedFile);
    const finalValidation = validateProofFile(optimized.file);

    if (!finalValidation.ok) {
      const error = new Error(finalValidation.message);
      error.code = finalValidation.code;
      throw error;
    }

    setStage("ready");
    return {
      file: optimized.file,
      materialized: true,
      optimized: optimized.optimized,
      optimizationFailed: false,
      originalSize: Number(file?.size || 0),
      materializedSize: Number(materializedFile.size || 0),
    };
  } catch {
    setStage("ready");
    return {
      file: materializedFile,
      materialized: true,
      optimized: false,
      optimizationFailed: true,
      originalSize: Number(file?.size || 0),
      materializedSize: Number(materializedFile.size || 0),
    };
  }
}

function getProofUploadErrorMessage(error, file) {
  const code = String(error?.code || "").trim().toUpperCase();
  const rawMessage = String(error?.message || "").trim();

  if (code === "CLOUD_FILE_UNAVAILABLE") {
    return "Nao foi possivel acessar esse arquivo diretamente da nuvem. Salve ou baixe o comprovante para o aparelho e tente novamente.";
  }

  if (code === "FILE_TOO_LARGE" || Number(error?.status) === 413) {
    return `Arquivo muito grande${file ? ` (${formatFileSize(file.size)})` : ""}. Envie um comprovante com ate 10MB. No celular, imagens PNG podem ficar pesadas; se precisar, reduza o arquivo ou envie em JPG/PDF.`;
  }

  if (code === "INVALID_FILE_TYPE") {
    return "Formato invalido. Envie um comprovante em JPG, PNG ou PDF.";
  }

  if (code === "MISSING_FILE") {
    return "Selecione um arquivo JPG, PNG ou PDF.";
  }

  if (code === "NETWORK_ERROR" || /failed to fetch/i.test(rawMessage)) {
    if (Number(file?.size || 0) > MAX_PROOF_FILE_SIZE) {
      return "Nao foi possivel enviar porque o arquivo parece exceder o limite de 10MB. Reduza a imagem ou envie em JPG/PDF.";
    }

    return "Nao foi possivel enviar o comprovante porque a conexao com o servidor falhou antes da resposta. Verifique a internet e tente novamente. Se estiver no celular, prefira um arquivo menor.";
  }

  return rawMessage || "Falha ao enviar comprovante.";
}

async function postForm(path, formData) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    const networkError = new Error(
      "Nao foi possivel enviar o comprovante porque a conexao falhou antes da resposta.",
    );
    networkError.code = "NETWORK_ERROR";
    networkError.cause = error;
    throw networkError;
  }

  const raw = await res.text().catch(() => "");
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = raw ? { error: raw } : {};
  }
  if (!res.ok || data?.ok === false) {
    const requestError = new Error(
      data?.error ||
        (res.status === 413
          ? "Arquivo muito grande."
          : "Falha na requisicao."),
    );
    requestError.status = res.status;
    requestError.code =
      data?.code || (res.status === 413 ? "FILE_TOO_LARGE" : "REQUEST_FAILED");
    requestError.data = data;
    throw requestError;
  }
  return data;
}

function SurfaceCard({ className = "", children }) {
  const { isDark } = useThemeToggle();

  return (
    <section
      className={cls(
        "relative overflow-hidden rounded-[30px] border p-5 sm:p-6",
        isDark
          ? "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(8,15,30,0.86))] shadow-[0_28px_70px_-46px_rgba(15,23,42,0.9)]"
          : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.92))] shadow-[0_28px_70px_-46px_rgba(15,23,42,0.22)]",
        className,
      )}
    >
      <div
        className={cls(
          "pointer-events-none absolute inset-x-0 top-0 h-24",
          isDark
            ? "bg-[linear-gradient(180deg,rgba(34,211,238,0.1),transparent)]"
            : "bg-[linear-gradient(180deg,rgba(37,99,235,0.08),transparent)]",
        )}
      />
      <div className="relative">{children}</div>
    </section>
  );
}

function StatusPill({ tone = "amber", label }) {
  const { isDark } = useThemeToggle();

  const tones = isDark
    ? {
        amber: "border-amber-400/20 bg-amber-400/10 text-amber-100",
        blue: "border-sky-400/20 bg-sky-400/10 text-sky-100",
        red: "border-red-400/20 bg-red-400/10 text-red-100",
        emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
      }
    : {
        amber: "border-amber-200 bg-amber-50 text-amber-700",
        blue: "border-sky-200 bg-sky-50 text-sky-700",
        red: "border-red-200 bg-red-50 text-red-700",
        emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };

  return (
    <span
      className={cls(
        "inline-flex w-fit items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]",
        tones[tone] || tones.amber,
      )}
    >
      {label}
    </span>
  );
}

function PaymentSteps({ current = "pay" }) {
  const { isDark } = useThemeToggle();
  const steps = [
    { key: "copy", title: "1. Copie o Pix", hint: "QR Code ou copia e cola" },
    { key: "pay", title: "2. Pague o valor", hint: "Confirme o valor exato" },
    { key: "upload", title: "3. Envie o comprovante", hint: "Finalize por esta tela" },
  ];

  const activeIndex =
    current === "copy" ? 0 : current === "pay" ? 1 : current === "done" ? 2 : 2;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {steps.map((step, index) => {
        const active = index <= activeIndex;
        return (
          <div
            key={step.key}
            className={cls(
              "rounded-[24px] border p-4",
              active
                ? isDark
                  ? "border-cyan-300/30 bg-cyan-400/10"
                  : "border-cyan-200 bg-white/92"
                : isDark
                  ? "border-white/10 bg-white/[0.04]"
                  : "border-white/80 bg-white/78",
            )}
          >
            <div
              className={cls(
                "text-[11px] font-bold uppercase tracking-[0.18em]",
                active
                  ? isDark
                    ? "text-cyan-100"
                    : "text-cyan-700"
                  : isDark
                    ? "text-slate-400"
                    : "text-slate-500",
              )}
            >
              {step.title}
            </div>
            <div className={cls("mt-2 text-sm leading-6", isDark ? "text-slate-200" : "text-slate-700")}>
              {step.hint}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CopyRow({ label, value, hint = "" }) {
  const { isDark } = useThemeToggle();
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
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div
      className={cls(
        "rounded-[24px] border p-4",
        isDark
          ? "border-white/10 bg-white/[0.04]"
          : "border-slate-200/80 bg-white/90",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className={cls(
              "text-[11px] font-bold uppercase tracking-[0.18em]",
              isDark ? "text-slate-400" : "text-slate-500",
            )}
          >
            {label}
          </div>
          <div
            className={cls(
              "mt-2 break-all text-sm leading-6",
              isDark ? "text-slate-100" : "text-slate-900",
            )}
          >
            {value || "Nao informado"}
          </div>
          {hint ? (
            <div
              className={cls(
                "mt-2 text-xs",
                isDark ? "text-slate-400" : "text-slate-500",
              )}
            >
              {hint}
            </div>
          ) : null}
        </div>

        <Button
          variant={copied ? "primary" : "secondary"}
          className="shrink-0 px-3 py-2 text-xs"
          onClick={copy}
          disabled={!value}
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
    </div>
  );
}

export default function PublicPixPayment() {
  const { token } = useParams();
  const nav = useNavigate();
  const { isDark } = useThemeToggle();
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
  const [selectedFileMeta, setSelectedFileMeta] = useState(null);
  const [note, setNote] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [uploadInfo, setUploadInfo] = useState("");
  const [prepareStage, setPrepareStage] = useState("idle");
  const [lastStatusRefreshAt, setLastStatusRefreshAt] = useState(null);
  const fileSelectionRef = useRef(0);

  async function refreshStatus() {
    const d = await api(`/p/${token}/payment/proof/status`);
    const st = String(d?.paymentStatus || "PENDING")
      .trim()
      .toUpperCase();

    setStatus(st);
    setLastStatusRefreshAt(new Date().toISOString());

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
        setLastStatusRefreshAt(new Date().toISOString());

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
    if (status !== "WAITING_CONFIRMATION") return undefined;

    const t = window.setInterval(() => {
      refreshStatus().catch(() => {});
    }, 5000);

    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, token, doneUrl]);

  useEffect(() => {
    return () => {
      fileSelectionRef.current += 1;
    };
  }, []);

  async function handleProofFileChange(event) {
    const nextFile = event.target.files?.[0] || null;
    event.target.value = "";

    const selectionId = fileSelectionRef.current + 1;
    fileSelectionRef.current = selectionId;

    setUploadErr("");
    setUploadInfo("");

    if (!nextFile) {
      setFile(null);
      setSelectedFileMeta(null);
      setPrepareStage("idle");
      return;
    }

    setFile(null);
    setSelectedFileMeta({
      name: nextFile.name || "comprovante",
      size: Number(nextFile.size || 0),
      type: inferProofMimeType(nextFile),
    });
    setPrepareStage("materializing");
    setUploadInfo("Preparando arquivo para envio...");

    try {
      const prepared = await prepareProofFile(nextFile, {
        onStageChange: setPrepareStage,
      });
      if (fileSelectionRef.current !== selectionId) return;

      setFile(prepared.file);
      setPrepareStage("ready");

      if (prepared.optimized && prepared.file.size < prepared.originalSize) {
        setUploadInfo(
          `Imagem otimizada automaticamente para facilitar o envio: ${formatFileSize(prepared.originalSize)} -> ${formatFileSize(prepared.file.size)}.`,
        );
      } else if (prepared.optimizationFailed) {
        setUploadInfo(
          "Nao foi possivel otimizar a imagem, mas o arquivo foi preparado localmente para envio.",
        );
      } else {
        setUploadInfo("");
      }
    } catch (error) {
      if (fileSelectionRef.current !== selectionId) return;

      setFile(null);
      setPrepareStage("error");
      setUploadInfo("");
      setUploadErr(getProofUploadErrorMessage(error, nextFile));
    } finally {
      if (fileSelectionRef.current === selectionId) {
        setPrepareStage((current) => {
          if (current === "materializing" || current === "optimizing") {
            return "ready";
          }

          return current;
        });
      }
    }
  }

  async function uploadProof() {
    const validation = validateProofFile(file);
    if (!validation.ok) {
      setUploadErr(validation.message);
      return;
    }

    setUploadErr("");
    setUploadBusy(true);

    try {
      const fd = new FormData();
      fd.append("file", file, file?.name || "comprovante");
      if (note.trim()) fd.append("note", note.trim());

      await postForm(`/p/${token}/payment/proof`, fd);

      setFile(null);
      setSelectedFileMeta(null);
      setNote("");
      setUploadInfo("");
      setPrepareStage("idle");
      setStatus("WAITING_CONFIRMATION");
    } catch (e) {
      setUploadErr(getProofUploadErrorMessage(e, file));
    } finally {
      setUploadBusy(false);
    }
  }

  const amountCents = Number(details?.amountCents || 0) || 0;
  const pixKey = details?.pixKey || "";
  const brCode = details?.brCode || "";
  const receiverName = details?.receiverName || "";
  const receiverCity = details?.receiverCity || "";
  const receiverLabel = [receiverName, receiverCity].filter(Boolean).join(" - ");

  const canUpload =
    status === "PENDING" || status === "REJECTED" || status === "WAITING_PROOF";

  const statusMeta = STATUS_META[status] || STATUS_META.PENDING;
  const isPreparingFile =
    prepareStage === "materializing" || prepareStage === "optimizing";
  const currentPaymentStep =
    status === "WAITING_CONFIRMATION" || status === "CONFIRMED" || status === "PAID"
      ? "done"
      : file
        ? "upload"
        : "pay";
  const selectedFileLabel = file
    ? `${file.name} (${formatFileSize(file.size)})`
    : selectedFileMeta
      ? `${selectedFileMeta.name} (${formatFileSize(selectedFileMeta.size)})`
      : "";

  if (loading) {
    return (
      <div
        className={cls(
          "min-h-screen px-4 py-6 sm:px-6",
          isDark
            ? "bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.14),transparent_40%),linear-gradient(180deg,#020617,#0f172a_52%,#020617)] text-white"
            : "bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_38%),linear-gradient(180deg,#f8fafc,#eef2ff_48%,#f8fafc)] text-slate-950",
        )}
      >
        <div className="mx-auto max-w-3xl">
          <SurfaceCard>
            <div className="flex items-center gap-3">
              <img src={brand} alt="brand" className="h-11 w-11 rounded-2xl" />
              <div>
                <div
                  className={cls(
                    "text-sm font-semibold",
                    isDark ? "text-slate-200" : "text-slate-600",
                  )}
                >
                  Pagamento via Pix
                </div>
                <div className="text-2xl font-black tracking-[-0.03em]">
                  Carregando dados do pagamento...
                </div>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div
        className={cls(
          "min-h-screen px-4 py-6 sm:px-6",
          isDark
            ? "bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.14),transparent_40%),linear-gradient(180deg,#020617,#0f172a_52%,#020617)] text-white"
            : "bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_38%),linear-gradient(180deg,#f8fafc,#eef2ff_48%,#f8fafc)] text-slate-950",
        )}
      >
        <div className="mx-auto max-w-3xl space-y-4">
          <SurfaceCard className={isDark ? "border-red-400/20" : "border-red-200"}>
            <div className="flex items-start gap-3">
              <CircleAlert
                className={cls(
                  "mt-0.5 h-5 w-5 shrink-0",
                  isDark ? "text-red-300" : "text-red-600",
                )}
              />
              <div>
                <div className="text-lg font-black tracking-[-0.03em]">
                  Nao foi possivel carregar o pagamento
                </div>
                <div
                  className={cls(
                    "mt-2 text-sm leading-6",
                    isDark ? "text-slate-300" : "text-slate-600",
                  )}
                >
                  {err}
                </div>
              </div>
            </div>
          </SurfaceCard>

          <Button variant="secondary" onClick={() => nav(`/p/${token}${qs}`)}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cls(
        "min-h-screen px-4 py-6 sm:px-6 lg:px-8",
        isDark
          ? "bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.16),transparent_38%),linear-gradient(180deg,#020617,#0f172a_52%,#020617)] text-white"
          : "bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_38%),linear-gradient(180deg,#f8fafc,#eef2ff_48%,#f8fafc)] text-slate-950",
      )}
    >
      <div className="mx-auto max-w-5xl">
        <section
          className={cls(
            "relative overflow-hidden rounded-[34px] border p-5 shadow-[0_36px_100px_-56px_rgba(15,23,42,0.55)] sm:p-8",
            isDark
              ? "border-white/10 bg-[linear-gradient(135deg,rgba(8,15,30,0.96),rgba(15,23,42,0.92),rgba(6,78,59,0.45))]"
              : "border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,245,249,0.95),rgba(236,253,245,0.96))]",
          )}
        >
          <div
            className={cls(
              "pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full blur-3xl",
              isDark ? "bg-cyan-400/15" : "bg-cyan-300/25",
            )}
          />
          <div
            className={cls(
              "pointer-events-none absolute -bottom-16 left-0 h-44 w-44 rounded-full blur-3xl",
              isDark ? "bg-emerald-400/10" : "bg-emerald-200/45",
            )}
          />

          <div className="relative">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <img src={brand} alt="brand" className="h-12 w-12 rounded-2xl" />
                <div>
                  <div
                    className={cls(
                      "text-xs font-bold uppercase tracking-[0.2em]",
                      isDark ? "text-cyan-200/80" : "text-cyan-700",
                    )}
                  >
                    Pagamento via Pix
                  </div>
                  <div className="text-lg font-black tracking-[-0.03em]">
                    Finalize seu pagamento
                  </div>
                </div>
              </div>

              <Button variant="secondary" onClick={() => nav(`/p/${token}${qs}`)}>
                Voltar
              </Button>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="space-y-5">
                <StatusPill tone={statusMeta.tone} label={statusMeta.label} />

                <div className="space-y-3">
                  <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                    Use o Pix e envie o comprovante para concluir.
                  </h1>
                  <p
                    className={cls(
                      "max-w-2xl text-sm leading-7 sm:text-base",
                      isDark ? "text-slate-300" : "text-slate-600",
                    )}
                  >
                    {statusMeta.summary}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div
                    className={cls(
                      "rounded-[24px] border p-4",
                      isDark
                        ? "border-white/10 bg-white/[0.04]"
                        : "border-white/80 bg-white/85",
                    )}
                  >
                    <div
                      className={cls(
                        "text-[11px] font-bold uppercase tracking-[0.18em]",
                        isDark ? "text-slate-400" : "text-slate-500",
                      )}
                    >
                      Valor
                    </div>
                    <div className="mt-2 text-2xl font-black tracking-[-0.04em] tabular-nums">
                      {fmtBRL(amountCents)}
                    </div>
                  </div>

                  <div
                    className={cls(
                      "rounded-[24px] border p-4",
                      isDark
                        ? "border-white/10 bg-white/[0.04]"
                        : "border-white/80 bg-white/85",
                    )}
                  >
                    <div
                      className={cls(
                        "text-[11px] font-bold uppercase tracking-[0.18em]",
                        isDark ? "text-slate-400" : "text-slate-500",
                      )}
                    >
                      Recebedor
                    </div>
                    <div className="mt-2 text-sm font-semibold leading-6">
                      {receiverLabel || "Informado no Pix"}
                    </div>
                  </div>

                  <div
                    className={cls(
                      "rounded-[24px] border p-4",
                      isDark
                        ? "border-white/10 bg-white/[0.04]"
                        : "border-white/80 bg-white/85",
                    )}
                  >
                    <div
                      className={cls(
                        "text-[11px] font-bold uppercase tracking-[0.18em]",
                        isDark ? "text-slate-400" : "text-slate-500",
                      )}
                    >
                      Confirmacao
                    </div>
                    <div className="mt-2 text-sm font-semibold leading-6">
                      Envie o comprovante apos o pagamento
                    </div>
                  </div>
                </div>

                <PaymentSteps current={currentPaymentStep} />

                <div
                  className={cls(
                    "rounded-[26px] border p-4 sm:p-5",
                    isDark
                      ? "border-white/10 bg-black/10"
                      : "border-slate-200/80 bg-white/70",
                  )}
                >
                  <div
                    className={cls(
                      "text-[11px] font-bold uppercase tracking-[0.18em]",
                      isDark ? "text-cyan-200/80" : "text-cyan-700",
                    )}
                  >
                    Passo a passo
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      "Abra o app do seu banco e escolha pagar com Pix.",
                      "Use o QR Code ou o codigo copia e cola com o valor exato.",
                      "Envie o comprovante abaixo para concluir a validacao.",
                    ].map((item) => (
                      <div
                        key={item}
                        className={cls(
                          "rounded-[22px] border p-4 text-sm leading-6",
                          isDark
                            ? "border-white/10 bg-white/[0.04] text-slate-200"
                            : "border-slate-200/80 bg-white/90 text-slate-700",
                        )}
                      >
                        <CheckCircle2
                          className={cls(
                            "mb-3 h-4 w-4",
                            isDark ? "text-emerald-300" : "text-emerald-600",
                          )}
                        />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <SurfaceCard className="lg:sticky lg:top-6">
                <div className="flex items-center gap-3">
                  <div
                    className={cls(
                      "flex h-11 w-11 items-center justify-center rounded-2xl",
                      isDark
                        ? "bg-cyan-400/10 text-cyan-200"
                        : "bg-cyan-50 text-cyan-700",
                    )}
                  >
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-lg font-black tracking-[-0.03em]">
                      Pague com QR Code
                    </div>
                    <div
                      className={cls(
                        "text-sm",
                        isDark ? "text-slate-300" : "text-slate-600",
                      )}
                    >
                      Escaneie o codigo abaixo ou copie os dados do Pix.
                    </div>
                  </div>
                </div>

                <div
                  className={cls(
                    "mt-5 rounded-[28px] border p-4 text-center",
                    isDark
                      ? "border-white/10 bg-white/[0.04]"
                      : "border-slate-200/80 bg-white/90",
                  )}
                >
                  {brCode ? (
                    <div className="mx-auto w-fit rounded-[24px] bg-white p-4 shadow-[0_22px_48px_-32px_rgba(15,23,42,0.28)]">
                      <QRCodeCanvas value={brCode} size={210} includeMargin />
                    </div>
                  ) : (
                    <div
                      className={cls(
                        "rounded-[24px] border px-4 py-10 text-sm",
                        isDark
                          ? "border-white/10 bg-white/[0.03] text-slate-300"
                          : "border-slate-200/80 bg-slate-50 text-slate-600",
                      )}
                    >
                      Os dados do Pix serao exibidos assim que estiverem disponiveis.
                    </div>
                  )}

                  <div
                    className={cls(
                      "mt-4 text-xs leading-6",
                      isDark ? "text-slate-400" : "text-slate-500",
                    )}
                  >
                    Confira sempre se o valor e o recebedor correspondem aos dados desta tela.
                    {lastStatusRefreshAt ? ` Atualizado as ${new Date(lastStatusRefreshAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.` : ""}
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  <CopyRow
                    label="Copia e cola"
                    value={brCode}
                    hint="Cole esse codigo no app do banco para preencher o Pix automaticamente."
                  />
                  <CopyRow
                    label="Chave Pix"
                    value={pixKey}
                    hint={receiverName ? `Titular: ${receiverName}` : ""}
                  />
                </div>
              </SurfaceCard>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <SurfaceCard>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div
                  className={cls(
                    "flex h-11 w-11 items-center justify-center rounded-2xl",
                    isDark
                      ? "bg-emerald-400/10 text-emerald-200"
                      : "bg-emerald-50 text-emerald-700",
                  )}
                >
                  <ReceiptText className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-lg font-black tracking-[-0.03em]">
                    {statusMeta.uploadTitle}
                  </div>
                  <div
                    className={cls(
                      "mt-1 max-w-2xl text-sm leading-6",
                      isDark ? "text-slate-300" : "text-slate-600",
                    )}
                  >
                    {statusMeta.uploadSubtitle}
                  </div>
                </div>
              </div>

              <StatusPill tone={statusMeta.tone} label={statusMeta.label} />
            </div>

            {!canUpload ? (
              <div
                className={cls(
                  "mt-5 rounded-[26px] border p-4 sm:p-5",
                  status === "WAITING_CONFIRMATION"
                    ? isDark
                      ? "border-sky-400/20 bg-sky-400/10"
                      : "border-sky-200 bg-sky-50"
                    : isDark
                      ? "border-emerald-400/20 bg-emerald-400/10"
                      : "border-emerald-200 bg-emerald-50",
                )}
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className={cls(
                      "mt-0.5 h-5 w-5 shrink-0",
                      status === "WAITING_CONFIRMATION"
                        ? isDark
                          ? "text-sky-200"
                          : "text-sky-700"
                        : isDark
                          ? "text-emerald-200"
                          : "text-emerald-700",
                    )}
                  />
                  <div
                    className={cls(
                      "text-sm leading-6",
                      status === "WAITING_CONFIRMATION"
                        ? isDark
                          ? "text-sky-50"
                          : "text-sky-800"
                        : isDark
                          ? "text-emerald-50"
                          : "text-emerald-800",
                    )}
                  >
                    {statusMeta.uploadSubtitle}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-4">
                  <label
                    className={cls(
                      "block cursor-pointer rounded-[26px] border border-dashed p-5 transition",
                      file
                        ? isDark
                          ? "border-cyan-300/40 bg-cyan-400/10"
                          : "border-cyan-300 bg-cyan-50"
                        : isDark
                          ? "border-white/15 bg-white/[0.03] hover:bg-white/[0.05]"
                          : "border-slate-300/80 bg-slate-50/70 hover:bg-white",
                    )}
                  >
                    <input
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={handleProofFileChange}
                      className="sr-only"
                    />

                    <div className="flex items-start gap-3">
                      <div
                        className={cls(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                          isDark
                            ? "bg-white/10 text-cyan-200"
                            : "bg-white text-cyan-700 shadow-[0_18px_38px_-30px_rgba(15,23,42,0.28)]",
                        )}
                      >
                        <FileUp className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="text-sm font-semibold">
                          {prepareStage === "materializing"
                            ? "Preparando arquivo para envio..."
                            : prepareStage === "optimizing"
                              ? "Otimizando imagem..."
                            : file
                              ? "Arquivo pronto para envio"
                              : "Selecione o comprovante"}
                        </div>
                        <div
                          className={cls(
                            "mt-1 text-sm leading-6",
                            isDark ? "text-slate-300" : "text-slate-600",
                          )}
                        >
                          {selectedFileLabel
                            ? selectedFileLabel
                            : "Aceitamos JPG, PNG ou PDF com ate 10MB."}
                        </div>
                      </div>
                    </div>
                  </label>

                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Mensagem opcional para o vendedor"
                    className="h-12"
                  />

                  {selectedFileMeta ? (
                    <div
                      className={cls(
                        "rounded-[22px] border px-4 py-3 text-sm",
                        isDark
                          ? "border-white/10 bg-white/[0.04] text-slate-200"
                          : "border-slate-200/80 bg-white/90 text-slate-700",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold">
                            {selectedFileMeta.name || "Comprovante selecionado"}
                          </div>
                          <div className={cls("mt-1 text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                            {formatFileSize(selectedFileMeta.size)} • {String(selectedFileMeta.type || "").toUpperCase() || "ARQUIVO"}
                          </div>
                        </div>
                        <StatusPill
                          tone={isPreparingFile ? "blue" : "amber"}
                          label={
                            isPreparingFile
                              ? "Preparando"
                              : status === "REJECTED"
                                ? "Pronto para reenviar"
                                : "Pronto para envio"
                          }
                        />
                      </div>
                    </div>
                  ) : null}

                  {uploadErr ? (
                    <div
                      className={cls(
                        "rounded-[22px] border px-4 py-3 text-sm",
                        isDark
                          ? "border-red-400/20 bg-red-400/10 text-red-100"
                          : "border-red-200 bg-red-50 text-red-700",
                      )}
                    >
                      {uploadErr}
                    </div>
                  ) : null}

                  {!uploadErr && uploadInfo ? (
                    <div
                      className={cls(
                        "rounded-[22px] border px-4 py-3 text-sm",
                        isDark
                          ? "border-sky-400/20 bg-sky-400/10 text-sky-100"
                          : "border-sky-200 bg-sky-50 text-sky-700",
                      )}
                    >
                      {uploadInfo}
                    </div>
                  ) : null}
                </div>

                <div
                  className={cls(
                    "rounded-[26px] border p-5",
                    isDark
                      ? "border-white/10 bg-white/[0.04]"
                      : "border-slate-200/80 bg-white/90",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <ShieldCheck
                      className={cls(
                        "mt-0.5 h-5 w-5 shrink-0",
                        isDark ? "text-emerald-200" : "text-emerald-700",
                      )}
                    />
                    <div>
                      <div className="text-sm font-semibold">
                        Revisao manual do comprovante
                      </div>
                      <div
                        className={cls(
                          "mt-2 text-sm leading-6",
                          isDark ? "text-slate-300" : "text-slate-600",
                        )}
                      >
                        Envie um arquivo legivel. Se houver recusas, voce podera
                        reenviar por esta mesma pagina.
                      </div>
                    </div>
                  </div>

                  <div
                    className={cls(
                      "mt-4 rounded-[22px] border p-4 text-sm leading-6",
                      status === "REJECTED"
                        ? isDark
                          ? "border-red-400/20 bg-red-400/10 text-red-100"
                          : "border-red-200 bg-red-50 text-red-700"
                        : isDark
                          ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                          : "border-amber-200 bg-amber-50 text-amber-700",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {status === "REJECTED"
                          ? "O ultimo comprovante foi recusado. Confira o arquivo e envie novamente."
                          : "Depois do envio, a confirmacao pode levar alguns instantes."}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end">
                    <Button
                      disabled={uploadBusy || isPreparingFile || !file}
                      onClick={uploadProof}
                      className="w-full sm:w-auto"
                    >
                      {uploadBusy
                        ? "Enviando..."
                        : isPreparingFile
                          ? "Preparando..."
                          : "Enviar comprovante"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
