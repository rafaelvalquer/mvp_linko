import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CalendarDays,
  CreditCard,
  FileText,
  Link2,
  MessageCircle,
  ShoppingBag,
} from "lucide-react";
import { getPublicMyPage, trackPublicMyPageClick } from "../app/myPageApi.js";
import {
  cls,
  getPublicButtonProps,
  MyPagePublicAvatar,
  MyPagePublicCard,
  MyPagePublicFooter,
  MyPagePublicHeroMedia,
  MyPageSecondaryLinks,
  MyPagePublicScreen,
} from "../components/my-page/MyPagePublicUi.jsx";

function iconForType(type) {
  if (type === "whatsapp") return MessageCircle;
  if (type === "public_schedule") return CalendarDays;
  if (type === "public_offer") return FileText;
  if (type === "catalog") return ShoppingBag;
  if (type === "payment_link") return CreditCard;
  return Link2;
}

function buttonVariantForHome(theme, button, index) {
  if (theme?.layout?.homePrimaryAll) return "primary";
  if (theme?.layout?.homeHighlightFirst && index === 0) return "primary";
  return button?.type === "whatsapp" ? "primary" : "secondary";
}

export default function PublicMyPageV2() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");
        const response = await getPublicMyPage(slug);
        if (!active) return;
        setPage(response?.page || null);
      } catch (error) {
        if (!active) return;
        setErr(error?.message || "Pagina publica nao encontrada.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [slug]);

  const buttons = useMemo(() => page?.buttons || [], [page?.buttons]);
  const socialLinks = useMemo(() => page?.socialLinks || [], [page?.socialLinks]);

  async function handleButtonClick(button) {
    if (!button?.targetUrl) return;
    try {
      await trackPublicMyPageClick(slug, {
        buttonId: button.id,
        referrer: document.referrer || "",
      });
    } catch {}
    window.location.href = button.targetUrl;
  }

  return (
    <MyPagePublicScreen page={page}>
      {(theme) => (
        <div className={theme?.layout?.homeShellClassName}>
          <div className={cls("mx-auto w-full", theme?.layout?.homeMaxWidthClassName)}>
            <MyPagePublicCard theme={theme} className={theme?.layout?.homeCardClassName}>
              <div className={theme?.layout?.homeHeaderClassName}>
                <MyPagePublicHeroMedia
                  page={page}
                  theme={theme}
                  className="mb-5 w-full"
                  heightClassName={theme?.layout?.heroMediaHeightClassName}
                />
                {theme.usesHeroLayout ? null : (
                  <MyPagePublicAvatar
                    page={page}
                    theme={theme}
                    sizeClassName={theme?.layout?.heroAvatarSizeClassName}
                    iconSizeClassName={theme?.layout?.heroAvatarIconSizeClassName}
                  />
                )}
                <div className={theme?.layout?.homeTitleClassName} style={theme.titleStyle}>
                  {page?.title || "Minha Pagina"}
                </div>
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
                {page?.description ? (
                  <div
                    className={theme?.layout?.homeDescriptionClassName}
                    style={theme.mutedTextStyle}
                  >
                    {page.description}
                  </div>
                ) : null}
              </div>

              {loading ? (
                <div className="mt-8 text-center text-sm" style={theme.mutedTextStyle}>
                  Carregando sua pagina...
                </div>
              ) : err ? (
                <div className="mt-8 rounded-[28px] border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">
                  {err}
                </div>
              ) : (
                <>
                  <div className={theme?.layout?.homeButtonsClassName}>
                    {buttons.map((button, index) => {
                      const Icon = iconForType(button.type);
                      const buttonProps = getPublicButtonProps(
                        theme,
                        buttonVariantForHome(theme, button, index),
                        theme?.layout?.homeButtonClassName,
                      );

                      return (
                        <button
                          key={button.id}
                          type="button"
                          onClick={() => handleButtonClick(button)}
                          {...buttonProps}
                        >
                          <div className="flex min-w-0 items-center gap-4">
                            <div
                              className={cls(
                                "flex h-12 w-12 shrink-0 items-center justify-center border",
                                theme.buttonIconRadiusClassName,
                              )}
                              style={theme.softSurfaceStyle}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-base font-semibold">
                                {button.label}
                              </div>
                            </div>
                          </div>

                          <span className="text-sm font-semibold" style={theme.accentTextStyle}>
                            Abrir
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <MyPageSecondaryLinks theme={theme} links={socialLinks} />
                </>
              )}

              <div className="mt-8">
                <MyPagePublicFooter theme={theme} />
              </div>
            </MyPagePublicCard>
          </div>
        </div>
      )}
    </MyPagePublicScreen>
  );
}
