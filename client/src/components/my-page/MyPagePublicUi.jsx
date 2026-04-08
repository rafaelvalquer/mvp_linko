import { Link2 } from "lucide-react";
import {
  FaFacebookF,
  FaGlobe,
  FaInstagram,
  FaTiktok,
  FaYoutube,
} from "react-icons/fa6";
import {
  getMyPageButtonProps,
  getMyPageSelectableCardProps,
  getMyPageSurfaceProps,
  getMyPageTheme,
  resolveMyPageMediaUrl,
} from "./myPageTheme.js";

export function cls(...parts) {
  return parts.filter(Boolean).join(" ");
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
    <div className="min-h-screen px-4 py-5 sm:px-6 lg:px-8" style={theme.rootStyle}>
      <div
        className={cls(
          "mx-auto",
          maxWidthClass,
          theme?.layout?.screenGapClassName || "space-y-6",
        )}
      >
        {typeof children === "function" ? children(theme) : children}
      </div>
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

function normalizeSecondaryLinkLabel(item) {
  return String(item?.label || item?.platform || "").trim();
}

function resolveSecondaryLinkIcon(platform) {
  const normalized = String(platform || "").trim().toLowerCase();
  if (normalized === "instagram") return FaInstagram;
  if (normalized === "facebook") return FaFacebookF;
  if (normalized === "tiktok") return FaTiktok;
  if (normalized === "youtube") return FaYoutube;
  if (normalized === "site") return FaGlobe;
  return FaGlobe;
}

function SecondaryLinkContent({ theme, item }) {
  const label = normalizeSecondaryLinkLabel(item);
  const style = theme?.design?.secondaryLinksStyle || "text";
  const Icon = resolveSecondaryLinkIcon(item?.platform);

  if (style === "icon") {
    return <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />;
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {style === "icon_text" ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
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

  if (!items.length) return null;

  const iconOnly = (theme?.design?.secondaryLinksStyle || "text") === "icon";
  const linkProps = getPublicButtonProps(
    theme,
    "secondary",
    cls(
      "px-3 py-2 text-xs font-semibold",
      iconOnly ? "h-10 w-10 justify-center px-0" : "justify-center",
      itemClassName,
    ),
  );

  return (
    <div
      className={cls(
        theme?.layout?.homeSecondaryLinksClassName || "mt-6 flex flex-wrap justify-center gap-2",
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
              <SecondaryLinkContent theme={theme} item={item} />
            </a>
          );
        }

        return (
          <div {...sharedProps} aria-label={label}>
            <SecondaryLinkContent theme={theme} item={item} />
          </div>
        );
      })}
    </div>
  );
}
