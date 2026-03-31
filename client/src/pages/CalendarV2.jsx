// src/pages/CalendarV2.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listWorkspaceUsers } from "../app/authApi.js";
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
    <div className="surface-quiet rounded-2xl border border-rose-200/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:text-rose-200">
      <span>{err}</span>
      <button
        className="ml-2 font-semibold underline underline-offset-2"
        onClick={onRetry}
      >
        Tentar novamente
      </button>
    </div>
  );
}

export default function Calendar() {
  const nav = useNavigate();
  const { signOut, perms, user } = useAuth();
  const initialOwnerTeamCalendar =
    perms?.isWorkspaceOwner === true && perms?.isWorkspaceTeamPlan === true;

  const [agendaSettings, setAgendaSettings] = useState(null);
  const [day, setDay] = useState(() => getTodayDateKey());
  const [rangeMode, setRangeMode] = useState("day");
  const [statusTab, setStatusTab] = useState("all");
  const [q, setQ] = useState("");
  const [agendaScopeTab, setAgendaScopeTab] = useState(() =>
    initialOwnerTeamCalendar ? "workspace" : "mine",
  );
  const [teamOwnerFilter, setTeamOwnerFilter] = useState("all");
  const [teamUsers, setTeamUsers] = useState([]);
  const [teamUsersBusy, setTeamUsersBusy] = useState(false);
  const [ownerScopeInitialized, setOwnerScopeInitialized] = useState(
    initialOwnerTeamCalendar,
  );

  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [calendarExpanded, setCalendarExpanded] = useState(true);

  const agendaTimeZone = getCalendarTimeZone(agendaSettings?.timezone);
  const isOwnerTeamCalendar =
    perms?.isWorkspaceOwner === true && perms?.isWorkspaceTeamPlan === true;
  const canAccessAgendaSettings = perms?.modules?.settings === true;
  const selectClass = "app-field h-10 w-full rounded-2xl px-3";

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

  const teamSelectableUsers = useMemo(
    () =>
      (teamUsers || []).filter(
        (member) => String(member?._id || "") !== String(user?._id || ""),
      ),
    [teamUsers, user?._id],
  );

  const selectedTeamMemberName = useMemo(() => {
    if (teamOwnerFilter === "all") return "Toda a equipe";
    if (teamOwnerFilter === "me") return "Somente eu";
    const found = teamSelectableUsers.find(
      (member) => String(member?._id || "") === String(teamOwnerFilter || ""),
    );
    return found?.name || "Usuario selecionado";
  }, [teamOwnerFilter, teamSelectableUsers]);

  const scopeBadgeLabel = useMemo(() => {
    if (!isOwnerTeamCalendar) return "Minha agenda";
    if (agendaScopeTab === "mine") return "Minha agenda";
    return `Equipe: ${selectedTeamMemberName}`;
  }, [agendaScopeTab, isOwnerTeamCalendar, selectedTeamMemberName]);

  const bookingQuery = useMemo(() => {
    const params = {
      from: fromIso,
      to: toIso,
      status: statusParam,
      scope: isOwnerTeamCalendar
        ? agendaScopeTab === "workspace"
          ? "workspace"
          : "mine"
        : "mine",
    };

    if (isOwnerTeamCalendar && agendaScopeTab === "workspace") {
      if (teamOwnerFilter === "me" && user?._id) {
        params.ownerUserId = user._id;
      } else if (teamOwnerFilter && teamOwnerFilter !== "all") {
        params.ownerUserId = teamOwnerFilter;
      }
    }

    return params;
  }, [
    agendaScopeTab,
    fromIso,
    isOwnerTeamCalendar,
    statusParam,
    teamOwnerFilter,
    toIso,
    user?._id,
  ]);

  async function handleUnauthorized(error) {
    if (error?.status !== 401) return false;

    signOut();
    nav(`/login?next=${encodeURIComponent("/calendar")}`, {
      replace: true,
    });
    return true;
  }

  async function loadTeamUsers() {
    if (!isOwnerTeamCalendar) {
      setTeamUsers([]);
      return;
    }

    try {
      setTeamUsersBusy(true);
      const data = await listWorkspaceUsers();
      setTeamUsers(data?.items || []);
    } catch (error) {
      if (await handleUnauthorized(error)) return;
      setTeamUsers([]);
    } finally {
      setTeamUsersBusy(false);
    }
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
      const data = await listBookings(bookingQuery);
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
  }, [bookingQuery]);

  useEffect(() => {
    loadAgendaSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isOwnerTeamCalendar) {
      if (!ownerScopeInitialized) {
        setAgendaScopeTab("workspace");
        setTeamOwnerFilter("all");
        setOwnerScopeInitialized(true);
      }
      return;
    }

    setAgendaScopeTab("mine");
    setTeamOwnerFilter("all");
    setTeamUsers([]);
    setOwnerScopeInitialized(false);
  }, [isOwnerTeamCalendar, ownerScopeInitialized]);

  useEffect(() => {
    loadTeamUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwnerTeamCalendar]);

  useEffect(() => {
    if (!isOwnerTeamCalendar || agendaScopeTab !== "workspace") return;
    if (teamOwnerFilter === "all" || teamOwnerFilter === "me") return;

    const exists = teamSelectableUsers.some(
      (member) => String(member?._id || "") === String(teamOwnerFilter || ""),
    );

    if (!exists) {
      setTeamOwnerFilter("all");
    }
  }, [agendaScopeTab, isOwnerTeamCalendar, teamOwnerFilter, teamSelectableUsers]);

  const filtered = useMemo(() => {
    const term = String(q || "")
      .trim()
      .toLowerCase();

    if (!term) return items;

    return (items || []).filter((booking) => {
      const customer = String(booking.customerName || "").toLowerCase();
      const service = String(booking?.offer?.title || "").toLowerCase();
      const whatsapp = String(booking.customerWhatsApp || "").toLowerCase();
      const responsible = String(
        booking?.responsibleUser?.name || "",
      ).toLowerCase();
      return (
        customer.includes(term) ||
        service.includes(term) ||
        whatsapp.includes(term) ||
        responsible.includes(term)
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

  const showResponsibleDetails =
    isOwnerTeamCalendar && agendaScopeTab === "workspace";

  const responsibleSummary = useMemo(() => {
    if (!showResponsibleDetails) return [];

    const stats = new Map();
    for (const booking of filtered || []) {
      const responsibleId = String(
        booking?.responsibleUser?._id || booking?.ownerUserId || "unknown",
      );
      const current = stats.get(responsibleId) || {
        key: responsibleId,
        name: booking?.responsibleUser?.name || "Sem responsavel",
        total: 0,
        confirmed: 0,
        hold: 0,
      };

      current.total += 1;
      if (String(booking?.status || "").toUpperCase() === "CONFIRMED") {
        current.confirmed += 1;
      }
      if (String(booking?.status || "").toUpperCase() === "HOLD") {
        current.hold += 1;
      }

      stats.set(responsibleId, current);
    }

    return Array.from(stats.values()).sort(
      (a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR"),
    );
  }, [filtered, showResponsibleDetails]);

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
        showResponsible={showResponsibleDetails}
      />
    );

    if (desktop) {
      return (
        <div className="hidden xl:col-span-4 xl:block">
          <div className="xl:ml-auto xl:w-full xl:max-w-[420px] 2xl:max-w-[460px]">
            <Card variant="quiet">
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
        <Card variant="quiet">
          <CardHeader
            title="Calendario do dia"
            subtitle={`Preview compacto do dia. Fuso ativo: ${agendaTimeZone}`}
            right={
              <button
                type="button"
                className="surface-quiet inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white"
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
          subtitle={
            showResponsibleDetails
              ? "Area operacional da equipe com identificacao do responsavel por cada reserva."
              : "Area operacional para abrir propostas e cancelar reservas."
          }
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
                const responsibleName =
                  booking?.responsibleUser?.name || "Sem responsavel";

                return (
                  <div
                    key={booking._id}
                    className="surface-quiet rounded-2xl px-4 py-3"
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

                        {showResponsibleDetails ? (
                          <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-slate-400">
                            Responsavel:{" "}
                            <span className="font-medium text-zinc-700 dark:text-slate-200">
                              {responsibleName}
                            </span>
                          </div>
                        ) : null}

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
          subtitle={
            isOwnerTeamCalendar
              ? "Coordene sua agenda e a operacao da equipe com filtros por responsavel, lista e timeline diaria."
              : "Acompanhe reservas e confirmacoes do workspace em lista e timeline diaria."
          }
          actions={
            canAccessAgendaSettings ? (
            <Button
              variant="secondary"
              size="md"
              type="button"
              title="Configurar agenda"
              onClick={() => nav("/settings/agenda")}
            >
              Configuracoes
            </Button>
            ) : null
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
              <Badge tone="NEUTRAL">
                {scopeBadgeLabel}
              </Badge>
              <Badge tone="NEUTRAL">{title}</Badge>
              <Badge tone="NEUTRAL">{summary.total} no filtro</Badge>
              <Badge tone="CONFIRMED">{summary.confirmed} confirmados</Badge>
              <Badge tone="HOLD">{summary.hold} reservas</Badge>
            </>
          }
        >
          <div className="space-y-3">
            {isOwnerTeamCalendar ? (
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={agendaScopeTab === "mine" ? "secondary" : "ghost"}
                    type="button"
                    onClick={() => setAgendaScopeTab("mine")}
                  >
                    Minha agenda
                  </Button>
                  <Button
                    size="sm"
                    variant={agendaScopeTab === "workspace" ? "secondary" : "ghost"}
                    type="button"
                    onClick={() => setAgendaScopeTab("workspace")}
                  >
                    Equipe
                  </Button>
                </div>

                {agendaScopeTab === "workspace" ? (
                  <div className="w-full lg:w-[320px]">
                    <select
                      className={selectClass}
                      value={teamOwnerFilter}
                      onChange={(event) => setTeamOwnerFilter(event.target.value)}
                      disabled={teamUsersBusy}
                    >
                      <option value="all">Toda a equipe</option>
                      <option value="me">Somente eu</option>
                      {teamSelectableUsers.map((member) => (
                        <option key={member._id} value={member._id}>
                          {member.name}
                          {member.status === "disabled" ? " (desativado)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            ) : null}

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
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={load}
                    disabled={busy}
                  >
                    Atualizar
                  </Button>
                </div>

                <div className="w-full sm:w-80">
                  <Input
                    placeholder={
                      showResponsibleDetails
                        ? "Buscar por cliente, responsavel, WhatsApp ou servico..."
                        : "Buscar por cliente, WhatsApp ou servico..."
                    }
                    value={q}
                    onChange={(event) => setQ(event.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </FilterBar>

        {showResponsibleDetails ? (
          <Card variant="quiet">
            <CardHeader
              title="Equipe no periodo"
              subtitle="Resumo rapido por responsavel para o filtro e intervalo atuais."
            />
            <CardBody>
              {responsibleSummary.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {responsibleSummary.map((entry) => (
                    <div
                      key={entry.key}
                      className="surface-quiet rounded-2xl px-4 py-3"
                    >
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {entry.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {entry.total} agendamento{entry.total === 1 ? "" : "s"} no periodo
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone="NEUTRAL">{entry.total} total</Badge>
                        <Badge tone="CONFIRMED">{entry.confirmed} confirmados</Badge>
                        <Badge tone="HOLD">{entry.hold} reservas</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Nenhum agendamento encontrado para o filtro atual da equipe.
                </div>
              )}
            </CardBody>
          </Card>
        ) : null}

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
