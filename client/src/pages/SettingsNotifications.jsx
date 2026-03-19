import { useCallback, useEffect, useMemo, useState } from "react";
import Badge from "../components/appui/Badge.jsx";
import Button from "../components/appui/Button.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import SettingsLayout from "../components/settings/SettingsLayout.jsx";
import UnsavedChangesBar from "../components/settings/UnsavedChangesBar.jsx";
import {
  getSettings,
  updateNotificationSettings,
} from "../app/settingsApi.js";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  isEmailNotificationEnabled,
  isWhatsAppMasterEnabled,
  mergeNotificationSettings,
} from "../utils/notificationSettings.js";
import { getPlanFeatureMatrix } from "../utils/planFeatures.js";

function buildEnvironmentNote(capability, fallback) {
  if (capability?.available === true) return "";
  if (Array.isArray(capability?.reasons) && capability.reasons.length > 0) {
    return capability.reasons.join(" • ");
  }
  return String(capability?.reason || fallback || "").trim();
}

function getEmailEventState(context, key) {
  const emailCapability = context?.capabilities?.environment?.email || {};

  if (isEmailNotificationEnabled(context, key)) {
    return { tone: "PAID", label: "Ativo agora", note: "" };
  }

  if (emailCapability.available !== true) {
    return {
      tone: "EXPIRED",
      label: "Aguardando ambiente",
      note: buildEnvironmentNote(
        emailCapability,
        "Configure o canal de e-mail para ativar este evento.",
      ),
    };
  }

  return {
    tone: "DRAFT",
    label: "Desativado no workspace",
    note: "Este gatilho fica salvo, mas não dispara enquanto estiver desligado.",
  };
}

function getWhatsAppMasterState(context) {
  const whatsappCapability = context?.capabilities?.environment?.whatsapp || {};

  if (isWhatsAppMasterEnabled(context)) {
    return { tone: "PAID", label: "Ativo agora", note: "" };
  }

  if (whatsappCapability.available !== true) {
    return {
      tone: "EXPIRED",
      label: "Aguardando ambiente",
      note: buildEnvironmentNote(
        whatsappCapability,
        "Configure o gateway de WhatsApp para ativar este canal.",
      ),
    };
  }

  return {
    tone: "DRAFT",
    label: "Desativado no workspace",
    note: "A chave mestre do workspace bloqueia todos os envios por WhatsApp.",
  };
}

