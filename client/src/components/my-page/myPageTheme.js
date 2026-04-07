export const MY_PAGE_DESIGN_DEFAULTS = {
  themePreset: "ocean",
  brandLayout: "classic",
  accentPalette: "sky",
  backgroundStyle: "halo",
  fontPreset: "inter",
  buttonStyle: "solid",
  buttonRadius: "rounded",
};

export const MY_PAGE_THEME_PRESET_OPTIONS = [
  {
    value: "ocean",
    label: "Oceano",
    description: "Claro, leve e comercial.",
  },
  {
    value: "sunset",
    label: "Sunset",
    description: "Quente e editorial.",
  },
  {
    value: "graphite",
    label: "Graphite",
    description: "Escuro e sofisticado.",
  },
];

export const MY_PAGE_ACCENT_PALETTE_OPTIONS = [
  { value: "sky", label: "Azul", swatch: "#2563eb" },
  { value: "emerald", label: "Verde", swatch: "#059669" },
  { value: "rose", label: "Rose", swatch: "#e11d48" },
  { value: "violet", label: "Violeta", swatch: "#7c3aed" },
];

export const MY_PAGE_BRAND_LAYOUT_OPTIONS = [
  {
    value: "classic",
    label: "Classico",
    description: "Avatar redondo no topo.",
  },
  {
    value: "hero",
    label: "Hero",
    description: "Usa a imagem atual ao fundo com degradê moderno.",
  },
];

export const MY_PAGE_BACKGROUND_STYLE_OPTIONS = [
  { value: "halo", label: "Halo", description: "Luz suave." },
  { value: "mesh", label: "Mesh", description: "Mistura de tons." },
  { value: "spotlight", label: "Spot", description: "Foco no topo." },
];

export const MY_PAGE_FONT_PRESET_OPTIONS = [
  { value: "inter", label: "Inter", family: "Inter, sans-serif" },
  { value: "manrope", label: "Manrope", family: "Manrope, sans-serif" },
  {
    value: "jakarta",
    label: "Jakarta",
    family: "'Plus Jakarta Sans', sans-serif",
  },
];

export const MY_PAGE_BUTTON_STYLE_OPTIONS = [
  { value: "solid", label: "Sólido", description: "CTA mais forte." },
  { value: "soft", label: "Soft", description: "Visual suave e elegante." },
  { value: "outline", label: "Outline", description: "Transparente e leve." },
];

export const MY_PAGE_BUTTON_RADIUS_OPTIONS = [
  { value: "square", label: "Reta", description: "Borda baixa." },
  { value: "rounded", label: "Arred.", description: "Equilibrada." },
  { value: "pill", label: "Pill", description: "Maxima." },
];

const THEME_PRESETS = {
  ocean: {
    pageFrom: "#edf6ff",
    pageTo: "#ecfeff",
    pageEnd: "#f8fafc",
    text: "#0f172a",
    muted: "#475569",
    surfaceFrom: "rgba(255,255,255,0.98)",
    surfaceTo: "rgba(239,246,255,0.94)",
    softSurfaceFrom: "rgba(255,255,255,0.88)",
    softSurfaceTo: "rgba(224,242,254,0.64)",
    border: "rgba(148,163,184,0.26)",
    strongBorder: "rgba(56,189,248,0.34)",
    ornamentA: "rgba(37,99,235,0.18)",
    ornamentB: "rgba(20,184,166,0.16)",
    ornamentC: "rgba(125,211,252,0.18)",
    inputBg: "rgba(255,255,255,0.92)",
    heroOverlayFrom: "rgba(237,246,255,0.78)",
    heroOverlayTo: "rgba(248,250,252,0.9)",
  },
  sunset: {
    pageFrom: "#fff7ed",
    pageTo: "#fff1f2",
    pageEnd: "#fffaf5",
    text: "#3f1d2e",
    muted: "#6b4f5f",
    surfaceFrom: "rgba(255,250,245,0.98)",
    surfaceTo: "rgba(255,241,242,0.94)",
    softSurfaceFrom: "rgba(255,248,242,0.9)",
    softSurfaceTo: "rgba(255,228,230,0.62)",
    border: "rgba(251,146,60,0.24)",
    strongBorder: "rgba(244,114,182,0.28)",
    ornamentA: "rgba(249,115,22,0.16)",
    ornamentB: "rgba(244,114,182,0.16)",
    ornamentC: "rgba(253,186,116,0.22)",
    inputBg: "rgba(255,252,248,0.92)",
    heroOverlayFrom: "rgba(255,247,237,0.8)",
    heroOverlayTo: "rgba(255,250,245,0.92)",
  },
  graphite: {
    pageFrom: "#091220",
    pageTo: "#111827",
    pageEnd: "#060b16",
    text: "#f8fafc",
    muted: "#cbd5e1",
    surfaceFrom: "rgba(15,23,42,0.96)",
    surfaceTo: "rgba(17,24,39,0.9)",
    softSurfaceFrom: "rgba(15,23,42,0.82)",
    softSurfaceTo: "rgba(30,41,59,0.78)",
    border: "rgba(148,163,184,0.18)",
    strongBorder: "rgba(56,189,248,0.24)",
    ornamentA: "rgba(37,99,235,0.24)",
    ornamentB: "rgba(20,184,166,0.18)",
    ornamentC: "rgba(125,211,252,0.16)",
    inputBg: "rgba(15,23,42,0.8)",
    heroOverlayFrom: "rgba(9,18,32,0.76)",
    heroOverlayTo: "rgba(6,11,22,0.9)",
  },
};

