// src/pages/Dashboard.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Shell from "../components/layout/Shell.jsx";
import { api } from "../app/api.js";
import { listBookings } from "../app/bookingsApi.js";
import { listWithdraws } from "../app/withdrawApi.js";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import Badge from "../components/appui/Badge.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import { useAuth } from "../app/AuthContext.jsx";
import WithdrawModal from "../components/WithdrawModal.jsx";

/** ========= ICON COMPONENTS (SVG INLINE) ========= */
const Icons = {
  Refresh: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  ),
  Withdraw: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  ),
  Plus: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  ),
  Copy: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  ),
  External: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  ),
  TrendUp: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-emerald-500"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  Users: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-blue-500"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Calendar: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-amber-500"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  ),
  Wallet: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-indigo-500"
    >
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  ),
};

/** ========= HELPERS ========= */
const normStatus = (s) =>
  String(s || "")
    .trim()
    .toUpperCase();
const fmtBRL = (cents) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (cents || 0) / 100,
  );
const fmtDateTimeBR = (iso) =>
  iso ? new Date(iso).toLocaleString("pt-BR") : "";
const fmtTimeBR = (iso) =>
  iso
    ? new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(
        new Date(iso),
      )
    : "";
const safeDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const isSameLocalDay = (a, b) =>
  a &&
  b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

function holdRemainingLabel(holdExpiresAt) {
  const d = safeDate(holdExpiresAt);
  if (!d) return null;
  const ms = d.getTime() - Date.now();
  const min = Math.floor(ms / 60000);
  return min <= 0 ? "HOLD expirado" : `Expira em ${min} min`;
}

function pixToneClasses(st) {
  const s = normStatus(st);
  if (["EXPIRED", "CANCELLED", "CANCELED"].includes(s))
    return "text-red-600 bg-red-50";
  if (s === "PAID") return "text-emerald-700 bg-emerald-50";
  if (s === "PENDING") return "text-amber-700 bg-amber-50";
  return "text-zinc-500 bg-zinc-50";
}

/** ========= SUB-COMPONENTS ========= */
function StatCard({ label, value, meta, icon: Icon, loading }) {
  return (
    <Card className="overflow-hidden border-none shadow-sm ring-1 ring-zinc-200">
      <CardBody className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            {label}
          </span>
          {Icon && (
            <div className="p-2 bg-zinc-50 rounded-lg">
              <Icon />
            </div>
          )}
        </div>
        <div className="mt-3">
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <div className="text-2xl font-bold text-zinc-900 tracking-tight">
              {value}
            </div>
          )}
        </div>
        <div className="mt-1 text-xs text-zinc-400 font-medium truncate">
          {meta}
        </div>
      </CardBody>
    </Card>
  );
}

function Toast({ message, visible }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-zinc-900 text-white text-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
        <Icons.Copy /> {message}
      </div>
    </div>
  );
}

