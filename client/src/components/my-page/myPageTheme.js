export const MY_PAGE_DESIGN_DEFAULTS = {
  themePreset: "clean_light",
  brandLayout: "classic",
  accentPalette: "sky",
  backgroundStyle: "fill",
  backgroundColor: "#E2E8F0",
  surfaceStyle: "soft",
  surfacePatternVariant: "grid",
  surfaceColor: "#FFFFFF",
  buttonColor: "#0F172A",
  buttonTextColor: "#FFFFFF",
  pageTextColor: "#64748B",
  titleTextColor: "#0F172A",
  backgroundGradientDirection: "linear_up",
  backgroundPatternVariant: "grid",
  fontPreset: "inter",
  buttonStyle: "solid",
  buttonShadow: "none",
  buttonRadius: "round",
  primaryButtonsLayout: "stack",
  secondaryLinksStyle: "text",
  secondaryLinksIconLayout: "brand_badge",
  secondaryLinksSize: "medium",
  secondaryLinksAlign: "center",
  animationPreset: "subtle",
};

export const MY_PAGE_THEME_PRESET_OPTIONS = [
  {
    value: "clean_light",
    label: "Clean Light",
    description: "Claro, minimo e elegante.",
  },
  {
    value: "premium_dark",
    label: "Premium Dark",
    description: "Fintech escuro e sofisticado.",
  },
  {
    value: "barber_gold",
    label: "Barber Gold",
    description: "Barbearia preta e dourada com assinatura classica.",
  },
  {
    value: "nutri_fresh",
    label: "Nutri Fresh",
    description: "Saude natural com verde suave e leitura clean.",
  },
  {
    value: "dental_clinic",
    label: "Dental Clinic",
    description: "Clinica moderna com azul limpo e leitura precisa.",
  },
  {
    value: "pastry_atelier",
    label: "Pastry Atelier",
    description: "Confeitaria delicada com clima artesanal e premium.",
  },
  {
    value: "aesthetic_glow",
    label: "Aesthetic Glow",
    description: "Estetica sofisticada com nude quente e brilho leve.",
  },
  {
    value: "legal_navy",
    label: "Legal Navy",
    description: "Advocacia sobria com marinho premium e assinatura classica.",
  },
  {
    value: "fitness_charge",
    label: "Fitness Charge",
    description: "Academia intensa com energia lime e foco em acao.",
  },
  {
    value: "realty_luxe",
    label: "Realty Luxe",
    description: "Imobiliario elegante com areia, grafite e luxo discreto.",
  },
  {
    value: "kids_care",
    label: "Kids Care",
    description: "Infantil acolhedor com tons leves e leitura amigavel.",
  },
  {
    value: "business_storefront",
    label: "Business Storefront",
    description: "Mini vitrine comercial.",
  },
  {
    value: "bold_conversion",
    label: "Bold Conversion",
    description: "Foco total em clique e acao.",
  },
  {
    value: "editorial_luxury",
    label: "Editorial Luxury",
    description: "Marca premium e refinada.",
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
    value: "midnight_prism",
    label: "Midnight Prism",
    description: "Escuro premium com brilho neon.",
  },
  {
    value: "creator_gradient",
    label: "Creator Gradient",
    description: "Visual social e chamativo.",
  },
  {
    value: "air",
    label: "Air",
    description: "Claro, leve e arejado.",
  },
  {
    value: "agate",
    label: "Agate",
    description: "Mineral moderno e elegante.",
  },
  {
    value: "aura",
    label: "Aura",
    description: "Lavanda vibrante e criativa.",
  },
  {
    value: "blocks",
    label: "Blocks",
    description: "Modular, direto e com cara de vitrine.",
  },
  {
    value: "cobalt_blaze",
    label: "Cobalt Blaze",
    description: "Azul eletrico com energia quente de campanha.",
  },
  {
    value: "violet_punch",
    label: "Violet Punch",
    description: "Roxo intenso para creators e lancamentos.",
  },
  {
    value: "solar_pop",
    label: "Solar Pop",
    description: "Tropical vibrante para paginas promocionais.",
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

const ACCENT_SWATCHES = Object.fromEntries(
  MY_PAGE_ACCENT_PALETTE_OPTIONS.map((option) => [option.value, option.swatch]),
);

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
  { value: "fill", label: "Fill", description: "Cor solida na pagina inteira." },
  { value: "gradient", label: "Gradient", description: "Transicao da cor base." },
  { value: "blur", label: "Blur", description: "Blobs e glow macio." },
  { value: "pattern", label: "Pattern", description: "Textura com desenho leve." },
];

export const MY_PAGE_BACKGROUND_GRADIENT_DIRECTION_OPTIONS = [
  {
    value: "linear_up",
    label: "Linear up",
    description: "A cor forte nasce embaixo e sobe no gradiente.",
  },
  {
    value: "linear_down",
    label: "Linear down",
    description: "A cor forte nasce em cima e desce no gradiente.",
  },
  {
    value: "radial",
    label: "Radial",
    description: "A cor forte nasce no centro e expande.",
  },
];

export const MY_PAGE_BACKGROUND_PATTERN_VARIANT_OPTIONS = [
  { value: "grid", label: "Grid", description: "Grade leve do pattern atual." },
  { value: "morph", label: "Morph", description: "Blocos deformados em alpha." },
  { value: "organic", label: "Organic", description: "Formas fluidas e suaves." },
  { value: "matrix", label: "Matrix", description: "Ritmo tecnico e digital." },
];

export const MY_PAGE_SURFACE_STYLE_OPTIONS = [
  { value: "solid", label: "Solido", description: "Container opaco e direto." },
  { value: "soft", label: "Soft", description: "Camada suave e elegante." },
  { value: "glass", label: "Glass", description: "Translucido com blur e brilho leve." },
  { value: "outline", label: "Outline", description: "Quase transparente com borda forte." },
  { value: "blur", label: "Blur", description: "Camada macia com blur sutil no container." },
  { value: "pattern", label: "Pattern", description: "Textura aplicada so na superficie." },
];

export const MY_PAGE_SURFACE_PATTERN_VARIANT_OPTIONS =
  MY_PAGE_BACKGROUND_PATTERN_VARIANT_OPTIONS.map((option) => ({ ...option }));

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
  { value: "solid", label: "Solido", description: "CTA mais forte." },
  { value: "soft", label: "Soft", description: "Visual suave e elegante." },
  { value: "outline", label: "Outline", description: "Transparente e leve." },
  {
    value: "metallic",
    label: "Metalico",
    description: "Brilho premium com leitura de metal polido.",
  },
  {
    value: "glass",
    label: "Glass",
    description: "Translucido com efeito de vidro e blur.",
  },
];

export const MY_PAGE_BUTTON_SHADOW_OPTIONS = [
  { value: "none", label: "None", description: "Sem moldura preta extra." },
  {
    value: "soft",
    label: "Soft",
    description: "Sombra leve com contorno discreto.",
  },
  {
    value: "strong",
    label: "Strong",
    description: "Mais presenca e offset marcado.",
  },
  {
    value: "hard",
    label: "Hard",
    description: "Borda preta dura no estilo cartaz.",
  },
];

export const MY_PAGE_BUTTON_RADIUS_OPTIONS = [
  { value: "square", label: "Reta", description: "Borda baixa." },
  { value: "round", label: "Round", description: "Curva media." },
  { value: "pill", label: "Pill", description: "Maxima." },
];

