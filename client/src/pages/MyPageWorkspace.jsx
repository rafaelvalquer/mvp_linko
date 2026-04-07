import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Eye, Globe2, LayoutPanelTop, Paintbrush2, Store } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Badge from "../components/appui/Badge.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import {
  getMyPage,
  getMyPageAnalytics,
  setMyPagePublished,
} from "../app/myPageApi.js";
import MyPageMobilePreview from "../components/my-page/MyPageMobilePreview.jsx";

const MY_PAGE_TABS = [
  {
    key: "links",
    to: "/my-page/links",
    label: "Links",
    description: "Identidade, CTAs principais e links secundários.",
    icon: LayoutPanelTop,
  },
  {
    key: "shop",
    to: "/my-page/shop",
    label: "Shop",
    description: "Escolha os produtos que entram no catálogo público.",
    icon: Store,
  },
  {
    key: "design",
    to: "/my-page/design",
    label: "Design",
    description: "Tema, fundo, tipografia e estilo visual.",
    icon: Paintbrush2,
  },
];

const PREVIEW_MODES = [
  { key: "home", label: "Página" },
  { key: "catalog", label: "Catálogo" },
  { key: "quote", label: "Orçamento" },
  { key: "schedule", label: "Agenda" },
  { key: "pay", label: "Pagamento" },
];

function TabCard({ tab }) {
  const Icon = tab.icon;
  return (
    <NavLink
      to={tab.to}
      className={({ isActive }) =>
        [
          "rounded-[24px] border px-4 py-3 transition-all",
          isActive
            ? "border-sky-300 bg-[linear-gradient(135deg,rgba(37,99,235,0.12),rgba(20,184,166,0.16))] text-slate-950 shadow-[0_20px_44px_-28px_rgba(37,99,235,0.3)] dark:border-sky-400/25 dark:bg-[linear-gradient(135deg,rgba(37,99,235,0.2),rgba(20,184,166,0.14))] dark:text-white"
            : "surface-quiet text-slate-700 hover:border-slate-300 hover:text-slate-950 dark:text-slate-200 dark:hover:border-white/15 dark:hover:text-white",
        ].join(" ")
      }
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <div className="text-sm font-bold">{tab.label}</div>
          <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {tab.description}
          </div>
        </div>
      </div>
    </NavLink>
  );
}

