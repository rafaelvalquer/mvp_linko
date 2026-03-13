import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CircleAlert,
  Clock3,
  Lock,
  Sparkles,
  Wallet,
} from "lucide-react";
import { api } from "../app/api.js";
import useThemeToggle from "../app/useThemeToggle.js";
import brand from "../assets/brand.png";
import Button from "../components/appui/Button.jsx";
import { Input } from "../components/appui/Input.jsx";

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

function toDateInputValue(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateLabel(dateValue) {
  if (!dateValue) return "";
  const d = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const label = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function fmtDateFromIso(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const label = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function fmtRange(startAt, endAt) {
  if (!startAt) return "";
  const start = fmtTime(startAt);
  const end = fmtTime(endAt);
  return end ? `${start} - ${end}` : start;
}

function normStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function resolveSlotStatus(slot) {
  const raw =
    normStatus(slot?.status) ||
    normStatus(slot?.state) ||
    normStatus(slot?.availability) ||
    normStatus(slot?.slotStatus) ||
    normStatus(slot?.bookingStatus) ||
    normStatus(slot?.booking?.status);

  const hasBookingRef =
    !!slot?.bookingId ||
    !!slot?.reservationId ||
    !!slot?.holdId ||
    !!slot?.booking?._id ||
    !!slot?.booking?.id;

  const isAvailableBool =
    slot?.isAvailable ?? slot?.available ?? slot?.isFree ?? slot?.free;

  if (hasBookingRef) {
    if (
      ["CONFIRMED", "BOOKED", "PAID", "CONFIRMADO"].includes(raw) ||
      ["CONFIRMED", "PAID"].includes(normStatus(slot?.booking?.paymentStatus))
    ) {
      return "CONFIRMED";
    }
    return "HOLD";
  }

  if (isAvailableBool === false) {
    if (!raw) return "HOLD";
    if (["FREE", "AVAILABLE", "OPEN", "LIVRE"].includes(raw)) return "HOLD";
    return raw;
  }

  if (["FREE", "AVAILABLE", "OPEN", "LIVRE"].includes(raw)) return "FREE";
  if (["HOLD", "HELD", "RESERVED", "RESERVADO", "PENDING", "WAITING", "WAITING_CONFIRMATION"].includes(raw)) return "HOLD";
  if (["CONFIRMED", "BOOKED", "PAID", "CONFIRMADO", "CONFIRMADA"].includes(raw)) return "CONFIRMED";
  if (["BLOCKED", "UNAVAILABLE", "BUSY", "INDISPONIVEL"].includes(raw)) return "BLOCKED";
  return raw || "FREE";
}

function Pill({ tone = "amber", label }) {
  const { isDark } = useThemeToggle();
  const map = isDark
    ? {
        amber: "border-amber-400/20 bg-amber-400/10 text-amber-100",
        blue: "border-sky-400/20 bg-sky-400/10 text-sky-100",
        emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
        slate: "border-white/10 bg-white/5 text-slate-200",
      }
    : {
        amber: "border-amber-200 bg-amber-50 text-amber-700",
        blue: "border-sky-200 bg-sky-50 text-sky-700",
        emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
        slate: "border-slate-200 bg-white text-slate-700",
      };

  return (
    <span
      className={cls(
        "inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]",
        map[tone] || map.amber,
      )}
    >
      {label}
    </span>
  );
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

export default function PublicSchedule() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isDark } = useThemeToggle();

  const [offer, setOffer] = useState(null);
  const [offerErr, setOfferErr] = useState("");
  const [date, setDate] = useState(toDateInputValue());
  const [slots, setSlots] = useState([]);
  const [slotsNow, setSlotsNow] = useState(null);
  const [slotsErr, setSlotsErr] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState(null);

  function onGoPay() {
    const bookingId = booking?.id || booking?._id || booking?.bookingId;
    if (!bookingId) return;
    navigate(`/p/${token}/pay?bookingId=${encodeURIComponent(bookingId)}`);
  }

  useEffect(() => {
    setOffer(null);
    setOfferErr("");

    api(`/p/${token}`)
      .then((d) => {
        const step = String(d?.flow?.step || "").toUpperCase();

        if (step && step !== "SCHEDULE") {
          const bookingId = String(d?.flow?.bookingId || d?.booking?.id || "").trim();
          const query = bookingId ? `?bookingId=${encodeURIComponent(bookingId)}` : "";

          if (step === "PAYMENT") {
            navigate(`/p/${token}/pay${query}`, { replace: true });
            return;
          }
          if (step === "DONE") {
            navigate(`/p/${token}/done${query}`, { replace: true });
            return;
          }

          navigate(`/p/${token}`, { replace: true });
          return;
        }

        setOffer(d.offer);
      })
      .catch((e) => setOfferErr(e?.message || "Falha ao carregar proposta."));
  }, [token, navigate]);

  const view = useMemo(() => {
    const o = offer || {};
    const totalCents =
      (Number.isFinite(o.totalCents) && o.totalCents) ||
      (Number.isFinite(o.amountCents) && o.amountCents) ||
      0;
    const depositPctRaw = Number(o.depositPct);
    const depositPct = Number.isFinite(depositPctRaw) && depositPctRaw > 0 ? depositPctRaw : 0;
    const depositEnabled = o.depositEnabled === false ? false : depositPct > 0;
    const depositCents = depositEnabled ? Math.round((totalCents * depositPct) / 100) : 0;
    const remainingCents = Math.max(0, totalCents - depositCents);
    return { totalCents, depositEnabled, depositCents, remainingCents };
  }, [offer]);

  const now = safeDate(slotsNow) || new Date();
  const isToday = date === toDateInputValue(new Date());

  const getSlotUi = useCallback(
    (slot) => {
      const status = resolveSlotStatus(slot);
      const start = safeDate(slot?.startAt);
      const isPast = isToday && start ? start.getTime() <= now.getTime() - 90_000 : false;
      const disabled = status !== "FREE" || isPast;
      const label = isPast
        ? "Horario passado"
        : status === "FREE"
          ? "Disponivel"
          : status === "HOLD" || status === "CONFIRMED"
            ? "Ja reservado"
            : "Indisponivel";
      const tone = isPast ? "PAST" : status === "FREE" ? "FREE" : "BLOCKED";
      return { disabled, label, tone };
    },
    [isToday, now],
  );

  const fetchSlots = useCallback(async () => {
    if (!offer) return;

    setLoadingSlots(true);
    setSlotsErr("");

    try {
      const d = await api(`/p/${token}/slots?date=${encodeURIComponent(date)}`);
      setSlotsNow(d?.now || null);
      setSlots(Array.isArray(d?.slots) ? d.slots : []);
    } catch (e) {
      setSlots([]);
      setSlotsErr(e?.message || "Falha ao carregar horarios.");
    } finally {
      setLoadingSlots(false);
    }
  }, [offer, token, date]);

  useEffect(() => {
    if (!offer) return;
    setSelected(null);
    setBooking(null);
    fetchSlots();
  }, [offer, date, fetchSlots]);

  useEffect(() => {
    if (!offer || booking || loadingSlots) return undefined;
    const id = setInterval(fetchSlots, 12_000);
    return () => clearInterval(id);
  }, [offer, booking, loadingSlots, fetchSlots]);

  useEffect(() => {
    if (!selected) return;
    const current = slots.find(
      (slot) => slot?.startAt === selected?.startAt && slot?.endAt === selected?.endAt,
    );
    if (!current || getSlotUi(current).disabled) {
      setSelected(null);
    }
  }, [slots, selected, getSlotUi]);

  async function confirmBooking() {
    if (!selected || getSlotUi(selected).disabled) return;

    setBusy(true);
    setSlotsErr("");

    try {
      const res = await api(`/p/${token}/book`, {
        method: "POST",
        body: JSON.stringify({
          startAt: selected.startAt,
          endAt: selected.endAt,
          customerName: offer?.customerName || "",
          customerWhatsApp: offer?.customerWhatsApp || "",
        }),
      });

      if (!res?.ok) throw new Error(res?.error || "Falha ao criar reserva.");

      setBooking(res.booking);

      try {
        const d = await api(`/p/${token}/slots?date=${encodeURIComponent(date)}`);
        setSlotsNow(d?.now || null);
        setSlots(Array.isArray(d?.slots) ? d.slots : []);
      } catch {}
    } catch (e) {
      const msg = e?.message || "Falha ao criar reserva.";
      setBooking(null);

      if (/indisponivel/i.test(msg) || /indispon[ií]vel/i.test(msg)) {
        setSlotsErr("Esse horario acabou de ser reservado. Escolha outro.");
        setSelected(null);
        try {
          const d = await api(`/p/${token}/slots?date=${encodeURIComponent(date)}`);
          setSlotsNow(d?.now || null);
          setSlots(Array.isArray(d?.slots) ? d.slots : []);
        } catch {}
      } else {
        setSlotsErr(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  const offerStatus = String(offer?.status || "").trim().toUpperCase();
  const customerName = offer?.customerName || "Cliente";
  const dateLabel = fmtDateLabel(date);
  const bookingDateLabel = fmtDateFromIso(booking?.startAt);
  const selectedTimeLabel = fmtRange(selected?.startAt, selected?.endAt);
  const bookingTimeLabel = fmtRange(booking?.startAt, booking?.endAt) || selectedTimeLabel;
  const lastUpdated = fmtTime(slotsNow);

  const statusMeta = booking
    ? { label: "Horario reservado", tone: "emerald", summary: "Seu horario foi reservado. Falta apenas o pagamento." }
    : offerStatus === "ACCEPTED"
      ? { label: "Proposta aceita", tone: "blue", summary: "Escolha uma data e um horario para seguir." }
      : { label: "Agendamento", tone: "amber", summary: "Escolha uma data, reserve um horario e siga para o pagamento." };

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

  if (offerErr) {
    return (
      <div className={pageBg}>
        <div className="mx-auto max-w-xl">
          <SurfaceCard className="space-y-4 text-center">
            <div
              className={cls(
                "mx-auto flex h-14 w-14 items-center justify-center rounded-2xl",
                isDark ? "bg-rose-400/10 text-rose-200" : "bg-rose-50 text-rose-600",
              )}
            >
              <CircleAlert className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">Nao foi possivel abrir o agendamento</h1>
              <p className={cls("text-sm", isDark ? "text-slate-300" : "text-slate-600")}>{offerErr}</p>
            </div>
            <Button variant="secondary" onClick={() => navigate(`/p/${token}`)}>
              Voltar
            </Button>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className={pageBg}>
        <div className="mx-auto max-w-5xl">
          <div className={heroCard}>
            <div className="relative space-y-5">
              <div className="flex items-center gap-3">
                <img src={brand} alt="Luminor Pay" className="h-10 w-10 rounded-2xl object-cover" />
                <div>
                  <p className={cls("text-xs font-semibold uppercase tracking-[0.28em]", isDark ? "text-sky-200/80" : "text-sky-700/80")}>
                    Agendamento
                  </p>
                  <h1 className="text-2xl font-semibold">Preparando sua agenda</h1>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                <SurfaceCard className={cls("space-y-3", isDark ? "bg-white/5" : "bg-white/80")}>
                  <div className="h-4 w-32 animate-pulse rounded-full bg-current/10" />
                  <div className="h-9 w-3/4 animate-pulse rounded-full bg-current/10" />
                  <div className="h-4 w-full animate-pulse rounded-full bg-current/10" />
                </SurfaceCard>
                <SurfaceCard className={cls("space-y-3", isDark ? "bg-white/5" : "bg-white/80")}>
                  <div className="h-4 w-24 animate-pulse rounded-full bg-current/10" />
                  <div className="h-16 animate-pulse rounded-3xl bg-current/10" />
                </SurfaceCard>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const actionLabel = booking ? "Ir para pagamento" : "Reservar horario";
  const actionDisabled =
    busy || loadingSlots || (!booking && (!selected || getSlotUi(selected).disabled));

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
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <img src={brand} alt="Luminor Pay" className="h-11 w-11 rounded-2xl object-cover shadow-sm" />
                <div className="min-w-0">
                  <p
                    className={cls(
                      "text-[11px] font-semibold uppercase tracking-[0.28em]",
                      isDark ? "text-sky-200/80" : "text-sky-700/80",
                    )}
                  >
                    Etapa 2 de 3
                  </p>
                  <h1 className="truncate text-2xl font-semibold sm:text-3xl">Escolha seu horario</h1>
                </div>
              </div>

              <Button variant="secondary" size="sm" onClick={() => navigate(`/p/${token}`)}>
                Voltar
              </Button>
            </div>

            <div className="space-y-3">
              <Pill tone={statusMeta.tone} label={statusMeta.label} />
              <div className="space-y-2">
                <h2 className="max-w-2xl text-2xl font-semibold leading-tight sm:text-[2rem]">
                  Reserve e finalize em poucos passos.
                </h2>
                <p className={cls("max-w-2xl text-sm sm:text-base", isDark ? "text-slate-300" : "text-slate-600")}>
                  {statusMeta.summary}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Pill tone="slate" label={`${offer?.durationMin || 0} min`} />
              <Pill
                tone="slate"
                label={
                  view.depositEnabled
                    ? `${fmtBRL(view.depositCents)} de entrada`
                    : fmtBRL(view.totalCents)
                }
              />
              {(bookingTimeLabel || selectedTimeLabel) ? (
                <Pill tone="slate" label={bookingTimeLabel || selectedTimeLabel} />
              ) : null}
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <SurfaceCard className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <p className={cls("text-xs font-semibold uppercase tracking-[0.22em]", isDark ? "text-slate-400" : "text-slate-500")}>
                  Agendamento
                </p>
                <h2 className="text-xl font-semibold">Escolha a data e o horario</h2>
                <p className={cls("text-sm", isDark ? "text-slate-300" : "text-slate-600")}>
                  Veja os horarios livres e toque no melhor para voce.
                </p>
              </div>

              {lastUpdated ? <Pill tone="slate" label={`Atualizado ${lastUpdated}`} /> : null}
            </div>

            <div className="space-y-3">
              <label className="space-y-2">
                <span className={cls("text-sm font-medium", isDark ? "text-slate-200" : "text-slate-700")}>
                  Data desejada
                </span>
                <Input
                  type="date"
                  value={date}
                  min={toDateInputValue()}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={!!booking}
                  className={cls(
                    "h-12 rounded-2xl border text-base shadow-none",
                    isDark
                      ? "border-white/10 bg-white/5 text-white"
                      : "border-slate-200 bg-white text-slate-900",
                  )}
                />
              </label>

              <div
                className={cls(
                  "rounded-2xl border px-4 py-3 text-sm",
                  isDark ? "border-white/10 bg-white/5 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700",
                )}
              >
                <div className="flex items-center gap-2 font-medium">
                  <CalendarDays className="h-4 w-4" />
                  <span>{dateLabel || "Escolha uma data"}</span>
                </div>
                <p className={cls("mt-1 text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                  Os horarios abaixo sao atualizados automaticamente.
                </p>
              </div>
            </div>

            {slotsErr ? (
              <div
                className={cls(
                  "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
                  isDark ? "border-rose-400/20 bg-rose-400/10 text-rose-100" : "border-rose-200 bg-rose-50 text-rose-700",
                )}
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{slotsErr}</span>
              </div>
            ) : null}

            {isToday && !booking ? (
              <div
                className={cls(
                  "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
                  isDark ? "border-amber-400/20 bg-amber-400/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-700",
                )}
              >
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Horarios que ja passaram ficam bloqueados automaticamente.</span>
              </div>
            ) : null}

            {loadingSlots ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className={cls(
                      "h-24 animate-pulse rounded-3xl border",
                      isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-100",
                    )}
                  />
                ))}
              </div>
            ) : slots.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {slots.map((slot) => {
                  const ui = getSlotUi(slot);
                  const active =
                    !!selected &&
                    selected.startAt === slot.startAt &&
                    selected.endAt === slot.endAt;

                  return (
                    <button
                      key={`${slot.startAt}-${slot.endAt}`}
                      type="button"
                      disabled={ui.disabled || !!booking}
                      onClick={() => setSelected(slot)}
                      className={cls(
                        "rounded-[26px] border px-4 py-4 text-left transition duration-200",
                        "focus:outline-none focus:ring-2 focus:ring-sky-400/40",
                        active
                          ? isDark
                            ? "border-sky-300/70 bg-sky-400/15 shadow-[0_20px_45px_-30px_rgba(56,189,248,0.9)]"
                            : "border-sky-300 bg-sky-50 shadow-[0_20px_45px_-30px_rgba(14,165,233,0.45)]"
                          : ui.disabled || booking
                            ? isDark
                              ? "border-white/8 bg-white/[0.03] text-slate-400"
                              : "border-slate-200 bg-slate-50 text-slate-400"
                            : isDark
                              ? "border-white/10 bg-white/5 text-white hover:border-sky-300/40 hover:bg-sky-400/10"
                              : "border-slate-200 bg-white text-slate-900 hover:border-sky-200 hover:bg-sky-50/70",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold">{fmtTime(slot.startAt)}</p>
                          <p className={cls("mt-1 text-xs", active ? (isDark ? "text-sky-100" : "text-sky-700") : isDark ? "text-slate-400" : "text-slate-500")}>
                            {fmtRange(slot.startAt, slot.endAt)}
                          </p>
                        </div>
                        {ui.disabled || booking ? (
                          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                        ) : (
                          <Sparkles className={cls("mt-0.5 h-4 w-4 shrink-0", active ? (isDark ? "text-sky-100" : "text-sky-700") : isDark ? "text-sky-200" : "text-sky-600")} />
                        )}
                      </div>

                      <p
                        className={cls(
                          "mt-3 text-xs font-medium",
                          active
                            ? isDark
                              ? "text-sky-100"
                              : "text-sky-700"
                            : ui.disabled || booking
                              ? isDark
                                ? "text-slate-400"
                                : "text-slate-500"
                              : isDark
                                ? "text-slate-300"
                                : "text-slate-600",
                        )}
                      >
                        {booking ? "Ja reservado" : ui.label}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div
                className={cls(
                  "rounded-[28px] border px-5 py-8 text-center",
                  isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50",
                )}
              >
                <p className="text-base font-semibold">Nenhum horario livre nesta data</p>
                <p className={cls("mt-2 text-sm", isDark ? "text-slate-300" : "text-slate-600")}>
                  Escolha outro dia para ver novas opcoes.
                </p>
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard className="space-y-5 lg:sticky lg:top-6">
            <div className="space-y-1">
              <p className={cls("text-xs font-semibold uppercase tracking-[0.22em]", isDark ? "text-slate-400" : "text-slate-500")}>
                Resumo
              </p>
              <h2 className="text-xl font-semibold">{offer?.title || "Sua proposta"}</h2>
              <p className={cls("text-sm", isDark ? "text-slate-300" : "text-slate-600")}>
                Para {customerName}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div
                className={cls(
                  "rounded-2xl border px-4 py-3",
                  isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50",
                )}
              >
                <p className={cls("text-[11px] font-semibold uppercase tracking-[0.18em]", isDark ? "text-slate-400" : "text-slate-500")}>
                  Valor
                </p>
                <p className="mt-2 text-base font-semibold">
                  {view.depositEnabled ? fmtBRL(view.depositCents) : fmtBRL(view.totalCents)}
                </p>
                <p className={cls("mt-1 text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                  {view.depositEnabled ? "Entrada para reservar" : "Pagamento da proposta"}
                </p>
              </div>

              <div
                className={cls(
                  "rounded-2xl border px-4 py-3",
                  isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50",
                )}
              >
                <p className={cls("text-[11px] font-semibold uppercase tracking-[0.18em]", isDark ? "text-slate-400" : "text-slate-500")}>
                  Duracao
                </p>
                <p className="mt-2 text-base font-semibold">{offer?.durationMin || 0} min</p>
                <p className={cls("mt-1 text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                  Tempo reservado na agenda
                </p>
              </div>
            </div>

            <div
              className={cls(
                "rounded-[26px] border px-4 py-4",
                booking
                  ? isDark
                    ? "border-emerald-400/20 bg-emerald-400/10"
                    : "border-emerald-200 bg-emerald-50"
                  : selected
                    ? isDark
                      ? "border-sky-400/20 bg-sky-400/10"
                      : "border-sky-200 bg-sky-50"
                    : isDark
                      ? "border-white/10 bg-white/5"
                      : "border-slate-200 bg-slate-50",
              )}
            >
              <p className={cls("text-[11px] font-semibold uppercase tracking-[0.18em]", isDark ? "text-slate-300" : "text-slate-500")}>
                {booking ? "Horario reservado" : selected ? "Horario escolhido" : "Proximo passo"}
              </p>

              {booking ? (
                <div className="mt-3 space-y-1">
                  <p className="text-base font-semibold">{bookingDateLabel || dateLabel}</p>
                  <p className={cls("text-sm", isDark ? "text-emerald-100" : "text-emerald-700")}>{bookingTimeLabel}</p>
                </div>
              ) : selected ? (
                <div className="mt-3 space-y-1">
                  <p className="text-base font-semibold">{dateLabel}</p>
                  <p className={cls("text-sm", isDark ? "text-sky-100" : "text-sky-700")}>{selectedTimeLabel}</p>
                </div>
              ) : (
                <p className={cls("mt-3 text-sm", isDark ? "text-slate-300" : "text-slate-600")}>
                  Selecione um horario para liberar a reserva.
                </p>
              )}
            </div>

            <Button
              className="h-12 w-full rounded-2xl text-base font-semibold"
              onClick={booking ? onGoPay : confirmBooking}
              disabled={actionDisabled}
            >
              <span>{busy ? "Confirmando..." : actionLabel}</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <div className={cls("rounded-2xl border px-4 py-3 text-sm", isDark ? "border-white/10 bg-white/5 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600")}>
              <div className="flex items-start gap-2">
                <Wallet className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  {booking
                    ? "Seu horario ja esta reservado. Agora e so seguir para o pagamento."
                    : view.depositEnabled
                      ? `Ao reservar, voce segue para pagar a entrada de ${fmtBRL(view.depositCents)}.`
                      : "Depois da reserva, voce segue direto para a etapa de pagamento."}
                </p>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
