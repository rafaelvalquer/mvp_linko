import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../app/AuthContext.jsx";
import {
  canUseWhatsAppAccountPhone,
  canUseWhatsAppAiOfferCreation,
} from "../../utils/planFeatures.js";

export function getMyWhatsAppApiErrorMessage(error) {
  const code = String(error?.data?.code || error?.code || "")
    .trim()
    .toUpperCase();

  if (code === "INVALID_WHATSAPP_PHONE") {
    return "Informe um numero de WhatsApp valido com DDD. Exemplo: 11999998888.";
  }

  if (code === "WHATSAPP_ACCOUNT_PHONE_PLAN_BLOCKED") {
    return "Seu plano atual nao libera o WhatsApp da conta. Faca upgrade para Pro, Business ou Enterprise para editar esse numero.";
  }

  return error?.message || "Falha ao atualizar o WhatsApp do usuario.";
}

export function getMyWhatsAppStatusState({ planAllowed, isConfigured }) {
  if (!planAllowed) {
    return {
      tone: "ACCEPTED",
      label: "Bloqueado pelo plano",
      title: "WhatsApp bloqueado no plano atual",
      note: "O numero da conta fica disponivel a partir do plano Pro.",
    };
  }

  if (isConfigured) {
    return {
      tone: "PAID",
      label: "Ativo",
      title: "WhatsApp configurado",
      note: "Seu numero ja pode ser usado para identificar voce no fluxo de comandos por WhatsApp e para receber avisos da sua carteira.",
    };
  }

  return {
    tone: "DRAFT",
    label: "Pendente",
    title: "WhatsApp ainda nao configurado",
    note: "Adicione seu numero com DDD para liberar os comandos por texto e audio e receber avisos da sua carteira.",
  };
}

export function useMyWhatsAppConfig() {
  const { user, workspace, updateMyWhatsAppPhone } = useAuth();
  const [draftPhone, setDraftPhone] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const okTimerRef = useRef(null);

  const persistedPhone = String(user?.whatsappPhone || "").trim();
  const hasPersistedPhone = persistedPhone.length > 0;
  const currentPlan = String(workspace?.plan || "start").trim().toLowerCase();
  const planAllowed = canUseWhatsAppAccountPhone(currentPlan);
  const agentPlanAllowed = canUseWhatsAppAiOfferCreation(currentPlan);
  const status = useMemo(
    () =>
      getMyWhatsAppStatusState({
        planAllowed,
        isConfigured: hasPersistedPhone,
      }),
    [planAllowed, hasPersistedPhone],
  );

  useEffect(() => {
    setDraftPhone(persistedPhone);
    setEditing(!persistedPhone);
  }, [persistedPhone]);

  useEffect(() => {
    return () => {
      if (okTimerRef.current) {
        window.clearTimeout(okTimerRef.current);
      }
    };
  }, []);

  const showEditor = planAllowed && (!hasPersistedPhone || editing);
  const dirty = useMemo(
    () => String(draftPhone || "").trim() !== persistedPhone,
    [draftPhone, persistedPhone],
  );

  function pushOkMessage(message) {
    if (okTimerRef.current) {
      window.clearTimeout(okTimerRef.current);
    }
    setOkMsg(message);
    okTimerRef.current = window.setTimeout(() => setOkMsg(""), 3200);
  }

  function clearFeedback() {
    setErr("");
    setOkMsg("");
  }

  function handleStartEdit() {
    setDraftPhone(persistedPhone);
    setEditing(true);
    clearFeedback();
  }

  function handleDiscard() {
    setDraftPhone(persistedPhone);
    setEditing(!hasPersistedPhone);
    clearFeedback();
  }

  async function handleSave() {
    if (!planAllowed) return null;

    try {
      setSaving(true);
      clearFeedback();

      const data = await updateMyWhatsAppPhone({
        whatsappPhone: String(draftPhone || "").trim(),
      });

      const nextPhone = String(data?.user?.whatsappPhone || "").trim();
      setDraftPhone(nextPhone);
      setEditing(!nextPhone);
      pushOkMessage(
        nextPhone
          ? "WhatsApp do usuario salvo com sucesso."
          : "WhatsApp do usuario removido com sucesso.",
      );
      return data;
    } catch (error) {
      setErr(getMyWhatsAppApiErrorMessage(error));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!planAllowed || !hasPersistedPhone) return null;

    try {
      setSaving(true);
      clearFeedback();

      const data = await updateMyWhatsAppPhone({ whatsappPhone: "" });
      setDraftPhone("");
      setEditing(true);
      pushOkMessage("WhatsApp do usuario removido com sucesso.");
      return data;
    } catch (error) {
      setErr(getMyWhatsAppApiErrorMessage(error));
      return null;
    } finally {
      setSaving(false);
    }
  }

  return {
    user,
    workspace,
    draftPhone,
    setDraftPhone,
    editing,
    saving,
    err,
    okMsg,
    persistedPhone,
    hasPersistedPhone,
    currentPlan,
    planAllowed,
    agentPlanAllowed,
    status,
    showEditor,
    dirty,
    handleSave,
    handleRemove,
    handleStartEdit,
    handleDiscard,
    clearFeedback,
  };
}
