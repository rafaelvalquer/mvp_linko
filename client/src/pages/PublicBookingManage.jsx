import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { api } from "../app/api.js";
import useThemeToggle from "../app/useThemeToggle.js";
import brand from "../assets/brand.png";
import Button from "../components/appui/Button.jsx";
import { Input, Textarea } from "../components/appui/Input.jsx";

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function dateInputValueFromIso(iso, timeZone = "America/Sao_Paulo") {
  const date = safeDate(iso);
  if (!date) return "";

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const map = {};
    for (const part of parts) {
      if (part.type !== "literal") map[part.type] = part.value;
    }

    if (map.year && map.month && map.day) {
      return `${map.year}-${map.month}-${map.day}`;
    }
  } catch {}

  return date.toISOString().slice(0, 10);
}

function fmtDateTime(iso, timeZone = "America/Sao_Paulo") {
  const date = safeDate(iso);
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toLocaleString("pt-BR");
  }
}

function fmtTime(iso, timeZone = "America/Sao_Paulo") {
  const date = safeDate(iso);
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

function bookingStatusLabel(status) {
  const normalized = String(status || "")
    .trim()
    .toUpperCase();

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

function slotStatusLabel(slot) {
  if (slot?.available === true) return "Disponivel";

  const reason = String(slot?.reason || "").trim().toUpperCase();
  if (reason === "MINIMUM_NOTICE") return "Fora do prazo";
  if (reason === "OCCUPIED") return "Ja reservado";
  if (reason === "PAST_SLOT") return "Horario passado";
  return "Indisponivel";
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

function StatusPill({ tone = "slate", label }) {
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
        tones[tone] || tones.slate,
      )}
    >
      {label}
    </span>
  );
}