/** ========= MAIN DASHBOARD ========= */
export default function Dashboard() {
  const [offers, setOffers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [withdraws, setWithdraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingsBusy, setBookingsBusy] = useState(true);
  const [withdrawsBusy, setWithdrawsBusy] = useState(true);
  const [error, setError] = useState("");
  const [bookingsErr, setBookingsErr] = useState("");
  const [withdrawsErr, setWithdrawsErr] = useState("");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("");

  const nav = useNavigate();
  const { signOut } = useAuth();
  const toastTimerRef = useRef(null);

  const handleCopy = async (url) => {
    try {
      await navigator.clipboard.writeText(window.location.origin + url);
      setShowToast(true);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setShowToast(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  async function loadBookings() {
    try {
      setBookingsBusy(true);
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);
      const d = await listBookings({
        from: from.toISOString(),
        to: to.toISOString(),
        status: "HOLD,CONFIRMED",
      });
      setBookings(d.items || []);
    } catch (e) {
      if (e?.status === 401) return signOut();
      setBookingsErr("Erro na agenda.");
    } finally {
      setBookingsBusy(false);
    }
  }

  async function loadWithdraws() {
    try {
      setWithdrawsBusy(true);
      const d = await listWithdraws({ limit: 5 });
      setWithdraws(d.items || []);
    } catch (e) {
      if (e?.status === 401) return signOut();
      setWithdrawsErr("Erro nos saques.");
    } finally {
      setWithdrawsBusy(false);
    }
  }

  async function load() {
    try {
      setLoading(true);
      setError("");
      const d = await api("/offers");
      setOffers(d.items || []);
      setLastUpdate(
        new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(
          new Date(),
        ),
      );
      loadBookings();
      loadWithdraws();
    } catch (e) {
      if (e?.status === 401) return signOut();
      setError("Falha ao carregar dados principais.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const kpis = useMemo(() => {
    const total = offers.length;
    const totalValue = offers.reduce((acc, o) => acc + (o.amountCents || 0), 0);
    const paidOffers = offers.filter((o) =>
      ["PAID", "CONFIRMED"].includes(normStatus(o.status)),
    );
    const bookedCount = offers.filter(
      (o) =>
        o.bookingId ||
        ["HOLD", "CONFIRMED", "PAID"].includes(normStatus(o.status)),
    ).length;

    const now = new Date();
    const paidToday = paidOffers.filter((o) =>
      isSameLocalDay(safeDate(o.paidAt) || safeDate(o.updatedAt), now),
    );
    const paidTodayValue = paidToday.reduce(
      (acc, o) => acc + (o.amountCents || o.totalCents || 0),
      0,
    );

    return {
      total,
      totalValue,
      paidCount: paidOffers.length,
      bookedCount,
      conversion: total > 0 ? Math.round((paidOffers.length / total) * 100) : 0,
      paidTodayCount: paidToday.length,
      paidTodayValue,
      last5: offers.slice(0, 5),
    };
  }, [offers]);

  return (
    <Shell>
      <div className="max-w-[1400px] mx-auto space-y-8 pb-12">
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight transition-all">
              Dashboard
            </h1>
            <p className="text-zinc-500 text-sm max-w-md">
              Bem-vindo de volta. Aqui está um resumo da sua operação hoje.
            </p>
            {lastUpdate && (
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest pt-1">
                Última atualização: {lastUpdate}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={load}
              disabled={loading}
              className="hidden sm:flex items-center gap-2"
            >
              <Icons.Refresh /> Atualizar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setWithdrawOpen(true)}
              className="flex items-center gap-2"
            >
              <Icons.Withdraw /> Saque
            </Button>
            <Link to="/offers/new">
              <Button
                size="sm"
                className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 shadow-sm transition-all active:scale-95"
              >
                <Icons.Plus /> Nova proposta
              </Button>
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={load} className="font-bold underline">
              Tentar de novo
            </button>
          </div>
        )}

        {/* KPI GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Propostas"
            value={kpis.total}
            meta="Emitidas no total"
            icon={Icons.TrendUp}
            loading={loading}
          />
          <StatCard
            label="Volume"
            value={fmtBRL(kpis.totalValue)}
            meta="Valor bruto gerado"
            icon={Icons.Wallet}
            loading={loading}
          />
          <StatCard
            label="Conversão"
            value={`${kpis.conversion}%`}
            meta={`${kpis.paidCount} pagas`}
            icon={Icons.TrendUp}
            loading={loading}
          />
          <StatCard
            label="Agendamentos"
            value={kpis.bookedCount}
            meta="Reservas ativas"
            icon={Icons.Calendar}
            loading={loading}
          />
          <StatCard
            label="Vendas Hoje"
            value={kpis.paidTodayCount}
            meta={`Total: ${fmtBRL(kpis.paidTodayValue)}`}
            icon={Icons.Users}
            loading={loading}
          />
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* MAIN COLUMN: RECENT LINKS */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <Card className="border-none shadow-sm ring-1 ring-zinc-200 overflow-hidden">
              <CardHeader
                title="Links Recentes"
                subtitle="Acompanhe o status e envie links rapidamente."
                right={
                  <Badge tone="neutral" className="opacity-70">
                    {offers.length} total
                  </Badge>
                }
              />
              <CardBody className="p-0">
                {loading ? (
                  <div className="p-6 space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-xl" />
                    ))}
                  </div>
                ) : offers.length === 0 ? (
                  <div className="py-12">
                    <EmptyState
                      title="Tudo limpo por aqui"
                      description="Comece criando sua primeira proposta comercial."
                      ctaLabel="Criar Proposta"
                      onCta={() => nav("/offers/new")}
                    />
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {kpis.last5.map((o) => {
                      const publicUrl = `/p/${o.publicToken}`;
                      const isPaid = ["PAID", "CONFIRMED"].includes(
                        normStatus(o.status),
                      );
                      const pixSt = normStatus(o?.payment?.lastPixStatus);

                      return (
                        <div
                          key={o._id}
                          className="group p-4 sm:p-5 hover:bg-zinc-50/50 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-bold text-zinc-900 truncate">
                                  {o.customerName}
                                </span>
                                <Badge tone={o.status || "PUBLIC"} size="xs" />
                              </div>
                              <h4 className="text-xs font-medium text-zinc-500 line-clamp-1 mb-2">
                                {o.title}
                              </h4>
                              {pixSt && (
                                <div
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${pixToneClasses(pixSt)}`}
                                >
                                  Pix: {pixSt}{" "}
                                  {o?.payment?.lastPixUpdatedAt &&
                                    `• ${fmtTimeBR(o.payment.lastPixUpdatedAt)}`}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-3 w-full sm:w-auto">
                              <span className="text-sm font-bold text-zinc-900">
                                {fmtBRL(o.amountCents || o.totalCents || 0)}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleCopy(publicUrl)}
                                  className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-white border border-transparent hover:border-zinc-200 rounded-lg transition-all"
                                  title="Copiar link"
                                >
                                  <Icons.Copy />
                                </button>
                                <button
                                  onClick={() =>
                                    window.open(publicUrl, "_blank")
                                  }
                                  className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-white border border-transparent hover:border-zinc-200 rounded-lg transition-all"
                                  title="Abrir página"
                                >
                                  <Icons.External />
                                </button>
                                {!isPaid && (
                                  <Button
                                    variant="secondary"
                                    size="xs"
                                    onClick={() =>
                                      window.open(`${publicUrl}/pay`, "_blank")
                                    }
                                  >
                                    Checkout
                                  </Button>
                                )}
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

          {/* SIDEBAR: AGENDA & WITHDRAWS */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* AGENDA */}
            <Card className="border-none shadow-sm ring-1 ring-zinc-200">
              <CardHeader
                title="Agenda Próxima"
                right={
                  <Link
                    to="/calendar"
                    className="text-[11px] font-bold text-indigo-600 hover:underline"
                  >
                    VER TUDO
                  </Link>
                }
              />
              <CardBody className="space-y-4">
                {bookingsBusy ? (
                  <Skeleton className="h-32 w-full rounded-xl" />
                ) : bookings.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-zinc-400 font-medium">
                      Sem compromissos em breve
                    </p>
                  </div>
                ) : (
                  bookings.slice(0, 3).map((b) => (
                    <div
                      key={b._id}
                      className="relative pl-4 border-l-2 border-zinc-100 hover:border-indigo-400 transition-colors py-1"
                    >
                      <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-tighter">
                        {fmtTimeBR(b.startAt)} — {fmtTimeBR(b.endAt)}
                      </div>
                      <div className="text-sm font-semibold text-zinc-900 truncate">
                        {b.customerName || "Cliente"}
                      </div>
                      <div className="text-[11px] text-zinc-500 line-clamp-1">
                        {b?.offer?.title}
                      </div>
                      {normStatus(b.status) === "HOLD" && (
                        <div className="mt-1 text-[10px] font-bold text-amber-600 italic">
                          {holdRemainingLabel(b.holdExpiresAt)}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardBody>
            </Card>

            {/* WITHDRAWS */}
            <Card className="border-none shadow-sm ring-1 ring-zinc-200">
              <CardHeader title="Últimos Saques" />
              <CardBody className="p-0">
                {withdrawsBusy ? (
                  <div className="p-5">
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : withdraws.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-xs text-zinc-400">
                      Nenhum saque realizado
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-50">
                    {withdraws.map((w) => (
                      <div
                        key={w.externalId}
                        className="p-4 flex justify-between items-center group"
                      >
                        <div>
                          <div className="text-sm font-bold text-zinc-900">
                            {fmtBRL(w.netAmountCents)}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
                            {fmtDateTimeBR(w.createdAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge tone={w.status} size="xs" />
                          {w.receiptUrl &&
                            normStatus(w.status) === "COMPLETE" && (
                              <button
                                onClick={() =>
                                  window.open(w.receiptUrl, "_blank")
                                }
                                className="p-1.5 text-zinc-400 hover:text-zinc-900 transition-colors"
                              >
                                <Icons.External />
                              </button>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* CAIXA EXPRESSO */}
            <div className="p-5 rounded-2xl bg-zinc-900 text-white shadow-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                  Caixa de Hoje
                </p>
                <div className="text-xl font-bold">
                  {loading ? "..." : fmtBRL(kpis.paidTodayValue)}
                </div>
              </div>
              <div className="h-10 w-10 bg-zinc-800 rounded-xl flex items-center justify-center">
                <Icons.Wallet />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Toast
        message="Link copiado para a área de transferência!"
        visible={showToast}
      />

      <WithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onCreated={() => loadWithdraws()}
      />
    </Shell>
  );
}
