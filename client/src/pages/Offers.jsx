// src/pages/Offers.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../app/api.js";

import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import { Input } from "../components/appui/Input.jsx";
import Badge from "../components/appui/Badge.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";

function norm(s) {
  const v = String(s || "")
    .trim()
    .toUpperCase();
  if (!v) return "";
  return v === "CANCELED" ? "CANCELLED" : v;
}

function fmtBRLFromCents(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents) || 0) / 100);
}

function getAmountCents(o) {
  return Number(o?.totalCents ?? o?.amountCents ?? 0) || 0;
}

function getPaymentLabel(o) {
  const pay = norm(o?.paymentStatus);
  const flow = norm(o?.status || "PUBLIC");
  const paid =
    ["PAID", "CONFIRMED"].includes(pay) || ["PAID", "CONFIRMED"].includes(flow);

  if (paid) return { tone: "PAID", text: "Pago (confirmado)", code: "PAID" };
  if (pay === "WAITING_CONFIRMATION")
    return {
      tone: "PENDING",
      text: "Aguardando confirmação",
      code: "WAITING_CONFIRMATION",
    };
  if (pay === "REJECTED")
    return {
      tone: "CANCELLED",
      text: "Comprovante recusado",
      code: "REJECTED",
    };
  if (pay === "PENDING" || !pay)
    return { tone: "PENDING", text: "Aguardando pagamento", code: "PENDING" };

  const map = {
    PUBLIC: { tone: "PUBLIC", text: "Público" },
    ACCEPTED: { tone: "ACCEPTED", text: "Aceito" },
    EXPIRED: { tone: "EXPIRED", text: "Expirado" },
    CANCELLED: { tone: "CANCELLED", text: "Cancelado" },
  };

  return (
    map[flow] || {
      tone: flow || "PUBLIC",
      text: flow || "PUBLIC",
      code: flow || "PUBLIC",
    }
  );
}

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

function inferExtFromMime(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("pdf")) return ".pdf";
  if (m.includes("png")) return ".png";
  if (m.includes("jpeg") || m.includes("jpg")) return ".jpg";
  return "";
}

