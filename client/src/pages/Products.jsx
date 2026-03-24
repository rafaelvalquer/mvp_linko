import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import { Input } from "../components/appui/Input.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";

import ProductModal from "../components/products/ProductModal.jsx";
import { createProduct, imageSrc, listProducts } from "../app/productsApi.js";

function fmtBRL(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents) || 0) / 100);
}

export default function Products() {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState(
    () => localStorage.getItem("products_view") || "cards",
  ); // cards|list
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  const [openNew, setOpenNew] = useState(false);

  useEffect(() => {
    localStorage.setItem("products_view", mode);
  }, [mode]);

  async function load(query = q) {
    setLoading(true);
    setError("");
    try {
      const d = await listProducts({ q: query });
      setItems(Array.isArray(d.items) ? d.items : []);
    } catch (e) {
      setError(e?.message || "Falha ao carregar produtos.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  // debounce da busca
  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const count = items.length;

  const viewToggle = (
    <div className="flex items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-xl border bg-white">
        <button
          type="button"
          className={[
            "px-3 py-2 text-sm",
            mode === "cards"
              ? "bg-zinc-100 font-semibold"
              : "text-zinc-600 hover:bg-zinc-50",
          ].join(" ")}
          onClick={() => setMode("cards")}
          aria-pressed={mode === "cards"}
          title="Cards"
        >
          ▦
        </button>
        <button
          type="button"
          className={[
            "px-3 py-2 text-sm",
            mode === "list"
              ? "bg-zinc-100 font-semibold"
              : "text-zinc-600 hover:bg-zinc-50",
          ].join(" ")}
          onClick={() => setMode("list")}
          aria-pressed={mode === "list"}
          title="Lista"
        >
          ≣
        </button>
      </div>

      <Button onClick={() => setOpenNew(true)}>+ Novo</Button>
    </div>
  );

  return (
    <Shell>
      <div className="space-y-4">
        <PageHeader
          title="Produtos"
          subtitle="Cadastre, pesquise e gerencie o catalogo do workspace."
          actions={viewToggle}
        />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}{" "}
            <button
              className="ml-2 font-semibold underline"
              onClick={() => load(q)}
            >
              Tentar novamente
            </button>
          </div>
        ) : null}

        <Card>
          <CardHeader
            title="Produtos"
            subtitle="Pesquise por nome ou ID em todo o catalogo do workspace."
            right={<div className="text-xs text-zinc-500">{count} itens</div>}
          />
          <CardBody className="space-y-3">
            <div className="max-w-sm">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Pesquisar (Nome ou ID)"
              />
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
                  >
                    <Skeleton className="h-32 w-full rounded-2xl" />
                    <div className="mt-3 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-5/6" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                title="Nenhum produto cadastrado"
                description='Clique em "Novo" para cadastrar o primeiro produto do workspace.'
                ctaLabel="Novo produto"
                onCta={() => setOpenNew(true)}
              />
            ) : mode === "cards" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((p) => (
                  <div
                    key={p._id}
                    className={[
                      "group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4",
                      "shadow-sm transition-all duration-300",
                      "hover:-translate-y-1 hover:shadow-xl hover:border-zinc-300",
                    ].join(" ")}
                  >
                    {/* Glow/gradiente sutil no hover */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                    {/* Badge do preço */}
                    <div className="absolute right-3 top-3 z-10 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                      {fmtBRL(p.priceCents)}
                    </div>

                    <div className="relative">
                      {/* Imagem */}
                      <div className="h-36 w-full overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50">
                        {p.imageUrl ? (
                          <img
                            src={imageSrc(p.imageUrl)}
                            alt={p.name || "Produto"}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                            Sem foto
                          </div>
                        )}
                      </div>

                      {/* Textos */}
                      <div className="mt-3">
                        <div className="text-sm font-semibold text-zinc-900 line-clamp-1">
                          {p.name}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500 line-clamp-2">
                          {p.description || "—"}
                        </div>
                      </div>

                      {/* Rodapé */}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-2">
                          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 font-mono text-[11px] text-zinc-600">
                            ID: {p.productId}
                          </span>
                        </div>

                        <Link to={`/store/products/${p._id}`}>
                          <Button variant="secondary">Detalhes</Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full min-w-[820px]">
                  <thead className="text-left text-xs font-semibold text-zinc-500">
                    <tr>
                      <th className="border-b py-3 pr-3">Imagem</th>
                      <th className="border-b py-3 pr-3">ID</th>
                      <th className="border-b py-3 pr-3">Nome</th>
                      <th className="border-b py-3 pr-3">Valor</th>
                      <th className="border-b py-3 pr-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {items.map((p) => (
                      <tr key={p._id} className="hover:bg-zinc-50">
                        <td className="border-b py-3 pr-3">
                          <div className="h-12 w-12 overflow-hidden rounded-xl border bg-zinc-50">
                            {p.imageUrl ? (
                              <img
                                src={imageSrc(p.imageUrl)}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                        </td>
                        <td className="border-b py-3 pr-3 font-mono text-xs">
                          {p.productId}
                        </td>
                        <td className="border-b py-3 pr-3">
                          <div className="font-semibold text-zinc-900">
                            {p.name}
                          </div>
                          <div className="text-xs text-zinc-500 line-clamp-1">
                            {p.description || "—"}
                          </div>
                        </td>
                        <td className="border-b py-3 pr-3 font-semibold">
                          {fmtBRL(p.priceCents)}
                        </td>
                        <td className="border-b py-3 pr-3">
                          <Link to={`/store/products/${p._id}`}>
                            <Button variant="secondary">Detalhes</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <ProductModal
          open={openNew}
          mode="create"
          initial={null}
          onClose={() => setOpenNew(false)}
          onSave={async (payload) => {
            await createProduct(payload);
            await load(q);
          }}
        />
      </div>
    </Shell>
  );
}
