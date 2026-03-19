import { useEffect, useMemo, useState } from "react";
import Button from "../components/appui/Button.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import { Input } from "../components/appui/Input.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import SettingsLayout from "../components/settings/SettingsLayout.jsx";
import UnsavedChangesBar from "../components/settings/UnsavedChangesBar.jsx";
import { useAuth } from "../app/AuthContext.jsx";

function getApiErrorMessage(error) {
  const code = String(error?.data?.code || error?.code || "")
    .trim()
    .toUpperCase();

  if (code === "INVALID_WHATSAPP_PHONE") {
    return "Informe um numero de WhatsApp valido com DDD. Exemplo: 11999998888.";
  }

  return error?.message || "Falha ao atualizar o WhatsApp do usuario.";
}

export default function SettingsAccount() {
  const { user, loadingMe, updateMyWhatsAppPhone } = useAuth();
  const [draftPhone, setDraftPhone] = useState("");
  const [savedPhone, setSavedPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  useEffect(() => {
    const currentPhone = String(user?.whatsappPhone || "").trim();
    setDraftPhone(currentPhone);
    setSavedPhone(currentPhone);
  }, [user?.whatsappPhone]);

  const dirty = useMemo(
    () => String(draftPhone || "").trim() !== String(savedPhone || "").trim(),
    [draftPhone, savedPhone],
  );

  const isConfigured = String(savedPhone || "").trim().length > 0;

  async function handleSave() {
    try {
      setSaving(true);
      setErr("");
      setOkMsg("");

      const data = await updateMyWhatsAppPhone({
        whatsappPhone: String(draftPhone || "").trim(),
      });

      const nextPhone = String(data?.user?.whatsappPhone || "").trim();
      setDraftPhone(nextPhone);
      setSavedPhone(nextPhone);
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
    if (!savedPhone && !draftPhone) return;

    try {
      setSaving(true);
      setErr("");
      setOkMsg("");

      const data = await updateMyWhatsAppPhone({ whatsappPhone: "" });
      const nextPhone = String(data?.user?.whatsappPhone || "").trim();
      setDraftPhone(nextPhone);
      setSavedPhone(nextPhone);
      setOkMsg("WhatsApp do usuario removido com sucesso.");
      setTimeout(() => setOkMsg(""), 3200);
    } catch (error) {
      setErr(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
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
        <Button onClick={handleSave} disabled={saving || !dirty}>
          {saving ? "Salvando..." : "Salvar alteracoes"}
        </Button>
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
                  {isConfigured
                    ? "WhatsApp configurado"
                    : "WhatsApp ainda nao configurado"}
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {isConfigured
                    ? "Seu numero ja pode ser usado para identificar voce no fluxo de comandos por WhatsApp."
                    : "Adicione seu numero com DDD para liberar os comandos por texto e audio no WhatsApp."}
                </div>
              </div>

              <span
                className={[
                  "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]",
                  isConfigured
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100"
                    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100",
                ].join(" ")}
              >
                {isConfigured ? "Ativo" : "Pendente"}
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="WhatsApp do usuario"
          subtitle="Voce pode informar, atualizar ou remover o numero a qualquer momento."
          right={
            <Button
              variant="ghost"
              className="text-red-600 dark:text-red-300"
              onClick={handleRemove}
              disabled={saving || (!savedPhone && !draftPhone)}
            >
              Remover numero
            </Button>
          }
        />
        <CardBody className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-900 dark:text-white">
              Numero de WhatsApp
            </label>
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={draftPhone}
              onChange={(event) => setDraftPhone(event.target.value)}
              placeholder="11 99999-8888"
              disabled={saving}
            />
            <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
              Aceita formatos brasileiros com DDD. Exemplo: 11999998888 ou +55
              11 99999-8888.
            </div>
          </div>

          <div className="rounded-2xl border border-sky-100 bg-sky-50/90 p-4 text-xs leading-6 text-slate-600 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-slate-200">
            A Luminor usa esse numero apenas para identificar o usuario no
            fluxo de comandos por WhatsApp. No MVP, nao existe verificacao por
            codigo SMS ou OTP.
          </div>
        </CardBody>
      </Card>

      <UnsavedChangesBar
        visible={dirty}
        saving={saving}
        onDiscard={() => {
          setDraftPhone(savedPhone);
          setErr("");
          setOkMsg("");
        }}
        onSave={handleSave}
        message="Voce tem alteracoes nao salvas no WhatsApp da sua conta."
        saveLabel="Salvar numero"
      />
    </SettingsLayout>
  );
}
