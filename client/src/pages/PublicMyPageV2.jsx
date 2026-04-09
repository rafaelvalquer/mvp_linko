import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useParams } from "react-router-dom";
import { getPublicMyPage, trackPublicMyPageClick } from "../app/myPageApi.js";
import {
  cls,
  getMyPageButtonIcon,
  getMyPageButtonMetaLabel,
  MyPagePublicAvatar,
  MyPagePublicCard,
  MyPagePublicFooter,
  MyPagePublicHeroMedia,
  MyPagePublicLoadingSplash,
  MyPageSecondaryLinks,
  MyPagePublicScreen,
} from "../components/my-page/MyPagePublicUi.jsx";
import {
  getMyPageHomeButtonProps,
  getMyPageMotionPreset,
} from "../components/my-page/myPageTheme.js";

function buttonVariantForHome(theme, button, index) {
  if (theme?.layout?.homePrimaryAll) return "primary";
  if (theme?.layout?.homeHighlightFirst && index === 0) return "primary";
  return button?.type === "whatsapp" ? "primary" : "secondary";
}

export default function PublicMyPageV2() {
  const { slug } = useParams();
  const shouldReduceMotion = useReducedMotion();
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
      {(theme) => {
        const motionPreset = getMyPageMotionPreset(theme, shouldReduceMotion);

        return (
        <div className={theme?.layout?.homeShellClassName}>
          <div className={cls("mx-auto w-full", theme?.layout?.homeMaxWidthClassName)}>
            <AnimatePresence mode="wait" initial={false}>
              {loading ? (
                <motion.div
                  key="loading"
                  initial={motionPreset.loadingInitial}
                  animate={motionPreset.loadingAnimate}
                  exit={motionPreset.loadingExit}
                  transition={motionPreset.loadingTransition}
                >
                  <MyPagePublicLoadingSplash theme={theme} motionPreset={motionPreset} />
                </motion.div>
              ) : (
                <HomeContent
                  key="content"
                  page={page}
                  theme={theme}
                  motionPreset={motionPreset}
                  err={err}
                  buttons={buttons}
                  socialLinks={socialLinks}
                  onButtonClick={handleButtonClick}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
        );
      }}
    </MyPagePublicScreen>
  );
}

function HomeContent({
  page,
  theme,
  motionPreset,
  err,
  buttons,
  socialLinks,
  onButtonClick,
}) {
  return (
    <motion.div
      initial={motionPreset.switchInitial}
      animate={motionPreset.switchAnimate}
      exit={motionPreset.switchExit}
      transition={motionPreset.switchTransition}
    >
      <MyPagePublicCard theme={theme} className={theme?.layout?.homeCardClassName}>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={motionPreset.containerVariants}
          className="space-y-6"
        >
          <motion.div
            variants={motionPreset.itemVariants}
            className={theme?.layout?.homeHeaderClassName}
          >
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
          </motion.div>

          {err ? (
            <motion.div
              variants={motionPreset.itemVariants}
              className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700"
            >
              {err}
            </motion.div>
          ) : (
            <>
              <motion.div variants={motionPreset.primaryButtonsWrapperVariants}>
                <HomePrimaryButtons
                  theme={theme}
                  buttons={buttons}
                  onButtonClick={onButtonClick}
                  motionPreset={motionPreset}
                />
              </motion.div>

              <motion.div variants={motionPreset.itemVariants}>
                <MyPageSecondaryLinks theme={theme} links={socialLinks} />
              </motion.div>
            </>
          )}

          <motion.div variants={motionPreset.itemVariants} className="pt-2">
            <MyPagePublicFooter theme={theme} />
          </motion.div>
        </motion.div>
      </MyPagePublicCard>
    </motion.div>
  );
}

function HomePrimaryButtons({ theme, buttons, onButtonClick, motionPreset }) {
  const stackMeta = getMyPageHomeButtonProps(theme, "primary");

  return (
    <div className={stackMeta.layout.containerClassName}>
      {buttons.map((button, index) => {
        const variant = buttonVariantForHome(theme, button, index);
        const Icon = getMyPageButtonIcon(button.type);
        const { buttonProps, layout } = getMyPageHomeButtonProps(theme, variant);

        return (
          <motion.button
            key={button.id}
            type="button"
            onClick={() => onButtonClick(button)}
            className={buttonProps.className}
            style={buttonProps.style}
            variants={motionPreset.primaryButtonVariants}
            custom={index}
            whileHover={motionPreset.buttonHover}
            whileTap={motionPreset.buttonTap}
            transition={motionPreset.buttonTransition}
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
                    {getMyPageButtonMetaLabel(button.type)}
                  </div>
                ) : null}
                <div className={layout.titleClassName}>{button.label}</div>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
