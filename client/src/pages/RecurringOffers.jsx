// src/pages/RecurringOffers.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import { Input } from "../components/appui/Input.jsx";
import Badge from "../components/appui/Badge.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import PixSettingsModal from "../components/PixSettingsModal.jsx";
import { useAuth } from "../app/AuthContext.jsx";
import { canUseRecurringPlan } from "../utils/planFeatures.js";
import {
  duplicateRecurringOffer,
  endRecurringOffer,
  listRecurringOffers,
  pauseRecurringOffer,
  resumeRecurringOffer,
  runRecurringOfferNow,
} from "../app/recurringOffersApi.js";
import {
  getEffectivePixKeyMasked,
  guardOfferCreation,
} from "../utils/guardOfferCreation.js";

function fmtBRL(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents) || 0) / 100);
}

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

export default function RecurringOffers() {
  const nav = useNavigate();
  const { workspace, perms, user, refreshWorkspace } = useAuth();
  const canUseRecurringFeatures = canUseRecurringPlan(
    perms?.plan || workspace?.plan || user?.plan || user?.workspace?.plan || "start",
  );

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(null);
  const [busyId, setBusyId] = useState("");

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("ALL");

  const [localPayoutPixKeyMasked, setLocalPayoutPixKeyMasked] = useState("");
  const [pixModalState, setPixModalState] = useState({
    open: false,
    title: "",
    description: "",
    redirectTo: null,
  });

  useEffect(() => {
    setLocalPayoutPixKeyMasked(
      String(workspace?.payoutPixKeyMasked || "").trim(),
    );
  }, [workspace?.payoutPixKeyMasked]);

  useEffect(() => {
    if (!canUseRecurringFeatures) {
      nav("/offers", { replace: true });
    }
  }, [canUseRecurringFeatures, nav]);

  const openPixModal = useCallback((context = {}) => {
    setPixModalState({
      open: true,
      title: String(context?.title || ""),
      description: String(context?.description || ""),
      redirectTo: context?.redirectTo || null,
    });
  }, []);

  const closePixModal = useCallback(() => {
    setPixModalState({ open: false, title: "", description: "", redirectTo: null });
  }, []);

  const handlePixSaved = useCallback(
    async (data) => {
      const masked = String(data?.payoutPixKeyMasked || "").trim();
      setLocalPayoutPixKeyMasked(masked);
      try {
        await refreshWorkspace?.();
      } catch {}

      const redirectTo = pixModalState.redirectTo;
      closePixModal();
      if (redirectTo) nav(redirectTo);
    },
    [closePixModal, nav, pixModalState.redirectTo, refreshWorkspace],
  );

  const load = useCallback(async () => {
    if (!canUseRecurringFeatures) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const params = {};
      if (filter === "UPCOMING") params.bucket = "upcoming";
      else if (filter !== "ALL") params.status = filter;
      if (q.trim()) params.q = q.trim();
      const d = await listRecurringOffers(params);
      setItems(d?.items || []);
    } catch (e) {
      setError(e?.message || "Falha ao carregar recorrências.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [canUseRecurringFeatures, filter, q]);

  useEffect(() => {
    load();
  }, [load]);

  const handleNewRecurring = useCallback(() => {
    if (!canUseRecurringFeatures) {
      nav("/offers/new", { replace: true });
      return;
    }

    guardOfferCreation({
      workspace,
      payoutPixKeyMasked: getEffectivePixKeyMasked(
        workspace,
        localPayoutPixKeyMasked,
      ),
      navigate: nav,
      openPixModal,
      targetPath: "/offers/new?mode=recurring",
    });
  }, [canUseRecurringFeatures, localPayoutPixKeyMasked, nav, openPixModal, workspace]);

  const runAction = useCallback(
    async (item, action) => {
      if (!canUseRecurringFeatures || !item?._id) return;
      try {
        setBusyId(`${item._id}:${action}`);
        setError("");
        setFlash(null);

        if (action === "pause") {
          await pauseRecurringOffer(item._id);
          setFlash({ kind: "success", text: "Recorrência pausada com sucesso." });
        } else if (action === "resume") {
          await resumeRecurringOffer(item._id);
          setFlash({ kind: "success", text: "Recorrência reativada com sucesso." });
        } else if (action === "run") {
          const d = await runRecurringOfferNow(item._id);
          setFlash({
            kind: "success",
            text: d?.offer?._id
              ? "Cobrança gerada manualmente com sucesso."
              : "Execução concluída.",
          });
        } else if (action === "end") {
          if (!window.confirm("Encerrar esta recorrência?")) return;
          await endRecurringOffer(item._id);
          setFlash({ kind: "success", text: "Recorrência encerrada." });
        } else if (action === "duplicate") {
          const d = await duplicateRecurringOffer(item._id);
          setFlash({ kind: "success", text: "Recorrência duplicada com sucesso." });
          if (d?.recurring?._id) nav(`/offers/recurring/${d.recurring._id}`);
        }

        await load();
      } catch (e) {
        if (e?.status === 403) {
          nav("/offers", { replace: true });
          return;
        }
        setFlash({ kind: "error", text: e?.message || "Falha ao executar ação." });
      } finally {
        setBusyId("");
      }
    },
    [canUseRecurringFeatures, load, nav],
  );

  const rows = useMemo(() => items || [], [items]);

  return (
    <Shell>
      <div className="space-y-6">
        <PageHeader
          title="Cobranças recorrentes"
          subtitle="Automatize a geração de propostas recorrentes sem perder o controle das cobranças individuais." 
          actions={
            <Button onClick={handleNewRecurring}>Nova recorrência</Button>
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

        <Card>
          <CardBody className="space-y-4 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <select
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="ALL">Todas</option>
                  <option value="ACTIVE">Ativas</option>
                  <option value="PAUSED">Pausadas</option>
                  <option value="ENDED">Encerradas</option>
                  <option value="ERROR">Com erro</option>
                  <option value="UPCOMING">Próximas execuções</option>
                </select>

                <div className="w-full md:w-80">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar nome, cliente ou serviço…"
                    className="h-10"
                  />
                </div>
              </div>

              <Button variant="secondary" onClick={load} disabled={loading}>
                Atualizar
              </Button>
            </div>

            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {error}
              </div>
            ) : rows.length === 0 ? (
              <EmptyState
                title="Nenhuma recorrência"
                description="Crie sua primeira cobrança recorrente para automatizar o envio das próximas propostas."
                ctaLabel="Nova recorrência"
                onCta={handleNewRecurring}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-zinc-400">
                    <tr>
                      <th className="border-b border-zinc-100 py-3 pr-4">Recorrência</th>
                      <th className="border-b border-zinc-100 py-3 pr-4">Cliente</th>
                      <th className="border-b border-zinc-100 py-3 pr-4">Valor</th>
                      <th className="border-b border-zinc-100 py-3 pr-4">Frequência</th>
                      <th className="border-b border-zinc-100 py-3 pr-4">Próximo envio</th>
                      <th className="border-b border-zinc-100 py-3 pr-4">Última geração</th>
                      <th className="border-b border-zinc-100 py-3 pr-4">Status</th>
                      <th className="border-b border-zinc-100 py-3 pr-4">Cobranças</th>
                      <th className="border-b border-zinc-100 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {rows.map((item) => {
                      const key = String(item?._id || "");
                      const isPaused = String(item?.status || "").toLowerCase() === "paused";
                      const isEnded = String(item?.status || "").toLowerCase() === "ended";
                      const actionBusy = (name) => busyId === `${key}:${name}`;

                      return (
                        <tr key={key} className="hover:bg-zinc-50/50">
                          <td className="py-3 pr-4">
                            <div className="font-semibold text-zinc-900">{item?.name || "—"}</div>
                            <div className="mt-1 text-xs text-zinc-500 line-clamp-1">{item?.title || "Sem título"}</div>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="font-medium text-zinc-900">{item?.customerName || "—"}</div>
                            <div className="mt-1 text-xs text-zinc-500">{item?.customerWhatsApp || "—"}</div>
                          </td>
                          <td className="py-3 pr-4 font-semibold text-zinc-900">{fmtBRL(item?.totalCents ?? item?.amountCents ?? 0)}</td>
                          <td className="py-3 pr-4 text-zinc-700">A cada {Number(item?.recurrence?.intervalDays || 0)} dias</td>
                          <td className="py-3 pr-4 text-zinc-700">{fmtDT(item?.recurrence?.nextRunAt)}</td>
                          <td className="py-3 pr-4 text-zinc-700">{fmtDT(item?.lastRunAt || item?.summary?.lastGeneratedAt)}</td>
                          <td className="py-3 pr-4">
                            <Badge tone={mapStatusTone(item?.status)}>{String(item?.status || "draft").toUpperCase()}</Badge>
                          </td>
                          <td className="py-3 pr-4 text-zinc-700">
                            <div className="font-semibold text-zinc-900">{Number(item?.summary?.generatedCount || 0)}</div>
                            <div className="mt-1 text-xs text-zinc-500">{Number(item?.summary?.pendingCount || 0)} pendente(s)</div>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <Link to={`/offers/recurring/${item._id}`}>
                                <Button variant="secondary">Detalhes</Button>
                              </Link>

                              {!isEnded ? (
                                <Button
                                  variant="secondary"
                                  disabled={actionBusy("run")}
                                  onClick={() => runAction(item, "run")}
                                >
                                  {actionBusy("run") ? "Gerando..." : "Gerar agora"}
                                </Button>
                              ) : null}

                              {isPaused ? (
                                <Button
                                  variant="ghost"
                                  disabled={actionBusy("resume")}
                                  onClick={() => runAction(item, "resume")}
                                >
                                  {actionBusy("resume") ? "Reativando..." : "Reativar"}
                                </Button>
                              ) : !isEnded ? (
                                <Button
                                  variant="ghost"
                                  disabled={actionBusy("pause")}
                                  onClick={() => runAction(item, "pause")}
                                >
                                  {actionBusy("pause") ? "Pausando..." : "Pausar"}
                                </Button>
                              ) : null}

                              <Button
                                variant="ghost"
                                disabled={actionBusy("duplicate")}
                                onClick={() => runAction(item, "duplicate")}
                              >
                                {actionBusy("duplicate") ? "Duplicando..." : "Duplicar"}
                              </Button>

                              {!isEnded ? (
                                <Button
                                  variant="ghost"
                                  disabled={actionBusy("end")}
                                  onClick={() => runAction(item, "end")}
                                >
                                  {actionBusy("end") ? "Encerrando..." : "Encerrar"}
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <PixSettingsModal
        open={pixModalState.open}
        onClose={closePixModal}
        onSaved={handlePixSaved}
        contextTitle={pixModalState.title}
        contextDescription={pixModalState.description}
      />
    </Shell>
  );
}
