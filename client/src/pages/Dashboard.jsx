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

  const kpis = useMemo(() => {
    const total = offers.length;
    const totalValueCents = offers.reduce(
      (acc, o) => acc + (o.amountCents || 0),
      0,
    );
    const last5 = offers.slice(0, 5);
    return { total, totalValueCents, last5 };
  }, [offers]);

  const fmtBRL = (cents) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format((cents || 0) / 100);

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
              meta: "somatório",
            },
            { label: "Conversão", value: "—", meta: "MVP" },
            { label: "Agendamentos", value: "—", meta: "MVP" },
            { label: "Pagos hoje", value: "—", meta: "MVP" },
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
                              <td className="border-b px-5 py-4">
                                <Badge tone={o.status || "PUBLIC"}>
                                  {o.status || "PUBLIC"}
                                </Badge>
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
                  <div className="mt-1 text-lg font-semibold">—</div>
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
