import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bot,
  ChevronDown,
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

function MessageBubble({ item, isDark }) {
  const isUser = item?.role === "user";

  return (
    <div className={["flex w-full", isUser ? "justify-end" : "justify-start"].join(" ")}>
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
    </div>
  );
}

function TypingBubble({ isDark }) {
  return (
    <div className="flex justify-start">
      <div
        className={[
          "rounded-[24px] border px-4 py-3",
          isDark
            ? "border-white/10 bg-[linear-gradient(180deg,rgba(19,31,54,0.96),rgba(12,20,38,0.94))] text-slate-100"
            : "border-slate-200/80 bg-white text-slate-800",
        ].join(" ")}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
          Lumina esta pensando...
        </div>
      </div>
    </div>
  );
}

function RecentSessionItem({
  session,
  isDark,
  selected,
  loading,
  onOpen,
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(session?._id)}
      disabled={loading}
      className={[
        "min-w-[132px] rounded-[18px] border px-3 py-2 text-left transition disabled:opacity-60",
        selected
          ? "border-cyan-400/40 bg-[linear-gradient(135deg,rgba(37,99,235,0.2),rgba(20,184,166,0.12))]"
          : isDark
            ? "border-white/10 bg-white/5 hover:border-cyan-400/20 hover:bg-white/10"
            : "border-slate-200/80 bg-white/85 hover:border-cyan-300 hover:bg-cyan-50/80",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
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
          "mt-2 text-[11px]",
          isDark ? "text-slate-400" : "text-slate-500",
        ].join(" ")}
      >
        {formatSessionTime(session?.updatedAt || session?.createdAt)}
      </div>
    </button>
  );
}

