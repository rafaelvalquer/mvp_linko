import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  ImagePlus,
  Link2,
  MessageCircle,
  Plus,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { saveMyPageLinks, getMyPageQuoteRequests } from "../app/myPageApi.js";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Badge from "../components/appui/Badge.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import ModalShell from "../components/appui/ModalShell.jsx";
import { Input, Textarea } from "../components/appui/Input.jsx";
import { useMyPageContext } from "../components/my-page/useMyPageContext.js";
import { resolveMyPageMediaUrl } from "../components/my-page/myPageTheme.js";
import {
  buildQuoteRequestsSummary,
  formatQuoteRequestDateTime,
  quoteRequestStatusBadge,
} from "../components/my-page/quoteRequestHelpers.js";

const BUTTON_TYPE_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "public_offer", label: "Pedir orcamento" },
  { value: "public_schedule", label: "Agendar atendimento" },
  { value: "catalog", label: "Ver catalogo" },
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

const EMPTY_AVATAR_DRAFT = { mode: "keep", file: null, url: "" };
const EMPTY_AVATAR_EDITOR = {
  source: "upload",
  file: null,
  url: "",
  remove: false,
};
const EMPTY_IDENTITY_EDITOR = {
  slug: "",
  whatsappPhone: "",
};

function buttonLabelForType(type) {
  return (
    BUTTON_TYPE_OPTIONS.find((item) => item.value === type)?.label || "Link"
  );
}

function isNativeButtonType(type) {
  return (
    type === "public_offer" ||
    type === "public_schedule" ||
    type === "catalog" ||
    type === "payment_link"
  );
}

function buildAvatarEditorState(draft = EMPTY_AVATAR_DRAFT) {
  if (draft?.mode === "upload" && draft?.file) {
    return { source: "upload", file: draft.file, url: "", remove: false };
  }
  if (draft?.mode === "url") {
    return { source: "url", file: null, url: draft.url || "", remove: false };
  }
  if (draft?.mode === "remove") {
    return { source: "upload", file: null, url: "", remove: true };
  }
  return { ...EMPTY_AVATAR_EDITOR };
}