const ACCENT_PALETTES = {
  sky: {
    from: "#2563eb",
    to: "#0ea5e9",
    contrast: "#ffffff",
    tint: "rgba(37,99,235,0.12)",
    border: "rgba(37,99,235,0.24)",
    softText: "#1d4ed8",
  },
  emerald: {
    from: "#059669",
    to: "#14b8a6",
    contrast: "#ffffff",
    tint: "rgba(5,150,105,0.12)",
    border: "rgba(5,150,105,0.24)",
    softText: "#047857",
  },
  rose: {
    from: "#e11d48",
    to: "#fb7185",
    contrast: "#ffffff",
    tint: "rgba(225,29,72,0.12)",
    border: "rgba(225,29,72,0.24)",
    softText: "#be123c",
  },
  violet: {
    from: "#7c3aed",
    to: "#8b5cf6",
    contrast: "#ffffff",
    tint: "rgba(124,58,237,0.12)",
    border: "rgba(124,58,237,0.24)",
    softText: "#6d28d9",
  },
};

const FONT_FAMILIES = {
  inter: "Inter, sans-serif",
  manrope: "Manrope, sans-serif",
  jakarta: "'Plus Jakarta Sans', sans-serif",
};

const BUTTON_RADIUS_CLASSNAMES = {
  square: "rounded-[16px]",
  rounded: "rounded-[24px]",
  pill: "rounded-full",
};

const BUTTON_ICON_RADIUS_CLASSNAMES = {
  square: "rounded-[14px]",
  rounded: "rounded-[18px]",
  pill: "rounded-full",
};

const MY_PAGE_DESIGN_KEYS = Object.keys(MY_PAGE_DESIGN_DEFAULTS);

