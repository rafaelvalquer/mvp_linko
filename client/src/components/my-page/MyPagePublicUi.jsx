import {
  CalendarDays,
  CreditCard,
  FileText,
  Link2,
  ShoppingBag,
} from "lucide-react";
import { motion } from "framer-motion";
import { FaWhatsapp } from "react-icons/fa";
import {
  FaFacebookF,
  FaGlobe,
  FaInstagram,
  FaTiktok,
  FaYoutube,
} from "react-icons/fa6";
import {
  getMyPageSecondaryLinksLayout,
  getMyPageButtonProps,
  getMyPageSelectableCardProps,
  getMyPageSurfaceProps,
  getMyPageTheme,
  resolveMyPageMediaUrl,
} from "./myPageTheme.js";

export function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

export const MyPageWhatsAppIcon = FaWhatsapp;

export function getMyPageButtonIcon(type) {
  if (type === "whatsapp") return MyPageWhatsAppIcon;
  if (type === "public_schedule") return CalendarDays;
  if (type === "public_offer") return FileText;
  if (type === "catalog") return ShoppingBag;
  if (type === "payment_link") return CreditCard;
  return Link2;
}

export function getMyPageButtonMetaLabel(type) {
  if (type === "whatsapp") return "WhatsApp";
  if (type === "public_schedule") return "Agenda";
  if (type === "public_offer") return "Orcamento";
  if (type === "catalog") return "Catalogo";
  if (type === "payment_link") return "Pagamento";
  return "Link";
}

export function getPublicButtonProps(theme, variant = "primary", className = "") {
  const buttonProps = getMyPageButtonProps(theme, variant);
  return {
    className: cls(buttonProps.className, className),
    style: buttonProps.style,
  };
}

export function getPublicSelectableCardProps(
  theme,
  active = false,
  className = "",
) {
  const cardProps = getMyPageSelectableCardProps(theme, active);
  return {
    className: cls(cardProps.className, className),
    style: cardProps.style,
  };
}

export function MyPagePublicScreen({ page, maxWidth = "", children }) {
  const theme = getMyPageTheme(page || {});
  const maxWidthClass = maxWidth || theme?.layout?.pageMaxWidthClassName || "max-w-6xl";

  return (
    <div
      className="relative min-h-screen overflow-hidden px-4 py-5 sm:px-6 lg:px-8"
      style={theme.rootStyle}
    >
      <MyPageBackgroundOverlay theme={theme} />
      <div
        className={cls(
          "relative z-10 mx-auto",
          maxWidthClass,
          theme?.layout?.screenGapClassName || "space-y-6",
        )}
      >
        {typeof children === "function" ? children(theme) : children}
      </div>
    </div>
  );
}

export function MyPageBackgroundOverlay({ theme, className = "" }) {
  if (!Array.isArray(theme?.backgroundOverlayItems) || !theme.backgroundOverlayItems.length) {
    return null;
  }

  return (
    <div className={cls("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {theme.backgroundOverlayItems.map((item) => (
        <div
          key={item.key}
          className="absolute"
          style={{
            transform: "translate3d(0,0,0)",
            ...item.style,
          }}
        />
      ))}
    </div>
  );
}

export function MyPagePublicCard({
  theme,
  variant = "default",
  className = "",
  children,
}) {
  const surfaceProps = getMyPageSurfaceProps(theme, variant);
  return (
    <section
      className={cls(surfaceProps.className, className)}
      style={surfaceProps.style}
    >
      {children}
    </section>
  );
}

export function MyPagePublicAvatar({
  page,
  theme,
  sizeClassName = "h-16 w-16 rounded-full",
  iconSizeClassName = "h-5 w-5",
}) {
  const avatarSrc = resolveMyPageMediaUrl(page?.avatarUrl);

  if (avatarSrc) {
    return (
      <img
        src={avatarSrc}
        alt={page?.title || "Minha Pagina"}
        className={cls(sizeClassName, "object-cover")}
      />
    );
  }

  return (
    <div
      className={cls("flex items-center justify-center", sizeClassName)}
      style={theme.primaryButtonStyle}
    >
      <Link2 className={iconSizeClassName} />
    </div>
  );
}

