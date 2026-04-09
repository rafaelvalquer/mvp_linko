import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  CreditCard,
  FileText,
  Link2,
  ShoppingBag,
} from "lucide-react";
import {
  getMyPageHomeButtonProps,
  getMyPageMotionPreset,
  getMyPageButtonProps,
  getMyPageSelectableCardProps,
  getMyPageSurfaceProps,
  getMyPageTheme,
} from "./myPageTheme.js";
import {
  MyPagePublicAvatar,
  MyPageBackgroundOverlay,
  getMyPageButtonIcon,
  getMyPageButtonMetaLabel,
  MyPagePublicHeroMedia,
  MyPageSecondaryLinks,
} from "./MyPagePublicUi.jsx";

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function PreviewButton({
  children,
  theme,
  variant = "primary",
  className = "",
  buttonProps = null,
}) {
  const resolvedButtonProps = buttonProps || getMyPageButtonProps(theme, variant);
  return (
    <div
      className={cls(
        resolvedButtonProps.className,
        "w-full justify-between",
        className,
      )}
      style={resolvedButtonProps.style}
    >
      {children}
    </div>
  );
}

function PreviewCard({ theme, children, className = "", variant = "default" }) {
  const props = getMyPageSurfaceProps(theme, variant);
  return (
    <section {...props} className={cls(props.className, className)}>
      {children}
    </section>
  );
}

function PreviewSelectable({
  theme,
  children,
  className = "",
  active = false,
}) {
  const props = getMyPageSelectableCardProps(theme, active);
  return (
    <div style={props.style} className={cls(props.className, className)}>
      {children}
    </div>
  );
}

function PreviewField({ theme, className = "", children }) {
  return (
    <div
      className={cls("rounded-[20px] border px-3 py-2 text-xs", className)}
      style={theme.inputStyle}
    >
      {children}
    </div>
  );
}

function resolveHomeButtonVariant(theme, button, index) {
  if (theme?.layout?.homePrimaryAll) return "primary";
  if (theme?.layout?.homeHighlightFirst && index === 0) return "primary";
  return button?.type === "whatsapp" ? "primary" : "secondary";
}

