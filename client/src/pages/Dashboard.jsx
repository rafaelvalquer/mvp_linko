// src/pages/Dashboard.jsx
import Shell from "../components/layout/Shell.jsx";
import { api } from "../app/api.js";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import Badge from "../components/appui/Badge.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import { Link } from "react-router-dom";

function normStatus(s) {
  return String(s || "")
    .trim()
    .toUpperCase();
}

function fmtDateTimeBR(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR");
}

function pixToneClasses(st) {
  const s = normStatus(st);
  if (s === "EXPIRED" || s === "CANCELLED") return "text-red-700";
  if (s === "REFUNDED") return "text-amber-800";
  if (s === "PENDING") return "text-amber-900";
  if (s === "PAID") return "text-emerald-800";
  return "text-zinc-500";
}

function isSameLocalDay(a, b) {
  if (!(a instanceof Date) || Number.isNaN(a.getTime())) return false;
  if (!(b instanceof Date) || Number.isNaN(b.getTime())) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function safeDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export default function Dashboard() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      setLoading(true);
      const d = await api("/offers");
      setOffers(d.items || []);
    } catch (e) {
      setError(e?.message || "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const fmtBRL = (cents) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format((cents || 0) / 100);

  const kpis = useMemo(() => {
    const total = offers.length;

    // Volume: mantém seu comportamento atual (somatório de amountCents)
    const totalValueCents = offers.reduce(
      (acc, o) => acc + (o.amountCents || 0),
      0,
    );

    const PAID_SET = new Set(["PAID", "CONFIRMED"]);
    const BOOKED_SET = new Set(["BOOKED_HOLD", "HOLD", "CONFIRMED", "PAID"]);

    const paidOffers = offers.filter((o) => PAID_SET.has(normStatus(o.status)));
    const paidCount = paidOffers.length;

    // Agendamentos: conta se tem bookingId/scheduledStartAt ou status de agendado
    const bookedOffers = offers.filter((o) => {
      const st = normStatus(o.status);
      return (
        !!o.bookingId ||
        !!o.scheduledStartAt ||
        !!o.scheduledEndAt ||
        BOOKED_SET.has(st)
      );
    });
    const bookedCount = bookedOffers.length;

    // Pagos hoje: conta e soma valores hoje (por paidAt; fallback: updatedAt)
    const now = new Date();
    const paidToday = paidOffers.filter((o) => {
      const dt = safeDate(o.paidAt) || safeDate(o.updatedAt);
      return dt ? isSameLocalDay(dt, now) : false;
    });
    const paidTodayCount = paidToday.length;

    // Valor pago hoje: fallback em amountCents, depois totalCents
    const paidTodayValueCents = paidToday.reduce(
      (acc, o) => acc + (o.amountCents || o.totalCents || 0),
      0,
    );

    // Conversão: pagos / propostas (em %)
    const conversionPct = total > 0 ? Math.round((paidCount / total) * 100) : 0;

    const last5 = offers.slice(0, 5);

    return {
      total,
      totalValueCents,
      last5,
      paidCount,
      bookedCount,
      conversionPct,
      paidTodayCount,
      paidTodayValueCents,
    };
  }, [offers]);

  return (
    <Shell>
      <div className="space-y-4">
        <PageHeader
          title="Dashboard"
          subtitle="Orçamento que vira contrato + cobrança + agenda em 1 clique."
          actions={
            <>
              <Button variant="secondary" onClick={load} disabled={loading}>
                Atualizar
              </Button>
              <Link to="/offers/new">
                <Button>Nova proposta</Button>
              </Link>
            </>
          }
        />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}{" "}
            <button className="ml-2 font-semibold underline" onClick={load}>
              Tentar novamente
            </button>
          </div>
        ) : null}

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Propostas", value: kpis.total, meta: "total" },
            {
              label: "Volume",
              value: fmtBRL(kpis.totalValueCents),
              meta: "somatório (amountCents)",
            },
            {
              label: "Conversão",
              value: `${kpis.conversionPct}%`,
              meta: `${kpis.paidCount}/${kpis.total} pagos`,
            },
            {
              label: "Agendamentos",
              value: kpis.bookedCount,
              meta: "com booking/hold",
            },
            {
              label: "Pagos hoje",
              value: kpis.paidTodayCount,
              meta: fmtBRL(kpis.paidTodayValueCents),
            },
          ].map((it) => (
            <Card key={it.label}>
              <CardBody>
                <div className="text-xs font-semibold text-zinc-500">
                  {it.label}
                </div>
                <div className="mt-2 text-xl font-semibold text-zinc-900">
                  {loading ? <Skeleton className="h-7 w-24" /> : it.value}
                </div>
                <div className="mt-1 text-xs text-zinc-400">{it.meta}</div>
              </CardBody>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Links recentes */}
          <div className="col-span-12 lg:col-span-8">
            <Card>
              <CardHeader
                title="Links recentes"
                subtitle="Ações rápidas: copiar e abrir link público."
                right={
                  <div className="text-xs text-zinc-500">
                    {offers.length} itens
                  </div>
                }
              />
              <CardBody className="p-0">
                {loading ? (
                  <div className="p-5 space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : offers.length === 0 ? (
                  <div className="p-5">
                    <EmptyState
                      title="Nenhuma proposta ainda"
                      description="Crie uma proposta e envie o link para o cliente."
                      ctaLabel="Nova proposta"
                      onCta={() => (window.location.href = "/offers/new")}
                    />
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full min-w-[720px]">
                      <thead className="text-left text-xs font-semibold text-zinc-500">
                        <tr>
                          <th className="border-b px-5 py-3">Cliente</th>
                          <th className="border-b px-5 py-3">Serviço</th>
                          <th className="border-b px-5 py-3">Valor</th>
                          <th className="border-b px-5 py-3">Status</th>
                          <th className="border-b px-5 py-3">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {kpis.last5.map((o) => {
                          const publicUrl = `/p/${o.publicToken}`;
                          const payUrl = `${publicUrl}/pay`;
                          const pixSt = normStatus(o?.payment?.lastPixStatus);
                          const pixUpdatedAt = o?.payment?.lastPixUpdatedAt;

                          const offerSt = normStatus(o?.status);
                          const isPaidOffer =
                            offerSt === "PAID" || offerSt === "CONFIRMED";

                          return (
                            <tr key={o._id} className="hover:bg-zinc-50">
                              <td className="border-b px-5 py-4">
                                <div className="font-semibold text-zinc-900">
                                  {o.customerName}
                                </div>
                                <div className="text-xs text-zinc-500">
                                  {o.customerWhatsApp || "—"}
                                </div>
                              </td>
                              <td className="border-b px-5 py-4">
                                <div className="font-medium text-zinc-900">
                                  {o.title}
                                </div>
                                <div className="text-xs text-zinc-500 line-clamp-1">
                                  {o.description || "—"}
                                </div>
                              </td>
                              <td className="border-b px-5 py-4 font-semibold">
                                {fmtBRL(o.amountCents)}
                              </td>

                              {/* ✅ Status (reaproveita coluna atual) */}
                              <td className="border-b px-5 py-4">
                                <div className="space-y-1">
                                  <Badge tone={o.status || "PUBLIC"}>
                                    {o.status || "PUBLIC"}
                                  </Badge>

                                  {pixSt ? (
                                    <div
                                      className={`text-[11px] ${pixToneClasses(
                                        pixSt,
                                      )}`}
                                    >
                                      Pix:{" "}
                                      <span className="font-semibold">
                                        {pixSt}
                                      </span>
                                      {pixUpdatedAt ? (
                                        <> • {fmtDateTimeBR(pixUpdatedAt)}</>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              </td>

                              <td className="border-b px-5 py-4">
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    variant="secondary"
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(
                                          window.location.origin + publicUrl,
                                        );
                                      } catch {}
                                    }}
                                  >
                                    Copiar
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    type="button"
                                    onClick={() =>
                                      window.open(
                                        publicUrl,
                                        "_blank",
                                        "noopener,noreferrer",
                                      )
                                    }
                                  >
                                    Abrir
                                  </Button>

                                  {/* ✅ ação rápida quando houve falha/pendência */}
                                  {!isPaidOffer ? (
                                    <Button
                                      variant="secondary"
                                      type="button"
                                      onClick={() =>
                                        window.open(
                                          payUrl,
                                          "_blank",
                                          "noopener,noreferrer",
                                        )
                                      }
                                    >
                                      Abrir pagamento
                                    </Button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Painéis laterais (MVP placeholders) */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <Card>
              <CardHeader
                title="Agenda (MVP)"
                subtitle="Reservas e confirmados aparecerão aqui."
              />
              <CardBody>
                <div className="rounded-xl border bg-zinc-50 p-3 text-sm text-zinc-600">
                  Próximo passo: listar bookings (HOLD/CONFIRMED) com filtro por
                  dia.
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Caixa (MVP)"
                subtitle="Resumo de pagos/pendentes/reembolsos."
              />
              <CardBody className="space-y-3">
                <div className="rounded-xl border bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-500">
                    Pagos hoje
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {loading ? "—" : fmtBRL(kpis.paidTodayValueCents)}
                  </div>
                </div>
                <div className="rounded-xl border bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-500">
                    Pendentes
                  </div>
                  <div className="mt-1 text-lg font-semibold">—</div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </Shell>
  );
}
