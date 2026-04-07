import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { MessageCircle, Search, ShoppingBag } from "lucide-react";
import {
  getPublicMyPageCatalog,
} from "../app/myPageApi.js";
import useThemeToggle from "../app/useThemeToggle.js";
import brand from "../assets/brand.png";
import Button from "../components/appui/Button.jsx";
import { Input } from "../components/appui/Input.jsx";

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

export default function PublicMyPageCatalog() {
  const { slug } = useParams();
  const { isDark } = useThemeToggle();
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
    <div
      className={cls(
        "min-h-screen px-4 py-6 sm:px-6 lg:px-8",
        isDark
          ? "bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.14),transparent_38%),linear-gradient(180deg,#020617,#0f172a_50%,#020617)] text-white"
          : "bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.1),transparent_38%),linear-gradient(180deg,#f8fafc,#eef2ff_48%,#f8fafc)] text-slate-950",
      )}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <SurfaceCard className="overflow-hidden">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <img
                src={page?.avatarUrl || brand}
                alt={page?.title || "Minha Pagina"}
                className="h-16 w-16 rounded-[22px] object-cover"
              />
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700 dark:text-sky-200">
                  Catalogo
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
                  {page?.description ||
                    "Conheca os produtos disponiveis e envie um pedido de orcamento direto por esta pagina."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
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
              <Link to={`/u/${slug}/quote`}>
                <Button type="button">
                  <ShoppingBag className="h-4 w-4" />
                  Pedir orcamento
                </Button>
              </Link>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard>
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
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome ou codigo do produto"
                className="h-12 rounded-2xl pl-11"
              />
            </div>
            <Button type="submit" className="h-12 rounded-2xl px-6">
              Buscar
            </Button>
          </form>
        </SurfaceCard>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <SurfaceCard key={index} className="h-64 animate-pulse" />
            ))}
          </div>
        ) : err ? (
          <SurfaceCard className="text-center text-sm text-red-700 dark:text-red-200">
            {err}
          </SurfaceCard>
        ) : products.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <SurfaceCard key={product._id || product.productId} className="flex h-full flex-col">
                <div
                  className={cls(
                    "mb-4 flex h-40 items-center justify-center rounded-[24px] border",
                    isDark
                      ? "border-white/10 bg-white/5"
                      : "border-slate-200 bg-slate-50",
                  )}
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full rounded-[24px] object-cover"
                    />
                  ) : (
                    <ShoppingBag className="h-10 w-10 text-slate-400" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {product.productId || "Produto"}
                  </div>
                  <div className="mt-2 text-lg font-semibold">
                    {product.name}
                  </div>
                  <div
                    className={cls(
                      "mt-2 text-sm leading-6",
                      isDark ? "text-slate-300" : "text-slate-600",
                    )}
                  >
                    {product.description || "Sem descricao cadastrada."}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <div className="text-xl font-black tracking-[-0.03em]">
                    {fmtBRL(product.priceCents)}
                  </div>
                  <Link
                    to={`/u/${slug}/quote?productId=${encodeURIComponent(product._id || product.productId)}`}
                  >
                    <Button type="button">Pedir este item</Button>
                  </Link>
                </div>
              </SurfaceCard>
            ))}
          </div>
        ) : (
          <SurfaceCard className="text-center">
            <div className="text-lg font-semibold">Nenhum produto encontrado</div>
            <div
              className={cls(
                "mt-2 text-sm",
                isDark ? "text-slate-300" : "text-slate-600",
              )}
            >
              Ajuste a busca ou fale direto no WhatsApp para pedir um orcamento.
            </div>
          </SurfaceCard>
        )}
      </div>
    </div>
  );
}
