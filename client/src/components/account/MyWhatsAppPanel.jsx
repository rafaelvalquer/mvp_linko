import Badge from "../appui/Badge.jsx";
import Button from "../appui/Button.jsx";
import Card, { CardBody, CardHeader } from "../appui/Card.jsx";
import { Input } from "../appui/Input.jsx";
import { useMyWhatsAppConfig } from "./useMyWhatsAppConfig.js";

function InlineAlert({ kind = "info", children }) {
  const toneClass =
    kind === "error"
      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100"
      : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100";

  return (
    <div className={`rounded-2xl border p-4 text-sm ${toneClass}`}>
      {children}
    </div>
  );
}

function WhatsAppHighlights({ compact = false }) {
  return (
    <div
      className={[
        "rounded-2xl border border-cyan-200/70 bg-cyan-50/90 text-xs leading-6 text-slate-600 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-slate-200",
        compact ? "p-3.5" : "p-4",
      ].join(" ")}
    >
      <div className="text-sm font-semibold text-slate-950 dark:text-white">
        Este numero e pessoal
      </div>
      <ul className={`mt-2 list-disc pl-4 ${compact ? "space-y-0.5" : "space-y-1.5"}`}>
        <li>Libera seus comandos com o agente.</li>
        <li>Recebe avisos da sua propria carteira.</li>
        <li>Segue as regras definidas pelo dono do workspace.</li>
        {!compact ? <li>Voce pode atualizar ou remover o numero quando quiser.</li> : null}
      </ul>
    </div>
  );
}

function PanelContent({
  compact = false,
  onClose = null,
}) {
  const {
    draftPhone,
    setDraftPhone,
    saving,
    err,
    okMsg,
    persistedPhone,
    hasPersistedPhone,
    planAllowed,
    agentPlanAllowed,
    status,
    showEditor,
    dirty,
    handleSave,
    handleRemove,
    handleStartEdit,
    handleDiscard,
  } = useMyWhatsAppConfig();

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      {err ? <InlineAlert kind="error">{err}</InlineAlert> : null}
      {okMsg ? <InlineAlert kind="success">{okMsg}</InlineAlert> : null}

      <div
        className={[
          "rounded-2xl border border-slate-200/80 bg-white/80 dark:border-white/10 dark:bg-white/5",
          compact ? "p-3.5" : "p-4",
        ].join(" ")}
      >
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

        <div className={`mt-4 flex flex-wrap gap-2 ${compact ? "text-[11px]" : ""}`}>
          <Badge tone={agentPlanAllowed ? "PAID" : "ACCEPTED"}>
            {agentPlanAllowed ? "Agente liberado" : "Agente bloqueado no plano"}
          </Badge>
          <Badge tone={hasPersistedPhone ? "PUBLIC" : "DRAFT"}>
            {hasPersistedPhone ? "Numero salvo" : "Numero pendente"}
          </Badge>
        </div>
      </div>

      <WhatsAppHighlights compact={compact} />

      <div
        className={[
          "rounded-2xl border border-slate-200/80 bg-white/80 dark:border-white/10 dark:bg-white/5",
          compact ? "p-3.5" : "p-4",
        ].join(" ")}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-950 dark:text-white">
              Numero cadastrado
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {hasPersistedPhone
                ? "Esse numero identifica voce no agente e recebe avisos da sua carteira."
                : "Nenhum numero foi salvo ainda para identificar voce no WhatsApp."}
            </div>
          </div>

          <Badge tone={hasPersistedPhone ? "PAID" : "DRAFT"}>
            {hasPersistedPhone ? "Salvo" : "Nao cadastrado"}
          </Badge>
        </div>

        <div className="surface-subtle mt-4 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">
          {hasPersistedPhone ? persistedPhone : "Nenhum numero cadastrado"}
        </div>

        {planAllowed && hasPersistedPhone ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {!showEditor ? (
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
              : "Campo bloqueado no plano atual. Faca upgrade para Pro, Business ou Enterprise para editar esse numero."}
          </div>
        </div>
      ) : null}

      {!compact ? (
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-xs leading-6 text-slate-500 dark:border-white/10 dark:bg-white/4 dark:text-slate-300">
          A Luminor usa esse numero para reconhecer voce no agente do WhatsApp e para avisos operacionais da sua carteira. Nesta fase, nao existe verificacao por SMS ou OTP.
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        {onClose ? (
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Fechar
          </Button>
        ) : null}
        {showEditor ? (
          <Button type="button" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? "Salvando..." : "Salvar numero"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function MyWhatsAppPanel({
  mode = "page",
  onClose = null,
}) {
  if (mode === "modal") {
    return <PanelContent compact onClose={onClose} />;
  }

  return (
    <Card>
      <CardHeader
        title="WhatsApp do usuario"
        subtitle="Defina o numero pessoal que libera o agente e os avisos da sua carteira."
      />
      <CardBody>
        <PanelContent />
      </CardBody>
    </Card>
  );
}