function LuminaActionMenu({
  actionMenu,
  selectedCategoryKey,
  onSelectCategory,
  expanded,
  onToggle,
  onSelectAction,
  isDark,
  disabled,
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
    <div
      className={[
        "mx-4 mt-4 rounded-[24px] border px-4 py-4 md:mx-5",
        isDark
          ? "border-white/10 bg-[linear-gradient(180deg,rgba(16,25,44,0.76),rgba(10,18,34,0.7))]"
          : "border-slate-200/80 bg-white/95",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={[
              "text-[10px] font-bold uppercase tracking-[0.2em]",
              isDark ? "text-slate-400" : "text-slate-500",
            ].join(" ")}
          >
            Acoes da Lumina
          </div>
          <div
            className={[
              "mt-1 text-sm font-semibold",
              isDark ? "text-white" : "text-slate-950",
            ].join(" ")}
          >
            Atalhos determinísticos para abrir fluxos sem depender do classificador.
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className={[
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
            isDark
              ? "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              : "border-slate-200/80 bg-white text-slate-600 hover:bg-slate-100",
          ].join(" ")}
        >
          {expanded ? "Ocultar" : "Mostrar"}
          <ChevronDown
            className={[
              "h-4 w-4 transition-transform",
              expanded ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {actionMenu.map((category) => {
          const isSelected = category?.categoryKey === activeCategory?.categoryKey;
          return (
            <button
              key={category?.categoryKey}
              type="button"
              onClick={() => onSelectCategory?.(category?.categoryKey || "")}
              className={[
                "shrink-0 rounded-full border px-3 py-2 text-sm font-semibold transition",
                isSelected
                  ? isDark
                    ? "border-cyan-400/40 bg-[linear-gradient(135deg,rgba(37,99,235,0.18),rgba(20,184,166,0.12))] text-cyan-100"
                    : "border-cyan-300 bg-cyan-50 text-cyan-800"
                  : isDark
                    ? "border-white/10 bg-white/5 text-slate-200 hover:border-cyan-400/20 hover:bg-white/10"
                    : "border-slate-200/80 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50",
              ].join(" ")}
            >
              {category?.categoryLabel || category?.categoryKey || "Categoria"}
            </button>
          );
        })}
      </div>

      {expanded ? (
        <div className="mt-3 grid gap-2">
          {activeActions.map((action) => (
            <button
              key={action?.actionKey}
              type="button"
              disabled={disabled}
              onClick={() =>
                onSelectAction?.(
                  action?.value || action?.label || "",
                  action?.actionKey || "",
                )
              }
              className={[
                "rounded-[20px] border px-4 py-3 text-left transition disabled:opacity-60",
                action?.destructive
                  ? isDark
                    ? "border-rose-400/20 bg-rose-400/10 text-rose-50 hover:border-rose-300/30 hover:bg-rose-400/15"
                    : "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100"
                  : isDark
                    ? "border-white/10 bg-white/5 text-slate-100 hover:border-cyan-400/20 hover:bg-white/10"
                    : "border-slate-200/80 bg-white text-slate-800 hover:border-cyan-300 hover:bg-cyan-50/80",
              ].join(" ")}
            >
              <div className="text-sm font-semibold">
                {action?.label || action?.value || "Acao"}
              </div>
              {action?.description ? (
                <div
                  className={[
                    "mt-1 text-xs leading-5",
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
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function LuminaChatWidget() {
  const { isDark } = useThemeToggle();
  const { isAuthenticated, workspace, perms } = useAuth();
  const [open, setOpen] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [sending, setSending] = useState(false);
  const [switchingSessionId, setSwitchingSessionId] = useState("");
  const [payload, setPayload] = useState(null);
  const [draft, setDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState("");
  const [menuExpanded, setMenuExpanded] = useState(true);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState("");
  const messagesRef = useRef(null);
  const bootstrapRequestIdRef = useRef(0);
  const menuSessionKeyRef = useRef("");

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
    if (!open) return;

    const sessionKey = String(
      currentSession?._id || activeSession?._id || payload?.agent?.name || "lumina",
    );
    const shouldExpandByDefault = displayedMessages.length === 0;

    if (menuSessionKeyRef.current !== sessionKey) {
      menuSessionKeyRef.current = sessionKey;
      setMenuExpanded(shouldExpandByDefault);
      return;
    }

    if (shouldExpandByDefault) {
      setMenuExpanded(true);
    }
  }, [
    open,
    currentSession?._id,
    activeSession?._id,
    payload?.agent?.name,
    displayedMessages.length,
  ]);

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
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

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
      behavior: "smooth",
    });
  }, [open, displayedMessages.length, sending, currentSession?._id]);

  useEffect(() => {
    if (!canUseLumina) {
      setOpen(false);
      setPayload(null);
      setErrorMessage("");
      setDraft("");
      setPendingUserMessage("");
      setMenuExpanded(true);
      setSelectedCategoryKey("");
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
    try {
      const response = await startNewLuminaSession();
      setPayload(response);
      setDraft("");
      setMenuExpanded(true);
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
    setMenuExpanded(false);

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

  if (!canUseLumina || typeof document === "undefined") {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          "fixed bottom-6 right-6 z-[95] inline-flex items-center gap-3 rounded-full border px-4 py-3 shadow-[0_24px_48px_-24px_rgba(37,99,235,0.7)] transition hover:brightness-110",
          isDark
            ? "border-white/10 bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white"
            : "border-slate-200/80 bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white",
        ].join(" ")}
        aria-label="Abrir chat da Lumina"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
          <Bot className="h-5 w-5" />
        </div>
        <div className="hidden text-left sm:block">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/80">
            Lumina
          </div>
          <div className="text-sm font-semibold">Falar com a agente</div>
        </div>
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[130]"
              role="dialog"
              aria-modal="true"
            >
              <div
                className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
                onClick={() => setOpen(false)}
              />

              <div
                className={[
                  "absolute inset-x-0 bottom-0 top-0 flex max-h-screen flex-col border shadow-[0_28px_80px_-36px_rgba(15,23,42,0.7)] md:inset-y-4 md:right-4 md:left-auto md:w-[460px] md:rounded-[30px]",
                  isDark
                    ? "border-white/10 bg-[linear-gradient(180deg,rgba(8,15,28,0.98),rgba(4,10,20,0.98))] text-white"
                    : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,251,0.98))] text-slate-900",
                ].join(" ")}
              >
                <div
                  className={[
                    "border-b px-4 py-4 md:px-5",
                    isDark ? "border-white/10" : "border-slate-200/80",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white shadow-[0_18px_36px_-24px_rgba(37,99,235,0.7)]">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div>
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
                        <div
                          className={[
                            "mt-1 flex items-center gap-2 text-sm",
                            isDark ? "text-slate-300" : "text-slate-600",
                          ].join(" ")}
                        >
                          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                          {payload?.agent?.subtitle || "Agente operacional da sua carteira"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleNewConversation}
                        disabled={sending || bootstrapping}
                        className="hidden md:inline-flex"
                      >
                        {sending && !pendingUserMessage ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Nova conversa
                      </Button>

                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className={[
                          "inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition",
                          isDark
                            ? "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                            : "border-slate-200/80 bg-white/85 text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                        ].join(" ")}
                        aria-label="Fechar chat da Lumina"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 md:hidden">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleNewConversation}
                      disabled={sending || bootstrapping}
                      className="w-full"
                    >
                      {sending && !pendingUserMessage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Nova conversa
                    </Button>
                  </div>

                  {payload?.recentSessions?.length ? (
                    <div className="mt-4">
                      <div
                        className={[
                          "mb-2 text-[10px] font-bold uppercase tracking-[0.2em]",
                          isDark ? "text-slate-400" : "text-slate-500",
                        ].join(" ")}
                      >
                        Recentes
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {payload.recentSessions.map((session) => (
                          <RecentSessionItem
                            key={session?._id}
                            session={session}
                            isDark={isDark}
                            selected={String(session?._id || "") === String(currentSession?._id || "")}
                            loading={switchingSessionId === String(session?._id || "")}
                            onOpen={handleOpenSession}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex min-h-0 flex-1 flex-col">
                  {errorMessage ? (
                    <div
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
                    </div>
                  ) : null}

                  {payload ? (
                    <LuminaActionMenu
                      actionMenu={actionMenu}
                      selectedCategoryKey={selectedCategoryKey}
                      onSelectCategory={setSelectedCategoryKey}
                      expanded={menuExpanded}
                      onToggle={() => setMenuExpanded((currentValue) => !currentValue)}
                      onSelectAction={handleSendMessage}
                      isDark={isDark}
                      disabled={sending || bootstrapping}
                    />
                  ) : null}

                  <div
                    ref={messagesRef}
                    className="flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-5"
                  >
                    {!payload && bootstrapping ? (
                      <div
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
                      </div>
                    ) : null}

                    {payload?.welcomeMessage && displayedMessages.length === 0 ? (
                      <div
                        className={[
                          "rounded-[28px] border px-5 py-5",
                          isDark
                            ? "border-white/10 bg-[linear-gradient(180deg,rgba(16,25,44,0.82),rgba(10,18,34,0.76))]"
                            : "border-slate-200/80 bg-white",
                        ].join(" ")}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white">
                            <MessageCircleMore className="h-5 w-5" />
                          </div>
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
                              Experimente pedir uma proposta, consultar agenda, cobrar um cliente ou
                              atualizar um cadastro.
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {displayedMessages.map((item) => (
                      <MessageBubble key={item?._id || item?.createdAt} item={item} isDark={isDark} />
                    ))}

                    {sending ? <TypingBubble isDark={isDark} /> : null}
                  </div>

                  <div
                    className={[
                      "border-t px-4 py-4 md:px-5",
                      isDark ? "border-white/10" : "border-slate-200/80",
                    ].join(" ")}
                  >
                    {quickReplies.length > 0 ? (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {quickReplies.map((reply, index) => (
                          <button
                            key={`${reply?.value || reply?.label || "reply"}-${index}`}
                            type="button"
                            disabled={sending || bootstrapping}
                            onClick={() => handleSendMessage(reply?.value || reply?.label || "")}
                            className={[
                              "rounded-full border px-3 py-2 text-sm font-semibold transition disabled:opacity-60",
                              isDark
                                ? "border-white/10 bg-white/5 text-slate-100 hover:border-cyan-400/20 hover:bg-white/10"
                                : "border-slate-200/80 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50",
                            ].join(" ")}
                          >
                            {reply?.label || reply?.value || "Acao rapida"}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <div className="flex items-end gap-3">
                      <Textarea
                        rows={2}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={handleComposerKeyDown}
                        disabled={sending || bootstrapping}
                        placeholder={composerPlaceholder}
                        className="min-h-[88px] resize-none"
                      />

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
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <SendHorizonal className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    <div
                      className={[
                        "mt-3 text-xs leading-5",
                        isDark ? "text-slate-400" : "text-slate-500",
                      ].join(" ")}
                    >
                      {isHistoricalView
                        ? "Se voce enviar um novo comando agora, a Lumina continua pela conversa ativa sem reset brusco."
                        : "A Lumina responde com tom mais humano aqui no site, mas continua pedindo confirmacoes explicitas antes de executar acoes."}
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