function escapeCssUrl(value) {
  return String(value || "").replace(/["\\\n\r]/g, "\\$&");
}

function valueFromOptions(value, options, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return options.includes(normalized) ? normalized : fallback;
}

function isDesignShape(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return MY_PAGE_DESIGN_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(value, key),
  );
}

function resolveThemeSource(pageOrDesign = {}) {
  if (isDesignShape(pageOrDesign?.design)) {
    return {
      design: pageOrDesign.design,
      coverStyle: pageOrDesign?.coverStyle || pageOrDesign?.design?.themePreset,
      avatarUrl: pageOrDesign?.avatarUrl || "",
    };
  }

  if (isDesignShape(pageOrDesign)) {
    return {
      design: pageOrDesign,
      coverStyle: pageOrDesign?.coverStyle || pageOrDesign?.themePreset,
      avatarUrl: pageOrDesign?.avatarUrl || "",
    };
  }

  return {
    design: pageOrDesign?.design || {},
    coverStyle: pageOrDesign?.coverStyle || "ocean",
    avatarUrl: pageOrDesign?.avatarUrl || "",
  };
}

export function normalizeMyPageDesign(design = {}, coverStyle = "ocean") {
  const fallbackTheme = valueFromOptions(
    coverStyle,
    MY_PAGE_THEME_PRESET_OPTIONS.map((item) => item.value),
    MY_PAGE_DESIGN_DEFAULTS.themePreset,
  );

  return {
    themePreset: valueFromOptions(
      design?.themePreset,
      MY_PAGE_THEME_PRESET_OPTIONS.map((item) => item.value),
      fallbackTheme,
    ),
    brandLayout: valueFromOptions(
      design?.brandLayout,
      MY_PAGE_BRAND_LAYOUT_OPTIONS.map((item) => item.value),
      MY_PAGE_DESIGN_DEFAULTS.brandLayout,
    ),
    accentPalette: valueFromOptions(
      design?.accentPalette,
      MY_PAGE_ACCENT_PALETTE_OPTIONS.map((item) => item.value),
      MY_PAGE_DESIGN_DEFAULTS.accentPalette,
    ),
    backgroundStyle: valueFromOptions(
      design?.backgroundStyle,
      MY_PAGE_BACKGROUND_STYLE_OPTIONS.map((item) => item.value),
      MY_PAGE_DESIGN_DEFAULTS.backgroundStyle,
    ),
    fontPreset: valueFromOptions(
      design?.fontPreset,
      MY_PAGE_FONT_PRESET_OPTIONS.map((item) => item.value),
      MY_PAGE_DESIGN_DEFAULTS.fontPreset,
    ),
    buttonStyle: valueFromOptions(
      design?.buttonStyle,
      MY_PAGE_BUTTON_STYLE_OPTIONS.map((item) => item.value),
      MY_PAGE_DESIGN_DEFAULTS.buttonStyle,
    ),
    buttonRadius: valueFromOptions(
      design?.buttonRadius,
      MY_PAGE_BUTTON_RADIUS_OPTIONS.map((item) => item.value),
      MY_PAGE_DESIGN_DEFAULTS.buttonRadius,
    ),
  };
}

function buildBackground(theme, backgroundStyle) {
  if (backgroundStyle === "mesh") {
    return `radial-gradient(circle at 15% 20%, ${theme.ornamentA}, transparent 28%), radial-gradient(circle at 85% 18%, ${theme.ornamentB}, transparent 30%), radial-gradient(circle at 50% 92%, ${theme.ornamentC}, transparent 26%), linear-gradient(180deg, ${theme.pageFrom} 0%, ${theme.pageTo} 48%, ${theme.pageEnd} 100%)`;
  }
  if (backgroundStyle === "spotlight") {
    return `radial-gradient(circle at top, ${theme.ornamentA}, transparent 32%), radial-gradient(circle at 85% 72%, ${theme.ornamentB}, transparent 28%), linear-gradient(180deg, ${theme.pageFrom} 0%, ${theme.pageTo} 46%, ${theme.pageEnd} 100%)`;
  }
  return `radial-gradient(circle at top, ${theme.ornamentA}, transparent 30%), radial-gradient(circle at bottom right, ${theme.ornamentB}, transparent 26%), linear-gradient(180deg, ${theme.pageFrom} 0%, ${theme.pageTo} 46%, ${theme.pageEnd} 100%)`;
}

function buildHeroBackground(theme, backgroundStyle, imageUrl) {
  const safeUrl = escapeCssUrl(imageUrl);

  if (backgroundStyle === "mesh") {
    return `radial-gradient(circle at 15% 20%, ${theme.ornamentA}, transparent 28%), radial-gradient(circle at 85% 18%, ${theme.ornamentB}, transparent 30%), radial-gradient(circle at 50% 92%, ${theme.ornamentC}, transparent 26%), linear-gradient(180deg, ${theme.heroOverlayFrom} 0%, ${theme.heroOverlayTo} 100%), url("${safeUrl}") center/cover no-repeat fixed`;
  }

  if (backgroundStyle === "spotlight") {
    return `radial-gradient(circle at top, ${theme.ornamentA}, transparent 32%), radial-gradient(circle at 85% 72%, ${theme.ornamentB}, transparent 28%), linear-gradient(180deg, ${theme.heroOverlayFrom} 0%, ${theme.heroOverlayTo} 100%), url("${safeUrl}") center/cover no-repeat fixed`;
  }

  return `radial-gradient(circle at top, ${theme.ornamentA}, transparent 30%), radial-gradient(circle at bottom right, ${theme.ornamentB}, transparent 26%), linear-gradient(180deg, ${theme.heroOverlayFrom} 0%, ${theme.heroOverlayTo} 100%), url("${safeUrl}") center/cover no-repeat fixed`;
}

function buildHeroMediaStyle(theme, imageUrl) {
  const safeUrl = escapeCssUrl(imageUrl);
  return {
    borderColor: theme.strongBorder,
    backgroundImage: `linear-gradient(180deg, ${theme.heroOverlayFrom} 0%, rgba(15,23,42,0.12) 100%), url("${safeUrl}")`,
    backgroundPosition: "center",
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat",
    boxShadow: `0 26px 64px -40px ${theme.ornamentA}`,
  };
}

export function getMyPageTheme(pageOrDesign = {}) {
  const { design: rawDesign, coverStyle, avatarUrl: rawAvatarUrl } =
    resolveThemeSource(pageOrDesign);
  const avatarUrl = String(rawAvatarUrl || "").trim();
  const design = normalizeMyPageDesign(rawDesign || {}, coverStyle || "ocean");
  const preset = THEME_PRESETS[design.themePreset] || THEME_PRESETS.ocean;
  const accent = ACCENT_PALETTES[design.accentPalette] || ACCENT_PALETTES.sky;
  const fontFamily = FONT_FAMILIES[design.fontPreset] || FONT_FAMILIES.inter;
  const usesHeroLayout = design.brandLayout === "hero" && !!avatarUrl;

  const rootStyle = {
    minHeight: "100vh",
    background: usesHeroLayout
      ? buildHeroBackground(preset, design.backgroundStyle, avatarUrl)
      : buildBackground(preset, design.backgroundStyle),
    color: preset.text,
    fontFamily,
  };

  const surfaceStyle = {
    borderColor: preset.border,
    background: `linear-gradient(180deg, ${preset.surfaceFrom}, ${preset.surfaceTo})`,
    boxShadow: `0 28px 72px -44px ${accent.tint}`,
    fontFamily,
  };

  const softSurfaceStyle = {
    borderColor: preset.strongBorder,
    background: `linear-gradient(180deg, ${preset.softSurfaceFrom}, ${preset.softSurfaceTo})`,
    fontFamily,
  };

  const accentTextStyle = { color: accent.softText };
  const mutedTextStyle = { color: preset.muted };
  const dividerStyle = { borderColor: preset.border };
  const previewFrameStyle = {
    borderColor: preset.strongBorder,
    background: `linear-gradient(180deg, ${preset.surfaceFrom}, ${preset.softSurfaceTo})`,
    boxShadow: `0 26px 70px -42px ${accent.tint}`,
  };

  const secondaryButtonBase = {
    border: `1px solid ${preset.strongBorder}`,
    color: preset.text,
    background:
      design.buttonStyle === "outline"
        ? "rgba(255,255,255,0.04)"
        : `linear-gradient(180deg, ${preset.surfaceFrom}, ${preset.softSurfaceTo})`,
    fontFamily,
  };

  let primaryButtonStyle = {
    border: `1px solid ${accent.border}`,
    color: accent.contrast,
    background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
    boxShadow: `0 20px 44px -28px ${accent.tint}`,
    fontFamily,
  };

  if (design.buttonStyle === "soft") {
    primaryButtonStyle = {
      border: `1px solid ${accent.border}`,
      color: accent.softText,
      background: `linear-gradient(180deg, ${accent.tint}, rgba(255,255,255,0.94))`,
      boxShadow: `0 16px 36px -28px ${accent.tint}`,
      fontFamily,
    };
  }

  if (design.buttonStyle === "outline") {
    primaryButtonStyle = {
      border: `1px solid ${accent.border}`,
      color: accent.softText,
      background: "rgba(255,255,255,0.06)",
      boxShadow: "none",
      fontFamily,
    };
  }

  return {
    design,
    usesHeroLayout,
    preset,
    accent,
    fontFamily,
    buttonRadiusClassName:
      BUTTON_RADIUS_CLASSNAMES[design.buttonRadius] ||
      BUTTON_RADIUS_CLASSNAMES.rounded,
    buttonIconRadiusClassName:
      BUTTON_ICON_RADIUS_CLASSNAMES[design.buttonRadius] ||
      BUTTON_ICON_RADIUS_CLASSNAMES.rounded,
    rootStyle,
    heroMediaStyle: usesHeroLayout
      ? buildHeroMediaStyle(preset, avatarUrl)
      : null,
    surfaceStyle,
    softSurfaceStyle,
    accentTextStyle,
    mutedTextStyle,
    dividerStyle,
    previewFrameStyle,
    inputStyle: {
      background: preset.inputBg,
      borderColor: preset.border,
      color: preset.text,
      fontFamily,
    },
    primaryButtonStyle,
    secondaryButtonStyle: secondaryButtonBase,
    activeCardStyle: {
      borderColor: accent.border,
      background: `linear-gradient(180deg, ${accent.tint}, rgba(255,255,255,0.94))`,
      fontFamily,
    },
  };
}

export function getMyPageButtonProps(theme, variant = "primary") {
  const style =
    variant === "primary"
      ? theme.primaryButtonStyle
      : theme.secondaryButtonStyle;

  return {
    className: [
      "inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition duration-200 hover:-translate-y-[1px] hover:brightness-[1.02]",
      theme?.buttonRadiusClassName || BUTTON_RADIUS_CLASSNAMES.rounded,
      variant === "secondary" ? "shadow-none" : "",
    ].join(" "),
    style,
  };
}

export function getMyPageSurfaceProps(theme, variant = "default") {
  return {
    className: "rounded-[30px] border p-5 sm:p-6",
    style: variant === "soft" ? theme.softSurfaceStyle : theme.surfaceStyle,
  };
}

export function getMyPageSelectableCardProps(theme, active = false) {
  return {
    className: "rounded-[24px] border px-4 py-4 text-left transition",
    style: active ? theme.activeCardStyle : theme.softSurfaceStyle,
  };
}
