import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  Bot,
  History,
  LayoutGrid,
  Loader2,
  MessageCircleMore,
  Plus,
  SendHorizonal,
  Sparkles,
  X,
} from "lucide-react";

import { useAuth } from "../../app/AuthContext.jsx";
import {
  getLuminaBootstrap,
  getLuminaSession,
  sendLuminaMessage,
  startNewLuminaSession,
} from "../../app/agentWebApi.js";
import useThemeToggle from "../../app/useThemeToggle.js";
import { canUseWhatsAppAiOfferCreation } from "../../utils/planFeatures.js";
import Button from "../appui/Button.jsx";
import { Textarea } from "../appui/Input.jsx";
import { getLuminaMotionPreset } from "./luminaMotion.js";

function formatMessageTime(value) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function formatSessionTime(value) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function TypingDots({ motionPreset, reducedMotion, isDark }) {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className={[
            "inline-flex h-2 w-2 rounded-full",
            isDark ? "bg-cyan-300/90" : "bg-cyan-500/90",
          ].join(" ")}
          animate={
            reducedMotion
              ? { opacity: 0.75, y: 0 }
              : {
                  opacity: [0.35, 1, 0.35],
                  y: [0, -2, 0],
                }
          }
          transition={{
            ...motionPreset.transitions.typing,
            delay: index * 0.12,
          }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ item, isDark, motionPreset }) {
  const isUser = item?.role === "user";

  return (
    <motion.div
      layout="position"
      variants={
        isUser
          ? motionPreset.userBubbleVariants
          : motionPreset.assistantBubbleVariants
      }
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={motionPreset.transitions.base}
      className={["flex w-full", isUser ? "justify-end" : "justify-start"].join(" ")}
    >
      <div
        className={[
          "max-w-[88%] rounded-[24px] px-4 py-3 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.4)]",
          isUser
            ? "bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white"
            : isDark
              ? "border border-white/10 bg-[linear-gradient(180deg,rgba(19,31,54,0.96),rgba(12,20,38,0.94))] text-slate-100"
              : "border border-slate-200/80 bg-white text-slate-800",
        ].join(" ")}
      >
        <div className="whitespace-pre-wrap text-sm leading-6">{item?.text || ""}</div>
        {item?.createdAt ? (
          <div
            className={[
              "mt-2 text-[11px]",
              isUser
                ? "text-white/75"
                : isDark
                  ? "text-slate-400"
                  : "text-slate-500",
            ].join(" ")}
          >
            {formatMessageTime(item.createdAt)}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function TypingBubble({ isDark, motionPreset, reducedMotion }) {
  return (
    <motion.div
      variants={motionPreset.typingBubbleVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={motionPreset.transitions.base}
      className="flex justify-start"
    >
      <div
        className={[
          "rounded-[24px] border px-4 py-3",
          isDark
            ? "border-white/10 bg-[linear-gradient(180deg,rgba(19,31,54,0.96),rgba(12,20,38,0.94))] text-slate-100"
            : "border-slate-200/80 bg-white text-slate-800",
        ].join(" ")}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <TypingDots
            motionPreset={motionPreset}
            reducedMotion={reducedMotion}
            isDark={isDark}
          />
          Lumina esta pensando...
        </div>
      </div>
    </motion.div>
  );
}

function OverlayControlButton({
  icon: Icon,
  label,
  onClick,
  isDark,
  active = false,
  highlighted = false,
  disabled = false,
  motionPreset,
}) {
  return (
    <motion.div
      initial="idle"
      animate={highlighted ? "highlighted" : "idle"}
      variants={motionPreset.attentionCtaVariants}
      transition={motionPreset.transitions.attention}
      className="relative rounded-full"
    >
      <motion.span
        aria-hidden="true"
        className={[
          "pointer-events-none absolute inset-0 rounded-full blur-md",
          isDark ? "bg-cyan-400/30" : "bg-cyan-300/70",
        ].join(" ")}
        initial="idle"
        animate={highlighted ? "highlighted" : "idle"}
        variants={motionPreset.attentionGlowVariants}
        transition={motionPreset.transitions.attention}
      />
      <motion.button
        type="button"
        onClick={onClick}
        disabled={disabled}
        initial="idle"
        animate="idle"
        whileHover={disabled ? undefined : "hover"}
        whileTap={disabled ? undefined : "tap"}
        variants={motionPreset.sendButtonVariants}
        transition={motionPreset.transitions.chip}
        className={[
          "relative inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition disabled:opacity-60",
          active || highlighted
            ? isDark
              ? "border-cyan-400/30 bg-cyan-400/12 text-cyan-100"
              : "border-cyan-300 bg-cyan-50 text-cyan-800"
            : isDark
              ? "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              : "border-slate-200/80 bg-white text-slate-700 hover:bg-slate-100",
        ].join(" ")}
      >
        <Icon className="h-4 w-4" />
        {label}
      </motion.button>
    </motion.div>
  );
}

function RecentSessionItem({
  session,
  isDark,
  selected,
  loading,
  onOpen,
  motionPreset,
  listMode = false,
}) {
  return (
    <motion.button
      layout
      type="button"
      onClick={() => onOpen?.(session?._id)}
      disabled={loading}
      whileHover="hover"
      whileTap="tap"
      variants={motionPreset.recentSessionItemVariants}
      transition={motionPreset.transitions.chip}
      className={[
        "relative overflow-hidden rounded-[16px] border px-3 py-2 text-left disabled:opacity-60",
        listMode ? "w-full min-w-0" : "min-w-[132px]",
        selected
          ? "border-cyan-400/40"
          : isDark
            ? "border-white/10 bg-white/5"
            : "border-slate-200/80 bg-white/85",
      ].join(" ")}
    >
      {selected ? (
        <motion.span
          layoutId="lumina-recent-session-indicator"
          className="absolute inset-0 bg-[linear-gradient(135deg,rgba(37,99,235,0.18),rgba(20,184,166,0.12))]"
          transition={motionPreset.transitions.chip}
        />
      ) : null}

      <div className="relative flex items-start justify-between gap-2">
        <div>
          <div
            className={[
              "text-[10px] font-bold uppercase tracking-[0.18em]",
              isDark ? "text-slate-400" : "text-slate-500",
            ].join(" ")}
          >
            {session?.flowLabel || "Conversa"}
          </div>
          <div
            className={[
              "mt-1 line-clamp-1 text-xs font-medium",
              isDark ? "text-slate-300" : "text-slate-600",
            ].join(" ")}
          >
            {session?.preview || "Abrir conversa"}
          </div>
        </div>

        {loading ? (
          <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-cyan-400" />
        ) : null}
      </div>

      <div
        className={[
          "relative mt-2 text-[11px]",
          isDark ? "text-slate-400" : "text-slate-500",
        ].join(" ")}
      >
        {formatSessionTime(session?.updatedAt || session?.createdAt)}
      </div>
    </motion.button>
  );
}

function LuminaActionMenu({
  actionMenu,
  selectedCategoryKey,
  onSelectCategory,
  onSelectAction,
  onClose,
  isDark,
  isMobile,
  disabled,
  motionPreset,
}) {
  if (!Array.isArray(actionMenu) || actionMenu.length === 0) {
    return null;
  }

  const activeCategory =
    actionMenu.find((category) => category?.categoryKey === selectedCategoryKey) ||
    actionMenu[0];
  const activeActions = Array.isArray(activeCategory?.actions)
    ? activeCategory.actions
    : [];

  return (
    <motion.section
      variants={isMobile ? motionPreset.sheetPanelVariants : motionPreset.floatingPanelVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={motionPreset.transitions.panel}
      className={[
        "border px-4 py-4 shadow-[0_28px_80px_-36px_rgba(15,23,42,0.58)]",
        isMobile
          ? "max-h-[60vh] rounded-t-[28px] rounded-b-none"
          : "rounded-[24px]",
        isDark
          ? "border-white/10 bg-[linear-gradient(180deg,rgba(16,25,44,0.76),rgba(10,18,34,0.7))]"
          : "border-slate-200/80 bg-white/95",
      ].join(" ")}
    >
      <motion.div
        variants={motionPreset.overlayPanelHeaderVariants.container}
        initial="hidden"
        animate="visible"
        className="flex items-start justify-between gap-3"
      >
        <motion.div variants={motionPreset.overlayPanelHeaderVariants.item}>
          <div
            className={[
              "text-[10px] font-bold uppercase tracking-[0.2em]",
              isDark ? "text-slate-400" : "text-slate-500",
            ].join(" ")}
          >
            Menu rapido
          </div>
          <div
            className={[
              "mt-1 text-sm font-semibold",
              isDark ? "text-white" : "text-slate-950",
            ].join(" ")}
          >
            Acoes da Lumina
          </div>
        </motion.div>

        <motion.button
          type="button"
          onClick={onClose}
          whileHover="hover"
          whileTap="tap"
          variants={motionPreset.categoryTabVariants}
          className={[
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
            isDark
              ? "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              : "border-slate-200/80 bg-white text-slate-600 hover:bg-slate-100",
            ].join(" ")}
        >
          Fechar
          <X className="h-4 w-4" />
        </motion.button>
      </motion.div>

      <LayoutGroup id="lumina-category-tabs">
        <motion.div
          variants={motionPreset.categoryTabsVariants.container}
          initial="hidden"
          animate="visible"
          className="mt-3 flex gap-2 overflow-x-auto pb-1"
        >
          {actionMenu.map((category) => {
            const isSelected = category?.categoryKey === activeCategory?.categoryKey;
            return (
              <motion.button
                key={category?.categoryKey}
                type="button"
                onClick={() => onSelectCategory?.(category?.categoryKey || "")}
                whileHover="hover"
                whileTap="tap"
                variants={motionPreset.categoryTabVariants}
                transition={motionPreset.transitions.chip}
                className={[
                  "relative shrink-0 overflow-hidden rounded-full border px-3 py-2 text-sm font-semibold",
                  isSelected
                    ? isDark
                      ? "border-cyan-400/40 text-cyan-100"
                      : "border-cyan-300 text-cyan-800"
                    : isDark
                      ? "border-white/10 bg-white/5 text-slate-200"
                      : "border-slate-200/80 bg-white text-slate-700",
                ].join(" ")}
              >
                {isSelected ? (
                  <motion.span
                    layoutId="lumina-category-indicator"
                    className={[
                      "absolute inset-0",
                      isDark
                        ? "bg-[linear-gradient(135deg,rgba(37,99,235,0.18),rgba(20,184,166,0.12))]"
                        : "bg-cyan-50",
                    ].join(" ")}
                    transition={motionPreset.transitions.chip}
                  />
                ) : null}
                <span className="relative">
                  {category?.categoryLabel || category?.categoryKey || "Categoria"}
                </span>
              </motion.button>
            );
          })}
        </motion.div>
      </LayoutGroup>

      <motion.div
        key={`lumina-action-body-${activeCategory?.categoryKey || "default"}`}
        variants={motionPreset.actionMenuBodyVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={motionPreset.transitions.base}
        className="mt-3 overflow-hidden"
      >
        <motion.div
          variants={motionPreset.actionGridVariants.container}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={[
            "grid gap-2 overflow-y-auto pr-1",
            isMobile ? "max-h-[42vh]" : "max-h-[360px] md:grid-cols-2",
          ].join(" ")}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {activeActions.map((action) => (
              <motion.button
                key={action?.actionKey}
                layout
                type="button"
                disabled={disabled}
                onClick={() =>
                  onSelectAction?.(
                    action?.value || action?.label || "",
                    action?.actionKey || "",
                  )
                }
                whileHover="hover"
                whileTap="tap"
                transition={motionPreset.transitions.soft}
                variants={motionPreset.actionCardVariants}
                className={[
                  "rounded-[18px] border px-3.5 py-3 text-left disabled:opacity-60",
                  action?.destructive
                    ? isDark
                      ? "border-rose-400/20 bg-rose-400/10 text-rose-50"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                    : isDark
                      ? "border-white/10 bg-white/5 text-slate-100"
                      : "border-slate-200/80 bg-white text-slate-800",
                ].join(" ")}
              >
                <div className="text-sm font-semibold">
                  {action?.label || action?.value || "Acao"}
                </div>
                {action?.description ? (
                  <div
                    className={[
                      "mt-1 line-clamp-2 text-xs leading-5",
                      action?.destructive
                        ? isDark
                          ? "text-rose-100/80"
                          : "text-rose-600"
                        : isDark
                          ? "text-slate-300"
                          : "text-slate-600",
                    ].join(" ")}
                  >
                    {action.description}
                  </div>
                ) : null}
              </motion.button>
            ))}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </motion.section>
  );
}

export default function LuminaChatWidget() {
  const { isDark } = useThemeToggle();
  const { isAuthenticated, workspace, perms } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [sending, setSending] = useState(false);
  const [switchingSessionId, setSwitchingSessionId] = useState("");
  const [payload, setPayload] = useState(null);
  const [draft, setDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState("");
  const [activeOverlay, setActiveOverlay] = useState("");
  const [actionsCtaDismissed, setActionsCtaDismissed] = useState(false);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState("");
  const [composerFocused, setComposerFocused] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false,
  );
  const messagesRef = useRef(null);
  const bootstrapRequestIdRef = useRef(0);
  const motionPreset = useMemo(
    () =>
      getLuminaMotionPreset({
        reducedMotion: prefersReducedMotion,
        isMobile,
      }),
    [prefersReducedMotion, isMobile],
  );

  const plan = workspace?.plan || perms?.plan || "start";
  const canUseLumina = isAuthenticated && canUseWhatsAppAiOfferCreation(plan);

  const displayedMessages = useMemo(() => {
    const baseMessages = Array.isArray(payload?.messages) ? payload.messages : [];
    if (!pendingUserMessage) return baseMessages;

    return [
      ...baseMessages,
      {
        _id: "pending-user-message",
        role: "user",
        inputType: "text",
        text: pendingUserMessage,
        createdAt: new Date().toISOString(),
      },
    ];
  }, [payload?.messages, pendingUserMessage]);

  const quickReplies = useMemo(() => {
    if (Array.isArray(payload?.quickReplies) && payload.quickReplies.length > 0) {
      return payload.quickReplies;
    }
    if (Array.isArray(payload?.ui?.quickReplies) && payload.ui.quickReplies.length > 0) {
      return payload.ui.quickReplies;
    }
    return [];
  }, [payload]);

  const actionMenu = useMemo(() => {
    if (Array.isArray(payload?.actionMenu) && payload.actionMenu.length > 0) {
      return payload.actionMenu;
    }
    if (Array.isArray(payload?.ui?.actionMenu) && payload.ui.actionMenu.length > 0) {
      return payload.ui.actionMenu;
    }
    return [];
  }, [payload]);

  const recentSessions = useMemo(() => {
    if (!Array.isArray(payload?.recentSessions)) return [];
    return payload.recentSessions.slice(0, 6);
  }, [payload?.recentSessions]);

  const activeSession = payload?.activeSession || null;
  const currentSession = payload?.session || null;
  const composerPlaceholder =
    payload?.ui?.composerPlaceholder ||
    "Fale com a Lumina sobre proposta, agenda, cobranca ou cadastro";
  const isHistoricalView =
    (!!currentSession?._id &&
      !!activeSession?._id &&
      String(currentSession._id) !== String(activeSession._id)) ||
    (!!currentSession?.isTerminal && !activeSession?._id);
  const isHistoryOverlayOpen = activeOverlay === "history";
  const isActionsOverlayOpen = activeOverlay === "actions";
  const shouldHighlightActionsCta =
    open &&
    !actionsCtaDismissed &&
    displayedMessages.length === 0 &&
    !sending &&
    !bootstrapping &&
    actionMenu.length > 0 &&
    !isActionsOverlayOpen;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncIsMobile = () => setIsMobile(mediaQuery.matches);

    syncIsMobile();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncIsMobile);
      return () => mediaQuery.removeEventListener("change", syncIsMobile);
    }

    mediaQuery.addListener(syncIsMobile);
    return () => mediaQuery.removeListener(syncIsMobile);
  }, []);

  useEffect(() => {
    if (!actionMenu.length) {
      setSelectedCategoryKey("");
      return;
    }

    setSelectedCategoryKey((currentValue) => {
      if (
        currentValue &&
        actionMenu.some((category) => category?.categoryKey === currentValue)
      ) {
        return currentValue;
      }
      return actionMenu[0]?.categoryKey || "";
    });
  }, [actionMenu]);

  useEffect(() => {
    if (open && canUseLumina) return;
    setActiveOverlay("");
    setActionsCtaDismissed(false);
  }, [open, canUseLumina]);

  async function loadBootstrap() {
    const requestId = bootstrapRequestIdRef.current + 1;
    bootstrapRequestIdRef.current = requestId;

    setBootstrapping(true);
    setErrorMessage("");

    try {
      const response = await getLuminaBootstrap();
      if (bootstrapRequestIdRef.current !== requestId) return null;
      setPayload(response);
      return response;
    } catch (error) {
      if (bootstrapRequestIdRef.current !== requestId) return null;
      setErrorMessage(
        error?.data?.error || error?.message || "Nao foi possivel abrir a Lumina agora.",
      );
      return null;
    } finally {
      if (bootstrapRequestIdRef.current === requestId) {
        setBootstrapping(false);
      }
    }
  }

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (activeOverlay) {
          setActiveOverlay("");
          return;
        }
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, activeOverlay]);

  useEffect(() => {
    if (!open || !canUseLumina || payload) return;
    void loadBootstrap();
  }, [open, canUseLumina, payload]);

  useEffect(() => {
    if (open && canUseLumina) return;
    bootstrapRequestIdRef.current += 1;
    setBootstrapping(false);
  }, [open, canUseLumina]);

  useEffect(() => {
    if (!open) return;
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [open, displayedMessages.length, sending, currentSession?._id, prefersReducedMotion]);

  useEffect(() => {
    if (!canUseLumina) {
      setOpen(false);
      setPayload(null);
      setErrorMessage("");
      setDraft("");
      setPendingUserMessage("");
      setActiveOverlay("");
      setActionsCtaDismissed(false);
      setSelectedCategoryKey("");
      setComposerFocused(false);
    }
  }, [canUseLumina]);

  async function reloadBootstrap() {
    return loadBootstrap();
  }

  async function handleOpenSession(sessionId) {
    const normalizedId = String(sessionId || "").trim();
    if (!normalizedId) return;
    if (normalizedId === String(currentSession?._id || "")) return;

    setSwitchingSessionId(normalizedId);
    setErrorMessage("");
    setActiveOverlay("");
    try {
      const response = await getLuminaSession(normalizedId);
      setPayload(response);
    } catch (error) {
      setErrorMessage(
        error?.data?.error || error?.message || "Nao foi possivel abrir essa conversa.",
      );
    } finally {
      setSwitchingSessionId("");
    }
  }

  async function handleNewConversation() {
    setErrorMessage("");
    setSending(true);
    setPendingUserMessage("");
    setActiveOverlay("");
    setActionsCtaDismissed(false);
    try {
      const response = await startNewLuminaSession();
      setPayload(response);
      setDraft("");
    } catch (error) {
      setErrorMessage(
        error?.data?.error || error?.message || "Nao consegui iniciar uma nova conversa.",
      );
    } finally {
      setSending(false);
    }
  }

  async function handleSendMessage(customText = "", actionKey = "") {
    const textToSend = String(customText || draft || "").trim();
    if (!textToSend || sending || bootstrapping || !canUseLumina) return;

    if (isHistoricalView) {
      setPayload((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          session: prev.activeSession || null,
          messages:
            prev.activeSession &&
            String(prev.activeSession?._id || "") ===
              String(prev.session?._id || "")
              ? prev.messages
              : [],
        };
      });
    }

    setSending(true);
    setErrorMessage("");
    setPendingUserMessage(textToSend);
    setDraft("");
    setActiveOverlay("");
    setActionsCtaDismissed(true);

    try {
      const response = await sendLuminaMessage({
        text: textToSend,
        actionKey,
      });
      setPayload(response);
    } catch (error) {
      if (!String(actionKey || "").trim()) {
        setDraft(textToSend);
      }
      setErrorMessage(
        error?.data?.error || error?.message || "Nao consegui enviar sua mensagem agora.",
      );
    } finally {
      setPendingUserMessage("");
      setSending(false);
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  }

  function toggleOverlay(panelKey) {
    if (panelKey === "actions") {
      setActionsCtaDismissed(true);
    }
    setActiveOverlay((currentValue) => (currentValue === panelKey ? "" : panelKey));
  }

  if (!canUseLumina || typeof document === "undefined") {
    return null;
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        initial="hidden"
        animate="visible"
        whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.02 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
        transition={motionPreset.transitions.soft}
        variants={motionPreset.launcherVariants}
        className={[
          "fixed bottom-6 right-6 z-[95] inline-flex items-center gap-3 rounded-full border px-4 py-3 shadow-[0_24px_48px_-24px_rgba(37,99,235,0.7)] transition hover:brightness-110",
          isDark
            ? "border-white/10 bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white"
            : "border-slate-200/80 bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white",
        ].join(" ")}
        aria-label="Abrir chat da Lumina"
      >
        <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/15">
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-white/20 blur-md"
            variants={motionPreset.launcherGlowVariants}
            initial="idle"
            animate={open ? "open" : "idle"}
            transition={motionPreset.transitions.glow}
          />
          <Bot className="h-5 w-5" />
        </div>
        <div className="hidden text-left sm:block">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/80">
            Lumina
          </div>
          <div className="text-sm font-semibold">Falar com a agente</div>
        </div>
      </motion.button>

      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              key="lumina-dialog"
              className="fixed inset-0 z-[130]"
              role="dialog"
              aria-modal="true"
            >
              <motion.div
                className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
                onClick={() => setOpen(false)}
                variants={motionPreset.overlayVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={motionPreset.transitions.base}
              />

              <motion.aside
                variants={motionPreset.drawerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={motionPreset.transitions.panel}
                className={[
                  "absolute inset-x-0 bottom-0 top-0 flex max-h-screen flex-col border shadow-[0_28px_80px_-36px_rgba(15,23,42,0.7)] md:inset-y-4 md:right-4 md:left-auto md:w-[460px] md:rounded-[30px]",
                  isDark
                    ? "border-white/10 bg-[linear-gradient(180deg,rgba(8,15,28,0.98),rgba(4,10,20,0.98))] text-white"
                    : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,251,0.98))] text-slate-900",
                ].join(" ")}
              >
                <motion.div
                  variants={motionPreset.headerVariants.container}
                  initial="hidden"
                  animate="visible"
                  className={[
                    "border-b px-4 py-4 md:px-5",
                    isDark ? "border-white/10" : "border-slate-200/80",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <motion.div
                      variants={motionPreset.headerVariants.item}
                      className="flex items-start gap-3"
                    >
                      <motion.div
                        variants={motionPreset.headerVariants.item}
                        className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white shadow-[0_18px_36px_-24px_rgba(37,99,235,0.7)]"
                      >
                        <Sparkles className="h-5 w-5" />
                      </motion.div>
                      <motion.div variants={motionPreset.headerVariants.item}>
                        <div
                          className={[
                            "text-[11px] font-bold uppercase tracking-[0.22em]",
                            isDark ? "text-slate-400" : "text-slate-500",
                          ].join(" ")}
                        >
                          Chat web
                        </div>
                        <div className="mt-1 text-lg font-black tracking-tight">
                          Lumina
                        </div>
                        <motion.div
                          variants={motionPreset.headerVariants.item}
                          className={[
                            "mt-1 flex items-center gap-2 text-sm",
                            isDark ? "text-slate-300" : "text-slate-600",
                          ].join(" ")}
                        >
                          <motion.span
                            className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400"
                            animate={
                              prefersReducedMotion
                                ? { opacity: 1, scale: 1 }
                                : { opacity: [0.7, 1, 0.7], scale: [1, 1.08, 1] }
                            }
                            transition={motionPreset.transitions.glow}
                          />
                          {payload?.agent?.subtitle || "Agente operacional da sua carteira"}
                        </motion.div>
                      </motion.div>
                    </motion.div>

                    <motion.button
                      variants={motionPreset.headerVariants.item}
                      type="button"
                      onClick={() => setOpen(false)}
                      whileHover={prefersReducedMotion ? undefined : { rotate: 4, scale: 1.03 }}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                      className={[
                        "inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition",
                        isDark
                          ? "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                          : "border-slate-200/80 bg-white/85 text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                      ].join(" ")}
                      aria-label="Fechar chat da Lumina"
                    >
                      <X className="h-5 w-5" />
                    </motion.button>
                  </div>

                  <motion.div
                    variants={motionPreset.headerVariants.item}
                    className="mt-4 flex flex-wrap gap-2"
                  >
                    <motion.div
                      whileHover="hover"
                      whileTap="tap"
                      variants={motionPreset.sendButtonVariants}
                      initial="idle"
                      animate="idle"
                    >
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleNewConversation}
                        disabled={sending || bootstrapping}
                      >
                        {sending && !pendingUserMessage ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Nova conversa
                      </Button>
                    </motion.div>

                    {recentSessions.length > 0 ? (
                      <OverlayControlButton
                        icon={History}
                        label="Historico"
                        onClick={() => toggleOverlay("history")}
                        isDark={isDark}
                        active={isHistoryOverlayOpen}
                        disabled={bootstrapping}
                        motionPreset={motionPreset}
                      />
                    ) : null}

                    {actionMenu.length > 0 ? (
                      <OverlayControlButton
                        icon={LayoutGrid}
                        label="Acoes"
                        onClick={() => toggleOverlay("actions")}
                        isDark={isDark}
                        active={isActionsOverlayOpen}
                        highlighted={shouldHighlightActionsCta}
                        disabled={bootstrapping}
                        motionPreset={motionPreset}
                      />
                    ) : null}
                  </motion.div>
                </motion.div>

                <div className="relative flex min-h-0 flex-1 flex-col">
                  <AnimatePresence initial={false}>
                    {activeOverlay ? (
                      <motion.button
                        key="lumina-content-overlay-backdrop"
                        type="button"
                        aria-label="Fechar painel"
                        onClick={() => setActiveOverlay("")}
                        variants={motionPreset.contentOverlayBackdropVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={motionPreset.transitions.base}
                        className={[
                          "absolute inset-0 z-10",
                          isDark ? "bg-slate-950/35" : "bg-slate-900/10",
                        ].join(" ")}
                      />
                    ) : null}
                  </AnimatePresence>

                  <AnimatePresence initial={false}>
                    {isHistoryOverlayOpen ? (
                      <motion.section
                        key="lumina-history-overlay"
                        variants={
                          isMobile
                            ? motionPreset.sheetPanelVariants
                            : motionPreset.floatingPanelVariants
                        }
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={motionPreset.transitions.panel}
                        className={[
                          "absolute z-20 border px-4 py-4 shadow-[0_28px_80px_-36px_rgba(15,23,42,0.58)]",
                          isMobile
                            ? "inset-x-0 bottom-0 max-h-[60vh] rounded-t-[28px] rounded-b-none"
                            : "inset-x-4 top-4 max-h-[360px] rounded-[24px] md:inset-x-5",
                          isDark
                            ? "border-white/10 bg-[linear-gradient(180deg,rgba(16,25,44,0.82),rgba(10,18,34,0.78))]"
                            : "border-slate-200/80 bg-white/95",
                        ].join(" ")}
                      >
                        <motion.div
                          variants={motionPreset.overlayPanelHeaderVariants.container}
                          initial="hidden"
                          animate="visible"
                          className="flex items-start justify-between gap-3"
                        >
                          <motion.div variants={motionPreset.overlayPanelHeaderVariants.item}>
                            <div
                              className={[
                                "text-[10px] font-bold uppercase tracking-[0.2em]",
                                isDark ? "text-slate-400" : "text-slate-500",
                              ].join(" ")}
                            >
                              Historico
                            </div>
                            <div
                              className={[
                                "mt-1 text-sm font-semibold",
                                isDark ? "text-white" : "text-slate-950",
                              ].join(" ")}
                            >
                              Conversas recentes da sua carteira
                            </div>
                          </motion.div>

                          <motion.button
                            variants={motionPreset.categoryTabVariants}
                            whileHover="hover"
                            whileTap="tap"
                            type="button"
                            onClick={() => setActiveOverlay("")}
                            className={[
                              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                              isDark
                                ? "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                                : "border-slate-200/80 bg-white text-slate-600 hover:bg-slate-100",
                            ].join(" ")}
                          >
                            Fechar
                            <X className="h-4 w-4" />
                          </motion.button>
                        </motion.div>

                        <LayoutGroup id="lumina-history-panel">
                          <motion.div
                            variants={motionPreset.recentSessionsVariants.container}
                            initial="hidden"
                            animate="visible"
                            className={[
                              "mt-3 grid gap-2 overflow-y-auto pr-1",
                              isMobile ? "max-h-[42vh]" : "max-h-[270px]",
                            ].join(" ")}
                          >
                            <AnimatePresence initial={false}>
                              {recentSessions.map((session) => (
                                <RecentSessionItem
                                  key={session?._id}
                                  session={session}
                                  isDark={isDark}
                                  selected={
                                    String(session?._id || "") === String(currentSession?._id || "")
                                  }
                                  loading={switchingSessionId === String(session?._id || "")}
                                  onOpen={handleOpenSession}
                                  motionPreset={motionPreset}
                                  listMode
                                />
                              ))}
                            </AnimatePresence>
                          </motion.div>
                        </LayoutGroup>
                      </motion.section>
                    ) : null}

                    {isActionsOverlayOpen && actionMenu.length > 0 ? (
                      <div
                        key="lumina-actions-overlay"
                        className={[
                          "absolute z-20",
                          isMobile
                            ? "inset-x-0 bottom-0"
                            : "inset-x-4 top-4 md:inset-x-5",
                        ].join(" ")}
                      >
                        <LuminaActionMenu
                          actionMenu={actionMenu}
                          selectedCategoryKey={selectedCategoryKey}
                          onSelectCategory={setSelectedCategoryKey}
                          onSelectAction={handleSendMessage}
                          onClose={() => setActiveOverlay("")}
                          isDark={isDark}
                          isMobile={isMobile}
                          disabled={sending || bootstrapping}
                          motionPreset={motionPreset}
                        />
                      </div>
                    ) : null}
                  </AnimatePresence>

                  <AnimatePresence initial={false}>
                    {errorMessage ? (
                      <motion.div
                        key="lumina-error"
                        variants={motionPreset.welcomeCardVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={motionPreset.transitions.base}
                        className={[
                          "mx-4 mt-4 rounded-[22px] border px-4 py-3 text-sm md:mx-5",
                          isDark
                            ? "border-red-400/20 bg-red-400/10 text-red-100"
                            : "border-red-200/80 bg-red-50 text-red-700",
                        ].join(" ")}
                      >
                        <div className="font-semibold">Nao consegui concluir essa etapa.</div>
                        <div className="mt-1">{errorMessage}</div>
                        {!payload ? (
                          <div className="mt-3">
                            <Button
                              type="button"
                              size="sm"
                              onClick={reloadBootstrap}
                              disabled={bootstrapping}
                            >
                              {bootstrapping ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              Tentar novamente
                            </Button>
                          </div>
                        ) : null}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  <motion.div
                    ref={messagesRef}
                    variants={motionPreset.messageListVariants.container}
                    initial="hidden"
                    animate="visible"
                    className="relative z-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-5"
                  >
                    <AnimatePresence initial={false}>
                      {!payload && bootstrapping ? (
                        <motion.div
                          key="lumina-bootstrap"
                          variants={motionPreset.welcomeCardVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          transition={motionPreset.transitions.base}
                          className={[
                            "rounded-[24px] border px-4 py-5 text-sm",
                            isDark
                              ? "border-white/10 bg-white/5 text-slate-300"
                              : "border-slate-200/80 bg-white text-slate-600",
                          ].join(" ")}
                        >
                          <div className="flex items-center gap-3">
                            <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                            Preparando a Lumina para voce...
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    <AnimatePresence initial={false}>
                      {payload?.welcomeMessage && displayedMessages.length === 0 ? (
                        <motion.div
                          key="lumina-welcome"
                          variants={motionPreset.welcomeCardVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          transition={motionPreset.transitions.base}
                          className={[
                            "rounded-[28px] border px-5 py-5",
                            isDark
                              ? "border-white/10 bg-[linear-gradient(180deg,rgba(16,25,44,0.82),rgba(10,18,34,0.76))]"
                              : "border-slate-200/80 bg-white",
                          ].join(" ")}
                        >
                          <div className="flex items-start gap-3">
                            <motion.div
                              initial={{ scale: prefersReducedMotion ? 1 : 0.92, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={motionPreset.transitions.soft}
                              className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white"
                            >
                              <MessageCircleMore className="h-5 w-5" />
                            </motion.div>
                            <div>
                              <div
                                className={[
                                  "text-sm font-semibold",
                                  isDark ? "text-white" : "text-slate-950",
                                ].join(" ")}
                              >
                                {payload.welcomeMessage}
                              </div>
                              <div
                                className={[
                                  "mt-3 text-sm leading-6",
                                  isDark ? "text-slate-300" : "text-slate-600",
                                ].join(" ")}
                              >
                                Experimente pedir uma proposta, consultar agenda, cobrar um cliente
                                ou atualizar um cadastro.
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    <AnimatePresence initial={false}>
                      {displayedMessages.map((item) => (
                        <MessageBubble
                          key={item?._id || item?.createdAt}
                          item={item}
                          isDark={isDark}
                          motionPreset={motionPreset}
                        />
                      ))}
                      {sending ? (
                        <TypingBubble
                          key="lumina-typing"
                          isDark={isDark}
                          motionPreset={motionPreset}
                          reducedMotion={prefersReducedMotion}
                        />
                      ) : null}
                    </AnimatePresence>
                  </motion.div>

                  <motion.div
                    variants={motionPreset.composerVariants.container}
                    initial="hidden"
                    animate="visible"
                    className={[
                      "border-t px-4 py-4 md:px-5",
                      isDark ? "border-white/10" : "border-slate-200/80",
                    ].join(" ")}
                  >
                    <AnimatePresence initial={false}>
                      {quickReplies.length > 0 ? (
                        <motion.div
                          key="lumina-quick-replies"
                          variants={motionPreset.quickRepliesVariants.container}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          className="mb-3 flex flex-wrap gap-2"
                        >
                          {quickReplies.map((reply, index) => (
                            <motion.button
                              key={`${reply?.value || reply?.label || "reply"}-${index}`}
                              type="button"
                              disabled={sending || bootstrapping}
                              onClick={() => handleSendMessage(reply?.value || reply?.label || "")}
                              whileHover="hover"
                              whileTap="tap"
                              variants={motionPreset.quickReplyVariants}
                              transition={motionPreset.transitions.chip}
                              className={[
                                "rounded-full border px-3 py-2 text-sm font-semibold transition disabled:opacity-60",
                                isDark
                                  ? "border-white/10 bg-white/5 text-slate-100 hover:border-cyan-400/20 hover:bg-white/10"
                                  : "border-slate-200/80 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50",
                              ].join(" ")}
                            >
                              {reply?.label || reply?.value || "Acao rapida"}
                            </motion.button>
                          ))}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    <div className="flex items-end gap-3">
                      <motion.div
                        animate={composerFocused ? "focus" : "idle"}
                        variants={motionPreset.composerVariants.inputShell}
                        transition={motionPreset.transitions.micro}
                        className={[
                          "flex-1 rounded-[26px] border p-1.5",
                          isDark
                            ? "border-white/10 bg-white/5"
                            : "border-slate-200/80 bg-white",
                        ].join(" ")}
                      >
                        <Textarea
                          rows={2}
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          onKeyDown={handleComposerKeyDown}
                          onFocus={() => setComposerFocused(true)}
                          onBlur={() => setComposerFocused(false)}
                          disabled={sending || bootstrapping}
                          placeholder={composerPlaceholder}
                          className={[
                            "min-h-[88px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
                            isDark
                              ? "text-white placeholder:text-slate-500"
                              : "text-slate-900 placeholder:text-slate-400",
                          ].join(" ")}
                        />
                      </motion.div>

                      <motion.div
                        variants={motionPreset.sendButtonVariants}
                        initial="idle"
                        animate="idle"
                        whileHover={
                          sending || bootstrapping || String(draft || "").trim().length === 0
                            ? undefined
                            : "hover"
                        }
                        whileTap={
                          sending || bootstrapping || String(draft || "").trim().length === 0
                            ? undefined
                            : "tap"
                        }
                        transition={motionPreset.transitions.soft}
                      >
                        <Button
                          type="button"
                          onClick={() => handleSendMessage()}
                          disabled={
                            sending ||
                            bootstrapping ||
                            String(draft || "").trim().length === 0
                          }
                          className="h-[52px] w-[52px] rounded-[22px] px-0"
                          aria-label="Enviar mensagem para a Lumina"
                        >
                          <AnimatePresence mode="wait" initial={false}>
                            {sending ? (
                              <motion.span
                                key="lumina-send-loading"
                                initial={{ opacity: 0, scale: 0.8, rotate: -12 }}
                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                exit={{ opacity: 0, scale: 0.8, rotate: 12 }}
                                transition={motionPreset.transitions.micro}
                                className="inline-flex"
                              >
                                <Loader2 className="h-4 w-4 animate-spin" />
                              </motion.span>
                            ) : (
                              <motion.span
                                key="lumina-send-icon"
                                initial={{ opacity: 0, scale: 0.8, rotate: 12 }}
                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                exit={{ opacity: 0, scale: 0.8, rotate: -12 }}
                                transition={motionPreset.transitions.micro}
                                className="inline-flex"
                              >
                                <SendHorizonal className="h-4 w-4" />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </Button>
                      </motion.div>
                    </div>

                    <motion.div
                      variants={motionPreset.headerVariants.item}
                      initial="hidden"
                      animate="visible"
                      className={[
                        "mt-3 text-xs leading-5",
                        isDark ? "text-slate-400" : "text-slate-500",
                      ].join(" ")}
                    >
                      {isHistoricalView
                        ? "Se voce enviar um novo comando agora, a Lumina continua pela conversa ativa sem reset brusco."
                        : "A Lumina responde com tom mais humano aqui no site, mas continua pedindo confirmacoes explicitas antes de executar acoes."}
                    </motion.div>
                  </motion.div>
                </div>
              </motion.aside>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