function useObjectUrl(file) {
  const [objectUrl, setObjectUrl] = useState("");

  useEffect(() => {
    if (typeof File === "undefined" || !(file instanceof File)) {
      setObjectUrl("");
      return undefined;
    }
    const nextUrl = URL.createObjectURL(file);
    setObjectUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  return objectUrl;
}

export default function MyPageLinksEditorPage() {
  const { page, setPage, setErr, setPreviewPage } = useMyPageContext();
  const [saving, setSaving] = useState(false);
  const [quoteRequests, setQuoteRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [avatarDraft, setAvatarDraft] = useState(EMPTY_AVATAR_DRAFT);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [avatarEditor, setAvatarEditor] = useState(EMPTY_AVATAR_EDITOR);
  const [identityModalOpen, setIdentityModalOpen] = useState(false);
  const [identityEditor, setIdentityEditor] = useState(EMPTY_IDENTITY_EDITOR);
  const [identityModalFocus, setIdentityModalFocus] = useState("slug");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setRequestsLoading(true);
        const response = await getMyPageQuoteRequests();
        if (!active) return;
        setQuoteRequests(Array.isArray(response?.items) ? response.items : []);
      } catch {
        if (!active) return;
        setQuoteRequests([]);
      } finally {
        if (active) setRequestsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const quoteRequestsSummary = useMemo(
    () => buildQuoteRequestsSummary(quoteRequests),
    [quoteRequests],
  );
  const latestQuoteRequests = useMemo(
    () => quoteRequests.slice(0, 3),
    [quoteRequests],
  );
  const avatarDraftFileUrl = useObjectUrl(
    avatarDraft.mode === "upload" ? avatarDraft.file : null,
  );
  const avatarEditorFileUrl = useObjectUrl(
    avatarEditor.source === "upload" ? avatarEditor.file : null,
  );

  const currentAvatarUrl = useMemo(() => {
    if (avatarDraft.mode === "remove") return "";
    if (avatarDraft.mode === "upload" && avatarDraftFileUrl) {
      return avatarDraftFileUrl;
    }
    if (avatarDraft.mode === "url") {
      return resolveMyPageMediaUrl(avatarDraft.url);
    }
    return resolveMyPageMediaUrl(page?.avatarUrl);
  }, [avatarDraft, avatarDraftFileUrl, page?.avatarUrl]);

  const modalAvatarUrl = useMemo(() => {
    if (avatarEditor.remove) return "";
    if (avatarEditor.source === "upload" && avatarEditorFileUrl) {
      return avatarEditorFileUrl;
    }
    if (avatarEditor.source === "url" && avatarEditor.url.trim()) {
      return resolveMyPageMediaUrl(avatarEditor.url.trim());
    }
    return currentAvatarUrl;
  }, [avatarEditor, avatarEditorFileUrl, currentAvatarUrl]);

  useEffect(() => {
    if (avatarDraft.mode === "keep") {
      setPreviewPage(null);
      return;
    }
    setPreviewPage({ ...(page || {}), avatarUrl: currentAvatarUrl || "" });
  }, [avatarDraft.mode, currentAvatarUrl, page, setPreviewPage]);

  useEffect(() => () => setPreviewPage(null), [setPreviewPage]);

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

  function openAvatarModal() {
    setAvatarEditor(buildAvatarEditorState(avatarDraft));
    setAvatarModalOpen(true);
  }

  function closeAvatarModal() {
    setAvatarModalOpen(false);
    setAvatarEditor(EMPTY_AVATAR_EDITOR);
  }

  function openIdentityModal(focus = "slug") {
    setIdentityEditor({
      slug: page?.slug || "",
      whatsappPhone: page?.whatsappPhone || "",
    });
    setIdentityModalFocus(focus);
    setIdentityModalOpen(true);
  }

  function closeIdentityModal() {
    setIdentityModalOpen(false);
    setIdentityEditor(EMPTY_IDENTITY_EDITOR);
    setIdentityModalFocus("slug");
  }

  function handleApplyIdentity() {
    setPage((prev) => ({
      ...(prev || {}),
      slug: identityEditor.slug,
      whatsappPhone: identityEditor.whatsappPhone,
    }));
    closeIdentityModal();
  }

  function handleApplyAvatar() {
    if (avatarEditor.remove) {
      setAvatarDraft({ mode: "remove", file: null, url: "" });
      closeAvatarModal();
      return;
    }

    if (
      avatarEditor.source === "upload" &&
      typeof File !== "undefined" &&
      avatarEditor.file instanceof File
    ) {
      setAvatarDraft({ mode: "upload", file: avatarEditor.file, url: "" });
      closeAvatarModal();
      return;
    }

    if (avatarEditor.source === "url" && avatarEditor.url.trim()) {
      setAvatarDraft({
        mode: "url",
        file: null,
        url: avatarEditor.url.trim(),
      });
      closeAvatarModal();
      return;
    }

    setAvatarDraft(EMPTY_AVATAR_DRAFT);
    closeAvatarModal();
  }

  async function handleSaveLinks() {
    try {
      setSaving(true);
      setErr("");
      const payload = {
        slug: page?.slug || "",
        title: page?.title || "",
        subtitle: page?.subtitle || "",
        description: page?.description || "",
        whatsappPhone: page?.whatsappPhone || "",
        buttons: page?.buttons || [],
        socialLinks: page?.socialLinks || [],
      };

      if (avatarDraft.mode !== "keep") {
        payload.avatarMode = avatarDraft.mode;
        if (avatarDraft.mode === "url") payload.avatarUrl = avatarDraft.url || "";
        if (avatarDraft.mode === "upload") payload.avatarFile = avatarDraft.file;
      }

      const response = await saveMyPageLinks(payload);
      setPage(response?.page || null);
      setAvatarDraft(EMPTY_AVATAR_DRAFT);
      setPreviewPage(null);
    } catch (error) {
      setErr(error?.message || "Nao consegui salvar os links da sua pagina.");
    } finally {
      setSaving(false);
    }
  }

  const hasAnyAvatar = Boolean(currentAvatarUrl);
  const titlePreview = page?.title || "Titulo da pagina";
  const subtitlePreview = page?.subtitle || "Seu subtitulo aparece aqui.";
  const slugPreview = page?.slug?.trim() ? `/${page.slug.trim()}` : "Definir slug";
  const whatsappPreview = page?.whatsappPhone?.trim()
    ? page.whatsappPhone.trim()
    : "Definir WhatsApp";

  return (
    <>
      <Card>
        <CardHeader
          title="Identidade"
          right={
            <Badge tone={page?.isPublished ? "PAID" : "DRAFT"}>
              {page?.isPublished ? "Publicada" : "Rascunho"}
            </Badge>
          }
        />
        <CardBody className="space-y-5">
          <div className="rounded-[28px] border border-slate-200/80 bg-white/80 p-5 shadow-[0_24px_48px_-34px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-white/[0.04] sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={openAvatarModal}
                className="group relative inline-flex h-28 w-28 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50 transition hover:border-sky-300 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-sky-400/30"
                aria-label="Editar avatar da pagina"
              >
                {hasAnyAvatar ? (
                  <img
                    src={currentAvatarUrl}
                    alt={page?.title || "Minha Pagina"}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(37,99,235,0.12),rgba(20,184,166,0.16))] text-slate-500 dark:bg-[linear-gradient(135deg,rgba(37,99,235,0.2),rgba(20,184,166,0.18))] dark:text-slate-300">
                    <UserRound className="h-10 w-10" />
                  </div>
                )}
                <span className="absolute bottom-1 right-1 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white bg-slate-950 text-white shadow-lg transition group-hover:scale-105 dark:border-slate-950">
                  <Camera className="h-4 w-4" />
                </span>
              </button>

              <div className="min-w-0 flex-1 space-y-4">
                <div className="space-y-1">
                  <div className="text-2xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">
                    {titlePreview}
                  </div>
                  <div className="text-base font-semibold text-slate-600 dark:text-slate-300">
                    {subtitlePreview}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => openIdentityModal("slug")}
                    className="inline-flex min-w-[220px] items-center gap-3 rounded-[22px] border border-slate-200/80 bg-white/90 px-4 py-3 text-left shadow-[0_14px_34px_-26px_rgba(15,23,42,0.2)] transition hover:border-sky-300 hover:bg-sky-50/70 dark:border-white/10 dark:bg-white/[0.05] dark:hover:border-sky-300/30 dark:hover:bg-sky-400/10"
                  >
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                      <Link2 className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                        Slug
                      </span>
                      <span className="block truncate text-sm font-semibold text-slate-950 dark:text-white">
                        {slugPreview}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openIdentityModal("whatsapp")}
                    className="inline-flex min-w-[220px] items-center gap-3 rounded-[22px] border border-slate-200/80 bg-white/90 px-4 py-3 text-left shadow-[0_14px_34px_-26px_rgba(15,23,42,0.2)] transition hover:border-emerald-300 hover:bg-emerald-50/70 dark:border-white/10 dark:bg-white/[0.05] dark:hover:border-emerald-300/30 dark:hover:bg-emerald-400/10"
                  >
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white">
                      <MessageCircle className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                        WhatsApp
                      </span>
                      <span className="block truncate text-sm font-semibold text-slate-950 dark:text-white">
                        {whatsappPreview}
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Titulo
              </label>
              <Input
                value={page?.title || ""}
                onChange={(event) => updateField("title", event.target.value)}
                placeholder="Nome do negocio"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Subtitulo
              </label>
              <Input
                value={page?.subtitle || ""}
                onChange={(event) => updateField("subtitle", event.target.value)}
                placeholder="Seu negocio em uma frase curta"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Descricao
              </label>
              <Textarea
                className="min-h-[120px]"
                value={page?.description || ""}
                onChange={(event) => updateField("description", event.target.value)}
                placeholder="Explique rapidamente o que a pessoa encontra na sua pagina."
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Botoes principais"
          subtitle="Ative e ordene os caminhos mais importantes da sua operacao."
          right={
            <Button type="button" variant="secondary" onClick={addButton}>
              <Plus className="h-4 w-4" />
              Adicionar botao
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
                    Rotulo
                  </label>
                  <Input
                    value={button.label}
                    onChange={(event) =>
                      updateButton(button.id, { label: event.target.value })
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
                    onChange={(event) =>
                      updateButton(button.id, {
                        type: event.target.value,
                        url: isNativeButtonType(event.target.value)
                          ? ""
                          : button.url || "",
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
                      button.type === "whatsapp" || isNativeButtonType(button.type)
                    }
                    onChange={(event) =>
                      updateButton(button.id, { url: event.target.value })
                    }
                    placeholder={
                      button.type === "whatsapp"
                        ? "Usa o WhatsApp principal da pagina"
                        : isNativeButtonType(button.type)
                          ? "Destino nativo da LuminorPay"
                          : "https://..."
                    }
                  />
                  {isNativeButtonType(button.type) ? (
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Esse botao abre um workflow nativo da LuminorPay.
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <label className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-3 py-2 text-sm font-medium text-slate-700 dark:border-white/10 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={button.enabled === true}
                      onChange={(event) =>
                        updateButton(button.id, {
                          enabled: event.target.checked,
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
          title="Links secundarios"
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
                      onChange={(event) =>
                        updateSocial(item.id, {
                          platform: event.target.value,
                          label: item.label || event.target.value,
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
                      Rotulo
                    </label>
                    <Input
                      value={item.label}
                      onChange={(event) =>
                        updateSocial(item.id, { label: event.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      URL
                    </label>
                    <Input
                      value={item.url}
                      onChange={(event) =>
                        updateSocial(item.id, { url: event.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={item.enabled === true}
                      onChange={(event) =>
                        updateSocial(item.id, { enabled: event.target.checked })
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
              title="Nenhum link secundario"
              description="Adicione Instagram, site ou qualquer outro link complementar."
              ctaLabel="Adicionar link"
              onCta={addSocial}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Solicitacoes"
          subtitle="Visao rapida dos pedidos recebidos. A operacao continua em Propostas."
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

          {requestsLoading ? null : latestQuoteRequests.length ? (
            latestQuoteRequests.map((request) => {
              const statusMeta = quoteRequestStatusBadge(request.status);
              return (
                <div
                  key={request._id}
                  className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-white/5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-slate-950 dark:text-white">
                      {request.customerName || "Lead sem nome"}
                    </div>
                    <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                  </div>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {request.customerWhatsApp || "Sem WhatsApp"}
                  </div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Recebido em {formatQuoteRequestDateTime(request.createdAt)}
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState
              title="Nenhuma solicitacao ainda"
              description="Quando alguem pedir orcamento pela sua pagina, as solicitacoes vao aparecer em Propostas."
            />
          )}

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                window.location.href = "/offers?view=requests";
              }}
            >
              Abrir solicitacoes em Propostas
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button type="button" disabled={saving} onClick={handleSaveLinks}>
          <MessageCircle className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar Links"}
        </Button>
      </div>

      <ModalShell
        open={avatarModalOpen}
        onClose={closeAvatarModal}
        panelClassName="max-w-2xl"
      >
        <div className="relative w-full rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.94))] p-5 shadow-[0_32px_80px_-42px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(9,15,28,0.94))] dark:shadow-[0_32px_80px_-42px_rgba(15,23,42,0.82)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-bold text-slate-950 dark:text-white">
                Imagem da pagina
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                Use uma foto, cole uma URL ou remova a imagem atual.
              </div>
            </div>
            <button
              type="button"
              onClick={closeAvatarModal}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-500 transition hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
              aria-label="Fechar modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-[180px_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="mx-auto flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border border-slate-200/80 bg-slate-50 dark:border-white/10 dark:bg-white/[0.04]">
                {modalAvatarUrl ? (
                  <img
                    src={modalAvatarUrl}
                    alt={page?.title || "Minha Pagina"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(37,99,235,0.12),rgba(20,184,166,0.16))] text-slate-500 dark:bg-[linear-gradient(135deg,rgba(37,99,235,0.2),rgba(20,184,166,0.18))] dark:text-slate-300">
                    <UserRound className="h-14 w-14" />
                  </div>
                )}
              </div>
              {(modalAvatarUrl || page?.avatarUrl || avatarDraft.mode !== "keep") && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() =>
                    setAvatarEditor((prev) => ({
                      ...prev,
                      remove: true,
                      file: null,
                      url: "",
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                  Remover imagem
                </Button>
              )}
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setAvatarEditor((prev) => ({
                      ...prev,
                      source: "upload",
                      remove: false,
                    }))
                  }
                  className={[
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                    avatarEditor.source === "upload" && !avatarEditor.remove
                      ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-300/40 dark:bg-sky-400/10 dark:text-sky-100"
                      : "border-slate-200/80 bg-white/90 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/20",
                  ].join(" ")}
                >
                  <Upload className="h-4 w-4" />
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAvatarEditor((prev) => ({
                      ...prev,
                      source: "url",
                      remove: false,
                    }))
                  }
                  className={[
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                    avatarEditor.source === "url" && !avatarEditor.remove
                      ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-300/40 dark:bg-sky-400/10 dark:text-sky-100"
                      : "border-slate-200/80 bg-white/90 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/20",
                  ].join(" ")}
                >
                  <Link2 className="h-4 w-4" />
                  URL
                </button>
              </div>

              {avatarEditor.source === "upload" ? (
                <div className="rounded-[24px] border border-slate-200/80 bg-white/85 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    Enviar imagem
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    PNG, JPG, WebP ou GIF ate 3MB.
                  </div>
                  <div className="mt-4">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        setAvatarEditor((prev) => ({
                          ...prev,
                          source: "upload",
                          file: event.target.files?.[0] || null,
                          remove: false,
                        }))
                      }
                      className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-2xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800 dark:text-slate-300 dark:file:bg-white dark:file:text-slate-950 dark:hover:file:bg-slate-100"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-slate-200/80 bg-white/85 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    Usar uma URL
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Cole o link direto da imagem principal da sua marca.
                  </div>
                  <div className="mt-4">
                    <Input
                      value={avatarEditor.url}
                      onChange={(event) =>
                        setAvatarEditor((prev) => ({
                          ...prev,
                          source: "url",
                          url: event.target.value,
                          remove: false,
                        }))
                      }
                      placeholder="https://..."
                    />
                  </div>
                </div>
              )}

              <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                A mesma imagem aparece como avatar no modo Classico e como fundo no modo Hero.
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeAvatarModal}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleApplyAvatar}>
              <ImagePlus className="h-4 w-4" />
              Aplicar
            </Button>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={identityModalOpen}
        onClose={closeIdentityModal}
        panelClassName="max-w-lg"
      >
        <div className="relative w-full rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.96))] p-5 shadow-[0_32px_80px_-42px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(9,15,28,0.94))] dark:shadow-[0_32px_80px_-42px_rgba(15,23,42,0.82)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">
                Identidade
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Edite o slug publico e o WhatsApp principal.
              </div>
            </div>
            <button
              type="button"
              onClick={closeIdentityModal}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-500 transition hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
              aria-label="Fechar modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Slug publico
              </label>
              <Input
                autoFocus={identityModalFocus === "slug"}
                value={identityEditor.slug}
                onChange={(event) =>
                  setIdentityEditor((prev) => ({
                    ...prev,
                    slug: event.target.value,
                  }))
                }
                placeholder="minha-marca"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                WhatsApp principal
              </label>
              <Input
                autoFocus={identityModalFocus === "whatsapp"}
                value={identityEditor.whatsappPhone}
                onChange={(event) =>
                  setIdentityEditor((prev) => ({
                    ...prev,
                    whatsappPhone: event.target.value,
                  }))
                }
                placeholder="11999999999"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeIdentityModal}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleApplyIdentity}>
              Aplicar
            </Button>
          </div>
        </div>
      </ModalShell>
    </>
  );
}
