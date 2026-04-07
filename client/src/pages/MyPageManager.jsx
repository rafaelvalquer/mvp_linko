import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  MessageCircle,
  Plus,
  Trash2,
} from "lucide-react";
import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Badge from "../components/appui/Badge.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import { Input, Textarea } from "../components/appui/Input.jsx";
import {
  getMyPage,
  getMyPageAnalytics,
  getMyPageQuoteRequests,
  saveMyPage,
  setMyPagePublished,
} from "../app/myPageApi.js";
import {
  buildQuoteRequestsSummary,
  formatQuoteRequestDateTime,
  quoteRequestStatusBadge,
} from "../components/my-page/quoteRequestHelpers.js";

const BUTTON_TYPE_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "public_offer", label: "Pedir orçamento" },
  { value: "public_schedule", label: "Agendar atendimento" },
  { value: "catalog", label: "Ver catálogo" },
  { value: "payment_link", label: "Pagar proposta" },
  { value: "external_url", label: "Link externo" },
];

const SOCIAL_PLATFORM_OPTIONS = [
  "Instagram",
  "Facebook",
  "TikTok",
  "YouTube",
  "Site",
];

function buttonLabelForType(type) {
  return (
    BUTTON_TYPE_OPTIONS.find((item) => item.value === type)?.label || "Link"
  );
}

function normalizeUrl(url = "") {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(value)) return value;
  return `https://${value}`;
}

function isNativeButtonType(type) {
  return (
    type === "public_offer" ||
    type === "public_schedule" ||
    type === "catalog" ||
    type === "payment_link"
  );
}

function buildNativePreviewTarget(page, type) {
  const slug = String(page?.slug || "").trim();
  if (!slug) return "";
  if (type === "public_offer") return `/u/${slug}/quote`;
  if (type === "public_schedule") return `/u/${slug}/schedule`;
  if (type === "catalog") return `/u/${slug}/catalog`;
  if (type === "payment_link") return `/u/${slug}/pay`;
  return "";
}

function resolvePreviewTarget(page, button) {
  if (!button?.enabled) return "";
  if (button.type === "whatsapp") {
    const digits = String(page?.whatsappPhone || "").replace(/\D+/g, "");
    if (!digits) return "";
    const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
    const text = encodeURIComponent(
      `Olá! Vim pela sua página da LuminorPay e quero falar com você.`,
    );
    return `https://wa.me/${withCountry}?text=${text}`;
  }
  if (isNativeButtonType(button.type)) {
    return buildNativePreviewTarget(page, button.type);
  }
  return normalizeUrl(button?.url);
}

