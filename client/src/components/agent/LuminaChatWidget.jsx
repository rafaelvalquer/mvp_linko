import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  Bot,
  History,
  LayoutGrid,
  Lightbulb,
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
  getLuminaPassiveStatus,
  getLuminaSession,
  sendLuminaMessage,
  startNewLuminaSession,
} from "../../app/agentWebApi.js";
import useThemeToggle from "../../app/useThemeToggle.js";
import { canUseWhatsAppAiOfferCreation } from "../../utils/planFeatures.js";
import { hasWorkspaceModuleAccess } from "../../utils/workspacePermissions.js";
import Button from "../appui/Button.jsx";
import { Textarea } from "../appui/Input.jsx";
import { getLuminaMotionPreset } from "./luminaMotion.js";

const PASSIVE_TEASER_DISMISS_MS = 15 * 60 * 1000;
const PASSIVE_ACKNOWLEDGE_MS = 45 * 60 * 1000;
const PASSIVE_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const PASSIVE_FOCUS_STALE_MS = 10 * 60 * 1000;
const INSIGHT_ACTION_KEY = "insight_summary";
const INSIGHT_ACTION_TEXT = "Quero gerar um insight financeiro";
const INTERRUPTIBLE_OPERATIONAL_FLOW_TYPES = new Set([
  "offer_create",
  "offer_query",
  "offer_payment_reminder",
  "offer_cancel",
  "client_create",
  "product_create",
  "product_update",
  "lookup_query",
  "agenda_query",
  "booking_reschedule",
  "booking_cancel",
]);
const DEFAULT_PASSIVE_SESSION_STATE = {
  lastShownSignature: "",
  lastAcknowledgedSignature: "",
  lastDismissedSignature: "",
  nextEligibleAt: 0,
  lastFetchedAt: 0,
};

function readPassiveSessionState(storageKey) {
  if (!storageKey || typeof window === "undefined") {
    return { ...DEFAULT_PASSIVE_SESSION_STATE };
  }

  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return { ...DEFAULT_PASSIVE_SESSION_STATE };
    const parsed = JSON.parse(raw);

    return {
      lastShownSignature: String(parsed?.lastShownSignature || "").trim(),
      lastAcknowledgedSignature: String(parsed?.lastAcknowledgedSignature || "").trim(),
      lastDismissedSignature: String(parsed?.lastDismissedSignature || "").trim(),
      nextEligibleAt: Number(parsed?.nextEligibleAt || 0),
      lastFetchedAt: Number(parsed?.lastFetchedAt || 0),
    };
  } catch {
    return { ...DEFAULT_PASSIVE_SESSION_STATE };
  }
}

function writePassiveSessionState(storageKey, value) {
  if (!storageKey || typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(value));
  } catch {}
}

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

