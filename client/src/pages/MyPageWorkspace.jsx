import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Globe2,
  LayoutPanelTop,
  Paintbrush2,
  QrCode,
  Share2,
  Store,
  X,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Badge from "../components/appui/Badge.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import ModalShell from "../components/appui/ModalShell.jsx";
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
    description: "Identidade, CTAs principais e links secundarios.",
    icon: LayoutPanelTop,
  },
  {
    key: "shop",
    to: "/my-page/shop",
    label: "Shop",
    description: "Escolha os produtos que entram no catalogo publico.",
    icon: Store,
  },
  {
    key: "design",
    to: "/my-page/design",
    label: "Design",
    description: "Tema, cor, fundo, fonte e botoes.",
    icon: Paintbrush2,
  },
];

const PREVIEW_MODES = [
  { key: "home", label: "Pagina" },
  { key: "catalog", label: "Catalogo" },
  { key: "quote", label: "Orcamento" },
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

function displayPublicUrl(value) {
  return String(value || "").replace(/^https?:\/\//i, "");
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
  const [shareModalOpen, setShareModalOpen] = useState(false);
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

  const publicUrlLabel = useMemo(
    () => displayPublicUrl(publicUrl),
    [publicUrl],
  );

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
          title="Minha Pagina"
          subtitle="Organize seus links, curadoria do shop e o visual completo da sua pagina comercial publica."
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
                <CardBody className="p-5">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={!publicUrl}
                      onClick={() => setShareModalOpen(true)}
                      className={[
                        "flex min-w-0 flex-1 items-center gap-3 rounded-full border px-4 py-3 text-left transition",
                        publicUrl
                          ? "border-slate-200/90 bg-white/90 text-slate-700 hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:border-white/20"
                          : "cursor-not-allowed border-slate-200/70 bg-slate-50 text-slate-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-500",
                      ].join(" ")}
                    >
                      <Globe2 className="h-4 w-4 shrink-0" />
                      <span className="truncate text-sm font-semibold">
                        {publicUrlLabel || "Defina um slug em Links"}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={!publicUrl}
                      onClick={() => setShareModalOpen(true)}
                      className={[
                        "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition",
                        publicUrl
                          ? "border-slate-200/90 bg-white/90 text-slate-700 hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:border-white/20"
                          : "cursor-not-allowed border-slate-200/70 bg-slate-50 text-slate-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-500",
                      ].join(" ")}
                      aria-label="Compartilhar pagina"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Previa mobile"
                  subtitle={
                    previewDirty
                      ? "Mudancas do Design aparecem aqui antes de salvar."
                      : "Alterne entre os fluxos e veja como a pagina vai aparecer."
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
                  title="Metricas basicas"
                  subtitle="Acompanhe cliques e botoes mais acessados."
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
                        Ultimos 7 dias
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
                            {item.label || "Botao"}
                          </span>
                          <Badge tone="PUBLIC">{item.count}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="Sem cliques ainda"
                      description="As metricas aparecem aqui assim que sua pagina comecar a receber acessos."
                    />
                  )}
                </CardBody>
              </Card>
            </div>
          </div>
        )}
      </div>

      <ModalShell
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        panelClassName="max-w-xl"
      >
        <div className="surface-elevated overflow-hidden rounded-[32px] border border-slate-200/80 p-5 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)] dark:border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xl font-black text-slate-950 dark:text-white">
                Compartilhar
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Copie o link, mostre o QR code e controle a publicacao.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShareModalOpen(false)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-500 transition hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-[28px] border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-100">
                    <Globe2 className="h-4 w-4 shrink-0" />
                    <span className="truncate text-sm font-semibold">
                      {publicUrlLabel || "Defina um slug em Links"}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {page?.isPublished
                      ? "Link pronto para compartilhar."
                      : "Publique para liberar o acesso publico."}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleCopy}
                  disabled={!publicUrl}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200/80 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                <QrCode className="h-4 w-4" />
                QR code
              </div>

              <div className="mt-4 flex justify-center">
                {publicUrl ? (
                  <div className="rounded-[28px] bg-white p-4 shadow-[0_18px_42px_-28px_rgba(15,23,42,0.25)]">
                    <QRCodeCanvas value={publicUrl} size={180} includeMargin />
                  </div>
                ) : (
                  <div className="flex h-[212px] w-[212px] items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-500">
                    Defina um slug
                  </div>
                )}
              </div>

              <div className="mt-4 text-center">
                <div className="text-base font-bold text-slate-900 dark:text-white">
                  {page?.isPublished
                    ? "Escaneie para abrir a pagina"
                    : "Publique para compartilhar"}
                </div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {page?.isPublished
                    ? "Seu cliente pode acessar a pagina apontando a camera do celular."
                    : "O QR code ja esta pronto, mas o acesso publico so libera depois da publicacao."}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-slate-200/80 pt-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {page?.isPublished
                ? "Sua pagina esta publicada e pronta para receber acessos."
                : "Sua pagina continua em rascunho ate voce publicar."}
            </div>
            <Button
              type="button"
              variant={page?.isPublished ? "danger" : "primary"}
              disabled={publishing}
              onClick={() => handleTogglePublish(!page?.isPublished)}
            >
              {page?.isPublished ? "Despublicar" : "Publicar pagina"}
            </Button>
          </div>
        </div>
      </ModalShell>
    </Shell>
  );
}
