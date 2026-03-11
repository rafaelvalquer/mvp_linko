import Badge from "../appui/Badge.jsx";
import Button from "../appui/Button.jsx";
import ModalShell from "../appui/ModalShell.jsx";
import {
  formatDateTime,
  formatTime,
  getCalendarTimeZone,
  holdRemaining,
} from "./calendarUtils.js";

function humanStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "CONFIRMED") return "Confirmado";
  if (normalized === "HOLD") return "Reservado";
  return normalized || "-";
}

function DetailBlock({ label, value, hint = "" }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
        {value || "-"}
      </div>
      {hint ? (
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export default function BookingQuickViewModal({
  open,
  item,
  timezone,
  onClose,
}) {
  if (!open || !item) return null;

  const timeZone = getCalendarTimeZone(timezone);
  const status = String(item?.status || "").trim().toUpperCase();
  const holdInfo = status === "HOLD" ? holdRemaining(item?.holdExpiresAt) : null;
  const publicToken = item?.offer?.publicToken || "";

  return (
    <ModalShell open={open} onClose={onClose} panelClassName="max-w-2xl">
      <div className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.94))] shadow-[0_32px_80px_-42px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(9,15,28,0.94))] dark:shadow-[0_32px_80px_-42px_rgba(15,23,42,0.82)]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <div className="truncate text-lg font-bold text-slate-950 dark:text-white">
              {item?.customerName || "Reserva"}
            </div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-300">
              {item?.offer?.title || "Servico sem titulo"}
            </div>
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/85 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-cyan-400/20 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={() => onClose?.()}
            aria-label="Fechar"
          >
            x
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status}>{humanStatus(status)}</Badge>
            {holdInfo ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
                {holdInfo.label}
              </span>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailBlock label="Cliente" value={item?.customerName || "-"} />
            <DetailBlock
              label="WhatsApp"
              value={item?.customerWhatsApp || "-"}
            />
            <DetailBlock label="Servico" value={item?.offer?.title || "-"} />
            <DetailBlock
              label="Periodo"
              value={`${formatDateTime(item?.startAt, timeZone)} - ${formatTime(item?.endAt, timeZone)}`}
            />
            <DetailBlock label="Status" value={humanStatus(status)} />
            {status === "HOLD" ? (
              <DetailBlock
                label="Expiracao do HOLD"
                value={item?.holdExpiresAt ? formatDateTime(item.holdExpiresAt, timeZone) : "-"}
                hint={holdInfo?.label || ""}
              />
            ) : null}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200/80 px-5 py-4 sm:flex-row sm:justify-end dark:border-white/10">
          <Button type="button" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          {publicToken ? (
            <Button
              type="button"
              onClick={() =>
                window.open(`/p/${publicToken}`, "_blank", "noopener,noreferrer")
              }
            >
              Abrir proposta
            </Button>
          ) : null}
        </div>
      </div>
    </ModalShell>
  );
}
