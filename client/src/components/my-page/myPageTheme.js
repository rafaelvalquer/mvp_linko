export const MY_PAGE_DESIGN_DEFAULTS = {
  themePreset: "clean_light",
  brandLayout: "classic",
  accentPalette: "sky",
  backgroundStyle: "halo",
  fontPreset: "inter",
  buttonStyle: "solid",
  buttonRadius: "rounded",
  secondaryLinksStyle: "text",
};

export const MY_PAGE_THEME_PRESET_OPTIONS = [
  {
    value: "premium_dark",
    label: "Premium Dark",
    description: "Fintech escuro e sofisticado.",
  },
  {
    value: "clean_light",
    label: "Clean Light",
    description: "Claro, minimo e elegante.",
  },
  {
    value: "creator_gradient",
    label: "Creator Gradient",
    description: "Visual social e chamativo.",
  },
  {
    value: "business_storefront",
    label: "Business Storefront",
    description: "Mini vitrine comercial.",
  },
  {
    value: "editorial_luxury",
    label: "Editorial Luxury",
    description: "Marca premium e refinada.",
  },
  {
    value: "bold_conversion",
    label: "Bold Conversion",
    description: "Foco total em clique e acao.",
  },
  {
    value: "agate",
    label: "Agate",
    description: "Mineral moderno e elegante.",
  },
  {
    value: "air",
    label: "Air",
    description: "Claro, leve e arejado.",
  },
  {
    value: "aura",
    label: "Aura",
    description: "Lavanda vibrante e criativa.",
  },
  {
    value: "blocks",
    label: "Blocks",
    description: "Geometrico e comercial.",
  },
  {
    value: "twilight",
    label: "Twilight",
    description: "Roxo noturno sofisticado.",
  },
  {
    value: "vox",
    label: "Vox",
    description: "Editorial escuro com energia forte.",
  },
  {
    value: "cobalt_blaze",
    label: "Cobalt Blaze",
    description: "Azul vibrante com topo quente e pop.",
  },
  {
    value: "violet_punch",
    label: "Violet Punch",
    description: "Roxo eletrico com presenca social.",
  },
  {
    value: "solar_pop",
    label: "Solar Pop",
    description: "Mistura vibrante de amarelo, teal e coral.",
  },
  {
    value: "midnight_prism",
    label: "Midnight Prism",
    description: "Escuro premium com brilho neon.",
  },
];

export const MY_PAGE_ACCENT_PALETTE_OPTIONS = [
  { value: "sky", label: "Azul", swatch: "#2563eb" },
  { value: "emerald", label: "Verde", swatch: "#059669" },
  { value: "rose", label: "Rose", swatch: "#e11d48" },
  { value: "violet", label: "Violeta", swatch: "#7c3aed" },
  { value: "amber", label: "Dourado", swatch: "#d97706" },
  { value: "teal", label: "Teal", swatch: "#0f766e" },
  { value: "coral", label: "Coral", swatch: "#f97316" },
  { value: "slate", label: "Slate", swatch: "#334155" },
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
  { value: "velvet", label: "Velvet", description: "Profundo e premium." },
  { value: "grid", label: "Grid", description: "Geometrico." },
  { value: "bloom", label: "Bloom", description: "Brilho artistico." },
];

