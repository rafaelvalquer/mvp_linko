import { Link2 } from "lucide-react";
import brand from "../../assets/brand.png";
import {
  getMyPageButtonProps,
  getMyPageSelectableCardProps,
  getMyPageSurfaceProps,
  getMyPageTheme,
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

export function MyPagePublicScreen({
  page,
  maxWidth = "max-w-6xl",
  children,
}) {
  const theme = getMyPageTheme(page || {});

  return (
    <div className="min-h-screen px-4 py-5 sm:px-6 lg:px-8" style={theme.rootStyle}>
      <div className={cls("mx-auto space-y-6", maxWidth)}>
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
  if (page?.avatarUrl) {
    return (
      <img
        src={page.avatarUrl}
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
      <img
        src={brand}
        alt="LuminorPay"
        className={cls("object-contain", iconSizeClassName)}
      />
    </div>
  );
}

export function MyPagePublicHeroMedia({
  page,
  theme,
  className = "",
  heightClassName = "h-[180px] sm:h-[220px]",
}) {
  if (!theme?.usesHeroLayout || !page?.avatarUrl) return null;

  return (
    <div
      className={cls("overflow-hidden rounded-[28px] border", className)}
      style={theme.heroMediaStyle}
    >
      <div className={cls("w-full", heightClassName)} />
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
  return (
    <div className="space-y-4">
      <MyPagePublicHeroMedia page={page} theme={theme} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          {theme?.usesHeroLayout ? null : (
            <MyPagePublicAvatar page={page} theme={theme} />
          )}
          <div>
            <div
              className="text-[11px] font-bold uppercase tracking-[0.22em]"
              style={theme.accentTextStyle}
            >
              {eyebrow}
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">
              {title || page?.title || "Minha Pagina"}
            </h1>
            {page?.subtitle ? (
              <div className="mt-1 text-sm font-semibold" style={theme.accentTextStyle}>
                {page.subtitle}
              </div>
            ) : null}
            {description || page?.description ? (
              <p
                className="mt-2 max-w-2xl text-sm leading-6"
                style={theme.mutedTextStyle}
              >
                {description || page?.description || ""}
              </p>
            ) : null}
          </div>
        </div>

        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}

export function MyPagePublicFooter({ theme }) {
  const buttonProps = getPublicButtonProps(theme, "secondary");

  return (
    <div className="pt-2 text-center">
      <div className="text-xs" style={theme.mutedTextStyle}>
        Criado com LuminorPay
      </div>
      <div className="mt-3">
        <button
          type="button"
          {...buttonProps}
          onClick={() => window.open("/", "_self")}
        >
          Conhecer a LuminorPay
        </button>
      </div>
    </div>
  );
}
