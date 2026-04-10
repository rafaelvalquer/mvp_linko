import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import {
  bookPublicMyPageSchedule,
  getPublicMyPage,
  getPublicMyPageScheduleSlots,
} from "../app/myPageApi.js";
import {
  buildMyPageConversionContext,
  trackMyPageEvent,
} from "../app/myPagePublicAnalytics.js";
import { Input } from "../components/appui/Input.jsx";
import {
  cls,
  getPublicButtonProps,
  getPublicSelectableCardProps,
  MyPagePublicCard,
  MyPagePublicFooter,
  MyPagePublicHero,
  MyPagePublicScreen,
  MyPageWhatsAppIcon,
} from "../components/my-page/MyPagePublicUi.jsx";

const AUTO_ADVANCE_LOOKAHEAD_DAYS = 30;

function formatLocalDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function today() {
  return formatLocalDateValue(new Date());
}

function addDays(dateValue, days) {
  const [year, month, day] = String(dateValue || "")
    .split("-")
    .map(Number);
  const nextDate = new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + Number(days || 0));
  return formatLocalDateValue(nextDate);
}

function normalizeSlotsPayload(response, fallbackPage) {
  return {
    page: response?.page || fallbackPage || null,
    scheduleAvailable: response?.scheduleAvailable !== false,
    slots: Array.isArray(response?.slots) ? response.slots : [],
  };
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

export default function PublicMyPageScheduleV2() {
  const { slug } = useParams();
  const [todayDate] = useState(() => today());
  const [date, setDate] = useState(() => today());
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(null);
  const [scheduleAvailable, setScheduleAvailable] = useState(true);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [booking, setBooking] = useState(null);
  const [autoAdjustedDateNotice, setAutoAdjustedDateNotice] = useState("");
  const [form, setForm] = useState({
    customerName: "",
    customerWhatsApp: "",
  });
  const dateInputRef = useRef(null);
  const didResolveInitialDateRef = useRef(false);
  const prefetchedSlotsRef = useRef(null);
  const trackedScheduleRef = useRef("");

  useEffect(() => {
    setLoading(true);
    setDate(todayDate);
    setErr("");
    setPage(null);
    setScheduleAvailable(true);
    setSlots([]);
    setSelectedSlot(null);
    setBooking(null);
    setAutoAdjustedDateNotice("");
    didResolveInitialDateRef.current = false;
    prefetchedSlotsRef.current = null;
  }, [slug, todayDate]);

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

    async function loadSlotsForDate(targetDate, fallbackPage) {
      if (prefetchedSlotsRef.current?.date === targetDate) {
        const cached = prefetchedSlotsRef.current.payload;
        prefetchedSlotsRef.current = null;
        return cached;
      }

      const response = await getPublicMyPageScheduleSlots(slug, targetDate);
      return normalizeSlotsPayload(response, fallbackPage);
    }

    async function findNextAvailableDate(initialDate, fallbackPage) {
      for (let offset = 1; offset <= AUTO_ADVANCE_LOOKAHEAD_DAYS; offset += 1) {
        const nextDate = addDays(initialDate, offset);
        const payload = await loadSlotsForDate(nextDate, fallbackPage);
        if (!active) return null;
        if (!payload.scheduleAvailable) return null;
        if (payload.slots.some((slot) => slot.available === true)) {
          return { date: nextDate, payload };
        }
      }

      return null;
    }

    (async () => {
      try {
        setSlotsLoading(true);
        setErr("");
        const payload = await loadSlotsForDate(date, page);
        if (!active) return;

        const shouldResolveInitialDate =
          !didResolveInitialDateRef.current &&
          date === todayDate &&
          payload.scheduleAvailable &&
          !payload.slots.some((slot) => slot.available === true);

        if (shouldResolveInitialDate) {
          const nextAvailable = await findNextAvailableDate(
            date,
            payload.page || page,
          );
          if (!active) return;

          didResolveInitialDateRef.current = true;

          if (nextAvailable?.payload) {
            prefetchedSlotsRef.current = nextAvailable;
            setDate(nextAvailable.date);
            setAutoAdjustedDateNotice("Mostrando a proxima data disponivel.");
            return;
          }
        } else if (!didResolveInitialDateRef.current) {
          didResolveInitialDateRef.current = true;
        }

        setPage(payload.page || page);
        setScheduleAvailable(payload.scheduleAvailable);
        setSlots(payload.slots);
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
  }, [slug, date, page?._id, todayDate]);

  const whatsappButton = (page?.buttons || []).find(
    (button) => button.type === "whatsapp",
  );
  const availableSlots = useMemo(
    () => slots.filter((slot) => slot.available === true),
    [slots],
  );

  useEffect(() => {
    if (!page?._id) return;
    const trackKey = `${slug}:${page._id}`;
    if (trackedScheduleRef.current === trackKey) return;
    trackedScheduleRef.current = trackKey;

    void trackMyPageEvent(slug, {
      eventType: "page_view",
      pageKind: "schedule",
    });
    void trackMyPageEvent(slug, {
      eventType: "schedule_view",
      pageKind: "schedule",
      blockKey: "schedule_slots",
    });
    void trackMyPageEvent(slug, {
      eventType: "block_view",
      pageKind: "schedule",
      blockKey: "schedule_slots",
    });
  }, [page?._id, slug]);

  function openDatePicker() {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
    input.focus();
    input.click();
  }

  function handleDateChange(event) {
    didResolveInitialDateRef.current = true;
    setAutoAdjustedDateNotice("");
    setDate(event.target.value);
  }

  async function handleBook() {
    if (!selectedSlot) return;
    try {
      setBookingBusy(true);
      setErr("");
      void trackMyPageEvent(slug, {
        eventType: "cta_click",
        pageKind: "schedule",
        blockKey: "schedule_slots",
        buttonKey: "schedule_submit",
        buttonLabel: "Confirmar agendamento",
        buttonType: "public_schedule",
        contentKind: "slot",
        contentId: selectedSlot.startAt || "",
        contentLabel: fmtRange(selectedSlot.startAt, selectedSlot.endAt),
      });
      const analyticsContext = buildMyPageConversionContext(slug, "schedule", {
        blockKey: "schedule_slots",
        contentKind: "slot",
        contentId: selectedSlot.startAt || "",
        contentLabel: fmtRange(selectedSlot.startAt, selectedSlot.endAt),
      });
      const response = await bookPublicMyPageSchedule(slug, {
        ...form,
        startAt: selectedSlot.startAt,
        endAt: selectedSlot.endAt,
        analyticsContext,
      });
      setBooking(response?.booking || null);
    } catch (error) {
      setErr(error?.message || "Nao consegui confirmar esse horario.");
    } finally {
      setBookingBusy(false);
    }
  }

  function handleWhatsAppClick(targetUrl = "") {
    if (!targetUrl) return;
    void trackMyPageEvent(slug, {
      eventType: "cta_click",
      pageKind: "schedule",
      blockKey: "schedule_slots",
      buttonKey: "schedule_whatsapp",
      buttonLabel: "Falar no WhatsApp",
      buttonType: "whatsapp",
      contentKind: "button",
      contentId: "schedule_whatsapp",
      contentLabel: "Falar no WhatsApp",
    });
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }

  if (booking) {
    return (
      <MyPagePublicScreen page={page} maxWidth="max-w-2xl">
        {(theme) => (
          <>
            <MyPagePublicCard theme={theme} className="text-center">
              <div
                className={cls(
                  "mx-auto flex h-16 w-16 items-center justify-center",
                  theme.buttonIconRadiusClassName,
                )}
                style={theme.activeCardStyle}
              >
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div
                className="mt-5 text-2xl font-black tracking-[-0.04em]"
                style={theme.titleStyle}
              >
                Horario reservado
              </div>
              <div className="mt-3 text-sm leading-7" style={theme.mutedTextStyle}>
                Seu atendimento foi agendado com sucesso para {fmtDateLabel(date)} as{" "}
                {fmtRange(booking.startAt, booking.endAt)}.
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link to={`/u/${slug}`} {...getPublicButtonProps(theme, "secondary")}>
                  Voltar para a pagina
                </Link>
                {whatsappButton?.targetUrl ? (
                  <button
                    type="button"
                    {...getPublicButtonProps(theme, "primary")}
                    onClick={() => handleWhatsAppClick(whatsappButton.targetUrl)}
                  >
                    <MyPageWhatsAppIcon className="h-4 w-4" />
                    Falar no WhatsApp
                  </button>
                ) : null}
              </div>
            </MyPagePublicCard>
            <MyPagePublicFooter theme={theme} />
          </>
        )}
      </MyPagePublicScreen>
    );
  }

  return (
    <MyPagePublicScreen page={page} maxWidth="max-w-5xl">
      {(theme) => (
        <>
          <MyPagePublicCard theme={theme}>
            <MyPagePublicHero
              page={page}
              theme={theme}
              eyebrow="Agendar atendimento"
              description="Escolha a data, o horario e confirme por aqui."
            />
          </MyPagePublicCard>

          {loading ? (
            <MyPagePublicCard theme={theme} className="h-64 animate-pulse" />
          ) : err ? (
            <MyPagePublicCard theme={theme} className="text-center text-sm text-red-700">
              {err}
            </MyPagePublicCard>
          ) : !scheduleAvailable ? (
            <MyPagePublicCard theme={theme} className="text-center">
              <div className="text-lg font-semibold" style={theme.headingStyle}>
                Agenda indisponivel
              </div>
              <div className="mt-2 text-sm" style={theme.mutedTextStyle}>
                Esta pagina ainda nao possui horarios livres.
              </div>
              {whatsappButton?.targetUrl ? (
                <div className="mt-4">
                  <button
                    type="button"
                    {...getPublicButtonProps(theme, "primary")}
                    onClick={() =>
                      window.open(
                        whatsappButton.targetUrl,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    <MyPageWhatsAppIcon className="h-4 w-4" />
                    Falar no WhatsApp
                  </button>
                </div>
              ) : null}
            </MyPagePublicCard>
          ) : (
            <div className={theme?.layout?.formLayoutClassName}>
              <MyPagePublicCard
                theme={theme}
                className={theme?.layout?.formCardClassName}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold" style={theme.mutedTextStyle}>
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
                      style={theme.inputStyle}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold" style={theme.mutedTextStyle}>
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
                      style={theme.inputStyle}
                    />
                  </div>
                </div>

                <div className="mt-5">
                  <label className="text-xs font-semibold" style={theme.mutedTextStyle}>
                    Data desejada
                  </label>
                  <div className="relative mt-2">
                    <Input
                      ref={dateInputRef}
                      type="date"
                      value={date}
                      min={todayDate}
                      onChange={handleDateChange}
                      onClick={openDatePicker}
                      className="h-12 cursor-pointer pr-12"
                      style={theme.inputStyle}
                    />
                    <button
                      type="button"
                      onClick={openDatePicker}
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center"
                      aria-label="Abrir calendario"
                    >
                      <CalendarDays
                        className="h-4 w-4"
                        style={theme.mutedTextStyle}
                      />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 text-sm" style={theme.mutedTextStyle}>
                  <CalendarDays className="h-4 w-4" />
                  <span>{fmtDateLabel(date) || "Escolha uma data"}</span>
                </div>

                {autoAdjustedDateNotice ? (
                  <div className="mt-2 text-xs font-medium" style={theme.mutedTextStyle}>
                    {autoAdjustedDateNotice}
                  </div>
                ) : null}

                {slotsLoading ? (
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div
                        key={index}
                        {...getPublicSelectableCardProps(
                          theme,
                          false,
                          "h-24 animate-pulse",
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
                          onClick={() => {
                            setSelectedSlot(slot);
                            void trackMyPageEvent(slug, {
                              eventType: "slot_select",
                              pageKind: "schedule",
                              blockKey: "schedule_slots",
                              contentKind: "slot",
                              contentId: slot.startAt || "",
                              contentLabel: fmtRange(slot.startAt, slot.endAt),
                              buttonKey: `slot_${slot.startAt || ""}`,
                              buttonLabel: fmtRange(slot.startAt, slot.endAt),
                              buttonType: "slot",
                            });
                          }}
                          {...getPublicSelectableCardProps(
                            theme,
                            active,
                            "px-4 py-4",
                          )}
                        >
                          <div className="text-lg font-semibold" style={theme.headingStyle}>
                            {fmtRange(slot.startAt, slot.endAt)}
                          </div>
                          <div className="mt-2 text-xs" style={theme.mutedTextStyle}>
                            Livre
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    {...getPublicSelectableCardProps(theme, false, "mt-5 px-4 py-6 text-sm")}
                  >
                    Nenhum horario nesta data.
                  </div>
                )}
              </MyPagePublicCard>

              <MyPagePublicCard
                theme={theme}
                className={theme?.layout?.summaryCardClassName}
              >
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.18em]"
                  style={theme.mutedTextStyle}
                >
                  Resumo do agendamento
                </div>

                <div
                  {...getPublicSelectableCardProps(theme, false, "mt-4 px-4 py-4")}
                >
                  <div
                    className="flex items-center gap-2 text-sm font-semibold"
                    style={theme.headingStyle}
                  >
                    <Clock3 className="h-4 w-4" />
                    <span>
                      {selectedSlot
                        ? fmtRange(selectedSlot.startAt, selectedSlot.endAt)
                        : "Escolha um horario"}
                    </span>
                  </div>
                  <div className="mt-2 text-sm" style={theme.mutedTextStyle}>
                    {selectedSlot
                      ? fmtDateLabel(date)
                      : "Selecione um horario livre."}
                  </div>
                </div>

                <div className="mt-5">
                  <button
                    type="button"
                    disabled={
                      bookingBusy ||
                      !selectedSlot ||
                      !form.customerName.trim() ||
                      !form.customerWhatsApp.trim()
                    }
                    {...getPublicButtonProps(theme, "primary")}
                    onClick={handleBook}
                  >
                    {bookingBusy ? "Confirmando..." : "Confirmar agendamento"}
                  </button>
                </div>

                {whatsappButton?.targetUrl ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      {...getPublicButtonProps(theme, "secondary")}
                      onClick={() => handleWhatsAppClick(whatsappButton.targetUrl)}
                    >
                      <MyPageWhatsAppIcon className="h-4 w-4" />
                      Falar no WhatsApp
                    </button>
                  </div>
                ) : null}
              </MyPagePublicCard>
            </div>
          )}

          <MyPagePublicFooter theme={theme} />
        </>
      )}
    </MyPagePublicScreen>
  );
}
