// src/pages/RecurringOfferDetails.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Badge from "../components/appui/Badge.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import {
  duplicateRecurringOffer,
  endRecurringOffer,
  getRecurringOffer,
  listRecurringOfferHistory,
  listRecurringOfferOffers,
  pauseRecurringOffer,
  resumeRecurringOffer,
  runRecurringOfferNow,
} from "../app/recurringOffersApi.js";
import { fmtBRLFromCents, getPaymentLabel } from "../components/offers/offerHelpers.js";

function fmtDT(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return "—";
  }
}

function mapStatusTone(status) {
  const s = String(status || "").trim().toUpperCase();
  if (s === "ACTIVE") return "PAID";
  if (s === "PAUSED") return "ACCEPTED";
  if (s === "ENDED") return "EXPIRED";
  if (s === "ERROR") return "CANCELLED";
  return "DRAFT";
}

function historyTone(status) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "generated" || s === "sent") return "PAID";
  if (s === "skipped" || s === "paused") return "ACCEPTED";
  if (s === "ended") return "EXPIRED";
  if (s === "failed") return "CANCELLED";
  return "PUBLIC";
}

function DetailsTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
        active
          ? "border-emerald-500 bg-white text-emerald-600"
          : "border-transparent text-zinc-600 hover:text-zinc-900"
      }`}
    >
      {children}
    </button>
  );
}

export default function RecurringOfferDetails() {
  const { id } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [tab, setTab] = useState("overview");

  const [recurring, setRecurring] = useState(null);
  const [summary, setSummary] = useState(null);
  const [offers, setOffers] = useState([]);
  const [history, setHistory] = useState([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [detail, offersRes, historyRes] = await Promise.all([
        getRecurringOffer(id),
        listRecurringOfferOffers(id),
        listRecurringOfferHistory(id),
      ]);

      setRecurring(detail?.recurring || null);
      setSummary(detail?.summary || null);
      setOffers(offersRes?.items || detail?.offers || []);
      setHistory(historyRes?.items || detail?.history || []);
    } catch (e) {
      setError(e?.message || "Falha ao carregar recorrência.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = useCallback(
    async (action) => {
      try {
        setBusyAction(action);
        setFlash(null);
        if (action === "pause") {
          await pauseRecurringOffer(id);
          setFlash({ kind: "success", text: "Recorrência pausada." });
        } else if (action === "resume") {
          await resumeRecurringOffer(id);
          setFlash({ kind: "success", text: "Recorrência reativada." });
        } else if (action === "run") {
          const d = await runRecurringOfferNow(id);
          setFlash({
            kind: "success",
            text: d?.offer?._id
              ? "Cobrança gerada manualmente com sucesso."
              : "Execução concluída.",
          });
        } else if (action === "end") {
          if (!window.confirm("Encerrar esta recorrência?")) return;
          await endRecurringOffer(id);
          setFlash({ kind: "success", text: "Recorrência encerrada." });
        } else if (action === "duplicate") {
          const d = await duplicateRecurringOffer(id);
          if (d?.recurring?._id) {
            nav(`/offers/recurring/${d.recurring._id}`);
            return;
          }
        }

        await load();
      } catch (e) {
        setFlash({ kind: "error", text: e?.message || "Falha ao executar ação." });
      } finally {
        setBusyAction("");
      }
    },
    [id, load, nav],
  );

  const isPaused = String(recurring?.status || "").toLowerCase() === "paused";
  const isEnded = String(recurring?.status || "").toLowerCase() === "ended";

  const cards = useMemo(
    () => [
      {
        label: "Próxima execução",
        value: fmtDT(recurring?.recurrence?.nextRunAt),
      },
      {
        label: "Último disparo",
        value: fmtDT(recurring?.lastRunAt),
      },
      {
        label: "Cobranças geradas",
        value: String(summary?.generatedCount || 0),
      },
      {
        label: "Total pago",
        value: fmtBRLFromCents(summary?.totalPaidCents || 0),
      },
      {
        label: "Total pendente",
        value: fmtBRLFromCents(summary?.totalPendingCents || 0),
      },
      {
        label: "Falhas registradas",
        value: String(recurring?.failureCount || 0),
      },
    ],
    [recurring, summary],
  );

  return (
    <Shell>
      <div className="space-y-6">
        <PageHeader
          title={recurring?.name || "Cobrança recorrente"}
          subtitle="Acompanhe a automação, as propostas geradas e o status operacional da recorrência."
          actions={
            <>
              <Link to="/offers/recurring">
                <Button variant="secondary">Voltar</Button>
              </Link>
              {!isEnded ? (
                <Button
                  variant="secondary"
                  onClick={() => runAction("run")}
                  disabled={busyAction === "run"}
                >
                  {busyAction === "run" ? "Gerando..." : "Gerar agora"}
                </Button>
              ) : null}
              {isPaused ? (
                <Button onClick={() => runAction("resume")} disabled={busyAction === "resume"}>
                  {busyAction === "resume" ? "Reativando..." : "Reativar"}
                </Button>
              ) : !isEnded ? (
                <Button variant="secondary" onClick={() => runAction("pause")} disabled={busyAction === "pause"}>
                  {busyAction === "pause" ? "Pausando..." : "Pausar"}
                </Button>
              ) : null}
            </>
          }
        />

        {flash?.text ? (
          <div
            className={`rounded-2xl border p-4 text-sm ${
              flash.kind === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {flash.text}
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : !recurring ? (
          <EmptyState
            title="Recorrência não encontrada"
            description="Verifique se esta automação ainda existe ou se você possui acesso a ela."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => (
                <Card key={card.label}>
                  <CardBody>
                    <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      {card.label}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-zinc-900">
                      {card.value}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>

            <Card className="overflow-hidden">
              <div className="flex border-b border-zinc-200 bg-zinc-50">
                <DetailsTab active={tab === "overview"} onClick={() => setTab("overview")}>Visão geral</DetailsTab>
                <DetailsTab active={tab === "config"} onClick={() => setTab("config")}>Configuração</DetailsTab>
                <DetailsTab active={tab === "offers"} onClick={() => setTab("offers")}>Propostas geradas</DetailsTab>
                <DetailsTab active={tab === "history"} onClick={() => setTab("history")}>Histórico de execuções</DetailsTab>
                <DetailsTab active={tab === "ops"} onClick={() => setTab("ops")}>Status operacional</DetailsTab>
              </div>

              <CardBody className="space-y-4">
                {tab === "overview" ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Cliente</div>
                      <div className="mt-2 text-sm font-semibold text-zinc-900">{recurring.customerName}</div>
                      <div className="mt-1 text-sm text-zinc-600">{recurring.customerWhatsApp || "Sem WhatsApp"}</div>
                      <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Recorrência</div>
                      <div className="mt-2 text-sm text-zinc-700">A cada {Number(recurring?.recurrence?.intervalDays || 0)} dias</div>
                      <div className="mt-1 text-sm text-zinc-700">Início: {fmtDT(recurring?.recurrence?.startsAt)}</div>
                      <div className="mt-1 text-sm text-zinc-700">Próxima execução: {fmtDT(recurring?.recurrence?.nextRunAt)}</div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Cobrança</div>
                      <div className="mt-2 text-sm font-semibold text-zinc-900">{recurring.title || "Proposta recorrente"}</div>
                      <div className="mt-1 text-sm text-zinc-600">{recurring.description || "Sem descrição adicional."}</div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Badge tone={mapStatusTone(recurring.status)}>{String(recurring.status || "draft").toUpperCase()}</Badge>
                        <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                          {fmtBRLFromCents(recurring.totalCents ?? recurring.amountCents ?? 0)}
                        </span>
                        {recurring.automation?.autoSendToCustomer ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            Envio automático ao cliente
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {tab === "config" ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Dados da automação</div>
                      <div className="mt-3 space-y-2">
                        <div><span className="font-semibold text-zinc-900">Nome interno:</span> {recurring.name}</div>
                        <div><span className="font-semibold text-zinc-900">Tipo:</span> {recurring.offerType === "product" ? "Produto" : "Serviço"}</div>
                        <div><span className="font-semibold text-zinc-900">Status inicial/atual:</span> {recurring.status}</div>
                        <div><span className="font-semibold text-zinc-900">Repetição:</span> a cada {Number(recurring?.recurrence?.intervalDays || 0)} dias</div>
                        <div><span className="font-semibold text-zinc-900">Horário:</span> {recurring?.recurrence?.timeOfDay || "09:00"}</div>
                        <div><span className="font-semibold text-zinc-900">Fim:</span> {recurring?.recurrence?.endMode === "until_date" ? `até ${fmtDT(recurring?.recurrence?.endsAt)}` : recurring?.recurrence?.endMode === "until_count" ? `até ${recurring?.recurrence?.maxOccurrences || 0} cobranças` : "sem término"}</div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Snapshot da proposta</div>
                      <div className="mt-3 space-y-2">
                        <div><span className="font-semibold text-zinc-900">Título:</span> {recurring.title || "—"}</div>
                        <div><span className="font-semibold text-zinc-900">Valor:</span> {fmtBRLFromCents(recurring.totalCents ?? recurring.amountCents ?? 0)}</div>
                        <div><span className="font-semibold text-zinc-900">Sinal:</span> {recurring.depositEnabled ? `${recurring.depositPct || 0}%` : "Não"}</div>
                        <div><span className="font-semibold text-zinc-900">Validade:</span> {recurring.validityEnabled ? `${recurring.validityDays || 0} dia(s)` : "Não definida"}</div>
                        <div><span className="font-semibold text-zinc-900">WhatsApp no pagamento:</span> {recurring.notifyWhatsAppOnPaid ? "Ativo" : "Desativado"}</div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {tab === "offers" ? (
                  offers.length === 0 ? (
                    <EmptyState
                      title="Nenhuma proposta gerada"
                      description="As propostas criadas pela recorrência aparecerão aqui conforme as execuções forem acontecendo."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[860px] text-left text-sm">
                        <thead className="text-[11px] uppercase tracking-wider text-zinc-400">
                          <tr>
                            <th className="border-b border-zinc-100 py-3 pr-4">Criada em</th>
                            <th className="border-b border-zinc-100 py-3 pr-4">Título</th>
                            <th className="border-b border-zinc-100 py-3 pr-4">Valor</th>
                            <th className="border-b border-zinc-100 py-3 pr-4">Pagamento</th>
                            <th className="border-b border-zinc-100 py-3 pr-4">Sequência</th>
                            <th className="border-b border-zinc-100 py-3 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {offers.map((offer) => {
                            const pay = getPaymentLabel(offer);
                            return (
                              <tr key={offer._id} className="hover:bg-zinc-50/50">
                                <td className="py-3 pr-4 text-zinc-700">{fmtDT(offer.createdAt)}</td>
                                <td className="py-3 pr-4">
                                  <div className="font-medium text-zinc-900">{offer.title || "Proposta"}</div>
                                  <div className="mt-1 text-xs text-zinc-500">{offer.recurringNameSnapshot || recurring.name}</div>
                                </td>
                                <td className="py-3 pr-4 font-semibold text-zinc-900">{fmtBRLFromCents(offer.totalCents ?? offer.amountCents ?? 0)}</td>
                                <td className="py-3 pr-4"><Badge tone={pay.tone}>{pay.text}</Badge></td>
                                <td className="py-3 pr-4 text-zinc-700">#{offer.recurringSequence || "—"}</td>
                                <td className="py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {offer.publicToken ? (
                                      <Button
                                        variant="secondary"
                                        onClick={() => window.open(`/p/${offer.publicToken}`, "_blank", "noopener,noreferrer")}
                                      >
                                        Abrir link
                                      </Button>
                                    ) : null}
                                    <Link to="/offers">
                                      <Button variant="ghost">Ir para propostas</Button>
                                    </Link>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : null}

                {tab === "history" ? (
                  history.length === 0 ? (
                    <EmptyState
                      title="Nenhum histórico registrado"
                      description="As execuções automáticas e manuais da recorrência serão registradas aqui."
                    />
                  ) : (
                    <div className="space-y-3">
                      {history.map((item) => (
                        <div key={String(item?._id || item?.ranAt || Math.random())} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-zinc-900">{fmtDT(item?.ranAt || item?.createdAt)}</div>
                              <div className="mt-1 text-xs text-zinc-500">{String(item?.source || "automatic").toUpperCase()} • {item?.message || "Execução registrada."}</div>
                            </div>
                            <Badge tone={historyTone(item?.status)}>{String(item?.status || "generated").toUpperCase()}</Badge>
                          </div>
                          {item?.offerId ? (
                            <div className="mt-3 text-xs text-zinc-600">Oferta gerada: <span className="font-mono">{String(item.offerId)}</span></div>
                          ) : null}
                          {item?.error?.message ? (
                            <div className="mt-2 text-xs text-red-700">Erro: {item.error.message}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )
                ) : null}

                {tab === "ops" ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Saúde da automação</div>
                      <div className="mt-3 space-y-2">
                        <div><span className="font-semibold text-zinc-900">Status:</span> {recurring.status}</div>
                        <div><span className="font-semibold text-zinc-900">Execuções totais:</span> {recurring.runCount || 0}</div>
                        <div><span className="font-semibold text-zinc-900">Sucessos:</span> {recurring.successCount || 0}</div>
                        <div><span className="font-semibold text-zinc-900">Falhas:</span> {recurring.failureCount || 0}</div>
                        <div><span className="font-semibold text-zinc-900">Última oferta:</span> {recurring.lastOfferId ? String(recurring.lastOfferId) : "—"}</div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Último erro</div>
                      {recurring?.lastError?.message ? (
                        <div className="mt-3 space-y-2">
                          <div><span className="font-semibold text-zinc-900">Mensagem:</span> {recurring.lastError.message}</div>
                          <div><span className="font-semibold text-zinc-900">Código:</span> {recurring.lastError.code || "—"}</div>
                          <div><span className="font-semibold text-zinc-900">Quando:</span> {fmtDT(recurring.lastError.at)}</div>
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-zinc-500">Nenhum erro operacional registrado.</div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {!isEnded ? (
                          <Button variant="secondary" onClick={() => runAction("duplicate")} disabled={busyAction === "duplicate"}>
                            {busyAction === "duplicate" ? "Duplicando..." : "Duplicar"}
                          </Button>
                        ) : null}
                        {!isEnded ? (
                          <Button variant="ghost" onClick={() => runAction("end")} disabled={busyAction === "end"}>
                            {busyAction === "end" ? "Encerrando..." : "Encerrar"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </Shell>
  );
}
