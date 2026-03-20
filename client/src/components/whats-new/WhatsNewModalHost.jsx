import { useCallback, useEffect, useState } from "react";
import { ArrowRight, BellRing, Clock3 } from "lucide-react";

import * as authApi from "../../app/authApi.js";
import { useAuth } from "../../app/AuthContext.jsx";
import useThemeToggle from "../../app/useThemeToggle.js";
import ModalShell from "../appui/ModalShell.jsx";
import Button from "../appui/Button.jsx";
import Badge from "../appui/Badge.jsx";
import { fmtDT, getPaymentLabel } from "../offers/offerHelpers.js";

const CHANGE_LABEL = {
  OFFER_ACCEPTED: "Proposta aceita",
  BOOKING_CREATED: "Agendamento criado",
  BOOKING_RESCHEDULED: "Reagendamento",
  BOOKING_CANCELLED: "Agendamento cancelado",
  PAYMENT_PROOF_SUBMITTED: "Aguardando confirmacao",
  PAYMENT_CONFIRMED: "Pagamento confirmado",
  PAYMENT_REJECTED: "Comprovante recusado",
};

function normalizeItems(items) {
  return Array.isArray(items) ? items.filter(Boolean) : [];
}

function formatChangeText(change) {
  const type = String(change?.type || "").trim().toUpperCase();
  const message = String(change?.message || "").trim();
  const fallback = CHANGE_LABEL[type] || "Atualizacao registrada";

  if (type === "BOOKING_RESCHEDULED" && message) {
    return `Reagendamento: ${message}`;
  }

  if (type === "BOOKING_CREATED") {
    const startAt = change?.meta?.startAt;
    if (startAt) return `Agendamento criado para ${fmtDT(startAt)}`;
  }

  return message ? `${fallback}: ${message}` : fallback;
}

