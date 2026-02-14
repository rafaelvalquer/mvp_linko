import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";

import ProductModal from "../components/products/ProductModal.jsx";
import { getProduct, imageSrc, updateProduct } from "../app/productsApi.js";

function fmtBRL(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents) || 0) / 100);
}

export default function ProductDetails() {
  const { id } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [product, setProduct] = useState(null);

  const [openEdit, setOpenEdit] = useState(false);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const d = await getProduct(id);
      setProduct(d.product);
    } catch (e) {
      setErr(e?.message || "Falha ao carregar produto.");
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <Shell>
      <div className="space-y-4">
        <PageHeader
          title="Detalhes do produto"
          subtitle="Informações do produto"
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => nav(-1)}>
                Voltar
              </Button>
              <Button onClick={() => setOpenEdit(true)} disabled={!product}>
                Editar
              </Button>
            </div>
          }
        />

        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {err}
          </div>
        ) : null}

        <Card>
          <CardHeader
            title="Informações do produto"
            subtitle="Foto do produto"
          />
          <CardBody>
            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Skeleton className="h-56 w-full" />
                <div className="space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-5 w-1/3" />
                </div>
              </div>
            ) : !product ? (
              <div className="text-sm text-zinc-600">
                Produto não encontrado.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="overflow-hidden rounded-2xl border bg-zinc-50">
                  {product.imageUrl ? (
                    <img
                      src={imageSrc(product.imageUrl)}
                      alt=""
                      className="h-56 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-56 items-center justify-center text-sm text-zinc-400">
                      Sem foto
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold text-zinc-500">
                      Product
                    </div>
                    <div className="mt-1 text-sm text-zinc-500">
                      Nome do produto
                    </div>
                    <div className="text-lg font-semibold text-zinc-900">
                      {product.name}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      ID: {product.productId}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      Descrição
                    </div>
                    <div className="mt-1 text-sm text-zinc-700 whitespace-pre-wrap">
                      {product.description || "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      Preço
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {fmtBRL(product.priceCents)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <ProductModal
          open={openEdit}
          mode="edit"
          initial={product}
          onClose={() => setOpenEdit(false)}
          onSave={async (payload) => {
            await updateProduct(id, payload);
            await load();
          }}
        />
      </div>
    </Shell>
  );
}
