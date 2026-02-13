// src/pages/Calendar.jsx
import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Badge from "../components/appui/Badge.jsx";
import Button from "../components/appui/Button.jsx";
import { Input } from "../components/appui/Input.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import { useEffect, useMemo, useState } from "react";
import { listBookings, cancelBooking } from "../app/bookingsApi.js";
import { useAuth } from "../app/AuthContext.jsx";
import { useNavigate } from "react-router-dom";

function safeDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function fmtTimeBR(iso) {
  const d = safeDate(iso);
  if (!d) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(d);
}

function fmtDateBR(iso) {
  const d = safeDate(iso);
  if (!d) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);
}

function holdRemaining(holdExpiresAt) {
  const d = safeDate(holdExpiresAt);
  if (!d) return null;
  const ms = d.getTime() - Date.now();
  const min = Math.floor(ms / 60000);
  if (min <= 0) return { label: "HOLD expirado", tone: "text-red-700" };
  if (min === 1) return { label: "Expira em 1 min", tone: "text-amber-900" };
  return { label: `Expira em ${min} min`, tone: "text-amber-900" };
}

export default function Calendar() {
  const nav = useNavigate();
  const { signOut } = useAuth();

  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [rangeMode, setRangeMode] = useState("day"); // "day" | "week"
  const [statusTab, setStatusTab] = useState("all"); // all | confirmed | hold
  const [q, setQ] = useState("");

  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);

  const { fromIso, toIso, title } = useMemo(() => {
    const start = new Date(`${day}T00:00:00`);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    if (rangeMode === "week") end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const fromIso = start.toISOString();
    const toIso = end.toISOString();

    const title =
      rangeMode === "week" ? `Semana de ${day} (7 dias)` : `Dia ${day}`;

    return { fromIso, toIso, title };
  }, [day, rangeMode]);

  const statusParam = useMemo(() => {
    if (statusTab === "confirmed") return "CONFIRMED";
    if (statusTab === "hold") return "HOLD";
    return "HOLD,CONFIRMED";
  }, [statusTab]);

  async function load() {
    try {
      setErr("");
      setBusy(true);
      const d = await listBookings({
        from: fromIso,
        to: toIso,
        status: statusParam,
      });
      setItems(d.items || []);
    } catch (e) {
      if (e?.status === 401) {
        signOut();
        nav(`/login?next=${encodeURIComponent("/calendar")}`, {
          replace: true,
        });
        return;
      }
      setErr(e?.message || "Falha ao carregar agenda.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromIso, toIso, statusParam]);

  function shiftDay(delta) {
    const base = new Date(`${day}T00:00:00`);
    base.setDate(base.getDate() + delta);
    setDay(base.toISOString().slice(0, 10));
  }

  const filtered = useMemo(() => {
    const term = String(q || "")
      .trim()
      .toLowerCase();
    if (!term) return items;

    return (items || []).filter((b) => {
      const a = String(b.customerName || "").toLowerCase();
      const t = String(b?.offer?.title || "").toLowerCase();
      const w = String(b.customerWhatsApp || "").toLowerCase();
      return a.includes(term) || t.includes(term) || w.includes(term);
    });
  }, [items, q]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const confirmed = filtered.filter(
      (b) => String(b.status).toUpperCase() === "CONFIRMED",
    ).length;
    const hold = filtered.filter(
      (b) => String(b.status).toUpperCase() === "HOLD",
    ).length;
    return { total, confirmed, hold };
  }, [filtered]);

  return (
    <Shell>
      <div className="space-y-4">
        <PageHeader
          title="Agenda"
          subtitle="Reservas do seu workspace (HOLD/CONFIRMED)."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => setDay(new Date().toISOString().slice(0, 10))}
              >
                Hoje
              </Button>
              <Button variant="secondary" onClick={() => shiftDay(-1)}>
                Dia anterior
              </Button>
              <Button variant="secondary" onClick={() => shiftDay(+1)}>
                Próximo dia
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  setDay(d.toISOString().slice(0, 10));
                }}
              >
                Amanhã
              </Button>
            </div>
          }
        />

        <Card>
          <CardHeader
            title={title}
            subtitle={`Total: ${summary.total} • Confirmados: ${summary.confirmed} • Reservas: ${summary.hold}`}
            right={
              <div className="flex items-center gap-2">
                <div className="w-44">
                  <Input
                    type="date"
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                  />
                </div>
                <Button
                  variant={rangeMode === "day" ? "secondary" : "ghost"}
                  type="button"
                  onClick={() => setRangeMode("day")}
                >
                  Dia
                </Button>
                <Button
                  variant={rangeMode === "week" ? "secondary" : "ghost"}
                  type="button"
                  onClick={() => setRangeMode("week")}
                >
                  7 dias
                </Button>
              </div>
            }
          />

          <CardBody className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={statusTab === "all" ? "secondary" : "ghost"}
                  onClick={() => setStatusTab("all")}
                >
                  Todos
                </Button>
                <Button
                  variant={statusTab === "confirmed" ? "secondary" : "ghost"}
                  onClick={() => setStatusTab("confirmed")}
                >
                  Confirmados
                </Button>
                <Button
                  variant={statusTab === "hold" ? "secondary" : "ghost"}
                  onClick={() => setStatusTab("hold")}
                >
                  Reservas
                </Button>

                <Button variant="secondary" onClick={load} disabled={busy}>
                  Atualizar
                </Button>
              </div>

              <div className="w-full sm:w-72">
                <Input
                  placeholder="Buscar por cliente ou serviço..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>

            {busy ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : err ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {err}{" "}
                <button className="ml-2 font-semibold underline" onClick={load}>
                  Tentar novamente
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title="Sem reservas no período"
                description="Quando houver agendamentos (HOLD/CONFIRMED), eles aparecerão aqui."
                ctaLabel="Ver propostas"
                onCta={() => nav("/")}
              />
            ) : (
              <div className="space-y-3">
                {filtered.map((b) => {
                  const st = String(b.status || "").toUpperCase();
                  const exp =
                    st === "HOLD" ? holdRemaining(b.holdExpiresAt) : null;
                  const offerTitle = b?.offer?.title || "—";
                  const publicToken = b?.offer?.publicToken || null;

                  return (
                    <div key={b._id} className="rounded-xl border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-zinc-900">
                              {fmtTimeBR(b.startAt)}–{fmtTimeBR(b.endAt)}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {fmtDateBR(b.startAt)}
                            </div>
                          </div>

                          <div className="mt-1 text-xs text-zinc-600">
                            Cliente:{" "}
                            <span className="font-medium">
                              {b.customerName || "—"}
                            </span>
                            {b.customerWhatsApp
                              ? ` • ${b.customerWhatsApp}`
                              : ""}
                          </div>

                          <div className="mt-0.5 text-xs text-zinc-500 line-clamp-1">
                            Serviço: {offerTitle}
                          </div>

                          {exp ? (
                            <div className={`mt-1 text-[11px] ${exp.tone}`}>
                              {exp.label}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          {/* sem children -> Badge traduz */}
                          <Badge tone={st} />

                          <div className="flex flex-wrap gap-2">
                            {publicToken ? (
                              <Button
                                variant="ghost"
                                type="button"
                                onClick={() =>
                                  window.open(
                                    `/p/${publicToken}`,
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
                                }
                              >
                                Abrir proposta
                              </Button>
                            ) : null}

                            <Button
                              variant="secondary"
                              type="button"
                              onClick={async () => {
                                const ok = window.confirm(
                                  "Cancelar esta reserva?",
                                );
                                if (!ok) return;
                                try {
                                  await cancelBooking(b._id);
                                  load();
                                } catch (e) {
                                  if (e?.status === 401) {
                                    signOut();
                                    nav(
                                      `/login?next=${encodeURIComponent(
                                        "/calendar",
                                      )}`,
                                      { replace: true },
                                    );
                                    return;
                                  }
                                  alert(e?.message || "Falha ao cancelar.");
                                }
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </Shell>
  );
}
