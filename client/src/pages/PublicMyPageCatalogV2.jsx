import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { MessageCircle, Search, ShoppingBag } from "lucide-react";
import { getPublicMyPageCatalog } from "../app/myPageApi.js";
import { imageSrc } from "../app/productsApi.js";
import { Input } from "../components/appui/Input.jsx";
import {
  cls,
  getPublicButtonProps,
  MyPagePublicCard,
  MyPagePublicFooter,
  MyPagePublicHero,
  MyPagePublicScreen,
} from "../components/my-page/MyPagePublicUi.jsx";

function fmtBRL(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents || 0) || 0) / 100);
}

export default function PublicMyPageCatalogV2() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [search, setSearch] = useState(query);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(null);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let active = true;
    const q = searchParams.get("q") || "";

    (async () => {
      try {
        setLoading(true);
        setErr("");
        const response = await getPublicMyPageCatalog(slug, q);
        if (!active) return;
        setSearch(q);
        setPage(response?.page || null);
        setProducts(Array.isArray(response?.products) ? response.products : []);
      } catch (error) {
        if (!active) return;
        setErr(error?.message || "Nao consegui abrir o catalogo.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [slug, query]);

  const whatsappButton = (page?.buttons || []).find(
    (button) => button.type === "whatsapp",
  );

  return (
    <MyPagePublicScreen page={page}>
      {(theme) => (
        <>
          <MyPagePublicCard theme={theme}>
            <MyPagePublicHero
              page={page}
              theme={theme}
              eyebrow="Catalogo"
              description={
                page?.description || "Veja os itens disponiveis e siga para o orcamento."
              }
              actions={
                <>
                  {whatsappButton?.targetUrl ? (
                    <button
                      type="button"
                      {...getPublicButtonProps(theme, "secondary")}
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
                    </button>
                  ) : null}
                  <Link
                    to={`/u/${slug}/quote`}
                    {...getPublicButtonProps(theme, "primary")}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Pedir orcamento
                  </Link>
                </>
              }
            />
          </MyPagePublicCard>

          <MyPagePublicCard theme={theme} variant="soft">
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                const next = new URLSearchParams(searchParams);
                if (search.trim()) next.set("q", search.trim());
                else next.delete("q");
                setSearchParams(next);
              }}
            >
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={theme.mutedTextStyle}
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome ou codigo do produto"
                  className="h-12 pl-11"
                  style={theme.inputStyle}
                />
              </div>
              <button
                type="submit"
                {...getPublicButtonProps(theme, "primary", "h-12 px-6")}
              >
                Buscar
              </button>
            </form>
          </MyPagePublicCard>

          {loading ? (
            <div className={theme?.layout?.catalogGridClassName}>
              {Array.from({ length: 6 }).map((_, index) => (
                <MyPagePublicCard
                  key={index}
                  theme={theme}
                  className={cls(theme?.layout?.catalogCardClassName, "h-64 animate-pulse")}
                />
              ))}
            </div>
          ) : err ? (
            <MyPagePublicCard theme={theme} className="text-center text-sm text-red-700">
              {err}
            </MyPagePublicCard>
          ) : products.length ? (
            <div className={theme?.layout?.catalogGridClassName}>
              {products.map((product) => (
                <MyPagePublicCard
                  key={product._id || product.productId}
                  theme={theme}
                  className={theme?.layout?.catalogCardClassName}
                >
                  <div
                    className={theme?.layout?.catalogImageWrapClassName}
                    style={theme.softSurfaceStyle}
                  >
                    {product.imageUrl ? (
                      <img
                        src={imageSrc(product.imageUrl)}
                        alt={product.name}
                        className={theme?.layout?.catalogImageClassName}
                      />
                    ) : (
                      <ShoppingBag className="h-10 w-10" style={theme.mutedTextStyle} />
                    )}
                  </div>

                  <div className="flex-1">
                    <div
                      className="text-[11px] font-bold uppercase tracking-[0.18em]"
                      style={theme.mutedTextStyle}
                    >
                      {product.productId || "Produto"}
                    </div>
                    <div className="mt-2 text-lg font-semibold">{product.name}</div>
                    <div className="mt-2 text-sm leading-6" style={theme.mutedTextStyle}>
                      {product.description || "Disponivel no seu shop."}
                    </div>
                  </div>

                  <div className={theme?.layout?.catalogActionsClassName}>
                    <div className="text-xl font-black tracking-[-0.03em]">
                      {fmtBRL(product.priceCents)}
                    </div>
                    <Link
                      to={`/u/${slug}/quote?productId=${encodeURIComponent(product._id || product.productId)}`}
                      {...getPublicButtonProps(theme, "primary")}
                    >
                      Orcamento
                    </Link>
                  </div>
                </MyPagePublicCard>
              ))}
            </div>
          ) : (
            <MyPagePublicCard theme={theme} className="text-center">
              <div className="text-lg font-semibold">
                {query ? "Nenhum produto encontrado" : "Catalogo ainda vazio"}
              </div>
              <div className="mt-2 text-sm" style={theme.mutedTextStyle}>
                {query
                  ? "Ajuste a busca ou siga pelo WhatsApp."
                  : "Nenhum item selecionado para o shop ainda."}
              </div>
            </MyPagePublicCard>
          )}

          <MyPagePublicFooter theme={theme} />
        </>
      )}
    </MyPagePublicScreen>
  );
}