function safeFileName(name, mime) {
  const ext = inferExtFromMime(mime);
  let base = String(name || "comprovante").trim();
  base = base.replace(/[\\\/:*?"<>|]+/g, "-").trim();
  if (!base) base = "comprovante";
  if (ext && !base.toLowerCase().endsWith(ext)) base += ext;
  return base;
}

function downloadBase64File(base64, mime, filename) {
  const b64 = String(base64 || "").trim();
  if (!b64) throw new Error("Comprovante vazio.");

  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime || "application/octet-stream" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "comprovante";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
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

function fmtDT(iso) {
  try {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return "—";
  }
}

export default function Offers() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [copiedId, setCopiedId] = useState(null);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [activeBusy, setActiveBusy] = useState(false);
  const [activeErr, setActiveErr] = useState("");

  const [pageFlash, setPageFlash] = useState(null); // { kind, text }
  const [modalFlash, setModalFlash] = useState(null); // { kind, text }

  const [proofBusy, setProofBusy] = useState(false);
  const [proofErr, setProofErr] = useState("");
  const [proofDataUrl, setProofDataUrl] = useState("");
  const [proofMime, setProofMime] = useState("");

  const [actionBusy, setActionBusy] = useState(false);

  const patchOfferInList = useCallback((updated) => {
    if (!updated?._id) return;
    setItems((prev) =>
      (prev || []).map((it) =>
        it?._id === updated._id ? { ...it, ...updated } : it,
      ),
    );
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const d = await api("/offers");
      setItems(d?.items || []);
    } catch (e) {
      setError(e?.message || "Falha ao carregar propostas.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    const base =
      filter === "ALL"
        ? items
        : (items || []).filter((o) => {
            const pay = norm(o?.paymentStatus);
            const flow = norm(o?.status || "PUBLIC");
            const paid =
              ["PAID", "CONFIRMED"].includes(pay) ||
              ["PAID", "CONFIRMED"].includes(flow);

            if (filter === "PAID") return paid;
            if (
              ["PENDING", "WAITING_CONFIRMATION", "REJECTED"].includes(filter)
            )
              return pay === filter;

            return flow === filter;
          });

    if (!query) return base;

    return base.filter((o) => {
      const a = String(o?.customerName || "").toLowerCase();
      const b = String(o?.title || "").toLowerCase();
      return a.includes(query) || b.includes(query);
    });
  }, [items, q, filter]);

  const copyLink = useCallback(async (offer) => {
    const token = offer?.publicToken;
    if (!token) return;

    const url = `${window.location.origin}/p/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(offer._id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      // silencioso
    }
  }, []);

  const fetchDetails = useCallback(async (offerId) => {
    const d = await api(`/offers/${offerId}`);
    if (!d?.ok && d?.ok !== undefined)
      throw new Error(d?.error || "Falha ao carregar detalhes.");
    const full = d?.offer || null;
    const booking = d?.booking || null;
    return { full, booking };
  }, []);

  const openDetails = useCallback(
    async (offer) => {
      setOpen(true);
      setActive(offer || null);
      setActiveErr("");
      setModalFlash(null);

      setProofErr("");
      setProofDataUrl("");
      setProofMime("");

      if (!offer?._id) return;

      setActiveBusy(true);
      try {
        const { full, booking } = await fetchDetails(offer._id);
        setActive({ ...(offer || {}), ...(full || {}), booking });
      } catch (e) {
        setActiveErr(e?.message || "Falha ao carregar detalhes.");
      } finally {
        setActiveBusy(false);
      }
    },
    [fetchDetails],
  );

  const refreshActive = useCallback(async () => {
    if (!active?._id) return;
    try {
      setActiveBusy(true);
      setActiveErr("");
      const { full, booking } = await fetchDetails(active._id);
      setActive((prev) => ({ ...(prev || {}), ...(full || {}), booking }));
      patchOfferInList(full);
    } catch (e) {
      setActiveErr(e?.message || "Falha ao atualizar detalhes.");
    } finally {
      setActiveBusy(false);
    }
  }, [active?._id, fetchDetails, patchOfferInList]);

  const loadProof = useCallback(async () => {
    if (!active?._id) return;
    try {
      setProofErr("");
      setProofBusy(true);

      const d = await api(`/offers/${active._id}/payment-proof?inline=1`);
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
  }, [active?._id]);

  const downloadProof = useCallback(async () => {
    if (!active?._id) return;
    try {
      setProofErr("");
      setProofBusy(true);

      const d = await api(`/offers/${active._id}/payment-proof?inline=1`);
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
  }, [active?._id, active?.paymentProof?.originalName]);

  const confirmPayment = useCallback(async () => {
    if (!active?._id) return;
    if (!window.confirm("Confirmar recebimento deste pagamento?")) return;

    try {
      setModalFlash(null);
      setProofErr("");
      setActionBusy(true);

      const d = await api(`/offers/${active._id}/confirm-payment`, {
        method: "POST", // ou PATCH (o backend aceita ambos)
      });
      if (!d?.ok) throw new Error(d?.error || "Falha ao confirmar pagamento.");

      const updated = d?.offer || null;
      if (updated?._id) {
        setActive((prev) => ({ ...(prev || {}), ...(updated || {}) }));
        patchOfferInList(updated);
      } else {
        await load();
      }

      const n = d?.notify;

      if (n?.status === "SENT") {
        setModalFlash({
          kind: "success",
          text: "Pagamento confirmado e WhatsApp enviado ao cliente.",
        });
      } else if (n?.status === "FAILED") {
        setModalFlash({
          kind: "error",
          text: "Pagamento confirmado, mas o envio do WhatsApp falhou. Verifique logs/MessageLog.",
        });
      } else if (n?.status === "SKIPPED") {
        const reason = n?.reason ? ` (${n.reason})` : "";
        setModalFlash({
          kind: "info",
          text: `Pagamento confirmado. Notificação não enviada${reason}.`,
        });
      } else {
        setModalFlash({
          kind: "success",
          text: "Pagamento confirmado com sucesso.",
        });
      }

      // atualiza detalhes completos (inclui booking e status consistentes)
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
  }, [active?._id, load, patchOfferInList, refreshActive]);

  const rejectPayment = useCallback(async () => {
    if (!active?._id) return;

    const reason = window.prompt(
      "Motivo da recusa:",
      "Comprovante inválido ou ilegível",
    );
    if (reason === null) return;

    try {
      setModalFlash(null);
      setProofErr("");
      setActionBusy(true);

      const d = await api(`/offers/${active._id}/reject-payment`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      if (!d?.ok) throw new Error(d?.error || "Falha ao recusar comprovante.");

      const updated = d?.offer || null;
      if (updated?._id) {
        setActive((prev) => ({ ...(prev || {}), ...(updated || {}) }));
        patchOfferInList(updated);
      } else {
        await load();
      }

      setModalFlash({
        kind: "success",
        text: "Comprovante recusado com sucesso.",
      });

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
  }, [active?._id, load, patchOfferInList, refreshActive]);

  const activePay = useMemo(() => getPaymentLabel(active), [active]);
  const activeHasProof = !!active?.paymentProof?.storage?.key;
  const activeWaiting = norm(active?.paymentStatus) === "WAITING_CONFIRMATION";
  const activePaid = activePay?.tone === "PAID";

  const canModerateProof = activeHasProof && activeWaiting && !activePaid;

  return (
    <Shell>
      <div className="space-y-6">
        <PageHeader
          title="Propostas"
          subtitle="Gerencie propostas e confirmações de pagamento."
          right={
            <Link to="/offers/new">
              <Button>Nova proposta</Button>
            </Link>
          }
        />

        {pageFlash?.text ? (
          <AlertInline kind={pageFlash.kind}>{pageFlash.text}</AlertInline>
        ) : null}

        <Card>
          <CardBody className="p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-2">
                <select
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="ALL">Todos</option>
                  <option value="WAITING_CONFIRMATION">
                    Aguardando confirmação
                  </option>
                  <option value="PENDING">Aguardando pagamento</option>
                  <option value="REJECTED">Comprovante recusado</option>
                  <option value="PAID">Pago (confirmado)</option>
                  <option value="ACCEPTED">Aceito</option>
                  <option value="PUBLIC">Público</option>
                  <option value="EXPIRED">Expirado</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>

                <div className="w-full md:w-80">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar cliente ou proposta…"
                    className="h-10"
                  />
                </div>
              </div>

              <Button variant="secondary" onClick={load} disabled={loading}>
                Atualizar
              </Button>
            </div>

            {loading ? (
              <div className="mt-5 space-y-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ) : error ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="mt-8">
                <EmptyState
                  title="Nenhuma proposta"
                  description="Ajuste filtros ou crie uma nova."
                  ctaLabel="Criar proposta"
                  onCta={() => (window.location.href = "/offers/new")}
                />
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-zinc-400">
                    <tr>
                      <th className="border-b border-zinc-100 py-3 pr-4">
                        Cliente
                      </th>
                      <th className="border-b border-zinc-100 py-3 pr-4">
                        Proposta
                      </th>
                      <th className="border-b border-zinc-100 py-3 pr-4">
                        Valor
                      </th>
                      <th className="border-b border-zinc-100 py-3 pr-4">
                        Status
                      </th>
                      <th className="border-b border-zinc-100 py-3 text-right">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filtered.map((o) => {
                      const pay = getPaymentLabel(o);
                      const publicUrl = `/p/${o.publicToken}`;
                      const copied = copiedId === o._id;

                      return (
                        <tr key={o._id} className="hover:bg-zinc-50/50">
                          <td className="py-3 pr-4">
                            <div className="font-semibold text-zinc-900">
                              {o.customerName || "—"}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {o.customerWhatsApp || "—"}
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="text-zinc-900">
                              {o.title || "Proposta"}
                            </div>
                            <div className="text-xs text-zinc-500 line-clamp-1">
                              {o.description || ""}
                            </div>
                          </td>
                          <td className="py-3 pr-4 font-semibold text-zinc-900 tabular-nums">
                            {fmtBRLFromCents(getAmountCents(o))}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <Badge tone={pay.tone}>{pay.text}</Badge>
                              {o?.notifyWhatsAppOnPaid ? (
                                <span className="text-[10px] font-bold text-emerald-700 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1">
                                  WA ON
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant={copied ? "primary" : "secondary"}
                                size="sm"
                                onClick={() => copyLink(o)}
                              >
                                {copied ? "Copiado" : "Copiar link"}
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  window.open(
                                    publicUrl,
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
                                }
                              >
                                Abrir
                              </Button>

                              <Button size="sm" onClick={() => openDetails(o)}>
                                Detalhes
                              </Button>
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

        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title={
            active?.customerName
              ? `Detalhes • ${active.customerName}`
              : "Detalhes"
          }
          footer={
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-zinc-500">
                ID:{" "}
                <span className="font-mono text-zinc-700">
                  {active?._id || "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Fechar
                </Button>
                {active?.publicToken && (
                  <Button
                    onClick={() =>
                      window.open(`/p/${active.publicToken}`, "_blank")
                    }
                  >
                    Abrir link público
                  </Button>
                )}
              </div>
            </div>
          }
        >
          {modalFlash?.text ? (
            <div className="mb-4">
              <AlertInline kind={modalFlash.kind}>
                {modalFlash.text}
              </AlertInline>
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
                              onClick={rejectPayment}
                            >
                              Recusar
                            </Button>
                          </>
                        ) : null}
                      </div>

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
                        {window.location.origin}/p/{active?.publicToken}
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-2"
                        onClick={() => copyLink(active)}
                      >
                        {copiedId === active?._id ? "Copiado" : "Copiar link"}
                      </Button>
                    </div>
                  </div>
                </div>

                {active?.booking ? (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
                    <div className="text-[11px] font-bold uppercase text-zinc-500">
                      Agendamento
                    </div>
                    <div className="mt-2">
                      Início:{" "}
                      <span className="font-semibold">
                        {fmtDT(active.booking.startAt)}
                      </span>
                    </div>
                    <div>
                      Fim:{" "}
                      <span className="font-semibold">
                        {fmtDT(active.booking.endAt)}
                      </span>
                    </div>
                    <div className="mt-2">
                      <Badge tone={norm(active.booking.status)}>
                        {norm(active.booking.status) || "—"}
                      </Badge>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </Modal>
      </div>
    </Shell>
  );
}
//teste
