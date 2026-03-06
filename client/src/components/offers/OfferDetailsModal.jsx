// src/components/offers/OfferDetailsModal.jsx
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
        className="flex w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl transition-transform"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 bg-white">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-900 truncate">
              {title}
            </div>
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50 flex items-center justify-center transition-colors"
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

  const [modalFlash, setModalFlash] = useState(null); // { kind, text }

  const [proofBusy, setProofBusy] = useState(false);
  const [proofErr, setProofErr] = useState("");
  const [proofDataUrl, setProofDataUrl] = useState("");
  const [proofMime, setProofMime] = useState("");

  const [actionBusy, setActionBusy] = useState(false);

  const [rejectBoxOpen, setRejectBoxOpen] = useState(false);
  const [rejectText, setRejectText] = useState("");

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
  }, []);

  const fetchDetails = useCallback(async (id) => {
    const d = await api(`/offers/${id}`);
    if (!d?.ok && d?.ok !== undefined) {
      throw new Error(d?.error || "Falha ao carregar detalhes.");
    }
    return { offer: d?.offer || null, booking: d?.booking || null };
  }, []);

  // abre + carrega detalhes
  useEffect(() => {
    let alive = true;

    if (!open) return;

    setActive(offer || null);
    setBooking(offer?.booking || null);
    resetTransient();

    if (!offerId) return;

    (async () => {
      try {
        setActiveBusy(true);
        const d = await fetchDetails(offerId);
        if (!alive) return;
        setActive((prev) => ({ ...(prev || {}), ...(d.offer || {}) }));
        setBooking(d.booking || null);
      } catch (e) {
        if (!alive) return;
        setActiveErr(e?.message || "Falha ao carregar detalhes.");
      } finally {
        if (alive) setActiveBusy(false);
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

      // feedback consolidado (WhatsApp + e-mails)
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

  const activePay = useMemo(() => getPaymentLabel(active), [active]);
  const activeHasProof = !!active?.paymentProof?.storage?.key;
  const activeWaiting = norm(active?.paymentStatus) === "WAITING_CONFIRMATION";
  const activePaid = activePay?.tone === "PAID";
  const canModerateProof = activeHasProof && activeWaiting && !activePaid;

  const title = active?.customerName
    ? `Detalhes • ${active.customerName}`
    : "Detalhes";

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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* LEFT */}
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Pagamento
              </div>

              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-zinc-900">
                  {activePay?.text}
                </div>
                <div className="text-lg font-extrabold text-zinc-900 tabular-nums">
                  {fmtBRLFromCents(getAmountCents(active))}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Badge tone={activePay?.tone}>{activePay?.text}</Badge>
                {active?.notifyWhatsAppOnPaid ? (
                  <span className="text-[10px] font-bold text-emerald-700 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1">
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
                      size="sm"
                      disabled={proofBusy || actionBusy}
                      onClick={loadProof}
                    >
                      Ver
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={proofBusy || actionBusy}
                      onClick={downloadProof}
                    >
                      Baixar
                    </Button>

                    {canModerateProof ? (
                      <>
                        <Button
                          size="sm"
                          disabled={actionBusy}
                          onClick={confirmPayment}
                        >
                          {actionBusy ? "Processando..." : "Confirmar"}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
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
                        className="mt-2 w-full min-h-[90px] rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                        placeholder="Explique o motivo da recusa e o que o cliente precisa ajustar..."
                        value={rejectText}
                        onChange={(e) => setRejectText(e.target.value)}
                        disabled={actionBusy}
                      />
                      <div className="mt-2 text-xs text-zinc-600">
                        O cliente receberá esta mensagem no WhatsApp (se a
                        notificação estiver ativa) + o link para reenviar o
                        comprovante.
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={actionBusy}
                          onClick={() => {
                            setRejectBoxOpen(false);
                            setRejectText("");
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          disabled={actionBusy}
                          onClick={() => rejectPayment(rejectText)}
                        >
                          {actionBusy ? "Recusando..." : "Confirmar recusa"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {proofErr ? (
                    <div className="mt-2 text-xs text-red-800">{proofErr}</div>
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

          {/* RIGHT */}
          <div className="lg:col-span-2 space-y-4">
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
                  <div className="font-semibold text-zinc-900">Cliente</div>
                  <div className="mt-1">{active?.customerName || "—"}</div>
                  <div className="mt-1 text-zinc-500">
                    {active?.customerWhatsApp || "—"}
                  </div>

                  {active?.notifyWhatsAppOnPaid ? (
                    <div className="mt-2 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse" />
                      NOTIFICAÇÃO ATIVA NO PAGAMENTO
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs">
                  <div className="font-semibold text-zinc-900">Link</div>
                  <div className="mt-1 break-all">
                    {buildPublicUrl(active) || "—"}
                  </div>

                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    onClick={() => copyLink?.(active)}
                    disabled={!active?.publicToken}
                  >
                    {copiedId === active?._id ? "Copiado" : "Copiar link"}
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
                  <span className="font-semibold">{fmtDT(booking.endAt)}</span>
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
      )}
    </Modal>
  );
}