export const MY_PAGE_PRIMARY_BUTTON_LAYOUT_OPTIONS = [
  {
    value: "stack",
    label: "Stack",
    description: "Pilha vertical classica e equilibrada.",
  },
  {
    value: "cards",
    label: "Cards",
    description: "CTAs mais altos e com hierarquia mais forte.",
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Mais leve, editorial e objetivo.",
  },
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

export const MY_PAGE_SECONDARY_LINK_ICON_LAYOUT_OPTIONS = [
  {
    value: "plain",
    label: "React Icons",
    description: "Icone simples no estilo anterior.",
  },
  {
    value: "brand_badge",
    label: "Badge oficial",
    description: "Usa o badge colorido da rede.",
  },
];

export const MY_PAGE_SECONDARY_LINK_SIZE_OPTIONS = [
  { value: "small", label: "Pequeno", description: "Chip mais compacto." },
  { value: "medium", label: "Medio", description: "Tamanho padrao." },
];

export const MY_PAGE_SECONDARY_LINK_ALIGN_OPTIONS = [
  {
    value: "center",
    label: "Centralizado",
    description: "Mantem as redes centralizadas.",
  },
  {
    value: "left",
    label: "Esquerda",
    description: "Alinha o bloco de redes a esquerda.",
  },
];

export const MY_PAGE_ANIMATION_PRESET_OPTIONS = [
  {
    value: "subtle",
    label: "Suave",
    description: "Entrada leve e refinada.",
  },
  {
    value: "strong",
    label: "Marcante",
    description: "Camadas com mais deslocamento visual.",
  },
  {
    value: "impact",
    label: "Impacto",
    description: "CTAs entram da direita com mais presenca.",
  },
  {
    value: "off",
    label: "Desligada",
    description: "Composicao estatica e direta.",
  },
];

const THEME_PRESETS = {
  premium_dark: {
    defaults: {
      accentPalette: "teal",
      backgroundStyle: "blur",
      backgroundColor: "#0B1220",
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
      backgroundStyle: "fill",
      backgroundColor: "#E2E8F0",
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
      backgroundStyle: "gradient",
      backgroundColor: "#A855F7",
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
      backgroundStyle: "pattern",
      backgroundColor: "#14B8A6",
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
      backgroundStyle: "fill",
      backgroundColor: "#D6A351",
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
  barber_gold: {
    defaults: {
      accentPalette: "amber",
      backgroundStyle: "blur",
      backgroundColor: "#0C0A09",
      buttonColor: "#C89B3C",
      buttonTextColor: "#17120A",
      pageTextColor: "#C9BFAF",
      titleTextColor: "#F7EEDC",
      fontPreset: "editorial",
      buttonStyle: "metallic",
    },
    pageFrom: "#050403",
    pageTo: "#0C0A09",
    pageEnd: "#15110D",
    text: "#F7EEDC",
    muted: "#C9BFAF",
    surfaceFrom: "rgba(18,14,10,0.96)",
    surfaceTo: "rgba(10,8,6,0.84)",
    softSurfaceFrom: "rgba(28,22,16,0.84)",
    softSurfaceTo: "rgba(13,10,7,0.72)",
    border: "rgba(200,155,60,0.2)",
    strongBorder: "rgba(227,184,92,0.34)",
    ornamentA: "rgba(200,155,60,0.14)",
    ornamentB: "rgba(247,221,161,0.1)",
    ornamentC: "rgba(120,90,40,0.16)",
    inputBg: "rgba(16,12,9,0.82)",
    heroOverlayFrom: "rgba(5,4,3,0.34)",
    heroOverlayTo: "rgba(12,10,9,0.82)",
    accentFrom: "#B88A2A",
    accentTo: "#E1BC6A",
    accentContrast: "#17120A",
    accentTint: "rgba(200,155,60,0.18)",
    accentBorder: "rgba(227,184,92,0.3)",
    accentText: "#F7E7BF",
    bodyFontFamily: "Manrope, sans-serif",
    headingFontFamily: "Georgia, 'Times New Roman', serif",
    buttonMode: "luxury",
  },
  nutri_fresh: {
    defaults: {
      accentPalette: "emerald",
      backgroundStyle: "gradient",
      backgroundColor: "#EDF3E1",
      surfaceStyle: "soft",
      surfaceColor: "#FFF9EF",
      buttonColor: "#7E9453",
      buttonTextColor: "#F8F5EE",
      pageTextColor: "#5C6649",
      titleTextColor: "#2F4529",
      backgroundGradientDirection: "linear_down",
      fontPreset: "jakarta",
      buttonStyle: "soft",
      animationPreset: "subtle",
    },
    pageFrom: "#FBFDF7",
    pageTo: "#F2F7EA",
    pageEnd: "#EFF5E6",
    text: "#2F4529",
    muted: "#5C6649",
    surfaceFrom: "rgba(255,249,239,0.98)",
    surfaceTo: "rgba(249,244,232,0.94)",
    softSurfaceFrom: "rgba(255,249,239,0.92)",
    softSurfaceTo: "rgba(242,238,226,0.84)",
    border: "rgba(126,148,83,0.16)",
    strongBorder: "rgba(97,120,58,0.22)",
    ornamentA: "rgba(126,148,83,0.10)",
    ornamentB: "rgba(182,198,144,0.12)",
    ornamentC: "rgba(229,214,184,0.10)",
    inputBg: "rgba(255,251,244,0.96)",
    heroOverlayFrom: "rgba(251,253,247,0.60)",
    heroOverlayTo: "rgba(242,247,234,0.88)",
    accentFrom: "#6F8448",
    accentTo: "#A4B86F",
    accentContrast: "#F8F5EE",
    accentTint: "rgba(126,148,83,0.18)",
    accentBorder: "rgba(126,148,83,0.24)",
    accentText: "#4E6132",
    bodyFontFamily: "'Plus Jakarta Sans', sans-serif",
    headingFontFamily: "'Plus Jakarta Sans', sans-serif",
    buttonMode: "soft",
  },
  dental_clinic: {
    defaults: {
      accentPalette: "sky",
      backgroundStyle: "blur",
      backgroundColor: "#EAF5FA",
      surfaceStyle: "glass",
      surfaceColor: "#FFFFFF",
      buttonColor: "#3E8FB6",
      buttonTextColor: "#FFFFFF",
      pageTextColor: "#566671",
      titleTextColor: "#173446",
      fontPreset: "inter",
      buttonStyle: "solid",
      animationPreset: "subtle",
    },
    pageFrom: "#F7FCFF",
    pageTo: "#EDF7FB",
    pageEnd: "#FFFFFF",
    text: "#173446",
    muted: "#566671",
    surfaceFrom: "rgba(255,255,255,0.74)",
    surfaceTo: "rgba(240,249,255,0.56)",
    softSurfaceFrom: "rgba(255,255,255,0.62)",
    softSurfaceTo: "rgba(236,246,251,0.48)",
    border: "rgba(62,143,182,0.14)",
    strongBorder: "rgba(62,143,182,0.22)",
    ornamentA: "rgba(62,143,182,0.08)",
    ornamentB: "rgba(125,211,252,0.10)",
    ornamentC: "rgba(148,163,184,0.08)",
    inputBg: "rgba(255,255,255,0.86)",
    heroOverlayFrom: "rgba(247,252,255,0.38)",
    heroOverlayTo: "rgba(234,245,250,0.74)",
    accentFrom: "#2F7FA6",
    accentTo: "#6AB4D6",
    accentContrast: "#FFFFFF",
    accentTint: "rgba(62,143,182,0.18)",
    accentBorder: "rgba(62,143,182,0.24)",
    accentText: "#25627F",
    bodyFontFamily: "Inter, sans-serif",
    headingFontFamily: "Inter, sans-serif",
    buttonMode: "soft",
  },
  pastry_atelier: {
    defaults: {
      accentPalette: "rose",
      backgroundStyle: "gradient",
      backgroundColor: "#F6E9E2",
      surfaceStyle: "soft",
      surfaceColor: "#FFF7F2",
      buttonColor: "#B8747C",
      buttonTextColor: "#FFF7F1",
      pageTextColor: "#6D5651",
      titleTextColor: "#4B342F",
      backgroundGradientDirection: "radial",
      fontPreset: "editorial",
      buttonStyle: "soft",
      animationPreset: "subtle",
    },
    pageFrom: "#FFF8F5",
    pageTo: "#F9ECE6",
    pageEnd: "#FFFDFB",
    text: "#4B342F",
    muted: "#6D5651",
    surfaceFrom: "rgba(255,247,242,0.98)",
    surfaceTo: "rgba(252,240,234,0.94)",
    softSurfaceFrom: "rgba(255,247,242,0.92)",
    softSurfaceTo: "rgba(246,232,226,0.84)",
    border: "rgba(184,116,124,0.16)",
    strongBorder: "rgba(160,93,102,0.22)",
    ornamentA: "rgba(184,116,124,0.10)",
    ornamentB: "rgba(238,198,181,0.12)",
    ornamentC: "rgba(132,88,70,0.08)",
    inputBg: "rgba(255,250,246,0.96)",
    heroOverlayFrom: "rgba(255,248,245,0.58)",
    heroOverlayTo: "rgba(249,236,230,0.88)",
    accentFrom: "#A45D67",
    accentTo: "#D9A6A4",
    accentContrast: "#FFF7F1",
    accentTint: "rgba(184,116,124,0.18)",
    accentBorder: "rgba(184,116,124,0.24)",
    accentText: "#8B4E58",
    bodyFontFamily: "Inter, sans-serif",
    headingFontFamily: "Georgia, 'Times New Roman', serif",
    buttonMode: "soft",
  },
  aesthetic_glow: {
    defaults: {
      accentPalette: "rose",
      backgroundStyle: "blur",
      backgroundColor: "#F5ECE5",
      surfaceStyle: "glass",
      surfaceColor: "#FFF7F1",
      buttonColor: "#C8A08F",
      buttonTextColor: "#2D211D",
      pageTextColor: "#7A6259",
      titleTextColor: "#4D3630",
      fontPreset: "editorial",
      buttonStyle: "glass",
      animationPreset: "strong",
    },
    pageFrom: "#FFF8F4",
    pageTo: "#F7EEE8",
    pageEnd: "#FFFDFC",
    text: "#4D3630",
    muted: "#7A6259",
    surfaceFrom: "rgba(255,247,241,0.72)",
    surfaceTo: "rgba(250,239,232,0.56)",
    softSurfaceFrom: "rgba(255,247,241,0.62)",
    softSurfaceTo: "rgba(244,231,224,0.48)",
    border: "rgba(200,160,143,0.16)",
    strongBorder: "rgba(200,160,143,0.24)",
    ornamentA: "rgba(200,160,143,0.10)",
    ornamentB: "rgba(240,208,192,0.14)",
    ornamentC: "rgba(168,120,104,0.08)",
    inputBg: "rgba(255,250,246,0.88)",
    heroOverlayFrom: "rgba(255,248,244,0.36)",
    heroOverlayTo: "rgba(245,236,229,0.72)",
    accentFrom: "#B98F7D",
    accentTo: "#E2C2B5",
    accentContrast: "#2D211D",
    accentTint: "rgba(200,160,143,0.18)",
    accentBorder: "rgba(200,160,143,0.26)",
    accentText: "#7D5A4F",
    bodyFontFamily: "Inter, sans-serif",
    headingFontFamily: "Georgia, 'Times New Roman', serif",
    buttonMode: "luxury",
  },
  legal_navy: {
    defaults: {
      accentPalette: "slate",
      backgroundStyle: "gradient",
      backgroundColor: "#102743",
      surfaceStyle: "solid",
      surfaceColor: "#1A2431",
      buttonColor: "#20344D",
      buttonTextColor: "#F6EEE1",
      pageTextColor: "#D3D9E2",
      titleTextColor: "#FBF6ED",
      backgroundGradientDirection: "linear_down",
      fontPreset: "editorial",
      buttonStyle: "outline",
      animationPreset: "subtle",
    },
    pageFrom: "#0A1628",
    pageTo: "#102743",
    pageEnd: "#162D49",
    text: "#FBF6ED",
    muted: "#D3D9E2",
    surfaceFrom: "rgba(26,36,49,0.98)",
    surfaceTo: "rgba(20,30,42,0.94)",
    softSurfaceFrom: "rgba(30,40,54,0.92)",
    softSurfaceTo: "rgba(21,29,41,0.84)",
    border: "rgba(246,238,225,0.10)",
    strongBorder: "rgba(246,238,225,0.16)",
    ornamentA: "rgba(148,163,184,0.10)",
    ornamentB: "rgba(32,52,77,0.18)",
    ornamentC: "rgba(251,246,237,0.06)",
    inputBg: "rgba(19,28,39,0.88)",
    heroOverlayFrom: "rgba(10,22,40,0.44)",
    heroOverlayTo: "rgba(16,39,67,0.82)",
    accentFrom: "#20344D",
    accentTo: "#304F74",
    accentContrast: "#F6EEE1",
    accentTint: "rgba(32,52,77,0.26)",
    accentBorder: "rgba(246,238,225,0.18)",
    accentText: "#FBF6ED",
    bodyFontFamily: "Inter, sans-serif",
    headingFontFamily: "Georgia, 'Times New Roman', serif",
    buttonMode: "outline",
  },
  fitness_charge: {
    defaults: {
      accentPalette: "emerald",
      backgroundStyle: "blur",
      backgroundColor: "#0C0F0D",
      surfaceStyle: "pattern",
      surfacePatternVariant: "matrix",
      surfaceColor: "#171B18",
      buttonColor: "#B6FF38",
      buttonTextColor: "#12170F",
      pageTextColor: "#DCE6DF",
      titleTextColor: "#F7FFF3",
      fontPreset: "manrope",
      buttonStyle: "solid",
      animationPreset: "impact",
    },
    pageFrom: "#060806",
    pageTo: "#0B0E0B",
    pageEnd: "#111612",
    text: "#F7FFF3",
    muted: "#DCE6DF",
    surfaceFrom: "rgba(23,27,24,0.98)",
    surfaceTo: "rgba(15,18,16,0.94)",
    softSurfaceFrom: "rgba(29,35,31,0.92)",
    softSurfaceTo: "rgba(17,21,18,0.84)",
    border: "rgba(182,255,56,0.12)",
    strongBorder: "rgba(182,255,56,0.24)",
    ornamentA: "rgba(182,255,56,0.16)",
    ornamentB: "rgba(255,255,255,0.05)",
    ornamentC: "rgba(148,163,184,0.08)",
    inputBg: "rgba(18,22,19,0.88)",
    heroOverlayFrom: "rgba(6,8,6,0.44)",
    heroOverlayTo: "rgba(12,15,13,0.82)",
    accentFrom: "#8FD61E",
    accentTo: "#D6FF72",
    accentContrast: "#12170F",
    accentTint: "rgba(182,255,56,0.20)",
    accentBorder: "rgba(182,255,56,0.24)",
    accentText: "#D9FF8C",
    bodyFontFamily: "Manrope, sans-serif",
    headingFontFamily: "Manrope, sans-serif",
    buttonMode: "conversion",
  },
  realty_luxe: {
    defaults: {
      accentPalette: "amber",
      backgroundStyle: "blur",
      backgroundColor: "#DCCDBE",
      surfaceStyle: "glass",
      surfaceColor: "#F8F0E6",
      buttonColor: "#B79A67",
      buttonTextColor: "#201A14",
      pageTextColor: "#544B44",
      titleTextColor: "#2C2622",
      fontPreset: "editorial",
      buttonStyle: "metallic",
      animationPreset: "subtle",
    },
    pageFrom: "#FBF7F2",
    pageTo: "#F1E7DC",
    pageEnd: "#E7DBCF",
    text: "#2C2622",
    muted: "#544B44",
    surfaceFrom: "rgba(248,240,230,0.72)",
    surfaceTo: "rgba(240,229,217,0.56)",
    softSurfaceFrom: "rgba(248,240,230,0.62)",
    softSurfaceTo: "rgba(233,220,206,0.48)",
    border: "rgba(183,154,103,0.14)",
    strongBorder: "rgba(183,154,103,0.24)",
    ornamentA: "rgba(183,154,103,0.10)",
    ornamentB: "rgba(44,38,34,0.08)",
    ornamentC: "rgba(255,248,236,0.10)",
    inputBg: "rgba(252,246,240,0.86)",
    heroOverlayFrom: "rgba(251,247,242,0.36)",
    heroOverlayTo: "rgba(220,205,190,0.70)",
    accentFrom: "#A88A58",
    accentTo: "#D8C39A",
    accentContrast: "#201A14",
    accentTint: "rgba(183,154,103,0.18)",
    accentBorder: "rgba(183,154,103,0.26)",
    accentText: "#7C6640",
    bodyFontFamily: "Inter, sans-serif",
    headingFontFamily: "Georgia, 'Times New Roman', serif",
    buttonMode: "luxury",
  },
  kids_care: {
    defaults: {
      accentPalette: "sky",
      backgroundStyle: "gradient",
      backgroundColor: "#DDEFFD",
      surfaceStyle: "soft",
      surfaceColor: "#FFF8F0",
      buttonColor: "#F6B58D",
      buttonTextColor: "#5A4A43",
      pageTextColor: "#61788C",
      titleTextColor: "#355772",
      backgroundGradientDirection: "radial",
      fontPreset: "jakarta",
      buttonStyle: "soft",
      animationPreset: "subtle",
    },
    pageFrom: "#FDFEFF",
    pageTo: "#ECF8FF",
    pageEnd: "#FFF8F0",
    text: "#355772",
    muted: "#61788C",
    surfaceFrom: "rgba(255,248,240,0.98)",
    surfaceTo: "rgba(255,252,246,0.94)",
    softSurfaceFrom: "rgba(255,248,240,0.92)",
    softSurfaceTo: "rgba(248,242,233,0.84)",
    border: "rgba(246,181,141,0.16)",
    strongBorder: "rgba(53,87,114,0.14)",
    ornamentA: "rgba(125,211,252,0.10)",
    ornamentB: "rgba(246,181,141,0.12)",
    ornamentC: "rgba(253,224,71,0.10)",
    inputBg: "rgba(255,252,247,0.96)",
    heroOverlayFrom: "rgba(253,254,255,0.56)",
    heroOverlayTo: "rgba(221,239,253,0.86)",
    accentFrom: "#F2A67D",
    accentTo: "#FFD8A8",
    accentContrast: "#5A4A43",
    accentTint: "rgba(246,181,141,0.18)",
    accentBorder: "rgba(246,181,141,0.24)",
    accentText: "#87675A",
    bodyFontFamily: "'Plus Jakarta Sans', sans-serif",
    headingFontFamily: "'Plus Jakarta Sans', sans-serif",
    buttonMode: "soft",
  },
  bold_conversion: {
    defaults: {
      accentPalette: "coral",
      backgroundStyle: "fill",
      backgroundColor: "#FB923C",
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
      backgroundStyle: "gradient",
      backgroundColor: "#5AA89B",
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
      backgroundStyle: "fill",
      backgroundColor: "#A1C9D1",
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
      backgroundStyle: "blur",
      backgroundColor: "#B085FF",
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
      backgroundStyle: "pattern",
      backgroundColor: "#F59E0B",
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
      backgroundStyle: "blur",
      backgroundColor: "#46318A",
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
      backgroundStyle: "fill",
      backgroundColor: "#1E293B",
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
      backgroundStyle: "blur",
      backgroundColor: "#2F6BEA",
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
      backgroundStyle: "gradient",
      backgroundColor: "#8B3DFF",
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
      backgroundStyle: "blur",
      backgroundColor: "#25B4D2",
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
      backgroundStyle: "blur",
      backgroundColor: "#101A3B",
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
  square: "rounded-[12px]",
  round: "rounded-[18px]",
  pill: "rounded-full",
};

const BUTTON_ICON_RADIUS_CLASSNAMES = {
  square: "rounded-[10px]",
  round: "rounded-[14px]",
  pill: "rounded-full",
};

const LEGACY_BUTTON_RADIUS_MAP = {
  rounded: "round",
};

const HOME_PRIMARY_BUTTON_LAYOUTS = {
  stack: {
    containerClassName: "mt-7 space-y-3",
    previewContainerClassName: "space-y-2.5",
    buttonClassName: "min-h-[76px] px-5 py-4",
    previewButtonClassName: "min-h-[58px] px-4 py-3",
    innerClassName: "flex min-w-0 flex-1 items-center gap-4",
    previewInnerClassName: "flex min-w-0 flex-1 items-center gap-3",
    contentClassName: "min-w-0 flex-1",
    iconWrapClassName: "h-12 w-12",
    previewIconWrapClassName: "h-10 w-10",
    iconClassName: "h-5 w-5",
    previewIconClassName: "h-4 w-4",
    titleClassName: "truncate text-base font-semibold",
    previewTitleClassName: "truncate text-sm font-semibold",
    actionMode: "text",
    actionClassName: "text-sm font-semibold",
    previewActionClassName: "text-[11px] font-semibold",
    showMeta: false,
    iconSurface: "soft",
    buttonStyle: {},
    previewButtonStyle: {},
  },
  cards: {
    containerClassName: "mt-7 space-y-3.5",
    previewContainerClassName: "space-y-3",
    buttonClassName: "min-h-[96px] items-stretch px-5 py-5",
    previewButtonClassName: "min-h-[72px] items-stretch px-4 py-4",
    innerClassName: "flex min-w-0 flex-1 items-center gap-4",
    previewInnerClassName: "flex min-w-0 flex-1 items-center gap-3",
    contentClassName: "min-w-0 flex-1",
    iconWrapClassName: "h-14 w-14 shadow-[0_18px_38px_-28px_rgba(15,23,42,0.35)]",
    previewIconWrapClassName: "h-11 w-11",
    iconClassName: "h-5 w-5",
    previewIconClassName: "h-4 w-4",
    titleClassName: "truncate text-base font-bold tracking-[-0.02em]",
    previewTitleClassName: "truncate text-sm font-bold",
    metaClassName: "mb-1 text-[10px] font-bold uppercase tracking-[0.18em]",
    previewMetaClassName: "mb-1 text-[9px] font-bold uppercase tracking-[0.16em]",
    actionMode: "pill",
    actionClassName:
      "inline-flex items-center justify-center rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em]",
    previewActionClassName:
      "inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]",
    showMeta: true,
    iconSurface: "accent",
    actionSurface: "soft",
    buttonStyle: {},
    previewButtonStyle: {},
  },
  minimal: {
    containerClassName: "mt-6 space-y-2.5",
    previewContainerClassName: "space-y-2",
    buttonClassName: "min-h-[60px] px-4 py-3",
    previewButtonClassName: "min-h-[50px] px-3.5 py-2.5",
    innerClassName: "flex min-w-0 flex-1 items-center gap-3",
    previewInnerClassName: "flex min-w-0 flex-1 items-center gap-2.5",
    contentClassName: "min-w-0 flex-1",
    iconWrapClassName: "h-10 w-10 border-transparent",
    previewIconWrapClassName: "h-8 w-8 border-transparent",
    iconClassName: "h-4 w-4",
    previewIconClassName: "h-3.5 w-3.5",
    titleClassName: "truncate text-sm font-semibold",
    previewTitleClassName: "truncate text-[13px] font-semibold",
    actionMode: "text",
    actionClassName:
      "text-[11px] font-bold uppercase tracking-[0.18em] opacity-80",
    previewActionClassName:
      "text-[10px] font-bold uppercase tracking-[0.16em] opacity-75",
    showMeta: false,
    iconSurface: "muted",
    buttonStyle: { boxShadow: "none" },
    previewButtonStyle: { boxShadow: "none" },
  },
};

const SECONDARY_LINK_SIZE_CONFIG = {
  small: {
    itemClassName: "px-2.5 py-1.5 text-[11px] font-semibold",
    iconOnlyClassName: "h-9 w-9 justify-center px-0",
    contentClassName: "gap-1.5",
    iconClassName: "h-3.5 w-3.5",
  },
  medium: {
    itemClassName: "px-3 py-2 text-xs font-semibold",
    iconOnlyClassName: "h-10 w-10 justify-center px-0",
    contentClassName: "gap-2",
    iconClassName: "h-4 w-4",
  },
};

const SECONDARY_LINK_ALIGN_CLASSNAMES = {
  center: "justify-center",
  left: "justify-start",
};

const MY_PAGE_MOTION_PRESETS = {
  subtle: {
    distance: 16,
    scale: 0.99,
    duration: 0.38,
    stagger: 0.05,
    hoverY: -2,
    hoverScale: 1.008,
    loadingScale: 0.992,
    loadingDuration: 0.3,
    ease: [0.22, 1, 0.36, 1],
  },
  strong: {
    distance: 28,
    scale: 0.972,
    duration: 0.5,
    stagger: 0.085,
    hoverY: -4,
    hoverScale: 1.018,
    loadingScale: 0.982,
    loadingDuration: 0.42,
    ease: [0.18, 1, 0.24, 1],
  },
  impact: {
    distance: 18,
    scale: 0.976,
    duration: 0.42,
    stagger: 0.06,
    hoverY: -4,
    hoverScale: 1.018,
    tapScale: 0.985,
    loadingScale: 0.94,
    loadingDuration: 0.36,
    loadingExitScale: 1.03,
    loadingExitY: -10,
    loadingExitDuration: 0.22,
    itemY: 16,
    itemScale: 0.994,
    buttonEnterX: 42,
    buttonEnterScale: 0.985,
    buttonDuration: 0.34,
    buttonStagger: 0.06,
    buttonEase: [0.16, 1, 0.3, 1],
    buttonHoverShadow:
      "0 18px 34px -24px rgba(15,23,42,0.26), 0 12px 22px -24px rgba(59,130,246,0.22)",
    buttonTransitionDuration: 0.14,
    ease: [0.16, 1, 0.3, 1],
  },
  off: {
    distance: 0,
    scale: 1,
    duration: 0,
    stagger: 0,
    hoverY: 0,
    hoverScale: 1,
    loadingScale: 1,
    loadingDuration: 0,
    ease: "linear",
  },
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
    "inline-flex items-center justify-center gap-2 border transition-[filter,box-shadow,transform] duration-200 will-change-transform hover:brightness-[1.02]",
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
  barber_gold: {
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
    homeTitleClassName: "mt-5 text-[2.45rem] font-black tracking-[-0.05em]",
    homeDescriptionClassName: "mt-4 max-w-[30ch] text-sm leading-7",
    homeButtonsClassName: "mt-8 space-y-3",
    homeSecondaryLinksClassName: "mt-7 flex flex-wrap justify-center gap-2",
    catalogGridClassName: "grid gap-5 md:grid-cols-2",
    formLayoutClassName: "grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]",
    previewHeaderClassName: "flex flex-col items-center text-center",
    previewTitleClassName: "mt-3 text-xl font-black tracking-[-0.05em]",
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
const LEGACY_BACKGROUND_STYLE_MAP = {
  halo: "fill",
  spotlight: "fill",
  mesh: "gradient",
  bloom: "blur",
  velvet: "blur",
  grid: "pattern",
};

function escapeCssUrl(value) {
  return String(value || "").replace(/["\\\n\r]/g, "\\$&");
}

function joinClassNames(...parts) {
  return parts.filter(Boolean).join(" ");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeHexColor(
  value,
  fallback = MY_PAGE_DESIGN_DEFAULTS.backgroundColor,
) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;

  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  if (/^#[0-9a-f]{3}$/i.test(withHash)) {
    const [, r, g, b] = withHash;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  if (/^#[0-9a-f]{6}$/i.test(withHash)) {
    return withHash.toUpperCase();
  }

  return fallback;
}

function hexToRgb(value) {
  const hex = normalizeHexColor(value);
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((channel) =>
      clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"),
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
  const safeSaturation = clamp(Number(saturation) || 0, 0, 100) / 100;
  const safeValue = clamp(Number(value) || 0, 0, 100) / 100;
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

function lightenHex(hex, amount = 0.1) {
  const hsv = rgbToHsv(hexToRgb(hex));
  return rgbToHex(
    ...Object.values(
      hsvToRgb({
        hue: hsv.hue,
        saturation: clamp(hsv.saturation - amount * 18, 0, 100),
        value: clamp(hsv.value + amount * 100, 0, 100),
      }),
    ),
  );
}

function darkenHex(hex, amount = 0.1) {
  const hsv = rgbToHsv(hexToRgb(hex));
  return rgbToHex(
    ...Object.values(
      hsvToRgb({
        hue: hsv.hue,
        saturation: clamp(hsv.saturation + amount * 8, 0, 100),
        value: clamp(hsv.value - amount * 100, 0, 100),
      }),
    ),
  );
}

function getRelativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function isDarkColor(hex) {
  return getRelativeLuminance(hex) < 0.34;
}

function getReadableTextColor(hex, light = "#FFFFFF", dark = "#0F172A") {
  return isDarkColor(hex) ? light : dark;
}

export function mixHexColors(from, to, amount = 0.5) {
  const left = hexToRgb(from);
  const right = hexToRgb(to);
  const weight = clamp(Number(amount) || 0, 0, 1);

  return rgbToHex(
    left.r + (right.r - left.r) * weight,
    left.g + (right.g - left.g) * weight,
    left.b + (right.b - left.b) * weight,
  );
}

function alphaColor(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(Number(alpha) || 0, 0, 1)})`;
}

function parseCssColorMeta(value, fallback = MY_PAGE_DESIGN_DEFAULTS.surfaceColor) {
  const raw = String(value || "").trim();
  if (!raw) {
    return { hex: normalizeHexColor(fallback), alpha: 1 };
  }

  if (raw.startsWith("#")) {
    return { hex: normalizeHexColor(raw, fallback), alpha: 1 };
  }

  const rgbMatch = raw.match(
    /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([0-9.]+))?\s*\)/i,
  );
  if (rgbMatch) {
    return {
      hex: rgbToHex(
        Number(rgbMatch[1]),
        Number(rgbMatch[2]),
        Number(rgbMatch[3]),
      ),
      alpha: clamp(Number(rgbMatch[4] ?? 1), 0, 1),
    };
  }

  return { hex: normalizeHexColor(raw, fallback), alpha: 1 };
}

function buildAccentTokens(
  accentBase,
  accentContrast,
  titleTextColor,
) {
  const accentTextColor = mixHexColors(accentBase, titleTextColor, 0.38);

  return {
    base: accentBase,
    from: accentBase,
    to: isDarkColor(accentBase)
      ? lightenHex(accentBase, 0.14)
      : darkenHex(accentBase, 0.08),
    contrast: accentContrast,
    tint: alphaColor(accentBase, 0.18),
    tintSoft: alphaColor(lightenHex(accentBase, 0.08), 0.14),
    border: alphaColor(mixHexColors(accentBase, accentContrast, 0.18), 0.34),
    softText: accentTextColor,
    glow: alphaColor(accentBase, isDarkColor(accentBase) ? 0.34 : 0.28),
  };
}

function buildMetallicTones(accentBase) {
  const deep = darkenHex(accentBase, 0.28);
  const lowlight = darkenHex(accentBase, 0.16);
  const mid = mixHexColors(accentBase, lightenHex(accentBase, 0.08), 0.34);
  const sheen = lightenHex(accentBase, 0.18);
  const highlight = mixHexColors(sheen, "#FFFFFF", 0.36);
  const rim = mixHexColors(lowlight, highlight, 0.26);

  return {
    deep,
    lowlight,
    mid,
    sheen,
    highlight,
    rim,
    shadow: alphaColor(mixHexColors(deep, "#050505", 0.52), 0.34),
    insetShadow: alphaColor(mixHexColors(deep, "#0A0A0A", 0.42), 0.28),
  };
}

function buildMetallicBackground(accent, tone = "primary") {
  const metallic = buildMetallicTones(accent.base || accent.from);
  const topHighlightAlpha = tone === "secondary" ? 0.56 : 0.68;
  const sheenAlpha = tone === "secondary" ? 0.46 : 0.58;
  const baseGradient =
    tone === "secondary"
      ? `linear-gradient(180deg, ${metallic.deep} 0%, ${metallic.lowlight} 18%, ${metallic.mid} 42%, ${metallic.highlight} 54%, ${metallic.mid} 66%, ${metallic.lowlight} 84%, ${metallic.deep} 100%)`
      : `linear-gradient(135deg, ${metallic.deep} 0%, ${metallic.lowlight} 18%, ${metallic.mid} 38%, ${metallic.highlight} 50%, ${metallic.mid} 62%, ${metallic.lowlight} 82%, ${metallic.deep} 100%)`;

  return [
    `linear-gradient(118deg, transparent 0 26%, ${alphaColor(metallic.highlight, sheenAlpha)} 38%, ${alphaColor(metallic.sheen, sheenAlpha * 0.58)} 47%, transparent 60%)`,
    `linear-gradient(180deg, ${alphaColor(metallic.highlight, topHighlightAlpha)} 0%, ${alphaColor(metallic.sheen, topHighlightAlpha * 0.42)} 10%, transparent 32%, ${alphaColor(metallic.deep, 0.18)} 100%)`,
    baseGradient,
  ].join(", ");
}

function buildMetallicBorder(accent) {
  const metallic = buildMetallicTones(accent.base || accent.from);
  return alphaColor(metallic.rim, 0.72);
}

function buildMetallicShadow(accent, tone = "primary") {
  const metallic = buildMetallicTones(accent.base || accent.from);
  const outerBlur =
    tone === "secondary" ? "0 14px 30px -24px" : "0 20px 44px -28px";
  return [
    `inset 0 1px 0 ${alphaColor(metallic.highlight, 0.72)}`,
    `inset 0 -10px 18px ${metallic.insetShadow}`,
    `${outerBlur} ${metallic.shadow}`,
  ].join(", ");
}

function buildGlassButtonStyle(accent, fontFamily, tone = "primary") {
  const highlight = mixHexColors(accent.base || accent.from, "#FFFFFF", 0.42);
  const baseAlpha = tone === "secondary" ? 0.12 : 0.18;
  const edgeAlpha = tone === "secondary" ? 0.26 : 0.34;
  const borderAlpha = tone === "secondary" ? 0.3 : 0.42;

  return {
    border: `1px solid ${alphaColor(highlight, borderAlpha)}`,
    color: accent.contrast,
    background: [
      `linear-gradient(180deg, ${alphaColor(highlight, edgeAlpha)} 0%, ${alphaColor(highlight, edgeAlpha * 0.22)} 14%, transparent 44%)`,
      `linear-gradient(135deg, ${alphaColor(accent.base || accent.from, baseAlpha)} 0%, ${alphaColor(lightenHex(accent.base || accent.from, 0.08), baseAlpha * 0.72)} 100%)`,
    ].join(", "),
    backdropFilter: "blur(18px) saturate(1.18)",
    WebkitBackdropFilter: "blur(18px) saturate(1.18)",
    boxShadow: [
      `inset 0 1px 0 ${alphaColor(highlight, 0.46)}`,
      `0 18px 40px -30px ${alphaColor(accent.base || accent.from, 0.34)}`,
    ].join(", "),
    fontFamily,
  };
}

function composeBoxShadowLayers(...layers) {
  return layers
    .flatMap((layer) => {
      if (!layer || layer === "none") return [];
      if (Array.isArray(layer)) return layer.filter(Boolean);
      return [layer];
    })
    .join(", ");
}

function buildButtonShadowLayers(buttonShadow) {
  if (buttonShadow === "soft") {
    return [
      "0 0 0 1px rgba(17,17,17,0.72)",
      "2px 2px 0 0 rgba(17,17,17,0.58)",
    ];
  }

  if (buttonShadow === "strong") {
    return [
      "0 0 0 1px rgba(17,17,17,0.86)",
      "4px 4px 0 0 rgba(17,17,17,0.80)",
    ];
  }

  if (buttonShadow === "hard") {
    return ["0 0 0 2px #171717", "6px 6px 0 0 #171717"];
  }

  return [];
}

function applyButtonShadowStyle(style, buttonShadow) {
  const boxShadow = composeBoxShadowLayers(
    buildButtonShadowLayers(buttonShadow),
    style?.boxShadow,
  );

  return {
    ...style,
    boxShadow: boxShadow || "none",
  };
}

function buildBackgroundPalette(backgroundColor) {
  const base = normalizeHexColor(backgroundColor);
  return {
    base,
    top: lightenHex(base, 0.08),
    light: lightenHex(base, 0.18),
    wash: lightenHex(base, 0.28),
    dark: darkenHex(base, 0.12),
    deep: darkenHex(base, 0.24),
    line: alphaColor(lightenHex(base, 0.34), 0.22),
    glow: alphaColor(base, 0.34),
    glowSoft: alphaColor(lightenHex(base, 0.12), 0.18),
    haze: alphaColor(lightenHex(base, 0.2), 0.22),
    mist: alphaColor(lightenHex(base, 0.28), 0.32),
    lineStrong: alphaColor(lightenHex(base, 0.4), 0.34),
    mesh: alphaColor(lightenHex(base, 0.32), 0.18),
    dot: alphaColor(lightenHex(base, 0.5), 0.28),
    shadow: alphaColor(darkenHex(base, 0.2), 0.18),
  };
}

function buildThemeColorDefaults(preset) {
  const fallbackButtonColor =
    ACCENT_SWATCHES[preset?.defaults?.accentPalette] ||
    preset?.accentFrom ||
    MY_PAGE_DESIGN_DEFAULTS.buttonColor;
  const buttonColor = normalizeHexColor(
    preset?.defaults?.buttonColor || fallbackButtonColor,
    MY_PAGE_DESIGN_DEFAULTS.buttonColor,
  );
  const surfaceColor = parseCssColorMeta(
    preset?.defaults?.surfaceColor || preset?.surfaceFrom || preset?.surfaceTo,
    MY_PAGE_DESIGN_DEFAULTS.surfaceColor,
  ).hex;

  return {
    backgroundColor: normalizeHexColor(
      preset?.defaults?.backgroundColor,
      MY_PAGE_DESIGN_DEFAULTS.backgroundColor,
    ),
    surfaceColor,
    buttonColor,
    buttonTextColor: normalizeHexColor(
      preset?.defaults?.buttonTextColor,
      getReadableTextColor(buttonColor, "#FFFFFF", "#111827"),
    ),
    pageTextColor: normalizeHexColor(
      preset?.defaults?.pageTextColor,
      preset?.muted || MY_PAGE_DESIGN_DEFAULTS.pageTextColor,
    ),
    titleTextColor: normalizeHexColor(
      preset?.defaults?.titleTextColor,
      preset?.text || MY_PAGE_DESIGN_DEFAULTS.titleTextColor,
    ),
  };
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

function resolvePrimaryButtonLayout(value) {
  return valueFromOptions(
    value,
    MY_PAGE_PRIMARY_BUTTON_LAYOUT_OPTIONS.map((item) => item.value),
    MY_PAGE_DESIGN_DEFAULTS.primaryButtonsLayout,
  );
}

function resolveSecondaryLinksSize(value) {
  return valueFromOptions(
    value,
    MY_PAGE_SECONDARY_LINK_SIZE_OPTIONS.map((item) => item.value),
    MY_PAGE_DESIGN_DEFAULTS.secondaryLinksSize,
  );
}

function resolveSecondaryLinksAlign(value) {
  return valueFromOptions(
    value,
    MY_PAGE_SECONDARY_LINK_ALIGN_OPTIONS.map((item) => item.value),
    MY_PAGE_DESIGN_DEFAULTS.secondaryLinksAlign,
  );
}

function resolveAnimationPreset(value) {
  return valueFromOptions(
    value,
    MY_PAGE_ANIMATION_PRESET_OPTIONS.map((item) => item.value),
    MY_PAGE_DESIGN_DEFAULTS.animationPreset,
  );
}

function resolveSurfaceStyle(value, fallback = MY_PAGE_DESIGN_DEFAULTS.surfaceStyle) {
  return valueFromOptions(
    value,
    MY_PAGE_SURFACE_STYLE_OPTIONS.map((item) => item.value),
    fallback,
  );
}

function resolveSurfacePatternVariant(
  value,
  fallback = MY_PAGE_DESIGN_DEFAULTS.surfacePatternVariant,
) {
  return valueFromOptions(
    value,
    MY_PAGE_SURFACE_PATTERN_VARIANT_OPTIONS.map((item) => item.value),
    fallback,
  );
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
  const colorDefaults = buildThemeColorDefaults(preset);
  const inferredSurfaceStyle =
    parseCssColorMeta(preset?.surfaceFrom, MY_PAGE_DESIGN_DEFAULTS.surfaceColor).alpha <=
    0.4
      ? "glass"
      : MY_PAGE_DESIGN_DEFAULTS.surfaceStyle;
  return {
    themePreset: presetKey,
    accentPalette:
      preset?.defaults?.accentPalette || MY_PAGE_DESIGN_DEFAULTS.accentPalette,
    backgroundStyle:
      preset?.defaults?.backgroundStyle ||
      MY_PAGE_DESIGN_DEFAULTS.backgroundStyle,
    backgroundColor:
      normalizeHexColor(
        preset?.defaults?.backgroundColor,
        MY_PAGE_DESIGN_DEFAULTS.backgroundColor,
      ) || MY_PAGE_DESIGN_DEFAULTS.backgroundColor,
    surfaceStyle: resolveSurfaceStyle(
      preset?.defaults?.surfaceStyle,
      inferredSurfaceStyle,
    ),
    surfacePatternVariant: resolveSurfacePatternVariant(
      preset?.defaults?.surfacePatternVariant,
      MY_PAGE_DESIGN_DEFAULTS.surfacePatternVariant,
    ),
    surfaceColor: colorDefaults.surfaceColor,
    buttonColor: colorDefaults.buttonColor,
    buttonTextColor: colorDefaults.buttonTextColor,
    pageTextColor: colorDefaults.pageTextColor,
    titleTextColor: colorDefaults.titleTextColor,
    backgroundGradientDirection:
      preset?.defaults?.backgroundGradientDirection ||
      MY_PAGE_DESIGN_DEFAULTS.backgroundGradientDirection,
    backgroundPatternVariant:
      preset?.defaults?.backgroundPatternVariant ||
      MY_PAGE_DESIGN_DEFAULTS.backgroundPatternVariant,
    fontPreset: preset?.defaults?.fontPreset || MY_PAGE_DESIGN_DEFAULTS.fontPreset,
    buttonStyle:
      preset?.defaults?.buttonStyle || MY_PAGE_DESIGN_DEFAULTS.buttonStyle,
    buttonShadow: MY_PAGE_DESIGN_DEFAULTS.buttonShadow,
    primaryButtonsLayout: MY_PAGE_DESIGN_DEFAULTS.primaryButtonsLayout,
    secondaryLinksStyle: MY_PAGE_DESIGN_DEFAULTS.secondaryLinksStyle,
    secondaryLinksIconLayout: MY_PAGE_DESIGN_DEFAULTS.secondaryLinksIconLayout,
    secondaryLinksSize: MY_PAGE_DESIGN_DEFAULTS.secondaryLinksSize,
    secondaryLinksAlign: MY_PAGE_DESIGN_DEFAULTS.secondaryLinksAlign,
    animationPreset:
      preset?.defaults?.animationPreset ||
      MY_PAGE_DESIGN_DEFAULTS.animationPreset,
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
      LEGACY_BACKGROUND_STYLE_MAP[String(design?.backgroundStyle || "")
        .trim()
        .toLowerCase()] || design?.backgroundStyle,
      MY_PAGE_BACKGROUND_STYLE_OPTIONS.map((item) => item.value),
      presetDefaults.backgroundStyle,
    ),
    backgroundColor: normalizeHexColor(
      design?.backgroundColor,
      presetDefaults.backgroundColor,
    ),
    surfaceStyle: resolveSurfaceStyle(
      design?.surfaceStyle,
      presetDefaults.surfaceStyle,
    ),
    surfacePatternVariant: resolveSurfacePatternVariant(
      design?.surfacePatternVariant,
      presetDefaults.surfacePatternVariant,
    ),
    surfaceColor: normalizeHexColor(
      design?.surfaceColor,
      presetDefaults.surfaceColor,
    ),
    buttonColor: normalizeHexColor(
      design?.buttonColor,
      presetDefaults.buttonColor,
    ),
    buttonTextColor: normalizeHexColor(
      design?.buttonTextColor,
      presetDefaults.buttonTextColor,
    ),
    pageTextColor: normalizeHexColor(
      design?.pageTextColor,
      presetDefaults.pageTextColor,
    ),
    titleTextColor: normalizeHexColor(
      design?.titleTextColor,
      presetDefaults.titleTextColor,
    ),
    backgroundGradientDirection: valueFromOptions(
      design?.backgroundGradientDirection,
      MY_PAGE_BACKGROUND_GRADIENT_DIRECTION_OPTIONS.map((item) => item.value),
      MY_PAGE_DESIGN_DEFAULTS.backgroundGradientDirection,
    ),
    backgroundPatternVariant: valueFromOptions(
      design?.backgroundPatternVariant,
      MY_PAGE_BACKGROUND_PATTERN_VARIANT_OPTIONS.map((item) => item.value),
      MY_PAGE_DESIGN_DEFAULTS.backgroundPatternVariant,
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
    buttonShadow: valueFromOptions(
      design?.buttonShadow,
      MY_PAGE_BUTTON_SHADOW_OPTIONS.map((item) => item.value),
      presetDefaults.buttonShadow,
    ),
    buttonRadius: valueFromOptions(
      LEGACY_BUTTON_RADIUS_MAP[String(design?.buttonRadius || "")
        .trim()
        .toLowerCase()] || design?.buttonRadius,
      MY_PAGE_BUTTON_RADIUS_OPTIONS.map((item) => item.value),
      MY_PAGE_DESIGN_DEFAULTS.buttonRadius,
    ),
    primaryButtonsLayout: valueFromOptions(
      design?.primaryButtonsLayout,
      MY_PAGE_PRIMARY_BUTTON_LAYOUT_OPTIONS.map((item) => item.value),
      MY_PAGE_DESIGN_DEFAULTS.primaryButtonsLayout,
    ),
    secondaryLinksStyle: valueFromOptions(
      design?.secondaryLinksStyle,
      MY_PAGE_SECONDARY_LINK_STYLE_OPTIONS.map((item) => item.value),
      MY_PAGE_DESIGN_DEFAULTS.secondaryLinksStyle,
    ),
    secondaryLinksIconLayout: valueFromOptions(
      design?.secondaryLinksIconLayout,
      MY_PAGE_SECONDARY_LINK_ICON_LAYOUT_OPTIONS.map((item) => item.value),
      MY_PAGE_DESIGN_DEFAULTS.secondaryLinksIconLayout,
    ),
    secondaryLinksSize: valueFromOptions(
      design?.secondaryLinksSize,
      MY_PAGE_SECONDARY_LINK_SIZE_OPTIONS.map((item) => item.value),
      MY_PAGE_DESIGN_DEFAULTS.secondaryLinksSize,
    ),
    secondaryLinksAlign: valueFromOptions(
      design?.secondaryLinksAlign,
      MY_PAGE_SECONDARY_LINK_ALIGN_OPTIONS.map((item) => item.value),
      MY_PAGE_DESIGN_DEFAULTS.secondaryLinksAlign,
    ),
    animationPreset: valueFromOptions(
      design?.animationPreset,
      MY_PAGE_ANIMATION_PRESET_OPTIONS.map((item) => item.value),
      MY_PAGE_DESIGN_DEFAULTS.animationPreset,
    ),
  };
}

function resolveHomeButtonElementStyle(theme, surfaceKind) {
  if (surfaceKind === "accent") {
    return {
      ...theme.activeCardStyle,
      boxShadow: "none",
    };
  }

  if (surfaceKind === "muted") {
    return {
      borderColor: theme?.dividerStyle?.borderColor,
      background: "transparent",
      color: theme?.preset?.text,
      boxShadow: "none",
    };
  }

  return {
    ...theme.softSurfaceStyle,
    boxShadow: "none",
  };
}

export function getMyPageHomeButtonLayout(theme, { preview = false } = {}) {
  const layoutKey = resolvePrimaryButtonLayout(theme?.design?.primaryButtonsLayout);
  const config =
    HOME_PRIMARY_BUTTON_LAYOUTS[layoutKey] || HOME_PRIMARY_BUTTON_LAYOUTS.stack;

  return {
    key: layoutKey,
    actionMode: config.actionMode,
    showMeta: config.showMeta === true,
    containerClassName: preview
      ? config.previewContainerClassName || config.containerClassName
      : config.containerClassName,
    buttonClassName: preview
      ? config.previewButtonClassName || config.buttonClassName
      : config.buttonClassName,
    buttonStyle: preview
      ? config.previewButtonStyle || config.buttonStyle || {}
      : config.buttonStyle || {},
    innerClassName: preview
      ? config.previewInnerClassName || config.innerClassName
      : config.innerClassName,
    contentClassName: config.contentClassName,
    iconWrapClassName: preview
      ? config.previewIconWrapClassName || config.iconWrapClassName
      : config.iconWrapClassName,
    iconClassName: preview
      ? config.previewIconClassName || config.iconClassName
      : config.iconClassName,
    titleClassName: preview
      ? config.previewTitleClassName || config.titleClassName
      : config.titleClassName,
    metaClassName: preview
      ? config.previewMetaClassName || config.metaClassName || ""
      : config.metaClassName || "",
    actionClassName: preview
      ? config.previewActionClassName || config.actionClassName
      : config.actionClassName,
    iconStyle: resolveHomeButtonElementStyle(theme, config.iconSurface),
    actionStyle: config.actionSurface
      ? resolveHomeButtonElementStyle(theme, config.actionSurface)
      : null,
  };
}

export function getMyPageHomeButtonProps(
  theme,
  variant = "primary",
  options = {},
) {
  const buttonProps = getMyPageButtonProps(theme, variant);
  const layout = getMyPageHomeButtonLayout(theme, options);
  const mergedStyle = {
    ...buttonProps.style,
    ...layout.buttonStyle,
  };
  const shadowMode =
    theme?.design?.buttonShadow || MY_PAGE_DESIGN_DEFAULTS.buttonShadow;
  const baseBoxShadow = buttonProps?.style?.boxShadow;
  const layoutBoxShadow = layout?.buttonStyle?.boxShadow;

  if (shadowMode !== "none" && layoutBoxShadow === "none") {
    mergedStyle.boxShadow = baseBoxShadow || "none";
  } else if (
    shadowMode !== "none" &&
    layoutBoxShadow &&
    layoutBoxShadow !== "none"
  ) {
    mergedStyle.boxShadow = composeBoxShadowLayers(
      baseBoxShadow,
      layoutBoxShadow,
    );
  }

  return {
    buttonProps: {
      className: joinClassNames(
        buttonProps.className,
        theme?.layout?.homeButtonClassName,
        layout.buttonClassName,
      ),
      style: mergedStyle,
    },
    layout,
  };
}

export function getMyPageSecondaryLinksLayout(theme) {
  const size = resolveSecondaryLinksSize(theme?.design?.secondaryLinksSize);
  const align = resolveSecondaryLinksAlign(theme?.design?.secondaryLinksAlign);
  const sizeConfig =
    SECONDARY_LINK_SIZE_CONFIG[size] || SECONDARY_LINK_SIZE_CONFIG.medium;

  return {
    size,
    align,
    containerClassName:
      SECONDARY_LINK_ALIGN_CLASSNAMES[align] ||
      SECONDARY_LINK_ALIGN_CLASSNAMES.center,
    itemClassName: sizeConfig.itemClassName,
    iconOnlyClassName: sizeConfig.iconOnlyClassName,
    contentClassName: sizeConfig.contentClassName,
    iconClassName: sizeConfig.iconClassName,
  };
}

export function getMyPageMotionPreset(themeOrDesign, reduceMotion = false) {
  const source = resolveThemeSource(themeOrDesign);
  const design = normalizeMyPageDesign(source.design || {}, source.coverStyle);
  const presetKey = resolveAnimationPreset(design.animationPreset);
  const preset = MY_PAGE_MOTION_PRESETS[presetKey] || MY_PAGE_MOTION_PRESETS.subtle;

  if (reduceMotion || presetKey === "off") {
    return {
      key: presetKey,
      enabled: false,
      switchInitial: false,
      switchAnimate: { opacity: 1, y: 0, scale: 1 },
      switchExit: { opacity: 1, y: 0, scale: 1 },
      switchTransition: { duration: 0 },
      loadingInitial: false,
      loadingAnimate: { opacity: 1, y: 0, scale: 1 },
      loadingExit: { opacity: 1, y: 0, scale: 1 },
      loadingTransition: { duration: 0 },
      containerVariants: {
        hidden: {},
        visible: { transition: { staggerChildren: 0 } },
      },
      itemVariants: {
        hidden: { opacity: 1, y: 0, scale: 1 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0 } },
      },
      primaryButtonsWrapperVariants: {
        hidden: {},
        visible: {},
      },
      primaryButtonVariants: {
        hidden: { opacity: 1, x: 0, y: 0, scale: 1 },
        visible: { opacity: 1, x: 0, y: 0, scale: 1, transition: { duration: 0 } },
      },
      buttonHover: undefined,
      buttonTap: undefined,
      buttonTransition: { duration: 0 },
    };
  }

  return {
    key: presetKey,
    enabled: true,
    switchInitial: {
      opacity: 0,
      y: preset.distance,
      scale: preset.scale,
    },
    switchAnimate: {
      opacity: 1,
      y: 0,
      scale: 1,
    },
    switchExit: {
      opacity: 0,
      y: -Math.max(10, Math.round(preset.distance * 0.5)),
      scale: 0.992,
    },
    switchTransition: {
      duration: preset.duration,
      ease: preset.ease,
    },
    loadingInitial: {
      opacity: 0,
      y: Math.round(preset.distance * 0.7),
      scale: preset.loadingScale,
    },
    loadingAnimate: {
      opacity: 1,
      y: 0,
      scale: 1,
    },
    loadingExit: {
      opacity: 0,
      y:
        presetKey === "impact"
          ? preset.loadingExitY
          : -Math.max(10, Math.round(preset.distance * 0.5)),
      scale:
        presetKey === "impact"
          ? preset.loadingExitScale
          : presetKey === "strong"
            ? 1.012
            : 0.996,
    },
    loadingTransition: {
      duration:
        presetKey === "impact"
          ? preset.loadingExitDuration
          : preset.loadingDuration,
      ease: preset.ease,
    },
    containerVariants: {
      hidden: {},
      visible: {
        transition: {
          staggerChildren: preset.stagger,
          delayChildren: 0.04,
        },
      },
    },
    itemVariants: {
      hidden: {
        opacity: 0,
        y: presetKey === "impact" ? preset.itemY : preset.distance,
        scale: presetKey === "impact" ? preset.itemScale : preset.scale,
      },
      visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
          duration: preset.duration,
          ease: preset.ease,
        },
      },
    },
    primaryButtonsWrapperVariants:
      presetKey === "impact"
        ? {
            hidden: {},
            visible: {
              transition: {
                staggerChildren: preset.buttonStagger,
                delayChildren: 0.02,
              },
            },
          }
        : {
            hidden: {
              opacity: 0,
              y: preset.distance,
              scale: preset.scale,
            },
            visible: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: {
                duration: preset.duration,
                ease: preset.ease,
              },
            },
          },
    primaryButtonVariants:
      presetKey === "impact"
        ? {
            hidden: {
              opacity: 0,
              x: preset.buttonEnterX,
              scale: preset.buttonEnterScale,
            },
            visible: (index = 0) => ({
              opacity: 1,
              x: 0,
              scale: 1,
              transition: {
                duration: preset.buttonDuration,
                ease: preset.buttonEase,
              },
            }),
          }
        : {
            hidden: { opacity: 1, x: 0, scale: 1 },
            visible: { opacity: 1, x: 0, scale: 1, transition: { duration: 0 } },
          },
    buttonHover: {
      y: preset.hoverY,
      scale: preset.hoverScale,
      ...(presetKey === "impact" ? { boxShadow: preset.buttonHoverShadow } : {}),
    },
    buttonTap: {
      scale: preset.tapScale || 0.992,
    },
    buttonTransition: {
      duration: preset.buttonTransitionDuration || 0.22,
      ease: preset.ease,
    },
  };
}

function buildPatternBackground(palette, patternVariant, fillBase) {
  const variant = valueFromOptions(
    patternVariant,
    MY_PAGE_BACKGROUND_PATTERN_VARIANT_OPTIONS.map((item) => item.value),
    MY_PAGE_DESIGN_DEFAULTS.backgroundPatternVariant,
  );

  if (variant === "morph") {
    return `linear-gradient(142deg, transparent 0 24%, ${palette.mesh} 24% 32%, transparent 32% 100%), radial-gradient(160px 88px at 18% 22%, ${palette.haze} 0 54%, transparent 57%), radial-gradient(128px 72px at 72% 24%, ${palette.glowSoft} 0 52%, transparent 55%), radial-gradient(152px 82px at 54% 72%, ${palette.mist} 0 46%, transparent 49%), radial-gradient(104px 58px at 88% 78%, ${palette.line} 0 42%, transparent 45%), ${fillBase}`;
  }

  if (variant === "organic") {
    return `radial-gradient(160px 100px at 12% 18%, ${palette.haze} 0 46%, transparent 49%), radial-gradient(190px 104px at 82% 20%, ${palette.glowSoft} 0 44%, transparent 47%), radial-gradient(172px 96px at 30% 82%, ${palette.mist} 0 42%, transparent 45%), radial-gradient(148px 80px at 86% 76%, ${palette.mesh} 0 36%, transparent 39%), ${fillBase}`;
  }

  if (variant === "matrix") {
    return `linear-gradient(180deg, ${palette.shadow} 0%, transparent 28%), repeating-linear-gradient(90deg, transparent 0 17px, ${palette.line} 17px 18px), repeating-linear-gradient(180deg, transparent 0 17px, ${palette.line} 17px 18px), radial-gradient(circle at 1px 1px, ${palette.dot} 0 1.4px, transparent 1.6px) 0 0 / 18px 18px repeat, ${fillBase}`;
  }

  return `repeating-linear-gradient(90deg, transparent 0 34px, ${palette.line} 34px 35px), repeating-linear-gradient(180deg, transparent 0 34px, ${palette.line} 34px 35px), radial-gradient(circle at 18% 18%, ${palette.haze}, transparent 24%), ${fillBase}`;
}

function buildGradientBackground(palette, gradientDirection) {
  const direction = valueFromOptions(
    gradientDirection,
    MY_PAGE_BACKGROUND_GRADIENT_DIRECTION_OPTIONS.map((item) => item.value),
    MY_PAGE_DESIGN_DEFAULTS.backgroundGradientDirection,
  );

  if (direction === "linear_down") {
    return `linear-gradient(180deg, ${palette.base} 0%, ${palette.top} 34%, ${palette.light} 72%, ${palette.wash} 100%)`;
  }

  if (direction === "radial") {
    return `radial-gradient(circle at 50% 50%, ${palette.base} 0%, ${palette.top} 34%, ${palette.light} 68%, ${palette.wash} 100%)`;
  }

  return `linear-gradient(180deg, ${palette.wash} 0%, ${palette.light} 36%, ${palette.top} 68%, ${palette.base} 100%)`;
}

function buildBackgroundOverlayItems(backgroundStyle, palette) {
  if (backgroundStyle !== "blur") return [];

  return [
    {
      key: "blur-a",
      style: {
        width: "48%",
        height: "30%",
        left: "-10%",
        top: "8%",
        borderRadius: "999px",
        background: `radial-gradient(circle at 38% 38%, ${palette.mist} 0%, ${palette.haze} 44%, transparent 76%)`,
        filter: "blur(44px)",
        opacity: 0.96,
      },
    },
    {
      key: "blur-b",
      style: {
        width: "42%",
        height: "28%",
        right: "-8%",
        top: "18%",
        borderRadius: "999px",
        background: `radial-gradient(circle at 50% 45%, ${palette.glow} 0%, ${palette.glowSoft} 48%, transparent 78%)`,
        filter: "blur(56px)",
        opacity: 0.88,
      },
    },
    {
      key: "blur-c",
      style: {
        width: "52%",
        height: "32%",
        left: "24%",
        bottom: "-8%",
        borderRadius: "999px",
        background: `radial-gradient(circle at 50% 42%, ${palette.lineStrong} 0%, ${palette.mesh} 46%, transparent 80%)`,
        filter: "blur(52px)",
        opacity: 0.78,
      },
    },
  ];
}

function buildBackground(
  _preset,
  _accent,
  backgroundStyle,
  backgroundColor,
  backgroundGradientDirection,
  backgroundPatternVariant,
) {
  const palette = buildBackgroundPalette(backgroundColor);
  const fillBase = palette.base;
  const tonalBase = `linear-gradient(180deg, ${palette.light} 0%, ${palette.base} 54%, ${palette.dark} 100%)`;

  if (backgroundStyle === "gradient") {
    return buildGradientBackground(palette, backgroundGradientDirection);
  }

  if (backgroundStyle === "blur") {
    return fillBase;
  }

  if (backgroundStyle === "pattern") {
    return buildPatternBackground(
      palette,
      backgroundPatternVariant,
      tonalBase,
    );
  }

  return fillBase;
}

function buildHeroBackground(
  preset,
  accent,
  backgroundStyle,
  backgroundColor,
  backgroundGradientDirection,
  backgroundPatternVariant,
  imageUrl,
) {
  const safeUrl = escapeCssUrl(imageUrl);
  return `linear-gradient(180deg, ${preset.heroOverlayFrom} 0%, ${preset.heroOverlayTo} 100%), url("${safeUrl}") center/cover no-repeat, ${buildBackground(
    preset,
    accent,
    backgroundStyle,
    backgroundColor,
    backgroundGradientDirection,
    backgroundPatternVariant,
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

function buildSurfaceTokens(surfaceColor) {
  const base = normalizeHexColor(surfaceColor, MY_PAGE_DESIGN_DEFAULTS.surfaceColor);
  const dark = isDarkColor(base);
  const top = dark ? lightenHex(base, 0.08) : mixHexColors(base, "#FFFFFF", 0.22);
  const mid = dark ? lightenHex(base, 0.04) : mixHexColors(base, "#FFFFFF", 0.12);
  const low = dark ? darkenHex(base, 0.16) : mixHexColors(base, "#0F172A", 0.06);
  const edge = mixHexColors(base, dark ? "#FFFFFF" : "#0F172A", dark ? 0.18 : 0.14);
  const strongEdge = mixHexColors(
    base,
    dark ? "#FFFFFF" : "#0F172A",
    dark ? 0.32 : 0.22,
  );
  const highlight = mixHexColors(top, "#FFFFFF", dark ? 0.28 : 0.56);
  const shadowBase = mixHexColors(base, "#08111F", dark ? 0.52 : 0.26);

  return {
    base,
    dark,
    top,
    mid,
    low,
    edge,
    strongEdge,
    highlight,
    glow: alphaColor(base, dark ? 0.24 : 0.14),
    shadow: alphaColor(shadowBase, dark ? 0.42 : 0.18),
  };
}

function buildSurfaceBaseFill(surface, tone = "main") {
  const profile =
    tone === "soft"
      ? {
          top: surface.dark ? 0.76 : 0.92,
          base: surface.dark ? 0.62 : 0.82,
          low: surface.dark ? 0.48 : 0.74,
        }
      : tone === "preview"
        ? {
            top: surface.dark ? 0.92 : 0.98,
            base: surface.dark ? 0.82 : 0.92,
            low: surface.dark ? 0.72 : 0.84,
          }
        : {
            top: surface.dark ? 0.94 : 0.98,
            base: surface.dark ? 0.82 : 0.9,
            low: surface.dark ? 0.72 : 0.84,
          };

  return `linear-gradient(180deg, ${alphaColor(surface.top, profile.top)} 0%, ${alphaColor(surface.base, profile.base)} 58%, ${alphaColor(surface.low, profile.low)} 100%)`;
}

function buildSurfacePatternPalette(surface, tone = "main") {
  const profile =
    tone === "soft"
      ? {
          line: surface.dark ? 0.12 : 0.08,
          haze: surface.dark ? 0.18 : 0.12,
          glowSoft: surface.dark ? 0.16 : 0.1,
          mist: surface.dark ? 0.18 : 0.12,
          mesh: surface.dark ? 0.14 : 0.09,
          lineStrong: surface.dark ? 0.24 : 0.14,
          dot: surface.dark ? 0.18 : 0.12,
          shadow: surface.dark ? 0.16 : 0.1,
        }
      : tone === "preview"
        ? {
            line: surface.dark ? 0.18 : 0.13,
            haze: surface.dark ? 0.24 : 0.17,
            glowSoft: surface.dark ? 0.22 : 0.15,
            mist: surface.dark ? 0.24 : 0.17,
            mesh: surface.dark ? 0.18 : 0.13,
            lineStrong: surface.dark ? 0.3 : 0.2,
            dot: surface.dark ? 0.24 : 0.17,
            shadow: surface.dark ? 0.2 : 0.14,
          }
        : {
            line: surface.dark ? 0.22 : 0.16,
            haze: surface.dark ? 0.28 : 0.2,
            glowSoft: surface.dark ? 0.24 : 0.18,
            mist: surface.dark ? 0.28 : 0.2,
            mesh: surface.dark ? 0.22 : 0.16,
            lineStrong: surface.dark ? 0.36 : 0.24,
            dot: surface.dark ? 0.28 : 0.2,
            shadow: surface.dark ? 0.24 : 0.16,
          };

  return {
    line: alphaColor(lightenHex(surface.base, surface.dark ? 0.22 : 0.18), profile.line),
    haze: alphaColor(lightenHex(surface.base, surface.dark ? 0.16 : 0.12), profile.haze),
    glowSoft: alphaColor(
      lightenHex(surface.base, surface.dark ? 0.1 : 0.08),
      profile.glowSoft,
    ),
    mist: alphaColor(lightenHex(surface.base, surface.dark ? 0.24 : 0.18), profile.mist),
    mesh: alphaColor(lightenHex(surface.base, surface.dark ? 0.2 : 0.16), profile.mesh),
    lineStrong: alphaColor(
      lightenHex(surface.base, surface.dark ? 0.3 : 0.24),
      profile.lineStrong,
    ),
    dot: alphaColor(lightenHex(surface.base, surface.dark ? 0.36 : 0.28), profile.dot),
    shadow: alphaColor(darkenHex(surface.base, surface.dark ? 0.14 : 0.1), profile.shadow),
  };
}

function buildSurfacePatternFill(surface, patternVariant, tone = "main") {
  const variant = valueFromOptions(
    patternVariant,
    MY_PAGE_SURFACE_PATTERN_VARIANT_OPTIONS.map((item) => item.value),
    MY_PAGE_DESIGN_DEFAULTS.surfacePatternVariant,
  );
  const palette = buildSurfacePatternPalette(surface, tone);
  const fillBase = buildSurfaceBaseFill(surface, tone);
  const scale = tone === "preview" ? 0.62 : tone === "soft" ? 0.82 : 1;
  const scaled = (value) => Number((value * scale).toFixed(1));
  const px = (value) => `${scaled(value)}px`;

  if (variant === "morph") {
    return `linear-gradient(144deg, transparent 0 18%, ${palette.mesh} 18% 34%, transparent 34% 54%, ${palette.lineStrong} 54% 68%, transparent 68% 100%), linear-gradient(112deg, transparent 0 42%, ${palette.shadow} 42% 54%, transparent 54% 100%), radial-gradient(${px(176)} ${px(104)} at 20% 24%, ${palette.haze} 0 48%, transparent 54%), radial-gradient(${px(148)} ${px(88)} at 78% 24%, ${palette.glowSoft} 0 42%, transparent 48%), radial-gradient(${px(208)} ${px(122)} at 60% 86%, ${palette.mist} 0 34%, transparent 42%), ${fillBase}`;
  }

  if (variant === "organic") {
    return `radial-gradient(${px(224)} ${px(136)} at 14% 16%, ${palette.haze} 0 42%, transparent 48%), radial-gradient(${px(260)} ${px(160)} at 88% 18%, ${palette.glowSoft} 0 38%, transparent 45%), radial-gradient(${px(238)} ${px(148)} at 24% 92%, ${palette.mist} 0 32%, transparent 40%), radial-gradient(${px(184)} ${px(112)} at 88% 78%, ${palette.mesh} 0 30%, transparent 38%), linear-gradient(160deg, transparent 0 64%, ${palette.shadow} 64% 82%, transparent 82% 100%), ${fillBase}`;
  }

  if (variant === "matrix") {
    return `linear-gradient(180deg, ${palette.shadow} 0%, transparent 34%), repeating-linear-gradient(90deg, transparent 0 ${px(13)}, ${palette.line} ${px(13)} ${px(14)}, transparent ${px(14)} ${px(27)}, ${palette.lineStrong} ${px(27)} ${px(28)}), repeating-linear-gradient(180deg, transparent 0 ${px(13)}, ${palette.line} ${px(13)} ${px(14)}, transparent ${px(14)} ${px(27)}, ${palette.lineStrong} ${px(27)} ${px(28)}), radial-gradient(circle at ${px(1.5)} ${px(1.5)}, ${palette.dot} 0 ${px(1.5)}, transparent ${px(1.8)}) 0 0 / ${px(14)} ${px(14)} repeat, linear-gradient(90deg, transparent 0 49%, ${palette.mesh} 49% 51%, transparent 51% 100%), ${fillBase}`;
  }

  return `repeating-linear-gradient(90deg, transparent 0 ${px(42)}, ${palette.lineStrong} ${px(42)} ${px(44)}), repeating-linear-gradient(180deg, transparent 0 ${px(42)}, ${palette.lineStrong} ${px(42)} ${px(44)}), repeating-linear-gradient(90deg, transparent 0 ${px(21)}, ${palette.line} ${px(21)} ${px(22)}, transparent ${px(22)} ${px(42)}), repeating-linear-gradient(180deg, transparent 0 ${px(21)}, ${palette.line} ${px(21)} ${px(22)}, transparent ${px(22)} ${px(42)}), radial-gradient(${px(220)} ${px(132)} at 16% 18%, ${palette.haze} 0 26%, transparent 54%), linear-gradient(135deg, transparent 0 72%, ${palette.shadow} 72% 88%, transparent 88% 100%), ${fillBase}`;
}

function buildSurfaceBlurFill(surface, tone = "main") {
  const profile =
    tone === "soft"
      ? {
          orbA: surface.dark ? 0.12 : 0.08,
          orbB: surface.dark ? 0.1 : 0.07,
          orbC: surface.dark ? 0.12 : 0.08,
          backdrop: "blur(14px) saturate(1.06)",
        }
      : tone === "preview"
        ? {
            orbA: surface.dark ? 0.2 : 0.14,
            orbB: surface.dark ? 0.16 : 0.12,
            orbC: surface.dark ? 0.18 : 0.12,
            backdrop: "blur(18px) saturate(1.08)",
          }
        : {
            orbA: surface.dark ? 0.22 : 0.16,
            orbB: surface.dark ? 0.18 : 0.12,
            orbC: surface.dark ? 0.2 : 0.14,
            backdrop: "blur(18px) saturate(1.08)",
          };

  return {
    background: [
      `radial-gradient(140px 84px at 14% 18%, ${alphaColor(lightenHex(surface.base, 0.18), profile.orbA)} 0%, transparent 68%)`,
      `radial-gradient(128px 78px at 84% 22%, ${alphaColor(lightenHex(surface.base, 0.1), profile.orbB)} 0%, transparent 66%)`,
      `radial-gradient(168px 96px at 56% 86%, ${alphaColor(lightenHex(surface.base, 0.24), profile.orbC)} 0%, transparent 70%)`,
      buildSurfaceBaseFill(surface, tone),
    ].join(", "),
    backdropFilter: profile.backdrop,
    WebkitBackdropFilter: profile.backdrop,
  };
}

function buildSurfaceLayerStyles(
  surface,
  variant,
  fontFamily,
  pageTextColor,
  surfacePatternVariant,
) {
  const shared = {
    color: pageTextColor,
    fontFamily,
  };

  if (variant === "solid") {
    return {
      main: {
        borderColor: alphaColor(surface.strongEdge, surface.dark ? 0.76 : 0.24),
        background: `linear-gradient(180deg, ${surface.top} 0%, ${surface.base} 58%, ${surface.low} 100%)`,
        boxShadow: [
          `inset 0 1px 0 ${alphaColor(surface.highlight, surface.dark ? 0.14 : 0.72)}`,
          `0 30px 72px -48px ${surface.shadow}`,
        ].join(", "),
        ...shared,
      },
      soft: {
        borderColor: alphaColor(surface.edge, surface.dark ? 0.46 : 0.18),
        background: `linear-gradient(180deg, ${alphaColor(surface.top, surface.dark ? 0.92 : 0.98)} 0%, ${alphaColor(surface.base, surface.dark ? 0.78 : 0.88)} 100%)`,
        boxShadow: `0 22px 54px -46px ${surface.glow}`,
        ...shared,
      },
      preview: {
        borderColor: alphaColor(surface.strongEdge, surface.dark ? 0.7 : 0.2),
        background: `linear-gradient(180deg, ${surface.top} 0%, ${surface.base} 62%, ${surface.low} 100%)`,
        boxShadow: `0 26px 68px -44px ${surface.shadow}`,
      },
      input: {
        background: alphaColor(surface.mid, surface.dark ? 0.78 : 0.96),
        borderColor: alphaColor(surface.edge, surface.dark ? 0.42 : 0.18),
        boxShadow: `inset 0 1px 0 ${alphaColor(surface.highlight, surface.dark ? 0.08 : 0.52)}`,
        ...shared,
      },
    };
  }

  if (variant === "blur") {
    return {
      main: {
        borderColor: alphaColor(surface.highlight, surface.dark ? 0.28 : 0.42),
        ...buildSurfaceBlurFill(surface, "main"),
        boxShadow: [
          `inset 0 1px 0 ${alphaColor(surface.highlight, surface.dark ? 0.16 : 0.6)}`,
          `0 24px 60px -46px ${surface.shadow}`,
        ].join(", "),
        ...shared,
      },
      soft: {
        borderColor: alphaColor(surface.edge, surface.dark ? 0.24 : 0.18),
        ...buildSurfaceBlurFill(surface, "soft"),
        boxShadow: `0 20px 50px -46px ${surface.glow}`,
        ...shared,
      },
      preview: {
        borderColor: alphaColor(surface.highlight, surface.dark ? 0.32 : 0.46),
        ...buildSurfaceBlurFill(surface, "preview"),
        boxShadow: `0 26px 66px -42px ${surface.shadow}`,
      },
      input: {
        background: alphaColor(surface.mid, surface.dark ? 0.72 : 0.94),
        borderColor: alphaColor(surface.edge, surface.dark ? 0.28 : 0.18),
        boxShadow: `inset 0 1px 0 ${alphaColor(surface.highlight, surface.dark ? 0.1 : 0.44)}`,
        backdropFilter: "blur(12px) saturate(1.04)",
        WebkitBackdropFilter: "blur(12px) saturate(1.04)",
        ...shared,
      },
    };
  }

  if (variant === "pattern") {
    return {
      main: {
        borderColor: alphaColor(surface.strongEdge, surface.dark ? 0.58 : 0.22),
        background: buildSurfacePatternFill(
          surface,
          surfacePatternVariant,
          "main",
        ),
        boxShadow: `0 24px 58px -44px ${surface.shadow}`,
        ...shared,
      },
      soft: {
        borderColor: alphaColor(surface.edge, surface.dark ? 0.28 : 0.16),
        background: buildSurfacePatternFill(
          surface,
          surfacePatternVariant,
          "soft",
        ),
        boxShadow: `0 18px 44px -42px ${surface.glow}`,
        ...shared,
      },
      preview: {
        borderColor: alphaColor(surface.strongEdge, surface.dark ? 0.62 : 0.24),
        background: buildSurfacePatternFill(
          surface,
          surfacePatternVariant,
          "preview",
        ),
        boxShadow: `0 26px 62px -40px ${surface.shadow}`,
      },
      input: {
        background: alphaColor(surface.mid, surface.dark ? 0.72 : 0.94),
        borderColor: alphaColor(surface.edge, surface.dark ? 0.28 : 0.16),
        boxShadow: `inset 0 1px 0 ${alphaColor(surface.highlight, surface.dark ? 0.1 : 0.42)}`,
        ...shared,
      },
    };
  }

  if (variant === "glass") {
    const glassBorder = alphaColor(surface.highlight, surface.dark ? 0.32 : 0.5);
    const glassBackdrop = {
      backdropFilter: "blur(20px) saturate(1.14)",
      WebkitBackdropFilter: "blur(20px) saturate(1.14)",
    };

    return {
      main: {
        borderColor: glassBorder,
        background: [
          `linear-gradient(180deg, ${alphaColor(surface.highlight, surface.dark ? 0.2 : 0.58)} 0%, ${alphaColor(surface.highlight, surface.dark ? 0.05 : 0.14)} 16%, transparent 46%)`,
          `linear-gradient(135deg, ${alphaColor(surface.top, surface.dark ? 0.2 : 0.34)} 0%, ${alphaColor(surface.base, surface.dark ? 0.24 : 0.14)} 100%)`,
        ].join(", "),
        boxShadow: [
          `inset 0 1px 0 ${alphaColor(surface.highlight, surface.dark ? 0.18 : 0.56)}`,
          `0 26px 64px -48px ${surface.shadow}`,
        ].join(", "),
        ...glassBackdrop,
        ...shared,
      },
      soft: {
        borderColor: alphaColor(surface.highlight, surface.dark ? 0.24 : 0.42),
        background: [
          `linear-gradient(180deg, ${alphaColor(surface.highlight, surface.dark ? 0.14 : 0.42)} 0%, transparent 28%)`,
          `linear-gradient(135deg, ${alphaColor(surface.top, surface.dark ? 0.16 : 0.22)} 0%, ${alphaColor(surface.base, surface.dark ? 0.18 : 0.1)} 100%)`,
        ].join(", "),
        boxShadow: `0 22px 54px -48px ${surface.glow}`,
        ...glassBackdrop,
        ...shared,
      },
      preview: {
        borderColor: glassBorder,
        background: [
          `linear-gradient(180deg, ${alphaColor(surface.highlight, surface.dark ? 0.22 : 0.62)} 0%, transparent 24%)`,
          `linear-gradient(135deg, ${alphaColor(surface.top, surface.dark ? 0.22 : 0.34)} 0%, ${alphaColor(surface.base, surface.dark ? 0.28 : 0.16)} 100%)`,
        ].join(", "),
        boxShadow: `0 28px 70px -42px ${surface.shadow}`,
        ...glassBackdrop,
      },
      input: {
        background: [
          `linear-gradient(180deg, ${alphaColor(surface.highlight, surface.dark ? 0.12 : 0.3)} 0%, transparent 24%)`,
          `linear-gradient(135deg, ${alphaColor(surface.top, surface.dark ? 0.14 : 0.18)} 0%, ${alphaColor(surface.base, surface.dark ? 0.2 : 0.12)} 100%)`,
        ].join(", "),
        borderColor: alphaColor(surface.highlight, surface.dark ? 0.24 : 0.38),
        boxShadow: `inset 0 1px 0 ${alphaColor(surface.highlight, surface.dark ? 0.12 : 0.44)}`,
        ...glassBackdrop,
        ...shared,
      },
    };
  }

  if (variant === "outline") {
    return {
      main: {
        borderColor: alphaColor(surface.strongEdge, surface.dark ? 0.56 : 0.24),
        background: alphaColor(surface.base, surface.dark ? 0.08 : 0.04),
        boxShadow: `inset 0 1px 0 ${alphaColor(surface.highlight, surface.dark ? 0.08 : 0.48)}`,
        ...shared,
      },
      soft: {
        borderColor: alphaColor(surface.edge, surface.dark ? 0.42 : 0.18),
        background: alphaColor(surface.base, surface.dark ? 0.12 : 0.06),
        boxShadow: "none",
        ...shared,
      },
      preview: {
        borderColor: alphaColor(surface.strongEdge, surface.dark ? 0.5 : 0.22),
        background: alphaColor(surface.base, surface.dark ? 0.1 : 0.05),
        boxShadow: `0 18px 48px -44px ${surface.glow}`,
      },
      input: {
        background: alphaColor(surface.base, surface.dark ? 0.12 : 0.08),
        borderColor: alphaColor(surface.edge, surface.dark ? 0.36 : 0.18),
        boxShadow: "none",
        ...shared,
      },
    };
  }

  return {
    main: {
      borderColor: alphaColor(surface.edge, surface.dark ? 0.52 : 0.18),
      background: `linear-gradient(180deg, ${alphaColor(surface.top, surface.dark ? 0.94 : 0.98)} 0%, ${alphaColor(surface.base, surface.dark ? 0.8 : 0.9)} 100%)`,
      boxShadow: `0 28px 68px -46px ${surface.glow}`,
      ...shared,
    },
    soft: {
      borderColor: alphaColor(surface.edge, surface.dark ? 0.42 : 0.16),
      background: `linear-gradient(180deg, ${alphaColor(surface.mid, surface.dark ? 0.72 : 0.88)} 0%, ${alphaColor(surface.base, surface.dark ? 0.58 : 0.76)} 100%)`,
      boxShadow: `0 18px 44px -42px ${surface.glow}`,
      ...shared,
    },
    preview: {
      borderColor: alphaColor(surface.strongEdge, surface.dark ? 0.48 : 0.18),
      background: `linear-gradient(180deg, ${alphaColor(surface.top, surface.dark ? 0.96 : 0.98)} 0%, ${alphaColor(surface.base, surface.dark ? 0.84 : 0.92)} 100%)`,
      boxShadow: `0 24px 62px -42px ${surface.shadow}`,
    },
    input: {
      background: alphaColor(surface.mid, surface.dark ? 0.7 : 0.94),
      borderColor: alphaColor(surface.edge, surface.dark ? 0.38 : 0.16),
      boxShadow: `inset 0 1px 0 ${alphaColor(surface.highlight, surface.dark ? 0.08 : 0.46)}`,
      ...shared,
    },
  };
}

function buildPrimaryButtonStyle(
  _preset,
  accent,
  buttonStyle,
  buttonShadow,
  fontFamily,
) {
  let style;

  if (buttonStyle === "metallic") {
    style = {
      border: `1px solid ${buildMetallicBorder(accent)}`,
      color: accent.contrast,
      background: buildMetallicBackground(accent, "primary"),
      boxShadow: buildMetallicShadow(accent, "primary"),
      fontFamily,
    };
  } else if (buttonStyle === "glass") {
    style = buildGlassButtonStyle(accent, fontFamily, "primary");
  } else if (buttonStyle === "soft") {
    style = {
      border: `1px solid ${accent.border}`,
      color: accent.contrast,
      background: `linear-gradient(180deg, ${accent.tintSoft}, ${accent.tint})`,
      boxShadow: `0 18px 38px -28px ${accent.glow}`,
      fontFamily,
    };
  } else if (buttonStyle === "outline") {
    style = {
      border: `1px solid ${accent.border}`,
      color: accent.contrast,
      background: alphaColor(accent.from, 0.12),
      boxShadow: "none",
      fontFamily,
    };
  } else {
    style = {
      border: `1px solid ${accent.border}`,
      color: accent.contrast,
      background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
      boxShadow: `0 20px 44px -28px ${accent.glow}`,
      fontFamily,
    };
  }

  return applyButtonShadowStyle(style, buttonShadow);
}

function buildSecondaryButtonStyle(
  _preset,
  accent,
  buttonStyle,
  buttonShadow,
  fontFamily,
) {
  let style;

  if (buttonStyle === "metallic") {
    style = {
      border: `1px solid ${buildMetallicBorder(accent)}`,
      color: accent.contrast,
      background: buildMetallicBackground(accent, "secondary"),
      boxShadow: buildMetallicShadow(accent, "secondary"),
      fontFamily,
    };
  } else if (buttonStyle === "glass") {
    style = buildGlassButtonStyle(accent, fontFamily, "secondary");
  } else if (buttonStyle === "soft") {
    style = {
      border: `1px solid ${accent.border}`,
      color: accent.contrast,
      background: `linear-gradient(180deg, ${accent.tintSoft}, ${alphaColor(accent.to, 0.18)})`,
      boxShadow: `0 14px 30px -26px ${accent.glow}`,
      fontFamily,
    };
  } else if (buttonStyle === "outline") {
    style = {
      border: `1px solid ${accent.border}`,
      color: accent.contrast,
      background: alphaColor(accent.from, 0.08),
      boxShadow: "none",
      fontFamily,
    };
  } else {
    style = {
      border: `1px solid ${accent.border}`,
      color: accent.contrast,
      background: `linear-gradient(180deg, ${accent.from}, ${accent.to})`,
      boxShadow: `0 16px 34px -28px ${accent.glow}`,
      fontFamily,
    };
  }

  return applyButtonShadowStyle(style, buttonShadow);
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
  const titleTextColor = normalizeHexColor(
    design.titleTextColor,
    preset.text || MY_PAGE_DESIGN_DEFAULTS.titleTextColor,
  );
  const pageTextColor = normalizeHexColor(
    design.pageTextColor,
    preset.muted || MY_PAGE_DESIGN_DEFAULTS.pageTextColor,
  );
  const surfaceBaseColor = normalizeHexColor(
    design.surfaceColor,
    getMyPageThemePresetDefaults(presetKey).surfaceColor,
  );
  const accentBase = normalizeHexColor(
    design.buttonColor,
    ACCENT_SWATCHES[design.accentPalette] ||
      preset.accentFrom ||
      MY_PAGE_DESIGN_DEFAULTS.buttonColor,
  );
  const accentContrast = normalizeHexColor(
    design.buttonTextColor,
    getReadableTextColor(accentBase, "#FFFFFF", "#111827"),
  );
  const accent = buildAccentTokens(accentBase, accentContrast, titleTextColor);
  const backgroundPalette = buildBackgroundPalette(design.backgroundColor);
  const backgroundOverlayItems = buildBackgroundOverlayItems(
    design.backgroundStyle,
    backgroundPalette,
  );
  const surfaceTokens = buildSurfaceTokens(surfaceBaseColor);
  const surfaceLayers = buildSurfaceLayerStyles(
    surfaceTokens,
    design.surfaceStyle,
    fontFamily,
    pageTextColor,
    design.surfacePatternVariant,
  );
  const shouldUseHeroPageBackground =
    usesHeroLayout && design.backgroundStyle !== "blur";

  const rootStyle = {
    minHeight: "100vh",
    background: shouldUseHeroPageBackground
        ? buildHeroBackground(
            preset,
            accent,
            design.backgroundStyle,
            design.backgroundColor,
            design.backgroundGradientDirection,
            design.backgroundPatternVariant,
            avatarUrl,
          )
      : buildBackground(
          preset,
          accent,
          design.backgroundStyle,
          design.backgroundColor,
          design.backgroundGradientDirection,
          design.backgroundPatternVariant,
        ),
    color: pageTextColor,
    fontFamily,
  };

  const surfaceStyle = surfaceLayers.main;
  const softSurfaceStyle = surfaceLayers.soft;

  const accentTextStyle = { color: accent.softText };
  const mutedTextStyle = { color: pageTextColor };
  const dividerStyle = { borderColor: surfaceLayers.soft.borderColor };
  const previewFrameStyle = surfaceLayers.preview;
  const primaryButtonStyle = buildPrimaryButtonStyle(
    preset,
    accent,
    design.buttonStyle,
    design.buttonShadow,
    fontFamily,
  );
  const secondaryButtonStyle = buildSecondaryButtonStyle(
    preset,
    accent,
    design.buttonStyle,
    design.buttonShadow,
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
    headingStyle: { color: titleTextColor, fontFamily: headingFontFamily },
    titleStyle: { color: titleTextColor, fontFamily: headingFontFamily },
    buttonRadiusClassName:
      BUTTON_RADIUS_CLASSNAMES[design.buttonRadius] ||
      BUTTON_RADIUS_CLASSNAMES.round,
    buttonIconRadiusClassName:
      BUTTON_ICON_RADIUS_CLASSNAMES[design.buttonRadius] ||
      BUTTON_ICON_RADIUS_CLASSNAMES.round,
    rootStyle,
    backgroundOverlayItems,
    heroMediaStyle: usesHeroLayout
      ? buildHeroMediaStyle(preset, accent, avatarUrl)
      : null,
    surfaceStyle,
    softSurfaceStyle,
    accentTextStyle,
    mutedTextStyle,
    dividerStyle,
    previewFrameStyle,
    inputStyle: surfaceLayers.input,
    primaryButtonStyle,
    secondaryButtonStyle,
    activeCardStyle: {
      borderColor: accent.border,
      background: `linear-gradient(180deg, ${accent.tint}, ${alphaColor(accent.to, 0.14)})`,
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
      theme?.buttonRadiusClassName || BUTTON_RADIUS_CLASSNAMES.round,
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
