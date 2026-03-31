import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Package2,
  ReceiptText,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { api } from "../app/api.js";
import useThemeToggle from "../app/useThemeToggle.js";
import brand from "../assets/brand.png";
import Button from "../components/appui/Button.jsx";

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

function fmtTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function fmtBookingRange(startAt, endAt) {
  if (!startAt) return "";
  const startLabel = fmtDateTime(startAt);
  const endLabel = fmtTime(endAt);
  return endLabel ? `${startLabel} - ${endLabel}` : startLabel;
}

function safeInt(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function bookingStatusLabel(status) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "CONFIRMED") return "Confirmado";
  if (normalized === "CANCELLED") return "Cancelado";
  if (normalized === "HOLD") return "Reservado";
  return normalized || "Sem status";
}

function bookingTone(status) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "CONFIRMED") return "emerald";
  if (normalized === "CANCELLED") return "red";
  if (normalized === "HOLD") return "blue";
  return "slate";
}

function SurfaceCard({ className = "", children }) {
  const { isDark } = useThemeToggle();

  return (
    <section
      className={cls(
        "rounded-[30px] border p-5 sm:p-6",
        isDark
          ? "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(8,15,30,0.86))] shadow-[0_28px_70px_-46px_rgba(15,23,42,0.9)]"
          : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.92))] shadow-[0_28px_70px_-46px_rgba(15,23,42,0.22)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

function StatusPill({ tone = "emerald", label }) {
  const { isDark } = useThemeToggle();

  const tones = isDark
    ? {
        emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
        amber: "border-amber-400/20 bg-amber-400/10 text-amber-100",
        blue: "border-sky-400/20 bg-sky-400/10 text-sky-100",
        red: "border-red-400/20 bg-red-400/10 text-red-100",
        slate: "border-white/10 bg-white/5 text-slate-200",
      }
    : {
        emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
        amber: "border-amber-200 bg-amber-50 text-amber-700",
        blue: "border-sky-200 bg-sky-50 text-sky-700",
        red: "border-red-200 bg-red-50 text-red-700",
        slate: "border-slate-200 bg-white text-slate-700",
      };

  return (
    <span
      className={cls(
        "inline-flex w-fit items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]",
        tones[tone] || tones.emerald,
      )}
    >
      {label}
    </span>
  );
}

function StatTile({ label, value, hint = "", tone = "slate" }) {
  const { isDark } = useThemeToggle();

  const tones = isDark
    ? {
        emerald: "border-emerald-400/20 bg-emerald-400/10",
        blue: "border-sky-400/20 bg-sky-400/10",
        slate: "border-white/10 bg-white/[0.04]",
      }
    : {
        emerald: "border-emerald-200 bg-white/90",
        blue: "border-sky-200 bg-white/90",
        slate: "border-white/80 bg-white/85",
      };

  return (
    <div className={cls("rounded-[24px] border p-4", tones[tone] || tones.slate)}>
      <div
        className={cls(
          "text-[11px] font-bold uppercase tracking-[0.18em]",
          isDark ? "text-slate-400" : "text-slate-500",
        )}
      >
        {label}
      </div>
      <div className="mt-2 text-xl font-black tracking-[-0.04em]">{value}</div>
      {hint ? (
        <div className={cls("mt-2 text-xs leading-5", isDark ? "text-slate-300" : "text-slate-600")}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function InfoRow({ label, value, mono = false }) {
  const { isDark } = useThemeToggle();
  if (!value) return null;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className={cls("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>{label}</div>
      <div
        className={cls(
          "max-w-[68%] text-right text-sm font-semibold",
          mono ? "break-all font-mono text-[13px]" : "",
          isDark ? "text-slate-100" : "text-slate-900",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function NextStepCard({ icon: Icon, title, description, actionLabel, onClick, disabled = false, tone = "slate" }) {
  const { isDark } = useThemeToggle();
  const tones = isDark
    ? {
        slate: "border-white/10 bg-white/[0.04]",
        emerald: "border-emerald-400/20 bg-emerald-400/10",
        blue: "border-sky-400/20 bg-sky-400/10",
      }
    : {
        slate: "border-slate-200/80 bg-white/90",
        emerald: "border-emerald-200 bg-emerald-50",
        blue: "border-sky-200 bg-sky-50",
      };

  return (
    <div className={cls("rounded-[26px] border p-4", tones[tone] || tones.slate)}>
      <div className="flex items-start gap-3">
        <div
          className={cls(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
            isDark ? "bg-white/10 text-white" : "bg-white text-slate-700",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{title}</div>
          <div className={cls("mt-1 text-sm leading-6", isDark ? "text-slate-300" : "text-slate-600")}>
            {description}
          </div>
          {actionLabel ? (
            <div className="mt-4">
              <Button onClick={onClick} disabled={disabled} className="w-full">
                {actionLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function PublicOfferDone() {
  const { token } = useParams();
  const nav = useNavigate();
  const { isDark } = useThemeToggle();
  const [search] = useSearchParams();
  const bookingId = search.get("bookingId") || "";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const onPop = () => window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const qs = useMemo(() => {
    const next = new URLSearchParams();
    if (bookingId) next.set("bookingId", bookingId);
    const text = next.toString();
    return text ? `?${text}` : "";
  }, [bookingId]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr("");

      try {
        const data = await api(`/p/${token}/summary${qs}`);
        if (!data?.ok) {
          throw new Error(data?.error || "Falha ao carregar resumo.");
        }

        if (!data?.summary?.locked) {
          nav(`/p/${token}`, { replace: true });
          return;
        }

        if (alive) {
          setSummary(data.summary);
        }
      } catch (error) {
        if (alive) {
          setErr(error?.message || "Falha ao carregar resumo.");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [token, qs, nav]);

  const pageBg = cls(
    "min-h-screen px-4 py-6 sm:px-6 lg:px-8",
    isDark
      ? "bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.16),transparent_38%),linear-gradient(180deg,#020617,#0f172a_52%,#020617)] text-white"
      : "bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_38%),linear-gradient(180deg,#f8fafc,#eef2ff_48%,#f8fafc)] text-slate-950",
  );

  const heroCard = cls(
    "relative overflow-hidden rounded-[34px] border p-5 shadow-[0_36px_100px_-56px_rgba(15,23,42,0.55)] sm:p-8",
    isDark
      ? "border-white/10 bg-[linear-gradient(135deg,rgba(8,15,30,0.96),rgba(15,23,42,0.92),rgba(6,78,59,0.45))]"
      : "border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,245,249,0.95),rgba(236,253,245,0.96))]",
  );

  if (loading) {
    return (
      <div className={pageBg}>
        <div className="mx-auto max-w-5xl">
          <div className={heroCard}>
            <div className="relative space-y-5">
              <div className="flex items-center gap-3">
                <img src={brand} alt="LuminorPay" className="h-11 w-11 rounded-2xl object-cover" />
                <div>
                  <p className={cls("text-xs font-semibold uppercase tracking-[0.28em]", isDark ? "text-sky-200/80" : "text-sky-700/80")}>
                    Resumo final
                  </p>
                  <h1 className="text-2xl font-semibold">Carregando sua confirmacao</h1>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <SurfaceCard className={cls("space-y-3", isDark ? "bg-white/5" : "bg-white/80")}>
                  <div className="h-4 w-32 animate-pulse rounded-full bg-current/10" />
                  <div className="h-10 w-3/4 animate-pulse rounded-full bg-current/10" />
                  <div className="h-4 w-full animate-pulse rounded-full bg-current/10" />
                </SurfaceCard>
                <SurfaceCard className={cls("space-y-3", isDark ? "bg-white/5" : "bg-white/80")}>
                  <div className="h-4 w-24 animate-pulse rounded-full bg-current/10" />
                  <div className="h-24 animate-pulse rounded-[28px] bg-current/10" />
                </SurfaceCard>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className={pageBg}>
        <div className="mx-auto max-w-3xl">
          <SurfaceCard className={isDark ? "border-red-400/20" : "border-red-200"}>
            <div className="flex items-start gap-3">
              <CircleAlert className={cls("mt-0.5 h-5 w-5 shrink-0", isDark ? "text-red-300" : "text-red-600")} />
              <div>
                <div className="text-lg font-black tracking-[-0.03em]">Nao foi possivel carregar o resumo</div>
                <div className={cls("mt-2 text-sm leading-6", isDark ? "text-slate-300" : "text-slate-600")}>
                  {err}
                </div>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  const s = summary || {};
  const offer = s.offer || {};
  const booking = s.booking || {};
  const selfService = s.selfService || {};
  const payment = s.payment || offer.payment || {};
  const isServiceOffer = String(offer.offerType || "").trim().toLowerCase() !== "product";
  const manageHref =
    booking.id || bookingId
      ? `/p/${token}/manage?bookingId=${encodeURIComponent(booking.id || bookingId)}`
      : "";

  const rawItems = Array.isArray(offer.items)
    ? offer.items
    : Array.isArray(offer.products)
      ? offer.products
      : [];

  const items = rawItems
    .map((item, index) => {
      const name =
        String(item?.name || item?.title || item?.description || item?.produto || "").trim() ||
        `Item ${index + 1}`;
      const qty = Math.max(1, safeInt(item?.qty ?? item?.quantity ?? item?.qtd ?? 1, 1));
      const unitCents = Math.max(
        0,
        safeInt(
          item?.unitCents ??
            item?.priceCents ??
            item?.unitPriceCents ??
            item?.valorUnitCents ??
            0,
          0,
        ),
      );

      return {
        name,
        qty,
        unitCents,
        subtotalCents: qty * unitCents,
      };
    })
    .filter((item) => item.name);

  const hasItems = items.length > 0;
  const itemsSubtotalCents = items.reduce((acc, item) => acc + item.subtotalCents, 0);
  const totalCents = safeInt(s.totalCents ?? offer.totalCents ?? offer.amountCents ?? 0, 0);
  const paidNowCents = safeInt(s.amountToChargeCents ?? 0, 0);
  const remainingCents = s.depositEnabled ? Math.max(totalCents - paidNowCents, 0) : 0;
  const isDeposit = !!s.depositEnabled;
  const paidLabel = isDeposit ? "Sinal pago" : "Pagamento integral";
  const notes = offer.notes || offer.observations || offer.observacao || offer.obs || "";
  const bookingLabel = fmtBookingRange(booking.startAt, booking.endAt);
  const pixStatus = String(payment.lastPixStatus || payment.pixStatus || payment.status || "").trim().toUpperCase();
  const txid = payment.txid || payment.pixTxid || payment.providerTxid || "";
  const endToEndId = payment.endToEndId || payment.e2eId || payment.endToEnd || "";

  return (
    <div className={pageBg}>
      <div className="mx-auto max-w-5xl space-y-6">
        <section className={heroCard}>
          <div
            className={cls(
              "pointer-events-none absolute inset-0",
              isDark
                ? "bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.14),transparent_28%)]"
                : "bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_28%)]",
            )}
          />

          <div className="relative space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <img src={brand} alt="LuminorPay" className="h-11 w-11 rounded-2xl object-cover shadow-sm" />
                <div className="min-w-0">
                  <p
                    className={cls(
                      "text-[11px] font-semibold uppercase tracking-[0.28em]",
                      isDark ? "text-sky-200/80" : "text-sky-700/80",
                    )}
                  >
                    Etapa concluida
                  </p>
                  <h1 className="truncate text-2xl font-semibold sm:text-3xl">Pagamento confirmado</h1>
                </div>
              </div>

              <StatusPill tone="emerald" label="Tudo certo" />
            </div>

            <div className="space-y-3">
              <h2 className="max-w-2xl text-2xl font-semibold leading-tight sm:text-[2rem]">
                Seu resumo final esta pronto.
              </h2>
              <p className={cls("max-w-2xl text-sm sm:text-base", isDark ? "text-slate-300" : "text-slate-600")}>
                Confira o que foi contratado, o valor pago e, se houver agendamento, os dados da sua reserva em um so lugar.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile
                label="Total contratado"
                value={fmtBRL(totalCents)}
                hint={offer.title || "Resumo da proposta"}
              />
              <StatTile
                label={paidLabel}
                value={fmtBRL(paidNowCents)}
                hint={s.paidAt ? `Pago em ${fmtDateTime(s.paidAt)}` : "Pago via Pix"}
                tone="emerald"
              />
              <StatTile
                label={bookingLabel ? "Horario" : "Status"}
                value={bookingLabel || bookingStatusLabel(booking.status)}
                hint={
                  bookingLabel
                    ? "Reserva vinculada ao pagamento"
                    : isDeposit
                      ? `Saldo restante: ${fmtBRL(remainingCents)}`
                      : "Etapa final concluida"
                }
                tone="blue"
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <NextStepCard
                icon={ReceiptText}
                title="Guarde este resumo"
                description="Esta pagina mostra o valor pago, os identificadores Pix e os dados finais da proposta para consulta segura."
                tone="slate"
              />
              {isServiceOffer && (booking.id || bookingId) ? (
                <NextStepCard
                  icon={CalendarClock}
                  title="Gerencie sua reserva se precisar"
                  description={
                    selfService?.reason && !selfService?.eligible
                      ? selfService.reason
                      : "Se precisar, voce pode reagendar ou cancelar usando este mesmo link de autoatendimento."
                  }
                  actionLabel="Gerenciar horario"
                  onClick={() => nav(manageHref)}
                  disabled={!manageHref}
                  tone="blue"
                />
              ) : (
                <NextStepCard
                  icon={ShieldCheck}
                  title="Tudo concluido com seguranca"
                  description="O pagamento ja foi confirmado. Agora voce pode fechar a pagina ou guardar este link para consulta futura."
                  tone="emerald"
                />
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <SurfaceCard className="space-y-5">
            <div className="flex items-start gap-3">
              <div
                className={cls(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                  isDark ? "bg-cyan-400/10 text-cyan-200" : "bg-cyan-50 text-cyan-700",
                )}
              >
                <Package2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-black tracking-[-0.03em]">O que foi confirmado</div>
                <div className={cls("mt-1 text-sm leading-6", isDark ? "text-slate-300" : "text-slate-600")}>
                  Um resumo direto do que voce contratou.
                </div>
              </div>
            </div>

            {hasItems ? (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={`${item.name}:${index}`}
                    className={cls(
                      "rounded-[26px] border p-4",
                      isDark ? "border-white/10 bg-white/[0.04]" : "border-slate-200/80 bg-white/90",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{item.name}</div>
                        <div className={cls("mt-1 text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                          Qtd {item.qty} x {fmtBRL(item.unitCents)}
                        </div>
                      </div>
                      <div className="text-sm font-semibold">{fmtBRL(item.subtotalCents)}</div>
                    </div>
                  </div>
                ))}

                <div
                  className={cls(
                    "rounded-[26px] border px-4 py-3",
                    isDark ? "border-white/10 bg-white/[0.04]" : "border-slate-200/80 bg-slate-50",
                  )}
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className={isDark ? "text-slate-300" : "text-slate-600"}>Subtotal dos itens</span>
                    <span className="font-semibold">{fmtBRL(itemsSubtotalCents)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={cls(
                  "rounded-[28px] border p-5",
                  isDark ? "border-white/10 bg-white/[0.04]" : "border-slate-200/80 bg-white/90",
                )}
              >
                <div className="text-base font-semibold">{offer.title || "Servico contratado"}</div>
                {offer.description ? (
                  <div className={cls("mt-2 text-sm leading-6 whitespace-pre-wrap", isDark ? "text-slate-300" : "text-slate-600")}>
                    {offer.description}
                  </div>
                ) : (
                  <div className={cls("mt-2 text-sm", isDark ? "text-slate-300" : "text-slate-600")}>
                    O servico foi confirmado com pagamento registrado nesta proposta.
                  </div>
                )}

                {offer.durationMin ? (
                  <div
                    className={cls(
                      "mt-4 inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm",
                      isDark ? "border-white/10 bg-white/[0.05] text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700",
                    )}
                  >
                    <Clock3 className="h-4 w-4" />
                    Duracao prevista: {offer.durationMin} min
                  </div>
                ) : null}
              </div>
            )}

            {offer.policyText || notes ? (
              <div className="grid gap-3">
                {offer.policyText ? (
                  <div
                    className={cls(
                      "rounded-[26px] border p-4",
                      isDark ? "border-white/10 bg-white/[0.04]" : "border-slate-200/80 bg-white/90",
                    )}
                  >
                    <div className={cls("text-[11px] font-bold uppercase tracking-[0.18em]", isDark ? "text-slate-400" : "text-slate-500")}>
                      Politica
                    </div>
                    <div className={cls("mt-2 text-sm leading-6 whitespace-pre-wrap", isDark ? "text-slate-300" : "text-slate-600")}>
                      {offer.policyText}
                    </div>
                  </div>
                ) : null}

                {notes ? (
                  <div
                    className={cls(
                      "rounded-[26px] border p-4",
                      isDark ? "border-white/10 bg-white/[0.04]" : "border-slate-200/80 bg-white/90",
                    )}
                  >
                    <div className={cls("text-[11px] font-bold uppercase tracking-[0.18em]", isDark ? "text-slate-400" : "text-slate-500")}>
                      Observacoes
                    </div>
                    <div className={cls("mt-2 text-sm leading-6 whitespace-pre-wrap", isDark ? "text-slate-300" : "text-slate-600")}>
                      {String(notes)}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </SurfaceCard>

          <SurfaceCard className="space-y-5 lg:sticky lg:top-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div
                  className={cls(
                    "flex h-11 w-11 items-center justify-center rounded-2xl",
                    isDark ? "bg-emerald-400/10 text-emerald-200" : "bg-emerald-50 text-emerald-700",
                  )}
                >
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-lg font-black tracking-[-0.03em]">Resumo final</div>
                  <div className={cls("text-sm", isDark ? "text-slate-300" : "text-slate-600")}>
                    {offer.customerName ? `Para ${offer.customerName}` : "Tudo confirmado com sucesso"}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div
                className={cls(
                  "rounded-2xl border px-4 py-3",
                  isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50",
                )}
              >
                <div className={cls("text-[11px] font-semibold uppercase tracking-[0.18em]", isDark ? "text-slate-400" : "text-slate-500")}>
                  Pago agora
                </div>
                <div className="mt-2 text-base font-semibold">{fmtBRL(paidNowCents)}</div>
                <div className={cls("mt-1 text-xs", isDark ? "text-slate-400" : "text-slate-500")}>Pix confirmado</div>
              </div>

              <div
                className={cls(
                  "rounded-2xl border px-4 py-3",
                  isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50",
                )}
              >
                <div className={cls("text-[11px] font-semibold uppercase tracking-[0.18em]", isDark ? "text-slate-400" : "text-slate-500")}>
                  Total
                </div>
                <div className="mt-2 text-base font-semibold">{fmtBRL(totalCents)}</div>
                <div className={cls("mt-1 text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                  {isDeposit ? "Valor total da proposta" : "Quitado"}
                </div>
              </div>
            </div>

            <div
              className={cls(
                "rounded-[26px] border px-4 py-4",
                isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50",
              )}
            >
              <div className="flex items-start gap-3">
                <Wallet className={cls("mt-0.5 h-5 w-5 shrink-0", isDark ? "text-cyan-200" : "text-cyan-700")} />
                <div className="min-w-0 flex-1 space-y-3">
                  <InfoRow label="Status do pagamento" value={pixStatus || "CONFIRMADO"} />
                  <InfoRow label="Data do pagamento" value={fmtDateTime(s.paidAt)} />
                  {isDeposit ? <InfoRow label="Saldo restante" value={fmtBRL(remainingCents)} /> : null}
                  <InfoRow label="TXID" value={txid} mono />
                  <InfoRow label="EndToEnd" value={endToEndId} mono />
                </div>
              </div>
            </div>

            {(booking.id || bookingId) ? (
              <div
                className={cls(
                  "rounded-[26px] border px-4 py-4",
                  isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50",
                )}
              >
                <div className="flex items-start gap-3">
                  <CalendarClock className={cls("mt-0.5 h-5 w-5 shrink-0", isDark ? "text-sky-200" : "text-sky-700")} />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">Reserva</span>
                      <StatusPill tone={bookingTone(booking.status)} label={bookingStatusLabel(booking.status)} />
                    </div>
                    <InfoRow label="Codigo" value={booking.id || bookingId} mono />
                    <InfoRow label="Horario" value={bookingLabel} />
                    {booking.cancelReason ? (
                      <div
                        className={cls(
                          "rounded-2xl border px-3 py-3 text-sm",
                          isDark ? "border-amber-400/20 bg-amber-400/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-700",
                        )}
                      >
                        Motivo informado: {booking.cancelReason}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {isServiceOffer && (booking.id || bookingId) ? (
              <div
                className={cls(
                  "rounded-[26px] border px-4 py-4",
                  isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/90",
                )}
              >
                <div className="flex items-start gap-3">
                  <ShieldCheck className={cls("mt-0.5 h-5 w-5 shrink-0", isDark ? "text-emerald-200" : "text-emerald-700")} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">Gerenciar horario</div>
                    <div className={cls("mt-1 text-sm leading-6", isDark ? "text-slate-300" : "text-slate-600")}>
                      Se precisar, voce pode reagendar ou cancelar pelo mesmo link.
                    </div>

                    {selfService?.reason && !selfService?.eligible ? (
                      <div
                        className={cls(
                          "mt-3 rounded-2xl border px-3 py-3 text-sm",
                          isDark ? "border-amber-400/20 bg-amber-400/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-700",
                        )}
                      >
                        {selfService.reason}
                      </div>
                    ) : null}

                    <div className="mt-4">
                      <Button onClick={() => nav(manageHref)} disabled={!manageHref} className="w-full">
                        Gerenciar horario
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div
              className={cls(
                "rounded-[26px] border px-4 py-4 text-sm leading-6",
                isDark ? "border-white/10 bg-white/5 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600",
              )}
            >
              <div className="flex items-start gap-3">
                <ReceiptText className="mt-0.5 h-5 w-5 shrink-0" />
                <span>Esta etapa foi concluida. Voce pode fechar esta pagina ou guardar este link com seguranca.</span>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
