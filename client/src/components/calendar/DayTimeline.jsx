import { useEffect, useMemo, useState } from "react";
import useThemeToggle from "../../app/useThemeToggle.js";
import {
  formatDateKey,
  formatMinutesLabel,
  formatTime,
  getCalendarTimeZone,
  getMinutesOfDay,
  getVisibleRange,
  holdRemaining,
  safeDate,
} from "./calendarUtils.js";

const BASE_PIXELS_PER_MINUTE = 1.4;
const MIN_TIMELINE_HEIGHT = 520;

function getEventTone(status, isDark) {
  const normalized = String(status || "").trim().toUpperCase();

  if (normalized === "CONFIRMED") {
    return isDark
      ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-50 hover:border-emerald-300/55"
      : "border-emerald-200 bg-emerald-50/95 text-emerald-950 hover:border-emerald-300";
  }

  return isDark
    ? "border-amber-400/35 bg-amber-400/12 text-amber-50 hover:border-amber-300/55"
    : "border-amber-200 bg-amber-50/95 text-amber-950 hover:border-amber-300";
}

function buildTimelineEvents(items, day, timeZone, slotMinutes) {
  const normalized = (items || [])
    .map((item) => {
      const start = safeDate(item?.startAt);
      const end = safeDate(item?.endAt);
      if (!start || !end) return null;
      if (formatDateKey(start, timeZone) !== day) return null;

      const startMin = getMinutesOfDay(start, timeZone);
      const endMin = getMinutesOfDay(end, timeZone);
      if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) return null;

      return {
        item,
        id: item?._id || `${item?.startAt || ""}-${item?.endAt || ""}`,
        startMin,
        endMin: endMin > startMin ? endMin : startMin + slotMinutes,
        status: String(item?.status || "").trim().toUpperCase(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const groups = [];
  let currentGroup = [];
  let currentGroupEnd = -Infinity;

  for (const event of normalized) {
    if (!currentGroup.length || event.startMin < currentGroupEnd) {
      currentGroup.push(event);
      currentGroupEnd = Math.max(currentGroupEnd, event.endMin);
      continue;
    }

    groups.push(currentGroup);
    currentGroup = [event];
    currentGroupEnd = event.endMin;
  }

  if (currentGroup.length) groups.push(currentGroup);

  return groups.flatMap((group) => {
    const columns = [];
    let maxColumns = 1;

    const positioned = group.map((event) => {
      let columnIndex = columns.findIndex((columnEnd) => columnEnd <= event.startMin);

      if (columnIndex === -1) {
        columnIndex = columns.length;
        columns.push(event.endMin);
      } else {
        columns[columnIndex] = event.endMin;
      }

      maxColumns = Math.max(maxColumns, columns.length);

      return {
        ...event,
        columnIndex,
      };
    });

    return positioned.map((event) => ({
      ...event,
      totalColumns: maxColumns,
    }));
  });
}

export default function DayTimeline({
  items = [],
  day,
  agendaSettings,
  timezone,
  onSelect,
  minHeight = MIN_TIMELINE_HEIGHT,
  hourColumnWidth = 64,
  compact = false,
  showResponsible = false,
}) {
  const { isDark } = useThemeToggle();
  const timeZone = useMemo(
    () => getCalendarTimeZone(timezone || agendaSettings?.timezone),
    [agendaSettings?.timezone, timezone],
  );

  const visibleRange = useMemo(
    () => getVisibleRange(agendaSettings, day, items, timeZone),
    [agendaSettings, day, items, timeZone],
  );

  const events = useMemo(
    () => buildTimelineEvents(items, day, timeZone, visibleRange.slotMinutes),
    [day, items, timeZone, visibleRange.slotMinutes],
  );

  const totalMinutes = Math.max(visibleRange.endMin - visibleRange.startMin, 60);
  const effectiveMinHeight = Math.max(
    240,
    Number.isFinite(Number(minHeight)) ? Number(minHeight) : MIN_TIMELINE_HEIGHT,
  );
  const basePixelsPerMinute = compact ? 1.2 : BASE_PIXELS_PER_MINUTE;
  const pixelsPerMinute = Math.max(
    basePixelsPerMinute,
    effectiveMinHeight / totalMinutes,
  );
  const timelineHeight = Math.max(
    effectiveMinHeight,
    Math.round(totalMinutes * pixelsPerMinute),
  );

  const rows = useMemo(() => {
    const marks = [];
    for (let minute = visibleRange.startMin; minute <= visibleRange.endMin; minute += 30) {
      marks.push(minute);
    }
    return marks;
  }, [visibleRange.endMin, visibleRange.startMin]);

  const positionedEvents = useMemo(
    () =>
      events.map((event) => {
        const top = (event.startMin - visibleRange.startMin) * pixelsPerMinute;
        const height = Math.max(
          (event.endMin - event.startMin) * pixelsPerMinute,
          48,
        );
        const widthPercent = 100 / event.totalColumns;

        return {
          ...event,
          top,
          height,
          leftPercent: event.columnIndex * widthPercent,
          widthPercent,
        };
      }),
    [events, pixelsPerMinute, visibleRange.startMin],
  );

  const isToday = day === formatDateKey(new Date(), timeZone);
  const [nowMinute, setNowMinute] = useState(() =>
    getMinutesOfDay(new Date(), timeZone),
  );

  useEffect(() => {
    if (!isToday) return undefined;

    const updateNow = () => {
      setNowMinute(getMinutesOfDay(new Date(), timeZone));
    };

    updateNow();
    const timer = window.setInterval(updateNow, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [isToday, timeZone]);

  const nowTop =
    isToday &&
    Number.isFinite(nowMinute) &&
    nowMinute >= visibleRange.startMin &&
    nowMinute <= visibleRange.endMin
      ? (nowMinute - visibleRange.startMin) * pixelsPerMinute
      : null;

  return (
    <div
      className={`overflow-hidden rounded-[24px] border ${
        isDark
          ? "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(9,15,28,0.68))]"
          : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))]"
      }`}
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: `${hourColumnWidth}px minmax(0,1fr)` }}
      >
        <div
          className={`relative border-r ${
            isDark
              ? "border-white/10 bg-white/[0.03]"
              : "border-slate-200/80 bg-slate-50/80"
          }`}
        >
          <div className="relative" style={{ height: `${timelineHeight}px` }}>
            {rows
              .filter((minute) => minute % 60 === 0)
              .map((minute) => (
                <div
                  key={`label-${minute}`}
                  className={`absolute inset-x-0 -translate-y-1/2 px-3 text-[11px] font-semibold ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                  style={{
                    top: `${(minute - visibleRange.startMin) * pixelsPerMinute}px`,
                  }}
                >
                  {formatMinutesLabel(minute)}
                </div>
              ))}
          </div>
        </div>

        <div className="relative min-w-0">
          <div className="relative" style={{ height: `${timelineHeight}px` }}>
            {rows.map((minute) => (
              <div
                key={`line-${minute}`}
                className={`absolute inset-x-0 border-t ${
                  minute % 60 === 0
                    ? isDark
                      ? "border-white/10"
                      : "border-slate-200/80"
                    : isDark
                      ? "border-dashed border-white/5"
                      : "border-dashed border-slate-100"
                }`}
                style={{
                  top: `${(minute - visibleRange.startMin) * pixelsPerMinute}px`,
                }}
              />
            ))}

            {nowTop != null ? (
              <div
                className="pointer-events-none absolute inset-x-0 z-10"
                style={{ top: `${nowTop}px` }}
              >
                <div className="absolute -left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.18)]" />
                <div className="border-t border-rose-500" />
                <div className="absolute right-3 top-0 -translate-y-1/2 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
                  Agora
                </div>
              </div>
            ) : null}

            {positionedEvents.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                <div className="max-w-sm">
                  <div
                    className={`text-sm font-semibold ${
                      isDark ? "text-slate-100" : "text-slate-900"
                    }`}
                  >
                    Nenhum agendamento filtrado neste dia
                  </div>
                  <div
                    className={`mt-2 text-xs leading-5 ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    A grade continua disponivel para voce acompanhar novos horarios.
                  </div>
                </div>
              </div>
            ) : null}

            {positionedEvents.map((event) => {
              const isEventCompact = compact || event.height < 86;
              const customer = event.item?.customerName || "Cliente";
              const service = event.item?.offer?.title || "Servico";
              const responsible = event.item?.responsibleUser?.name || "";
              const holdInfo =
                event.status === "HOLD"
                  ? holdRemaining(event.item?.holdExpiresAt)
                  : null;

              return (
                <button
                  key={event.id}
                  type="button"
                  className={`absolute z-20 overflow-hidden rounded-2xl border text-left shadow-[0_12px_28px_-22px_rgba(15,23,42,0.65)] transition-transform hover:z-30 hover:-translate-y-0.5 focus:z-30 focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                    compact ? "px-2 py-1.5" : "px-2.5 py-2"
                  } ${getEventTone(
                    event.status,
                    isDark,
                  )}`}
                  style={{
                    top: `${event.top}px`,
                    left: `calc(${event.leftPercent}% + 4px)`,
                    width: `calc(${event.widthPercent}% - 8px)`,
                    height: `${event.height}px`,
                  }}
                  onClick={() => onSelect?.(event.item)}
                  title={`${formatTime(event.item?.startAt, timeZone)} - ${formatTime(event.item?.endAt, timeZone)} | ${customer}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[10px] font-bold uppercase tracking-[0.16em] opacity-80">
                      {formatTime(event.item?.startAt, timeZone)} -{" "}
                      {formatTime(event.item?.endAt, timeZone)}
                    </div>
                    {!isEventCompact ? (
                      <div className="text-[9px] font-bold uppercase tracking-[0.16em] opacity-70">
                        {event.status === "CONFIRMED" ? "Confirmado" : "Hold"}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-1 truncate text-sm font-semibold">
                    {customer}
                  </div>

                  {!isEventCompact && showResponsible && responsible ? (
                    <div className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.12em] opacity-75">
                      {responsible}
                    </div>
                  ) : null}

                  {!isEventCompact ? (
                    <div className="mt-1 line-clamp-2 text-[11px] leading-4 opacity-85">
                      {service}
                    </div>
                  ) : null}

                  {!isEventCompact && holdInfo ? (
                    <div className="mt-1 truncate text-[10px] font-semibold text-amber-900 dark:text-amber-200">
                      {holdInfo.label}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