function PreviewHeader({ page, theme, eyebrow, studio = false }) {
  return (
    <div className="space-y-3">
      <MyPagePublicHeroMedia
        page={page}
        theme={theme}
        className="w-full"
        heightClassName={
          studio
            ? theme?.layout?.previewMediaHeightClassName
            : "h-24"
        }
      />

      <div className={cls("gap-3", theme?.layout?.previewHeaderClassName)}>
        {theme.usesHeroLayout ? null : (
          <MyPagePublicAvatar
            page={page}
            theme={theme}
            sizeClassName={studio ? "h-14 w-14 rounded-full" : "h-12 w-12 rounded-full"}
            iconSizeClassName={studio ? "h-6 w-6" : "h-5 w-5"}
          />
        )}
        <div className="min-w-0">
          <div
            className="text-[10px] font-bold uppercase tracking-[0.18em]"
            style={theme.accentTextStyle}
          >
            {eyebrow}
          </div>
          <div
            className={cls(theme?.layout?.previewTitleClassName, studio ? "text-base" : "text-sm")}
            style={theme.titleStyle}
          >
            {page?.title || "Minha Pagina"}
          </div>
          {page?.subtitle ? (
            <div
              className={cls("mt-1 leading-5", studio ? "text-sm" : "text-xs")}
              style={theme.mutedTextStyle}
            >
              {page.subtitle}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DeviceShell({ theme, studio = false, children }) {
  const screenStyle = {
    ...theme.rootStyle,
    minHeight: studio ? "760px" : "600px",
    backgroundAttachment: "scroll",
  };

  return (
    <div
      className={cls(
        "mx-auto w-full",
        studio ? theme?.layout?.previewDeviceClassName : "max-w-[344px]",
      )}
    >
      <div
        className={cls(
          "rounded-[42px] border border-slate-950/80 bg-slate-950 p-2.5",
          studio
            ? "shadow-[0_44px_90px_-40px_rgba(15,23,42,0.7)]"
            : "shadow-[0_32px_72px_-42px_rgba(15,23,42,0.65)]",
        )}
      >
        <div className="flex justify-center pb-2">
          <div className="h-1.5 w-20 rounded-full bg-white/20" />
        </div>
        <div
          className="relative overflow-hidden rounded-[30px] border border-white/10"
          style={screenStyle}
        >
          <MyPageBackgroundOverlay theme={theme} />
          <div className={cls("relative z-10 space-y-4", studio ? "p-5" : "p-4")}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MyPageMobilePreview({
  page,
  mode = "home",
  variant = "default",
}) {
  const theme = getMyPageTheme(page || {});
  const shouldReduceMotion = useReducedMotion();
  const motionPreset = getMyPageMotionPreset(theme, shouldReduceMotion);
  const isStudio = variant === "studio";
  const buttons = (page?.buttons || [])
    .filter((button) => button.enabled)
    .slice(0, isStudio ? 4 : 3);
  const shopCount = Number(page?.summary?.selectedProductsCount || 0);
  const previewContentKey = [
    mode,
    theme?.design?.animationPreset,
    theme?.design?.primaryButtonsLayout,
    theme?.design?.secondaryLinksStyle,
    theme?.design?.secondaryLinksSize,
    theme?.design?.secondaryLinksAlign,
  ].join(":");

  return (
    <DeviceShell theme={theme} studio={isStudio}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={previewContentKey}
          initial={motionPreset.switchInitial}
          animate={motionPreset.switchAnimate}
          exit={motionPreset.switchExit}
          transition={motionPreset.switchTransition}
          className="space-y-4"
        >
      {mode === "catalog" ? (
        <PreviewCard
          theme={theme}
          className={cls(isStudio ? theme?.layout?.previewCardClassName : "p-4")}
        >
          <div className="space-y-3">
            <PreviewHeader page={page} theme={theme} eyebrow="Catalogo" studio={isStudio} />
            <div className={cls(theme?.layout?.catalogGridClassName, "grid-cols-1")}>
              {Array.from({ length: Math.max(shopCount || 2, 2) })
                .slice(0, 2)
                .map((_, index) => (
                  <PreviewSelectable
                    key={`catalog:${index}`}
                    theme={theme}
                    className={cls(isStudio ? "p-4" : "p-3")}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cls(
                          "flex items-center justify-center border",
                          theme.buttonIconRadiusClassName,
                          isStudio ? "h-14 w-14" : "h-12 w-12",
                        )}
                        style={theme.softSurfaceStyle}
                      >
                        <ShoppingBag className={cls(isStudio ? "h-6 w-6" : "h-5 w-5")} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className={cls(
                            "truncate font-semibold",
                            isStudio ? "text-base" : "text-sm",
                          )}
                          style={theme.headingStyle}
                        >
                          Produto do shop
                        </div>
                        <div className="mt-1 text-xs" style={theme.mutedTextStyle}>
                          Item publico
                        </div>
                      </div>
                    </div>
                  </PreviewSelectable>
                ))}
            </div>
            <PreviewButton theme={theme}>
              <span className="inline-flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Pedir orcamento
              </span>
            </PreviewButton>
          </div>
        </PreviewCard>
      ) : null}

      {mode === "quote" ? (
        <PreviewCard
          theme={theme}
          className={cls(isStudio ? theme?.layout?.previewCardClassName : "p-4")}
        >
          <div className="space-y-3">
            <PreviewHeader
              page={page}
              theme={theme}
              eyebrow="Pedir orcamento"
              studio={isStudio}
            />
            <PreviewCard
              theme={theme}
              variant="soft"
              className={cls("space-y-2", isStudio ? "p-4" : "p-3")}
            >
              <PreviewField theme={theme}>Nome</PreviewField>
              <PreviewField theme={theme}>WhatsApp</PreviewField>
              <PreviewField theme={theme} className="py-3">
                Conte o que voce precisa
              </PreviewField>
            </PreviewCard>
            <PreviewCard
              theme={theme}
              variant="soft"
              className={cls(isStudio ? "p-4" : "p-3")}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={theme.accentTextStyle}
              >
                Produtos
              </div>
              <div className="mt-2 text-xs" style={theme.mutedTextStyle}>
                {shopCount ? `${shopCount} item(ns)` : "Pedido geral"}
              </div>
            </PreviewCard>
            <PreviewButton theme={theme}>
              <span className="inline-flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Enviar solicitacao
              </span>
            </PreviewButton>
          </div>
        </PreviewCard>
      ) : null}

      {mode === "schedule" ? (
        <PreviewCard
          theme={theme}
          className={cls(isStudio ? theme?.layout?.previewCardClassName : "p-4")}
        >
          <div className="space-y-3">
            <PreviewHeader
              page={page}
              theme={theme}
              eyebrow="Agendar atendimento"
              studio={isStudio}
            />
            <div className="grid grid-cols-2 gap-2">
              {["09:00", "10:30", "14:00", "16:00"].map((slot) => (
                <PreviewSelectable
                  key={slot}
                  theme={theme}
                  className="px-3 py-3 text-center text-xs font-semibold"
                >
                  {slot}
                </PreviewSelectable>
              ))}
            </div>
            <PreviewButton theme={theme}>
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Confirmar horario
              </span>
            </PreviewButton>
          </div>
        </PreviewCard>
      ) : null}

      {mode === "pay" ? (
        <PreviewCard
          theme={theme}
          className={cls(isStudio ? theme?.layout?.previewCardClassName : "p-4")}
        >
          <div className="space-y-3">
            <PreviewHeader
              page={page}
              theme={theme}
              eyebrow="Pagar proposta"
              studio={isStudio}
            />
            <PreviewCard
              theme={theme}
              variant="soft"
              className={cls("space-y-2", isStudio ? "p-4" : "p-3")}
            >
              <div className="text-xs" style={theme.mutedTextStyle}>
                Digite o codigo publico ou cole o link recebido.
              </div>
              <PreviewField theme={theme}>LPABC123</PreviewField>
            </PreviewCard>
            <PreviewButton theme={theme}>
              <span className="inline-flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Abrir proposta
              </span>
            </PreviewButton>
          </div>
        </PreviewCard>
      ) : null}

      {mode === "home" ? (
        <PreviewCard
          theme={theme}
          className={cls(isStudio ? theme?.layout?.previewCardClassName : "p-4")}
        >
          <div className="space-y-4">
            <div className={cls(theme?.layout?.previewHeaderClassName)}>
              <MyPagePublicHeroMedia
                page={page}
                theme={theme}
                className="mb-4 w-full"
                heightClassName={
                  isStudio ? theme?.layout?.previewMediaHeightClassName : "h-28"
                }
              />
              {theme.usesHeroLayout ? null : (
                <MyPagePublicAvatar
                  page={page}
                  theme={theme}
                  sizeClassName={isStudio ? "h-20 w-20 rounded-full" : "h-16 w-16 rounded-full"}
                  iconSizeClassName={isStudio ? "h-8 w-8" : "h-6 w-6"}
                />
              )}
              <div className={theme?.layout?.previewTitleClassName} style={theme.titleStyle}>
                {page?.title || "Minha Pagina"}
              </div>
              {page?.subtitle ? (
                <div className="mt-2 text-sm font-semibold" style={theme.accentTextStyle}>
                  {page.subtitle}
                </div>
              ) : null}
              <div
                className={cls(
                  theme?.layout?.previewDescriptionClassName,
                  isStudio ? "max-w-[30ch] text-sm" : "text-xs",
                )}
                style={theme.mutedTextStyle}
              >
                {page?.description || "Centralize seus principais links."}
              </div>
            </div>

            <motion.div
              className={theme?.layout?.previewButtonsClassName || "space-y-2"}
              initial="hidden"
              animate="visible"
              variants={motionPreset.primaryButtonsWrapperVariants}
            >
              {buttons.length ? (
                buttons.map((button, index) => (
                  <HomePreviewButton
                    key={button.id}
                    theme={theme}
                    button={button}
                    index={index}
                    preview={isStudio}
                    motionPreset={motionPreset}
                  />
                ))
              ) : (
                <PreviewCard
                  theme={theme}
                  variant="soft"
                  className="p-3 text-center text-xs"
                >
                  Ative pelo menos um CTA em Links.
                </PreviewCard>
              )}
            </motion.div>

            <MyPageSecondaryLinks
              theme={theme}
              links={page?.socialLinks || []}
              interactive={false}
            />
          </div>
        </PreviewCard>
      ) : null}
        </motion.div>
      </AnimatePresence>
    </DeviceShell>
  );
}

function HomePreviewButton({ theme, button, index, preview, motionPreset }) {
  const variant = resolveHomeButtonVariant(theme, button, index);
  const Icon = getMyPageButtonIcon(button.type);
  const { buttonProps, layout } = getMyPageHomeButtonProps(theme, variant, {
    preview,
  });

  return (
    <motion.div variants={motionPreset.primaryButtonVariants} custom={index}>
      <PreviewButton theme={theme} buttonProps={buttonProps}>
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
                {getMyPageButtonMetaLabel(button.type)}
              </div>
            ) : null}
            <div className={layout.titleClassName}>{button.label}</div>
          </div>
        </div>
      </PreviewButton>
    </motion.div>
  );
}
