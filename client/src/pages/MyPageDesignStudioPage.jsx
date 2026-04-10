import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Circle,
  CircleDot,
  Check,
  Image,
  Link2,
  Palette,
  Paintbrush2,
  Pipette,
  Rows3,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Square,
  Type,
  UserRound,
  X,
} from "lucide-react";
import { saveMyPageDesign } from "../app/myPageApi.js";
import Card, { CardBody } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Badge from "../components/appui/Badge.jsx";
import ModalShell from "../components/appui/ModalShell.jsx";
import MyPageMobilePreview from "../components/my-page/MyPageMobilePreview.jsx";
import {
  MyPagePublicAvatar,
  MyPageBackgroundOverlay,
  getMyPageButtonIcon,
  getMyPageButtonMetaLabel,
  MyPageSecondaryLinks,
} from "../components/my-page/MyPagePublicUi.jsx";
import { useMyPageContext } from "../components/my-page/useMyPageContext.js";
import {
  getMyPageHomeButtonProps,
  getMyPageButtonProps,
  getMyPageThemePresetDefaults,
  getMyPageTheme,
  MY_PAGE_ANIMATION_PRESET_OPTIONS,
  MY_PAGE_BACKGROUND_GRADIENT_DIRECTION_OPTIONS,
  MY_PAGE_BACKGROUND_PATTERN_VARIANT_OPTIONS,
  MY_PAGE_BACKGROUND_STYLE_OPTIONS,
  MY_PAGE_BRAND_LAYOUT_OPTIONS,
  MY_PAGE_SURFACE_PATTERN_VARIANT_OPTIONS,
  MY_PAGE_SURFACE_STYLE_OPTIONS,
  MY_PAGE_PRIMARY_BUTTON_LAYOUT_OPTIONS,
  MY_PAGE_BUTTON_RADIUS_OPTIONS,
  MY_PAGE_BUTTON_SHADOW_OPTIONS,
  MY_PAGE_BUTTON_STYLE_OPTIONS,
  MY_PAGE_FONT_PRESET_OPTIONS,
  MY_PAGE_SECONDARY_LINK_ALIGN_OPTIONS,
  MY_PAGE_SECONDARY_LINK_ICON_LAYOUT_OPTIONS,
  MY_PAGE_SECONDARY_LINK_SIZE_OPTIONS,
  MY_PAGE_SECONDARY_LINK_STYLE_OPTIONS,
  MY_PAGE_THEME_PRESET_OPTIONS,
  mixHexColors,
  normalizeMyPageDesign,
  normalizeHexColor,
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
    key: "surface",
    label: "Superficie",
    icon: Pipette,
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
    key: "animation",
    label: "Animacao",
    icon: Sparkles,
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

const PRIMARY_BUTTON_LAYOUT_SAMPLES = [
  {
    id: "whatsapp",
    label: "Falar no WhatsApp",
    type: "whatsapp",
  },
  {
    id: "catalog",
    label: "Ver catalogo",
    type: "catalog",
  },
];

const COLOR_FIELD_OPTIONS = [
  { key: "backgroundColor", label: "Fundo" },
  { key: "buttonColor", label: "Botoes" },
  { key: "buttonTextColor", label: "Texto do botao" },
  { key: "pageTextColor", label: "Texto da pagina" },
  { key: "titleTextColor", label: "Texto dos titulos" },
];

const SURFACE_COLOR_FIELD = {
  key: "surfaceColor",
  label: "Cor do container",
};

const COLOR_MODAL_FIELD_OPTIONS = [...COLOR_FIELD_OPTIONS, SURFACE_COLOR_FIELD];

function buildColorInputValues(design = {}) {
  return Object.fromEntries(
    COLOR_MODAL_FIELD_OPTIONS.map((field) => [
      field.key,
      normalizeHexColor(design?.[field.key], "#000000"),
    ]),
  );
}

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((channel) =>
      clampNumber(Math.round(channel), 0, 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`.toUpperCase();
}

function rgbToHsv({ r, g, b }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  const saturation = max === 0 ? 0 : delta / max;
  return {
    hue,
    saturation: saturation * 100,
    value: max * 100,
  };
}

function hsvToRgb({ hue, saturation, value }) {
  const safeHue = ((Number(hue) || 0) % 360 + 360) % 360;
  const safeSaturation = clampNumber(Number(saturation) || 0, 0, 100) / 100;
  const safeValue = clampNumber(Number(value) || 0, 0, 100) / 100;
  const chroma = safeValue * safeSaturation;
  const section = safeHue / 60;
  const second = chroma * (1 - Math.abs((section % 2) - 1));
  const match = safeValue - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (section >= 0 && section < 1) {
    red = chroma;
    green = second;
  } else if (section < 2) {
    red = second;
    green = chroma;
  } else if (section < 3) {
    green = chroma;
    blue = second;
  } else if (section < 4) {
    green = second;
    blue = chroma;
  } else if (section < 5) {
    red = second;
    blue = chroma;
  } else {
    red = chroma;
    blue = second;
  }

  return {
    r: (red + match) * 255,
    g: (green + match) * 255,
    b: (blue + match) * 255,
  };
}

function createBackgroundPickerState(hex) {
  const normalized = normalizeHexColor(hex);
  const { hue, saturation, value } = rgbToHsv(hexToRgb(normalized));
  return {
    hex: normalized,
    hue,
    saturation,
    value,
  };
}

function uniqueColors(items = []) {
  return Array.from(
    new Set(
      items
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .map((item) => normalizeHexColor(item))
        .filter(Boolean),
    ),
  );
}

function iconForPrimaryButtonSample(type) {
  return getMyPageButtonIcon(type);
}

function primaryButtonMetaLabel(type) {
  return getMyPageButtonMetaLabel(type);
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
  const colorPanelRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState("home");
  const [activeSection, setActiveSection] = useState("theme");
  const [colorModalOpen, setColorModalOpen] = useState(false);
  const [activeColorField, setActiveColorField] = useState("backgroundColor");
  const [colorPicker, setColorPicker] = useState(() =>
    createBackgroundPickerState("#A1C9D1"),
  );
  const [colorHexInput, setColorHexInput] = useState("#A1C9D1");

  const savedDesign = useMemo(
    () => normalizeMyPageDesign(page?.design || {}, page?.coverStyle),
    [page?.coverStyle, page?.design],
  );
  const [draftDesign, setDraftDesign] = useState(savedDesign);
  const [colorInputValues, setColorInputValues] = useState(() =>
    buildColorInputValues(savedDesign),
  );

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
    setColorInputValues(buildColorInputValues(draftDesign));
  }, [draftDesignKey]);

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
      backgroundColor: presetDefaults.backgroundColor,
      surfaceStyle: presetDefaults.surfaceStyle,
      surfacePatternVariant: presetDefaults.surfacePatternVariant,
      surfaceColor: presetDefaults.surfaceColor,
      buttonColor: presetDefaults.buttonColor,
      buttonTextColor: presetDefaults.buttonTextColor,
      pageTextColor: presetDefaults.pageTextColor,
      titleTextColor: presetDefaults.titleTextColor,
      backgroundGradientDirection: presetDefaults.backgroundGradientDirection,
      backgroundPatternVariant: presetDefaults.backgroundPatternVariant,
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

  function openColorModal(fieldKey = "backgroundColor") {
    const themeDefaults = getMyPageThemePresetDefaults(draftDesign.themePreset);
    const nextHex = normalizeHexColor(
      draftDesign?.[fieldKey],
      themeDefaults?.[fieldKey] || draftDesign.backgroundColor,
    );
    setActiveColorField(fieldKey);
    setColorPicker(createBackgroundPickerState(nextHex));
    setColorHexInput(nextHex);
    setColorModalOpen(true);
  }

  function closeColorModal() {
    setColorModalOpen(false);
  }

  function applyColorHex(nextHex, fallback = colorPicker.hex) {
    const normalized = normalizeHexColor(nextHex, fallback);
    setColorPicker(createBackgroundPickerState(normalized));
    setColorHexInput(normalized);
  }

  function updateColorPicker(partial) {
    setColorPicker((prev) => {
      const next = { ...prev, ...partial };
      const normalizedHex = rgbToHex(
        ...Object.values(
          hsvToRgb({
            hue: next.hue,
            saturation: next.saturation,
            value: next.value,
          }),
        ),
      );
      setColorHexInput(normalizedHex);
      return { ...next, hex: normalizedHex };
    });
  }

  function updateColorFromPointer(event) {
    const bounds = colorPanelRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const x = clampNumber(event.clientX - bounds.left, 0, bounds.width);
    const y = clampNumber(event.clientY - bounds.top, 0, bounds.height);
    updateColorPicker({
      saturation: (x / bounds.width) * 100,
      value: 100 - (y / bounds.height) * 100,
    });
  }

  async function handleEyeDropper() {
    try {
      if (typeof window === "undefined" || !("EyeDropper" in window)) return;
      const picker = new window.EyeDropper();
      const result = await picker.open();
      applyColorHex(result?.sRGBHex, colorPicker.hex);
    } catch {}
  }

  function applyColorSelection() {
    updateDesignField(activeColorField, colorPicker.hex);
    setColorInputValues((prev) => ({
      ...prev,
      [activeColorField]: colorPicker.hex,
    }));
    closeColorModal();
  }

  function updateColorInputValue(fieldKey, nextValue) {
    setColorInputValues((prev) => ({
      ...prev,
      [fieldKey]: nextValue.toUpperCase(),
    }));
  }

  function commitColorInputValue(fieldKey) {
    const normalized = normalizeHexColor(
      colorInputValues[fieldKey],
      draftDesign?.[fieldKey],
    );
    updateDesignField(fieldKey, normalized);
    setColorInputValues((prev) => ({
      ...prev,
      [fieldKey]: normalized,
    }));
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
                          style={optionTheme.headingStyle}
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
                          style={optionTheme.headingStyle}
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
                backgroundColor: presetDefaults.backgroundColor,
                surfaceStyle: presetDefaults.surfaceStyle,
                surfacePatternVariant: presetDefaults.surfacePatternVariant,
                surfaceColor: presetDefaults.surfaceColor,
                buttonColor: presetDefaults.buttonColor,
                buttonTextColor: presetDefaults.buttonTextColor,
                pageTextColor: presetDefaults.pageTextColor,
                titleTextColor: presetDefaults.titleTextColor,
                backgroundGradientDirection: presetDefaults.backgroundGradientDirection,
                backgroundPatternVariant: presetDefaults.backgroundPatternVariant,
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
        title="Escolha o estilo do fundo"
        description="Defina o estilo, a direcao e a textura do fundo."
      >
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
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
                  <BackgroundOptionPreview theme={optionTheme} />
                </StudioChoiceCard>
              );
            })}
          </div>

          <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
            <label className="mb-3 block text-sm font-semibold text-slate-950 dark:text-white">
              Cor do fundo
            </label>
            <div className="relative">
              <input
                type="text"
                value={colorInputValues.backgroundColor || ""}
                onChange={(event) =>
                  updateColorInputValue("backgroundColor", event.target.value)
                }
                onBlur={() => commitColorInputValue("backgroundColor")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitColorInputValue("backgroundColor");
                  }
                }}
                className="h-14 w-full rounded-[18px] border border-slate-200 bg-white px-4 pr-16 text-sm font-semibold tracking-[0.04em] uppercase text-slate-950 outline-none transition focus:border-sky-300 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
              <button
                type="button"
                onClick={() => openColorModal("backgroundColor")}
                className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 rounded-full border border-slate-300 shadow-sm transition hover:scale-[1.04] dark:border-white/20"
                style={{
                  background: draftDesign.backgroundColor,
                  boxShadow: "0 0 0 3px rgba(255,255,255,0.7)",
                }}
                aria-label="Editar cor do fundo"
              />
            </div>
          </div>

          {draftDesign.backgroundStyle === "gradient" ? (
            <div className="space-y-4 rounded-[28px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Direcao
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Escolha como a transicao da cor base acontece na pagina.
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {MY_PAGE_BACKGROUND_GRADIENT_DIRECTION_OPTIONS.map((option) => {
                  const optionTheme = getOptionTheme({
                    backgroundStyle: "gradient",
                    backgroundGradientDirection: option.value,
                  });

                  return (
                    <StudioChoiceCard
                      key={option.value}
                      active={draftDesign.backgroundGradientDirection === option.value}
                      label={option.label}
                      description={option.description}
                      onClick={() =>
                        updateDesignField("backgroundGradientDirection", option.value)
                      }
                    >
                      <BackgroundOptionPreview
                        theme={optionTheme}
                        heightClassName="h-24"
                        minHeight="96px"
                      >
                        <div className="absolute inset-x-3 bottom-3">
                          <div
                            className="inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
                            style={optionTheme.softSurfaceStyle}
                          >
                            {option.label}
                          </div>
                        </div>
                      </BackgroundOptionPreview>
                    </StudioChoiceCard>
                  );
                })}
              </div>
            </div>
          ) : null}

          {draftDesign.backgroundStyle === "pattern" ? (
            <div className="space-y-4 rounded-[28px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Pattern
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Escolha o desenho da textura sem mudar a cor base.
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {MY_PAGE_BACKGROUND_PATTERN_VARIANT_OPTIONS.map((option) => {
                  const optionTheme = getOptionTheme({
                    backgroundStyle: "pattern",
                    backgroundPatternVariant: option.value,
                  });

                  return (
                    <StudioChoiceCard
                      key={option.value}
                      active={draftDesign.backgroundPatternVariant === option.value}
                      label={option.label}
                      description={option.description}
                      onClick={() =>
                        updateDesignField("backgroundPatternVariant", option.value)
                      }
                    >
                      <BackgroundOptionPreview
                        theme={optionTheme}
                        heightClassName="h-24"
                        minHeight="96px"
                      >
                        <div className="absolute inset-x-3 bottom-3">
                          <div
                            className="inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
                            style={optionTheme.softSurfaceStyle}
                          >
                            {option.label}
                          </div>
                        </div>
                      </BackgroundOptionPreview>
                    </StudioChoiceCard>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </SectionShell>
    );
  }

  function renderSurfaceSection() {
    return (
      <SectionShell
        eyebrow="Superficie"
        title="Container da frente"
        description="Controle a camada onde ficam logo, titulos, botoes e formularios."
      >
        <div className="space-y-6">
          <div>
            <div className="mb-3 text-sm font-semibold text-slate-950 dark:text-white">
              Estilo
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {MY_PAGE_SURFACE_STYLE_OPTIONS.map((option) => {
                const optionTheme = getOptionTheme({ surfaceStyle: option.value });

                return (
                  <StudioChoiceCard
                    key={option.value}
                    active={draftDesign.surfaceStyle === option.value}
                    label={option.label}
                    description={option.description}
                    onClick={() => updateDesignField("surfaceStyle", option.value)}
                  >
                    <SurfaceStyleChoicePreview theme={optionTheme} />
                  </StudioChoiceCard>
                );
              })}
            </div>
          </div>

          {draftDesign.surfaceStyle === "pattern" ? (
            <div className="space-y-4 rounded-[28px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Pattern
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Escolha a textura do container sem mudar a cor principal.
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {MY_PAGE_SURFACE_PATTERN_VARIANT_OPTIONS.map((option) => {
                  const optionTheme = getOptionTheme({
                    surfaceStyle: "pattern",
                    surfacePatternVariant: option.value,
                  });

                  return (
                    <StudioChoiceCard
                      key={option.value}
                      active={draftDesign.surfacePatternVariant === option.value}
                      label={option.label}
                      description={option.description}
                      onClick={() =>
                        updateDesignField("surfacePatternVariant", option.value)
                      }
                    >
                      <SurfaceStyleChoicePreview
                        theme={optionTheme}
                        heightClassName="h-24"
                        minHeight="96px"
                      />
                    </StudioChoiceCard>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
            <label className="mb-3 block text-sm font-semibold text-slate-950 dark:text-white">
              {SURFACE_COLOR_FIELD.label}
            </label>
            <div className="relative">
              <input
                type="text"
                value={colorInputValues[SURFACE_COLOR_FIELD.key] || ""}
                onChange={(event) =>
                  updateColorInputValue(SURFACE_COLOR_FIELD.key, event.target.value)
                }
                onBlur={() => commitColorInputValue(SURFACE_COLOR_FIELD.key)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitColorInputValue(SURFACE_COLOR_FIELD.key);
                  }
                }}
                className="h-14 w-full rounded-[18px] border border-slate-200 bg-white px-4 pr-16 text-sm font-semibold tracking-[0.04em] uppercase text-slate-950 outline-none transition focus:border-sky-300 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
              <button
                type="button"
                onClick={() => openColorModal(SURFACE_COLOR_FIELD.key)}
                className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 rounded-full border border-slate-300 shadow-sm transition hover:scale-[1.04] dark:border-white/20"
                style={{
                  background: draftDesign.surfaceColor,
                  boxShadow: "0 0 0 3px rgba(255,255,255,0.7)",
                }}
                aria-label={`Editar ${SURFACE_COLOR_FIELD.label}`}
              />
            </div>
          </div>
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
        title="Acabamento, forma e hierarquia"
        description="Defina o peso visual dos CTAs sem mudar a logica da pagina."
      >
        <div className="space-y-6">
          <div>
            <div className="mb-3 text-sm font-semibold text-slate-950 dark:text-white">
              Layout
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {MY_PAGE_PRIMARY_BUTTON_LAYOUT_OPTIONS.map((option) => {
                const optionTheme = getOptionTheme({
                  primaryButtonsLayout: option.value,
                });

                return (
                  <StudioChoiceCard
                    key={option.value}
                    active={draftDesign.primaryButtonsLayout === option.value}
                    label={option.label}
                    description={option.description}
                    onClick={() =>
                      updateDesignField("primaryButtonsLayout", option.value)
                    }
                  >
                    <PrimaryButtonLayoutPreview theme={optionTheme} />
                  </StudioChoiceCard>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm font-semibold text-slate-950 dark:text-white">
              Estilo
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {MY_PAGE_BUTTON_STYLE_OPTIONS.map((option) => {
                const optionTheme = getOptionTheme({ buttonStyle: option.value });

                return (
                  <StudioChoiceCard
                    key={option.value}
                    active={draftDesign.buttonStyle === option.value}
                    label={option.label}
                    description={option.description}
                    onClick={() => updateDesignField("buttonStyle", option.value)}
                  >
                    <ButtonStyleChoicePreview
                      theme={optionTheme}
                      buttonStyle={option.value}
                    />
                  </StudioChoiceCard>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm font-semibold text-slate-950 dark:text-white">
              Button shadow
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {MY_PAGE_BUTTON_SHADOW_OPTIONS.map((option) => {
                const optionTheme = getOptionTheme({
                  buttonShadow: option.value,
                });

                return (
                  <StudioChoiceCard
                    key={option.value}
                    active={draftDesign.buttonShadow === option.value}
                    label={option.label}
                    description={option.description}
                    onClick={() => updateDesignField("buttonShadow", option.value)}
                  >
                    <ButtonStyleChoicePreview
                      theme={optionTheme}
                      buttonStyle={optionTheme.design.buttonStyle}
                    />
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
                  round: CircleDot,
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
                          style={optionTheme.headingStyle}
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
        description="Controle conteudo, tamanho e alinhamento das redes na home."
      >
        <div className="space-y-6">
          <div>
            <div className="mb-3 text-sm font-semibold text-slate-950 dark:text-white">
              Conteudo
            </div>
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
                        className="mt-0"
                      />
                    </div>
                  </StudioChoiceCard>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm font-semibold text-slate-950 dark:text-white">
              Layout do icone
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {MY_PAGE_SECONDARY_LINK_ICON_LAYOUT_OPTIONS.map((option) => {
                const optionTheme = getOptionTheme({
                  secondaryLinksIconLayout: option.value,
                  secondaryLinksStyle:
                    draftDesign.secondaryLinksStyle === "text"
                      ? "icon_text"
                      : draftDesign.secondaryLinksStyle,
                });

                return (
                  <StudioChoiceCard
                    key={option.value}
                    active={draftDesign.secondaryLinksIconLayout === option.value}
                    label={option.label}
                    description={option.description}
                    onClick={() =>
                      updateDesignField("secondaryLinksIconLayout", option.value)
                    }
                  >
                    <div
                      className="space-y-3 rounded-[24px] border p-4"
                      style={optionTheme.softSurfaceStyle}
                    >
                      <div className="text-sm font-semibold" style={optionTheme.titleStyle}>
                        Visual do icone
                      </div>
                      <MyPageSecondaryLinks
                        theme={optionTheme}
                        links={SECONDARY_LINK_STYLE_SAMPLES}
                        interactive={false}
                        className="mt-0"
                      />
                    </div>
                  </StudioChoiceCard>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm font-semibold text-slate-950 dark:text-white">
              Tamanho
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {MY_PAGE_SECONDARY_LINK_SIZE_OPTIONS.map((option) => {
                const optionTheme = getOptionTheme({
                  secondaryLinksSize: option.value,
                });

                return (
                  <StudioChoiceCard
                    key={option.value}
                    active={draftDesign.secondaryLinksSize === option.value}
                    label={option.label}
                    description={option.description}
                    onClick={() => updateDesignField("secondaryLinksSize", option.value)}
                  >
                    <div
                      className="space-y-3 rounded-[24px] border p-4"
                      style={optionTheme.softSurfaceStyle}
                    >
                      <div className="text-sm font-semibold" style={optionTheme.titleStyle}>
                        Escala das redes
                      </div>
                      <MyPageSecondaryLinks
                        theme={optionTheme}
                        links={SECONDARY_LINK_STYLE_SAMPLES}
                        interactive={false}
                        className="mt-0"
                      />
                    </div>
                  </StudioChoiceCard>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm font-semibold text-slate-950 dark:text-white">
              Alinhamento
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {MY_PAGE_SECONDARY_LINK_ALIGN_OPTIONS.map((option) => {
                const optionTheme = getOptionTheme({
                  secondaryLinksAlign: option.value,
                });

                return (
                  <StudioChoiceCard
                    key={option.value}
                    active={draftDesign.secondaryLinksAlign === option.value}
                    label={option.label}
                    description={option.description}
                    onClick={() => updateDesignField("secondaryLinksAlign", option.value)}
                  >
                    <div
                      className="space-y-3 rounded-[24px] border p-4"
                      style={optionTheme.softSurfaceStyle}
                    >
                      <div className="text-sm font-semibold" style={optionTheme.titleStyle}>
                        Posicao do bloco
                      </div>
                      <MyPageSecondaryLinks
                        theme={optionTheme}
                        links={SECONDARY_LINK_STYLE_SAMPLES}
                        interactive={false}
                        className="mt-0"
                      />
                    </div>
                  </StudioChoiceCard>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          O preview mostra o estilo em tempo real. Para aparecer no link publico, voce ainda precisa ter links secundarios ativos em Links.
        </div>
      </SectionShell>
    );
  }

  function renderAnimationSection() {
    return (
      <SectionShell
        eyebrow="Animacao"
        title="Movimento no publico"
        description="Escolha o ritmo visual de entrada da pagina publica."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {MY_PAGE_ANIMATION_PRESET_OPTIONS.map((option) => {
            const optionTheme = getOptionTheme({
              animationPreset: option.value,
            });

            return (
              <StudioChoiceCard
                key={option.value}
                active={draftDesign.animationPreset === option.value}
                label={option.label}
                description={option.description}
                onClick={() => updateDesignField("animationPreset", option.value)}
              >
                <AnimationChoicePreview theme={optionTheme} />
              </StudioChoiceCard>
            );
          })}
        </div>
      </SectionShell>
    );
  }

  function renderColorsSection() {
    return (
      <SectionShell
        eyebrow="Cor"
        title="Ajuste cada cor do publico"
        description="Controle fundo, botoes e textos com liberdade total em cima do tema."
      >
        <div className="space-y-4">
          {COLOR_FIELD_OPTIONS.map((field) => (
            <div
              key={field.key}
              className="rounded-[28px] border border-slate-200/80 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5"
            >
              <label className="mb-3 block text-sm font-semibold text-slate-950 dark:text-white">
                {field.label}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={colorInputValues[field.key] || ""}
                  onChange={(event) =>
                    updateColorInputValue(field.key, event.target.value)
                  }
                  onBlur={() => commitColorInputValue(field.key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitColorInputValue(field.key);
                    }
                  }}
                  className="h-14 w-full rounded-[18px] border border-slate-200 bg-white px-4 pr-16 text-sm font-semibold tracking-[0.04em] uppercase text-slate-950 outline-none transition focus:border-sky-300 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => openColorModal(field.key)}
                  className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 rounded-full border border-slate-300 shadow-sm transition hover:scale-[1.04] dark:border-white/20"
                  style={{
                    background: draftDesign[field.key],
                    boxShadow: "0 0 0 3px rgba(255,255,255,0.7)",
                  }}
                  aria-label={`Editar ${field.label}`}
                />
              </div>
            </div>
          ))}
        </div>
      </SectionShell>
    );
  }

  function renderActiveSection() {
    if (activeSection === "header") return renderHeaderSection();
    if (activeSection === "theme") return renderThemeSection();
    if (activeSection === "background") return renderBackgroundSection();
    if (activeSection === "surface") return renderSurfaceSection();
    if (activeSection === "text") return renderTextSection();
    if (activeSection === "secondary-links") return renderSecondaryLinksSection();
    if (activeSection === "animation") return renderAnimationSection();
    if (activeSection === "colors") return renderColorsSection();
    return renderButtonsSection();
  }

  const colorThemeDefaults = getMyPageThemePresetDefaults(draftDesign.themePreset);
  const activeColorMeta =
    COLOR_MODAL_FIELD_OPTIONS.find((field) => field.key === activeColorField) ||
    COLOR_MODAL_FIELD_OPTIONS[0];
  const activeColorValue = normalizeHexColor(
    draftDesign?.[activeColorField],
    colorThemeDefaults?.[activeColorField],
  );
  const colorSuggestions = uniqueColors([
    activeColorValue,
    colorThemeDefaults?.[activeColorField],
    ...COLOR_MODAL_FIELD_OPTIONS.flatMap((field) => [
      draftDesign?.[field.key],
      colorThemeDefaults?.[field.key],
    ]),
    mixHexColors(activeColorValue, "#FFFFFF", 0.18),
    mixHexColors(activeColorValue, "#000000", 0.14),
  ]);
  const hueGradient =
    "linear-gradient(90deg,#ff0000 0%,#ffff00 16%,#00ff00 33%,#00ffff 50%,#0000ff 66%,#ff00ff 83%,#ff0000 100%)";
  const saturationPanelBackground = `linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0)), linear-gradient(to right, #ffffff, hsl(${colorPicker.hue} 100% 50%))`;

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

      <ModalShell open={colorModalOpen} onClose={closeColorModal} panelClassName="max-w-[420px]">
        <Card className="border border-white/60 bg-white/96 shadow-[0_40px_90px_-44px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-slate-950/94">
          <CardBody className="space-y-5 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">
                  {activeColorMeta.label}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Ajuste essa cor com precisao e aplique no preview ao vivo.
                </div>
              </div>
              <button
                type="button"
                onClick={closeColorModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/15 dark:hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div
                ref={colorPanelRef}
                role="presentation"
                onPointerDown={updateColorFromPointer}
                onPointerMove={(event) => {
                  if (event.buttons !== 1) return;
                  updateColorFromPointer(event);
                }}
                className="relative h-52 cursor-crosshair overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-inner dark:border-white/10"
                style={{ background: saturationPanelBackground }}
              >
                <div
                  className="pointer-events-none absolute h-6 w-6 rounded-full border-[3px] border-white shadow-[0_0_0_1px_rgba(15,23,42,0.18)]"
                  style={{
                    left: `${colorPicker.saturation}%`,
                    top: `${100 - colorPicker.value}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              </div>

              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={colorPicker.hue}
                  onChange={(event) =>
                    updateColorPicker({ hue: Number(event.target.value) })
                  }
                  className="h-3 w-full cursor-pointer appearance-none rounded-full"
                  style={{ background: hueGradient }}
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={colorHexInput}
                  onChange={(event) => setColorHexInput(event.target.value.toUpperCase())}
                  onBlur={() => applyColorHex(colorHexInput, colorPicker.hex)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      applyColorHex(colorHexInput, colorPicker.hex);
                    }
                  }}
                  className="h-12 flex-1 rounded-[18px] border border-slate-200 bg-white px-4 text-sm font-semibold tracking-[0.04em] uppercase text-slate-950 outline-none transition focus:border-sky-300 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleEyeDropper}
                  disabled={typeof window === "undefined" || !("EyeDropper" in window)}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/15 dark:hover:text-white"
                  aria-label="Capturar cor"
                >
                  <Pipette className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 border-t border-slate-200/80 pt-4 dark:border-white/10">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Sugeridas
                </div>
                <div className="flex flex-wrap gap-3">
                  {colorSuggestions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => applyColorHex(color, colorPicker.hex)}
                      className={cls(
                        "inline-flex h-11 w-11 rounded-full border-2 shadow-sm transition hover:scale-[1.04]",
                        colorPicker.hex === color
                          ? "border-slate-950 dark:border-white"
                          : "border-white/80 dark:border-slate-900",
                      )}
                      style={{ background: color }}
                      aria-label={`Usar cor ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-4 dark:border-white/10 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={closeColorModal}>
                Cancelar
              </Button>
              <Button type="button" onClick={applyColorSelection}>
                Aplicar
              </Button>
            </div>
          </CardBody>
        </Card>
      </ModalShell>
    </div>
  );
}

function BackgroundOptionPreview({
  theme,
  heightClassName = "h-28",
  minHeight = "112px",
  children = null,
}) {
  return (
    <div
      className={cls(
        "relative overflow-hidden rounded-[22px] border",
        heightClassName,
      )}
      style={{
        ...theme.rootStyle,
        minHeight,
        backgroundAttachment: "scroll",
      }}
    >
      <MyPageBackgroundOverlay theme={theme} />
      {children ? <div className="relative z-10">{children}</div> : null}
    </div>
  );
}

function SurfaceStyleChoicePreview({
  theme,
  heightClassName = "h-32",
  minHeight = "112px",
}) {
  return (
    <BackgroundOptionPreview
      theme={theme}
      heightClassName={heightClassName}
      minHeight={minHeight}
    >
      <div className="relative z-10 flex h-full items-center justify-center px-4 py-4">
        <div
          className="w-full rounded-[22px] border p-4"
          style={theme.surfaceStyle}
        >
          <div
            className="h-3 w-24 rounded-full"
            style={{ background: theme.titleStyle?.color || "#0F172A", opacity: 0.9 }}
          />
          <div className="mt-3 space-y-2">
            <div
              className="h-9 rounded-[16px] border"
              style={theme.softSurfaceStyle}
            />
            <div
              className="h-10 rounded-[16px] border"
              style={theme.primaryButtonStyle}
            />
          </div>
        </div>
      </div>
    </BackgroundOptionPreview>
  );
}

function PrimaryButtonLayoutPreview({ theme }) {
  return (
    <div
      className="space-y-3 rounded-[24px] border p-4"
      style={theme.softSurfaceStyle}
    >
      {PRIMARY_BUTTON_LAYOUT_SAMPLES.map((button, index) => {
        const Icon = iconForPrimaryButtonSample(button.type);
        const variant = index === 0 ? "primary" : "secondary";
        const { buttonProps, layout } = getMyPageHomeButtonProps(theme, variant, {
          preview: true,
        });

        return (
          <div
            key={button.id}
            className={cls(buttonProps.className, "w-full justify-between")}
            style={buttonProps.style}
          >
            <div className={layout.innerClassName}>
              <div
                className={cls(
                  "flex shrink-0 items-center justify-center border",
                  theme.buttonIconRadiusClassName,
                  layout.iconWrapClassName,
                )}
                style={layout.iconStyle}
              >
                <Icon className={layout.iconClassName} />
              </div>
              <div className={layout.contentClassName}>
                {layout.showMeta ? (
                  <div className={layout.metaClassName} style={theme.mutedTextStyle}>
                    {primaryButtonMetaLabel(button.type)}
                  </div>
                ) : null}
                <div className={layout.titleClassName}>{button.label}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ButtonStyleChoicePreview({ theme, buttonStyle }) {
  const buttonProps = getMyPageButtonProps(theme, "primary");

  return (
    <BackgroundOptionPreview theme={theme} heightClassName="h-28">
      <div className="relative flex h-full items-center justify-center px-4">
        {buttonStyle === "glass" ? (
          <>
            <div className="absolute left-3 top-3 h-10 w-16 rounded-[16px] border border-white/25 bg-white/10" />
            <div className="absolute right-4 bottom-3 h-8 w-20 rounded-[18px] border border-black/10 bg-black/10 dark:border-white/10 dark:bg-white/10" />
          </>
        ) : null}
        <div className="relative z-10 w-full pb-2 pr-2">
          <div
            className={cls(buttonProps.className, "w-full justify-center")}
            style={buttonProps.style}
          >
            CTA principal
          </div>
        </div>
      </div>
    </BackgroundOptionPreview>
  );
}

function AnimationChoicePreview({ theme }) {
  const preset = theme?.design?.animationPreset || "subtle";
  const profile =
    preset === "impact"
      ? {
          rows: [
            { width: "100%", offset: 22, opacity: 1, align: "right", ghosts: [26, 14] },
            { width: "90%", offset: 18, opacity: 0.88, align: "right", ghosts: [22, 10] },
            { width: "82%", offset: 14, opacity: 0.7, align: "right", ghosts: [18, 8] },
          ],
        }
      : preset === "strong"
      ? {
          rows: [
            { width: "100%", offset: 0, opacity: 1, align: "left", ghosts: [] },
            { width: "90%", offset: 7, opacity: 0.86, align: "left", ghosts: [] },
            { width: "78%", offset: 14, opacity: 0.66, align: "left", ghosts: [] },
          ],
        }
      : preset === "off"
        ? {
            rows: [
              { width: "100%", offset: 0, opacity: 1, align: "left", ghosts: [] },
              { width: "100%", offset: 0, opacity: 0.72, align: "left", ghosts: [] },
              { width: "100%", offset: 0, opacity: 0.5, align: "left", ghosts: [] },
            ],
          }
        : {
            rows: [
              { width: "100%", offset: 0, opacity: 1, align: "left", ghosts: [] },
              { width: "95%", offset: 3, opacity: 0.82, align: "left", ghosts: [] },
              { width: "90%", offset: 6, opacity: 0.62, align: "left", ghosts: [] },
            ],
          };

  return (
    <div
      className="rounded-[24px] border p-4"
      style={theme.softSurfaceStyle}
    >
      <div
        className="space-y-2 rounded-[18px] border p-3"
        style={theme.activeCardStyle}
      >
        {profile.rows.map((row, index) => (
          <div
            key={index}
            className={cls(
              "relative flex h-8 transition-all duration-200",
              row.align === "right" ? "justify-end" : "justify-start",
            )}
          >
            {row.ghosts?.map((ghost, ghostIndex) => (
              <div
                key={`${index}:${ghostIndex}`}
                className="absolute inset-y-0 rounded-[14px] border"
                style={{
                  width: row.width,
                  opacity: 0.16 - ghostIndex * 0.04,
                  ...(row.align === "right"
                    ? { right: `${ghost}px` }
                    : { left: `${ghost}px` }),
                  ...theme.softSurfaceStyle,
                }}
              />
            ))}
            <div
              className="relative h-8 rounded-[14px] border"
              style={{
                width: row.width,
                opacity: row.opacity,
                ...(row.align === "right"
                  ? { marginRight: `${row.offset}px` }
                  : { marginLeft: `${row.offset}%` }),
                ...(index === 0 ? theme.primaryButtonStyle : theme.softSurfaceStyle),
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
