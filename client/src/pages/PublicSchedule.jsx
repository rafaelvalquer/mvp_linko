import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../app/api.js";
import Button from "../components/appui/Button.jsx";
import { Input } from "../components/appui/Input.jsx";
import {
  isQuotaExceededError,
  quotaExceededMessage,
} from "../utils/planQuota.js";

function fmtBRL(cents) {
  const v = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v / 100);
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

function normStatus(s) {
  return String(s || "")
    .trim()
    .toUpperCase();
}

function safeDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export default function PublicSchedule() {
  const { token } = useParams();
  const navigate = useNavigate();

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

  // carrega proposta
  useEffect(() => {
    setOffer(null);
    setOfferErr("");
    api(`/p/${token}`)
      .then((d) => {
        setOffer(d.offer);
      })
      .catch((e) => {
        setOfferErr(e?.message || "Falha ao carregar proposta.");
      });
  }, [token]);

  const view = useMemo(() => {
    const o = offer || {};
    const inferredType =
      o.offerType ||
      (Array.isArray(o.items) && o.items.length ? "product" : "service");
    const offerType = inferredType === "product" ? "product" : "service";

    const totalCents =
      (Number.isFinite(o.totalCents) && o.totalCents) ||
      (Number.isFinite(o.amountCents) && o.amountCents) ||
      0;

    const depositPctRaw = Number(o.depositPct);
    const depositPct =
      Number.isFinite(depositPctRaw) && depositPctRaw > 0 ? depositPctRaw : 0;

    const depositEnabled = o.depositEnabled === false ? false : depositPct > 0;
    const depositCents = depositEnabled
      ? Math.round((totalCents * depositPct) / 100)
      : 0;
    const remainingCents = Math.max(0, totalCents - depositCents);

    return {
      offerType,
      totalCents,
      depositEnabled,
      depositPct,
      depositCents,
      remainingCents,
    };
  }, [offer]);

  const now = safeDate(slotsNow) || new Date();
  const todayStr = toDateInputValue(new Date());
  const isToday = date === todayStr;
  const pastTolMs = 90_000; // tolerância (90s)

  const getSlotUi = useCallback(
    (s) => {
      const st = normStatus(s?.status);
      const start = safeDate(s?.startAt);
      const isPast =
        isToday && start ? start.getTime() <= now.getTime() - pastTolMs : false;
      const disabled = st !== "FREE" || isPast;
      const label = isPast
        ? "Horário passado"
        : st === "HOLD"
          ? "Reservado"
          : st === "CONFIRMED"
            ? "Confirmado"
            : st === "FREE"
              ? "Livre"
              : "Indisponível";
      return { st, isPast, disabled, label };
    },
    [isToday, now, pastTolMs],
  );

  // carrega slots quando muda a data
  useEffect(() => {
    if (!offer) return;

    setSelected(null);
    setBooking(null);

    setLoadingSlots(true);
    setSlotsErr("");
    api(`/p/${token}/slots?date=${encodeURIComponent(date)}`)
      .then((d) => {
        setSlotsNow(d?.now || null);
        setSlots(Array.isArray(d.slots) ? d.slots : []);
      })
      .catch((e) => {
        setSlots([]);
        setSlotsErr(e?.message || "Falha ao carregar horários.");
      })
      .finally(() => setLoadingSlots(false));
  }, [token, date, offer]);

  // impede seleção fantasma: slot deixou de ser FREE ou virou passado
  useEffect(() => {
    if (!selected) return;
    const cur = slots.find(
      (s) => s?.startAt === selected?.startAt && s?.endAt === selected?.endAt,
    );
    if (!cur) {
      setSelected(null);
      return;
    }
    if (getSlotUi(cur).disabled) setSelected(null);
  }, [slots, slotsNow, date, selected, getSlotUi]);

  async function confirmBooking() {
    if (!selected) return;
    const selUi = getSlotUi(selected);
    if (selUi.disabled) return;

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
      // reflete HOLD imediatamente
      try {
        const d = await api(
          `/p/${token}/slots?date=${encodeURIComponent(date)}`,
        );
        setSlotsNow(d?.now || null);
        setSlots(Array.isArray(d.slots) ? d.slots : []);
      } catch {}
    } catch (e) {
      setBooking(null);

      if (isQuotaExceededError(e)) {
        setSlotsErr(quotaExceededMessage("public"));
        return;
      }

      const msg = e?.message || "Falha ao criar reserva.";

      // quando o backend retornar 409 "Horário indisponível."
      if (/indisponível/i.test(msg)) {
        setSlotsErr("Horário acabou de ser reservado. Escolha outro.");
        setSelected(null);
        try {
          const d = await api(
            `/p/${token}/slots?date=${encodeURIComponent(date)}`,
          );
          setSlotsNow(d?.now || null);
          setSlots(Array.isArray(d.slots) ? d.slots : []);
        } catch {}
      } else {
        setSlotsErr(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  if (offerErr) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {offerErr}
        </div>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-4 text-sm text-zinc-600">
          Carregando…
        </div>
      </div>
    );
  }

  // Se entrar aqui com produto, só avisa (fluxo futuro)
  if (view.offerType !== "service") {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-6">
          <div className="text-lg font-semibold text-zinc-900">Agendamento</div>
          <div className="mt-2 text-sm text-zinc-600">
            Este link é de <span className="font-semibold">produto</span>. No
            MVP atual, o fluxo de “Aceitar e pagar” será conectado depois.
          </div>
          <div className="mt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(`/p/${token}`)}
            >
              Voltar para a proposta
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">PayLink</div>
            <div className="text-xs text-zinc-500">
              Agendamento • Link público
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/p/${token}`)}
          >
            Voltar
          </Button>
        </div>
      </div>

      <div className="mx-auto grid max-w-2xl gap-4 px-4 py-6">
        {/* Resumo */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold text-zinc-500">Resumo</div>
          <div className="mt-1 text-xl font-semibold text-zinc-900">
            {offer.title}
          </div>
          <div className="mt-1 text-sm text-zinc-600">
            Para:{" "}
            <span className="font-semibold text-zinc-900">
              {offer.customerName}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border bg-zinc-50 p-4">
              <div className="text-xs font-semibold text-zinc-500">Total</div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">
                {fmtBRL(view.totalCents)}
              </div>
              {view.depositEnabled ? (
                <div className="mt-1 text-xs text-zinc-600">
                  Sinal:{" "}
                  <span className="font-semibold">
                    {fmtBRL(view.depositCents)}
                  </span>{" "}
                  ({view.depositPct}%) • Restante:{" "}
                  <span className="font-semibold">
                    {fmtBRL(view.remainingCents)}
                  </span>
                </div>
              ) : (
                <div className="mt-1 text-xs text-zinc-600">
                  Pagamento integral
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-zinc-50 p-4">
              <div className="text-xs font-semibold text-zinc-500">Duração</div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">
                {offer.durationMin || 0} min
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                Escolha um horário disponível para reservar.
              </div>
            </div>
          </div>
        </div>

        {/* Seleção de data */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-zinc-900">
            Selecione a data
          </div>
          <div className="mt-2 max-w-xs">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        {/* Slots */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-zinc-900">
              Horários disponíveis
            </div>
            {loadingSlots ? (
              <div className="text-xs text-zinc-500">Carregando…</div>
            ) : null}
          </div>

          {slotsErr ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {slotsErr}
            </div>
          ) : null}

          {isToday ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Horários passados ficam indisponíveis automaticamente.
            </div>
          ) : null}

          {loadingSlots ? (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 rounded-xl bg-zinc-100" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <div className="mt-3 text-sm text-zinc-600">
              Sem horários disponíveis.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {slots.map((s) => {
                const ui = getSlotUi(s);
                const disabled = ui.disabled;
                const isSel = selected?.startAt === s.startAt;
                return (
                  <button
                    key={s.startAt}
                    type="button"
                    disabled={disabled || busy || !!booking}
                    onClick={() => {
                      if (disabled || busy || booking) return;
                      setSelected(s);
                    }}
                    className={[
                      "rounded-xl border px-3 py-2 text-sm font-semibold transition",
                      disabled
                        ? "cursor-not-allowed bg-zinc-50 text-zinc-400"
                        : "bg-white text-zinc-900 hover:bg-zinc-50",
                      isSel
                        ? "border-emerald-500 ring-2 ring-emerald-100"
                        : "border-zinc-200",
                    ].join(" ")}
                    aria-pressed={isSel}
                  >
                    {fmtTime(s.startAt)}
                    <div className="text-xs">{ui.label}</div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-zinc-500">
              {selected ? (
                <>
                  Selecionado:{" "}
                  <span className="font-semibold text-zinc-900">
                    {fmtTime(selected.startAt)}
                  </span>
                </>
              ) : (
                "Selecione um horário para continuar."
              )}
            </div>

            <Button
              type="button"
              disabled={
                !selected || getSlotUi(selected).disabled || busy || !!booking
              }
              onClick={confirmBooking}
            >
              {busy
                ? "Confirmando…"
                : booking
                  ? "Reserva criada"
                  : "Confirmar agendamento"}
            </Button>
          </div>

          {booking ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-sm font-semibold text-emerald-800">
                Reserva criada (HOLD)
              </div>
              <div className="mt-1 text-sm text-emerald-900">
                {fmtTime(booking.startAt)} – {fmtTime(booking.endAt)}
              </div>
              <div className="mt-2 text-xs text-emerald-800">
                Próximo passo (MVP): direcionar para pagamento Pix.
              </div>
              <div className="mt-3">
                <Button type="button" variant="secondary" onClick={onGoPay}>
                  Ir para pagamento Pix
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
