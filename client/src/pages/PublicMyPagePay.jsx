import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CreditCard, MessageCircle, Search } from "lucide-react";
import {
  getPublicMyPage,
  resolvePublicMyPagePayment,
} from "../app/myPageApi.js";
import useThemeToggle from "../app/useThemeToggle.js";
import brand from "../assets/brand.png";
import Button from "../components/appui/Button.jsx";
import { Input } from "../components/appui/Input.jsx";

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function SurfaceCard({ className = "", children }) {
  const { isDark } = useThemeToggle();
  return (
    <section
      className={cls(
        "rounded-[30px] border p-5 sm:p-6",
        isDark
          ? "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(8,15,30,0.86))]"
          : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.92))]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export default function PublicMyPagePay() {
  const { slug } = useParams();
  const { isDark } = useThemeToggle();
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");
        const response = await getPublicMyPage(slug);
        if (!active) return;
        setPage(response?.page || null);
      } catch (error) {
        if (!active) return;
        setErr(error?.message || "Nao consegui abrir o pagamento.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [slug]);

  const whatsappButton = (page?.buttons || []).find(
    (button) => button.type === "whatsapp",
  );

  async function handleResolve(event) {
    event.preventDefault();
    try {
      setResolving(true);
      setErr("");
      const response = await resolvePublicMyPagePayment(slug, input);
      if (response?.redirectUrl) {
        window.location.href = response.redirectUrl;
        return;
      }
      throw new Error("Nao encontrei uma proposta valida para continuar.");
    } catch (error) {
      setErr(error?.message || "Nao consegui localizar a proposta.");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div
      className={cls(
        "min-h-screen px-4 py-6 sm:px-6 lg:px-8",
        isDark
          ? "bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.14),transparent_38%),linear-gradient(180deg,#020617,#0f172a_50%,#020617)] text-white"
          : "bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.1),transparent_38%),linear-gradient(180deg,#f8fafc,#eef2ff_48%,#f8fafc)] text-slate-950",
      )}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <SurfaceCard>
          <div className="flex items-start gap-4">
            <img
              src={page?.avatarUrl || brand}
              alt={page?.title || "Minha Pagina"}
              className="h-16 w-16 rounded-[22px] object-cover"
            />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700 dark:text-sky-200">
                Pagar proposta
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">
                {page?.title || "Minha Pagina"}
              </h1>
              <p
                className={cls(
                  "mt-2 max-w-2xl text-sm leading-7",
                  isDark ? "text-slate-300" : "text-slate-600",
                )}
              >
                Informe o codigo publico da proposta ou cole o link recebido para seguir para o pagamento correto.
              </p>
            </div>
          </div>
        </SurfaceCard>

        {loading ? (
          <SurfaceCard className="h-64 animate-pulse" />
        ) : (
          <SurfaceCard>
            <form className="space-y-5" onSubmit={handleResolve}>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                Dica: use algo como <span className="font-semibold">LPABC123</span> ou cole o link completo da proposta.
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Codigo da proposta ou link recebido"
                  className="h-12 rounded-2xl pl-11"
                />
              </div>

              {err ? (
                <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                  {err}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="submit" disabled={resolving || !input.trim()}>
                  <CreditCard className="h-4 w-4" />
                  {resolving ? "Buscando..." : "Abrir proposta"}
                </Button>
                <Link to={`/u/${slug}`}>
                  <Button type="button" variant="secondary">
                    Voltar para a pagina
                  </Button>
                </Link>
                {whatsappButton?.targetUrl ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      window.open(
                        whatsappButton.targetUrl,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    <MessageCircle className="h-4 w-4" />
                    Falar no WhatsApp
                  </Button>
                ) : null}
              </div>
            </form>
          </SurfaceCard>
        )}
      </div>
    </div>
  );
}
