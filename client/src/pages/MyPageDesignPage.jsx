import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Image, Palette, Paintbrush2, Rows3, RotateCcw, Type, UserRound } from "lucide-react";
import { saveMyPageDesign } from "../app/myPageApi.js";
import Card, { CardBody } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Badge from "../components/appui/Badge.jsx";
import MyPageMobilePreview from "../components/my-page/MyPageMobilePreview.jsx";
import { MyPagePublicAvatar } from "../components/my-page/MyPagePublicUi.jsx";
import { useMyPageContext } from "../components/my-page/useMyPageContext.js";
import {
  getMyPageButtonProps,
  getMyPageTheme,
  MY_PAGE_ACCENT_PALETTE_OPTIONS,
  MY_PAGE_BACKGROUND_STYLE_OPTIONS,
  MY_PAGE_BRAND_LAYOUT_OPTIONS,
  MY_PAGE_BUTTON_STYLE_OPTIONS,
  MY_PAGE_FONT_PRESET_OPTIONS,
  MY_PAGE_THEME_PRESET_OPTIONS,
  normalizeMyPageDesign,
} from "../components/my-page/myPageTheme.js";

const PREVIEW_MODES = [
  { key: "home", label: "Pagina" },
  { key: "catalog", label: "Catalogo" },
  { key: "quote", label: "Orcamento" },
  { key: "schedule", label: "Agenda" },
  { key: "pay", label: "Pagamento" },
];

const DESIGN_SECTIONS = [
  {
    key: "header",
    label: "Header",
    description: "Avatar ou hero com a imagem principal da sua pagina.",
    icon: UserRound,
  },
  {
    key: "theme",
    label: "Theme",
    description: "Clima visual geral da experiencia publica.",
    icon: Paintbrush2,
  },
  {
    key: "wallpaper",
    label: "Wallpaper",
    description: "Profundidade e comportamento do fundo.",
    icon: Image,
  },
  {
    key: "text",
    label: "Text",
    description: "Tipografia para toda a familia publica.",
    icon: Type,
  },
  {
    key: "buttons",
    label: "Buttons",
    description: "Presenca visual e leitura dos seus CTAs.",
    icon: Rows3,
  },
  {
    key: "colors",
    label: "Colors",
    description: "Paleta de acento aplicada em destaque e acoes.",
    icon: Palette,
  },
];

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function StudioSectionButton({ section, active, onClick }) {
  const Icon = section.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cls(
        "flex min-w-[160px] items-start gap-3 rounded-[24px] border px-4 py-3 text-left transition xl:min-w-0",
        active
          ? "border-sky-300 bg-[linear-gradient(135deg,rgba(37,99,235,0.12),rgba(20,184,166,0.16))] text-slate-950 shadow-[0_20px_44px_-30px_rgba(37,99,235,0.3)] dark:border-sky-400/25 dark:bg-[linear-gradient(135deg,rgba(37,99,235,0.2),rgba(20,184,166,0.14))] dark:text-white"
          : "border-slate-200/80 bg-white/90 text-slate-700 hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/15 dark:hover:text-white",
      )}
    >
      <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/5 bg-white/70 dark:border-white/10 dark:bg-white/10">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{section.label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
          {section.description}
        </span>
      </span>
    </button>
  );
}

function StudioChoiceCard({
  active,
  label,
  description,
  onClick,
  children,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls(
        "overflow-hidden rounded-[28px] border text-left transition",
        active
          ? "border-sky-300 bg-sky-50 shadow-[0_24px_54px_-36px_rgba(37,99,235,0.34)] dark:border-sky-300/30 dark:bg-sky-400/10"
          : "border-slate-200/80 bg-white/90 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/15",
      )}
    >
      <div className="border-b border-slate-200/70 p-4 dark:border-white/10">
        {children}
      </div>
      <div className="space-y-1 p-4">
        <div className="text-sm font-semibold text-slate-950 dark:text-white">{label}</div>
        <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</div>
      </div>
    </button>
  );
}

function PreviewModeButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls(
        "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-300/40 dark:bg-sky-400/10 dark:text-sky-100"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
      )}
    >
      {label}
    </button>
  );
}

function SectionShell({ eyebrow, title, description, children }) {
  return (
    <Card>
      <CardBody className="space-y-6 p-5 sm:p-6">
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {eyebrow}
          </div>
          <div className="text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">
            {title}
          </div>
          <div className="max-w-[60ch] text-sm leading-6 text-slate-600 dark:text-slate-300">
            {description}
          </div>
        </div>
        {children}
      </CardBody>
    </Card>
  );
}

