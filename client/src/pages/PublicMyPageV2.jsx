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
    <MyPagePublicScreen page={page} maxWidth="max-w-xl">
      {(theme) => (
        <div className="flex min-h-[calc(100vh-3rem)] items-center">
          <MyPagePublicCard theme={theme} className="w-full p-5 sm:p-7">
            <div className="flex flex-col items-center text-center">
              <MyPagePublicHeroMedia
                page={page}
                theme={theme}
                className="mb-5 w-full"
                heightClassName="h-[180px] sm:h-[220px]"
              />
              {theme.usesHeroLayout ? null : (
                <MyPagePublicAvatar
                  page={page}
                  theme={theme}
                  sizeClassName="h-24 w-24 rounded-full"
                  iconSizeClassName="h-10 w-10"
                />
              )}
              <div className="mt-5 text-3xl font-black tracking-[-0.05em]">
                {page?.title || "Minha Pagina"}
              </div>
              {page?.subtitle ? (
                <div className="mt-2 text-sm font-semibold" style={theme.accentTextStyle}>
                  {page.subtitle}
                </div>
              ) : null}
              {page?.description ? (
                <div className="mt-4 max-w-[32ch] text-sm leading-6" style={theme.mutedTextStyle}>
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
                <div className="mt-8 space-y-3">
                  {buttons.map((button) => {
                    const Icon = iconForType(button.type);
                    const buttonProps = getPublicButtonProps(
                      theme,
                      button.type === "whatsapp" ? "primary" : "secondary",
                      "flex w-full items-center justify-between gap-4 px-5 py-4 text-left",
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

                {socialLinks.length ? (
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {socialLinks.map((item) => {
                      const linkProps = getPublicButtonProps(
                        theme,
                        "secondary",
                        "px-3 py-2 text-xs font-semibold",
                      );

                      return (
                        <a
                          key={item.id}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          {...linkProps}
                        >
                          {item.label || item.platform}
                        </a>
                      );
                    })}
                  </div>
                ) : null}
              </>
            )}

            <div className="mt-8">
              <MyPagePublicFooter theme={theme} />
            </div>
          </MyPagePublicCard>
        </div>
      )}
    </MyPagePublicScreen>
  );
}