export function MyPagePublicHeroMedia({
  page,
  theme,
  className = "",
  heightClassName = "",
}) {
  if (!theme?.usesHeroLayout || !page?.avatarUrl) return null;

  return (
    <div
      className={cls("overflow-hidden rounded-[28px] border", className)}
      style={theme.heroMediaStyle}
    >
      <div
        className={cls(
          "w-full",
          heightClassName || theme?.layout?.heroMediaHeightClassName,
        )}
      />
    </div>
  );
}

export function MyPagePublicHero({
  page,
  theme,
  eyebrow,
  title,
  description,
  actions = null,
}) {
  const titleValue = title || page?.title || "Minha Pagina";
  const descriptionValue = description || page?.description || "";

  return (
    <div className={theme?.layout?.heroSectionClassName || "space-y-4"}>
      <MyPagePublicHeroMedia page={page} theme={theme} />

      <div
        className={
          theme?.layout?.heroContainerClassName ||
          "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
        }
      >
        <div
          className={
            theme?.layout?.heroCopyClassName || "flex min-w-0 flex-1 items-start gap-4"
          }
        >
          {theme?.usesHeroLayout ? null : (
            <MyPagePublicAvatar
              page={page}
              theme={theme}
              sizeClassName={theme?.layout?.heroAvatarSizeClassName}
              iconSizeClassName={theme?.layout?.heroAvatarIconSizeClassName}
            />
          )}

          <div
            className={cls(
              "flex flex-col",
              theme?.layout?.heroTextWrapClassName,
              theme?.layout?.heroTextAlignClassName,
            )}
          >
            <div
              className="text-[11px] font-bold uppercase tracking-[0.22em]"
              style={theme.accentTextStyle}
            >
              {eyebrow}
            </div>
            <h1 className={theme?.layout?.heroTitleClassName} style={theme.titleStyle}>
              {titleValue}
            </h1>
            {page?.subtitle ? (
              <div
                className="mt-2 text-sm font-semibold"
                style={{
                  ...theme.accentTextStyle,
                  fontFamily: theme.headingFontFamily,
                }}
              >
                {page.subtitle}
              </div>
            ) : null}
            {descriptionValue ? (
              <p
                className={cls(
                  "mt-3 text-sm leading-6",
                  theme?.layout?.heroDescriptionMaxClassName,
                )}
                style={theme.mutedTextStyle}
              >
                {descriptionValue}
              </p>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className={theme?.layout?.heroActionsClassName || "flex flex-wrap gap-3"}>
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MyPagePublicFooter({ theme }) {
  return <div className="pt-1" style={theme.mutedTextStyle} />;
}

export function MyPagePublicLoadingSplash({
  theme,
  motionPreset,
  className = "",
}) {
  const accentBackground =
    theme?.primaryButtonStyle?.background ||
    theme?.activeCardStyle?.background ||
    "linear-gradient(135deg, rgba(37,99,235,0.9), rgba(20,184,166,0.8))";
  const softBackground =
    theme?.softSurfaceStyle?.background ||
    "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05))";
  const isImpact = motionPreset?.key === "impact" && motionPreset?.enabled !== false;
  const isStrong = motionPreset?.key === "strong" && motionPreset?.enabled !== false;
  const isOff = motionPreset?.enabled === false || motionPreset?.key === "off";
  const orbAnimate = isOff
    ? undefined
    : isImpact
      ? { scale: [1, 1.18, 0.94, 1.04, 1], opacity: [0.24, 0.5, 0.2, 0.34, 0.24] }
      : isStrong
      ? { scale: [1, 1.12, 0.97, 1], opacity: [0.2, 0.38, 0.18, 0.2] }
      : { scale: [1, 1.05, 1], opacity: [0.18, 0.28, 0.18] };
  const orbTransition = isImpact
    ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
    : isStrong
    ? { duration: 2.1, repeat: Infinity, ease: "easeInOut" }
    : { duration: 2.9, repeat: Infinity, ease: "easeInOut" };
  const ringAnimate = isOff
    ? undefined
    : isImpact
      ? { scale: [1, 1.14, 0.96, 1.02, 1], opacity: [0.28, 0.52, 0.22, 0.3, 0.28] }
      : isStrong
      ? { scale: [1, 1.08, 0.98, 1], opacity: [0.24, 0.42, 0.22, 0.24] }
      : { scale: [1, 1.04, 1], opacity: [0.18, 0.3, 0.18] };
  const skeletonAnimate = isOff
    ? undefined
    : isImpact
      ? { opacity: [0.44, 1, 0.44], scaleX: [0.96, 1.02, 0.96], y: [0, -2, 0] }
      : isStrong
      ? { opacity: [0.5, 1, 0.5], scaleX: [0.985, 1, 0.985] }
      : { opacity: [0.68, 0.96, 0.68] };
  const skeletonTransition = isImpact
    ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
    : isStrong
    ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
    : { duration: 2.1, repeat: Infinity, ease: "easeInOut" };

  return (
    <MyPagePublicCard
      theme={theme}
      className={cls(theme?.layout?.homeCardClassName, "relative overflow-hidden", className)}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute left-1/2 top-16 h-40 w-40 -translate-x-1/2 rounded-full blur-3xl"
          style={{
            background: accentBackground,
            opacity: isImpact ? 0.36 : isStrong ? 0.3 : 0.24,
          }}
          animate={orbAnimate}
          transition={orbTransition}
        />
        <motion.div
          className="absolute right-8 top-24 h-28 w-28 rounded-full blur-3xl"
          style={{
            background: softBackground,
            opacity: isImpact ? 0.56 : isStrong ? 0.5 : 0.4,
          }}
          animate={orbAnimate}
          transition={{ ...orbTransition, delay: 0.18 }}
        />
        <motion.div
          className="absolute bottom-16 left-10 h-24 w-24 rounded-full blur-3xl"
          style={{
            background: accentBackground,
            opacity: isImpact ? 0.26 : isStrong ? 0.18 : 0.14,
          }}
          animate={orbAnimate}
          transition={{ ...orbTransition, delay: 0.36 }}
        />
      </div>

      <div className="relative flex min-h-[540px] flex-col items-center justify-center px-6 py-10 text-center sm:px-10">
        <div className="relative mb-8">
          <motion.div
            className="absolute inset-[-12px] rounded-full border"
            style={{ borderColor: theme?.activeCardStyle?.borderColor || theme?.dividerStyle?.borderColor, opacity: 0.4 }}
            animate={ringAnimate}
            transition={orbTransition}
          />
          <motion.div
            className="absolute inset-[-26px] rounded-full border"
            style={{
              borderColor: theme?.dividerStyle?.borderColor || theme?.softSurfaceStyle?.borderColor,
              opacity: 0.22,
            }}
            animate={ringAnimate}
            transition={{ ...orbTransition, delay: 0.14 }}
          />
          <div
            className="relative flex h-24 w-24 items-center justify-center rounded-full border shadow-[0_24px_50px_-28px_rgba(15,23,42,0.45)]"
            style={theme?.activeCardStyle || theme?.softSurfaceStyle}
          >
            <motion.div
              className="h-10 w-10 rounded-full"
              style={{
                background: accentBackground,
                opacity: 0.95,
              }}
              animate={orbAnimate}
              transition={{ ...orbTransition, delay: 0.08 }}
            />
          </div>
        </div>

        <div className="text-[11px] font-bold uppercase tracking-[0.22em]" style={theme?.accentTextStyle}>
          Carregando
        </div>
        <div className="mt-3 text-2xl font-black tracking-[-0.04em]" style={theme?.titleStyle}>
          Sua pagina
        </div>
        <div className="mt-3 max-w-[28ch] text-sm leading-6" style={theme?.mutedTextStyle}>
          Preparando a experiencia e aplicando o visual da sua pagina.
        </div>

        <div className="mt-8 w-full max-w-sm space-y-3">
          <motion.div
            className="mx-auto h-4 w-40 rounded-full"
            style={{ background: softBackground, opacity: 0.9 }}
            animate={skeletonAnimate}
            transition={skeletonTransition}
          />
          <motion.div
            className="mx-auto h-3 w-56 rounded-full"
            style={{ background: softBackground, opacity: 0.72 }}
            animate={skeletonAnimate}
            transition={{ ...skeletonTransition, delay: 0.1 }}
          />
          <motion.div
            className="h-14 w-full rounded-[24px] border"
            style={theme?.primaryButtonStyle}
            animate={skeletonAnimate}
            transition={{ ...skeletonTransition, delay: 0.18 }}
          />
        </div>
      </div>
    </MyPagePublicCard>
  );
}

function normalizeSecondaryLinkLabel(item) {
  return String(item?.label || item?.platform || "").trim();
}

function resolveSecondaryLinkBrand(platform) {
  const normalized = String(platform || "").trim().toLowerCase();

  if (normalized === "instagram") {
    return {
      Icon: FaInstagram,
      badgeStyle: {
        background:
          "linear-gradient(135deg, #F58529 0%, #FEDA77 28%, #DD2A7B 62%, #8134AF 82%, #515BD4 100%)",
        color: "#FFFFFF",
        border: "1px solid rgba(255,255,255,0.2)",
        boxShadow: "0 16px 30px -20px rgba(221,42,123,0.55)",
      },
    };
  }

  if (normalized === "facebook") {
    return {
      Icon: FaFacebookF,
      badgeStyle: {
        background: "linear-gradient(135deg, #7AA7FF 0%, #1877F2 100%)",
        color: "#FFFFFF",
        border: "1px solid rgba(255,255,255,0.18)",
        boxShadow: "0 16px 30px -20px rgba(24,119,242,0.5)",
      },
    };
  }

  if (normalized === "tiktok") {
    return {
      Icon: FaTiktok,
      badgeStyle: {
        background: "linear-gradient(135deg, #1F2937 0%, #020617 100%)",
        color: "#FFFFFF",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 18px 32px -22px rgba(2,6,23,0.78)",
      },
      iconStyle: {
        filter:
          "drop-shadow(1px 0 0 rgba(37,244,238,0.95)) drop-shadow(-1px 0 0 rgba(254,44,85,0.95))",
      },
    };
  }

  if (normalized === "youtube") {
    return {
      Icon: FaYoutube,
      badgeStyle: {
        background: "linear-gradient(135deg, #FF4D4F 0%, #FF0033 100%)",
        color: "#FFFFFF",
        border: "1px solid rgba(255,255,255,0.18)",
        boxShadow: "0 16px 30px -20px rgba(255,0,51,0.5)",
      },
    };
  }

  if (normalized === "site") {
    return {
      Icon: FaGlobe,
      badgeStyle: {
        background: "linear-gradient(135deg, #E9D5FF 0%, #C4B5FD 100%)",
        color: "#5B21B6",
        border: "1px solid rgba(91,33,182,0.14)",
        boxShadow: "0 16px 30px -20px rgba(124,58,237,0.35)",
      },
    };
  }

  return {
    Icon: FaGlobe,
    badgeStyle: null,
    iconStyle: null,
  };
}

function getSecondaryLinkBadgeClassName(layout, iconOnly) {
  if (layout?.size === "small") {
    return iconOnly
      ? "h-7 w-7 rounded-[10px]"
      : "h-6 w-6 rounded-[8px]";
  }

  return iconOnly
    ? "h-8 w-8 rounded-[12px]"
    : "h-7 w-7 rounded-[10px]";
}

function SecondaryLinkBadge({ theme, item, layout, iconOnly = false }) {
  const brand = resolveSecondaryLinkBrand(item?.platform);
  const Icon = brand.Icon;
  const neutralColor =
    theme?.mutedTextStyle?.color ||
    theme?.titleStyle?.color ||
    "#475569";
  const fallbackBorder =
    theme?.dividerStyle?.borderColor || "rgba(148,163,184,0.24)";
  const fallbackBadgeStyle = {
    background:
      theme?.softSurfaceStyle?.background ||
      "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06))",
    color: neutralColor,
    border: `1px solid ${fallbackBorder}`,
    boxShadow: theme?.softSurfaceStyle?.boxShadow || "none",
  };
  const badgeStyle = brand.badgeStyle || fallbackBadgeStyle;

  return (
    <span
      className={cls(
        "inline-flex shrink-0 items-center justify-center border",
        getSecondaryLinkBadgeClassName(layout, iconOnly),
      )}
      style={badgeStyle}
      aria-hidden="true"
    >
      <Icon
        className={cls(layout.iconClassName, "shrink-0")}
        style={brand.iconStyle || undefined}
      />
    </span>
  );
}

function SecondaryLinkContent({ theme, item, layout }) {
  const label = normalizeSecondaryLinkLabel(item);
  const style = theme?.design?.secondaryLinksStyle || "text";
  const iconLayout = theme?.design?.secondaryLinksIconLayout || "brand_badge";
  const brand = resolveSecondaryLinkBrand(item?.platform);
  const Icon = brand.Icon;
  const plainIcon = (
    <Icon
      className={cls(layout.iconClassName, "shrink-0")}
      style={brand.iconStyle || undefined}
      aria-hidden="true"
    />
  );

  if (style === "icon") {
    if (iconLayout === "plain") return plainIcon;

    return <SecondaryLinkBadge theme={theme} item={item} layout={layout} iconOnly />;
  }

  return (
    <span
      className={cls(
        "inline-flex min-w-0 items-center",
        layout.contentClassName,
      )}
    >
      {style === "icon_text" ? (
        iconLayout === "plain" ? (
          plainIcon
        ) : (
          <SecondaryLinkBadge theme={theme} item={item} layout={layout} />
        )
      ) : null}
      <span className="truncate">{label}</span>
    </span>
  );
}

export function MyPageSecondaryLinks({
  theme,
  links = [],
  interactive = true,
  className = "",
  itemClassName = "",
}) {
  const items = Array.isArray(links)
    ? links.filter(
        (item) => item?.enabled === true && item?.url && normalizeSecondaryLinkLabel(item),
      )
    : [];
  const layout = getMyPageSecondaryLinksLayout(theme);

  if (!items.length) return null;

  const iconOnly = (theme?.design?.secondaryLinksStyle || "text") === "icon";
  const linkProps = getPublicButtonProps(
    theme,
    "secondary",
    cls(
      layout.itemClassName,
      iconOnly ? layout.iconOnlyClassName : "justify-center",
      itemClassName,
    ),
  );

  return (
    <div
      className={cls(
        theme?.layout?.homeSecondaryLinksClassName || "mt-6 flex flex-wrap gap-2",
        layout.containerClassName,
        className,
      )}
    >
      {items.map((item, index) => {
        const label = normalizeSecondaryLinkLabel(item);
        const sharedProps = {
          key: item.id || `${item.platform || "link"}:${index}`,
          title: label,
          className: linkProps.className,
          style: linkProps.style,
        };

        if (interactive) {
          return (
            <a
              {...sharedProps}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              aria-label={label}
            >
              <SecondaryLinkContent theme={theme} item={item} layout={layout} />
            </a>
          );
        }

        return (
          <div {...sharedProps} aria-label={label}>
            <SecondaryLinkContent theme={theme} item={item} layout={layout} />
          </div>
        );
      })}
    </div>
  );
}
