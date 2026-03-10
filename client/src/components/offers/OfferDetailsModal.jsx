import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../app/api.js";

import Button from "../appui/Button.jsx";
import Badge from "../appui/Badge.jsx";
import Skeleton from "../appui/Skeleton.jsx";

import {
  norm,
  fmtBRLFromCents,
  getAmountCents,
  getPaymentLabel,
  fmtDT,
  buildPublicUrl,
  safeFileName,
  downloadBase64File,
} from "./offerHelpers.js";

function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    if (open) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-opacity"
      role="dialog"
      aria-modal="true"
      onClick={() => onClose?.()}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl transition-transform"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 bg-white px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-900">
              {title}
            </div>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50"
            onClick={() => onClose?.()}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {footer ? (
          <div className="shrink-0 border-t border-zinc-100 bg-zinc-50 px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AlertInline({ kind = "info", children }) {
  const styles =
    kind === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : kind === "error"
        ? "border-red-200 bg-red-50 text-red-900"
        : "border-blue-200 bg-blue-50 text-blue-900";

  return (
    <div className={`rounded-xl border p-3 text-sm ${styles}`}>{children}</div>
  );
}

function humanReminderKind(kind) {
  const k = String(kind || "")
    .trim()
    .toLowerCase();
  if (k === "manual") return "Manual";
  if (k === "after_24h") return "24h sem pagamento";
  if (k === "after_3d") return "3 dias após envio";
  if (k === "due_date") return "No dia do vencimento";
  if (k === "after_due_date") return "Após vencimento";
  return "Lembrete";
}

function humanReminderStatus(status) {
  const s = String(status || "")
    .trim()
    .toLowerCase();
  if (s === "sent") return { label: "WhatsApp enviado", tone: "PAID" };
  if (s === "failed") return { label: "Falha no envio", tone: "CANCELLED" };
  if (s === "skipped") return { label: "Não enviado", tone: "EXPIRED" };
  return { label: "Processando", tone: "PUBLIC" };
}

function fmtReminderDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";

    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    const yesterday =
      d.getDate() === y.getDate() &&
      d.getMonth() === y.getMonth() &&
      d.getFullYear() === y.getFullYear();

    const time = d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });

    if (sameDay) return `Hoje às ${time}`;
    if (yesterday) return `Ontem às ${time}`;

    return d.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function canSendReminder(offer) {
  const paymentStatus = norm(offer?.paymentStatus);
  const status = norm(offer?.status);
  const hasProof = !!offer?.paymentProof?.storage?.key;
  const paid =
    ["PAID", "CONFIRMED"].includes(paymentStatus) ||
    ["PAID", "CONFIRMED"].includes(status);

  if (hasProof) {
    return {
      ok: false,
      reason:
        "O cliente já enviou comprovante. Não é possível lembrar novamente.",
    };
  }

  if (paid) {
    return { ok: false, reason: "O pagamento já foi confirmado." };
  }

  if (["WAITING_CONFIRMATION", "REJECTED"].includes(paymentStatus)) {
    return {
      ok: false,
      reason: "A proposta não está mais apenas aguardando pagamento.",
    };
  }

  if (["EXPIRED", "CANCELLED"].includes(status)) {
    return {
      ok: false,
      reason: "A proposta não pode receber lembretes agora.",
    };
  }

  if (paymentStatus !== "PENDING") {
    return {
      ok: false,
      reason: "Lembretes só podem ser enviados para propostas pendentes.",
    };
  }

  if (!String(offer?.customerWhatsApp || "").trim()) {
    return {
      ok: false,
      reason: "Cliente sem WhatsApp cadastrado para receber o lembrete.",
    };
  }

  return { ok: true, reason: "" };
}

