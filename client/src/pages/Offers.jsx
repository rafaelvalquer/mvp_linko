import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../app/api.js";

// Componentes da UI
import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import { Input } from "../components/appui/Input.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import Badge from "../components/appui/Badge.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";

// Ícones simples para manter a UI "clean" sem novas dependências
const IconCopy = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2}
    stroke="currentColor"
    className="w-4 h-4"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
    />
  </svg>
);

const IconExternal = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2}
    stroke="currentColor"
    className="w-4 h-4"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
    />
  </svg>
);

const IconEye = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2}
    stroke="currentColor"
    className="w-4 h-4"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

export default function Offers() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [copiedId, setCopiedId] = useState(null);

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
        : items.filter((o) => {
            const st = String(o.status || "PUBLIC").toUpperCase();
            return st === status;
          });

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

  const handleCopyLink = async (id, url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch (err) {}
  };

  return (
    <Shell>
      <div className="space-y-6">
        <PageHeader
          title="Propostas"
          subtitle="Acompanhe o status e ações de seus links comerciais."
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={load}
                disabled={loading}
                className="hidden sm:inline-flex"
              >
                Atualizar
              </Button>
              <Link to="/offers/new">
                <Button>Nova Proposta</Button>
              </Link>
            </div>
          }
        />

        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              {error}
            </div>
            <button className="font-semibold underline" onClick={load}>
              Tentar novamente
            </button>
          </div>
        )}

        <Card>
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <span className="text-zinc-900">Links Gerados</span>
                {!loading && (
                  <span className="text-[11px] font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">
                    {filtered.length} total
                  </span>
                )}
              </div>
            }
            right={
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="ALL">Todos os status</option>
                  <option value="PUBLIC">Publico</option>
                  <option value="PAID">Pago</option>
                  <option value="ACCEPTED">Aceito</option>
                  <option value="EXPIRED">Expirado</option>
                </select>
                <div className="w-full sm:w-60">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar cliente ou serviço…"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            }
          />

          <CardBody className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12">
                <EmptyState
                  title="Nenhuma proposta"
                  description="Ajuste os filtros ou crie uma nova."
                  ctaLabel="Criar Proposta"
                  onCta={() => (window.location.href = "/offers/new")}
                />
              </div>
            ) : (
              <>
                {/* Desktop: Tabela Otimizada */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50/50">
                        <th className="border-b border-zinc-100 px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          Cliente
                        </th>
                        <th className="border-b border-zinc-100 px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          Serviço
                        </th>
                        <th className="border-b border-zinc-100 px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          Valor
                        </th>
                        <th className="border-b border-zinc-100 px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400 text-center">
                          Status
                        </th>
                        <th className="border-b border-zinc-100 px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400 text-right">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filtered.map((o) => {
                        const publicUrl = `/p/${o.publicToken}`;
                        const fullUrl = window.location.origin + publicUrl;
                        const isCopied = copiedId === o._id;

                        return (
                          <tr
                            key={o._id}
                            className="hover:bg-zinc-50/50 transition-colors group"
                          >
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-zinc-900 leading-tight">
                                {o.customerName}
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                {o.customerWhatsApp || "—"}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-zinc-700 font-medium line-clamp-1 truncate max-w-[180px]">
                                {o.title}
                              </div>
                              <div className="text-[11px] text-zinc-400 line-clamp-1 italic">
                                {o.description || "—"}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-zinc-900">
                              {fmtBRL(o.amountCents)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Badge tone={o.status || "PUBLIC"}>
                                {o.status || "PUBLIC"}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant={isCopied ? "primary" : "secondary"}
                                  size="sm"
                                  onClick={() => handleCopyLink(o._id, fullUrl)}
                                  className="h-8 px-3 text-[12px] flex items-center gap-1.5 transition-all"
                                >
                                  <IconCopy />
                                  {isCopied ? "Copiado" : "Copiar"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    window.open(
                                      publicUrl,
                                      "_blank",
                                      "noopener,noreferrer",
                                    )
                                  }
                                  className="h-8 w-8 !p-0 flex items-center justify-center hover:bg-zinc-100"
                                  title="Abrir link"
                                >
                                  <IconExternal />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    alert(
                                      "Detalhes (MVP): rota em desenvolvimento.",
                                    )
                                  }
                                  className="h-8 w-8 !p-0 flex items-center justify-center hover:bg-zinc-100"
                                  title="Ver Detalhes"
                                >
                                  <IconEye />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: Cards Compactos */}
                <div className="md:hidden divide-y divide-zinc-100">
                  {filtered.map((o) => {
                    const publicUrl = `/p/${o.publicToken}`;
                    const fullUrl = window.location.origin + publicUrl;
                    const isCopied = copiedId === o._id;

                    return (
                      <div key={o._id} className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="max-w-[70%]">
                            <div className="text-sm font-bold text-zinc-900 truncate">
                              {o.customerName}
                            </div>
                            <div className="text-xs text-zinc-500 truncate">
                              {o.title}
                            </div>
                          </div>
                          <Badge tone={o.status || "PUBLIC"}>
                            {o.status || "PUBLIC"}
                          </Badge>
                        </div>

                        <div className="flex justify-between items-center bg-zinc-50 rounded-lg p-2.5">
                          <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-tight">
                            Total
                          </span>
                          <span className="text-sm font-bold text-zinc-900">
                            {fmtBRL(o.amountCents)}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            variant={isCopied ? "primary" : "secondary"}
                            size="sm"
                            className="text-xs h-9"
                            onClick={() => handleCopyLink(o._id, fullUrl)}
                          >
                            {isCopied ? "Copiado" : "Copiar"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-9 border border-zinc-200"
                            onClick={() => window.open(publicUrl, "_blank")}
                          >
                            Abrir
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-9 border border-zinc-200"
                            onClick={() => alert("Detalhes (MVP)")}
                          >
                            Ver
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </Shell>
  );
}
