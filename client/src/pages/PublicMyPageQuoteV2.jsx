import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, ShoppingBag } from "lucide-react";
import {
  getPublicMyPageQuoteContext,
  submitPublicMyPageQuoteRequest,
} from "../app/myPageApi.js";
import {
  buildMyPageConversionContext,
  trackMyPageEvent,
} from "../app/myPagePublicAnalytics.js";
import { Input, Textarea } from "../components/appui/Input.jsx";
import {
  cls,
  getPublicButtonProps,
  getPublicSelectableCardProps,
  MyPagePublicCard,
  MyPagePublicFooter,
  MyPagePublicHero,
  MyPagePublicScreen,
  MyPageWhatsAppIcon,
} from "../components/my-page/MyPagePublicUi.jsx";

function fmtBRL(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents || 0) || 0) / 100);
}

export default function PublicMyPageQuoteV2() {
  const { slug } = useParams();
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
  const trackedQuoteRef = useRef("");
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

  useEffect(() => {
    if (!page?._id) return;
    const trackKey = `${slug}:${page._id}:${productIdsKey}`;
    if (trackedQuoteRef.current === trackKey) return;
    trackedQuoteRef.current = trackKey;

    void trackMyPageEvent(slug, {
      eventType: "page_view",
      pageKind: "quote",
    });
    void trackMyPageEvent(slug, {
      eventType: "quote_form_view",
      pageKind: "quote",
      blockKey: "quote_form",
    });
    void trackMyPageEvent(slug, {
      eventType: "block_view",
      pageKind: "quote",
      blockKey: "quote_form",
    });
  }, [page?._id, productIdsKey, slug]);

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
    void trackMyPageEvent(slug, {
      eventType: "catalog_item_open",
      pageKind: "quote",
      blockKey: "quote_form",
      contentKind: "product",
      contentId: key,
      contentLabel: product?.name || "Produto",
      buttonKey: `quote_product_${key}`,
      buttonLabel: product?.name || "Produto",
      buttonType: "product",
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setSubmitting(true);
      setErr("");
      void trackMyPageEvent(slug, {
        eventType: "cta_click",
        pageKind: "quote",
        blockKey: "quote_form",
        buttonKey: "quote_submit",
        buttonLabel: "Enviar pedido",
        buttonType: "public_offer",
        contentKind: requestType,
        contentLabel:
          requestType === "product"
            ? selectedProducts.length === 1
              ? selectedProducts[0]?.name || "Produto selecionado"
              : selectedProducts.length > 1
                ? "Produtos selecionados"
                : "Pedido de produto"
            : page?.title || "Pedido de servico",
      });
      const analyticsContext = buildMyPageConversionContext(slug, "quote", {
        blockKey: "quote_form",
        contentKind: requestType,
        contentLabel:
          requestType === "product"
            ? selectedProducts.length === 1
              ? selectedProducts[0]?.name || "Produto selecionado"
              : selectedProducts.length > 1
                ? "Produtos selecionados"
                : "Pedido de produto"
            : page?.title || "Pedido de servico",
      });
      const response = await submitPublicMyPageQuoteRequest(slug, {
        ...form,
        requestType,
        selectedProductIds: selectedIds,
        analyticsContext,
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

  function handleWhatsAppClick(targetUrl = "", label = "Falar no WhatsApp") {
    if (!targetUrl) return;
    void trackMyPageEvent(slug, {
      eventType: "cta_click",
      pageKind: success ? "quote" : "quote",
      blockKey: "quote_form",
      buttonKey: "quote_whatsapp",
      buttonLabel: label,
      buttonType: "whatsapp",
      contentKind: "button",
      contentId: "quote_whatsapp",
      contentLabel: label,
    });
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }

  if (success) {
    return (
      <MyPagePublicScreen page={page} maxWidth="max-w-2xl">
        {(theme) => (
          <>
            <MyPagePublicCard theme={theme} className="text-center">
              <div
                className={cls(
                  "mx-auto flex h-16 w-16 items-center justify-center",
                  theme.buttonIconRadiusClassName,
                )}
                style={theme.activeCardStyle}
              >
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div
                className="mt-5 text-2xl font-black tracking-[-0.04em]"
                style={theme.titleStyle}
              >
                Pedido enviado com sucesso
              </div>
              <div className="mt-3 text-sm leading-7" style={theme.mutedTextStyle}>
                Sua solicitacao foi registrada. A equipe vai retornar com a proposta.
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link to={`/u/${slug}`} {...getPublicButtonProps(theme, "secondary")}>
                  Voltar para a pagina
                </Link>
                {success.whatsappUrl ? (
                  <button
                    type="button"
                    {...getPublicButtonProps(theme, "primary")}
                    onClick={() => handleWhatsAppClick(success.whatsappUrl)}
                  >
                    <MyPageWhatsAppIcon className="h-4 w-4" />
                    Falar no WhatsApp
                  </button>
                ) : null}
              </div>
            </MyPagePublicCard>
            <MyPagePublicFooter theme={theme} />
          </>
        )}
      </MyPagePublicScreen>
    );
  }

  return (
    <MyPagePublicScreen page={page}>
      {(theme) => (
        <>
          <MyPagePublicCard theme={theme}>
            <MyPagePublicHero
              page={page}
              theme={theme}
              eyebrow="Pedir orcamento"
              description="Preencha seus dados e siga com o pedido."
              actions={
                whatsappButton?.targetUrl ? (
                  <button
                    type="button"
                    {...getPublicButtonProps(theme, "secondary")}
                    onClick={() => handleWhatsAppClick(whatsappButton.targetUrl)}
                  >
                    <MyPageWhatsAppIcon className="h-4 w-4" />
                    Falar no WhatsApp
                  </button>
                ) : null
              }
            />
          </MyPagePublicCard>

          {loading ? (
            <MyPagePublicCard theme={theme} className="h-72 animate-pulse" />
          ) : err ? (
            <MyPagePublicCard theme={theme} className="text-center text-sm text-red-700">
              {err}
            </MyPagePublicCard>
          ) : (
            <div className={theme?.layout?.formLayoutClassName}>
              <MyPagePublicCard
                theme={theme}
                className={theme?.layout?.formCardClassName}
              >
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      {...getPublicSelectableCardProps(
                        theme,
                        requestType === "service",
                        "px-4 py-4",
                      )}
                      onClick={() => setRequestType("service")}
                    >
                      <div className="text-sm font-semibold" style={theme.headingStyle}>
                        Servico
                      </div>
                      <div className="mt-1 text-xs leading-5" style={theme.mutedTextStyle}>
                        Projeto ou atendimento.
                      </div>
                    </button>
                    <button
                      type="button"
                      {...getPublicSelectableCardProps(
                        theme,
                        requestType === "product",
                        "px-4 py-4",
                      )}
                      onClick={() => setRequestType("product")}
                    >
                      <div className="text-sm font-semibold" style={theme.headingStyle}>
                        Produto
                      </div>
                      <div className="mt-1 text-xs leading-5" style={theme.mutedTextStyle}>
                        Itens do catalogo.
                      </div>
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold" style={theme.mutedTextStyle}>
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
                        style={theme.inputStyle}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold" style={theme.mutedTextStyle}>
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
                        style={theme.inputStyle}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold" style={theme.mutedTextStyle}>
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
                      style={theme.inputStyle}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold" style={theme.mutedTextStyle}>
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
                      placeholder="Conte o que voce precisa."
                      style={theme.inputStyle}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    {...getPublicButtonProps(theme, "primary")}
                    >
                      {submitting ? "Enviando..." : "Enviar pedido"}
                    </button>
                </form>
              </MyPagePublicCard>

              <MyPagePublicCard
                theme={theme}
                className={theme?.layout?.summaryCardClassName}
              >
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.18em]"
                  style={theme.mutedTextStyle}
                >
                  Produtos selecionados
                </div>

                <div className="mt-4 space-y-3">
                  {selectedProducts.length ? (
                    selectedProducts.map((product) => (
                      <div
                        key={product._id || product.productId}
                        {...getPublicSelectableCardProps(theme, false, "px-4 py-4")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold" style={theme.headingStyle}>
                              {product.name}
                            </div>
                            <div className="mt-1 text-xs" style={theme.mutedTextStyle}>
                              {product.productId}
                            </div>
                          </div>
                          <button
                            type="button"
                            {...getPublicButtonProps(theme, "secondary", "px-3 py-2 text-xs")}
                            onClick={() => toggleProduct(product)}
                          >
                            Remover
                          </button>
                        </div>
                        <div className="mt-3 text-sm font-semibold" style={theme.headingStyle}>
                          {fmtBRL(product.priceCents)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div
                      {...getPublicSelectableCardProps(theme, false, "px-4 py-6 text-sm")}
                    >
                      {requestType === "product"
                        ? "Selecione itens abaixo."
                        : "Voce pode incluir produtos do catalogo."}
                    </div>
                  )}
                </div>

                <div
                  className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em]"
                  style={theme.mutedTextStyle}
                >
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
                          {...getPublicSelectableCardProps(
                            theme,
                            active,
                            "w-full px-4 py-4",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold" style={theme.headingStyle}>
                                {product.name}
                              </div>
                              <div className="mt-1 text-xs" style={theme.mutedTextStyle}>
                                {product.productId || "Produto"}
                              </div>
                            </div>
                            <div className="text-sm font-semibold" style={theme.headingStyle}>
                              {fmtBRL(product.priceCents)}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div
                      {...getPublicSelectableCardProps(theme, false, "px-4 py-6 text-sm")}
                    >
                      Nenhum item disponivel no shop.
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <Link
                    to={`/u/${slug}/catalog`}
                    {...getPublicButtonProps(theme, "secondary")}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Ver catalogo completo
                  </Link>
                </div>
              </MyPagePublicCard>
            </div>
          )}

          <MyPagePublicFooter theme={theme} />
        </>
      )}
    </MyPagePublicScreen>
  );
}
