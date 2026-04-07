import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, CheckCircle2, Clock3, MessageCircle } from "lucide-react";
import {
  bookPublicMyPageSchedule,
  getPublicMyPage,
  getPublicMyPageScheduleSlots,
} from "../app/myPageApi.js";
import useThemeToggle from "../app/useThemeToggle.js";
import brand from "../assets/brand.png";
import Button from "../components/appui/Button.jsx";
import { Input } from "../components/appui/Input.jsx";

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDateLabel(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

function fmtRange(startAt, endAt) {
  const start = startAt
    ? new Date(startAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const end = endAt
    ? new Date(endAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  return end ? `${start} - ${end}` : start;
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

export default function PublicMyPageSchedule() {
  const { slug } = useParams();
  const { isDark } = useThemeToggle();
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(null);
  const [scheduleAvailable, setScheduleAvailable] = useState(true);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [booking, setBooking] = useState(null);
  const [form, setForm] = useState({
    customerName: "",
    customerWhatsApp: "",
  });

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
        setErr(error?.message || "Nao consegui abrir o agendamento.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    let active = true;
    if (!page) return () => {};

    (async () => {
      try {
        setSlotsLoading(true);
        setErr("");
        const response = await getPublicMyPageScheduleSlots(slug, date);
        if (!active) return;
        setPage(response?.page || page);
        setScheduleAvailable(response?.scheduleAvailable !== false);
        setSlots(Array.isArray(response?.slots) ? response.slots : []);
        setSelectedSlot(null);
      } catch (error) {
        if (!active) return;
        setErr(error?.message || "Nao consegui carregar os horarios.");
      } finally {
        if (active) setSlotsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [slug, date, page?._id]);

  const whatsappButton = (page?.buttons || []).find(
    (button) => button.type === "whatsapp",
  );
  const availableSlots = useMemo(
    () => slots.filter((slot) => slot.available === true),
    [slots],
  );

  async function handleBook() {
    if (!selectedSlot) return;
    try {
      setBookingBusy(true);
      setErr("");
      const response = await bookPublicMyPageSchedule(slug, {
        ...form,
        startAt: selectedSlot.startAt,
        endAt: selectedSlot.endAt,
      });
      setBooking(response?.booking || null);
    } catch (error) {
      setErr(error?.message || "Nao consegui confirmar esse horario.");
    } finally {
      setBookingBusy(false);
    }
  }

  if (booking) {
    return (
      <div
        className={cls(
          "min-h-screen px-4 py-6 sm:px-6 lg:px-8",
          isDark
            ? "bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.14),transparent_38%),linear-gradient(180deg,#020617,#0f172a_50%,#020617)] text-white"
            : "bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.1),transparent_38%),linear-gradient(180deg,#f8fafc,#eef2ff_48%,#f8fafc)] text-slate-950",
        )}
      >
        <div className="mx-auto max-w-2xl">
          <SurfaceCard className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="mt-5 text-2xl font-black tracking-[-0.04em]">
              Horario reservado
            </div>
            <div
              className={cls(
                "mt-3 text-sm leading-7",
                isDark ? "text-slate-300" : "text-slate-600",
              )}
            >
              Seu atendimento foi agendado com sucesso para {fmtDateLabel(date)}{" "}
              as {fmtRange(booking.startAt, booking.endAt)}.
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link to={`/u/${slug}`}>
                <Button type="button" variant="secondary">
                  Voltar para a pagina
                </Button>
              </Link>
              {whatsappButton?.targetUrl ? (
                <Button
                  type="button"
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
          </SurfaceCard>
        </div>
      </div>
    );
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
      <div className="mx-auto max-w-5xl space-y-6">
        <SurfaceCard>
          <div className="flex items-start gap-4">
            <img
              src={page?.avatarUrl || brand}
              alt={page?.title || "Minha Pagina"}
              className="h-16 w-16 rounded-[22px] object-cover"
            />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700 dark:text-sky-200">
                Agendar atendimento
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
                Escolha a data, selecione um horario livre e confirme seu atendimento por aqui.
              </p>
            </div>
          </div>
        </SurfaceCard>

        {loading ? (
          <SurfaceCard className="h-64 animate-pulse" />
        ) : err ? (
          <SurfaceCard className="text-center text-sm text-red-700 dark:text-red-200">
            {err}
          </SurfaceCard>
        ) : !scheduleAvailable ? (
          <SurfaceCard className="text-center">
            <div className="text-lg font-semibold">Agenda indisponivel</div>
            <div
              className={cls(
                "mt-2 text-sm",
                isDark ? "text-slate-300" : "text-slate-600",
              )}
            >
              Esta pagina ainda nao possui horarios configurados.
            </div>
            {whatsappButton?.targetUrl ? (
              <div className="mt-4">
                <Button
                  type="button"
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
              </div>
            ) : null}
          </SurfaceCard>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <SurfaceCard>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Nome
                  </label>
                  <Input
                    value={form.customerName}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        customerName: event.target.value,
                      }))
                    }
                    placeholder="Seu nome"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    WhatsApp
                  </label>
                  <Input
                    value={form.customerWhatsApp}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        customerWhatsApp: event.target.value,
                      }))
                    }
                    placeholder="11999999999"
                  />
                </div>
              </div>

              <div className="mt-5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Data desejada
                </label>
                <Input
                  type="date"
                  value={date}
                  min={today()}
                  onChange={(event) => setDate(event.target.value)}
                  className="h-12 rounded-2xl"
                />
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CalendarDays className="h-4 w-4" />
                <span>{fmtDateLabel(date) || "Escolha uma data"}</span>
              </div>

              {slotsLoading ? (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className={cls(
                        "h-24 animate-pulse rounded-[24px] border",
                        isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-100",
                      )}
                    />
                  ))}
                </div>
              ) : availableSlots.length ? (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {availableSlots.map((slot) => {
                    const active = selectedSlot?.startAt === slot.startAt;
                    return (
                      <button
                        key={slot.startAt}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={cls(
                          "rounded-[24px] border px-4 py-4 text-left transition",
                          active
                            ? isDark
                              ? "border-sky-300/40 bg-sky-400/10"
                              : "border-sky-200 bg-sky-50"
                            : isDark
                              ? "border-white/10 bg-white/5"
                              : "border-slate-200 bg-white",
                        )}
                      >
                        <div className="text-lg font-semibold">
                          {fmtRange(slot.startAt, slot.endAt)}
                        </div>
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Horario livre
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div
                  className={cls(
                    "mt-5 rounded-[24px] border px-4 py-6 text-sm",
                    isDark
                      ? "border-white/10 bg-white/5 text-slate-300"
                      : "border-slate-200 bg-slate-50 text-slate-600",
                  )}
                >
                  Nenhum horario livre nesta data.
                </div>
              )}
            </SurfaceCard>

            <SurfaceCard className="lg:sticky lg:top-6">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Resumo do agendamento
              </div>

              <div
                className={cls(
                  "mt-4 rounded-[24px] border px-4 py-4",
                  isDark
                    ? "border-white/10 bg-white/5"
                    : "border-slate-200 bg-white",
                )}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Clock3 className="h-4 w-4" />
                  <span>
                    {selectedSlot
                      ? fmtRange(selectedSlot.startAt, selectedSlot.endAt)
                      : "Escolha um horario"}
                  </span>
                </div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {selectedSlot
                    ? fmtDateLabel(date)
                    : "Os horarios livres aparecem conforme a data selecionada."}
                </div>
              </div>

              <div className="mt-5">
                <Button
                  type="button"
                  disabled={
                    bookingBusy ||
                    !selectedSlot ||
                    !form.customerName.trim() ||
                    !form.customerWhatsApp.trim()
                  }
                  onClick={handleBook}
                >
                  {bookingBusy ? "Confirmando..." : "Confirmar agendamento"}
                </Button>
              </div>

              {whatsappButton?.targetUrl ? (
                <div className="mt-3">
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
                </div>
              ) : null}
            </SurfaceCard>
          </div>
        )}
      </div>
    </div>
  );
}
