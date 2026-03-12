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

const API_BASE = (
  import.meta.env.VITE_API_BASE || "http://localhost:8011/api"
).replace(/\/$/, "");

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

async function postForm(path, formData) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || "Falha na requisicao.");
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
    if (status !== "WAITING_CONFIRMATION") return undefined;

    const t = window.setInterval(() => {
      refreshStatus().catch(() => {});
    }, 5000);

    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, token, doneUrl]);

  async function uploadProof() {
    if (!file) {
      setUploadErr("Selecione um arquivo JPG, PNG ou PDF.");
      return;
    }

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

  const amountCents = Number(details?.amountCents || 0) || 0;
  const pixKey = details?.pixKey || "";
  const brCode = details?.brCode || "";
  const receiverName = details?.receiverName || "";
  const receiverCity = details?.receiverCity || "";
  const receiverLabel = [receiverName, receiverCity].filter(Boolean).join(" - ");

  const canUpload =
    status === "PENDING" || status === "REJECTED" || status === "WAITING_PROOF";

  const statusMeta = STATUS_META[status] || STATUS_META.PENDING;

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
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
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
                          {file ? "Arquivo selecionado" : "Selecione o comprovante"}
                        </div>
                        <div
                          className={cls(
                            "mt-1 text-sm leading-6",
                            isDark ? "text-slate-300" : "text-slate-600",
                          )}
                        >
                          {file
                            ? file.name
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
                      disabled={uploadBusy || !file}
                      onClick={uploadProof}
                      className="w-full sm:w-auto"
                    >
                      {uploadBusy ? "Enviando..." : "Enviar comprovante"}
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
