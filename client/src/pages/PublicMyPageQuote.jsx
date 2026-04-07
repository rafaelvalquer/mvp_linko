import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, MessageCircle, ShoppingBag } from "lucide-react";
import {
  getPublicMyPageQuoteContext,
  submitPublicMyPageQuoteRequest,
} from "../app/myPageApi.js";
import useThemeToggle from "../app/useThemeToggle.js";
import brand from "../assets/brand.png";
import Button from "../components/appui/Button.jsx";
import { Input, Textarea } from "../components/appui/Input.jsx";

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function fmtBRL(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents || 0) || 0) / 100);
}

function SurfaceCard({ className = "", children }) {
  const { isDark } = useThemeToggle();
  return (
    <section
      className={cls(
        "rounded-[30px] border p-5 sm:p-6",
        isDark
          ? "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(8,15,30,0.86))]"
          : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.92))]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export default function PublicMyPageQuote() {
  const { slug } = useParams();
  const { isDark } = useThemeToggle();
  const [searchParams] = useSearchParams();
  const productIds = searchParams.getAll("productId");
  const productIdsKey = productIds.join("|");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(null);
  const [page, setPage] = useState(null);
  const [products, setProducts] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [requestType, setRequestType] = useState("service");
  const [form, setForm] = useState({
    customerName: "",
    customerWhatsApp: "",
    customerEmail: "",
    message: "",
  });

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");
        const response = await getPublicMyPageQuoteContext(slug, productIds);
        if (!active) return;
        setPage(response?.page || null);
        setProducts(Array.isArray(response?.products) ? response.products : []);
        setSelectedIds(
          Array.isArray(response?.selectedProducts)
            ? response.selectedProducts
                .map((item) => item._id || item.productId || "")
                .filter(Boolean)
            : [],
        );
        setRequestType(response?.requestTypeDefault || "service");
      } catch (error) {
        if (!active) return;
        setErr(error?.message || "Nao consegui abrir o fluxo de orcamento.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [slug, productIdsKey]);

  const whatsappButton = (page?.buttons || []).find(
    (button) => button.type === "whatsapp",
  );

  const selectedProducts = useMemo(
    () =>
      products.filter((product) =>
        selectedIds.includes(product._id || product.productId),
      ),
    [products, selectedIds],
  );

  function toggleProduct(product) {
    const key = product._id || product.productId;
    setSelectedIds((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
    setRequestType("product");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setSubmitting(true);
      setErr("");
      const response = await submitPublicMyPageQuoteRequest(slug, {
        ...form,
        requestType,
        selectedProductIds: selectedIds,
      });
      setSuccess({
        request: response?.request || null,
        whatsappUrl: response?.whatsappUrl || "",
      });
    } catch (error) {
      setErr(error?.message || "Nao consegui enviar sua solicitacao.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div
        className={cls(
          "min-h-screen px-4 py-6 sm:px-6 lg:px-8",
          isDark
            ? "bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.14),transparent_38%),linear-gradient(180deg,#020617,#0f172a_50%,#020617)] text-white"
            : "bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.1),transparent_38%),linear-gradient(180deg,#f8fafc,#eef2ff_48%,#f8fafc)] text-slate-950",
        )}
      >
        <div className="mx-auto max-w-2xl">
          <SurfaceCard className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="mt-5 text-2xl font-black tracking-[-0.04em]">
              Pedido enviado com sucesso
            </div>
            <div
              className={cls(
                "mt-3 text-sm leading-7",
                isDark ? "text-slate-300" : "text-slate-600",
              )}
            >
              Sua solicitacao foi registrada e a equipe vai retornar com a proposta.
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link to={`/u/${slug}`}>
                <Button type="button" variant="secondary">
                  Voltar para a pagina
                </Button>
              </Link>
              {success.whatsappUrl ? (
                <Button
                  type="button"
                  onClick={() =>
                    window.open(
                      success.whatsappUrl,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  <MessageCircle className="h-4 w-4" />
                  Falar no WhatsApp
                </Button>
              ) : null}
            </div>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cls(
        "min-h-screen px-4 py-6 sm:px-6 lg:px-8",
        isDark
          ? "bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.14),transparent_38%),linear-gradient(180deg,#020617,#0f172a_50%,#020617)] text-white"
          : "bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.1),transparent_38%),linear-gradient(180deg,#f8fafc,#eef2ff_48%,#f8fafc)] text-slate-950",
      )}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <SurfaceCard>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <img
                src={page?.avatarUrl || brand}
                alt={page?.title || "Minha Pagina"}
                className="h-16 w-16 rounded-[22px] object-cover"
              />
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700 dark:text-sky-200">
                  Pedir orcamento
                </div>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">
                  {page?.title || "Minha Pagina"}
                </h1>
                <p
                  className={cls(
                    "mt-2 max-w-2xl text-sm leading-7",
                    isDark ? "text-slate-300" : "text-slate-600",
                  )}
                >
                  Preencha seus dados e conte o que voce precisa. Se quiser,
                  selecione produtos do catalogo para agilizar a proposta.
                </p>
              </div>
            </div>

            {whatsappButton?.targetUrl ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  window.open(
                    whatsappButton.targetUrl,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
              >
                <MessageCircle className="h-4 w-4" />
                Falar no WhatsApp
              </Button>
            ) : null}
          </div>
        </SurfaceCard>

        {loading ? (
          <SurfaceCard className="h-72 animate-pulse" />
        ) : err ? (
          <SurfaceCard className="text-center text-sm text-red-700 dark:text-red-200">
            {err}
          </SurfaceCard>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <SurfaceCard>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    className={cls(
                      "rounded-[24px] border px-4 py-4 text-left",
                      requestType === "service"
                        ? isDark
                          ? "border-sky-300/40 bg-sky-400/10"
                          : "border-sky-200 bg-sky-50"
                        : isDark
                          ? "border-white/10 bg-white/5"
                          : "border-slate-200 bg-white",
                    )}
                    onClick={() => setRequestType("service")}
                  >
                    <div className="text-sm font-semibold">Servico</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Para atendimento, projeto ou solucao personalizada.
                    </div>
                  </button>
                  <button
                    type="button"
                    className={cls(
                      "rounded-[24px] border px-4 py-4 text-left",
                      requestType === "product"
                        ? isDark
                          ? "border-sky-300/40 bg-sky-400/10"
                          : "border-sky-200 bg-sky-50"
                        : isDark
                          ? "border-white/10 bg-white/5"
                          : "border-slate-200 bg-white",
                    )}
                    onClick={() => setRequestType("product")}
                  >
                    <div className="text-sm font-semibold">Produto</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Para pedir itens do catalogo ou um orcamento de compra.
                    </div>
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Nome
                    </label>
                    <Input
                      value={form.customerName}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          customerName: event.target.value,
                        }))
                      }
                      placeholder="Seu nome"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      WhatsApp
                    </label>
                    <Input
                      value={form.customerWhatsApp}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          customerWhatsApp: event.target.value,
                        }))
                      }
                      placeholder="11999999999"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    E-mail (opcional)
                  </label>
                  <Input
                    value={form.customerEmail}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        customerEmail: event.target.value,
                      }))
                    }
                    placeholder="voce@exemplo.com"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Detalhes do pedido
                  </label>
                  <Textarea
                    className="min-h-[160px]"
                    value={form.message}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        message: event.target.value,
                      }))
                    }
                    placeholder="Conte mais sobre o que voce precisa, quantidades, prazo ou qualquer detalhe importante."
                  />
                </div>

                <Button type="submit" disabled={submitting}>
                  {submitting ? "Enviando..." : "Enviar solicitacao"}
                </Button>
              </form>
            </SurfaceCard>

            <SurfaceCard className="lg:sticky lg:top-6">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Produtos selecionados
              </div>

              <div className="mt-4 space-y-3">
                {selectedProducts.length ? (
                  selectedProducts.map((product) => (
                    <div
                      key={product._id || product.productId}
                      className={cls(
                        "rounded-[22px] border px-4 py-4",
                        isDark
                          ? "border-white/10 bg-white/5"
                          : "border-slate-200 bg-white",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">
                            {product.name}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {product.productId}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => toggleProduct(product)}
                        >
                          Remover
                        </Button>
                      </div>
                      <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                        {fmtBRL(product.priceCents)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div
                    className={cls(
                      "rounded-[22px] border px-4 py-6 text-sm",
                      isDark
                        ? "border-white/10 bg-white/5 text-slate-300"
                        : "border-slate-200 bg-white text-slate-600",
                    )}
                  >
                    {requestType === "product"
                      ? "Selecione itens abaixo para montar o pedido de orcamento."
                      : "Se preferir, voce pode escolher produtos do catalogo e enviar junto com a sua solicitacao."}
                  </div>
                )}
              </div>

              <div className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Catalogo
              </div>
              <div className="mt-4 space-y-3">
                {products.length ? (
                  products.map((product) => {
                    const active = selectedIds.includes(
                      product._id || product.productId,
                    );
                    return (
                      <button
                        key={product._id || product.productId}
                        type="button"
                        onClick={() => toggleProduct(product)}
                        className={cls(
                          "w-full rounded-[22px] border px-4 py-4 text-left transition",
                          active
                            ? isDark
                              ? "border-sky-300/40 bg-sky-400/10"
                              : "border-sky-200 bg-sky-50"
                            : isDark
                              ? "border-white/10 bg-white/5"
                              : "border-slate-200 bg-white",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold">
                              {product.name}
                            </div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {product.productId || "Produto"}
                            </div>
                          </div>
                          <div className="text-sm font-semibold">
                            {fmtBRL(product.priceCents)}
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div
                    className={cls(
                      "rounded-[22px] border px-4 py-6 text-sm",
                      isDark
                        ? "border-white/10 bg-white/5 text-slate-300"
                        : "border-slate-200 bg-white text-slate-600",
                    )}
                  >
                    Nenhum produto cadastrado por enquanto.
                  </div>
                )}
              </div>

              <div className="mt-4">
                <Link to={`/u/${slug}/catalog`}>
                  <Button type="button" variant="secondary">
                    <ShoppingBag className="h-4 w-4" />
                    Ver catalogo completo
                  </Button>
                </Link>
              </div>
            </SurfaceCard>
          </div>
        )}
      </div>
    </div>
  );
}