export default function MyPageDesignPage() {
  const { page, setPage, setErr, setPreviewPage, setPreviewDirty } =
    useMyPageContext();
  const [saving, setSaving] = useState(false);

  const savedDesign = useMemo(
    () => normalizeMyPageDesign(page?.design || {}, page?.coverStyle),
    [page?.coverStyle, page?.design],
  );
  const [draftDesign, setDraftDesign] = useState(savedDesign);

  const savedDesignKey = useMemo(() => JSON.stringify(savedDesign), [savedDesign]);
  const draftDesignKey = useMemo(() => JSON.stringify(draftDesign), [draftDesign]);
  const hasUnsavedChanges = savedDesignKey !== draftDesignKey;

  const previewPage = useMemo(
    () => ({ ...(page || {}), design: draftDesign }),
    [draftDesign, page],
  );
  const theme = useMemo(() => getMyPageTheme(previewPage), [previewPage]);

  useEffect(() => {
    setDraftDesign(savedDesign);
  }, [savedDesign, savedDesignKey]);

  useEffect(() => {
    if (!page) return;
    if (hasUnsavedChanges) {
      setPreviewPage(previewPage);
      setPreviewDirty(true);
      return;
    }
    setPreviewPage(null);
    setPreviewDirty(false);
  }, [
    hasUnsavedChanges,
    page,
    previewPage,
    setPreviewDirty,
    setPreviewPage,
  ]);

  useEffect(
    () => () => {
      setPreviewPage(null);
      setPreviewDirty(false);
    },
    [setPreviewDirty, setPreviewPage],
  );

  function updateDesignField(key, value) {
    setDraftDesign((prev) => ({ ...prev, [key]: value }));
  }

  function handleDiscardChanges() {
    setDraftDesign(savedDesign);
    setPreviewPage(null);
    setPreviewDirty(false);
  }

  async function handleSaveDesign() {
    try {
      setSaving(true);
      setErr("");
      const response = await saveMyPageDesign(draftDesign);
      const nextPage = response?.page || null;
      setPage(nextPage);
      setDraftDesign(
        normalizeMyPageDesign(nextPage?.design || {}, nextPage?.coverStyle),
      );
      setPreviewPage(null);
      setPreviewDirty(false);
    } catch (error) {
      setErr(error?.message || "Nao consegui salvar o design da pagina.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Visual da sua pagina"
          subtitle="A previa mobile responde na hora. O link publico real so muda quando voce salvar."
          right={
            <Badge tone={hasUnsavedChanges ? "DRAFT" : "PUBLIC"}>
              {hasUnsavedChanges ? "Alteracoes nao salvas" : "Aplicado em todos os fluxos"}
            </Badge>
          }
        />
        <CardBody className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
              <Paintbrush2 className="h-4 w-4" />
              Tema
            </div>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Define a atmosfera principal e a direcao visual da pagina.
            </div>
          </div>
          <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
              <Sparkles className="h-4 w-4" />
              Fundo + botoes
            </div>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Ajusta profundidade visual, hero e presenca dos CTAs.
            </div>
          </div>
          <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
              <Type className="h-4 w-4" />
              Fonte
            </div>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Vale para home, catalogo, orcamento, agenda e pagamento.
            </div>
          </div>
        </CardBody>
      </Card>

      <OptionGrid
        title="Apresentacao da marca"
        subtitle="Classico mostra a logo como avatar redondo. Hero usa a mesma imagem como fundo com degrade moderno."
        options={MY_PAGE_BRAND_LAYOUT_OPTIONS}
        value={draftDesign.brandLayout}
        onSelect={(value) => updateDesignField("brandLayout", value)}
      />

      <OptionGrid
        title="Tema"
        subtitle="Escolha a direcao visual principal da sua pagina."
        options={MY_PAGE_THEME_PRESET_OPTIONS}
        value={draftDesign.themePreset}
        onSelect={(value) => updateDesignField("themePreset", value)}
      />

      <OptionGrid
        title="Cores"
        subtitle="Defina a paleta de acento usada nos CTAs, destaques e selecoes."
        options={MY_PAGE_ACCENT_PALETTE_OPTIONS}
        value={draftDesign.accentPalette}
        onSelect={(value) => updateDesignField("accentPalette", value)}
        renderSwatch={(option) => (
          <span
            className="inline-flex h-8 w-8 rounded-full border border-white/60 shadow-sm"
            style={{ background: option.swatch }}
          />
        )}
      />

      <OptionGrid
        title="Fundo"
        subtitle="Escolha como os efeitos de luz e profundidade aparecem ao fundo."
        options={MY_PAGE_BACKGROUND_STYLE_OPTIONS}
        value={draftDesign.backgroundStyle}
        onSelect={(value) => updateDesignField("backgroundStyle", value)}
      />

      <OptionGrid
        title="Fonte"
        subtitle="A tipografia define o tom da pagina e aparece em todos os fluxos publicos."
        options={MY_PAGE_FONT_PRESET_OPTIONS}
        value={draftDesign.fontPreset}
        onSelect={(value) => updateDesignField("fontPreset", value)}
      />

      <OptionGrid
        title="Estilo dos botoes"
        subtitle="Escolha a presenca visual dos seus CTAs."
        options={MY_PAGE_BUTTON_STYLE_OPTIONS}
        value={draftDesign.buttonStyle}
        onSelect={(value) => updateDesignField("buttonStyle", value)}
      />

      <Card>
        <CardHeader
          title="O que esse design afeta"
          subtitle="O mesmo visual sera usado em toda a familia publica da Minha Pagina."
        />
        <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {FLOW_LABELS.map((label) => (
            <div
              key={label}
              className="rounded-[22px] border p-4"
              style={theme.softSurfaceStyle}
            >
              <div className="text-sm font-semibold" style={{ color: theme.preset.text }}>
                {label}
              </div>
              <div className="mt-2 text-xs leading-5" style={theme.mutedTextStyle}>
                {theme.usesHeroLayout
                  ? "Usa a imagem atual da pagina como hero de fundo, com overlay e degrade para manter leitura."
                  : "Usa avatar circular, a mesma paleta, a mesma tipografia e o mesmo estilo de botao."}
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          disabled={saving || !hasUnsavedChanges}
          onClick={handleDiscardChanges}
        >
          <RotateCcw className="h-4 w-4" />
          Descartar alteracoes
        </Button>
        <Button
          type="button"
          disabled={saving || !hasUnsavedChanges}
          onClick={handleSaveDesign}
        >
          <Check className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar Design"}
        </Button>
      </div>
    </>
  );
}
