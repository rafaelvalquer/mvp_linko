import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Circle,
  CircleDot,
  Check,
  Image,
  Link2,
  Palette,
  Paintbrush2,
  Rows3,
  RotateCcw,
  Square,
  Type,
  UserRound,
} from "lucide-react";
import { saveMyPageDesign } from "../app/myPageApi.js";
import Card, { CardBody } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Badge from "../components/appui/Badge.jsx";
import MyPageMobilePreview from "../components/my-page/MyPageMobilePreview.jsx";
import {
  MyPagePublicAvatar,
  MyPageSecondaryLinks,
} from "../components/my-page/MyPagePublicUi.jsx";
import { useMyPageContext } from "../components/my-page/useMyPageContext.js";
import {
  getMyPageButtonProps,
  getMyPageThemePresetDefaults,
  getMyPageTheme,
  MY_PAGE_ACCENT_PALETTE_OPTIONS,
  MY_PAGE_BACKGROUND_STYLE_OPTIONS,
  MY_PAGE_BRAND_LAYOUT_OPTIONS,
  MY_PAGE_BUTTON_RADIUS_OPTIONS,
  MY_PAGE_BUTTON_STYLE_OPTIONS,
  MY_PAGE_FONT_PRESET_OPTIONS,
  MY_PAGE_SECONDARY_LINK_STYLE_OPTIONS,
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
    label: "Marca",
    icon: UserRound,
  },
  {
    key: "theme",
    label: "Tema",
    icon: Paintbrush2,
  },
  {
    key: "background",
    label: "Fundo",
    icon: Image,
  },
  {
    key: "text",
    label: "Fonte",
    icon: Type,
  },
  {
    key: "buttons",
    label: "Botao",
    icon: Rows3,
  },
  {
    key: "secondary-links",
    label: "Redes",
    icon: Link2,
  },
  {
    key: "colors",
    label: "Cor",
    icon: Palette,
  },
];

const SECONDARY_LINK_STYLE_SAMPLES = [
  {
    id: "instagram",
    platform: "Instagram",
    label: "Instagram",
    url: "https://instagram.com/exemplo",
    enabled: true,
  },
  {
    id: "youtube",
    platform: "YouTube",
    label: "YouTube",
    url: "https://youtube.com/exemplo",
    enabled: true,
  },
  {
    id: "site",
    platform: "Site",
    label: "Site oficial",
    url: "https://example.com",
    enabled: true,
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
        "flex min-w-[92px] flex-col items-center gap-2 rounded-[22px] border px-3 py-3 text-center transition xl:min-w-0",
        active
          ? "border-sky-300 bg-[linear-gradient(135deg,rgba(37,99,235,0.12),rgba(20,184,166,0.16))] text-slate-950 shadow-[0_20px_44px_-30px_rgba(37,99,235,0.3)] dark:border-sky-400/25 dark:bg-[linear-gradient(135deg,rgba(37,99,235,0.2),rgba(20,184,166,0.14))] dark:text-white"
          : "border-slate-200/80 bg-white/90 text-slate-700 hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/15 dark:hover:text-white",
      )}
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/5 bg-white/80 dark:border-white/10 dark:bg-white/10">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-xs font-semibold">{section.label}</span>
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
      <CardBody className="space-y-5 p-5 sm:p-6">
        <div className="space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {eyebrow}
          </div>
          <div className="text-xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">
            {title}
          </div>
          <div className="max-w-[54ch] text-sm text-slate-600 dark:text-slate-300">
            {description}
          </div>
        </div>
        {children}
      </CardBody>
    </Card>
  );
}

