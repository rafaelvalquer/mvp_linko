import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, MessageCircle, Plus, Trash2 } from "lucide-react";
import { saveMyPageLinks, getMyPageQuoteRequests } from "../app/myPageApi.js";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Badge from "../components/appui/Badge.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import { Input, Textarea } from "../components/appui/Input.jsx";
import { useMyPageContext } from "../components/my-page/useMyPageContext.js";
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

function isNativeButtonType(type) {
  return (
    type === "public_offer" ||
    type === "public_schedule" ||
    type === "catalog" ||
    type === "payment_link"
  );
}

export default function MyPageLinksPage() {
  const { page, setPage, setErr } = useMyPageContext();
  const [saving, setSaving] = useState(false);
  const [quoteRequests, setQuoteRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

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

  async function handleSaveLinks() {
    try {
      setSaving(true);
      setErr("");
      const payload = {
        slug: page?.slug || "",
        title: page?.title || "",
        subtitle: page?.subtitle || "",
        description: page?.description || "",
        avatarUrl: page?.avatarUrl || "",
        whatsappPhone: page?.whatsappPhone || "",
        buttons: page?.buttons || [],
        socialLinks: page?.socialLinks || [],
      };
      const response = await saveMyPageLinks(payload);
      setPage(response?.page || null);
    } catch (error) {
      setErr(error?.message || "Nao consegui salvar os links da sua pagina.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
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
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Slug público
            </label>
            <Input
              value={page?.slug || ""}
              onChange={(event) => updateField("slug", event.target.value)}
              placeholder="minha-marca"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              WhatsApp principal
            </label>
            <Input
              value={page?.whatsappPhone || ""}
              onChange={(event) =>
                updateField("whatsappPhone", event.target.value)
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
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="Nome do negócio"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Subtítulo
            </label>
            <Input
              value={page?.subtitle || ""}
              onChange={(event) => updateField("subtitle", event.target.value)}
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
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Explique rapidamente o que a pessoa encontra na sua página."
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Logo ou foto principal
            </label>
            <Input
              value={page?.avatarUrl || ""}
              onChange={(event) => updateField("avatarUrl", event.target.value)}
              placeholder="https://..."
            />
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Essa mesma imagem aparece como avatar no modo Classico e como fundo no modo Hero.
            </div>
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
                        ? "Usa o WhatsApp principal da página"
                        : isNativeButtonType(button.type)
                          ? "Destino nativo da LuminorPay"
                          : "https://..."
                    }
                  />
                  {isNativeButtonType(button.type) ? (
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Esse botão abre um workflow nativo da LuminorPay.
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
                      Rótulo
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
          subtitle="Visão rápida dos pedidos recebidos. A operação continua em Propostas."
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
              title="Nenhuma solicitação ainda"
              description="Quando alguém pedir orçamento pela sua página, as solicitações vão aparecer em Propostas."
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
              Abrir solicitações em Propostas
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
    </>
  );
}