function getWhatsAppFeatureState(context, featureKey, settingEnabled, planNote) {
  const whatsappCapability = context?.capabilities?.environment?.whatsapp || {};
  const currentPlan = context?.capabilities?.plan?.value || "start";
  const planFeatures = {
    ...getPlanFeatureMatrix(currentPlan),
    ...(context?.capabilities?.plan?.features || {}),
  };
  const featureAvailability =
    context?.capabilities?.availability?.[featureKey] || {};
  const masterEnabled = context?.settings?.whatsapp?.masterEnabled === true;
  const planAllowed =
    featureAvailability?.planAllowed === true || planFeatures?.[featureKey] === true;

  if (
    whatsappCapability.available === true &&
    planAllowed &&
    masterEnabled &&
    settingEnabled
  ) {
    return { tone: "PAID", label: "Ativo agora", note: "" };
  }

  if (whatsappCapability.available !== true) {
    return {
      tone: "EXPIRED",
      label: "Aguardando ambiente",
      note: buildEnvironmentNote(
        whatsappCapability,
        "Configure o gateway de WhatsApp para ativar este canal.",
      ),
    };
  }

  if (!planAllowed) {
    return {
      tone: "ACCEPTED",
      label: "Bloqueado pelo plano",
      note: planNote,
    };
  }

  if (!masterEnabled) {
    return {
      tone: "DRAFT",
      label: "Bloqueado no workspace",
      note: "Ative a chave mestre de WhatsApp do workspace para liberar este recurso.",
    };
  }

  if (!settingEnabled) {
    return {
      tone: "DRAFT",
      label: "Desativado no workspace",
      note: "A preferência fica salva para quando você reativar este envio.",
    };
  }

  return {
    tone: "DRAFT",
    label: "Desativado no workspace",
    note: "",
  };
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  status,
  children = null,
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-950 dark:text-white">
            {label}
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {description}
          </div>
          {status?.note ? (
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {status.note}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Badge tone={status?.tone || "DRAFT"}>
            {status?.label || "Configurável"}
          </Badge>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={checked}
              onChange={(e) => onChange(e.target.checked)}
            />
            <div className="h-6 w-11 rounded-full bg-zinc-200 ring-1 ring-zinc-300 transition peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 peer-checked:bg-emerald-600 dark:bg-white/10 dark:ring-white/10">
              <div className="h-5 w-5 translate-x-0.5 translate-y-0.5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
            </div>
          </label>
        </div>
      </div>

      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

function ChannelStatusCard({ title, subtitle, capability, children }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-950 dark:text-white">
            {title}
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {subtitle}
          </div>
        </div>
        <Badge tone={capability?.available ? "PAID" : "EXPIRED"}>
          {capability?.available ? "Disponível" : "Indisponível"}
        </Badge>
      </div>

      {!capability?.available ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
          {buildEnvironmentNote(capability, "Canal ainda não configurado.")}
        </div>
      ) : null}

      {children ? <div className="mt-4 space-y-2">{children}</div> : null}
    </div>
  );
}

function formatPlanLabel(value) {
  const plan = String(value || "start").trim().toLowerCase();
  if (plan === "enterprise") return "Enterprise";
  if (plan === "business") return "Business";
  if (plan === "pro") return "Pro";
  return "Start";
}

export default function SettingsNotifications() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [savedDoc, setSavedDoc] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const [draft, setDraft] = useState(
    mergeNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS, {}),
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");
      const data = await getSettings();
      const nextNotifications = mergeNotificationSettings(
        DEFAULT_NOTIFICATION_SETTINGS,
        data?.settings?.notifications || {},
      );

      setSavedDoc(data?.settings || null);
      setCapabilities(data?.capabilities?.notifications || null);
      setDraft(nextNotifications);
    } catch (e) {
      setErr(e?.message || "Falha ao carregar as notificações do workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const savedNotifications = useMemo(
    () =>
      mergeNotificationSettings(
        DEFAULT_NOTIFICATION_SETTINGS,
        savedDoc?.notifications || {},
      ),
    [savedDoc],
  );

  const dirty = useMemo(
    () => JSON.stringify(savedNotifications) !== JSON.stringify(draft),
    [savedNotifications, draft],
  );

  const context = useMemo(
    () => ({
      settings: draft,
      capabilities: capabilities || {},
    }),
    [draft, capabilities],
  );

  const emailCapability = capabilities?.environment?.email || {};
  const whatsappCapability = capabilities?.environment?.whatsapp || {};
  const currentPlan = capabilities?.plan?.value || "start";

  const statusStates = useMemo(
    () => ({
      emailProof: getEmailEventState(context, "sellerProofSubmitted"),
      emailPixPaid: getEmailEventState(context, "sellerPixPaid"),
      emailPlatformConfirmed: getEmailEventState(
        context,
        "sellerPlatformConfirmed",
      ),
      emailBookingChanges: getEmailEventState(context, "bookingChanges"),
      whatsappMaster: getWhatsAppMasterState(context),
      whatsappPaymentStatus: getWhatsAppFeatureState(
        context,
        "whatsappPaymentStatus",
        context?.settings?.whatsapp?.paymentStatusUpdatesEnabled === true,
        "Esse fluxo fica disponível a partir do plano Pro.",
      ),
      whatsappOfferCancelled: getWhatsAppFeatureState(
        context,
        "whatsappOfferCancelled",
        context?.settings?.whatsapp?.offerCancelledEnabled === true,
        "Notificacoes de cancelamento por WhatsApp ficam disponiveis a partir do plano Pro.",
      ),
      whatsappBookingReminders: getWhatsAppFeatureState(
        context,
        "whatsappBookingReminders",
        context?.settings?.whatsapp?.bookingReminders?.enabled === true,
        "Lembretes de agendamento por WhatsApp ficam disponíveis a partir do plano Pro.",
      ),
      whatsappBookingChanges: getWhatsAppFeatureState(
        context,
        "whatsappBookingChanges",
        context?.settings?.whatsapp?.bookingChanges?.enabled === true,
        "Alterações de agenda por WhatsApp ficam disponíveis a partir do plano Pro.",
      ),
      whatsappRecurringAutoSend: getWhatsAppFeatureState(
        context,
        "whatsappRecurringAutoSend",
        context?.settings?.whatsapp?.recurringAutoSendDefault === true,
        "O autoenvio de recorrência fica disponível a partir do plano Pro.",
      ),
      whatsappPaymentReminders: getWhatsAppFeatureState(
        context,
        "whatsappPaymentReminders",
        context?.settings?.whatsapp?.paymentReminders?.enabled === true,
        "Lembretes de pagamento por WhatsApp exigem plano Business ou Enterprise.",
      ),
    }),
    [context],
  );

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setErr("");
      setOkMsg("");

      const data = await updateNotificationSettings(draft);
      const nextNotifications = mergeNotificationSettings(
        DEFAULT_NOTIFICATION_SETTINGS,
        data?.settings?.notifications || draft,
      );

      setSavedDoc((prev) => ({
        ...(prev || {}),
        ...(data?.settings || {}),
        notifications: nextNotifications,
      }));
      setCapabilities(
        data?.capabilities?.notifications || capabilities || null,
      );
      setDraft(nextNotifications);
      setOkMsg("Preferências de notificações salvas com sucesso.");
      setTimeout(() => setOkMsg(""), 3200);
    } catch (e) {
      setErr(e?.message || "Falha ao salvar as notificações do workspace.");
    } finally {
      setSaving(false);
    }
  }, [capabilities, draft]);

  if (loading) {
    return (
      <SettingsLayout
        activeTab="notifications"
        title="Notificações"
        subtitle="Centralize canais, preferências do workspace e limites do plano."
      >
        <Skeleton className="h-36 rounded-[28px]" />
        <Skeleton className="h-96 rounded-[28px]" />
        <Skeleton className="h-72 rounded-[28px]" />
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout
      activeTab="notifications"
      title="Notificações"
      subtitle="Configure o que o workspace pode disparar por e-mail e WhatsApp, sem perder de vista as travas de ambiente e plano."
      actions={
        <Button onClick={handleSave} disabled={saving || !dirty}>
          {saving ? "Salvando..." : "Salvar alterações"}
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
          title="Status do ambiente"
          subtitle="Mostra se os canais estão configurados no ambiente e o motivo quando algo ainda está indisponível."
        />
        <CardBody className="grid gap-4 lg:grid-cols-2">
          <ChannelStatusCard
            title="E-mail do workspace"
            subtitle="Usado para avisos do vendedor e para comunicações de alteração de agenda."
            capability={emailCapability}
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Eventos ativos agora: comprovante enviado, pagamento Pix confirmado, confirmação no painel e alteração de agenda.
            </div>
          </ChannelStatusCard>

          <ChannelStatusCard
            title="WhatsApp do workspace"
            subtitle="Usado para status de pagamento, autoenvio de recorrência, lembretes e alteração de agenda."
            capability={whatsappCapability}
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">
              O envio real sempre respeita ambiente, plano, chave mestre do workspace e a flag específica da proposta ou recorrência.
            </div>
          </ChannelStatusCard>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Preferências do workspace"
          subtitle="Essas preferências funcionam como chave mestre do workspace e alimentam os defaults das novas propostas e recorrências."
        />
        <CardBody className="space-y-6">
          <div className="space-y-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              E-mail
            </div>

            <ToggleRow
              label="Comprovante enviado ao vendedor"
              description="Notifica o vendedor quando o cliente envia um comprovante pela proposta pública."
              checked={draft.email.sellerProofSubmitted}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  email: { ...prev.email, sellerProofSubmitted: value },
                }))
              }
              status={statusStates.emailProof}
            />

            <ToggleRow
              label="Pagamento Pix confirmado"
              description="Notifica o vendedor quando o pagamento é confirmado após análise do comprovante."
              checked={draft.email.sellerPixPaid}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  email: { ...prev.email, sellerPixPaid: value },
                }))
              }
              status={statusStates.emailPixPaid}
            />

            <ToggleRow
              label="Pagamento confirmado no painel"
              description="Envia o aviso complementar ao vendedor quando a confirmação é concluída no backoffice."
              checked={draft.email.sellerPlatformConfirmed}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  email: { ...prev.email, sellerPlatformConfirmed: value },
                }))
              }
              status={statusStates.emailPlatformConfirmed}
            />

            <ToggleRow
              label="Alterações de agenda por e-mail"
              description="Controla os e-mails enviados ao cliente e ao workspace quando um agendamento é reagendado ou cancelado pelo link público."
              checked={draft.email.bookingChanges.enabled}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  email: {
                    ...prev.email,
                    bookingChanges: {
                      ...prev.email.bookingChanges,
                      enabled: value,
                    },
                  },
                }))
              }
              status={statusStates.emailBookingChanges}
            />
          </div>

          <div className="space-y-4 border-t border-slate-200/80 pt-6 dark:border-white/10">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              WhatsApp
            </div>

            <ToggleRow
              label="Chave mestre do WhatsApp"
              description="Bloqueia ou libera todos os envios do workspace por WhatsApp, independentemente da proposta."
              checked={draft.whatsapp.masterEnabled}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  whatsapp: { ...prev.whatsapp, masterEnabled: value },
                }))
              }
              status={statusStates.whatsappMaster}
            />

            <ToggleRow
              label="Confirmações e status de pagamento"
              description="Controla confirmação de pagamento ao cliente e recusa de comprovante no fluxo de cobrança."
              checked={draft.whatsapp.paymentStatusUpdatesEnabled}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  whatsapp: {
                    ...prev.whatsapp,
                    paymentStatusUpdatesEnabled: value,
                  },
                }))
              }
              status={statusStates.whatsappPaymentStatus}
            />

            <ToggleRow
              label="Proposta cancelada"
              description="Avisa o cliente por WhatsApp quando uma proposta for cancelada no backoffice."
              checked={draft.whatsapp.offerCancelledEnabled}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  whatsapp: {
                    ...prev.whatsapp,
                    offerCancelledEnabled: value,
                  },
                }))
              }
              status={statusStates.whatsappOfferCancelled}
            />

            <ToggleRow
              label="Autoenvio padrão de recorrência"
              description="Define o padrão de novas recorrências para tentar enviar a cobrança automaticamente ao cliente."
              checked={draft.whatsapp.recurringAutoSendDefault}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  whatsapp: {
                    ...prev.whatsapp,
                    recurringAutoSendDefault: value,
                  },
                }))
              }
              status={statusStates.whatsappRecurringAutoSend}
            />

            <ToggleRow
              label="Lembretes de agendamento"
              description="Dispara automaticamente um lembrete 24h antes e outro 2h antes de cada atendimento confirmado."
              checked={draft.whatsapp.bookingReminders.enabled}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  whatsapp: {
                    ...prev.whatsapp,
                    bookingReminders: {
                      ...prev.whatsapp.bookingReminders,
                      enabled: value,
                    },
                  },
                }))
              }
              status={statusStates.whatsappBookingReminders}
            />

            <ToggleRow
              label="Alterações de agenda por WhatsApp"
              description="Controla o aviso por WhatsApp ao cliente quando um agendamento é reagendado ou cancelado pelo link público."
              checked={draft.whatsapp.bookingChanges.enabled}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  whatsapp: {
                    ...prev.whatsapp,
                    bookingChanges: {
                      ...prev.whatsapp.bookingChanges,
                      enabled: value,
                    },
                  },
                }))
              }
              status={statusStates.whatsappBookingChanges}
            />

            <ToggleRow
              label="Lembretes de pagamento"
              description="Liga os lembretes manuais e os defaults automáticos para novas propostas."
              checked={draft.whatsapp.paymentReminders.enabled}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  whatsapp: {
                    ...prev.whatsapp,
                    paymentReminders: {
                      ...prev.whatsapp.paymentReminders,
                      enabled: value,
                    },
                  },
                }))
              }
              status={statusStates.whatsappPaymentReminders}
            >
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  {
                    key: "enabled24h",
                    label: "24h sem pagamento",
                    description: "Default para lembrar o cliente após 24 horas.",
                  },
                  {
                    key: "enabled3d",
                    label: "3 dias após envio",
                    description: "Default para novas propostas com lembrete após 3 dias.",
                  },
                  {
                    key: "enabledDueDate",
                    label: "No vencimento",
                    description: "Default para disparar no dia previsto do pagamento.",
                  },
                  {
                    key: "enabledAfterDueDate",
                    label: "Após vencimento",
                    description: "Default para reforçar após a data de vencimento.",
                  },
                ].map((item) => {
                  const checked =
                    draft.whatsapp.paymentReminders.defaults[item.key] === true;
                  const state = getWhatsAppFeatureState(
                    context,
                    "whatsappPaymentReminders",
                    draft.whatsapp.paymentReminders.enabled === true && checked,
                    "Lembretes de pagamento por WhatsApp exigem plano Business ou Enterprise.",
                  );

                  return (
                    <div
                      key={item.key}
                      className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-950 dark:text-white">
                            {item.label}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {item.description}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                          checked={checked}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              whatsapp: {
                                ...prev.whatsapp,
                                paymentReminders: {
                                  ...prev.whatsapp.paymentReminders,
                                  defaults: {
                                    ...prev.whatsapp.paymentReminders.defaults,
                                    [item.key]: e.target.checked,
                                  },
                                },
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ToggleRow>
          </div>

          <div className="space-y-3 border-t border-slate-200/80 pt-6 dark:border-white/10">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Notificações do sistema
            </div>

            {[
              "Código de confirmação de cadastro e reenvio de código",
              "Código de redefinição de senha",
            ].map((item) => (
              <div
                key={item}
                className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/4 md:flex-row md:items-center md:justify-between"
              >
                <div className="text-sm text-slate-700 dark:text-slate-300">
                  {item}
                </div>
                <Badge tone="DRAFT">Gerenciado pelo sistema</Badge>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Recursos por plano e roadmap"
          subtitle="A matriz abaixo é a fonte oficial de notificações no v1."
        />
        <CardBody className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-4">
            {[
              {
                key: "start",
                lines: [
                  "Sem envios por WhatsApp.",
                  "E-mails do workspace continuam configuráveis.",
                ],
              },
              {
                key: "pro",
                lines: [
                  "Confirmações e status por WhatsApp.",
                  "Lembretes de agendamento para clientes.",
                  "Alterações de agenda por WhatsApp.",
                  "Autoenvio padrão de recorrência.",
                ],
              },
              {
                key: "business",
                lines: [
                  "Tudo do Pro.",
                  "Lembretes manuais e automáticos de pagamento por WhatsApp.",
                ],
              },
              {
                key: "enterprise",
                lines: [
                  "Mesma matriz de notificações do Business.",
                  "Mantém lembretes e automações liberados.",
                ],
              },
            ].map((plan) => {
              const active = currentPlan === plan.key;
              return (
                <div
                  key={plan.key}
                  className={[
                    "rounded-2xl border p-4",
                    active
                      ? "border-cyan-200 bg-cyan-50/80 shadow-[0_18px_42px_-28px_rgba(6,182,212,0.35)] dark:border-cyan-400/20 dark:bg-cyan-400/10"
                      : "border-slate-200/80 bg-white/80 dark:border-white/10 dark:bg-white/5",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-950 dark:text-white">
                      {formatPlanLabel(plan.key)}
                    </div>
                    {active ? <Badge tone="PAID">Plano atual</Badge> : null}
                  </div>
                  <div className="mt-3 space-y-2">
                    {plan.lines.map((line) => (
                      <div
                        key={line}
                        className="text-xs leading-5 text-slate-500 dark:text-slate-400"
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Roadmap visível no v1
                </div>
                <Badge tone="ACCEPTED">Roadmap</Badge>
              </div>
              <div className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                E-mail após confirmação de cadastro.
              </div>
              <div className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Este gatilho aparece aqui para alinhamento do produto, mas ainda não entra no v1 e não é salvo como preferência do workspace.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Precedência oficial
                </div>
                <Badge tone="PUBLIC">Regra única</Badge>
              </div>
              <div className="mt-3 space-y-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                <div>1. Ambiente bloqueado vence tudo.</div>
                <div>2. Plano bloqueado vence as regras abaixo dele.</div>
                <div>3. A configuração global do workspace funciona como chave mestre.</div>
                <div>4. Flags da proposta ou recorrência continuam como override fino do item.</div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
      <UnsavedChangesBar
        visible={dirty}
        saving={saving}
        onDiscard={load}
        onSave={handleSave}
      />
    </SettingsLayout>
  );
}
