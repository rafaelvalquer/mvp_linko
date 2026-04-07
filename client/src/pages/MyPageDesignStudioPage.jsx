import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Circle,
  CircleDot,
  Check,
  Image,
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
import { MyPagePublicAvatar } from "../components/my-page/MyPagePublicUi.jsx";
import { useMyPageContext } from "../components/my-page/useMyPageContext.js";
import {
  getMyPageButtonProps,
  getMyPageTheme,
  MY_PAGE_ACCENT_PALETTE_OPTIONS,
  MY_PAGE_BACKGROUND_STYLE_OPTIONS,
  MY_PAGE_BRAND_LAYOUT_OPTIONS,
  MY_PAGE_BUTTON_RADIUS_OPTIONS,
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
    label: "Marca",
    description: "Avatar ou hero.",
    icon: UserRound,
  },
  {
    key: "theme",
    label: "Tema",
    description: "Clima visual.",
    icon: Paintbrush2,
  },
  {
    key: "wallpaper",
    label: "Fundo",
    description: "Luz e textura.",
    icon: Image,
  },
  {
    key: "text",
    label: "Fonte",
    description: "Familia tipografica.",
    icon: Type,
  },
  {
    key: "buttons",
    label: "Botao",
    description: "Estilo e forma.",
    icon: Rows3,
  },
  {
    key: "colors",
    label: "Cor",
    description: "Acento principal.",
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
        "flex min-w-[96px] flex-col items-center gap-2 rounded-[24px] border px-3 py-4 text-center transition xl:min-w-0",
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
  const [activeSection, setActiveSection] = useState("header");

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
        title="Clima"
        description="Troque o preset e compare na hora."
      >
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {MY_PAGE_THEME_PRESET_OPTIONS.map((option) => {
            const optionTheme = getOptionTheme({ themePreset: option.value });

            return (
              <StudioChoiceCard
                key={option.value}
                active={draftDesign.themePreset === option.value}
                label={option.label}
                description={option.description}
                onClick={() => updateDesignField("themePreset", option.value)}
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
                    className="rounded-[18px] border px-3 py-2 text-xs font-semibold"
                    style={optionTheme.softSurfaceStyle}
                  >
                    {option.label}
                  </div>
                  <div
                    className="mt-5 text-xl font-black tracking-[-0.05em]"
                    style={{
                      color: optionTheme.preset.text,
                      fontFamily: optionTheme.rootStyle.fontFamily,
                    }}
                  >
                    Minha Pagina
                  </div>
                  <div className="mt-3">
                    <div
                      className={cls(
                        getMyPageButtonProps(optionTheme, "primary").className,
                        "w-full justify-center",
                      )}
                      style={getMyPageButtonProps(optionTheme, "primary").style}
                    >
                      CTA
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

  function renderWallpaperSection() {
    return (
      <SectionShell
        eyebrow="Fundo"
        title="Luz"
        description="Escolha o comportamento do fundo."
      >
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
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
                  className="rounded-[24px] border"
                  style={{
                    ...optionTheme.rootStyle,
                    minHeight: "148px",
                    backgroundAttachment: "scroll",
                  }}
                >
                  <div className="h-[148px] rounded-[24px]" />
                </div>
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
        title="Familia"
        description="A tipografia vale para toda a familia publica."
      >
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
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
                  className="rounded-[24px] border p-4"
                  style={{
                    ...optionTheme.surfaceStyle,
                    fontFamily: option.family,
                  }}
                >
                  <div className="text-3xl font-black tracking-[-0.05em]">Aa</div>
                  <div
                    className="text-2xl font-black tracking-[-0.05em]"
                    style={{ color: optionTheme.preset.text }}
                  >
                    Minha Pagina
                  </div>
                  <div className="text-sm" style={optionTheme.mutedTextStyle}>
                    Catalogo, agenda e pagamento.
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
        title="Estilo e forma"
        description="Defina acabamento e borda dos CTAs."
      >
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Estilo
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {MY_PAGE_BUTTON_STYLE_OPTIONS.map((option) => {
                const optionTheme = getOptionTheme({ buttonStyle: option.value });
                const primaryProps = getMyPageButtonProps(optionTheme, "primary");
                const secondaryProps = getMyPageButtonProps(
                  optionTheme,
                  "secondary",
                );
                const styleMeta = {
                  solid: { label: "Solido", description: "Mais forte." },
                  soft: { label: "Soft", description: "Mais suave." },
                  outline: { label: "Outline", description: "Mais leve." },
                }[option.value] || {
                  label: option.label,
                  description: option.description,
                };

                return (
                  <StudioChoiceCard
                    key={option.value}
                    active={draftDesign.buttonStyle === option.value}
                    label={styleMeta.label}
                    description={styleMeta.description}
                    onClick={() => updateDesignField("buttonStyle", option.value)}
                  >
                    <div
                      className="space-y-3 rounded-[24px] border p-4"
                      style={optionTheme.softSurfaceStyle}
                    >
                      <div
                        className={cls(primaryProps.className, "w-full justify-center")}
                        style={primaryProps.style}
                      >
                        Principal
                      </div>
                      <div
                        className={cls(secondaryProps.className, "w-full justify-center")}
                        style={secondaryProps.style}
                      >
                        Secundario
                      </div>
                    </div>
                  </StudioChoiceCard>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
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

  function renderColorsSection() {
    return (
      <SectionShell
        eyebrow="Cor"
        title="Acento"
        description="A cor principal de destaque da pagina."
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
                description="CTA e foco."
                onClick={() => updateDesignField("accentPalette", option.value)}
              >
                <div
                  className="space-y-4 rounded-[24px] border p-4"
                  style={optionTheme.surfaceStyle}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-12 w-12 rounded-full border border-white/70 shadow-sm"
                      style={{ background: option.swatch }}
                    />
                    <div>
                      <div
                        className="text-sm font-semibold"
                        style={{ color: optionTheme.preset.text }}
                      >
                        {option.label}
                      </div>
                      <div className="text-xs" style={optionTheme.mutedTextStyle}>
                        Destaque e selecao
                      </div>
                    </div>
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
      </SectionShell>
    );
  }

  function renderActiveSection() {
    if (activeSection === "header") return renderHeaderSection();
    if (activeSection === "theme") return renderThemeSection();
    if (activeSection === "wallpaper") return renderWallpaperSection();
    if (activeSection === "text") return renderTextSection();
    if (activeSection === "buttons") return renderButtonsSection();
    return renderColorsSection();
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
              Edite e compare em tempo real.
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
