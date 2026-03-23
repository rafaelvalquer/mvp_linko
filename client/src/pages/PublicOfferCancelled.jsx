import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Ban, Building2, CircleAlert, FileText, ShieldCheck, Wallet } from "lucide-react";
import { api } from "../app/api.js";
import useThemeToggle from "../app/useThemeToggle.js";
import Button from "../components/appui/Button.jsx";
import brand from "../assets/brand.png";

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function fmtBRL(cents) {
  const value = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function SurfaceCard({ children, className = "" }) {
  const { isDark } = useThemeToggle();

  return (
    <section
      className={cls(
        "rounded-[30px] border p-5 sm:p-6",
        isDark
          ? "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(8,15,30,0.88))] shadow-[0_28px_70px_-46px_rgba(15,23,42,0.88)]"
          : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.92))] shadow-[0_28px_70px_-46px_rgba(15,23,42,0.22)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  const { isDark } = useThemeToggle();
  if (!value) return null;

  return (
    <div
      className={cls(
        "flex items-center gap-3 rounded-[22px] border px-4 py-3",
        isDark
          ? "border-white/10 bg-white/[0.04]"
          : "border-slate-200/80 bg-white/90",
      )}
    >
      <div
        className={cls(
          "flex h-10 w-10 items-center justify-center rounded-2xl",
          isDark ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700",
        )}
      >
        <Icon size={18} />
      </div>
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
            "mt-1 truncate text-sm font-semibold",
            isDark ? "text-white" : "text-slate-950",
          )}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

export default function PublicOfferCancelled() {
  const { token } = useParams();
  const nav = useNavigate();
  const { isDark } = useThemeToggle();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await api(`/p/${token}/summary`);
        if (!alive) return;
        if (!data?.ok || !data?.summary) {
          throw new Error(data?.error || "Nao foi possivel carregar a proposta.");
        }
        setSummary(data.summary);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Nao foi possivel carregar a proposta.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  const offer = summary?.offer || null;
  const title = String(offer?.title || "Proposta").trim() || "Proposta";
  const sellerName = String(offer?.sellerName || "").trim();
  const totalCents = Number(summary?.totalCents ?? offer?.totalCents ?? offer?.amountCents);

  return (
    <div
      className={cls(
        "min-h-screen px-4 py-6 sm:px-6",
        isDark
          ? "bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.16),transparent_30%),linear-gradient(180deg,#020617,#0f172a_52%,#111827)] text-white"
          : "bg-[radial-gradient(circle_at_top,rgba(248,113,113,0.18),transparent_32%),linear-gradient(180deg,#fff7f7,#f8fafc_56%,#eef2ff)] text-slate-950",
      )}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-center pt-2">
          <img src={brand} alt="Luminor Pay" className="h-10 w-auto sm:h-12" />
        </div>

        <SurfaceCard>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xl">
              <div
                className={cls(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]",
                  isDark
                    ? "border-red-400/20 bg-red-400/10 text-red-100"
                    : "border-red-200 bg-red-50 text-red-700",
                )}
              >
                <Ban size={14} />
                Proposta cancelada
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                Esta proposta nao pode mais ser concluida.
              </h1>

              <p
                className={cls(
                  "mt-3 max-w-2xl text-sm leading-7 sm:text-base",
                  isDark ? "text-slate-300" : "text-slate-600",
                )}
              >
                A proposta atual foi cancelada pelo emissor. O link continua
                disponivel apenas para consulta deste status.
              </p>
            </div>

            <div
              className={cls(
                "flex h-16 w-16 items-center justify-center rounded-[24px]",
                isDark ? "bg-red-400/10 text-red-100" : "bg-red-50 text-red-700",
              )}
            >
              <Ban size={28} />
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div
            className={cls(
              "rounded-[26px] border px-4 py-4 text-sm leading-6",
              isDark
                ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                : "border-amber-200 bg-amber-50 text-amber-700",
            )}
          >
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="font-semibold">O que isso significa agora</div>
                <div className="mt-1">
                  Este link nao aceita mais pagamento nem conclusao. Se voce ainda quiser seguir com a compra,
                  o proximo passo e pedir um novo link ao emissor.
                </div>
              </div>
            </div>
          </div>

          <div
            className={cls("mt-6 text-[11px] font-bold uppercase tracking-[0.18em]", isDark ? "text-slate-400" : "text-slate-500")}
          >
            Resumo
          </div>

          {loading ? (
            <div
              className={cls(
                "mt-4 rounded-[24px] border px-4 py-5 text-sm",
                isDark ? "border-white/10 bg-white/[0.04]" : "border-slate-200/80 bg-white/90",
              )}
            >
              Carregando proposta...
            </div>
          ) : error ? (
            <div
              className={cls(
                "mt-4 rounded-[24px] border px-4 py-5 text-sm",
                isDark
                  ? "border-red-400/20 bg-red-400/10 text-red-100"
                  : "border-red-200 bg-red-50 text-red-700",
              )}
            >
              {error}
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoRow icon={FileText} label="Proposta" value={title} />
              <InfoRow
                icon={Building2}
                label="Emissor"
                value={sellerName || "Luminor Pay"}
              />
              <InfoRow
                icon={Wallet}
                label="Valor"
                value={Number.isFinite(totalCents) ? fmtBRL(totalCents) : ""}
              />
              <InfoRow
                icon={ShieldCheck}
                label="Proximo passo"
                value={sellerName ? `Fale com ${sellerName} para receber um novo link.` : "Solicite um novo link ao emissor."}
              />
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                if (window.history.length > 1) {
                  nav(-1);
                  return;
                }
                window.location.assign("/");
              }}
            >
              Voltar
            </Button>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