export default function MyPageWorkspace() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(null);
  const [previewPage, setPreviewPage] = useState(null);
  const [previewDirty, setPreviewDirty] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [err, setErr] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState("home");

  const loadPage = useCallback(async () => {
    const [pageResponse, analyticsResponse] = await Promise.all([
      getMyPage(),
      getMyPageAnalytics(),
    ]);
    setPage(pageResponse?.page || null);
    setAnalytics(analyticsResponse?.analytics || null);
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");
        await loadPage();
      } catch (error) {
        if (!active) return;
        setErr(error?.message || "Nao consegui carregar Minha Pagina.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [loadPage]);

  const publicUrl = useMemo(() => {
    if (!page?.slug || typeof window === "undefined") return "";
    return `${window.location.origin}/u/${page.slug}`;
  }, [page?.slug]);

  const effectivePreviewPage = useMemo(
    () => previewPage || page || {},
    [page, previewPage],
  );
  const isDesignRoute = location.pathname === "/my-page/design";
  const outletContext = useMemo(
    () => ({
      page,
      setPage,
      previewPage,
      setPreviewPage,
      previewDirty,
      setPreviewDirty,
      analytics,
      setAnalytics,
      publicUrl,
      setErr,
      loadPage,
    }),
    [
      analytics,
      loadPage,
      page,
      previewDirty,
      previewPage,
      publicUrl,
    ],
  );

  async function handleCopy() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setErr("Nao consegui copiar o link publico.");
    }
  }

  async function handleTogglePublish(nextValue) {
    try {
      setPublishing(true);
      setErr("");
      const response = await setMyPagePublished(nextValue);
      setPage(response?.page || null);
    } catch (error) {
      setErr(error?.message || "Nao consegui atualizar a publicacao.");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="mx-auto max-w-[1380px] space-y-5">
          <Skeleton className="h-36 rounded-[28px]" />
          <Skeleton className="h-[720px] rounded-[28px]" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-[1380px] space-y-5">
        <PageHeader
          eyebrow="Link na bio"
          title="Minha Página"
          subtitle="Organize seus links, curadoria do shop e o visual completo da sua página comercial pública."
          actions={
            <>
              <Button variant="secondary" type="button" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Link copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copiar link
                  </>
                )}
              </Button>
              {publicUrl ? (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() =>
                    window.open(publicUrl, "_blank", "noopener,noreferrer")
                  }
                >
                  <Eye className="h-4 w-4" />
                  Abrir página
                </Button>
              ) : null}
            </>
          }
        />

        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100">
            {err}
          </div>
        ) : null}

        <Card variant="quiet">
          <CardBody className="space-y-3 p-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {MY_PAGE_TABS.map((tab) => (
                <TabCard key={tab.key} tab={tab} />
              ))}
            </div>
          </CardBody>
        </Card>

        {isDesignRoute ? (
          <Outlet context={outletContext} />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_380px]">
          <div className="space-y-5">
            <Outlet context={outletContext} />
          </div>

            <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
            <Card>
              <CardHeader
                title="Publicação"
                subtitle="Controle o link público e acompanhe o status da sua página."
                right={
                  <Badge tone={page?.isPublished ? "PAID" : "DRAFT"}>
                    {page?.isPublished ? "Publicada" : "Rascunho"}
                  </Badge>
                }
              />
              <CardBody className="space-y-4">
                <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Link público
                  </div>
                  <div className="mt-2 break-all text-sm font-medium text-slate-700 dark:text-slate-100">
                    {publicUrl || "Defina um slug em Links para gerar sua URL."}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={publishing}
                    onClick={() => handleTogglePublish(!page?.isPublished)}
                  >
                    {page?.isPublished ? "Despublicar" : "Publicar página"}
                  </Button>
                  {publicUrl ? (
                    <Button type="button" variant="secondary" onClick={handleCopy}>
                      <Globe2 className="h-4 w-4" />
                      Copiar URL
                    </Button>
                  ) : null}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Prévia mobile"
                subtitle={
                  previewDirty
                    ? "Mudancas do Design aparecem aqui antes de salvar."
                    : "Alterne entre os fluxos e veja como a página vai aparecer."
                }
                right={
                  previewDirty ? (
                    <Badge tone="DRAFT">Alteracoes nao salvas</Badge>
                  ) : null
                }
              />
              <CardBody className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {PREVIEW_MODES.map((mode) => (
                    <button
                      key={mode.key}
                      type="button"
                      onClick={() => setPreviewMode(mode.key)}
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                        previewMode === mode.key
                          ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-300/40 dark:bg-sky-400/10 dark:text-sky-100"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
                      ].join(" ")}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                <MyPageMobilePreview
                  page={effectivePreviewPage}
                  mode={previewMode}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Métricas básicas"
                subtitle="Acompanhe cliques e botões mais acessados."
              />
              <CardBody className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Total de cliques
                    </div>
                    <div className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                      {analytics?.totalClicks || 0}
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Últimos 7 dias
                    </div>
                    <div className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                      {analytics?.clicksLast7d || 0}
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Shop selecionado
                    </div>
                    <div className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                      {page?.summary?.selectedProductsCount || 0}
                    </div>
                  </div>
                </div>

                {(analytics?.topButtons || []).length ? (
                  <div className="space-y-2">
                    {analytics.topButtons.map((item) => (
                      <div
                        key={`${item.buttonId}:${item.label}`}
                        className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5"
                      >
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {item.label || "Botão"}
                        </span>
                        <Badge tone="PUBLIC">{item.count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="Sem cliques ainda"
                    description="As métricas aparecem aqui assim que sua página começar a receber acessos."
                  />
                )}
              </CardBody>
            </Card>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
