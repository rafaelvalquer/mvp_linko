import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../app/api.js";

function fmtBRL(cents) {
  const v = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v / 100);
}

function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR");
}

export default function PublicOfferDone() {
  const { token } = useParams();
  const nav = useNavigate();
  const [search] = useSearchParams();
  const bookingId = search.get("bookingId") || "";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [summary, setSummary] = useState(null);

  // bloqueia "voltar" (mantém na página final)
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const onPop = () =>
      window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    if (bookingId) q.set("bookingId", bookingId);
    const s = q.toString();
    return s ? `?${s}` : "";
  }, [bookingId]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr("");
      try {
        const d = await api(`/p/${token}/summary${qs}`);
        if (!d?.ok) throw new Error(d?.error || "Falha ao carregar resumo.");

        // se não estiver pago, volta para a pública normal
        if (!d?.summary?.locked) {
          nav(`/p/${token}`, { replace: true });
          return;
        }

        if (alive) setSummary(d.summary);
      } catch (e) {
        if (alive) setErr(e?.message || "Falha ao carregar resumo.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token, qs, nav]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-4 text-sm text-zinc-600">
          Carregando…
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {err}
        </div>
      </div>
    );
  }

  const s = summary || {};
  const offer = s.offer || {};
  const booking = s.booking || {};

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="border-b bg-white">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="text-lg font-semibold text-zinc-900">
            Resumo da sua proposta
          </div>
          <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            Pago ✅
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-2xl gap-4 px-4 py-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold text-zinc-500">Proposta</div>
          <div className="mt-1 text-xl font-semibold text-zinc-900">
            {offer.title || "Pagamento"}
          </div>

          {offer.customerName ? (
            <div className="mt-1 text-sm text-zinc-600">
              Para:{" "}
              <span className="font-semibold text-zinc-900">
                {offer.customerName}
              </span>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border bg-zinc-50 p-4">
              <div className="text-xs font-semibold text-zinc-500">Total</div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">
                {fmtBRL(s.totalCents)}
              </div>
              {s.depositEnabled ? (
                <div className="mt-1 text-xs text-zinc-600">
                  Sinal:{" "}
                  <span className="font-semibold">
                    {fmtBRL(s.depositCents)}
                  </span>{" "}
                  ({s.depositPct}%)
                </div>
              ) : (
                <div className="mt-1 text-xs text-zinc-600">
                  Pagamento integral
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-emerald-50 p-4">
              <div className="text-xs font-semibold text-emerald-700">
                Valor pago agora
              </div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">
                {fmtBRL(s.amountToChargeCents)}
              </div>
              {s.paidAt ? (
                <div className="mt-1 text-xs text-zinc-600">
                  Pago em: {fmtDateTime(s.paidAt)}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border bg-white p-4">
            <div className="text-xs font-semibold text-zinc-500">Reserva</div>
            <div className="mt-1 text-sm text-zinc-800">
              ID:{" "}
              <span className="font-semibold text-zinc-900">
                {booking.id || bookingId || "—"}
              </span>
            </div>
            {booking.startAt && booking.endAt ? (
              <div className="mt-1 text-xs text-zinc-600">
                Horário: {fmtDateTime(booking.startAt)} –{" "}
                {fmtDateTime(booking.endAt)}
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl border bg-zinc-50 p-4 text-sm text-zinc-700">
            Esta etapa foi concluída. Você pode fechar esta página com
            segurança.
          </div>
        </div>
      </div>
    </div>
  );
}