function isInterruptibleOperationalSession(session = null) {
  if (!session?._id) return false;
  if (session?.isTerminal === true) return false;

  const state = String(session?.state || "").trim().toUpperCase();
  const flowType = String(session?.flowType || "").trim();

  if (!state || state === "NEW") return false;
  return INTERRUPTIBLE_OPERATIONAL_FLOW_TYPES.has(flowType);
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
  iconClassName = "",
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
        <Icon className={["h-4 w-4", iconClassName].join(" ").trim()} />
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

function LuminaReplySelector({
  replyControls,
  onSelectOption,
  onClose,
  isDark,
  isMobile,
  disabled,
  motionPreset,
}) {
  const options = Array.isArray(replyControls?.options) ? replyControls.options : [];
  if (!options.length) return null;

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
            Escolhas
          </div>
          <div
            className={[
              "mt-1 text-sm font-semibold",
              isDark ? "text-white" : "text-slate-950",
            ].join(" ")}
          >
            {replyControls?.title || "Selecione uma opcao"}
          </div>
          <div
            className={[
              "mt-2 text-xs leading-5",
              isDark ? "text-slate-300" : "text-slate-600",
            ].join(" ")}
          >
            Escolha uma opcao abaixo ou responda em texto, se preferir.
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

      <motion.div
        variants={motionPreset.actionGridVariants.container}
        initial="hidden"
        animate="visible"
        className={[
          "mt-3 grid gap-2 overflow-y-auto pr-1",
          isMobile ? "max-h-[42vh]" : "max-h-[320px]",
        ].join(" ")}
      >
        <AnimatePresence initial={false}>
          {options.map((option, index) => (
            <motion.button
              key={`${option?.value || option?.label || "option"}-${index}`}
              layout
              type="button"
              disabled={disabled}
              onClick={() => onSelectOption?.(option)}
              whileHover="hover"
              whileTap="tap"
              variants={motionPreset.actionCardVariants}
              transition={motionPreset.transitions.soft}
              className={[
                "rounded-[18px] border px-3.5 py-3 text-left disabled:opacity-60",
                option?.variant === "danger"
                  ? isDark
                    ? "border-rose-400/20 bg-rose-400/10 text-rose-50"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                  : isDark
                    ? "border-white/10 bg-white/5 text-slate-100"
                    : "border-slate-200/80 bg-white text-slate-800",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <div
                  className={[
                    "mt-0.5 inline-flex min-h-[26px] min-w-[26px] items-center justify-center rounded-full px-2 text-[11px] font-bold",
                    option?.variant === "danger"
                      ? isDark
                        ? "bg-rose-300/12 text-rose-100"
                        : "bg-rose-100 text-rose-700"
                      : isDark
                        ? "bg-cyan-400/12 text-cyan-100"
                        : "bg-cyan-100 text-cyan-700",
                  ].join(" ")}
                >
                  {String(option?.value || "").trim().match(/^\d+$/)
                    ? String(option.value).trim()
                    : option?.variant === "danger"
                      ? "X"
                      : "+"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">
                    {option?.label || option?.value || "Opcao"}
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </motion.div>
    </motion.section>
  );
}

function LuminaAutomationInbox({
  items,
  onRunAutomation,
  onDismiss,
  isDark,
  disabled,
  motionPreset,
}) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <motion.section
      variants={motionPreset.welcomeCardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={motionPreset.transitions.base}
      className={[
        "rounded-[26px] border px-4 py-4",
        isDark
          ? "border-cyan-400/15 bg-[linear-gradient(180deg,rgba(10,24,42,0.78),rgba(8,17,32,0.82))]"
          : "border-cyan-100 bg-[linear-gradient(180deg,rgba(239,246,255,0.96),rgba(255,255,255,0.98))]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={[
              "text-[10px] font-bold uppercase tracking-[0.2em]",
              isDark ? "text-cyan-200/70" : "text-cyan-700/80",
            ].join(" ")}
          >
            Sugestoes da Lumina
          </div>
          <div
            className={[
              "mt-1 text-sm font-semibold",
              isDark ? "text-white" : "text-slate-950",
            ].join(" ")}
          >
            Oportunidades para revisar agora
          </div>
        </div>
        <div
          className={[
            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
            isDark ? "bg-cyan-400/10 text-cyan-100" : "bg-cyan-100 text-cyan-700",
          ].join(" ")}
        >
          {items.length}
        </div>
      </div>

      <motion.div
        variants={motionPreset.actionGridVariants.container}
        initial="hidden"
        animate="visible"
        className="mt-3 grid gap-2.5"
      >
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.article
              key={item?.id || item?.title}
              layout
              variants={motionPreset.actionCardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={motionPreset.transitions.soft}
              className={[
                "rounded-[20px] border px-3.5 py-3",
                isDark
                  ? "border-white/10 bg-white/5 text-slate-100"
                  : "border-slate-200/80 bg-white/90 text-slate-900",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {item?.title || "Acao sugerida"}
                  </div>
                  <div
                    className={[
                      "mt-1 line-clamp-3 text-xs leading-5",
                      isDark ? "text-slate-300" : "text-slate-600",
                    ].join(" ")}
                  >
                    {item?.summary || ""}
                  </div>
                </div>
                <div
                  className={[
                    "shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
                    Number(item?.priority || 0) >= 3
                      ? isDark
                        ? "bg-rose-400/12 text-rose-100"
                        : "bg-rose-100 text-rose-700"
                      : isDark
                        ? "bg-white/8 text-slate-300"
                        : "bg-slate-100 text-slate-600",
                  ].join(" ")}
                >
                  {Number(item?.priority || 0) >= 3 ? "Alta" : "Hoje"}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onRunAutomation?.(item)}
                  disabled={disabled}
                >
                  {item?.ctaLabel || "Abrir"}
                </Button>

                <button
                  type="button"
                  onClick={() => onDismiss?.(item?.id || "")}
                  disabled={disabled}
                  className={[
                    "inline-flex items-center rounded-full px-3 py-2 text-xs font-semibold transition disabled:opacity-60",
                    isDark
                      ? "text-slate-300 hover:bg-white/5 hover:text-white"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
                  ].join(" ")}
                >
                  {item?.dismissLabel || "Agora nao"}
                </button>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </motion.div>
    </motion.section>
  );
}

function LuminaPassiveTeaser({
  message,
  count = 0,
  onOpen,
  onDismiss,
  isDark,
  motionPreset,
}) {
  if (!message) return null;

  return (
    <motion.div
      variants={motionPreset.welcomeCardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={motionPreset.transitions.base}
      className="fixed bottom-24 right-4 z-[96] w-[min(320px,calc(100vw-2rem))] md:right-6"
    >
      <div
        className={[
          "relative rounded-[24px] border px-4 py-3 text-left shadow-[0_24px_48px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl transition",
          isDark
            ? "border-cyan-400/20 bg-[linear-gradient(135deg,rgba(8,22,40,0.96),rgba(8,34,50,0.94))] text-white"
            : "border-cyan-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(236,254,255,0.94))] text-slate-900",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={onOpen}
          className={[
            "group block w-full rounded-[18px] text-left transition",
            isDark ? "hover:text-white" : "hover:text-slate-950",
          ].join(" ")}
        >
          <div className="flex items-start gap-3 pr-10">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white shadow-[0_16px_30px_-22px_rgba(37,99,235,0.7)]">
              <Sparkles className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div>
                <div
                  className={[
                    "text-[10px] font-bold uppercase tracking-[0.18em]",
                    isDark ? "text-cyan-200/80" : "text-cyan-700",
                  ].join(" ")}
                >
                  Lumina
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {message}
                </div>
              </div>

              <div
                className={[
                  "mt-2 flex items-center justify-between gap-3 text-xs",
                  isDark ? "text-slate-300" : "text-slate-600",
                ].join(" ")}
              >
                <span>
                  {count} oportunidade{count === 1 ? "" : "s"} relevante
                  {count === 1 ? "" : "s"} agora
                </span>
                <span
                  className={[
                    "rounded-full px-2.5 py-1 font-semibold",
                    isDark ? "bg-cyan-400/12 text-cyan-100" : "bg-cyan-100 text-cyan-700",
                  ].join(" ")}
                >
                  Abrir Lumina
                </span>
              </div>
            </div>
          </div>
        </button>

        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className={[
              "absolute right-3 top-3 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition",
              isDark
                ? "text-slate-300 hover:bg-white/8 hover:text-white"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
            ].join(" ")}
            aria-label="Dispensar sugestao passiva da Lumina"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function LuminaChatWidget() {
  const { isDark } = useThemeToggle();
  const { isAuthenticated, user, workspace, perms } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [openingPassiveSession, setOpeningPassiveSession] = useState(false);
  const [sending, setSending] = useState(false);
  const [runningInsight, setRunningInsight] = useState(false);
  const [switchingSessionId, setSwitchingSessionId] = useState("");
  const [payload, setPayload] = useState(null);
  const [passiveStatus, setPassiveStatus] = useState(null);
  const [activePassiveNudge, setActivePassiveNudge] = useState(null);
  const [passiveSessionState, setPassiveSessionState] = useState(
    DEFAULT_PASSIVE_SESSION_STATE,
  );
  const [pendingPassiveEntry, setPendingPassiveEntry] = useState(null);
  const [draft, setDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState("");
  const [activeOverlay, setActiveOverlay] = useState("");
  const [actionsCtaDismissed, setActionsCtaDismissed] = useState(false);
  const [dismissedAutomationIds, setDismissedAutomationIds] = useState([]);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState("");
  const [composerFocused, setComposerFocused] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false,
  );
  const messagesRef = useRef(null);
  const bootstrapRequestIdRef = useRef(0);
  const passiveRequestIdRef = useRef(0);
  const passiveFetchedAtRef = useRef(0);
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
  const canUseInsightByPermissions =
    canUseLumina &&
    (hasWorkspaceModuleAccess(perms, "reports") ||
      user?.role === "owner" ||
      !["business", "enterprise"].includes(String(plan || "").trim().toLowerCase()));
  const passiveSessionStorageKey = useMemo(() => {
    const workspaceId = String(workspace?._id || workspace?.id || perms?.workspaceId || "").trim();
    const userId = String(user?._id || user?.id || "").trim();
    if (!workspaceId || !userId) return "";
    return `lumina-passive:${workspaceId}:${userId}`;
  }, [workspace?._id, workspace?.id, perms?.workspaceId, user?._id, user?.id]);

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

  const replyControls = useMemo(() => {
    const explicitReplyControls =
      payload?.replyControls && typeof payload.replyControls === "object"
        ? payload.replyControls
        : payload?.ui?.replyControls && typeof payload.ui.replyControls === "object"
          ? payload.ui.replyControls
          : null;

    if (
      explicitReplyControls &&
      Array.isArray(explicitReplyControls.options) &&
      explicitReplyControls.options.length > 0
    ) {
      return explicitReplyControls;
    }

    const legacyQuickReplies = Array.isArray(payload?.quickReplies)
      ? payload.quickReplies
      : Array.isArray(payload?.ui?.quickReplies)
        ? payload.ui.quickReplies
        : [];

    if (!legacyQuickReplies.length) return null;

    return {
      presentation: "chips",
      options: legacyQuickReplies,
    };
  }, [payload]);

  const chipReplies = useMemo(() => {
    if (replyControls?.presentation !== "chips") return [];
    return Array.isArray(replyControls?.options) ? replyControls.options : [];
  }, [replyControls]);

  const selectorReplyControl = useMemo(() => {
    if (replyControls?.presentation !== "selector") return null;
    if (!Array.isArray(replyControls?.options) || replyControls.options.length === 0) return null;
    return replyControls;
  }, [replyControls]);

  const actionMenu = useMemo(() => {
    if (Array.isArray(payload?.actionMenu) && payload.actionMenu.length > 0) {
      return payload.actionMenu;
    }
    if (Array.isArray(payload?.ui?.actionMenu) && payload.ui.actionMenu.length > 0) {
      return payload.ui.actionMenu;
    }
    return [];
  }, [payload]);
  const canUseInsight = useMemo(
    () =>
      canUseInsightByPermissions ||
      actionMenu.some((category) =>
        Array.isArray(category?.actions)
          ? category.actions.some(
              (action) => String(action?.actionKey || "").trim() === INSIGHT_ACTION_KEY,
            )
          : false,
      ),
    [canUseInsightByPermissions, actionMenu],
  );

  const insightAction = useMemo(() => {
    if (!canUseInsight) return null;

    const found = actionMenu
      .flatMap((category) => (Array.isArray(category?.actions) ? category.actions : []))
      .find((action) => String(action?.actionKey || "").trim() === INSIGHT_ACTION_KEY);

    return (
      found || {
        actionKey: INSIGHT_ACTION_KEY,
        label: "Insight",
        value: INSIGHT_ACTION_TEXT,
      }
    );
  }, [actionMenu, canUseInsight]);

  const recentSessions = useMemo(() => {
    if (!Array.isArray(payload?.recentSessions)) return [];
    return payload.recentSessions.slice(0, 6);
  }, [payload?.recentSessions]);

  const automationInbox = useMemo(() => {
    const source = Array.isArray(payload?.automationInbox) ? payload.automationInbox : [];
    if (!dismissedAutomationIds.length) return source;
    return source.filter((item) => !dismissedAutomationIds.includes(String(item?.id || "")));
  }, [payload?.automationInbox, dismissedAutomationIds]);

  const activeSession = payload?.activeSession || null;
  const currentSession = payload?.session || null;
  const hasInterruptibleConversation = isInterruptibleOperationalSession(activeSession);
  const composerPlaceholder =
    payload?.ui?.composerPlaceholder ||
    "Fale com a Lumina sobre proposta, agenda, cobranca ou cadastro";
  const isHistoricalView =
    (!!currentSession?._id &&
      !!activeSession?._id &&
      String(currentSession._id) !== String(activeSession._id)) ||
    (!!currentSession?.isTerminal && !activeSession?._id);
  const passiveEnabled = passiveStatus?.enabled === true;
  const passiveOpportunityCount = Number(passiveStatus?.count || 0);
  const passiveTopOpportunityId = String(passiveStatus?.topOpportunity?.id || "").trim();
  const passiveMessage = String(passiveStatus?.humanizedMessage || "").trim();
  const passiveBadgeLabel =
    passiveOpportunityCount > 9 ? "9+" : String(passiveOpportunityCount || 0);
  const passiveSignature = `${passiveTopOpportunityId}:${passiveMessage}:${passiveOpportunityCount}`;
  const activePassiveSignature = String(activePassiveNudge?.signature || "").trim();
  const passiveEntryMessage = useMemo(() => {
    if (!pendingPassiveEntry?.message) return null;
    return {
      _id: `lumina-passive-entry-${pendingPassiveEntry.signature || pendingPassiveEntry.id || "default"}`,
      role: "assistant",
      inputType: "text",
      text: pendingPassiveEntry.message,
      createdAt: pendingPassiveEntry.createdAt || new Date().toISOString(),
    };
  }, [pendingPassiveEntry]);
  const isHistoryOverlayOpen = activeOverlay === "history";
  const isActionsOverlayOpen = activeOverlay === "actions";
  const isReplySelectorOpen = activeOverlay === "reply-selector";
  const isInsightSwitchOverlayOpen = activeOverlay === "insight-switch";
  const showPassiveLauncherSignal = !!activePassiveNudge;
  const shouldShowPassiveEntryBubble =
    !!passiveEntryMessage &&
    !bootstrapping;
  const shouldHighlightLauncher =
    !open && showPassiveLauncherSignal;
  const shouldShowPassiveTeaser =
    !open &&
    showPassiveLauncherSignal &&
    !!String(activePassiveNudge?.message || "").trim();
  const shouldHighlightActionsCta =
    open &&
    !actionsCtaDismissed &&
    displayedMessages.length === 0 &&
    !sending &&
    !bootstrapping &&
    actionMenu.length > 0 &&
    !isActionsOverlayOpen;
  const insightSwitchReplyControl = useMemo(() => {
    if (!hasInterruptibleConversation) return null;

    return {
      title: "Existe uma conversa em andamento",
      options: [
        {
          label: "Abrir insight agora",
          value: "OPEN_INSIGHT",
        },
        {
          label: "Continuar conversa atual",
          value: "KEEP_CURRENT",
        },
      ],
    };
  }, [hasInterruptibleConversation]);

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
    setDismissedAutomationIds([]);
  }, [open, canUseLumina]);

  useEffect(() => {
    if (activeOverlay !== "reply-selector") return;
    if (selectorReplyControl) return;
    setActiveOverlay("");
  }, [activeOverlay, selectorReplyControl]);

  useEffect(() => {
    if (activeOverlay !== "insight-switch") return;
    if (insightSwitchReplyControl) return;
    setActiveOverlay("");
  }, [activeOverlay, insightSwitchReplyControl]);

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

  async function loadPassiveStatus() {
    if (!canUseLumina) {
      setPassiveStatus(null);
      return null;
    }

    const requestId = passiveRequestIdRef.current + 1;
    passiveRequestIdRef.current = requestId;

    try {
      const response = await getLuminaPassiveStatus();
      if (passiveRequestIdRef.current !== requestId) return null;
      const nextPassive =
        response?.passive && typeof response.passive === "object"
          ? response.passive
          : null;
      setPassiveStatus(nextPassive);
      const now = Date.now();
      passiveFetchedAtRef.current = now;
      setPassiveSessionState((current) => {
        const next = {
          ...current,
          lastFetchedAt: now,
        };
        writePassiveSessionState(passiveSessionStorageKey, next);
        return next;
      });
      return nextPassive;
    } catch {
      if (passiveRequestIdRef.current !== requestId) return null;
      setPassiveStatus(null);
      return null;
    }
  }

  function updatePassiveSessionState(updater) {
    setPassiveSessionState((current) => {
      const next =
        typeof updater === "function"
          ? updater(current)
          : { ...current, ...(updater || {}) };
      writePassiveSessionState(passiveSessionStorageKey, next);
      return next;
    });
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
    if (!open || !canUseLumina || payload || openingPassiveSession) return;
    void loadBootstrap();
  }, [open, canUseLumina, payload, openingPassiveSession]);

  useEffect(() => {
    const nextState = readPassiveSessionState(passiveSessionStorageKey);
    passiveFetchedAtRef.current = Number(nextState?.lastFetchedAt || 0);
    setPassiveSessionState(nextState);
    setActivePassiveNudge(null);
    setPendingPassiveEntry(null);
  }, [passiveSessionStorageKey]);

  useEffect(() => {
    if (!canUseLumina) {
      passiveRequestIdRef.current += 1;
      passiveFetchedAtRef.current = 0;
      setPassiveStatus(null);
      setActivePassiveNudge(null);
      return;
    }

    void loadPassiveStatus();

    const intervalId = window.setInterval(() => {
      void loadPassiveStatus();
    }, PASSIVE_REFRESH_INTERVAL_MS);

    function handleFocusRefresh() {
      const lastFetchedAt = Number(passiveFetchedAtRef.current || 0);
      if (!lastFetchedAt || Date.now() - lastFetchedAt >= PASSIVE_FOCUS_STALE_MS) {
        void loadPassiveStatus();
      }
    }

    window.addEventListener("focus", handleFocusRefresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocusRefresh);
    };
  }, [canUseLumina]);

  useEffect(() => {
    if (!open || !canUseLumina) return;
    void loadPassiveStatus();
  }, [open, canUseLumina]);

  useEffect(() => {
    if (open && canUseLumina) return;
    bootstrapRequestIdRef.current += 1;
    setBootstrapping(false);
  }, [open, canUseLumina]);

  useEffect(() => {
    if (!canUseLumina || !passiveEnabled || !passiveOpportunityCount || !passiveSignature) {
      setActivePassiveNudge(null);
      return;
    }

    if (activePassiveSignature === passiveSignature) {
      return;
    }

    const now = Date.now();
    const alreadyAcknowledged =
      passiveSessionState.lastAcknowledgedSignature === passiveSignature &&
      Number(passiveSessionState.nextEligibleAt || 0) > now;
    const alreadyDismissed =
      passiveSessionState.lastDismissedSignature === passiveSignature &&
      Number(passiveSessionState.nextEligibleAt || 0) > now;
    const alreadyShownRecently =
      passiveSessionState.lastShownSignature === passiveSignature &&
      Number(passiveSessionState.nextEligibleAt || 0) > now;

    if (alreadyAcknowledged || alreadyDismissed || alreadyShownRecently) {
      setActivePassiveNudge(null);
      return;
    }

    const nextNudge = {
      signature: passiveSignature,
      id: passiveTopOpportunityId || "passive-nudge",
      message: passiveMessage,
      count: passiveOpportunityCount,
      topOpportunity: passiveStatus?.topOpportunity || null,
    };

    setActivePassiveNudge(nextNudge);
    updatePassiveSessionState((current) => ({
      ...current,
      lastShownSignature: passiveSignature,
      nextEligibleAt: now + PASSIVE_TEASER_DISMISS_MS,
    }));
  }, [
    canUseLumina,
    passiveEnabled,
    passiveOpportunityCount,
    passiveSignature,
    passiveTopOpportunityId,
    passiveMessage,
    passiveStatus?.topOpportunity,
    passiveSessionState,
    activePassiveSignature,
  ]);

  useEffect(() => {
    if (open) return;
    if (!pendingPassiveEntry) return;
    setPendingPassiveEntry(null);
  }, [open, pendingPassiveEntry]);

  useEffect(() => {
    if (!passiveEntryMessage) return;
    if (pendingUserMessage) {
      setPendingPassiveEntry(null);
    }
  }, [passiveEntryMessage, pendingUserMessage]);

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
      setRunningInsight(false);
      setActiveOverlay("");
      setActionsCtaDismissed(false);
      setDismissedAutomationIds([]);
      setSelectedCategoryKey("");
      setComposerFocused(false);
      setPassiveStatus(null);
      setActivePassiveNudge(null);
      setPendingPassiveEntry(null);
      setOpeningPassiveSession(false);
      setPassiveSessionState(DEFAULT_PASSIVE_SESSION_STATE);
    }
  }, [canUseLumina]);

  async function openLuminaFromLauncher() {
    const shouldOpenFreshPassiveSession =
      showPassiveLauncherSignal &&
      String(activePassiveNudge?.message || "").trim() &&
      activePassiveSignature;

    if (!shouldOpenFreshPassiveSession) {
      setOpen(true);
      return;
    }

    const passiveEntry = {
      id: activePassiveNudge?.id || "passive-entry",
      signature: activePassiveSignature,
      message: String(activePassiveNudge?.message || "").trim(),
      topOpportunity: activePassiveNudge?.topOpportunity || null,
      createdAt: new Date().toISOString(),
    };

    setPendingPassiveEntry(passiveEntry);
    setActivePassiveNudge(null);
    updatePassiveSessionState((current) => ({
      ...current,
      lastAcknowledgedSignature: activePassiveSignature,
      lastDismissedSignature:
        current.lastDismissedSignature === activePassiveSignature
          ? ""
          : current.lastDismissedSignature,
      nextEligibleAt: Date.now() + PASSIVE_ACKNOWLEDGE_MS,
    }));
    setActiveOverlay("");
    setErrorMessage("");
    setPendingUserMessage("");
    setDraft("");
    setDismissedAutomationIds([]);
    setActionsCtaDismissed(false);
    setOpeningPassiveSession(true);
    setPayload(null);
    setOpen(true);

    bootstrapRequestIdRef.current += 1;

    try {
      const response = await startNewLuminaSession();
      setPayload(response);
      void loadPassiveStatus();
    } catch (error) {
      setErrorMessage(
        error?.data?.error || error?.message || "Nao consegui abrir a Lumina com esse contexto agora.",
      );
    } finally {
      setOpeningPassiveSession(false);
    }
  }

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
    setActivePassiveNudge(null);
    setPendingPassiveEntry(null);
    try {
      const response = await getLuminaSession(normalizedId);
      setPayload(response);
      void loadPassiveStatus();
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
    setDismissedAutomationIds([]);
    setActivePassiveNudge(null);
    setPendingPassiveEntry(null);
    try {
      const response = await startNewLuminaSession();
      setPayload(response);
      setDraft("");
      void loadPassiveStatus();
    } catch (error) {
      setErrorMessage(
        error?.data?.error || error?.message || "Nao consegui iniciar uma nova conversa.",
      );
    } finally {
      setSending(false);
    }
  }

  async function runInsightConversation() {
    if (!insightAction || runningInsight) return;

    setRunningInsight(true);
    setSending(true);
    setErrorMessage("");
    setPendingUserMessage(insightAction.value || INSIGHT_ACTION_TEXT);
    setDraft("");
    setActiveOverlay("");
    setActionsCtaDismissed(true);
    setActivePassiveNudge(null);
    setPendingPassiveEntry(null);
    setDismissedAutomationIds([]);
    setOpen(true);

    try {
      const freshConversation = await startNewLuminaSession();
      setPayload(freshConversation);

      const response = await sendLuminaMessage({
        text: insightAction.value || INSIGHT_ACTION_TEXT,
        actionKey: insightAction.actionKey || INSIGHT_ACTION_KEY,
      });

      setPayload(response);
      void loadPassiveStatus();
    } catch (error) {
      setErrorMessage(
        error?.data?.error || error?.message || "Nao consegui gerar o insight agora.",
      );
    } finally {
      setPendingUserMessage("");
      setSending(false);
      setRunningInsight(false);
    }
  }

  async function handleInsightTrigger() {
    if (!canUseInsight || !insightAction || runningInsight || sending) return;

    let effectivePayload = payload;

    if (!effectivePayload) {
      setOpen(true);
      effectivePayload = await loadBootstrap();
      if (!effectivePayload) return;
    } else if (!open) {
      setOpen(true);
    }

    if (isInterruptibleOperationalSession(effectivePayload?.activeSession || activeSession)) {
      setActiveOverlay("insight-switch");
      return;
    }

    await runInsightConversation();
  }

  function handleSelectInsightSwitchOption(option = null) {
    const decision = String(option?.value || "").trim();
    setActiveOverlay("");

    if (decision === "OPEN_INSIGHT") {
      void runInsightConversation();
    }
  }

  function handleActionMenuSelection(text = "", actionKey = "") {
    if (String(actionKey || "").trim() === INSIGHT_ACTION_KEY) {
      void handleInsightTrigger();
      return;
    }

    return handleSendMessage(text, actionKey);
  }

  async function handleSendMessage(customText = "", actionKey = "", automationContext = null) {
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
    setActivePassiveNudge(null);
    setPendingPassiveEntry(null);

    try {
      const response = await sendLuminaMessage({
        text: textToSend,
        actionKey,
        automationContext,
      });
      setPayload(response);
      void loadPassiveStatus();
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

  function handleSelectReplyOption(option = null) {
    setActiveOverlay("");
    return handleSendMessage(option?.value || option?.label || "");
  }

  function handleDismissAutomation(itemId = "") {
    const normalizedId = String(itemId || "").trim();
    if (!normalizedId) return;
    setDismissedAutomationIds((current) =>
      current.includes(normalizedId) ? current : [...current, normalizedId],
    );
  }

  async function handleRunAutomation(item = null) {
    const normalizedId = String(item?.id || "").trim();
    if (normalizedId) {
      handleDismissAutomation(normalizedId);
    }

    const sessionId = String(item?.context?.sessionId || "").trim();
    if (sessionId && !String(item?.actionKey || "").trim()) {
      await handleOpenSession(sessionId);
      return;
    }

    return handleSendMessage(
      item?.text || item?.title || "",
      item?.actionKey || "",
      item?.context || null,
    );
  }

  if (!canUseLumina || typeof document === "undefined") {
    return null;
  }

  return (
    <>
      <AnimatePresence initial={false}>
        {shouldShowPassiveTeaser ? (
          <LuminaPassiveTeaser
            key={`lumina-passive-teaser-${passiveSignature || "default"}`}
            message={String(activePassiveNudge?.message || "").trim()}
            count={Number(activePassiveNudge?.count || 0)}
            onOpen={openLuminaFromLauncher}
            onDismiss={() => {
              const dismissedSignature = activePassiveSignature;
              setActivePassiveNudge(null);
              updatePassiveSessionState((current) => ({
                ...current,
                lastDismissedSignature: dismissedSignature,
                nextEligibleAt: Date.now() + PASSIVE_TEASER_DISMISS_MS,
              }));
            }}
            isDark={isDark}
            motionPreset={motionPreset}
          />
        ) : null}
      </AnimatePresence>

      <motion.div
        initial="idle"
        animate={shouldHighlightLauncher ? "highlighted" : "idle"}
        variants={motionPreset.attentionCtaVariants}
        transition={motionPreset.transitions.attention}
        className="fixed bottom-6 right-6 z-[95] rounded-full"
      >
        <motion.button
          type="button"
          onClick={openLuminaFromLauncher}
          initial="hidden"
          animate="visible"
          whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.02 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
          transition={motionPreset.transitions.soft}
          variants={motionPreset.launcherVariants}
          className={[
            "relative inline-flex items-center gap-3 rounded-full border px-4 py-3 shadow-[0_24px_48px_-24px_rgba(37,99,235,0.7)] transition hover:brightness-110",
            shouldHighlightLauncher
              ? isDark
                ? "border-cyan-200/30 bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white"
                : "border-cyan-100 bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white"
              : isDark
                ? "border-white/10 bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white"
                : "border-slate-200/80 bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white",
          ].join(" ")}
          aria-label="Abrir chat da Lumina"
        >
          {shouldHighlightLauncher ? (
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full bg-cyan-300/20 blur-xl"
              variants={motionPreset.attentionGlowVariants}
              initial="idle"
              animate="highlighted"
              transition={motionPreset.transitions.attention}
            />
          ) : null}

          {showPassiveLauncherSignal ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-[24px] items-center justify-center rounded-full border border-white/40 bg-rose-500 px-1.5 py-1 text-[11px] font-bold leading-none text-white shadow-[0_14px_28px_-18px_rgba(244,63,94,0.8)]">
              {passiveBadgeLabel}
            </span>
          ) : null}

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
            <div className="text-sm font-semibold">
              {shouldHighlightLauncher ? "Tenho algo para voce" : "Falar com a agente"}
            </div>
          </div>
        </motion.button>
      </motion.div>

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

                    {insightAction ? (
                      <OverlayControlButton
                        icon={runningInsight ? Loader2 : Lightbulb}
                        iconClassName={runningInsight ? "animate-spin" : ""}
                        label={runningInsight ? "Analisando..." : "Insight"}
                        onClick={() => {
                          void handleInsightTrigger();
                        }}
                        isDark={isDark}
                        active={isInsightSwitchOverlayOpen}
                        disabled={bootstrapping || sending || runningInsight}
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
                          onSelectAction={handleActionMenuSelection}
                          onClose={() => setActiveOverlay("")}
                          isDark={isDark}
                          isMobile={isMobile}
                          disabled={sending || bootstrapping}
                          motionPreset={motionPreset}
                        />
                      </div>
                    ) : null}

                    {isReplySelectorOpen && selectorReplyControl ? (
                      <div
                        key="lumina-reply-selector-overlay"
                        className={[
                          "absolute z-20",
                          isMobile
                            ? "inset-x-0 bottom-0"
                            : "inset-x-4 top-4 md:inset-x-5",
                        ].join(" ")}
                      >
                        <LuminaReplySelector
                          replyControls={selectorReplyControl}
                          onSelectOption={handleSelectReplyOption}
                          onClose={() => setActiveOverlay("")}
                          isDark={isDark}
                          isMobile={isMobile}
                          disabled={sending || bootstrapping}
                          motionPreset={motionPreset}
                        />
                      </div>
                    ) : null}

                    {isInsightSwitchOverlayOpen && insightSwitchReplyControl ? (
                      <div
                        key="lumina-insight-switch-overlay"
                        className={[
                          "absolute z-20",
                          isMobile
                            ? "inset-x-0 bottom-0"
                            : "inset-x-4 top-4 md:inset-x-5",
                        ].join(" ")}
                      >
                        <LuminaReplySelector
                          replyControls={insightSwitchReplyControl}
                          onSelectOption={handleSelectInsightSwitchOption}
                          onClose={() => setActiveOverlay("")}
                          isDark={isDark}
                          isMobile={isMobile}
                          disabled={sending || bootstrapping || runningInsight}
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
                      {shouldShowPassiveEntryBubble ? (
                        <MessageBubble
                          key={passiveEntryMessage?._id || "lumina-passive-entry"}
                          item={passiveEntryMessage}
                          isDark={isDark}
                          motionPreset={motionPreset}
                        />
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
                      {displayedMessages.length === 0 && automationInbox.length > 0 ? (
                        <LuminaAutomationInbox
                          key="lumina-automation-inbox"
                          items={automationInbox}
                          onRunAutomation={handleRunAutomation}
                          onDismiss={handleDismissAutomation}
                          isDark={isDark}
                          disabled={sending || bootstrapping}
                          motionPreset={motionPreset}
                        />
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
                      {chipReplies.length > 0 ? (
                        <motion.div
                          key="lumina-quick-replies"
                          variants={motionPreset.quickRepliesVariants.container}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          className="mb-3 flex max-h-[92px] flex-wrap gap-2 overflow-hidden"
                        >
                          {chipReplies.map((reply, index) => (
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
                                reply?.variant === "danger"
                                  ? isDark
                                    ? "border-rose-400/20 bg-rose-400/10 text-rose-50 hover:bg-rose-400/15"
                                    : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                  : isDark
                                    ? "border-white/10 bg-white/5 text-slate-100 hover:border-cyan-400/20 hover:bg-white/10"
                                    : "border-slate-200/80 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50",
                              ].join(" ")}
                            >
                              {reply?.label || reply?.value || "Acao rapida"}
                            </motion.button>
                          ))}
                        </motion.div>
                      ) : selectorReplyControl ? (
                        <motion.div
                          key="lumina-selector-trigger"
                          variants={motionPreset.quickRepliesVariants.container}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          className="mb-3 flex items-center gap-2"
                        >
                          <motion.button
                            type="button"
                            disabled={sending || bootstrapping}
                            onClick={() => toggleOverlay("reply-selector")}
                            whileHover="hover"
                            whileTap="tap"
                            variants={motionPreset.quickReplyVariants}
                            transition={motionPreset.transitions.chip}
                            className={[
                              "inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition disabled:opacity-60",
                              isReplySelectorOpen
                                ? isDark
                                  ? "border-cyan-400/30 bg-cyan-400/12 text-cyan-100"
                                  : "border-cyan-300 bg-cyan-50 text-cyan-800"
                                : isDark
                                  ? "border-white/10 bg-white/5 text-slate-100 hover:border-cyan-400/20 hover:bg-white/10"
                                  : "border-slate-200/80 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50",
                            ].join(" ")}
                          >
                            <LayoutGrid className="h-4 w-4" />
                            <span className="truncate">Selecionar opcao</span>
                            <span
                              className={[
                                "rounded-full px-2 py-0.5 text-[11px] font-bold",
                                isDark ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-600",
                              ].join(" ")}
                            >
                              {selectorReplyControl.options.length}
                            </span>
                          </motion.button>

                          <div
                            className={[
                              "min-w-0 text-xs leading-5",
                              isDark ? "text-slate-400" : "text-slate-500",
                            ].join(" ")}
                          >
                            {selectorReplyControl?.title || "Escolha uma opcao ou responda em texto."}
                          </div>
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
