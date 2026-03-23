// src/pages/CalendarV2.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthContext.jsx";
import { cancelBooking, listBookings } from "../app/bookingsApi.js";
import { getSettings } from "../app/settingsApi.js";
import Badge from "../components/appui/Badge.jsx";
import Button from "../components/appui/Button.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import FilterBar from "../components/appui/FilterBar.jsx";
import { Input } from "../components/appui/Input.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import BookingQuickViewModal from "../components/calendar/BookingQuickViewModal.jsx";
import DayTimeline from "../components/calendar/DayTimeline.jsx";
import {
  formatDate,
  formatDayLabel,
  formatTime,
  getCalendarTimeZone,
  getTodayDateKey,
  holdRemaining,
  shiftDateKey,
} from "../components/calendar/calendarUtils.js";
import Shell from "../components/layout/Shell.jsx";

function renderLoadError(err, onRetry) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      {err}{" "}
      <button className="ml-2 font-semibold underline" onClick={onRetry}>
        Tentar novamente
      </button>
    </div>
  );
}

export default function Calendar() {
  const nav = useNavigate();
  const { signOut } = useAuth();

  const [agendaSettings, setAgendaSettings] = useState(null);
  const [day, setDay] = useState(() => getTodayDateKey());
  const [rangeMode, setRangeMode] = useState("day");
  const [statusTab, setStatusTab] = useState("all");
  const [q, setQ] = useState("");

  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [calendarExpanded, setCalendarExpanded] = useState(true);

  const agendaTimeZone = getCalendarTimeZone(agendaSettings?.timezone);

  const { fromIso, toIso, title } = useMemo(() => {
    const start = new Date(`${day}T00:00:00`);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    if (rangeMode === "week") end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return {
      fromIso: start.toISOString(),
      toIso: end.toISOString(),
      title:
        rangeMode === "week"
          ? `7 dias a partir de ${formatDayLabel(day, { dateStyle: "short" })}`
          : formatDayLabel(day, {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            }),
    };
  }, [day, rangeMode]);

  const statusParam = useMemo(() => {
    if (statusTab === "confirmed") return "CONFIRMED";
    if (statusTab === "hold") return "HOLD";
    return "HOLD,CONFIRMED";
  }, [statusTab]);

  async function handleUnauthorized(error) {
    if (error?.status !== 401) return false;

    signOut();
    nav(`/login?next=${encodeURIComponent("/calendar")}`, {
      replace: true,
    });
    return true;
  }

  async function loadAgendaSettings() {
    try {
      const data = await getSettings();
      setAgendaSettings(data?.settings?.agenda || null);
    } catch (error) {
      if (await handleUnauthorized(error)) return;
      setAgendaSettings(null);
    }
  }

  async function load() {
    try {
      setErr("");
      setBusy(true);
      const data = await listBookings({
        from: fromIso,
        to: toIso,
        status: statusParam,
      });
      setItems(data.items || []);
    } catch (error) {
      if (await handleUnauthorized(error)) return;
      setErr(error?.message || "Falha ao carregar agenda.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromIso, toIso, statusParam]);

  useEffect(() => {
    loadAgendaSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = String(q || "")
      .trim()
      .toLowerCase();

    if (!term) return items;

    return (items || []).filter((booking) => {
      const customer = String(booking.customerName || "").toLowerCase();
      const service = String(booking?.offer?.title || "").toLowerCase();
      const whatsapp = String(booking.customerWhatsApp || "").toLowerCase();
      return (
        customer.includes(term) ||
        service.includes(term) ||
        whatsapp.includes(term)
      );
    });
  }, [items, q]);

  useEffect(() => {
    if (rangeMode !== "day") {
      setSelectedBooking(null);
      return;
    }

    if (
      selectedBooking &&
      !filtered.some((booking) => booking._id === selectedBooking._id)
    ) {
      setSelectedBooking(null);
    }
  }, [filtered, rangeMode, selectedBooking]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const confirmed = filtered.filter(
      (booking) => String(booking.status).toUpperCase() === "CONFIRMED",
    ).length;
    const hold = filtered.filter(
      (booking) => String(booking.status).toUpperCase() === "HOLD",
    ).length;

    return { total, confirmed, hold };
  }, [filtered]);

  async function handleCancel(bookingId) {
    const confirmed = window.confirm("Cancelar esta reserva?");
    if (!confirmed) return;

    try {
      await cancelBooking(bookingId);
      load();
    } catch (error) {
      if (await handleUnauthorized(error)) return;
      alert(error?.message || "Falha ao cancelar.");
    }
  }

  function openProposal(publicToken) {
    window.open(`/p/${publicToken}`, "_blank", "noopener,noreferrer");
  }

  const emptyStateTitle =
    rangeMode === "day" ? "Sem reservas neste dia" : "Sem reservas no periodo";
  const emptyStateDescription =
    rangeMode === "day"
      ? "Quando houver agendamentos filtrados para esta data, eles aparecerao aqui."
      : "Quando houver agendamentos filtrados nos proximos 7 dias, eles aparecerao aqui.";

  function renderDayCalendar({
    mode = "mobile",
    expanded = true,
  } = {}) {
    const desktop = mode === "desktop";

    const content = busy ? (
      <Skeleton
        className={
          desktop
            ? "h-[600px] w-full rounded-[24px] 2xl:h-[640px]"
            : "h-[280px] w-full rounded-[24px] md:h-[340px] lg:h-[360px]"
        }
      />
    ) : err ? (
      renderLoadError(err, load)
    ) : (
      <DayTimeline
        items={filtered}
        day={day}
        agendaSettings={agendaSettings}
        timezone={agendaTimeZone}
        onSelect={setSelectedBooking}
        minHeight={desktop ? 600 : 260}
        hourColumnWidth={56}
        compact={!desktop}
      />
    );

    if (desktop) {
      return (
        <div className="hidden xl:col-span-4 xl:block">
          <div className="xl:ml-auto xl:w-full xl:max-w-[420px] 2xl:max-w-[460px]">
            <Card>
              <CardHeader
                title="Calendario do dia"
                subtitle={`Overview rapido do dia. Fuso ativo: ${agendaTimeZone}`}
              />
              <CardBody>
                <div className="max-h-[600px] overflow-y-auto 2xl:max-h-[640px]">
                  {content}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      );
    }

    return (
      <div className="xl:hidden">
        <Card>
          <CardHeader
            title="Calendario do dia"
            subtitle={`Preview compacto do dia. Fuso ativo: ${agendaTimeZone}`}
            right={
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-[0_14px_28px_-22px_rgba(15,23,42,0.18)] transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                aria-expanded={expanded}
                aria-controls="calendar-day-accordion"
                onClick={() => setCalendarExpanded((current) => !current)}
              >
                <span>{expanded ? "Minimizar" : "Expandir"}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform ${expanded ? "rotate-180" : ""}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            }
          />

          <div
            id="calendar-day-accordion"
            className={`grid transition-[grid-template-rows] duration-300 ease-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
          >
            <div className="min-h-0 overflow-hidden">
              <CardBody>
                <div className="max-h-[280px] overflow-y-auto md:max-h-[340px] lg:max-h-[360px]">
                  {content}
                </div>
              </CardBody>
            </div>
          </div>

          {!expanded ? (
            <div className="border-t border-slate-200/80 px-5 py-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
              Calendario minimizado. A lista operacional continua disponivel logo abaixo.
            </div>
          ) : null}
        </Card>
      </div>
    );
  }

  function renderListCard() {
    return (
      <Card>
        <CardHeader
          title={rangeMode === "day" ? "Lista do dia" : "Lista dos 7 dias"}
          subtitle="Area operacional para abrir propostas e cancelar reservas."
        />

        <CardBody className="space-y-3">
          {busy ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : err ? (
            renderLoadError(err, load)
          ) : filtered.length === 0 ? (
            <EmptyState
              title={emptyStateTitle}
              description={emptyStateDescription}
              ctaLabel="Ver propostas"
              onCta={() => nav("/")}
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((booking) => {
                const status = String(booking.status || "").toUpperCase();
                const holdInfo =
                  status === "HOLD"
                    ? holdRemaining(booking.holdExpiresAt)
                    : null;
                const offerTitle = booking?.offer?.title || "-";
                const publicToken = booking?.offer?.publicToken || "";

                return (
                  <div
                    key={booking._id}
                    className="rounded-xl border border-slate-200/80 bg-white/85 p-3 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                            {formatTime(booking.startAt, agendaTimeZone)} -{" "}
                            {formatTime(booking.endAt, agendaTimeZone)}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-slate-400">
                            {formatDate(booking.startAt, agendaTimeZone)}
                          </div>
                        </div>

                        <div className="mt-1 text-xs text-zinc-600 dark:text-slate-300">
                          Cliente:{" "}
                          <span className="font-medium">
                            {booking.customerName || "-"}
                          </span>
                          {booking.customerWhatsApp
                            ? ` | ${booking.customerWhatsApp}`
                            : ""}
                        </div>

                        <div className="mt-0.5 line-clamp-1 text-xs text-zinc-500 dark:text-slate-400">
                          Servico: {offerTitle}
                        </div>

                        {holdInfo ? (
                          <div className={`mt-1 text-[11px] ${holdInfo.tone}`}>
                            {holdInfo.label}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <Badge tone={status} />

                        <div className="flex flex-wrap gap-2">
                          {publicToken ? (
                            <Button
                              variant="ghost"
                              type="button"
                              onClick={() => openProposal(publicToken)}
                            >
                              Abrir proposta
                            </Button>
                          ) : null}

                          <Button
                            variant="secondary"
                            type="button"
                            onClick={() => handleCancel(booking._id)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-[1380px] space-y-5">
        <PageHeader
          eyebrow="Agenda"
          title="Agenda"
          subtitle="Acompanhe reservas e confirmacoes do workspace em lista e timeline diaria."
          actions={
            <Button
              variant="secondary"
              size="md"
              type="button"
              title="Configurar agenda"
              onClick={() => nav("/settings/agenda")}
            >
              Configuracoes
            </Button>
          }
        />

        <FilterBar
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDay(getTodayDateKey(agendaTimeZone))}
              >
                Hoje
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDay(shiftDateKey(day, -1))}
              >
                Dia anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDay(shiftDateKey(day, 1))}
              >
                Proximo dia
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setDay(shiftDateKey(getTodayDateKey(agendaTimeZone), 1))
                }
              >
                Amanha
              </Button>
            </div>
          }
          summary={
            <>
              <Badge tone="DRAFT">{title}</Badge>
              <Badge tone="PUBLIC">{summary.total} no filtro</Badge>
              <Badge tone="CONFIRMED">{summary.confirmed} confirmados</Badge>
              <Badge tone="HOLD">{summary.hold} reservas</Badge>
            </>
          }
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="w-full md:w-44">
                <Input
                  type="date"
                  value={day}
                  onChange={(event) => setDay(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={rangeMode === "day" ? "secondary" : "ghost"}
                  type="button"
                  onClick={() => setRangeMode("day")}
                >
                  Dia
                </Button>
                <Button
                  size="sm"
                  variant={rangeMode === "week" ? "secondary" : "ghost"}
                  type="button"
                  onClick={() => setRangeMode("week")}
                >
                  7 dias
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={statusTab === "all" ? "secondary" : "ghost"}
                  onClick={() => setStatusTab("all")}
                >
                  Todos
                </Button>
                <Button
                  size="sm"
                  variant={statusTab === "confirmed" ? "secondary" : "ghost"}
                  onClick={() => setStatusTab("confirmed")}
                >
                  Confirmados
                </Button>
                <Button
                  size="sm"
                  variant={statusTab === "hold" ? "secondary" : "ghost"}
                  onClick={() => setStatusTab("hold")}
                >
                  Reservas
                </Button>
                <Button size="sm" variant="secondary" onClick={load} disabled={busy}>
                  Atualizar
                </Button>
              </div>

              <div className="w-full sm:w-72">
                <Input
                  placeholder="Buscar por cliente, WhatsApp ou servico..."
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                />
              </div>
            </div>
          </div>
        </FilterBar>

        {rangeMode === "day" ? (
          <>
            {renderDayCalendar({ mode: "mobile", expanded: calendarExpanded })}
            <div className="grid gap-4 xl:grid-cols-12">
              <div className="xl:col-span-8">{renderListCard()}</div>
              {renderDayCalendar({ mode: "desktop" })}
            </div>
          </>
        ) : (
          renderListCard()
        )}

        <BookingQuickViewModal
          open={!!selectedBooking}
          item={selectedBooking}
          timezone={agendaTimeZone}
          onClose={() => setSelectedBooking(null)}
        />
      </div>
    </Shell>
  );
}
