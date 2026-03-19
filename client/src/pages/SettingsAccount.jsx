import { useEffect, useMemo, useState } from "react";
import Badge from "../components/appui/Badge.jsx";
import Button from "../components/appui/Button.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import { Input } from "../components/appui/Input.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import SettingsLayout from "../components/settings/SettingsLayout.jsx";
import UnsavedChangesBar from "../components/settings/UnsavedChangesBar.jsx";
import { useAuth } from "../app/AuthContext.jsx";
import { canUseWhatsAppAccountPhone } from "../utils/planFeatures.js";

function getApiErrorMessage(error) {
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

function getStatusState({ planAllowed, isConfigured }) {
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
      note: "Seu numero ja pode ser usado para identificar voce no fluxo de comandos por WhatsApp.",
    };
  }

  return {
    tone: "DRAFT",
    label: "Pendente",
    title: "WhatsApp ainda nao configurado",
    note: "Adicione seu numero com DDD para liberar os comandos por texto e audio no WhatsApp.",
  };
}

export default function SettingsAccount() {
  const { user, workspace, loadingMe, updateMyWhatsAppPhone } = useAuth();
  const [draftPhone, setDraftPhone] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const persistedPhone = String(user?.whatsappPhone || "").trim();
  const hasPersistedPhone = persistedPhone.length > 0;
  const currentPlan = String(workspace?.plan || "start").trim().toLowerCase();
  const planAllowed = canUseWhatsAppAccountPhone(currentPlan);
  const status = useMemo(
    () => getStatusState({ planAllowed, isConfigured: hasPersistedPhone }),
    [planAllowed, hasPersistedPhone],
  );

  useEffect(() => {
    setDraftPhone(persistedPhone);
    setEditing(!persistedPhone);
  }, [persistedPhone]);

  const showEditor = planAllowed && (!hasPersistedPhone || editing);
  const dirty = useMemo(
    () => String(draftPhone || "").trim() !== persistedPhone,
    [draftPhone, persistedPhone],
  );

  async function handleSave() {
    if (!planAllowed) return;

    try {
      setSaving(true);
      setErr("");
      setOkMsg("");

      const data = await updateMyWhatsAppPhone({
        whatsappPhone: String(draftPhone || "").trim(),
      });

      const nextPhone = String(data?.user?.whatsappPhone || "").trim();
      setDraftPhone(nextPhone);
      setEditing(!nextPhone);
      setOkMsg(
        nextPhone
          ? "WhatsApp do usuario salvo com sucesso."
          : "WhatsApp do usuario removido com sucesso.",
      );
      setTimeout(() => setOkMsg(""), 3200);
    } catch (error) {
      setErr(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!planAllowed || !hasPersistedPhone) return;

    try {
      setSaving(true);
      setErr("");
      setOkMsg("");

      await updateMyWhatsAppPhone({ whatsappPhone: "" });
      setDraftPhone("");
      setEditing(true);
      setOkMsg("WhatsApp do usuario removido com sucesso.");
      setTimeout(() => setOkMsg(""), 3200);
    } catch (error) {
      setErr(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function handleStartEdit() {
    setDraftPhone(persistedPhone);
    setEditing(true);
    setErr("");
    setOkMsg("");
  }

  function handleDiscard() {
    setDraftPhone(persistedPhone);
    setEditing(!hasPersistedPhone);
    setErr("");
    setOkMsg("");
  }

  if (loadingMe) {
    return (
      <SettingsLayout
        activeTab="account"
        title="Conta"
        subtitle="Gerencie seus dados pessoais e o numero usado para liberar comandos por WhatsApp."
      >
        <Skeleton className="h-36 rounded-[28px]" />
        <Skeleton className="h-72 rounded-[28px]" />
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout
      activeTab="account"
      title="Conta"
      subtitle="Defina o numero que identifica voce nos comandos enviados pelo WhatsApp."
      actions={
        showEditor ? (
          <Button onClick={handleSave} disabled={saving || !dirty}>
            {saving ? "Salvando..." : "Salvar alteracoes"}
          </Button>
        ) : null
      }
    >
      {err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100">
          {err}
        </div>
      ) : null}

      {okMsg ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100">
          {okMsg}
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Status da ativacao"
          subtitle="Esse numero libera o reconhecimento do usuario quando ele envia texto ou audio para a Luminor no WhatsApp."
        />
        <CardBody className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  {status.title}
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {status.note}
                </div>
              </div>

              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="WhatsApp do usuario"
          subtitle={
            planAllowed
              ? "Voce pode informar, atualizar ou remover o numero a qualquer momento."
              : "O numero da conta fica visivel, mas a edicao depende de upgrade para Pro, Business ou Enterprise."
          }
        />
        <CardBody className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Numero cadastrado
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {hasPersistedPhone
                    ? "Este e o numero persistido hoje na sua conta."
                    : "Nenhum numero foi salvo ainda para identificar voce no agente do WhatsApp."}
                </div>
              </div>

              <Badge tone={hasPersistedPhone ? "PAID" : "DRAFT"}>
                {hasPersistedPhone ? "Salvo" : "Nao cadastrado"}
              </Badge>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-white/10 dark:bg-white/4 dark:text-white">
              {hasPersistedPhone ? persistedPhone : "Nenhum numero cadastrado"}
            </div>

            {planAllowed && hasPersistedPhone ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {!editing ? (
                  <Button type="button" variant="secondary" onClick={handleStartEdit}>
                    Editar numero
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" onClick={handleDiscard}>
                    Cancelar edicao
                  </Button>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-600 dark:text-red-300"
                  onClick={handleRemove}
                  disabled={saving}
                >
                  Remover numero
                </Button>
              </div>
            ) : null}
          </div>

          {showEditor || !planAllowed ? (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                Numero de WhatsApp
              </label>
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={showEditor ? draftPhone : persistedPhone}
                onChange={(event) => setDraftPhone(event.target.value)}
                placeholder="11 99999-8888"
                disabled={!planAllowed || saving}
              />
              <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                {planAllowed
                  ? "Aceita formatos brasileiros com DDD. Exemplo: 11999998888 ou +55 11 99999-8888."
                  : "Campo bloqueado no plano atual. Faca upgrade para Pro para editar esse numero."}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-sky-100 bg-sky-50/90 p-4 text-xs leading-6 text-slate-600 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-slate-200">
            A Luminor usa esse numero apenas para identificar o usuario no
            fluxo de comandos por WhatsApp. No MVP, nao existe verificacao por
            codigo SMS ou OTP.
          </div>
        </CardBody>
      </Card>

      <UnsavedChangesBar
        visible={showEditor && dirty}
        saving={saving}
        onDiscard={handleDiscard}
        onSave={handleSave}
        message="Voce tem alteracoes nao salvas no WhatsApp da sua conta."
        saveLabel="Salvar numero"
      />
    </SettingsLayout>
  );
}