export default function WhatsNewModalHost() {
  const { user, loadingMe } = useAuth();
  const { isDark } = useThemeToggle();

  const [open, setOpen] = useState(false);
  const [ackBusy, setAckBusy] = useState(false);
  const [snapshotAt, setSnapshotAt] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const userId = String(user?._id || "").trim();

  useEffect(() => {
    if (loadingMe) return;

    if (!userId) {
      setOpen(false);
      setSnapshotAt("");
      setItems([]);
      setError("");
      return;
    }

    let alive = true;

    (async () => {
      try {
        const data = await authApi.getWhatsNew();
        if (!alive) return;

        const nextItems = normalizeItems(data?.items);
        setSnapshotAt(String(data?.snapshotAt || ""));
        setItems(nextItems);
        setError("");
        setOpen(nextItems.length > 0);
      } catch (err) {
        if (!alive) return;
        console.warn("[whats-new] failed to load", err);
        setOpen(false);
        setSnapshotAt("");
        setItems([]);
        setError("");
      }
    })();

    return () => {
      alive = false;
    };
  }, [loadingMe, userId]);

  const acknowledge = useCallback(
    async (afterAck) => {
      if (ackBusy) return;

      try {
        setAckBusy(true);
        setError("");

        if (snapshotAt) {
          await authApi.ackWhatsNew({ seenAt: snapshotAt });
        }

        setOpen(false);
        setItems([]);
        setSnapshotAt("");

        if (typeof afterAck === "function") {
          afterAck();
        }
      } catch (err) {
        setError(
          err?.message || "Nao foi possivel confirmar a leitura agora.",
        );
      } finally {
        setAckBusy(false);
      }
    },
    [ackBusy, snapshotAt],
  );

  const handleGoToOffers = useCallback(() => {
    acknowledge(() => {
      if (typeof window === "undefined") return;
      if (window.location.pathname === "/offers") return;
      window.location.assign("/offers");
    });
  }, [acknowledge]);

  if (!open || !items.length) return null;

  return (
    <ModalShell
      open={open}
      onClose={() => acknowledge()}
      locked={ackBusy}
      panelClassName="max-w-5xl"
    >
      <div
        className={[
          "overflow-hidden rounded-[32px] border shadow-[0_32px_80px_-42px_rgba(15,23,42,0.45)]",
          isDark
            ? "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(9,15,28,0.95))]"
            : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.95))]",
        ].join(" ")}
      >
        <div
          className={[
            "border-b px-6 py-5",
            isDark
              ? "border-white/10 bg-[linear-gradient(135deg,rgba(34,211,238,0.12),rgba(37,99,235,0.08))]"
              : "border-slate-200/80 bg-[linear-gradient(135deg,rgba(239,246,255,0.92),rgba(236,253,245,0.9))]",
          ].join(" ")}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div
                  className={[
                    "flex h-11 w-11 items-center justify-center rounded-2xl border",
                    isDark
                      ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
                      : "border-sky-200 bg-sky-50 text-sky-700",
                  ].join(" ")}
                >
                  <BellRing className="h-5 w-5" />
                </div>
                <div>
                  <div
                    className={[
                      "text-xs font-bold uppercase tracking-[0.22em]",
                      isDark ? "text-cyan-200" : "text-sky-700",
                    ].join(" ")}
                  >
                    O que mudou
                  </div>
                  <h2
                    className={[
                      "mt-1 text-2xl font-black tracking-tight",
                      isDark ? "text-white" : "text-slate-950",
                    ].join(" ")}
                  >
                    Atualizacoes desde a sua ultima visualizacao
                  </h2>
                </div>
              </div>

              <p
                className={[
                  "mt-4 max-w-2xl text-sm leading-6",
                  isDark ? "text-slate-300" : "text-slate-600",
                ].join(" ")}
              >
                Aqui estao as propostas e agendamentos que tiveram mudancas
                enquanto voce estava fora.
              </p>
            </div>

            <div
              className={[
                "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold",
                isDark
                  ? "border-white/10 bg-white/5 text-slate-200"
                  : "border-slate-200 bg-white text-slate-700",
              ].join(" ")}
            >
              <Clock3 className="h-4 w-4" />
              Snapshot: {fmtDT(snapshotAt)}
            </div>
          </div>
        </div>

        <div className="max-h-[68vh] overflow-y-auto px-6 py-5">
          {error ? (
            <div
              className={[
                "mb-4 rounded-2xl border px-4 py-3 text-sm",
                isDark
                  ? "border-red-400/20 bg-red-400/10 text-red-100"
                  : "border-red-200 bg-red-50 text-red-700",
              ].join(" ")}
            >
              {error}
            </div>
          ) : null}

          <div className="space-y-4">
            {items.map((item) => {
              const pay = getPaymentLabel(item);
              const latest = item?.latestChange || null;
              const changes = normalizeItems(item?.changes);

              return (
                <div
                  key={item.offerId}
                  className={[
                    "rounded-[28px] border p-5",
                    isDark
                      ? "border-white/10 bg-white/5"
                      : "border-slate-200/80 bg-white/90",
                  ].join(" ")}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={[
                            "truncate text-lg font-black tracking-tight",
                            isDark ? "text-white" : "text-slate-950",
                          ].join(" ")}
                        >
                          {item.offerTitle || "Proposta"}
                        </h3>
                        <Badge tone={pay.tone}>{pay.text}</Badge>
                      </div>

                      <div
                        className={[
                          "mt-1 text-sm",
                          isDark ? "text-slate-300" : "text-slate-600",
                        ].join(" ")}
                      >
                        {item.customerName || "Cliente"}
                      </div>

                      {latest ? (
                        <div
                          className={[
                            "mt-3 inline-flex max-w-full items-center gap-2 rounded-2xl border px-3 py-2 text-sm",
                            isDark
                              ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
                              : "border-sky-200 bg-sky-50 text-sky-800",
                          ].join(" ")}
                        >
                          <span className="font-semibold">Mais recente:</span>
                          <span className="truncate">
                            {formatChangeText(latest)}
                          </span>
                          <span
                            className={[
                              "text-xs",
                              isDark ? "text-cyan-200/80" : "text-sky-700/80",
                            ].join(" ")}
                          >
                            {fmtDT(latest.occurredAt)}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={handleGoToOffers}
                        disabled={ackBusy}
                      >
                        Ver propostas
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {changes.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {changes.map((change, index) => (
                        <div
                          key={`${item.offerId}:${change.type}:${change.occurredAt}:${index}`}
                          className={[
                            "rounded-2xl border px-3 py-3 text-sm",
                            isDark
                              ? "border-white/10 bg-[rgba(15,23,42,0.55)] text-slate-200"
                              : "border-slate-200 bg-slate-50/80 text-slate-700",
                          ].join(" ")}
                        >
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div className="font-medium">
                              {formatChangeText(change)}
                            </div>
                            <div
                              className={[
                                "text-xs",
                                isDark ? "text-slate-400" : "text-slate-500",
                              ].join(" ")}
                            >
                              {fmtDT(change.occurredAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div
          className={[
            "flex flex-col gap-3 border-t px-6 py-5 sm:flex-row sm:items-center sm:justify-end",
            isDark
              ? "border-white/10 bg-white/5"
              : "border-slate-200/80 bg-slate-50/80",
          ].join(" ")}
        >
          <Button
            variant="secondary"
            onClick={handleGoToOffers}
            disabled={ackBusy}
          >
            Ver propostas
          </Button>
          <Button onClick={() => acknowledge()} disabled={ackBusy}>
            {ackBusy ? "Salvando..." : "Entendi"}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
