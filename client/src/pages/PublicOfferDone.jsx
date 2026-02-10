import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
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
  const [search] = useSearchParams();
  const navigate = useNavigate();

  const bookingId = search.get("bookingId") || "";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null); // { offer, booking, pix, locked, paidAt }

  const currentUrl = useMemo(() => {
    const q = bookingId ? `?bookingId=${encodeURIComponent(bookingId)}` : "";
    return `/p/${token}/done${q}`;
  }, [token, bookingId]);

  // bloqueio simples do "voltar"
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const onPop = () => {
      window.history.pushState(null, "", window.location.href);
      navigate(currentUrl, { replace: true });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [navigate, currentUrl]);

  useEffect(() => {
    if (!bookingId) {
      setErr("bookingId ausente. Esta página é somente para conclusão.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr("");

    api(`/p/${token}/summary?bookingId=${encodeURIComponent(bookingId)}`)
      .then((d) => {
        if (!d?.ok) throw new Error(d?.error || "Falha ao carregar resumo.");
        if (!d?.locked) {
          // se não está pago, não deixa ficar aqui
          navigate(
            `/p/${token}/pay?bookingId=${encodeURIComponent(bookingId)}`,
            {
              replace: true,
            },
          );
          return;
        }
        setData(d);
      })
      .catch((e) => {
        setErr(e?.message || "Falha ao carregar resumo.");
      })
      .finally(() => setLoading(false));
  }, [token, bookingId, navigate]);

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

  const offer = data?.offer || {};
  const booking = data?.booking || {};
  const pix = data?.pix || {};

  const totalCents =
    (Number.isFinite(offer.totalCents) && offer.totalCents) ||
    (Number.isFinite(offer.amountCents) && offer.amountCents) ||
    0;

  const depositPctRaw = Number(offer.depositPct);
  const depositPct =
    Number.isFinite(depositPctRaw) && depositPctRaw > 0 ? depositPctRaw : 0;

  const depositEnabled =
    offer.depositEnabled === false ? false : depositPct > 0;

  const depositCents = depositEnabled
    ? Math.round((totalCents * depositPct) / 100)
    : 0;

  const amountPaidNowCents = Number.isFinite(pix?.amount)
    ? pix.amount
    : depositEnabled
      ? depositCents
      : totalCents;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto grid max-w-2xl gap-4 px-4 py-8">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xl font-semibold text-zinc-900">
              Resumo da sua proposta
            </div>
            <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              Pago ✅
            </div>
          </div>

          <div className="mt-2 text-sm text-zinc-700">
            {offer.title || "Proposta"}
          </div>

          {offer.customerName ? (
            <div className="mt-2 text-sm text-zinc-600">
              Cliente:{" "}
              <span className="font-semibold text-zinc-900">
                {offer.customerName}
              </span>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border bg-zinc-50 p-4">
              <div className="text-xs font-semibold text-zinc-500">Total</div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">
                {fmtBRL(totalCents)}
              </div>
              {depositEnabled ? (
                <div className="mt-1 text-xs text-zinc-600">
                  Sinal:{" "}
                  <span className="font-semibold">{fmtBRL(depositCents)}</span>{" "}
                  ({depositPct}%)
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
                {fmtBRL(amountPaidNowCents)}
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                Reserva: {bookingId}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border bg-white p-4">
            <div className="text-xs font-semibold text-zinc-500">
              Agendamento
            </div>
            <div className="mt-1 text-sm text-zinc-800">
              {booking?.startAt ? (
                <>
                  Início:{" "}
                  <span className="font-semibold">
                    {fmtDateTime(booking.startAt)}
                  </span>
                </>
              ) : (
                <span className="text-zinc-500">—</span>
              )}
            </div>
            <div className="mt-1 text-sm text-zinc-800">
              {booking?.endAt ? (
                <>
                  Fim:{" "}
                  <span className="font-semibold">
                    {fmtDateTime(booking.endAt)}
                  </span>
                </>
              ) : (
                <span className="text-zinc-500">—</span>
              )}
            </div>

            {data?.paidAt ? (
              <div className="mt-2 text-xs text-zinc-600">
                Confirmado em:{" "}
                <span className="font-semibold">
                  {fmtDateTime(data.paidAt)}
                </span>
              </div>
            ) : null}
          </div>

          <div className="mt-5 rounded-2xl border bg-zinc-50 p-4 text-sm text-zinc-700">
            Esta etapa foi concluída. Você pode fechar esta página com
            segurança.
          </div>
        </div>
      </div>
    </div>
  );
}