function MetricCard({ label, value, hint = "", tone = "slate" }) {
  const { isDark } = useThemeToggle();

  const tones = isDark
    ? {
        emerald: "border-emerald-400/20 bg-emerald-400/10",
        blue: "border-sky-400/20 bg-sky-400/10",
        amber: "border-amber-400/20 bg-amber-400/10",
        slate: "border-white/10 bg-white/[0.04]",
      }
    : {
        emerald: "border-emerald-200 bg-white/90",
        blue: "border-sky-200 bg-white/90",
        amber: "border-amber-200 bg-white/90",
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
        <div
          className={cls(
            "mt-2 text-xs leading-5",
            isDark ? "text-slate-300" : "text-slate-600",
          )}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function SummaryRow({ label, value }) {
  const { isDark } = useThemeToggle();
  if (!value) return null;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className={cls("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>{label}</div>
      <div
        className={cls(
          "max-w-[68%] text-right text-sm font-semibold",
          isDark ? "text-slate-100" : "text-slate-900",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export default function PublicBookingManage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isDark } = useThemeToggle();
  const [search] = useSearchParams();
  const bookingId = search.get("bookingId") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [activeTab, setActiveTab] = useState("reschedule");

  const selfService = summary?.selfService || {};
  const booking = summary?.booking || {};
  const offer = summary?.offer || {};
  const timeZone = selfService?.timeZone || "America/Sao_Paulo";

  const manageQuery = useMemo(() => {
    if (!bookingId) return "";
    return `?bookingId=${encodeURIComponent(bookingId)}`;
  }, [bookingId]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError("");
      try {
        if (!bookingId) throw new Error("bookingId não informado.");

        const response = await api(`/p/${token}/manage${manageQuery}`);
        if (!response?.ok || !response?.summary) {
          throw new Error(response?.error || "Falha ao carregar o agendamento.");
        }

        if (!alive) return;

        setSummary(response.summary);
        setDate(
          dateInputValueFromIso(
            response.summary?.booking?.startAt,
            response.summary?.selfService?.timeZone,
          ),
        );
        setActiveTab(
          response.summary?.selfService?.canReschedule === true
            ? "reschedule"
            : "cancel",
        );
      } catch (err) {
        if (alive) setError(err?.message || "Falha ao carregar o agendamento.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token, manageQuery, bookingId]);

  useEffect(() => {
    if (
      activeTab !== "reschedule" ||
      !date ||
      !summary?.booking?.id ||
      selfService?.canReschedule !== true
    ) {
      setSlots([]);
      setSelectedSlot(null);
      return;
    }

    let alive = true;

    (async () => {
      setSlotsLoading(true);
      setSlotsError("");
      try {
        const response = await api(
          `/p/${token}/manage/slots?bookingId=${encodeURIComponent(
            summary.booking.id,
          )}&date=${encodeURIComponent(date)}`,
        );
        if (!alive) return;
        setSlots(Array.isArray(response?.slots) ? response.slots : []);
      } catch (err) {
        if (!alive) return;
        setSlots([]);
        setSlotsError(err?.reason || err?.message || "Falha ao carregar horários.");
      } finally {
        if (alive) setSlotsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    token,
    date,
    activeTab,
    summary?.booking?.id,
    selfService?.canReschedule,
  ]);

  async function handleReschedule() {
    if (!selectedSlot || !summary?.booking?.id) return;

    setSubmitting(true);
    setSuccessMsg("");
    setError("");
    try {
      const response = await api(`/p/${token}/manage/reschedule`, {
        method: "POST",
        body: JSON.stringify({
          bookingId: summary.booking.id,
          startAt: selectedSlot.startAt,
          endAt: selectedSlot.endAt,
        }),
      });

      const nextBookingId = response?.booking?.id || summary.booking.id;
      navigate(`/p/${token}/done?bookingId=${encodeURIComponent(nextBookingId)}`, {
        replace: true,
      });
    } catch (err) {
      setError(err?.reason || err?.message || "Falha ao reagendar.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!summary?.booking?.id) return;

    setSubmitting(true);
    setSuccessMsg("");
    setError("");
    try {
      const response = await api(`/p/${token}/manage/cancel`, {
        method: "POST",
        body: JSON.stringify({
          bookingId: summary.booking.id,
          reason: cancelReason,
        }),
      });

      setSummary((prev) =>
        prev
          ? {
              ...prev,
              booking: response.booking,
              selfService: response.selfService,
            }
          : prev,
      );
      setSuccessMsg("Agendamento cancelado com sucesso.");
    } catch (err) {
      setError(err?.reason || err?.message || "Falha ao cancelar.");
    } finally {
      setSubmitting(false);
    }
  }

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

  const canManage =
    selfService?.canReschedule === true || selfService?.canCancel === true;
  const bookingSummary = fmtDateTime(booking.startAt, timeZone);
  const selectedSummary = selectedSlot
    ? fmtDateTime(selectedSlot.startAt, timeZone)
    : "";
  const heroCopy =
    selfService?.reason && !selfService?.eligible
      ? selfService.reason
      : `Voce pode ajustar o agendamento ate ${selfService.minimumNoticeLabel || "24 horas"} antes do horario.`;

  if (loading) {
    return (
      <div className={pageBg}>
        <div className="mx-auto max-w-5xl">
          <div className={heroCard}>
            <div className="relative space-y-5">
              <div className="flex items-center gap-3">
                <img src={brand} alt="Luminor Pay" className="h-11 w-11 rounded-2xl object-cover" />
                <div>
                  <p className={cls("text-xs font-semibold uppercase tracking-[0.28em]", isDark ? "text-sky-200/80" : "text-sky-700/80")}>
                    Gerenciar agendamento
                  </p>
                  <h1 className="text-2xl font-semibold">Carregando sua reserva</h1>
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

  if (error && !summary) {
    return (
      <div className={pageBg}>
        <div className="mx-auto max-w-3xl">
          <SurfaceCard className={isDark ? "border-red-400/20" : "border-red-200"}>
            <div className="flex items-start gap-3">
              <CircleAlert className={cls("mt-0.5 h-5 w-5 shrink-0", isDark ? "text-red-300" : "text-red-600")} />
              <div>
                <div className="text-lg font-black tracking-[-0.03em]">Nao foi possivel carregar o agendamento</div>
                <div className={cls("mt-2 text-sm leading-6", isDark ? "text-slate-300" : "text-slate-600")}>
                  {error}
                </div>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>
    );
  }

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
                <img src={brand} alt="Luminor Pay" className="h-11 w-11 rounded-2xl object-cover shadow-sm" />
                <div className="min-w-0">
                  <p className={cls("text-[11px] font-semibold uppercase tracking-[0.28em]", isDark ? "text-sky-200/80" : "text-sky-700/80")}>Autoatendimento</p>
                  <h1 className="truncate text-2xl font-semibold sm:text-3xl">Gerencie seu agendamento</h1>
                </div>
              </div>

              <Button variant="secondary" onClick={() => navigate(`/p/${token}/done${manageQuery}`)}>
                Voltar ao resumo
              </Button>
            </div>

            <div className="space-y-3">
              <StatusPill tone={bookingTone(booking.status)} label={bookingStatusLabel(booking.status)} />
              <h2 className="max-w-2xl text-2xl font-semibold leading-tight sm:text-[2rem]">
                Ajuste sua reserva com poucos toques.
              </h2>
              <p className={cls("max-w-2xl text-sm sm:text-base", isDark ? "text-slate-300" : "text-slate-600")}>
                {heroCopy}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="Servico" value={offer.title || "Agendamento"} hint={booking.customerName || offer.customerName || "Cliente"} />
              <MetricCard label="Horario atual" value={bookingSummary || "Nao informado"} hint="Reserva vinculada a este link" tone="blue" />
              <MetricCard label="Prazo limite" value={selfService.minimumNoticeLabel || "24 horas"} hint="Janela minima para alterar" tone="amber" />
            </div>
          </div>
        </section>

        {successMsg ? (
          <div className={cls("rounded-[26px] border px-4 py-4 text-sm", isDark ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className={cls("rounded-[26px] border px-4 py-4 text-sm", isDark ? "border-red-400/20 bg-red-400/10 text-red-100" : "border-red-200 bg-red-50 text-red-700")}>
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <SurfaceCard className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="text-lg font-black tracking-[-0.03em]">
                  {activeTab === "cancel" ? "Cancelar agendamento" : "Escolha um novo horario"}
                </div>
                <div className={cls("text-sm leading-6", isDark ? "text-slate-300" : "text-slate-600")}>
                  {canManage ? "Selecione a acao desejada e confirme no final desta etapa." : "Seu agendamento nao pode mais ser alterado por este link."}
                </div>
              </div>

              <div className={cls("inline-flex rounded-2xl border p-1", isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50")}>
                <button
                  type="button"
                  onClick={() => setActiveTab("reschedule")}
                  disabled={selfService.canReschedule !== true || submitting}
                  className={cls(
                    "rounded-2xl px-3 py-2 text-sm font-semibold transition",
                    activeTab === "reschedule"
                      ? isDark
                        ? "bg-sky-400/15 text-sky-100"
                        : "bg-white text-slate-900 shadow-sm"
                      : isDark
                        ? "text-slate-300"
                        : "text-slate-600",
                  )}
                >
                  Reagendar
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("cancel")}
                  disabled={selfService.canCancel !== true || submitting}
                  className={cls(
                    "rounded-2xl px-3 py-2 text-sm font-semibold transition",
                    activeTab === "cancel"
                      ? isDark
                        ? "bg-red-400/15 text-red-100"
                        : "bg-white text-slate-900 shadow-sm"
                      : isDark
                        ? "text-slate-300"
                        : "text-slate-600",
                  )}
                >
                  Cancelar
                </button>
              </div>
            </div>
            {!canManage ? (
              <div className={cls("rounded-[28px] border px-5 py-6 text-sm leading-6", isDark ? "border-amber-400/20 bg-amber-400/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-700")}>
                {selfService.reason || "Este link nao permite mais alterar o agendamento."}
              </div>
            ) : activeTab === "reschedule" ? (
              <div className="space-y-5">
                <div className="space-y-3">
                  <label className="space-y-2">
                    <span className={cls("text-sm font-medium", isDark ? "text-slate-200" : "text-slate-700")}>Nova data</span>
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        setSelectedSlot(null);
                      }}
                      className="h-12 rounded-2xl text-base"
                    />
                  </label>

                  <div className={cls("rounded-2xl border px-4 py-3 text-sm", isDark ? "border-white/10 bg-white/5 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700")}>
                    <div className="flex items-center gap-2 font-medium">
                      <CalendarDays className="h-4 w-4" />
                      <span>{date || "Escolha uma data"}</span>
                    </div>
                    <p className={cls("mt-1 text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                      Os horarios disponiveis abaixo respeitam o prazo minimo configurado.
                    </p>
                  </div>
                </div>

                {slotsError ? (
                  <div className={cls("rounded-2xl border px-4 py-3 text-sm", isDark ? "border-red-400/20 bg-red-400/10 text-red-100" : "border-red-200 bg-red-50 text-red-700")}>
                    {slotsError}
                  </div>
                ) : null}

                {slotsLoading ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div
                        key={index}
                        className={cls("h-24 animate-pulse rounded-3xl border", isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-100")}
                      />
                    ))}
                  </div>
                ) : slots.length === 0 ? (
                  <div className={cls("rounded-[28px] border px-5 py-8 text-center", isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50")}>
                    <p className="text-base font-semibold">Nenhum horario livre nesta data</p>
                    <p className={cls("mt-2 text-sm", isDark ? "text-slate-300" : "text-slate-600")}>
                      Escolha outro dia para ver novas opcoes.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {slots.map((slot) => {
                      const selected =
                        selectedSlot?.startAt === slot.startAt &&
                        selectedSlot?.endAt === slot.endAt;
                      const blocked = slot.available !== true;

                      return (
                        <button
                          key={`${slot.startAt}-${slot.endAt}`}
                          type="button"
                          disabled={blocked || submitting}
                          onClick={() => setSelectedSlot(slot)}
                          className={cls(
                            "rounded-[26px] border px-4 py-4 text-left transition duration-200",
                            "focus:outline-none focus:ring-2 focus:ring-sky-400/40",
                            selected
                              ? isDark
                                ? "border-sky-300/70 bg-sky-400/15 shadow-[0_20px_45px_-30px_rgba(56,189,248,0.9)]"
                                : "border-sky-300 bg-sky-50 shadow-[0_20px_45px_-30px_rgba(14,165,233,0.45)]"
                              : blocked
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
                              <p className="text-lg font-semibold">{fmtTime(slot.startAt, timeZone)}</p>
                              <p className={cls("mt-1 text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                                {fmtTime(slot.startAt, timeZone)} - {fmtTime(slot.endAt, timeZone)}
                              </p>
                            </div>
                            {blocked ? (
                              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            ) : (
                              <CalendarClock className={cls("mt-0.5 h-4 w-4 shrink-0", selected ? (isDark ? "text-sky-100" : "text-sky-700") : isDark ? "text-sky-200" : "text-sky-600")} />
                            )}
                          </div>

                          <p className={cls("mt-3 text-xs font-medium", blocked ? (isDark ? "text-slate-400" : "text-slate-500") : selected ? (isDark ? "text-sky-100" : "text-sky-700") : isDark ? "text-slate-300" : "text-slate-600")}>
                            {slotStatusLabel(slot)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className={cls("rounded-[26px] border px-4 py-4", isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50")}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className={cls("text-sm leading-6", isDark ? "text-slate-300" : "text-slate-600")}>
                      {selectedSummary
                        ? `Novo horario selecionado: ${selectedSummary}`
                        : "Escolha um novo horario disponivel para confirmar o reagendamento."}
                    </div>
                    <Button type="button" disabled={!selectedSlot || submitting} onClick={handleReschedule}>
                      {submitting ? "Confirmando..." : "Confirmar reagendamento"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Motivo do cancelamento (opcional)
                  </label>
                  <Textarea
                    rows={5}
                    maxLength={1000}
                    placeholder="Se quiser, conte rapidamente o motivo."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="rounded-2xl"
                  />
                </div>

                <div className={cls("rounded-[26px] border px-4 py-4 text-sm leading-6", isDark ? "border-amber-400/20 bg-amber-400/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-700")}>
                  O cancelamento remove apenas o agendamento. O pagamento e a proposta continuam preservados.
                </div>

                <div className="flex justify-end">
                  <Button type="button" variant="danger" disabled={submitting} onClick={handleCancel}>
                    {submitting ? "Cancelando..." : "Cancelar agendamento"}
                  </Button>
                </div>
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard className="space-y-5 lg:sticky lg:top-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className={cls("flex h-11 w-11 items-center justify-center rounded-2xl", isDark ? "bg-emerald-400/10 text-emerald-200" : "bg-emerald-50 text-emerald-700")}>
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-lg font-black tracking-[-0.03em]">Resumo da reserva</div>
                  <div className={cls("text-sm", isDark ? "text-slate-300" : "text-slate-600")}>
                    {offer.customerName || booking.customerName || "Cliente"}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className={cls("rounded-2xl border px-4 py-3", isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50")}>
                <div className={cls("text-[11px] font-semibold uppercase tracking-[0.18em]", isDark ? "text-slate-400" : "text-slate-500")}>
                  Status
                </div>
                <div className="mt-2 text-base font-semibold">{bookingStatusLabel(booking.status)}</div>
              </div>
              <div className={cls("rounded-2xl border px-4 py-3", isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50")}>
                <div className={cls("text-[11px] font-semibold uppercase tracking-[0.18em]", isDark ? "text-slate-400" : "text-slate-500")}>
                  Prazo
                </div>
                <div className="mt-2 text-base font-semibold">{selfService.minimumNoticeLabel || "24 horas"}</div>
              </div>
            </div>

            <div className={cls("rounded-[26px] border px-4 py-4", isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50")}>
              <div className="flex items-start gap-3">
                <CalendarClock className={cls("mt-0.5 h-5 w-5 shrink-0", isDark ? "text-sky-200" : "text-sky-700")} />
                <div className="min-w-0 flex-1 space-y-3">
                  <SummaryRow label="Servico" value={offer.title || "Agendamento"} />
                  <SummaryRow label="Horario atual" value={bookingSummary} />
                  <SummaryRow label="Fuso horario" value={timeZone} />
                </div>
              </div>
            </div>

            {booking.cancelReason ? (
              <div className={cls("rounded-[26px] border px-4 py-4 text-sm", isDark ? "border-amber-400/20 bg-amber-400/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-700")}>
                Motivo informado: {booking.cancelReason}
              </div>
            ) : null}

            {selfService.reason && !selfService.eligible ? (
              <div className={cls("rounded-[26px] border px-4 py-4 text-sm", isDark ? "border-amber-400/20 bg-amber-400/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-700")}>
                {selfService.reason}
              </div>
            ) : null}

            <div className={cls("rounded-[26px] border px-4 py-4 text-sm leading-6", isDark ? "border-white/10 bg-white/5 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600")}>
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
                <span>Se fizer uma alteracao, o resumo final sera atualizado automaticamente.</span>
              </div>
            </div>

            <Button variant="secondary" className="w-full" onClick={() => navigate(`/p/${token}/done${manageQuery}`)}>
              Voltar ao resumo
            </Button>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