function MobilePreview({ page }) {
  const buttons = (page?.buttons || [])
    .filter((button) => button.enabled && resolvePreviewTarget(page, button))
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const socialLinks = (page?.socialLinks || [])
    .filter((item) => item.enabled && item.url)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  return (
    <div className="mx-auto w-full max-w-[340px] rounded-[36px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff,#ecf7ff)] p-3 shadow-[0_26px_70px_-40px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(8,15,30,0.96),rgba(8,15,30,0.88))] dark:shadow-[0_26px_70px_-40px_rgba(2,6,23,0.8)]">
      <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(240,249,255,0.82))] p-5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(15,23,42,0.76))]">
        <div className="flex flex-col items-center text-center">
          {page?.avatarUrl ? (
            <img
              src={page.avatarUrl}
              alt={page.title || "Minha Página"}
              className="h-20 w-20 rounded-[26px] object-cover shadow-[0_18px_40px_-26px_rgba(37,99,235,0.55)]"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white shadow-[0_18px_40px_-26px_rgba(37,99,235,0.55)]">
              <Link2 className="h-8 w-8" />
            </div>
          )}
          <div className="mt-4 text-xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">
            {page?.title || "Minha Página"}
          </div>
          {page?.subtitle ? (
            <div className="mt-2 text-sm font-semibold text-sky-700 dark:text-sky-200">
              {page.subtitle}
            </div>
          ) : null}
          {page?.description ? (
            <div className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {page.description}
            </div>
          ) : null}
        </div>

        <div className="mt-6 space-y-3">
          {buttons.length ? (
            buttons.map((button) => (
              <div
                key={button.id}
                className="flex items-center justify-between rounded-[24px] border border-slate-200/80 bg-white px-4 py-4 text-left text-sm font-semibold text-slate-900 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                <span>{button.label}</span>
                <ExternalLink className="h-4 w-4 text-slate-400 dark:text-slate-300" />
              </div>
            ))
          ) : (
            <EmptyState
              title="Nenhum botão ativo"
              description="Ative pelo menos um CTA para visualizar a página pública."
            />
          )}
        </div>

        {socialLinks.length ? (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {socialLinks.map((item) => (
              <span
                key={item.id}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              >
                {item.label || item.platform}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function MyPageManager() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [quoteRequests, setQuoteRequests] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        const [pageResponse, analyticsResponse, requestsResponse] =
          await Promise.all([
          getMyPage(),
          getMyPageAnalytics(),
          getMyPageQuoteRequests(),
        ]);
        if (!active) return;
        setPage(pageResponse?.page || null);
        setAnalytics(analyticsResponse?.analytics || null);
        setQuoteRequests(Array.isArray(requestsResponse?.items) ? requestsResponse.items : []);
      } catch (error) {
        if (!active) return;
        setErr(error?.message || "Nao consegui carregar sua pagina.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const publicUrl = useMemo(() => {
    if (!page?.slug || typeof window === "undefined") return "";
    return `${window.location.origin}/u/${page.slug}`;
  }, [page?.slug]);

  const quoteRequestsSummary = useMemo(
    () => buildQuoteRequestsSummary(quoteRequests),
    [quoteRequests],
  );

  const latestQuoteRequests = useMemo(
    () => (Array.isArray(quoteRequests) ? quoteRequests.slice(0, 3) : []),
    [quoteRequests],
  );

  function updateField(key, value) {
    setPage((prev) => ({ ...(prev || {}), [key]: value }));
  }

  function updateButton(id, patch) {
    setPage((prev) => ({
      ...(prev || {}),
      buttons: (prev?.buttons || []).map((button) =>
        button.id === id ? { ...button, ...patch } : button,
      ),
    }));
  }

  function moveButton(id, direction) {
    setPage((prev) => {
      const list = [...(prev?.buttons || [])].sort(
        (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
      );
      const index = list.findIndex((item) => item.id === id);
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= list.length) return prev;
      const [item] = list.splice(index, 1);
      list.splice(nextIndex, 0, item);
      return {
        ...(prev || {}),
        buttons: list.map((button, idx) => ({ ...button, sortOrder: idx })),
      };
    });
  }

  function addButton() {
    setPage((prev) => ({
      ...(prev || {}),
      buttons: [
        ...(prev?.buttons || []),
        {
          id: crypto.randomUUID(),
          label: "Novo link",
          type: "external_url",
          url: "",
          enabled: false,
          sortOrder: (prev?.buttons || []).length,
        },
      ],
    }));
  }

  function removeButton(id) {
    setPage((prev) => ({
      ...(prev || {}),
      buttons: (prev?.buttons || [])
        .filter((button) => button.id !== id)
        .map((button, index) => ({ ...button, sortOrder: index })),
    }));
  }

  function updateSocial(id, patch) {
    setPage((prev) => ({
      ...(prev || {}),
      socialLinks: (prev?.socialLinks || []).map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  }

  function addSocial() {
    setPage((prev) => ({
      ...(prev || {}),
      socialLinks: [
        ...(prev?.socialLinks || []),
        {
          id: crypto.randomUUID(),
          platform: "Instagram",
          label: "Instagram",
          url: "",
          enabled: true,
          sortOrder: (prev?.socialLinks || []).length,
        },
      ],
    }));
  }

  function removeSocial(id) {
    setPage((prev) => ({
      ...(prev || {}),
      socialLinks: (prev?.socialLinks || [])
        .filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, sortOrder: index })),
    }));
  }

  async function handleSave() {
    try {
      setSaving(true);
      setErr("");
      const response = await saveMyPage(page || {});
      setPage(response?.page || null);
    } catch (error) {
      setErr(error?.message || "Nao consegui salvar sua pagina.");
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <Shell>
        <div className="mx-auto max-w-[1380px] space-y-5">
          <Skeleton className="h-36 rounded-[28px]" />
          <Skeleton className="h-[640px] rounded-[28px]" />
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
          subtitle="Monte sua página comercial pública para concentrar WhatsApp, agenda, pagamentos e seus principais links."
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
                  onClick={() => window.open(publicUrl, "_blank", "noopener,noreferrer")}
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

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_380px]">
          <div className="space-y-5">
            <Card>
              <CardHeader
                title="Identidade da página"
                subtitle="Defina os dados básicos que aparecem no topo da sua página pública."
                right={
                  <Badge tone={page?.isPublished ? "PAID" : "DRAFT"}>
                    {page?.isPublished ? "Publicada" : "Rascunho"}
                  </Badge>
                }
              />
              <CardBody className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Slug público
                  </label>
                  <Input
                    value={page?.slug || ""}
                    onChange={(e) => updateField("slug", e.target.value)}
                    placeholder="minha-marca"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    WhatsApp principal
                  </label>
                  <Input
                    value={page?.whatsappPhone || ""}
                    onChange={(e) =>
                      updateField("whatsappPhone", e.target.value)
                    }
                    placeholder="11999999999"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Título
                  </label>
                  <Input
                    value={page?.title || ""}
                    onChange={(e) => updateField("title", e.target.value)}
                    placeholder="Nome do negócio"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Subtítulo
                  </label>
                  <Input
                    value={page?.subtitle || ""}
                    onChange={(e) => updateField("subtitle", e.target.value)}
                    placeholder="Seu negócio em uma frase curta"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Descrição
                  </label>
                  <Textarea
                    className="min-h-[120px]"
                    value={page?.description || ""}
                    onChange={(e) => updateField("description", e.target.value)}
                    placeholder="Explique rapidamente o que a pessoa encontra na sua página."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    URL da logo/foto
                  </label>
                  <Input
                    value={page?.avatarUrl || ""}
                    onChange={(e) => updateField("avatarUrl", e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Botões principais"
                subtitle="Ative e ordene os caminhos mais importantes da sua operação."
                right={
                  <Button type="button" variant="secondary" onClick={addButton}>
                    <Plus className="h-4 w-4" />
                    Adicionar botão
                  </Button>
                }
              />
              <CardBody className="space-y-3">
                {(page?.buttons || []).map((button, index, list) => (
                  <div
                    key={button.id}
                    className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Rótulo
                        </label>
                        <Input
                          value={button.label}
                          onChange={(e) =>
                            updateButton(button.id, { label: e.target.value })
                          }
                          placeholder={buttonLabelForType(button.type)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Tipo
                        </label>
                        <select
                          className="app-field w-full"
                          value={button.type}
                          onChange={(e) =>
                            updateButton(button.id, {
                              type: e.target.value,
                              url: isNativeButtonType(e.target.value)
                                ? ""
                                : button.url || "",
                              label:
                                button.label || buttonLabelForType(e.target.value),
                            })
                          }
                        >
                          {BUTTON_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          URL de destino
                        </label>
                        <Input
                          value={button.url || ""}
                          disabled={
                            button.type === "whatsapp" ||
                            isNativeButtonType(button.type)
                          }
                          onChange={(e) =>
                            updateButton(button.id, { url: e.target.value })
                          }
                          placeholder={
                            button.type === "whatsapp"
                              ? "Usa o WhatsApp principal da página"
                              : isNativeButtonType(button.type)
                                ? "Destino nativo da LuminorPay"
                              : "https://..."
                          }
                        />
                        {isNativeButtonType(button.type) ? (
                          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            Esse botão abre um workflow nativo da LuminorPay e
                            não precisa de URL manual.
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-end gap-2">
                        <label className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-3 py-2 text-sm font-medium text-slate-700 dark:border-white/10 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={button.enabled === true}
                            onChange={(e) =>
                              updateButton(button.id, {
                                enabled: e.target.checked,
                              })
                            }
                          />
                          Ativo
                        </label>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => moveButton(button.id, "up")}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => moveButton(button.id, "down")}
                          disabled={index === list.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeButton(button.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Links secundários"
                subtitle="Adicione suas redes sociais ou links complementares."
                right={
                  <Button type="button" variant="secondary" onClick={addSocial}>
                    <Plus className="h-4 w-4" />
                    Adicionar link
                  </Button>
                }
              />
              <CardBody className="space-y-3">
                {(page?.socialLinks || []).length ? (
                  (page?.socialLinks || []).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Plataforma
                          </label>
                          <select
                            className="app-field w-full"
                            value={item.platform}
                            onChange={(e) =>
                              updateSocial(item.id, {
                                platform: e.target.value,
                                label: item.label || e.target.value,
                              })
                            }
                          >
                            {SOCIAL_PLATFORM_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Rótulo
                          </label>
                          <Input
                            value={item.label}
                            onChange={(e) =>
                              updateSocial(item.id, { label: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            URL
                          </label>
                          <Input
                            value={item.url}
                            onChange={(e) =>
                              updateSocial(item.id, { url: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={item.enabled === true}
                            onChange={(e) =>
                              updateSocial(item.id, { enabled: e.target.checked })
                            }
                          />
                          Ativo
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeSocial(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="Nenhum link secundário"
                    description="Adicione Instagram, site ou qualquer outro link complementar."
                    ctaLabel="Adicionar link"
                    onCta={addSocial}
                  />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Solicitações"
                subtitle="Acompanhe os pedidos de orçamento recebidos pela sua página."
                right={<Badge tone="PUBLIC">{quoteRequestsSummary.total}</Badge>}
              />
              <CardBody className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Total recebidas
                    </div>
                    <div className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                      {quoteRequestsSummary.total}
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Novas
                    </div>
                    <div className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-300">
                      {quoteRequestsSummary.newCount}
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Em andamento
                    </div>
                    <div className="mt-2 text-2xl font-black text-sky-700 dark:text-sky-300">
                      {quoteRequestsSummary.inProgress}
                    </div>
                  </div>
                </div>

                {latestQuoteRequests.length ? (
                  latestQuoteRequests.map((request) => {
                    const statusMeta = quoteRequestStatusBadge(request.status);

                    return (
                      <div
                        key={`preview:${request._id}`}
                        className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-white/5"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-semibold text-slate-950 dark:text-white">
                                {request.customerName || "Lead sem nome"}
                              </div>
                              <Badge tone={statusMeta.tone}>
                                {statusMeta.label}
                              </Badge>
                              <Badge
                                tone={
                                  request.requestType === "product"
                                    ? "PAID"
                                    : "PUBLIC"
                                }
                              >
                                {request.requestType === "product"
                                  ? "Produto"
                                  : "Servico"}
                              </Badge>
                            </div>

                            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                              {request.customerWhatsApp || "Sem WhatsApp"}
                              {request.customerEmail
                                ? ` • ${request.customerEmail}`
                                : ""}
                            </div>

                            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                              Recebido em{" "}
                              {formatQuoteRequestDateTime(request.createdAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState
                    title="Nenhuma solicitação ainda"
                    description="Quando alguém pedir orçamento pela sua página, as solicitações vão aparecer aqui e a operação vai acontecer em Propostas."
                  />
                )}

                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => navigate("/offers?view=requests")}
                  >
                    Abrir solicitações em Propostas
                  </Button>
                </div>

                {false && (
                  <>
                {quoteRequests.length ? (
                  quoteRequests.map((request) => {
                    const statusMeta = quoteStatusBadge(request.status);
                    const busy = requestBusyId === request._id;
                    const hasOffer = !!request?.createdOffer?._id;

                    return (
                      <div
                        key={request._id}
                        className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-white/5"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-semibold text-slate-950 dark:text-white">
                                {request.customerName || "Lead sem nome"}
                              </div>
                              <Badge tone={statusMeta.tone}>
                                {statusMeta.label}
                              </Badge>
                              <Badge
                                tone={
                                  request.requestType === "product"
                                    ? "PAID"
                                    : "PUBLIC"
                                }
                              >
                                {request.requestType === "product"
                                  ? "Produto"
                                  : "Serviço"}
                              </Badge>
                            </div>

                            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                              {request.customerWhatsApp || "Sem WhatsApp"}{" "}
                              {request.customerEmail
                                ? `• ${request.customerEmail}`
                                : ""}
                            </div>

                            {request.message ? (
                              <div className="mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-3 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                                {request.message}
                              </div>
                            ) : null}

                            {request.selectedProducts?.length ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {request.selectedProducts.map((product) => (
                                  <span
                                    key={`${request._id}:${product._id || product.productId}`}
                                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                                  >
                                    {product.name}
                                  </span>
                                ))}
                              </div>
                            ) : null}

                            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                              Recebido em {formatDateTime(request.createdAt)}
                              {request?.createdOffer?.publicCode
                                ? ` • Código ${request.createdOffer.publicCode}`
                                : ""}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 md:max-w-[280px] md:justify-end">
                            {!hasOffer ? (
                              <Button
                                type="button"
                                disabled={busy}
                                onClick={() => handleCreateOfferFromRequest(request)}
                              >
                                {busy ? "Abrindo..." : "Criar proposta"}
                              </Button>
                            ) : (
                              <>
                                {request.createdOffer?.publicToken ? (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() =>
                                      window.open(
                                        `/p/${request.createdOffer.publicToken}`,
                                        "_blank",
                                        "noopener,noreferrer",
                                      )
                                    }
                                  >
                                    Ver proposta
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => navigate("/offers")}
                                >
                                  Ir para propostas
                                </Button>
                              </>
                            )}

                            {request.status !== "in_progress" && !hasOffer ? (
                              <Button
                                type="button"
                                variant="ghost"
                                disabled={busy}
                                onClick={() =>
                                  handleQuoteRequestStatus(
                                    request._id,
                                    "in_progress",
                                  )
                                }
                              >
                                Em andamento
                              </Button>
                            ) : null}

                            {request.status !== "archived" ? (
                              <Button
                                type="button"
                                variant="ghost"
                                disabled={busy}
                                onClick={() =>
                                  handleQuoteRequestStatus(
                                    request._id,
                                    "archived",
                                  )
                                }
                              >
                                Arquivar
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                disabled={busy}
                                onClick={() =>
                                  handleQuoteRequestStatus(request._id, "new")
                                }
                              >
                                Reabrir
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState
                    title="Nenhuma solicitação ainda"
                    description="Quando alguém pedir orçamento pela sua página, as solicitações vão aparecer aqui para virar proposta."
                  />
                )}
                  </>
                )}
              </CardBody>
            </Card>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={publishing}
                onClick={() => handleTogglePublish(!page?.isPublished)}
              >
                {page?.isPublished ? "Despublicar" : "Publicar página"}
              </Button>
              <Button type="button" disabled={saving} onClick={handleSave}>
                <MessageCircle className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>

          <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
            <Card>
              <CardHeader
                title="Prévia mobile"
                subtitle="Veja como a sua página aparece no celular."
              />
              <CardBody>
                <MobilePreview page={page || {}} />
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
                      Últimos 30 dias
                    </div>
                    <div className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                      {analytics?.clicksLast30d || 0}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-950 dark:text-white">
                    Botões mais clicados
                  </div>
                  <div className="mt-3 space-y-2">
                    {(analytics?.topButtons || []).length ? (
                      analytics.topButtons.map((item) => (
                        <div
                          key={`${item.buttonId}:${item.label}`}
                          className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5"
                        >
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            {item.label || buttonLabelForType(item.type)}
                          </span>
                          <Badge tone="PUBLIC">{item.count}</Badge>
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        title="Sem cliques ainda"
                        description="As métricas aparecem aqui assim que sua página receber acessos."
                      />
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </Shell>
  );
}
