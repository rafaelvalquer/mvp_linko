import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, CheckCircle2, Clock3, MessageCircle } from "lucide-react";
import {
  bookPublicMyPageSchedule,
  getPublicMyPage,
  getPublicMyPageScheduleSlots,
} from "../app/myPageApi.js";
import { Input } from "../components/appui/Input.jsx";
import {
  cls,
  getPublicButtonProps,
  getPublicSelectableCardProps,
  MyPagePublicCard,
  MyPagePublicFooter,
  MyPagePublicHero,
  MyPagePublicScreen,
} from "../components/my-page/MyPagePublicUi.jsx";

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

export default function PublicMyPageScheduleV2() {
  const { slug } = useParams();
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
              <div className="mt-5 text-2xl font-black tracking-[-0.04em]">
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
              <div className="text-lg font-semibold">Agenda indisponivel</div>
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
                    <MessageCircle className="h-4 w-4" />
                    Falar no WhatsApp
                  </button>
                </div>
              ) : null}
            </MyPagePublicCard>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <MyPagePublicCard theme={theme}>
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
                  <Input
                    type="date"
                    value={date}
                    min={today()}
                    onChange={(event) => setDate(event.target.value)}
                    className="h-12"
                    style={theme.inputStyle}
                  />
                </div>

                <div className="mt-4 flex items-center gap-2 text-sm" style={theme.mutedTextStyle}>
                  <CalendarDays className="h-4 w-4" />
                  <span>{fmtDateLabel(date) || "Escolha uma data"}</span>
                </div>

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
                          onClick={() => setSelectedSlot(slot)}
                          {...getPublicSelectableCardProps(
                            theme,
                            active,
                            "px-4 py-4",
                          )}
                        >
                          <div className="text-lg font-semibold">
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

              <MyPagePublicCard theme={theme} className="lg:sticky lg:top-6">
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.18em]"
                  style={theme.mutedTextStyle}
                >
                  Resumo do agendamento
                </div>

                <div
                  {...getPublicSelectableCardProps(theme, false, "mt-4 px-4 py-4")}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
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
