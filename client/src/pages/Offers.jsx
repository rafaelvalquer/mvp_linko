import Shell from "../components/layout/Shell.jsx";
import { useEffect, useMemo, useState } from "react";
import { api } from "../app/api.js";
import { Link } from "react-router-dom";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import { Input } from "../components/appui/Input.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import Badge from "../components/appui/Badge.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";

export default function Offers() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");

  async function load() {
    try {
      setError("");
      setLoading(true);
      const d = await api("/offers");
      setItems(d.items || []);
    } catch (e) {
      setError(e?.message || "Falha ao carregar propostas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const s =
      status === "ALL"
        ? items
        : items.filter((o) => (o.status || "PUBLIC") === status);
    if (!query) return s;
    return s.filter((o) => {
      const a = (o.customerName || "").toLowerCase();
      const b = (o.title || "").toLowerCase();
      return a.includes(query) || b.includes(query);
    });
  }, [items, q, status]);

  const fmtBRL = (cents) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format((cents || 0) / 100);

  return (
    <Shell>
      <div className="space-y-4">
        <PageHeader
          title="Propostas"
          subtitle="Gerencie links enviados aos clientes, status e ações rápidas."
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

        <Card>
          <CardHeader
            title="Links gerados"
            subtitle="Busque por cliente/serviço e filtre por status."
            right={
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  aria-label="Filtrar por status"
                  className="rounded-xl border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="ALL">Todos</option>
                  <option value="PUBLIC">PUBLIC</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="EXPIRED">EXPIRED</option>
                </select>
                <div className="w-full sm:w-64">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar cliente ou serviço…"
                  />
                </div>
              </div>
            }
          />

          <CardBody className="p-0">
            {loading ? (
              <div className="p-5 space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="Nenhuma proposta encontrada"
                  description="Ajuste filtros/busca ou crie uma nova proposta."
                  ctaLabel="Nova proposta"
                  onCta={() => (window.location.href = "/offers/new")}
                />
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="text-left text-xs font-semibold text-zinc-500">
                    <tr>
                      <th className="border-b px-5 py-3">Cliente</th>
                      <th className="border-b px-5 py-3">Serviço</th>
                      <th className="border-b px-5 py-3">Valor</th>
                      <th className="border-b px-5 py-3">Status</th>
                      <th className="border-b px-5 py-3">Link</th>
                      <th className="border-b px-5 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {filtered.map((o) => {
                      const publicUrl = `/p/${o.publicToken}`;
                      const full = window.location.origin + publicUrl;
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
                            <span className="font-mono text-xs text-zinc-600">
                              {publicUrl}
                            </span>
                          </td>
                          <td className="border-b px-5 py-4">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="secondary"
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(full);
                                  } catch {}
                                }}
                              >
                                Copiar link
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
                              <Button
                                variant="ghost"
                                type="button"
                                onClick={() =>
                                  alert(
                                    "Detalhes (MVP): página de detalhes pode ser a próxima rota.",
                                  )
                                }
                              >
                                Detalhes
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
    </Shell>
  );
}
