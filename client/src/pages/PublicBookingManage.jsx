import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../app/api.js";
import brand from "../assets/brand.png";
import Button from "../components/appui/Button.jsx";
import { Input, Textarea } from "../components/appui/Input.jsx";

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

export default function PublicBookingManage() {
  const { token } = useParams();
  const navigate = useNavigate();
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

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-4 text-sm text-zinc-600">
          Carregando…
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img
              src={brand}
              alt="Luminor Pay"
              className="h-10 w-10 rounded-xl object-contain ring-1 ring-zinc-200 bg-white p-1"
            />
            <div>
              <div className="text-sm font-semibold text-zinc-900">
                Reagendar ou cancelar agendamento
              </div>
              <div className="text-xs text-zinc-500">
                Use o mesmo link da proposta para ajustar sua reserva
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/p/${token}/done${manageQuery}`)}
          >
            Voltar ao resumo
          </Button>
        </div>
      </div>

      <div className="mx-auto grid max-w-3xl gap-4 px-4 py-6">
        {successMsg ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {successMsg}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Agendamento atual
          </div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">
            {offer.title || "Serviço"}
          </div>
          <div className="mt-1 text-sm text-zinc-600">
            Cliente:{" "}
            <span className="font-semibold text-zinc-900">
              {booking.customerName || offer.customerName || "Cliente"}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border bg-zinc-50 p-4">
              <div className="text-xs font-semibold text-zinc-500">Horário</div>
              <div className="mt-1 text-base font-semibold text-zinc-900">
                {fmtDateTime(booking.startAt, timeZone)}
              </div>
            </div>
            <div className="rounded-2xl border bg-zinc-50 p-4">
              <div className="text-xs font-semibold text-zinc-500">Status</div>
              <div className="mt-1 text-base font-semibold text-zinc-900">
                {bookingStatusLabel(booking.status)}
              </div>
              <div className="mt-2 text-xs text-zinc-600">
                Prazo maximo para reagendar ou cancelar:{" "}
                <span className="font-semibold">
                  {selfService.minimumNoticeLabel || "24 horas"}
                </span>
              </div>
            </div>
          </div>
          {booking.cancelReason ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Motivo informado: {booking.cancelReason}
            </div>
          ) : null}
          {selfService.reason && !selfService.eligible ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {selfService.reason}
            </div>
          ) : null}
        </div>

        {selfService.canReschedule || selfService.canCancel ? (
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={activeTab === "reschedule" ? "primary" : "secondary"}
                disabled={selfService.canReschedule !== true || submitting}
                onClick={() => setActiveTab("reschedule")}
              >
                Reagendar
              </Button>
              <Button
                type="button"
                variant={activeTab === "cancel" ? "danger" : "secondary"}
                disabled={selfService.canCancel !== true || submitting}
                onClick={() => setActiveTab("cancel")}
              >
                Cancelar agendamento
              </Button>
            </div>

            {activeTab === "reschedule" ? (
              <div className="mt-6 space-y-4">
                <div className="max-w-xs">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Nova data
                  </label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setSelectedSlot(null);
                    }}
                  />
                </div>

                {slotsError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {slotsError}
                  </div>
                ) : null}

                {slotsLoading ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, idx) => (
                      <div key={idx} className="h-10 rounded-xl bg-zinc-100" />
                    ))}
                  </div>
                ) : slots.length === 0 ? (
                  <div className="rounded-xl border bg-zinc-50 p-4 text-sm text-zinc-600">
                    Sem horários disponíveis para esta data.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {slots.map((slot) => {
                      const selected = selectedSlot?.startAt === slot.startAt;
                      const blocked = slot.available !== true;
                      return (
                        <button
                          key={slot.startAt}
                          type="button"
                          disabled={blocked || submitting}
                          onClick={() => setSelectedSlot(slot)}
                          className={[
                            "rounded-xl border px-3 py-2 text-left text-sm font-semibold transition",
                            blocked
                              ? "cursor-not-allowed border-amber-200 bg-amber-50 text-amber-900"
                              : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
                            selected
                              ? "border-emerald-500 ring-2 ring-emerald-100"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <div>{fmtTime(slot.startAt, timeZone)}</div>
                          <div className="mt-1 text-xs font-medium opacity-80">
                            {blocked ? "Indisponível" : "Disponível"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-zinc-600">
                    {selectedSlot ? (
                      <>
                        Novo horário selecionado:{" "}
                        <span className="font-semibold text-zinc-900">
                          {fmtDateTime(selectedSlot.startAt, timeZone)}
                        </span>
                      </>
                    ) : (
                      "Escolha um novo horário disponível para confirmar o reagendamento."
                    )}
                  </div>
                  <Button
                    type="button"
                    disabled={!selectedSlot || submitting}
                    onClick={handleReschedule}
                  >
                    {submitting ? "Confirmando..." : "Confirmar reagendamento"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Motivo do cancelamento (opcional)
                  </label>
                  <Textarea
                    rows={5}
                    maxLength={1000}
                    placeholder="Se quiser, conte rapidamente o motivo."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  O cancelamento remove apenas o agendamento. O pagamento e a
                  proposta continuam preservados.
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="danger"
                    disabled={submitting}
                    onClick={handleCancel}
                  >
                    {submitting ? "Cancelando..." : "Cancelar agendamento"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
