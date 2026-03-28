import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, MessageSquareQuote, Star } from "lucide-react";
import { api } from "../app/api.js";
import useThemeToggle from "../app/useThemeToggle.js";
import brand from "../assets/brand.png";
import Button from "../components/appui/Button.jsx";

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function fmtBRL(cents) {
  const value = Number.isFinite(Number(cents)) ? Number(cents) : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function fmtDateTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function PublicOfferFeedback() {
  const { token } = useParams();
  const { isDark } = useThemeToggle();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [contactRequested, setContactRequested] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await api(`/p/${token}/feedback`);
        if (!alive) return;
        setPage(data?.feedback || null);
        if (data?.feedback?.feedback?.rating) {
          setRating(Number(data.feedback.feedback.rating) || 0);
        }
        setComment(String(data?.feedback?.feedback?.comment || ""));
        setContactRequested(data?.feedback?.feedback?.contactRequested === true);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Nao foi possivel carregar a avaliacao.");
        setPage(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  const pageBg = cls(
    "min-h-screen px-4 py-6 sm:px-6 lg:px-8",
    isDark
      ? "bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.16),transparent_38%),linear-gradient(180deg,#020617,#0f172a_52%,#020617)] text-white"
      : "bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_38%),linear-gradient(180deg,#f8fafc,#eef2ff_48%,#f8fafc)] text-slate-950",
  );

  const canAskContact = rating > 0 && rating <= 3;
  const alreadyResponded = !!page?.feedback?.respondedAt;
  const isEligible = page?.availability?.eligible === true;

  const heroCard = cls(
    "relative overflow-hidden rounded-[34px] border p-5 shadow-[0_36px_100px_-56px_rgba(15,23,42,0.55)] sm:p-8",
    isDark
      ? "border-white/10 bg-[linear-gradient(135deg,rgba(8,15,30,0.96),rgba(15,23,42,0.92),rgba(6,78,59,0.35))]"
      : "border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,245,249,0.95),rgba(236,253,245,0.96))]",
  );

  const headline = useMemo(() => {
    if (alreadyResponded) return "Obrigado pela sua avaliacao";
    if (!isEligible) return "Avaliacao indisponivel neste momento";
    return page?.offerType === "product"
      ? "Como foi sua experiencia com a compra?"
      : "Como foi sua experiencia com o atendimento?";
  }, [alreadyResponded, isEligible, page]);

  async function handleSubmit() {
    if (!rating || saving) return;
    try {
      setSaving(true);
      setError("");
      const data = await api(`/p/${token}/feedback`, {
        method: "POST",
        body: JSON.stringify({
          rating,
          comment,
          contactRequested: canAskContact ? contactRequested : false,
        }),
      });
      setPage(data?.feedback || null);
    } catch (err) {
      setError(err?.message || "Nao foi possivel enviar sua avaliacao.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={pageBg}>
      <div className="mx-auto max-w-4xl space-y-6">
        <section className={heroCard}>
          <div
            className={cls(
              "pointer-events-none absolute inset-0",
              isDark
                ? "bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_28%)]"
                : "bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_28%)]",
            )}
          />

          <div className="relative space-y-5">
            <div className="flex items-center gap-3">
              <img
                src={brand}
                alt="Luminor Pay"
                className="h-11 w-11 rounded-2xl object-cover shadow-sm"
              />
              <div>
                <p
                  className={cls(
                    "text-[11px] font-semibold uppercase tracking-[0.28em]",
                    isDark ? "text-sky-200/80" : "text-sky-700/80",
                  )}
                >
                  Pesquisa de satisfacao
                </p>
                <h1 className="text-2xl font-semibold sm:text-3xl">
                  {headline}
                </h1>
              </div>
            </div>

            <div
              className={cls(
                "max-w-2xl text-sm leading-7 sm:text-base",
                isDark ? "text-slate-300" : "text-slate-600",
              )}
            >
              {alreadyResponded
                ? "Sua resposta ja foi registrada por aqui. Obrigado por dedicar esse tempo."
                : "Sua opiniao ajuda a melhorar a experiencia dos proximos atendimentos. A avaliacao leva menos de 1 minuto."}
            </div>
          </div>
        </section>

        {loading ? (
          <div
            className={cls(
              "rounded-[30px] border p-6",
              isDark
                ? "border-white/10 bg-white/5 text-slate-300"
                : "border-slate-200 bg-white text-slate-600",
            )}
          >
            Carregando avaliacao...
          </div>
        ) : error && !page ? (
          <div className="rounded-[30px] border border-red-200 bg-red-50 p-6 text-sm text-red-800">
            {error}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section
              className={cls(
                "rounded-[30px] border p-5 sm:p-6",
                isDark
                  ? "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(8,15,30,0.86))]"
                  : "border-slate-200/80 bg-white/95",
              )}
            >
              {!isEligible && !alreadyResponded ? (
                <div
                  className={cls(
                    "rounded-[24px] border p-4 text-sm leading-6",
                    isDark
                      ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                      : "border-amber-200 bg-amber-50 text-amber-700",
                  )}
                >
                  {page?.availability?.reason ||
                    "A avaliacao ainda nao esta disponivel para esta proposta."}
                </div>
              ) : alreadyResponded ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2
                      className={cls(
                        "mt-0.5 h-5 w-5 shrink-0",
                        isDark ? "text-emerald-200" : "text-emerald-700",
                      )}
                    />
                    <div>
                      <div className="text-lg font-semibold">
                        Avaliacao enviada com sucesso
                      </div>
                      <div
                        className={cls(
                          "mt-1 text-sm",
                          isDark ? "text-slate-300" : "text-slate-600",
                        )}
                      >
                        Respondido em {fmtDateTime(page?.feedback?.respondedAt)}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200/80 bg-slate-50 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Sua nota
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={index}
                          className={cls(
                            "h-6 w-6",
                            index < (page?.feedback?.rating || 0)
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-300",
                          )}
                        />
                      ))}
                      <span className="ml-2 text-sm font-semibold text-slate-700">
                        {page?.feedback?.rating || 0}/5
                      </span>
                    </div>

                    {page?.feedback?.comment ? (
                      <div className="mt-4 rounded-[20px] border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                        {page.feedback.comment}
                      </div>
                    ) : null}

                    {page?.feedback?.contactRequested ? (
                      <div className="mt-4 text-sm font-medium text-amber-700">
                        Voce pediu um contato de retorno.
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-[24px] border border-slate-200/80 bg-slate-50 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Sua nota
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Array.from({ length: 5 }).map((_, index) => {
                        const value = index + 1;
                        const activeStar = rating >= value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setRating(value)}
                            className={cls(
                              "flex h-12 w-12 items-center justify-center rounded-2xl border transition",
                              activeStar
                                ? "border-amber-300 bg-amber-50 text-amber-500"
                                : "border-slate-200 bg-white text-slate-300 hover:border-slate-300 hover:text-slate-500",
                            )}
                            aria-label={`Dar nota ${value}`}
                          >
                            <Star
                              className={cls(
                                "h-6 w-6",
                                activeStar ? "fill-amber-400 text-amber-400" : "",
                              )}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200/80 bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Comentario opcional
                    </div>
                    <textarea
                      className="mt-3 min-h-[140px] w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
                      placeholder="Se quiser, conte rapidinho como foi sua experiencia."
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                    />
                  </div>

                  {canAskContact ? (
                    <label className="flex items-start gap-3 rounded-[24px] border border-slate-200/80 bg-white p-4">
                      <input
                        type="checkbox"
                        className="mt-1 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        checked={contactRequested}
                        onChange={(event) =>
                          setContactRequested(event.target.checked)
                        }
                      />
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          Quero que entrem em contato comigo
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Se algo nao saiu como esperado, podemos voltar para entender melhor.
                        </div>
                      </div>
                    </label>
                  ) : null}

                  {error ? (
                    <div className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                      {error}
                    </div>
                  ) : null}

                  <div className="flex justify-end">
                    <Button onClick={handleSubmit} disabled={!rating || saving}>
                      {saving ? "Enviando..." : "Enviar avaliacao"}
                    </Button>
                  </div>
                </div>
              )}
            </section>

            <aside
              className={cls(
                "rounded-[30px] border p-5 sm:p-6",
                isDark
                  ? "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(8,15,30,0.86))]"
                  : "border-slate-200/80 bg-white/95",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cls(
                    "flex h-11 w-11 items-center justify-center rounded-2xl",
                    isDark ? "bg-cyan-400/10 text-cyan-200" : "bg-cyan-50 text-cyan-700",
                  )}
                >
                  <MessageSquareQuote className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-950 dark:text-white">
                    Resumo
                  </div>
                  <div
                    className={cls(
                      "mt-1 text-sm",
                      isDark ? "text-slate-300" : "text-slate-600",
                    )}
                  >
                    {page?.title || "Proposta"}
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3 text-sm">
                <div className="rounded-[22px] border border-slate-200/80 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    Cliente
                  </div>
                  <div className="mt-2 font-semibold text-slate-900">
                    {page?.customerName || "Cliente"}
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200/80 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    Valor da proposta
                  </div>
                  <div className="mt-2 font-semibold text-slate-900">
                    {fmtBRL(page?.amountCents || 0)}
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200/80 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    Marco registrado
                  </div>
                  <div className="mt-2 font-semibold text-slate-900">
                    {page?.fulfillmentLabel || "Conclusao registrada"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Pesquisa curta, sem propaganda e sem nova oferta nesta etapa.
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
