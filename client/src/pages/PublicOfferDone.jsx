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

function safeInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
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

  // Itens (resiliente a nomes diferentes)
  const rawItems = Array.isArray(offer.items)
    ? offer.items
    : Array.isArray(offer.products)
      ? offer.products
      : [];

  const items = rawItems
    .map((it, idx) => {
      const name =
        String(
          it?.name || it?.title || it?.description || it?.produto || "",
        ).trim() || `Item ${idx + 1}`;
      const qty = Math.max(
        1,
        safeInt(it?.qty ?? it?.quantity ?? it?.qtd ?? 1, 1),
      );
      const unitCents = Math.max(
        0,
        safeInt(
          it?.unitCents ??
            it?.priceCents ??
            it?.unitPriceCents ??
            it?.valorUnitCents ??
            0,
          0,
        ),
      );
      const subtotalCents = qty * unitCents;
      return { name, qty, unitCents, subtotalCents };
    })
    .filter((it) => it.name);

  const hasItems = items.length > 0;
  const itemsSubtotalCents = items.reduce(
    (acc, it) => acc + (it.subtotalCents || 0),
    0,
  );

  const totalCents = safeInt(
    s.totalCents ?? offer.totalCents ?? offer.amountCents ?? 0,
    0,
  );
  const paidNowCents = safeInt(s.amountToChargeCents ?? 0, 0);
  const remainingCents = s.depositEnabled
    ? Math.max(totalCents - paidNowCents, 0)
    : 0;

  const pay = s.payment || offer.payment || {};
  const pixStatus = String(
    pay.lastPixStatus || pay.pixStatus || pay.status || "",
  )
    .trim()
    .toUpperCase();
  const txid = pay.txid || pay.pixTxid || pay.providerTxid || "";
  const endToEndId = pay.endToEndId || pay.e2eId || pay.endToEnd || "";

  const isDeposit = !!s.depositEnabled;
  const paidLabel = isDeposit ? "Sinal pago" : "Pago (integral)";

  const notes =
    offer.notes || offer.observations || offer.observacao || offer.obs || "";

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="border-b bg-white">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="text-lg font-semibold text-zinc-900">
            Pagamento confirmado
          </div>
          <div className="mt-1 text-sm text-zinc-600">
            Resumo do que você contratou e do que foi pago.
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
                {fmtBRL(totalCents)}
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
                {paidLabel}
              </div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">
                {fmtBRL(paidNowCents)}
              </div>
              {s.paidAt ? (
                <div className="mt-1 text-xs text-zinc-600">
                  Pago em: {fmtDateTime(s.paidAt)}
                </div>
              ) : null}
              <div className="mt-1 text-xs text-zinc-600">Forma: Pix</div>
              {isDeposit ? (
                <div className="mt-1 text-xs text-zinc-700">
                  Saldo restante:{" "}
                  <span className="font-semibold">
                    {fmtBRL(remainingCents)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Pagamento (detalhes Pix) */}
          <div className="mt-4 rounded-2xl border bg-white p-4">
            <div className="text-xs font-semibold text-zinc-500">Pagamento</div>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              <div className="text-sm text-zinc-800">
                <span className="text-xs text-zinc-500">Valor pago</span>
                <div className="font-semibold text-zinc-900">
                  {fmtBRL(paidNowCents)}
                </div>
              </div>
              <div className="text-sm text-zinc-800">
                <span className="text-xs text-zinc-500">Forma</span>
                <div className="font-semibold text-zinc-900">Pix</div>
              </div>
              {s.paidAt ? (
                <div className="text-sm text-zinc-800">
                  <span className="text-xs text-zinc-500">Data/hora</span>
                  <div className="font-semibold text-zinc-900">
                    {fmtDateTime(s.paidAt)}
                  </div>
                </div>
              ) : null}
              {pixStatus ? (
                <div className="text-sm text-zinc-800">
                  <span className="text-xs text-zinc-500">Status Pix</span>
                  <div className="font-semibold text-zinc-900">{pixStatus}</div>
                </div>
              ) : null}
              {txid ? (
                <div className="text-sm text-zinc-800">
                  <span className="text-xs text-zinc-500">TXID</span>
                  <div className="font-semibold text-zinc-900 break-all">
                    {txid}
                  </div>
                </div>
              ) : null}
              {endToEndId ? (
                <div className="text-sm text-zinc-800">
                  <span className="text-xs text-zinc-500">EndToEnd</span>
                  <div className="font-semibold text-zinc-900 break-all">
                    {endToEndId}
                  </div>
                </div>
              ) : null}
            </div>

            {isDeposit ? (
              <div className="mt-3 rounded-xl border bg-zinc-50 p-3 text-sm text-zinc-700">
                Você pagou o sinal agora. O saldo restante (
                {fmtBRL(remainingCents)}) será combinado/ajustado com o
                prestador.
              </div>
            ) : null}
          </div>

          {/* O que será prestado/entregue */}
          {hasItems ? (
            <div className="mt-4 rounded-2xl border bg-white p-4">
              <div className="text-xs font-semibold text-zinc-500">
                Itens do orçamento
              </div>

              {/* Mobile: cards */}
              <div className="mt-3 space-y-2 sm:hidden">
                {items.map((it, idx) => (
                  <div key={idx} className="rounded-xl border bg-zinc-50 p-3">
                    <div className="text-sm font-semibold text-zinc-900">
                      {it.name}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-zinc-600">
                      <span>
                        Qtd:{" "}
                        <span className="font-semibold text-zinc-900">
                          {it.qty}
                        </span>
                      </span>
                      <span>
                        Unit:{" "}
                        <span className="font-semibold text-zinc-900">
                          {fmtBRL(it.unitCents)}
                        </span>
                      </span>
                      <span>
                        Sub:{" "}
                        <span className="font-semibold text-zinc-900">
                          {fmtBRL(it.subtotalCents)}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: tabela clean */}
              <div className="mt-3 hidden overflow-auto sm:block">
                <table className="w-full text-left">
                  <thead className="text-xs font-semibold text-zinc-500">
                    <tr>
                      <th className="border-b py-2 pr-3">Descrição</th>
                      <th className="border-b py-2 pr-3">Qtd</th>
                      <th className="border-b py-2 pr-3">Unitário</th>
                      <th className="border-b py-2">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50">
                        <td className="border-b py-3 pr-3">
                          <div className="font-medium text-zinc-900">
                            {it.name}
                          </div>
                        </td>
                        <td className="border-b py-3 pr-3">{it.qty}</td>
                        <td className="border-b py-3 pr-3 font-semibold">
                          {fmtBRL(it.unitCents)}
                        </td>
                        <td className="border-b py-3 font-semibold">
                          {fmtBRL(it.subtotalCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl border bg-zinc-50 p-3 text-sm">
                <div className="text-zinc-600">Subtotal dos itens</div>
                <div className="font-semibold text-zinc-900">
                  {fmtBRL(itemsSubtotalCents)}
                </div>
              </div>

              {notes ? (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-zinc-500">
                    Observações
                  </div>
                  <div className="mt-1 rounded-xl border bg-white p-3 text-sm text-zinc-700 whitespace-pre-wrap">
                    {String(notes)}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border bg-white p-4">
              <div className="text-xs font-semibold text-zinc-500">
                Serviço contratado
              </div>
              <div className="mt-2 text-base font-semibold text-zinc-900">
                {offer.title || "Serviço"}
              </div>
              {offer.description ? (
                <div className="mt-1 text-sm text-zinc-700 whitespace-pre-wrap">
                  {offer.description}
                </div>
              ) : null}

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {offer.durationMin ? (
                  <div className="rounded-xl border bg-zinc-50 p-3 text-sm">
                    <div className="text-xs font-semibold text-zinc-500">
                      Duração
                    </div>
                    <div className="mt-1 font-semibold text-zinc-900">
                      {offer.durationMin} min
                    </div>
                  </div>
                ) : null}
                {offer.policyText ? (
                  <div className="rounded-xl border bg-zinc-50 p-3 text-sm">
                    <div className="text-xs font-semibold text-zinc-500">
                      Política
                    </div>
                    <div className="mt-1 text-zinc-700 whitespace-pre-wrap">
                      {offer.policyText}
                    </div>
                  </div>
                ) : null}
              </div>

              {notes ? (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-zinc-500">
                    Observações
                  </div>
                  <div className="mt-1 rounded-xl border bg-white p-3 text-sm text-zinc-700 whitespace-pre-wrap">
                    {String(notes)}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Reserva */}
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
