import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Search, Store, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import {
  getMyPageShopProducts,
  saveMyPageShop,
} from "../app/myPageApi.js";
import { imageSrc } from "../app/productsApi.js";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Badge from "../components/appui/Badge.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import ModalShell from "../components/appui/ModalShell.jsx";
import { Input } from "../components/appui/Input.jsx";
import { useMyPageContext } from "../components/my-page/useMyPageContext.js";

function fmtBRL(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents || 0) || 0) / 100);
}

export default function MyPageShopPage() {
  const { page, setPage, setErr } = useMyPageContext();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [modalItems, setModalItems] = useState([]);
  const [draftSelectedIds, setDraftSelectedIds] = useState([]);
  const [draftShowPrices, setDraftShowPrices] = useState(true);

  async function loadProducts(query = "") {
    const response = await getMyPageShopProducts(query);
    return Array.isArray(response?.items) ? response.items : [];
  }

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        const nextItems = await loadProducts("");
        if (!active) return;
        setItems(nextItems);
      } catch (error) {
        if (!active) return;
        setErr(error?.message || "Nao consegui carregar os produtos do shop.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [setErr]);

  useEffect(() => {
    if (!modalOpen) return undefined;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setModalLoading(true);
        const nextItems = await loadProducts(modalSearch);
        if (!active) return;
        setModalItems(nextItems);
      } catch (error) {
        if (!active) return;
        setErr(error?.message || "Nao consegui buscar produtos.");
      } finally {
        if (active) setModalLoading(false);
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [modalOpen, modalSearch, setErr]);

  useEffect(() => {
    setDraftShowPrices(page?.shop?.showPrices !== false);
  }, [page?.shop?.showPrices]);

  const selectedProducts = useMemo(
    () => items.filter((item) => item.selected === true),
    [items],
  );
  const persistedSelectedIds = useMemo(
    () =>
      Array.isArray(page?.shop?.productIds)
        ? page.shop.productIds.filter(Boolean)
        : [],
    [page?.shop?.productIds],
  );
  const showPricesDirty = draftShowPrices !== (page?.shop?.showPrices !== false);

  const selectedDraftSet = useMemo(
    () => new Set(draftSelectedIds),
    [draftSelectedIds],
  );

  function openModal() {
    setDraftSelectedIds(selectedProducts.map((item) => item._id).filter(Boolean));
    setModalSearch("");
    setModalItems(items);
    setModalOpen(true);
  }

  function toggleDraftSelection(id) {
    if (!id) return;
    setDraftSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  async function persistShop(productIds = [], options = {}) {
    const { closeModal = false } = options;
    try {
      setSaving(true);
      setErr("");
      const response = await saveMyPageShop(
        Array.isArray(productIds) ? productIds.filter(Boolean) : [],
        draftShowPrices,
      );
      setPage(response?.page || null);
      setDraftShowPrices(response?.page?.shop?.showPrices !== false);
      const refreshedItems = await loadProducts("");
      setItems(refreshedItems);
      if (closeModal) setModalOpen(false);
    } catch (error) {
      setErr(error?.message || "Nao consegui salvar os produtos do shop.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveShop() {
    await persistShop(draftSelectedIds, { closeModal: true });
  }

  async function handleSaveShowPrices() {
    await persistShop(persistedSelectedIds);
  }

  async function handleRemoveSelected(id) {
    const nextIds = selectedProducts
      .map((item) => item._id)
      .filter(Boolean)
      .filter((item) => item !== id);
    await persistShop(nextIds);
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Seu shop"
          subtitle="Escolha quais produtos do workspace devem aparecer no catálogo e no pedir orçamento."
          right={<Badge tone="PUBLIC">{selectedProducts.length}</Badge>}
        />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Produtos no shop
              </div>
              <div className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                {selectedProducts.length}
              </div>
            </div>
            <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Catálogo público
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                Só mostra o que estiver selecionado aqui
              </div>
            </div>
            <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Pedir orçamento
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                Usa essa mesma curadoria de produtos
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Mostrar valor dos produtos
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  Controla se o catalogo publico exibe o preco de cada item.
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="inline-flex cursor-pointer items-center gap-3 self-start sm:self-auto">
                  <span className="relative inline-flex h-7 w-12 items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={draftShowPrices}
                      onChange={(event) =>
                        setDraftShowPrices(event.target.checked)
                      }
                    />
                    <span className="absolute inset-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 dark:bg-slate-700 dark:peer-checked:bg-emerald-400" />
                    <span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
                  </span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                    {draftShowPrices ? "Ativo" : "Oculto"}
                  </span>
                </label>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving || !showPricesDirty}
                  onClick={handleSaveShowPrices}
                >
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Se o shop ficar vazio, o catálogo público exibe estado vazio e o orçamento continua disponível só para solicitação geral.
            </div>
            <Button type="button" onClick={openModal}>
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Produtos selecionados"
          subtitle="Estes itens aparecem no catálogo público e como opções no workflow de orçamento."
        />
        <CardBody className="space-y-3">
          {loading ? null : selectedProducts.length ? (
            selectedProducts.map((product) => (
              <div
                key={product._id}
                className="flex flex-col gap-4 rounded-[24px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.14)] sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                    {product.imageUrl ? (
                      <img
                        src={imageSrc(product.imageUrl)}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Store className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-950 dark:text-white">
                      {product.name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {product.productId || "Produto"}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                      {fmtBRL(product.priceCents)}
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => handleRemoveSelected(product._id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Remover
                </Button>
              </div>
            ))
          ) : (
            <EmptyState
              title="Nenhum produto no shop"
              description="Selecione os produtos que devem aparecer no catálogo e no pedir orçamento da sua página."
              ctaLabel="Adicionar ao shop"
              onCta={openModal}
            />
          )}

          {!items.length && !loading ? (
            <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 dark:border-white/10 dark:bg-white/5">
              <div className="text-sm font-semibold text-slate-950 dark:text-white">
                Você ainda não cadastrou produtos no workspace.
              </div>
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Cadastre seus produtos primeiro para poder montar o shop da Minha Página.
              </div>
              <div className="mt-4">
                <Link to="/store/products">
                  <Button type="button" variant="secondary">
                    Ir para Produtos
                  </Button>
                </Link>
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <ModalShell open={modalOpen} onClose={() => setModalOpen(false)} panelClassName="max-w-4xl">
        <Card>
          <CardHeader
            title="Adicionar ao seu shop"
            subtitle="Marque quais produtos devem aparecer no catálogo público e no fluxo de pedir orçamento."
          />
          <CardBody className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-11"
                value={modalSearch}
                onChange={(event) => setModalSearch(event.target.value)}
                placeholder="Buscar por nome ou ID do produto"
              />
            </div>

            <div className="grid max-h-[58vh] gap-3 overflow-y-auto pr-1">
              {modalLoading ? null : modalItems.length ? (
                modalItems.map((product) => {
                  const checked = selectedDraftSet.has(product._id);
                  return (
                    <label
                      key={product._id}
                      className={[
                        "flex cursor-pointer items-start gap-4 rounded-[24px] border px-4 py-4 transition",
                        checked
                          ? "border-sky-300 bg-sky-50/80 dark:border-sky-300/30 dark:bg-sky-400/10"
                          : "border-slate-200/80 bg-white/90 dark:border-white/10 dark:bg-white/5",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDraftSelection(product._id)}
                        className="mt-1"
                      />
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                        {product.imageUrl ? (
                          <img
                            src={imageSrc(product.imageUrl)}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Store className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-950 dark:text-white">
                          {product.name}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {product.productId || "Produto"}
                        </div>
                        {product.description ? (
                          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                            {product.description}
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-100">
                        {fmtBRL(product.priceCents)}
                      </div>
                    </label>
                  );
                })
              ) : (
                <EmptyState
                  title="Nenhum produto encontrado"
                  description="Ajuste a busca ou cadastre mais produtos no workspace."
                />
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {draftSelectedIds.length} produto(s) selecionado(s)
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="button" disabled={saving} onClick={handleSaveShop}>
                  <Check className="h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar seleção"}
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </ModalShell>
    </>
  );
}