function SectionTabButton({ active, children, onClick }) {
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

export default function OfferDetailsModal({
  open,
  onClose,
  offer,
  onOfferUpdated,
  copyLink,
  copiedId,
}) {
  const [active, setActive] = useState(null);
  const [booking, setBooking] = useState(null);

  const [activeBusy, setActiveBusy] = useState(false);
  const [activeErr, setActiveErr] = useState("");

  const [modalFlash, setModalFlash] = useState(null);

  const [proofBusy, setProofBusy] = useState(false);
  const [proofErr, setProofErr] = useState("");
  const [proofDataUrl, setProofDataUrl] = useState("");
  const [proofMime, setProofMime] = useState("");

  const [actionBusy, setActionBusy] = useState(false);

  const [rejectBoxOpen, setRejectBoxOpen] = useState(false);
  const [rejectText, setRejectText] = useState("");

  const [mainTab, setMainTab] = useState("overview");
  const [remindersSubTab, setRemindersSubTab] = useState("config");
  const [remindersBusy, setRemindersBusy] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [remindersErr, setRemindersErr] = useState("");
  const [remindersFlash, setRemindersFlash] = useState(null);
  const [remindersHistory, setRemindersHistory] = useState([]);
  const [reminderSettings, setReminderSettings] = useState({
    enabled24h: false,
    enabled3d: false,
    enabledDueDate: false,
    enabledAfterDueDate: false,
  });

  const offerId = offer?._id;

  const resetTransient = useCallback(() => {
    setActiveErr("");
    setModalFlash(null);

    setProofErr("");
    setProofBusy(false);
    setProofDataUrl("");
    setProofMime("");

    setActionBusy(false);

    setRejectBoxOpen(false);
    setRejectText("");

    setMainTab("overview");
    setRemindersSubTab("config");
    setRemindersBusy(false);
    setHistoryBusy(false);
    setRemindersErr("");
    setRemindersFlash(null);
    setRemindersHistory([]);
    setReminderSettings({
      enabled24h: false,
      enabled3d: false,
      enabledDueDate: false,
      enabledAfterDueDate: false,
    });
  }, []);

  const fetchDetails = useCallback(async (id) => {
    const d = await api(`/offers/${id}`);
    if (!d?.ok && d?.ok !== undefined) {
      throw new Error(d?.error || "Falha ao carregar detalhes.");
    }
    return { offer: d?.offer || null, booking: d?.booking || null };
  }, []);

  const loadReminderHistory = useCallback(async (id) => {
    if (!id) return;
    try {
      setHistoryBusy(true);
      setRemindersErr("");
      const d = await api(`/offers/${id}/payment-reminders/history`);
      setRemindersHistory(Array.isArray(d?.items) ? d.items : []);
    } catch (e) {
      setRemindersErr(
        e?.message || "Falha ao carregar histórico de lembretes.",
      );
    } finally {
      setHistoryBusy(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;

    if (!open) return;

    setActive(offer || null);
    setBooking(offer?.booking || null);
    resetTransient();

    if (offer?.paymentReminders) {
      setReminderSettings({
        enabled24h: !!offer.paymentReminders.enabled24h,
        enabled3d: !!offer.paymentReminders.enabled3d,
        enabledDueDate: !!offer.paymentReminders.enabledDueDate,
        enabledAfterDueDate: !!offer.paymentReminders.enabledAfterDueDate,
      });
    }

    if (!offerId) return;

    (async () => {
      try {
        setActiveBusy(true);
        const d = await fetchDetails(offerId);
        if (!alive) return;
        setActive((prev) => ({ ...(prev || {}), ...(d.offer || {}) }));
        setBooking(d.booking || null);
        setReminderSettings({
          enabled24h: !!d?.offer?.paymentReminders?.enabled24h,
          enabled3d: !!d?.offer?.paymentReminders?.enabled3d,
          enabledDueDate: !!d?.offer?.paymentReminders?.enabledDueDate,
          enabledAfterDueDate:
            !!d?.offer?.paymentReminders?.enabledAfterDueDate,
        });
      } catch (e) {
        if (!alive) return;
        setActiveErr(e?.message || "Falha ao carregar detalhes.");
      } finally {
        if (alive) setActiveBusy(false);
      }
    })();

    (async () => {
      try {
        const d = await api(`/offers/${offerId}/payment-reminders/history`);
        if (!alive) return;
        setRemindersHistory(Array.isArray(d?.items) ? d.items : []);
      } catch {
        if (!alive) return;
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, offerId, offer, fetchDetails, resetTransient]);

  const refreshActive = useCallback(async () => {
    if (!offerId) return;
    try {
      setActiveBusy(true);
      setActiveErr("");
      const d = await fetchDetails(offerId);
      setActive((prev) => ({ ...(prev || {}), ...(d.offer || {}) }));
      setBooking(d.booking || null);
      setReminderSettings({
        enabled24h: !!d?.offer?.paymentReminders?.enabled24h,
        enabled3d: !!d?.offer?.paymentReminders?.enabled3d,
        enabledDueDate: !!d?.offer?.paymentReminders?.enabledDueDate,
        enabledAfterDueDate: !!d?.offer?.paymentReminders?.enabledAfterDueDate,
      });
      if (d?.offer?._id && typeof onOfferUpdated === "function") {
        onOfferUpdated(d.offer);
      }
    } catch (e) {
      setActiveErr(e?.message || "Falha ao atualizar detalhes.");
    } finally {
      setActiveBusy(false);
    }
  }, [offerId, fetchDetails, onOfferUpdated]);

  const loadProof = useCallback(async () => {
    if (!offerId) return;
    try {
      setProofErr("");
      setProofBusy(true);

      const d = await api(`/offers/${offerId}/payment-proof?inline=1`);
      if (!d?.ok) throw new Error(d?.error || "Falha ao carregar comprovante.");

      const mime = d?.file?.mimeType || "application/octet-stream";
      const b64 = d?.file?.base64 || "";
      if (!b64) throw new Error("Comprovante vazio.");

      setProofMime(mime);
      setProofDataUrl(`data:${mime};base64,${b64}`);
    } catch (e) {
      setProofErr(e?.message || "Falha ao carregar comprovante.");
      setProofDataUrl("");
      setProofMime("");
    } finally {
      setProofBusy(false);
    }
  }, [offerId]);

  const downloadProof = useCallback(async () => {
    if (!offerId) return;
    try {
      setProofErr("");
      setProofBusy(true);

      const d = await api(`/offers/${offerId}/payment-proof?inline=1`);
      if (!d?.ok) throw new Error(d?.error || "Falha ao carregar comprovante.");

      const mime = d?.file?.mimeType || "application/octet-stream";
      const b64 = d?.file?.base64 || "";
      if (!b64) throw new Error("Comprovante vazio.");

      const originalName =
        d?.file?.originalName ||
        active?.paymentProof?.originalName ||
        "comprovante";

      const filename = safeFileName(originalName, mime);
      downloadBase64File(b64, mime, filename);
    } catch (e) {
      setProofErr(e?.message || "Falha ao baixar comprovante.");
    } finally {
      setProofBusy(false);
    }
  }, [offerId, active?.paymentProof?.originalName]);

  const confirmPayment = useCallback(async () => {
    if (!offerId) return;
    if (!window.confirm("Confirmar recebimento deste pagamento?")) return;

    try {
      setModalFlash(null);
      setProofErr("");
      setActionBusy(true);

      const d = await api(`/offers/${offerId}/confirm-payment`, {
        method: "POST",
      });
      if (!d?.ok) throw new Error(d?.error || "Falha ao confirmar pagamento.");

      const updated = d?.offer || null;
      if (updated?._id) {
        setActive((prev) => ({ ...(prev || {}), ...(updated || {}) }));
        if (typeof onOfferUpdated === "function") onOfferUpdated(updated);
      }

      const wa = d?.notify;
      const email1 = d?.email;
      const email2 = d?.emailConfirmed;

      const parts = [];
      if (wa?.status === "SENT") parts.push("WhatsApp enviado ao cliente");
      if (wa?.status === "FAILED") parts.push("WhatsApp falhou");
      if (wa?.status === "SKIPPED") parts.push("WhatsApp não enviado");

      if (email1?.status === "SENT")
        parts.push("e-mail (Pix confirmado) enviado");
      if (email1?.status === "FAILED")
        parts.push("e-mail (Pix confirmado) falhou");
      if (email1?.status === "SKIPPED")
        parts.push("e-mail (Pix confirmado) não enviado");

      if (email2?.status === "SENT")
        parts.push("e-mail (confirmado na plataforma) enviado");
      if (email2?.status === "FAILED")
        parts.push("e-mail (confirmado na plataforma) falhou");
      if (email2?.status === "SKIPPED")
        parts.push("e-mail (confirmado na plataforma) não enviado");

      setModalFlash({
        kind:
          wa?.status === "FAILED" ||
          email1?.status === "FAILED" ||
          email2?.status === "FAILED"
            ? "error"
            : "success",
        text:
          parts.length > 0
            ? `Pagamento confirmado. ${parts.join(" • ")}.`
            : "Pagamento confirmado com sucesso.",
      });

      await refreshActive();
    } catch (e) {
      setProofErr(e?.message || "Falha ao confirmar pagamento.");
      setModalFlash({
        kind: "error",
        text: e?.message || "Falha ao confirmar pagamento.",
      });
    } finally {
      setActionBusy(false);
    }
  }, [offerId, onOfferUpdated, refreshActive]);

  const rejectPayment = useCallback(
    async (reasonText) => {
      if (!offerId) return;

      const reason = String(reasonText || "").trim();
      if (!reason) {
        setModalFlash({
          kind: "error",
          text: "Escreva uma mensagem/motivo para recusar o comprovante.",
        });
        return;
      }

      try {
        setModalFlash(null);
        setProofErr("");
        setActionBusy(true);

        const publicUrl = buildPublicUrl(active);

        const d = await api(`/offers/${offerId}/reject-payment`, {
          method: "POST",
          body: JSON.stringify({ reason, publicUrl }),
        });
        if (!d?.ok)
          throw new Error(d?.error || "Falha ao recusar comprovante.");

        const updated = d?.offer || null;
        if (updated?._id) {
          setActive((prev) => ({ ...(prev || {}), ...(updated || {}) }));
          if (typeof onOfferUpdated === "function") onOfferUpdated(updated);
        }

        const wa = d?.notify;
        if (wa?.status === "SENT") {
          setModalFlash({
            kind: "success",
            text: "Comprovante recusado e WhatsApp enviado ao cliente.",
          });
        } else if (wa?.status === "FAILED") {
          setModalFlash({
            kind: "error",
            text: "Comprovante recusado, mas o envio do WhatsApp falhou. Verifique logs/MessageLog.",
          });
        } else if (wa?.status === "SKIPPED") {
          const r = wa?.reason ? ` (${wa.reason})` : "";
          setModalFlash({
            kind: "info",
            text: `Comprovante recusado. Notificação não enviada${r}.`,
          });
        } else {
          setModalFlash({
            kind: "success",
            text: "Comprovante recusado com sucesso.",
          });
        }

        setRejectBoxOpen(false);
        setRejectText("");

        await refreshActive();
      } catch (e) {
        setProofErr(e?.message || "Falha ao recusar comprovante.");
        setModalFlash({
          kind: "error",
          text: e?.message || "Falha ao recusar comprovante.",
        });
      } finally {
        setActionBusy(false);
      }
    },
    [offerId, active, onOfferUpdated, refreshActive],
  );

  const saveReminderSettings = useCallback(async () => {
    if (!offerId) return;
    try {
      setRemindersBusy(true);
      setRemindersErr("");
      setRemindersFlash(null);

      const d = await api(`/offers/${offerId}/payment-reminders`, {
        method: "PATCH",
        body: JSON.stringify(reminderSettings),
      });

      const updated = d?.offer || null;
      if (updated?._id) {
        setActive((prev) => ({ ...(prev || {}), ...(updated || {}) }));
        if (typeof onOfferUpdated === "function") onOfferUpdated(updated);
      }

      setRemindersFlash({
        kind: "success",
        text: "Configurações de lembretes automáticos salvas com sucesso.",
      });
    } catch (e) {
      setRemindersErr(e?.message || "Falha ao salvar lembretes automáticos.");
      setRemindersFlash({
        kind: "error",
        text: e?.message || "Falha ao salvar lembretes automáticos.",
      });
    } finally {
      setRemindersBusy(false);
    }
  }, [offerId, reminderSettings, onOfferUpdated]);

  const sendReminderNow = useCallback(async () => {
    if (!offerId) return;
    try {
      setRemindersBusy(true);
      setRemindersErr("");
      setRemindersFlash(null);

      const d = await api(`/offers/${offerId}/send-payment-reminder`, {
        method: "POST",
      });

      const result = d?.result || {};
      const updated = d?.offer || null;
      if (updated?._id) {
        setActive((prev) => ({ ...(prev || {}), ...(updated || {}) }));
        if (typeof onOfferUpdated === "function") onOfferUpdated(updated);
      }

      if (result.status === "sent") {
        setRemindersFlash({
          kind: "success",
          text: "Lembrete enviado com sucesso via WhatsApp.",
        });
      } else if (result.status === "skipped") {
        setRemindersFlash({
          kind: "info",
          text:
            result.reason === "NO_PHONE"
              ? "O cliente não possui WhatsApp válido cadastrado."
              : result.reason === "FEATURE_DISABLED"
                ? "O envio por WhatsApp está desabilitado na configuração do ambiente."
                : "O lembrete não foi enviado.",
        });
      } else {
        setRemindersFlash({
          kind: "error",
          text: result.error || "Falha ao enviar lembrete.",
        });
      }

      await loadReminderHistory(offerId);
    } catch (e) {
      setRemindersErr(e?.message || "Falha ao enviar lembrete.");
      setRemindersFlash({
        kind: "error",
        text: e?.message || "Falha ao enviar lembrete.",
      });
    } finally {
      setRemindersBusy(false);
    }
  }, [offerId, onOfferUpdated, loadReminderHistory]);

  const activePay = useMemo(() => getPaymentLabel(active), [active]);
  const activeHasProof = !!active?.paymentProof?.storage?.key;
  const activeWaiting = norm(active?.paymentStatus) === "WAITING_CONFIRMATION";
  const activePaid = activePay?.tone === "PAID";
  const canModerateProof = activeHasProof && activeWaiting && !activePaid;
  const reminderGuard = useMemo(() => canSendReminder(active), [active]);

  const title = active?.customerName
    ? `Detalhes • ${active.customerName}`
    : "Detalhes";

  const lastReminderAt = active?.paymentReminders?.lastSentAt || null;
  const lastReminderKind = active?.paymentReminders?.lastSentKind || "";

  const remindersDirty = useMemo(() => {
    const current = active?.paymentReminders || {};
    return (
      !!current &&
      (Boolean(current.enabled24h) !== Boolean(reminderSettings.enabled24h) ||
        Boolean(current.enabled3d) !== Boolean(reminderSettings.enabled3d) ||
        Boolean(current.enabledDueDate) !==
          Boolean(reminderSettings.enabledDueDate) ||
        Boolean(current.enabledAfterDueDate) !==
          Boolean(reminderSettings.enabledAfterDueDate))
    );
  }, [active, reminderSettings]);

  return (
    <Modal
      open={open}
      onClose={() => onClose?.()}
      title={title}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-500">
            ID:{" "}
            <span className="font-mono text-zinc-700">
              {active?._id || "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onClose?.()}>
              Fechar
            </Button>
            {active?.publicToken ? (
              <Button
                onClick={() =>
                  window.open(
                    `/p/${active.publicToken}`,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
              >
                Abrir link público
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      {modalFlash?.text ? (
        <div className="mb-4">
          <AlertInline kind={modalFlash.kind}>{modalFlash.text}</AlertInline>
        </div>
      ) : null}

      {activeBusy ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-40 rounded-lg" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : activeErr ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {activeErr}
        </div>
      ) : !active ? null : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <div className="flex border-b border-zinc-200 bg-zinc-50">
              <SectionTabButton
                active={mainTab === "overview"}
                onClick={() => setMainTab("overview")}
              >
                Detalhes do orçamento
              </SectionTabButton>

              <SectionTabButton
                active={mainTab === "reminders"}
                onClick={() => setMainTab("reminders")}
              >
                Lembretes de pagamento
              </SectionTabButton>
            </div>

            <div className="p-4">
              {mainTab === "overview" ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="space-y-4 lg:col-span-1">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        Pagamento
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-zinc-900">
                          {activePay?.text}
                        </div>
                        <div className="text-lg font-extrabold tabular-nums text-zinc-900">
                          {fmtBRLFromCents(getAmountCents(active))}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <Badge tone={activePay?.tone}>{activePay?.text}</Badge>
                        {active?.notifyWhatsAppOnPaid ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                            WhatsApp ativo
                          </span>
                        ) : null}
                      </div>

                      {activeHasProof ? (
                        <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                            Comprovante
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              disabled={proofBusy || actionBusy}
                              onClick={loadProof}
                            >
                              Ver
                            </Button>

                            <Button
                              variant="secondary"
                              disabled={proofBusy || actionBusy}
                              onClick={downloadProof}
                            >
                              Baixar
                            </Button>

                            {canModerateProof ? (
                              <>
                                <Button
                                  disabled={actionBusy}
                                  onClick={confirmPayment}
                                >
                                  {actionBusy ? "Processando..." : "Confirmar"}
                                </Button>

                                <Button
                                  variant="ghost"
                                  disabled={actionBusy}
                                  onClick={() => {
                                    setModalFlash(null);
                                    setRejectBoxOpen((v) => !v);
                                  }}
                                >
                                  Recusar
                                </Button>
                              </>
                            ) : null}
                          </div>

                          {rejectBoxOpen ? (
                            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                                Mensagem para o cliente
                              </div>
                              <textarea
                                className="mt-2 min-h-[90px] w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                                placeholder="Explique o motivo da recusa e o que o cliente precisa ajustar..."
                                value={rejectText}
                                onChange={(e) => setRejectText(e.target.value)}
                                disabled={actionBusy}
                              />
                              <div className="mt-2 text-xs text-zinc-600">
                                O cliente receberá esta mensagem no WhatsApp (se
                                a notificação estiver ativa) + o link para
                                reenviar o comprovante.
                              </div>
                              <div className="mt-3 flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  disabled={actionBusy}
                                  onClick={() => {
                                    setRejectBoxOpen(false);
                                    setRejectText("");
                                  }}
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  disabled={actionBusy}
                                  onClick={() => rejectPayment(rejectText)}
                                >
                                  {actionBusy
                                    ? "Recusando..."
                                    : "Confirmar recusa"}
                                </Button>
                              </div>
                            </div>
                          ) : null}

                          {proofErr ? (
                            <div className="mt-2 text-xs text-red-800">
                              {proofErr}
                            </div>
                          ) : null}

                          {proofDataUrl ? (
                            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
                              {String(proofMime || "").includes("pdf") ? (
                                <iframe
                                  title="Proof"
                                  src={proofDataUrl}
                                  className="h-72 w-full"
                                />
                              ) : (
                                <img
                                  alt="Proof"
                                  src={proofDataUrl}
                                  className="h-72 w-full object-contain"
                                />
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-4 lg:col-span-2">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        Proposta
                      </div>

                      <div className="mt-2 text-sm font-semibold text-zinc-900">
                        {active?.title || "Proposta"}
                      </div>

                      {active?.description ? (
                        <div className="mt-1 text-sm text-zinc-600">
                          {active.description}
                        </div>
                      ) : null}

                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs">
                          <div className="font-semibold text-zinc-900">
                            Cliente
                          </div>
                          <div className="mt-1">
                            {active?.customerName || "—"}
                          </div>
                          <div className="mt-1 text-zinc-500">
                            {active?.customerWhatsApp || "—"}
                          </div>

                          {active?.notifyWhatsAppOnPaid ? (
                            <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />
                              NOTIFICAÇÃO ATIVA NO PAGAMENTO
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs">
                          <div className="font-semibold text-zinc-900">
                            Link
                          </div>
                          <div className="mt-1 break-all">
                            {buildPublicUrl(active) || "—"}
                          </div>

                          <Button
                            variant="secondary"
                            className="mt-2"
                            onClick={() => copyLink?.(active)}
                            disabled={!active?.publicToken}
                          >
                            {copiedId === active?._id
                              ? "Copiado"
                              : "Copiar link"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {booking ? (
                      <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
                        <div className="text-[11px] font-bold uppercase text-zinc-500">
                          Agendamento
                        </div>
                        <div className="mt-2">
                          Início:{" "}
                          <span className="font-semibold">
                            {fmtDT(booking.startAt)}
                          </span>
                        </div>
                        <div>
                          Fim:{" "}
                          <span className="font-semibold">
                            {fmtDT(booking.endAt)}
                          </span>
                        </div>
                        <div className="mt-2">
                          <Badge tone={norm(booking.status)}>
                            {norm(booking.status) || "—"}
                          </Badge>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                          Lembretes de pagamento
                        </div>
                        <div className="mt-2 text-sm font-semibold text-zinc-900">
                          Status: {activePay?.text}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          Último lembrete enviado:{" "}
                          <span className="font-medium text-zinc-700">
                            {lastReminderAt
                              ? fmtReminderDate(lastReminderAt)
                              : "Nenhum lembrete enviado"}
                          </span>
                          {lastReminderKind ? (
                            <span className="text-zinc-500">
                              {" "}
                              • {humanReminderKind(lastReminderKind)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-col items-stretch gap-2 md:items-end">
                        <Button
                          onClick={sendReminderNow}
                          disabled={remindersBusy || !reminderGuard.ok}
                        >
                          {remindersBusy ? "Enviando..." : "Enviar lembrete"}
                        </Button>
                        {!reminderGuard.ok ? (
                          <span className="max-w-xs text-[11px] text-zinc-500 md:text-right">
                            {reminderGuard.reason}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                    <div className="flex border-b border-zinc-200 bg-zinc-50">
                      <SectionTabButton
                        active={remindersSubTab === "config"}
                        onClick={() => setRemindersSubTab("config")}
                      >
                        Configurações
                      </SectionTabButton>

                      <SectionTabButton
                        active={remindersSubTab === "history"}
                        onClick={() => {
                          setRemindersSubTab("history");
                          loadReminderHistory(offerId);
                        }}
                      >
                        Histórico de lembretes
                      </SectionTabButton>
                    </div>

                    <div className="p-4 space-y-4">
                      {remindersFlash?.text ? (
                        <AlertInline kind={remindersFlash.kind}>
                          {remindersFlash.text}
                        </AlertInline>
                      ) : null}

                      {remindersErr ? (
                        <AlertInline kind="error">{remindersErr}</AlertInline>
                      ) : null}

                      {remindersSubTab === "config" ? (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                            <div className="text-sm font-semibold text-zinc-900">
                              Lembretes automáticos
                            </div>
                            <p className="mt-1 text-xs text-zinc-500">
                              Ative automações para lembrar o cliente enquanto a
                              proposta estiver pendente.
                            </p>

                            <div className="mt-4 space-y-3">
                              {[
                                {
                                  key: "enabled24h",
                                  label:
                                    "Lembrar cliente após 24h sem pagamento",
                                },
                                {
                                  key: "enabled3d",
                                  label:
                                    "Lembrar cliente 3 dias após envio da proposta",
                                },
                                {
                                  key: "enabledDueDate",
                                  label: "Lembrar cliente no dia do vencimento",
                                },
                                {
                                  key: "enabledAfterDueDate",
                                  label: "Lembrar cliente após vencimento",
                                },
                              ].map((item) => (
                                <label
                                  key={item.key}
                                  className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-700"
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-1 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                                    checked={!!reminderSettings[item.key]}
                                    onChange={(e) =>
                                      setReminderSettings((prev) => ({
                                        ...prev,
                                        [item.key]: e.target.checked,
                                      }))
                                    }
                                  />
                                  <span>{item.label}</span>
                                </label>
                              ))}
                            </div>

                            <div className="mt-4 flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                disabled={remindersBusy || !remindersDirty}
                                onClick={() => {
                                  setReminderSettings({
                                    enabled24h:
                                      !!active?.paymentReminders?.enabled24h,
                                    enabled3d:
                                      !!active?.paymentReminders?.enabled3d,
                                    enabledDueDate:
                                      !!active?.paymentReminders
                                        ?.enabledDueDate,
                                    enabledAfterDueDate:
                                      !!active?.paymentReminders
                                        ?.enabledAfterDueDate,
                                  });
                                }}
                              >
                                Descartar
                              </Button>
                              <Button
                                disabled={remindersBusy || !remindersDirty}
                                onClick={saveReminderSettings}
                              >
                                {remindersBusy
                                  ? "Salvando..."
                                  : "Salvar automações"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : historyBusy ? (
                        <div className="space-y-3">
                          <Skeleton className="h-16 w-full rounded-xl" />
                          <Skeleton className="h-16 w-full rounded-xl" />
                        </div>
                      ) : remindersHistory.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
                          Nenhum lembrete registrado para esta proposta.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {remindersHistory.map((item) => {
                            const st = humanReminderStatus(item?.status);
                            return (
                              <div
                                key={item?._id}
                                className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <div className="text-sm font-semibold text-zinc-900">
                                      {fmtReminderDate(
                                        item?.sentAt || item?.createdAt,
                                      )}
                                    </div>
                                    <div className="mt-1 text-xs text-zinc-500">
                                      {humanReminderKind(item?.kind)} •{" "}
                                      {String(
                                        item?.channel || "whatsapp",
                                      ).toUpperCase()}
                                    </div>
                                  </div>
                                  <Badge tone={st.tone}>{st.label}</Badge>
                                </div>

                                {item?.message ? (
                                  <div className="mt-3 whitespace-pre-line rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-600">
                                    {item.message}
                                  </div>
                                ) : null}

                                {item?.error?.message ? (
                                  <div className="mt-2 text-xs text-red-700">
                                    Erro: {item.error.message}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