export default function MyPageDesignStudioPage() {
  const navigate = useNavigate();
  const { page, setPage, setErr, setPreviewPage, setPreviewDirty } =
    useMyPageContext();
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState("home");
  const [activeSection, setActiveSection] = useState("theme");

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

  function applyThemePreset(themePreset) {
    const presetDefaults = getMyPageThemePresetDefaults(themePreset);
    setDraftDesign((prev) => ({
      ...prev,
      themePreset: presetDefaults.themePreset,
      accentPalette: presetDefaults.accentPalette,
      backgroundStyle: presetDefaults.backgroundStyle,
      fontPreset: presetDefaults.fontPreset,
      buttonStyle: presetDefaults.buttonStyle,
    }));
  }

  function getOptionTheme(patch) {
    return getMyPageTheme({
      ...(page || {}),
      design: { ...draftDesign, ...patch },
    });
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

  function renderHeaderSection() {
    return (
      <SectionShell
        eyebrow="Marca"
        title="Avatar ou Hero"
        description="Use a mesma imagem da pagina como avatar ou como fundo."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {MY_PAGE_BRAND_LAYOUT_OPTIONS.map((option) => {
            const optionTheme = getOptionTheme({ brandLayout: option.value });
            const brandMeta =
              option.value === "hero"
                ? { label: "Hero", description: "Imagem no fundo." }
                : { label: "Classico", description: "Avatar redondo." };

            return (
              <StudioChoiceCard
                key={option.value}
                active={draftDesign.brandLayout === option.value}
                label={brandMeta.label}
                description={brandMeta.description}
                onClick={() => updateDesignField("brandLayout", option.value)}
              >
                <div
                  className="rounded-[24px] border p-4"
                  style={optionTheme.softSurfaceStyle}
                >
                  {option.value === "hero" ? (
                    <div className="space-y-3">
                      <div
                        className="h-24 rounded-[20px] border"
                        style={
                          page?.avatarUrl
                            ? optionTheme.heroMediaStyle
                            : optionTheme.surfaceStyle
                        }
                      />
                      <div className="space-y-1">
                        <div
                          className="text-sm font-semibold"
                          style={{ color: optionTheme.preset.text }}
                        >
                          Hero de fundo
                        </div>
                        <div className="text-xs leading-5" style={optionTheme.mutedTextStyle}>
                          {page?.avatarUrl
                            ? "A imagem sobe para o topo com overlay e degrade."
                            : "Sem imagem, o layout faz fallback visual para Classico."}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <MyPagePublicAvatar
                        page={previewPage}
                        theme={optionTheme}
                        sizeClassName="h-16 w-16 rounded-full"
                        iconSizeClassName="h-7 w-7"
                      />
                      <div className="space-y-1">
                        <div
                          className="text-sm font-semibold"
                          style={{ color: optionTheme.preset.text }}
                        >
                          Avatar redondo
                        </div>
                        <div className="text-xs leading-5" style={optionTheme.mutedTextStyle}>
                          A identidade fica mais direta e familiar no topo.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </StudioChoiceCard>
            );
          })}
        </div>

        <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          <div className="font-semibold text-slate-950 dark:text-white">Imagem</div>
          <div className="mt-2 leading-6">
            {page?.avatarUrl
              ? "Pronta para Classico e Hero."
              : "Sem imagem, Hero cai para Classico."}
          </div>
          <div className="mt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/my-page/links")}
            >
              Editar imagem
            </Button>
          </div>
        </div>
      </SectionShell>
    );
  }

  function renderThemeSection() {
    return (
      <SectionShell
        eyebrow="Tema"
        title="Escolha um preset"
        description="O tema aplica um ponto de partida completo para cor, fundo, fonte e botoes."
      >
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {MY_PAGE_THEME_PRESET_OPTIONS.map((option) => {
            const presetDefaults = getMyPageThemePresetDefaults(option.value);
            const optionTheme = getOptionTheme({
              themePreset: option.value,
              accentPalette: presetDefaults.accentPalette,
              backgroundStyle: presetDefaults.backgroundStyle,
              fontPreset: presetDefaults.fontPreset,
              buttonStyle: presetDefaults.buttonStyle,
            });
            const buttonProps = getMyPageButtonProps(optionTheme, "primary");

            return (
              <StudioChoiceCard
                key={option.value}
                active={draftDesign.themePreset === option.value}
                label={option.label}
                description={option.description}
                onClick={() => applyThemePreset(option.value)}
              >
                <div
                  className="rounded-[24px] border p-4"
                  style={{
                    ...optionTheme.rootStyle,
                    minHeight: "148px",
                    backgroundAttachment: "scroll",
                  }}
                >
                  <div
                    className={cls(
                      "flex h-full flex-col justify-between rounded-[18px] border p-4",
                      "items-center text-center",
                    )}
                    style={optionTheme.softSurfaceStyle}
                  >
                    <div
                      className="mx-auto text-[10px] font-bold uppercase tracking-[0.18em]"
                      style={optionTheme.accentTextStyle}
                    >
                      {option.label}
                    </div>
                    <div className="mt-4 w-full text-center">
                      <div
                        className="text-lg font-black tracking-[-0.05em]"
                        style={optionTheme.titleStyle}
                      >
                        Minha Pagina
                      </div>
                      <div className="mt-1 text-xs" style={optionTheme.mutedTextStyle}>
                        Visual base do preset.
                      </div>
                    </div>
                    <div className="mt-4 w-full">
                      <div
                        className={cls(buttonProps.className, "w-full justify-center")}
                        style={buttonProps.style}
                      >
                        Ver layout
                      </div>
                    </div>
                  </div>
                </div>
              </StudioChoiceCard>
            );
          })}
        </div>
      </SectionShell>
    );
  }

  function renderBackgroundSection() {
    return (
      <SectionShell
        eyebrow="Fundo"
        title="Escolha a atmosfera"
        description="Mude a textura do fundo sem alterar as dimensoes da bio."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {MY_PAGE_BACKGROUND_STYLE_OPTIONS.map((option) => {
            const optionTheme = getOptionTheme({ backgroundStyle: option.value });

            return (
              <StudioChoiceCard
                key={option.value}
                active={draftDesign.backgroundStyle === option.value}
                label={option.label}
                description={option.description}
                onClick={() => updateDesignField("backgroundStyle", option.value)}
              >
                <div
                  className="h-28 rounded-[22px] border"
                  style={{
                    ...optionTheme.rootStyle,
                    minHeight: "112px",
                    backgroundAttachment: "scroll",
                  }}
                />
              </StudioChoiceCard>
            );
          })}
        </div>
      </SectionShell>
    );
  }

  function renderTextSection() {
    return (
      <SectionShell
        eyebrow="Fonte"
        title="Escolha a tipografia"
        description="A fonte vale para pagina, catalogo, formulario e pagamento."
      >
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {MY_PAGE_FONT_PRESET_OPTIONS.map((option) => {
            const optionTheme = getOptionTheme({ fontPreset: option.value });

            return (
              <StudioChoiceCard
                key={option.value}
                active={draftDesign.fontPreset === option.value}
                label={option.label}
                description={option.family}
                onClick={() => updateDesignField("fontPreset", option.value)}
              >
                <div
                  className="space-y-2 rounded-[24px] border p-4"
                  style={optionTheme.softSurfaceStyle}
                >
                  <div
                    className="text-2xl font-black tracking-[-0.05em]"
                    style={optionTheme.titleStyle}
                  >
                    Aa
                  </div>
                  <div className="text-sm font-semibold" style={optionTheme.headingStyle}>
                    Minha Pagina
                  </div>
                  <div className="text-xs leading-5" style={optionTheme.mutedTextStyle}>
                    Tipografia aplicada em todo o publico.
                  </div>
                </div>
              </StudioChoiceCard>
            );
          })}
        </div>
      </SectionShell>
    );
  }

  function renderButtonsSection() {
    return (
      <SectionShell
        eyebrow="Botao"
        title="Acabamento e forma"
        description="Combine estilo visual e formato sem alterar a estrutura da pagina."
      >
        <div className="space-y-6">
          <div>
            <div className="mb-3 text-sm font-semibold text-slate-950 dark:text-white">
              Estilo
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {MY_PAGE_BUTTON_STYLE_OPTIONS.map((option) => {
                const optionTheme = getOptionTheme({ buttonStyle: option.value });
                const buttonProps = getMyPageButtonProps(optionTheme, "primary");

                return (
                  <StudioChoiceCard
                    key={option.value}
                    active={draftDesign.buttonStyle === option.value}
                    label={option.label}
                    description={option.description}
                    onClick={() => updateDesignField("buttonStyle", option.value)}
                  >
                    <div
                      className="space-y-3 rounded-[24px] border p-4"
                      style={optionTheme.softSurfaceStyle}
                    >
                      <div
                        className={cls(buttonProps.className, "w-full justify-center")}
                        style={buttonProps.style}
                      >
                        Abrir pagina
                      </div>
                    </div>
                  </StudioChoiceCard>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm font-semibold text-slate-950 dark:text-white">
              Forma
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {MY_PAGE_BUTTON_RADIUS_OPTIONS.map((option) => {
                const icons = {
                  square: Square,
                  rounded: CircleDot,
                  pill: Circle,
                };
                const Icon = icons[option.value] || CircleDot;
                const optionTheme = getOptionTheme({ buttonRadius: option.value });
                const buttonProps = getMyPageButtonProps(optionTheme, "primary");

                return (
                  <StudioChoiceCard
                    key={option.value}
                    active={draftDesign.buttonRadius === option.value}
                    label={option.label}
                    description={option.description}
                    onClick={() => updateDesignField("buttonRadius", option.value)}
                  >
                    <div
                      className="space-y-3 rounded-[24px] border p-4"
                      style={optionTheme.softSurfaceStyle}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cls(
                            "inline-flex h-10 w-10 items-center justify-center border bg-white/80 dark:bg-white/10",
                            optionTheme.buttonIconRadiusClassName,
                          )}
                          style={{ borderColor: optionTheme.preset.border }}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span
                          className="text-sm font-semibold"
                          style={{ color: optionTheme.preset.text }}
                        >
                          {option.label}
                        </span>
                      </div>
                      <div
                        className={cls(buttonProps.className, "w-full justify-center")}
                        style={buttonProps.style}
                      >
                        Ver pagina
                      </div>
                    </div>
                  </StudioChoiceCard>
                );
              })}
            </div>
          </div>
        </div>
      </SectionShell>
    );
  }

  function renderSecondaryLinksSection() {
    return (
      <SectionShell
        eyebrow="Redes"
        title="Links secundarios"
        description="Escolha se suas redes aparecem em texto, icone ou icone com nome."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {MY_PAGE_SECONDARY_LINK_STYLE_OPTIONS.map((option) => {
            const optionTheme = getOptionTheme({
              secondaryLinksStyle: option.value,
            });

            return (
              <StudioChoiceCard
                key={option.value}
                active={draftDesign.secondaryLinksStyle === option.value}
                label={option.label}
                description={option.description}
                onClick={() => updateDesignField("secondaryLinksStyle", option.value)}
              >
                <div
                  className="space-y-3 rounded-[24px] border p-4"
                  style={optionTheme.softSurfaceStyle}
                >
                  <div className="text-sm font-semibold" style={optionTheme.titleStyle}>
                    Redes sociais
                  </div>
                  <MyPageSecondaryLinks
                    theme={optionTheme}
                    links={SECONDARY_LINK_STYLE_SAMPLES}
                    interactive={false}
                    className="mt-0 justify-start"
                  />
                </div>
              </StudioChoiceCard>
            );
          })}
        </div>

        <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          O preview mostra o estilo em tempo real. Para aparecer no link publico, voce ainda precisa ter links secundarios ativos em Links.
        </div>
      </SectionShell>
    );
  }

  function renderColorsSection() {
    return (
      <SectionShell
        eyebrow="Cor"
        title="Escolha a paleta"
        description="Mude destaques, CTA e selecao sem quebrar o tema."
      >
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {MY_PAGE_ACCENT_PALETTE_OPTIONS.map((option) => {
            const optionTheme = getOptionTheme({ accentPalette: option.value });
            const buttonProps = getMyPageButtonProps(optionTheme, "primary");

            return (
              <StudioChoiceCard
                key={option.value}
                active={draftDesign.accentPalette === option.value}
                label={option.label}
                description={option.value}
                onClick={() => updateDesignField("accentPalette", option.value)}
              >
                <div
                  className="space-y-3 rounded-[24px] border p-4"
                  style={optionTheme.softSurfaceStyle}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-10 w-10 rounded-full border border-white/50 shadow-sm"
                      style={{ background: option.swatch }}
                    />
                    <div className="text-sm font-semibold" style={optionTheme.titleStyle}>
                      {option.label}
                    </div>
                  </div>
                  <div
                    className={cls(buttonProps.className, "w-full justify-center")}
                    style={buttonProps.style}
                  >
                    CTA principal
                  </div>
                </div>
              </StudioChoiceCard>
            );
          })}
        </div>
      </SectionShell>
    );
  }

  function renderActiveSection() {
    if (activeSection === "header") return renderHeaderSection();
    if (activeSection === "theme") return renderThemeSection();
    if (activeSection === "background") return renderBackgroundSection();
    if (activeSection === "text") return renderTextSection();
    if (activeSection === "secondary-links") return renderSecondaryLinksSection();
    if (activeSection === "colors") return renderColorsSection();
    return renderButtonsSection();
  }

  return (
    <div className="space-y-5">
      <Card variant="quiet">
        <CardBody className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
              <div className="text-2xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">
                Design
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300">
                Tema base com overrides ao vivo.
              </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={hasUnsavedChanges ? "DRAFT" : "PUBLIC"}>
              {hasUnsavedChanges ? "Nao salvo" : "Aplicado"}
            </Badge>
            <Button
              type="button"
              variant="secondary"
              disabled={saving || !hasUnsavedChanges}
              onClick={handleDiscardChanges}
            >
              <RotateCcw className="h-4 w-4" />
              Descartar
            </Button>
            <Button
              type="button"
              disabled={saving || !hasUnsavedChanges}
              onClick={handleSaveDesign}
            >
              <Check className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[108px_minmax(0,1fr)_430px]">
        <Card variant="quiet" className="xl:self-start">
          <CardBody className="p-3">
            <div className="flex gap-2 overflow-x-auto xl:flex-col xl:overflow-visible">
              {DESIGN_SECTIONS.map((section) => (
                <StudioSectionButton
                  key={section.key}
                  section={section}
                  active={activeSection === section.key}
                  onClick={() => setActiveSection(section.key)}
                />
              ))}
            </div>
          </CardBody>
        </Card>

        <div className="space-y-5">
          {renderActiveSection()}

        </div>

        <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          <Card>
            <CardBody className="space-y-5 p-5">
              <div className="space-y-1">
                <div className="text-xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">
                  Previa
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  Ao vivo antes de salvar.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {PREVIEW_MODES.map((mode) => (
                  <PreviewModeButton
                    key={mode.key}
                    active={previewMode === mode.key}
                    label={mode.label}
                    onClick={() => setPreviewMode(mode.key)}
                  />
                ))}
              </div>

              <MyPageMobilePreview
                page={previewPage}
                mode={previewMode}
                variant="studio"
              />

              <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                {hasUnsavedChanges
                  ? "A previa usa o rascunho local. O link real muda so ao salvar."
                  : "Esse e o visual atual publicado para sua pagina."}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