export const MY_PAGE_FONT_PRESET_OPTIONS = [
  { value: "inter", label: "Inter", family: "Inter, sans-serif" },
  { value: "manrope", label: "Manrope", family: "Manrope, sans-serif" },
  {
    value: "jakarta",
    label: "Jakarta",
    family: "'Plus Jakarta Sans', sans-serif",
  },
  {
    value: "editorial",
    label: "Editorial",
    family: "Georgia, 'Times New Roman', serif",
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

export const MY_PAGE_SECONDARY_LINK_STYLE_OPTIONS = [
  { value: "text", label: "Texto", description: "Mostra so o nome." },
  { value: "icon", label: "Icone", description: "Mostra so o icone." },
  {
    value: "icon_text",
    label: "Icone + texto",
    description: "Mostra o icone com o nome.",
  },
];

const THEME_PRESETS = {
  premium_dark: {
    defaults: {
      accentPalette: "teal",
      backgroundStyle: "velvet",
      fontPreset: "manrope",
      buttonStyle: "solid",
    },
    pageFrom: "#040916",
    pageTo: "#0b1220",
    pageEnd: "#070d18",
    text: "#f8fafc",
    muted: "#9fb0c8",
    surfaceFrom: "rgba(8,15,29,0.92)",
    surfaceTo: "rgba(15,23,42,0.78)",
    softSurfaceFrom: "rgba(13,21,36,0.82)",
    softSurfaceTo: "rgba(9,16,29,0.58)",
    border: "rgba(148,163,184,0.18)",
    strongBorder: "rgba(16,185,129,0.28)",
    ornamentA: "rgba(16,185,129,0.16)",
    ornamentB: "rgba(30,64,175,0.22)",
    ornamentC: "rgba(13,148,136,0.18)",
    inputBg: "rgba(5,12,24,0.74)",
    heroOverlayFrom: "rgba(4,9,22,0.66)",
    heroOverlayTo: "rgba(7,13,24,0.86)",
    accentFrom: "#0f766e",
    accentTo: "#10b981",
    accentContrast: "#ecfeff",
    accentTint: "rgba(16,185,129,0.26)",
    accentBorder: "rgba(45,212,191,0.24)",
    accentText: "#99f6e4",
    bodyFontFamily: "Manrope, sans-serif",
    headingFontFamily: "'Plus Jakarta Sans', sans-serif",
    buttonMode: "glow",
  },
  clean_light: {
    defaults: {
      accentPalette: "slate",
      backgroundStyle: "halo",
      fontPreset: "inter",
      buttonStyle: "solid",
    },
    pageFrom: "#fcfdff",
    pageTo: "#f6f8fb",
    pageEnd: "#ffffff",
    text: "#0f172a",
    muted: "#64748b",
    surfaceFrom: "rgba(255,255,255,0.98)",
    surfaceTo: "rgba(248,250,252,0.92)",
    softSurfaceFrom: "rgba(255,255,255,0.92)",
    softSurfaceTo: "rgba(244,247,250,0.86)",
    border: "rgba(148,163,184,0.2)",
    strongBorder: "rgba(15,23,42,0.1)",
    ornamentA: "rgba(37,99,235,0.06)",
    ornamentB: "rgba(56,189,248,0.06)",
    ornamentC: "rgba(99,102,241,0.05)",
    inputBg: "rgba(255,255,255,0.98)",
    heroOverlayFrom: "rgba(252,253,255,0.78)",
    heroOverlayTo: "rgba(255,255,255,0.94)",
    accentFrom: "#0f172a",
    accentTo: "#334155",
    accentContrast: "#ffffff",
    accentTint: "rgba(15,23,42,0.12)",
    accentBorder: "rgba(15,23,42,0.16)",
    accentText: "#0f172a",
    bodyFontFamily: "Inter, sans-serif",
    headingFontFamily: "Inter, sans-serif",
    buttonMode: "midnight",
  },
  creator_gradient: {
    defaults: {
      accentPalette: "violet",
      backgroundStyle: "mesh",
      fontPreset: "jakarta",
      buttonStyle: "solid",
    },
    pageFrom: "#fff5fe",
    pageTo: "#eef4ff",
    pageEnd: "#fffaf5",
    text: "#2a1638",
    muted: "#6e5b7d",
    surfaceFrom: "rgba(255,255,255,0.92)",
    surfaceTo: "rgba(250,245,255,0.78)",
    softSurfaceFrom: "rgba(255,255,255,0.84)",
    softSurfaceTo: "rgba(239,246,255,0.7)",
    border: "rgba(192,132,252,0.26)",
    strongBorder: "rgba(236,72,153,0.26)",
    ornamentA: "rgba(124,58,237,0.18)",
    ornamentB: "rgba(236,72,153,0.14)",
    ornamentC: "rgba(59,130,246,0.14)",
    inputBg: "rgba(255,255,255,0.9)",
    heroOverlayFrom: "rgba(255,245,254,0.62)",
    heroOverlayTo: "rgba(238,244,255,0.84)",
    accentFrom: "#7c3aed",
    accentTo: "#ec4899",
    accentContrast: "#ffffff",
    accentTint: "rgba(124,58,237,0.2)",
    accentBorder: "rgba(192,132,252,0.3)",
    accentText: "#7c3aed",
    bodyFontFamily: "'Plus Jakarta Sans', sans-serif",
    headingFontFamily: "'Plus Jakarta Sans', sans-serif",
    buttonMode: "gradient",
  },
  business_storefront: {
    defaults: {
      accentPalette: "emerald",
      backgroundStyle: "grid",
      fontPreset: "manrope",
      buttonStyle: "solid",
    },
    pageFrom: "#f6fbff",
    pageTo: "#f0fdf4",
    pageEnd: "#ffffff",
    text: "#0f172a",
    muted: "#4b5563",
    surfaceFrom: "rgba(255,255,255,0.98)",
    surfaceTo: "rgba(240,253,244,0.92)",
    softSurfaceFrom: "rgba(255,255,255,0.92)",
    softSurfaceTo: "rgba(236,253,245,0.82)",
    border: "rgba(16,185,129,0.18)",
    strongBorder: "rgba(5,150,105,0.26)",
    ornamentA: "rgba(16,185,129,0.1)",
    ornamentB: "rgba(14,165,233,0.08)",
    ornamentC: "rgba(245,158,11,0.08)",
    inputBg: "rgba(255,255,255,0.96)",
    heroOverlayFrom: "rgba(246,251,255,0.72)",
    heroOverlayTo: "rgba(255,255,255,0.9)",
    accentFrom: "#059669",
    accentTo: "#14b8a6",
    accentContrast: "#f0fdfa",
    accentTint: "rgba(5,150,105,0.18)",
    accentBorder: "rgba(5,150,105,0.24)",
    accentText: "#047857",
    bodyFontFamily: "Manrope, sans-serif",
    headingFontFamily: "Manrope, sans-serif",
    buttonMode: "store",
  },
  editorial_luxury: {
    defaults: {
      accentPalette: "amber",
      backgroundStyle: "spotlight",
      fontPreset: "editorial",
      buttonStyle: "outline",
    },
    pageFrom: "#fffaf5",
    pageTo: "#f8f3ec",
    pageEnd: "#ffffff",
    text: "#2f2117",
    muted: "#786454",
    surfaceFrom: "rgba(255,250,245,0.98)",
    surfaceTo: "rgba(251,246,240,0.94)",
    softSurfaceFrom: "rgba(255,250,245,0.9)",
    softSurfaceTo: "rgba(246,239,231,0.84)",
    border: "rgba(180,144,112,0.18)",
    strongBorder: "rgba(161,98,7,0.22)",
    ornamentA: "rgba(161,98,7,0.1)",
    ornamentB: "rgba(120,84,58,0.08)",
    ornamentC: "rgba(251,191,36,0.08)",
    inputBg: "rgba(255,252,248,0.96)",
    heroOverlayFrom: "rgba(255,250,245,0.74)",
    heroOverlayTo: "rgba(248,243,236,0.9)",
    accentFrom: "#7c2d12",
    accentTo: "#b45309",
    accentContrast: "#fffdf7",
    accentTint: "rgba(180,83,9,0.16)",
    accentBorder: "rgba(180,83,9,0.2)",
    accentText: "#8a5a2b",
    bodyFontFamily: "Inter, sans-serif",
    headingFontFamily: "Georgia, 'Times New Roman', serif",
    buttonMode: "luxury",
  },
  bold_conversion: {
    defaults: {
      accentPalette: "coral",
      backgroundStyle: "spotlight",
      fontPreset: "manrope",
      buttonStyle: "solid",
    },
    pageFrom: "#fff7ed",
    pageTo: "#ffedd5",
    pageEnd: "#ffffff",
    text: "#111827",
    muted: "#5b6476",
    surfaceFrom: "rgba(255,255,255,0.98)",
    surfaceTo: "rgba(255,247,237,0.94)",
    softSurfaceFrom: "rgba(255,255,255,0.92)",
    softSurfaceTo: "rgba(255,237,213,0.82)",
    border: "rgba(249,115,22,0.16)",
    strongBorder: "rgba(234,88,12,0.22)",
    ornamentA: "rgba(234,88,12,0.12)",
    ornamentB: "rgba(239,68,68,0.08)",
    ornamentC: "rgba(245,158,11,0.1)",
    inputBg: "rgba(255,255,255,0.96)",
    heroOverlayFrom: "rgba(255,247,237,0.74)",
    heroOverlayTo: "rgba(255,255,255,0.9)",
    accentFrom: "#ea580c",
    accentTo: "#ef4444",
    accentContrast: "#fff7ed",
    accentTint: "rgba(234,88,12,0.22)",
    accentBorder: "rgba(249,115,22,0.28)",
    accentText: "#c2410c",
    bodyFontFamily: "Manrope, sans-serif",
    headingFontFamily: "Manrope, sans-serif",
    buttonMode: "conversion",
  },
  agate: {
    defaults: {
      accentPalette: "teal",
      backgroundStyle: "mesh",
      fontPreset: "jakarta",
      buttonStyle: "soft",
    },
    pageFrom: "#eef7f1",
    pageTo: "#f7fbf8",
    pageEnd: "#ffffff",
    text: "#19332c",
    muted: "#5c726c",
    surfaceFrom: "rgba(255,255,255,0.96)",
    surfaceTo: "rgba(240,248,244,0.92)",
    softSurfaceFrom: "rgba(255,255,255,0.9)",
    softSurfaceTo: "rgba(233,245,239,0.82)",
    border: "rgba(16,124,98,0.16)",
    strongBorder: "rgba(13,148,136,0.18)",
    ornamentA: "rgba(16,124,98,0.08)",
    ornamentB: "rgba(59,130,246,0.05)",
    ornamentC: "rgba(148,163,184,0.08)",
    inputBg: "rgba(255,255,255,0.96)",
    heroOverlayFrom: "rgba(238,247,241,0.58)",
    heroOverlayTo: "rgba(255,255,255,0.88)",
    accentFrom: "#0f766e",
    accentTo: "#14b8a6",
    accentContrast: "#ecfeff",
    accentTint: "rgba(15,118,110,0.18)",
    accentBorder: "rgba(45,212,191,0.24)",
    accentText: "#0f766e",
    bodyFontFamily: "'Plus Jakarta Sans', sans-serif",
    headingFontFamily: "'Plus Jakarta Sans', sans-serif",
    buttonMode: "soft",
  },
  air: {
    defaults: {
      accentPalette: "sky",
      backgroundStyle: "halo",
      fontPreset: "inter",
      buttonStyle: "outline",
    },
    pageFrom: "#f8fcff",
    pageTo: "#f3f9ff",
    pageEnd: "#ffffff",
    text: "#112033",
    muted: "#708198",
    surfaceFrom: "rgba(255,255,255,0.98)",
    surfaceTo: "rgba(247,251,255,0.94)",
    softSurfaceFrom: "rgba(255,255,255,0.94)",
    softSurfaceTo: "rgba(240,248,255,0.88)",
    border: "rgba(96,165,250,0.16)",
    strongBorder: "rgba(14,165,233,0.16)",
    ornamentA: "rgba(125,211,252,0.08)",
    ornamentB: "rgba(255,255,255,0.8)",
    ornamentC: "rgba(226,232,240,0.48)",
    inputBg: "rgba(255,255,255,0.98)",
    heroOverlayFrom: "rgba(248,252,255,0.52)",
    heroOverlayTo: "rgba(255,255,255,0.9)",
    accentFrom: "#2563eb",
    accentTo: "#0ea5e9",
    accentContrast: "#eff6ff",
    accentTint: "rgba(37,99,235,0.16)",
    accentBorder: "rgba(59,130,246,0.22)",
    accentText: "#2563eb",
    bodyFontFamily: "Inter, sans-serif",
    headingFontFamily: "Inter, sans-serif",
    buttonMode: "outline",
  },
  aura: {
    defaults: {
      accentPalette: "violet",
      backgroundStyle: "bloom",
      fontPreset: "jakarta",
      buttonStyle: "soft",
    },
    pageFrom: "#f9f4ff",
    pageTo: "#f3efff",
    pageEnd: "#ffffff",
    text: "#2d1b45",
    muted: "#726284",
    surfaceFrom: "rgba(255,255,255,0.94)",
    surfaceTo: "rgba(247,241,255,0.86)",
    softSurfaceFrom: "rgba(255,255,255,0.88)",
    softSurfaceTo: "rgba(240,235,255,0.8)",
    border: "rgba(167,139,250,0.2)",
    strongBorder: "rgba(139,92,246,0.22)",
    ornamentA: "rgba(139,92,246,0.1)",
    ornamentB: "rgba(236,72,153,0.08)",
    ornamentC: "rgba(96,165,250,0.08)",
    inputBg: "rgba(255,255,255,0.94)",
    heroOverlayFrom: "rgba(249,244,255,0.5)",
    heroOverlayTo: "rgba(255,255,255,0.86)",
    accentFrom: "#7c3aed",
    accentTo: "#a855f7",
    accentContrast: "#faf5ff",
    accentTint: "rgba(124,58,237,0.18)",
    accentBorder: "rgba(139,92,246,0.24)",
    accentText: "#7c3aed",
    bodyFontFamily: "'Plus Jakarta Sans', sans-serif",
    headingFontFamily: "'Plus Jakarta Sans', sans-serif",
    buttonMode: "soft",
  },
  blocks: {
    defaults: {
      accentPalette: "coral",
      backgroundStyle: "grid",
      fontPreset: "manrope",
      buttonStyle: "solid",
    },
    pageFrom: "#fff8f2",
    pageTo: "#fffdf9",
    pageEnd: "#ffffff",
    text: "#1f2937",
    muted: "#64748b",
    surfaceFrom: "rgba(255,255,255,0.98)",
    surfaceTo: "rgba(255,248,242,0.94)",
    softSurfaceFrom: "rgba(255,255,255,0.92)",
    softSurfaceTo: "rgba(255,241,230,0.84)",
    border: "rgba(249,115,22,0.16)",
    strongBorder: "rgba(37,99,235,0.16)",
    ornamentA: "rgba(249,115,22,0.08)",
    ornamentB: "rgba(37,99,235,0.06)",
    ornamentC: "rgba(234,179,8,0.06)",
    inputBg: "rgba(255,255,255,0.96)",
    heroOverlayFrom: "rgba(255,248,242,0.56)",
    heroOverlayTo: "rgba(255,255,255,0.88)",
    accentFrom: "#ea580c",
    accentTo: "#f97316",
    accentContrast: "#fff7ed",
    accentTint: "rgba(249,115,22,0.18)",
    accentBorder: "rgba(249,115,22,0.24)",
    accentText: "#ea580c",
    bodyFontFamily: "Manrope, sans-serif",
    headingFontFamily: "Manrope, sans-serif",
    buttonMode: "conversion",
  },
  twilight: {
    defaults: {
      accentPalette: "violet",
      backgroundStyle: "velvet",
      fontPreset: "editorial",
      buttonStyle: "outline",
    },
    pageFrom: "#120b24",
    pageTo: "#1a1735",
    pageEnd: "#0a1329",
    text: "#f8fafc",
    muted: "#c2bdd8",
    surfaceFrom: "rgba(22,19,44,0.92)",
    surfaceTo: "rgba(15,23,42,0.78)",
    softSurfaceFrom: "rgba(26,23,53,0.82)",
    softSurfaceTo: "rgba(15,23,42,0.62)",
    border: "rgba(167,139,250,0.18)",
    strongBorder: "rgba(129,140,248,0.2)",
    ornamentA: "rgba(139,92,246,0.16)",
    ornamentB: "rgba(79,70,229,0.14)",
    ornamentC: "rgba(56,189,248,0.12)",
    inputBg: "rgba(15,23,42,0.72)",
    heroOverlayFrom: "rgba(18,11,36,0.42)",
    heroOverlayTo: "rgba(10,19,41,0.8)",
    accentFrom: "#7c3aed",
    accentTo: "#a855f7",
    accentContrast: "#faf5ff",
    accentTint: "rgba(124,58,237,0.18)",
    accentBorder: "rgba(139,92,246,0.24)",
    accentText: "#e9d5ff",
    bodyFontFamily: "Inter, sans-serif",
    headingFontFamily: "Georgia, 'Times New Roman', serif",
    buttonMode: "outline",
  },
  vox: {
    defaults: {
      accentPalette: "rose",
      backgroundStyle: "spotlight",
      fontPreset: "manrope",
      buttonStyle: "solid",
    },
    pageFrom: "#0b1220",
    pageTo: "#111827",
    pageEnd: "#020617",
    text: "#f8fafc",
    muted: "#b6c2d2",
    surfaceFrom: "rgba(15,23,42,0.94)",
    surfaceTo: "rgba(17,24,39,0.82)",
    softSurfaceFrom: "rgba(17,24,39,0.84)",
    softSurfaceTo: "rgba(15,23,42,0.66)",
    border: "rgba(244,114,182,0.16)",
    strongBorder: "rgba(59,130,246,0.16)",
    ornamentA: "rgba(244,114,182,0.14)",
    ornamentB: "rgba(59,130,246,0.12)",
    ornamentC: "rgba(15,23,42,0.28)",
    inputBg: "rgba(15,23,42,0.74)",
    heroOverlayFrom: "rgba(11,18,32,0.44)",
    heroOverlayTo: "rgba(2,6,23,0.82)",
    accentFrom: "#e11d48",
    accentTo: "#f43f5e",
    accentContrast: "#fff1f2",
    accentTint: "rgba(225,29,72,0.18)",
    accentBorder: "rgba(244,63,94,0.24)",
    accentText: "#fecdd3",
    bodyFontFamily: "Manrope, sans-serif",
    headingFontFamily: "Manrope, sans-serif",
    buttonMode: "glow",
  },
  cobalt_blaze: {
    defaults: {
      accentPalette: "sky",
      backgroundStyle: "bloom",
      fontPreset: "jakarta",
      buttonStyle: "solid",
    },
    pageFrom: "#fff0c2",
    pageTo: "#4c86ff",
    pageEnd: "#2459dd",
    text: "#f8fbff",
    muted: "#d9e7ff",
    surfaceFrom: "rgba(255,255,255,0.24)",
    surfaceTo: "rgba(129,179,255,0.2)",
    softSurfaceFrom: "rgba(255,255,255,0.18)",
    softSurfaceTo: "rgba(112,164,255,0.16)",
    border: "rgba(255,255,255,0.22)",
    strongBorder: "rgba(191,219,254,0.42)",
    ornamentA: "rgba(255,255,255,0.22)",
    ornamentB: "rgba(59,130,246,0.22)",
    ornamentC: "rgba(14,165,233,0.18)",
    inputBg: "rgba(255,255,255,0.18)",
    heroOverlayFrom: "rgba(255,239,194,0.24)",
    heroOverlayTo: "rgba(36,89,221,0.72)",
    accentFrom: "#60a5fa",
    accentTo: "#93c5fd",
    accentContrast: "#102a6b",
    accentTint: "rgba(96,165,250,0.24)",
    accentBorder: "rgba(191,219,254,0.34)",
    accentText: "#eef6ff",
    bodyFontFamily: "'Plus Jakarta Sans', sans-serif",
    headingFontFamily: "'Plus Jakarta Sans', sans-serif",
    buttonMode: "gradient",
  },
  violet_punch: {
    defaults: {
      accentPalette: "violet",
      backgroundStyle: "mesh",
      fontPreset: "jakarta",
      buttonStyle: "solid",
    },
    pageFrom: "#9a34ff",
    pageTo: "#7c2cff",
    pageEnd: "#5e1ae8",
    text: "#fdfcff",
    muted: "#f0d9ff",
    surfaceFrom: "rgba(255,255,255,0.2)",
    surfaceTo: "rgba(255,255,255,0.1)",
    softSurfaceFrom: "rgba(255,255,255,0.1)",
    softSurfaceTo: "rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.2)",
    strongBorder: "rgba(244,114,182,0.45)",
    ornamentA: "rgba(236,72,153,0.24)",
    ornamentB: "rgba(168,85,247,0.26)",
    ornamentC: "rgba(255,255,255,0.08)",
    inputBg: "rgba(255,255,255,0.12)",
    heroOverlayFrom: "rgba(154,52,255,0.18)",
    heroOverlayTo: "rgba(94,26,232,0.7)",
    accentFrom: "#d946ef",
    accentTo: "#fb7185",
    accentContrast: "#ffffff",
    accentTint: "rgba(217,70,239,0.24)",
    accentBorder: "rgba(244,114,182,0.34)",
    accentText: "#fff1ff",
    bodyFontFamily: "'Plus Jakarta Sans', sans-serif",
    headingFontFamily: "'Plus Jakarta Sans', sans-serif",
    buttonMode: "gradient",
  },
  solar_pop: {
    defaults: {
      accentPalette: "coral",
      backgroundStyle: "bloom",
      fontPreset: "manrope",
      buttonStyle: "solid",
    },
    pageFrom: "#ffe37a",
    pageTo: "#32b2cf",
    pageEnd: "#0f5ec4",
    text: "#f8fbff",
    muted: "#e7f3ff",
    surfaceFrom: "rgba(255,255,255,0.24)",
    surfaceTo: "rgba(76,201,240,0.14)",
    softSurfaceFrom: "rgba(255,255,255,0.16)",
    softSurfaceTo: "rgba(34,197,94,0.08)",
    border: "rgba(255,255,255,0.22)",
    strongBorder: "rgba(251,146,60,0.34)",
    ornamentA: "rgba(34,197,94,0.18)",
    ornamentB: "rgba(249,115,22,0.18)",
    ornamentC: "rgba(14,165,233,0.16)",
    inputBg: "rgba(255,255,255,0.18)",
    heroOverlayFrom: "rgba(255,227,122,0.2)",
    heroOverlayTo: "rgba(15,94,196,0.68)",
    accentFrom: "#fb923c",
    accentTo: "#f97316",
    accentContrast: "#fff7ed",
    accentTint: "rgba(251,146,60,0.22)",
    accentBorder: "rgba(253,186,116,0.28)",
    accentText: "#fff7ed",
    bodyFontFamily: "Manrope, sans-serif",
    headingFontFamily: "Manrope, sans-serif",
    buttonMode: "conversion",
  },
  midnight_prism: {
    defaults: {
      accentPalette: "violet",
      backgroundStyle: "velvet",
      fontPreset: "manrope",
      buttonStyle: "soft",
    },
    pageFrom: "#040816",
    pageTo: "#0b1533",
    pageEnd: "#120624",
    text: "#f8fafc",
    muted: "#c7d5f5",
    surfaceFrom: "rgba(10,18,38,0.86)",
    surfaceTo: "rgba(20,17,46,0.72)",
    softSurfaceFrom: "rgba(255,255,255,0.08)",
    softSurfaceTo: "rgba(96,165,250,0.08)",
    border: "rgba(96,165,250,0.16)",
    strongBorder: "rgba(168,85,247,0.28)",
    ornamentA: "rgba(59,130,246,0.18)",
    ornamentB: "rgba(168,85,247,0.18)",
    ornamentC: "rgba(20,184,166,0.14)",
    inputBg: "rgba(10,18,38,0.74)",
    heroOverlayFrom: "rgba(4,8,22,0.34)",
    heroOverlayTo: "rgba(18,6,36,0.78)",
    accentFrom: "#60a5fa",
    accentTo: "#8b5cf6",
    accentContrast: "#eff6ff",
    accentTint: "rgba(96,165,250,0.18)",
    accentBorder: "rgba(129,140,248,0.24)",
    accentText: "#dbeafe",
    bodyFontFamily: "Manrope, sans-serif",
    headingFontFamily: "Manrope, sans-serif",
    buttonMode: "glow",
  },
};

const FONT_FAMILIES = {
  inter: "Inter, sans-serif",
  manrope: "Manrope, sans-serif",
  jakarta: "'Plus Jakarta Sans', sans-serif",
  editorial: "Georgia, 'Times New Roman', serif",
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

const LEGACY_THEME_PRESET_MAP = {
  ocean: "clean_light",
  sunset: "creator_gradient",
  graphite: "premium_dark",
};

const BASE_LAYOUT = {
  surfaceClassName: "rounded-[32px] border p-5 sm:p-6",
  softSurfaceClassName: "rounded-[26px] border p-4",
  selectableCardClassName: "rounded-[24px] border px-4 py-4 text-left transition",
  buttonBaseClassName:
    "inline-flex items-center justify-center gap-2 border transition duration-200 hover:-translate-y-[1px] hover:brightness-[1.02]",
  buttonPaddingClassName: "px-5 py-3.5",
  buttonTextClassName: "text-sm font-semibold",
  pageMaxWidthClassName: "max-w-5xl",
  homeMaxWidthClassName: "max-w-[560px]",
  screenGapClassName: "space-y-6",
  heroCentered: true,
  heroSectionClassName: "space-y-5",
  heroMediaHeightClassName: "h-[200px] sm:h-[220px]",
  heroContainerClassName: "space-y-5",
  heroCopyClassName: "flex min-w-0 flex-col items-center gap-4",
  heroTextWrapClassName: "min-w-0",
  heroTextAlignClassName: "items-center text-center",
  heroActionsClassName: "flex flex-wrap items-center justify-center gap-3",
  heroDescriptionMaxClassName: "max-w-[34ch]",
  heroAvatarSizeClassName: "h-24 w-24 rounded-full",
  heroAvatarIconSizeClassName: "h-10 w-10",
  heroTitleClassName: "mt-4 text-[2.35rem] font-black tracking-[-0.06em]",
  homeShellClassName: "flex min-h-[calc(100vh-3rem)] items-center justify-center",
  homeCardClassName: "w-full p-5 sm:p-7",
  homeHeaderClassName: "flex flex-col items-center text-center",
  homeTitleClassName: "mt-4 text-[2.35rem] font-black tracking-[-0.06em]",
  homeDescriptionClassName: "mt-3 max-w-[34ch] text-sm leading-7",
  homeButtonsClassName: "mt-7 space-y-3",
  homeButtonClassName:
    "flex w-full items-center justify-between gap-4 px-5 py-4 text-left",
  homeSecondaryLinksClassName: "mt-6 flex flex-wrap justify-center gap-2",
  homePrimaryAll: false,
  homeHighlightFirst: false,
  catalogGridClassName: "grid gap-4 md:grid-cols-2 xl:grid-cols-3",
  catalogCardClassName: "flex h-full flex-col",
  catalogImageWrapClassName:
    "mb-4 flex h-44 items-center justify-center overflow-hidden rounded-[24px] border",
  catalogImageClassName: "h-full w-full object-cover",
  catalogActionsClassName: "mt-5 flex items-center justify-between gap-3",
  formLayoutClassName: "grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]",
  formCardClassName: "",
  summaryCardClassName: "lg:sticky lg:top-6",
  payActionsClassName: "flex flex-col gap-3 sm:flex-row",
  previewDeviceClassName: "max-w-[430px]",
  previewCardClassName: "p-5",
  previewHeaderClassName: "flex flex-col items-center text-center gap-3",
  previewTitleClassName: "mt-3 text-lg font-black tracking-[-0.05em]",
  previewDescriptionClassName: "mt-2 text-xs leading-5",
  previewButtonsClassName: "space-y-2.5",
  previewMediaHeightClassName: "h-28",
};

const LAYOUT_PROFILES = {
  premium_dark: {
    surfaceClassName: "rounded-[34px] border p-6 sm:p-7",
    softSurfaceClassName: "rounded-[28px] border p-4",
    buttonPaddingClassName: "px-5 py-3.5",
    homeHighlightFirst: true,
    homeCardClassName: "w-full p-6 sm:p-8",
    catalogImageWrapClassName:
      "mb-4 flex h-48 items-center justify-center overflow-hidden rounded-[28px] border",
    previewTitleClassName: "mt-3 text-xl font-black tracking-[-0.05em]",
    previewButtonsClassName: "space-y-2.5",
  },
  clean_light: {
    surfaceClassName: "rounded-[36px] border p-6 sm:p-8",
    softSurfaceClassName: "rounded-[28px] border p-4",
    pageMaxWidthClassName: "max-w-5xl",
    homeMaxWidthClassName: "max-w-3xl",
    heroCentered: true,
    heroContainerClassName: "space-y-5",
    heroCopyClassName: "flex flex-col items-center gap-4",
    heroTextAlignClassName: "items-center text-center",
    heroActionsClassName: "flex flex-wrap items-center justify-center gap-3",
    heroDescriptionMaxClassName: "max-w-[36ch]",
    heroAvatarSizeClassName: "h-24 w-24 rounded-full",
    heroAvatarIconSizeClassName: "h-10 w-10",
    homeShellClassName: "flex min-h-[calc(100vh-3rem)] items-center justify-center",
    homeCardClassName: "w-full p-6 sm:p-10",
    homeHeaderClassName: "flex flex-col items-center text-center",
    homeDescriptionClassName: "mt-4 max-w-[32ch] text-sm leading-7",
    homeButtonsClassName: "mt-8 space-y-4",
    homeSecondaryLinksClassName: "mt-7 flex flex-wrap justify-center gap-2",
    catalogGridClassName: "grid gap-5 md:grid-cols-2",
    formLayoutClassName: "grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]",
    previewHeaderClassName: "flex flex-col items-center text-center",
    previewButtonsClassName: "space-y-3",
  },
  creator_gradient: {
    surfaceClassName: "rounded-[34px] border p-5 sm:p-7",
    softSurfaceClassName: "rounded-[28px] border p-4",
    pageMaxWidthClassName: "max-w-5xl",
    homeMaxWidthClassName: "max-w-4xl",
    heroCentered: true,
    heroMediaHeightClassName: "h-[220px] sm:h-[280px]",
    heroContainerClassName: "space-y-5",
    heroCopyClassName: "flex flex-col items-center gap-4",
    heroTextAlignClassName: "items-center text-center",
    heroActionsClassName: "flex flex-wrap items-center justify-center gap-3",
    heroDescriptionMaxClassName: "max-w-[38ch]",
    heroAvatarSizeClassName: "h-24 w-24 rounded-full",
    heroAvatarIconSizeClassName: "h-10 w-10",
    homeShellClassName: "flex min-h-[calc(100vh-3rem)] items-center justify-center",
    homeCardClassName: "w-full p-5 sm:p-8",
    homeHeaderClassName: "flex flex-col items-center text-center",
    homeTitleClassName: "mt-4 text-[2.35rem] font-black tracking-[-0.06em]",
    homeDescriptionClassName: "mt-3 max-w-[34ch] text-sm leading-7",
    homeButtonsClassName: "mt-7 grid gap-3",
    homeButtonClassName:
      "flex w-full items-center justify-between gap-4 px-5 py-[18px] text-left",
    homeSecondaryLinksClassName: "mt-6 flex flex-wrap justify-center gap-2",
    homePrimaryAll: true,
    catalogImageWrapClassName:
      "mb-4 flex h-48 items-center justify-center overflow-hidden rounded-[28px] border",
    previewHeaderClassName: "flex flex-col items-center text-center",
    previewTitleClassName: "mt-3 text-xl font-black tracking-[-0.06em]",
    previewButtonsClassName: "grid gap-2",
  },
  business_storefront: {
    surfaceClassName: "rounded-[28px] border p-5 sm:p-6",
    softSurfaceClassName: "rounded-[22px] border p-4",
    pageMaxWidthClassName: "max-w-6xl",
    homeMaxWidthClassName: "max-w-6xl",
    homeCardClassName: "w-full p-5 sm:p-7",
    homeHeaderClassName: "flex flex-col items-start text-left",
    homeButtonsClassName: "mt-8 grid gap-3 sm:grid-cols-2",
    homeHighlightFirst: true,
    homeSecondaryLinksClassName: "mt-6 flex flex-wrap justify-start gap-2",
    catalogGridClassName: "grid gap-4 md:grid-cols-2 xl:grid-cols-3",
    formLayoutClassName: "grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]",
    previewHeaderClassName: "flex flex-col items-start text-left",
    previewButtonsClassName: "grid grid-cols-2 gap-2",
  },
  editorial_luxury: {
    surfaceClassName: "rounded-[36px] border p-6 sm:p-8",
    softSurfaceClassName: "rounded-[28px] border p-4",
    buttonTextClassName: "text-sm font-medium tracking-[0.01em]",
    pageMaxWidthClassName: "max-w-4xl",
    homeMaxWidthClassName: "max-w-3xl",
    heroCentered: true,
    heroContainerClassName: "space-y-5",
    heroCopyClassName: "flex flex-col items-center gap-5",
    heroTextAlignClassName: "items-center text-center",
    heroActionsClassName: "flex flex-wrap items-center justify-center gap-3",
    heroDescriptionMaxClassName: "max-w-[34ch]",
    heroAvatarSizeClassName: "h-24 w-24 rounded-full",
    heroAvatarIconSizeClassName: "h-10 w-10",
    homeShellClassName: "flex min-h-[calc(100vh-3rem)] items-center justify-center",
    homeCardClassName: "w-full p-6 sm:p-10",
    homeHeaderClassName: "flex flex-col items-center text-center",
    homeTitleClassName: "mt-5 text-[2.4rem] font-black tracking-[-0.05em]",
    homeDescriptionClassName: "mt-4 max-w-[30ch] text-sm leading-7",
    homeButtonsClassName: "mt-8 space-y-3",
    homeSecondaryLinksClassName: "mt-7 flex flex-wrap justify-center gap-2",
    catalogGridClassName: "grid gap-5 md:grid-cols-2",
    formLayoutClassName: "grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]",
    previewHeaderClassName: "flex flex-col items-center text-center",
    previewButtonsClassName: "space-y-2.5",
  },
  bold_conversion: {
    surfaceClassName: "rounded-[28px] border p-5 sm:p-6",
    softSurfaceClassName: "rounded-[22px] border p-4",
    buttonTextClassName: "text-sm font-bold",
    pageMaxWidthClassName: "max-w-4xl",
    homeMaxWidthClassName: "max-w-4xl",
    heroMediaHeightClassName: "h-[190px] sm:h-[230px]",
    homeCardClassName: "w-full p-5 sm:p-8",
    homeHeaderClassName: "flex flex-col items-start text-left",
    homeDescriptionClassName: "mt-3 max-w-[32ch] text-sm leading-6",
    homeButtonsClassName: "mt-7 space-y-3",
    homeButtonClassName:
      "flex w-full items-center justify-between gap-4 px-6 py-[18px] text-left",
    homePrimaryAll: true,
    formLayoutClassName: "grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]",
    previewHeaderClassName: "flex flex-col items-start text-left",
    previewButtonsClassName: "space-y-3",
  },
};

const MY_PAGE_API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:8011/api";

const MY_PAGE_DESIGN_KEYS = Object.keys(MY_PAGE_DESIGN_DEFAULTS);

function escapeCssUrl(value) {
  return String(value || "").replace(/["\\\n\r]/g, "\\$&");
}

export function resolveMyPageMediaUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (
    /^https?:\/\//i.test(raw) ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:")
  ) {
    return raw;
  }

  const base = String(MY_PAGE_API_BASE || "").replace(/\/api\/?$/i, "");
  if (!base) return raw;
  return `${base}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

function valueFromOptions(value, options, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return options.includes(normalized) ? normalized : fallback;
}

function normalizeThemePreset(value, fallback = MY_PAGE_DESIGN_DEFAULTS.themePreset) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  const mapped = LEGACY_THEME_PRESET_MAP[normalized] || normalized;
  return valueFromOptions(
    mapped,
    MY_PAGE_THEME_PRESET_OPTIONS.map((item) => item.value),
    fallback,
  );
}

export function getMyPageThemePresetDefaults(themePreset) {
  const presetKey = normalizeThemePreset(themePreset);
  const preset = THEME_PRESETS[presetKey] || THEME_PRESETS.clean_light;
  return {
    themePreset: presetKey,
    accentPalette:
      preset?.defaults?.accentPalette || MY_PAGE_DESIGN_DEFAULTS.accentPalette,
    backgroundStyle:
      preset?.defaults?.backgroundStyle ||
      MY_PAGE_DESIGN_DEFAULTS.backgroundStyle,
    fontPreset: preset?.defaults?.fontPreset || MY_PAGE_DESIGN_DEFAULTS.fontPreset,
    buttonStyle:
      preset?.defaults?.buttonStyle || MY_PAGE_DESIGN_DEFAULTS.buttonStyle,
  };
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
    coverStyle: pageOrDesign?.coverStyle || MY_PAGE_DESIGN_DEFAULTS.themePreset,
    avatarUrl: pageOrDesign?.avatarUrl || "",
  };
}

export function normalizeMyPageDesign(
  design = {},
  coverStyle = MY_PAGE_DESIGN_DEFAULTS.themePreset,
) {
  const themePreset = normalizeThemePreset(
    design?.themePreset || coverStyle,
    MY_PAGE_DESIGN_DEFAULTS.themePreset,
  );
  const presetDefaults = getMyPageThemePresetDefaults(themePreset);

  return {
    themePreset,
    brandLayout: valueFromOptions(
      design?.brandLayout,
      MY_PAGE_BRAND_LAYOUT_OPTIONS.map((item) => item.value),
      MY_PAGE_DESIGN_DEFAULTS.brandLayout,
    ),
    accentPalette: valueFromOptions(
      design?.accentPalette,
      MY_PAGE_ACCENT_PALETTE_OPTIONS.map((item) => item.value),
      presetDefaults.accentPalette,
    ),
    backgroundStyle: valueFromOptions(
      design?.backgroundStyle,
      MY_PAGE_BACKGROUND_STYLE_OPTIONS.map((item) => item.value),
      presetDefaults.backgroundStyle,
    ),
    fontPreset: valueFromOptions(
      design?.fontPreset,
      MY_PAGE_FONT_PRESET_OPTIONS.map((item) => item.value),
      presetDefaults.fontPreset,
    ),
    buttonStyle: valueFromOptions(
      design?.buttonStyle,
      MY_PAGE_BUTTON_STYLE_OPTIONS.map((item) => item.value),
      presetDefaults.buttonStyle,
    ),
    buttonRadius: valueFromOptions(
      design?.buttonRadius,
      MY_PAGE_BUTTON_RADIUS_OPTIONS.map((item) => item.value),
      MY_PAGE_DESIGN_DEFAULTS.buttonRadius,
    ),
    secondaryLinksStyle: valueFromOptions(
      design?.secondaryLinksStyle,
      MY_PAGE_SECONDARY_LINK_STYLE_OPTIONS.map((item) => item.value),
      MY_PAGE_DESIGN_DEFAULTS.secondaryLinksStyle,
    ),
  };
}

function buildBackground(preset, accent, backgroundStyle) {
  const gradientBase = `linear-gradient(180deg, ${preset.pageFrom} 0%, ${preset.pageTo} 52%, ${preset.pageEnd} 100%)`;

  if (backgroundStyle === "mesh") {
    return `radial-gradient(circle at 16% 18%, ${accent.tint}, transparent 30%), radial-gradient(circle at 86% 14%, ${preset.ornamentA}, transparent 32%), radial-gradient(circle at 50% 96%, ${preset.ornamentB}, transparent 28%), ${gradientBase}`;
  }

  if (backgroundStyle === "spotlight") {
    return `radial-gradient(circle at 50% -4%, ${accent.tintSoft}, transparent 36%), radial-gradient(circle at 50% 18%, ${preset.ornamentA}, transparent 42%), ${gradientBase}`;
  }

  if (backgroundStyle === "velvet") {
    return `radial-gradient(circle at 20% 18%, ${preset.ornamentA}, transparent 28%), radial-gradient(circle at 80% 10%, ${accent.tint}, transparent 28%), linear-gradient(135deg, transparent 0%, ${preset.ornamentC} 100%), ${gradientBase}`;
  }

  if (backgroundStyle === "grid") {
    return `linear-gradient(transparent 0%, transparent 100%), repeating-linear-gradient(90deg, transparent 0 34px, ${preset.border} 34px 35px), repeating-linear-gradient(180deg, transparent 0 34px, ${preset.border} 34px 35px), radial-gradient(circle at 14% 14%, ${accent.tintSoft}, transparent 24%), ${gradientBase}`;
  }

  if (backgroundStyle === "bloom") {
    return `radial-gradient(circle at 18% 18%, ${accent.tint}, transparent 30%), radial-gradient(circle at 82% 12%, ${accent.tintSoft}, transparent 28%), radial-gradient(circle at 50% 88%, ${preset.ornamentA}, transparent 24%), ${gradientBase}`;
  }

  return `radial-gradient(circle at 12% 16%, ${accent.tintSoft}, transparent 28%), radial-gradient(circle at 86% 12%, ${preset.ornamentA}, transparent 30%), radial-gradient(circle at 50% 90%, ${preset.ornamentC}, transparent 22%), ${gradientBase}`;
}

function buildHeroBackground(preset, accent, backgroundStyle, imageUrl) {
  const safeUrl = escapeCssUrl(imageUrl);
  return `linear-gradient(180deg, ${preset.heroOverlayFrom} 0%, ${preset.heroOverlayTo} 100%), url("${safeUrl}") center/cover no-repeat, ${buildBackground(
    preset,
    accent,
    backgroundStyle,
  )}`;
}

function buildHeroMediaStyle(preset, accent, imageUrl) {
  const safeUrl = escapeCssUrl(imageUrl);
  return {
    borderColor: preset.strongBorder,
    backgroundColor: preset.pageFrom,
    backgroundImage: `linear-gradient(180deg, ${preset.heroOverlayFrom} 0%, ${preset.heroOverlayTo} 100%), url("${safeUrl}")`,
    backgroundPosition: "center",
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat",
    boxShadow: `0 26px 64px -40px ${accent.glow}`,
  };
}

function buildPrimaryButtonStyle(preset, accent, buttonStyle, fontFamily) {
  const isDarkTheme = String(preset.text || "").toLowerCase() === "#f8fafc";

  if (buttonStyle === "soft") {
    return {
      border: `1px solid ${accent.border}`,
      color: preset.text,
      background: `linear-gradient(180deg, ${accent.tintSoft}, ${preset.surfaceFrom})`,
      boxShadow: `0 18px 38px -28px ${accent.glow}`,
      fontFamily,
    };
  }

  if (buttonStyle === "outline") {
    return {
      border: `1px solid ${accent.border}`,
      color: isDarkTheme ? accent.softText : accent.from,
      background: isDarkTheme ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.76)",
      boxShadow: "none",
      fontFamily,
    };
  }

  return {
    border: `1px solid ${accent.border}`,
    color: accent.contrast,
    background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
    boxShadow: `0 20px 44px -28px ${accent.glow}`,
    fontFamily,
  };
}

function buildSecondaryButtonStyle(preset, accent, buttonStyle, fontFamily) {
  if (buttonStyle === "soft") {
    return {
      border: `1px solid ${preset.strongBorder}`,
      color: preset.text,
      background: `linear-gradient(180deg, ${preset.softSurfaceFrom}, ${preset.softSurfaceTo})`,
      boxShadow: "none",
      fontFamily,
    };
  }

  if (buttonStyle === "outline") {
    return {
      border: `1px solid ${preset.strongBorder}`,
      color: preset.text,
      background: `linear-gradient(180deg, ${preset.surfaceFrom}, ${preset.surfaceTo})`,
      boxShadow: "none",
      fontFamily,
    };
  }

  return {
    border: `1px solid ${accent.border}`,
    color: preset.text,
    background: `linear-gradient(180deg, ${preset.surfaceFrom}, ${preset.softSurfaceTo})`,
    boxShadow: "none",
    fontFamily,
  };
}

export function getMyPageTheme(pageOrDesign = {}) {
  const { design: rawDesign, coverStyle, avatarUrl: rawAvatarUrl } =
    resolveThemeSource(pageOrDesign);
  const avatarUrl = resolveMyPageMediaUrl(rawAvatarUrl);
  const design = normalizeMyPageDesign(
    rawDesign || {},
    coverStyle || MY_PAGE_DESIGN_DEFAULTS.themePreset,
  );
  const presetKey = normalizeThemePreset(
    design.themePreset,
    MY_PAGE_DESIGN_DEFAULTS.themePreset,
  );
  const preset = THEME_PRESETS[presetKey] || THEME_PRESETS.clean_light;
  const layout = BASE_LAYOUT;
  const fontFamily =
    FONT_FAMILIES[design.fontPreset] ||
    preset.bodyFontFamily ||
    FONT_FAMILIES.inter;
  const headingFontFamily =
    design.fontPreset === "editorial"
      ? FONT_FAMILIES.editorial
      : FONT_FAMILIES[design.fontPreset] ||
        preset.headingFontFamily ||
        fontFamily;
  const usesHeroLayout = design.brandLayout === "hero" && !!avatarUrl;
  const accent = {
    from:
      {
        sky: "#2563eb",
        emerald: "#059669",
        rose: "#e11d48",
        violet: "#7c3aed",
        amber: "#92400e",
        teal: "#0f766e",
        coral: "#ea580c",
        slate: "#0f172a",
      }[design.accentPalette] || preset.accentFrom,
    to:
      {
        sky: "#0ea5e9",
        emerald: "#14b8a6",
        rose: "#f43f5e",
        violet: "#a855f7",
        amber: "#d97706",
        teal: "#14b8a6",
        coral: "#f97316",
        slate: "#334155",
      }[design.accentPalette] || preset.accentTo,
    contrast:
      {
        sky: "#eff6ff",
        emerald: "#ecfdf5",
        rose: "#fff1f2",
        violet: "#faf5ff",
        amber: "#fff7ed",
        teal: "#ecfeff",
        coral: "#fff7ed",
        slate: "#f8fafc",
      }[design.accentPalette] || preset.accentContrast,
    tint:
      {
        sky: "rgba(37,99,235,0.18)",
        emerald: "rgba(5,150,105,0.18)",
        rose: "rgba(225,29,72,0.18)",
        violet: "rgba(124,58,237,0.18)",
        amber: "rgba(217,119,6,0.18)",
        teal: "rgba(15,118,110,0.18)",
        coral: "rgba(249,115,22,0.18)",
        slate: "rgba(51,65,85,0.16)",
      }[design.accentPalette] || preset.accentTint,
    tintSoft:
      {
        sky: "rgba(14,165,233,0.12)",
        emerald: "rgba(20,184,166,0.12)",
        rose: "rgba(244,63,94,0.12)",
        violet: "rgba(168,85,247,0.12)",
        amber: "rgba(251,191,36,0.12)",
        teal: "rgba(20,184,166,0.12)",
        coral: "rgba(251,146,60,0.12)",
        slate: "rgba(100,116,139,0.1)",
      }[design.accentPalette] || preset.accentTint,
    border:
      {
        sky: "rgba(59,130,246,0.22)",
        emerald: "rgba(16,185,129,0.24)",
        rose: "rgba(244,63,94,0.24)",
        violet: "rgba(139,92,246,0.24)",
        amber: "rgba(217,119,6,0.24)",
        teal: "rgba(45,212,191,0.24)",
        coral: "rgba(249,115,22,0.24)",
        slate: "rgba(71,85,105,0.2)",
      }[design.accentPalette] || preset.accentBorder,
    softText:
      {
        sky: "#dbeafe",
        emerald: "#a7f3d0",
        rose: "#fecdd3",
        violet: "#e9d5ff",
        amber: "#fde68a",
        teal: "#99f6e4",
        coral: "#fdba74",
        slate: "#cbd5e1",
      }[design.accentPalette] || preset.accentText,
    glow:
      {
        sky: "rgba(37,99,235,0.32)",
        emerald: "rgba(5,150,105,0.3)",
        rose: "rgba(225,29,72,0.3)",
        violet: "rgba(124,58,237,0.3)",
        amber: "rgba(180,83,9,0.28)",
        teal: "rgba(20,184,166,0.28)",
        coral: "rgba(234,88,12,0.28)",
        slate: "rgba(15,23,42,0.22)",
      }[design.accentPalette] || preset.accentTint,
  };

  const rootStyle = {
    minHeight: "100vh",
    background: usesHeroLayout
      ? buildHeroBackground(preset, accent, design.backgroundStyle, avatarUrl)
      : buildBackground(preset, accent, design.backgroundStyle),
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
    boxShadow: `0 26px 70px -42px ${accent.glow}`,
  };
  const primaryButtonStyle = buildPrimaryButtonStyle(
    preset,
    accent,
    design.buttonStyle,
    fontFamily,
  );
  const secondaryButtonStyle = buildSecondaryButtonStyle(
    preset,
    accent,
    design.buttonStyle,
    fontFamily,
  );

  return {
    design,
    layout,
    presetKey,
    usesHeroLayout,
    preset,
    accent,
    fontFamily,
    headingFontFamily,
    headingStyle: { fontFamily: headingFontFamily },
    titleStyle: { color: preset.text, fontFamily: headingFontFamily },
    buttonRadiusClassName:
      BUTTON_RADIUS_CLASSNAMES[design.buttonRadius] ||
      BUTTON_RADIUS_CLASSNAMES.rounded,
    buttonIconRadiusClassName:
      BUTTON_ICON_RADIUS_CLASSNAMES[design.buttonRadius] ||
      BUTTON_ICON_RADIUS_CLASSNAMES.rounded,
    rootStyle,
    heroMediaStyle: usesHeroLayout
      ? buildHeroMediaStyle(preset, accent, avatarUrl)
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
    secondaryButtonStyle,
    activeCardStyle: {
      borderColor: accent.border,
      background: `linear-gradient(180deg, ${accent.tint}, ${preset.softSurfaceTo})`,
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
      theme?.layout?.buttonBaseClassName || BASE_LAYOUT.buttonBaseClassName,
      theme?.layout?.buttonPaddingClassName || BASE_LAYOUT.buttonPaddingClassName,
      theme?.layout?.buttonTextClassName || BASE_LAYOUT.buttonTextClassName,
      theme?.buttonRadiusClassName || BUTTON_RADIUS_CLASSNAMES.rounded,
      variant === "secondary" ? "shadow-none" : "",
    ].join(" "),
    style,
  };
}

export function getMyPageSurfaceProps(theme, variant = "default") {
  return {
    className:
      variant === "soft"
        ? theme?.layout?.softSurfaceClassName || BASE_LAYOUT.softSurfaceClassName
        : theme?.layout?.surfaceClassName || BASE_LAYOUT.surfaceClassName,
    style: variant === "soft" ? theme.softSurfaceStyle : theme.surfaceStyle,
  };
}

export function getMyPageSelectableCardProps(theme, active = false) {
  return {
    className:
      theme?.layout?.selectableCardClassName ||
      BASE_LAYOUT.selectableCardClassName,
    style: active ? theme.activeCardStyle : theme.softSurfaceStyle,
  };
}
