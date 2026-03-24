import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  Database,
  Eye,
  MessageSquareText,
  RefreshCw,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";

import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import ModalShell from "../components/appui/ModalShell.jsx";
import { Input } from "../components/appui/Input.jsx";
import TenantDiagnosticsPanel from "../components/admin/TenantDiagnosticsPanel.jsx";
import WhatsAppGatewayMonitorPanel from "../components/admin/WhatsAppGatewayMonitorPanel.jsx";
import {
  getAdminOverview,
  getAdminServices,
  getAdminWhatsAppGatewayMonitor,
  getAdminTenantDiagnostics,
  listAdminClients,
  listAdminUsers,
  listAdminWhatsAppMessageLogs,
  listAdminWhatsAppOutbox,
  listAdminWorkspaces,
} from "../app/adminApi.js";
import useThemeToggle from "../app/useThemeToggle.js";

function useAsyncData(loader, deps, initialData = null) {
  const [state, setState] = useState({
    loading: true,
    data: initialData,
    error: "",
  });

  useEffect(() => {
    let active = true;

    setState((previous) => ({
      ...previous,
      loading: true,
      error: "",
    }));

    loader()
      .then((data) => {
        if (!active) return;
        setState({ loading: false, data, error: "" });
      })
      .catch((error) => {
        if (!active) return;
        setState((previous) => ({
          loading: false,
          data: previous.data,
          error: error?.message || "Falha ao carregar.",
        }));
      });

    return () => {
      active = false;
    };
  }, deps);

  return state;
}

function useManualRefreshFeedback(loading) {
  const [state, setState] = useState({
    active: false,
    started: false,
  });

  useEffect(() => {
    if (!state.active) return;

    if (!state.started) {
      if (loading) {
        setState((current) =>
          current.active && !current.started
            ? { active: true, started: true }
            : current,
        );
      }
      return;
    }

    if (!loading) {
      setState((current) =>
        current.active ? { active: false, started: false } : current,
      );
    }
  }, [loading, state.active, state.started]);

  const begin = useCallback(() => {
    setState({ active: true, started: false });
  }, []);

  return [state.active, begin];
}

function fmtNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function fmtDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function fmtRelativeLike(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 60) {
    return diffMin >= 0 ? `em ${diffMin} min` : `${Math.abs(diffMin)} min atras`;
  }
  const diffHours = Math.round(diffMs / 3600000);
  if (Math.abs(diffHours) < 24) {
    return diffHours >= 0 ? `em ${diffHours} h` : `${Math.abs(diffHours)} h atras`;
  }
  const diffDays = Math.round(diffMs / 86400000);
  return diffDays >= 0 ? `em ${diffDays} dias` : `${Math.abs(diffDays)} dias atras`;
}

function pickDeliveryMoment(value = {}) {
  return (
    value?.playedAt ||
    value?.readAt ||
    value?.deliveredAt ||
    value?.deliveryLastAckAt ||
    null
  );
}

function deliveryLabel(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (!normalized) return "Aguardando confirmacao";
  if (normalized === "PENDING") return "Aguardando confirmacao";
  return statusLabel(normalized);
}

function statusLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Desconhecido";
  const normalized = raw.toUpperCase();

  const labels = {
    HEALTHY: "Healthy",
    WARNING: "Warning",
    DOWN: "Down",
    READY: "Ready",
    CONNECTED: "Connected",
    QUEUED: "Queued",
    PROCESSING: "Processing",
    SENT: "Sent",
    FAILED: "Failed",
    CANCELLED: "Cancelled",
    PENDING: "Pending",
    SKIPPED: "Skipped",
    ACTIVE: "Active",
    INACTIVE: "Inactive",
    PAST_DUE: "Past due",
    OWNER: "Owner",
    MEMBER: "Member",
    DISABLED: "Disabled",
    SERVER: "Enviado ao WhatsApp",
    DEVICE: "Entregue ao aparelho",
    READ: "Lido",
    PLAYED: "Reproduzido",
    ERROR: "Erro de entrega",
  };

  return labels[normalized] || raw;
}

function SectionHeading({ id, eyebrow, title, description }) {
  const { isDark } = useThemeToggle();

  return (
    <div id={id} className="space-y-2">
      <div
        className={`text-[11px] font-bold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}
      >
        {eyebrow}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            className={`text-2xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-950"}`}
          >
            {title}
          </h2>
          {description ? (
            <p
              className={`mt-1 text-sm leading-6 ${isDark ? "text-slate-300" : "text-slate-600"}`}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, children }) {
  const { isDark } = useThemeToggle();
  const normalized = String(status || "").trim().toLowerCase();

  const palette = {
    healthy: isDark
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: isDark
      ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
      : "border-amber-200 bg-amber-50 text-amber-700",
    down: isDark
      ? "border-red-400/20 bg-red-400/10 text-red-200"
      : "border-red-200 bg-red-50 text-red-700",
    sent: isDark
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : "border-emerald-200 bg-emerald-50 text-emerald-700",
    queued: isDark
      ? "border-sky-400/20 bg-sky-400/10 text-sky-200"
      : "border-sky-200 bg-sky-50 text-sky-700",
    processing: isDark
      ? "border-indigo-400/20 bg-indigo-400/10 text-indigo-200"
      : "border-indigo-200 bg-indigo-50 text-indigo-700",
    server: isDark
      ? "border-sky-400/20 bg-sky-400/10 text-sky-200"
      : "border-sky-200 bg-sky-50 text-sky-700",
    device: isDark
      ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
      : "border-cyan-200 bg-cyan-50 text-cyan-700",
    read: isDark
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : "border-emerald-200 bg-emerald-50 text-emerald-700",
    played: isDark
      ? "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200"
      : "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
    error: isDark
      ? "border-red-400/20 bg-red-400/10 text-red-200"
      : "border-red-200 bg-red-50 text-red-700",
    failed: isDark
      ? "border-red-400/20 bg-red-400/10 text-red-200"
      : "border-red-200 bg-red-50 text-red-700",
    pending: isDark
      ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
      : "border-amber-200 bg-amber-50 text-amber-700",
    skipped: isDark
      ? "border-white/10 bg-white/6 text-slate-300"
      : "border-slate-200 bg-slate-50 text-slate-600",
    active: isDark
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : "border-emerald-200 bg-emerald-50 text-emerald-700",
    inactive: isDark
      ? "border-white/10 bg-white/6 text-slate-300"
      : "border-slate-200 bg-slate-50 text-slate-600",
    past_due: isDark
      ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
      : "border-amber-200 bg-amber-50 text-amber-700",
  };

  const classes =
    palette[normalized] ||
    (isDark
      ? "border-white/10 bg-white/6 text-slate-300"
      : "border-slate-200 bg-slate-50 text-slate-600");

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${classes}`}>
      {children || statusLabel(status)}
    </span>
  );
}

function MetricCard({ icon: Icon, title, value, subtitle, status = "healthy" }) {
  const { isDark } = useThemeToggle();

  return (
    <Card className="overflow-hidden">
      <CardBody className="space-y-3.5">
        <div className="flex items-start justify-between gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${isDark ? "bg-white/10 text-white" : "bg-white text-slate-800 shadow-[0_16px_30px_-22px_rgba(15,23,42,0.24)]"}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <StatusBadge status={status} />
        </div>
        <div>
          <div
            className={`text-[11px] font-bold uppercase tracking-[0.2em] ${isDark ? "text-slate-400" : "text-slate-500"}`}
          >
            {title}
          </div>
          <div
            className={`mt-2 text-[1.85rem] font-black tracking-[-0.04em] ${isDark ? "text-white" : "text-slate-950"}`}
          >
            {value}
          </div>
          {subtitle ? (
            <div
              className={`mt-2 text-xs leading-5 ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

function SelectField({ value, onChange, children }) {
  const { isDark } = useThemeToggle();

  return (
    <select
      value={value}
      onChange={onChange}
      className={`w-full rounded-2xl border px-3.5 py-2.5 text-sm outline-none transition ${isDark ? "border-white/10 bg-white/6 text-slate-100" : "border-slate-200/80 bg-white text-slate-900 shadow-[0_14px_24px_-22px_rgba(15,23,42,0.2)]"}`}
    >
      {children}
    </select>
  );
}

function FilterRow({ children }) {
  return <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">{children}</div>;
}

function InlineError({ message }) {
  const { isDark } = useThemeToggle();
  if (!message) return null;

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${isDark ? "border-red-400/20 bg-red-400/10 text-red-200" : "border-red-200 bg-red-50 text-red-700"}`}
    >
      {message}
    </div>
  );
}

function EmptyState({ message }) {
  const { isDark } = useThemeToggle();

  return (
    <div
      className={`rounded-2xl border px-4 py-6 text-center text-sm ${isDark ? "border-white/10 bg-white/5 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"}`}
    >
      {message}
    </div>
  );
}

function PaginationBar({ pagination, onPageChange }) {
  const { isDark } = useThemeToggle();
  if (!pagination) return null;

  const current = Number(pagination.page || 1);
  const totalPages = Number(pagination.totalPages || 0);

  return (
    <div className="flex flex-col gap-3 border-t border-inherit pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        Pagina {current} de {Math.max(1, totalPages || 1)} • {fmtNumber(pagination.total || 0)} registros
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => onPageChange(Math.max(1, current - 1))}
          disabled={current <= 1}
        >
          Anterior
        </Button>
        <Button
          variant="secondary"
          onClick={() => onPageChange(current + 1)}
          disabled={totalPages > 0 ? current >= totalPages : true}
        >
          Proxima
        </Button>
      </div>
    </div>
  );
}

function DeliveryStateCell({ item }) {
  const { isDark } = useThemeToggle();
  const label = item?.deliveryState
    ? deliveryLabel(item.deliveryState)
    : item?.providerMessageId
      ? "Aguardando confirmacao"
      : "--";
  const status = item?.deliveryState || (item?.providerMessageId ? "pending" : "");
  const deliveryMoment = pickDeliveryMoment(item);

  return (
    <div>
      {status ? (
        <StatusBadge status={status}>{label}</StatusBadge>
      ) : (
        <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
          --
        </div>
      )}
      <div className={isDark ? "mt-1 text-xs text-slate-400" : "mt-1 text-xs text-slate-500"}>
        {deliveryMoment ? fmtDateTime(deliveryMoment) : item?.providerMessageId || "--"}
      </div>
    </div>
  );
}

function scrollToSection(id) {
  if (typeof document === "undefined") return;
  document.getElementById(id)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

async function copyTextToClipboard(value) {
  if (!value) return false;
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }

  await navigator.clipboard.writeText(String(value));
  return true;
}

function DetailModal({ detail, onClose }) {
  const { isDark } = useThemeToggle();
  const payload = detail?.meta?.payload || detail?.meta || {};
  const deliveryMoment = pickDeliveryMoment(payload);

  return (
    <ModalShell open={!!detail} onClose={onClose} panelClassName="max-w-4xl">
      <div
        className={`rounded-[32px] border ${isDark ? "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(8,15,30,0.95))]" : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.92))]"} shadow-[0_30px_90px_-50px_rgba(15,23,42,0.75)]`}
      >
        <div
          className={`flex items-center justify-between gap-3 border-b px-6 py-5 ${isDark ? "border-white/10" : "border-slate-200/80"}`}
        >
          <div>
            <div
              className={`text-[11px] font-bold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              Detalhes
            </div>
            <h3
              className={`mt-2 text-xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-950"}`}
            >
              {detail?.title || "Detalhes"}
            </h3>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {detail?.summary ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${isDark ? "border-white/10 bg-white/5 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700"}`}
            >
              {detail.summary}
            </div>
          ) : null}

          {payload?.providerMessageId || payload?.deliveryState ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div
                className={`rounded-2xl border px-4 py-3 ${isDark ? "border-white/10 bg-white/5 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700"}`}
              >
                <div
                  className={`text-[11px] font-bold uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  Entrega
                </div>
                <div className="mt-2">
                  <StatusBadge status={payload?.deliveryState || "pending"}>
                    {deliveryLabel(payload?.deliveryState)}
                  </StatusBadge>
                </div>
                <div className={`mt-2 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Ultima confirmacao: {fmtDateTime(deliveryMoment)}
                </div>
              </div>
              <div
                className={`rounded-2xl border px-4 py-3 ${isDark ? "border-white/10 bg-white/5 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700"}`}
              >
                <div
                  className={`text-[11px] font-bold uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  Provider message id
                </div>
                <div className="mt-2 break-all text-sm">
                  {payload?.providerMessageId || "--"}
                </div>
                <div className={`mt-2 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Entregue: {fmtDateTime(payload?.deliveredAt)} • Lido: {fmtDateTime(payload?.readAt)}
                </div>
              </div>
            </div>
          ) : null}

          {detail?.meta?.message ? (
            <div>
              <div
                className={`mb-2 text-[11px] font-bold uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                Mensagem completa
              </div>
              <pre
                className={`overflow-x-auto whitespace-pre-wrap rounded-2xl border px-4 py-3 text-sm leading-6 ${isDark ? "border-white/10 bg-[rgba(8,15,30,0.85)] text-slate-100" : "border-slate-200 bg-white text-slate-800"}`}
              >
                {detail.meta.message}
              </pre>
            </div>
          ) : null}

          <div>
            <div
              className={`mb-2 text-[11px] font-bold uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              Payload
            </div>
            <pre
              className={`overflow-x-auto rounded-2xl border px-4 py-3 text-xs leading-6 ${isDark ? "border-white/10 bg-[rgba(8,15,30,0.85)] text-slate-100" : "border-slate-200 bg-white text-slate-800"}`}
            >
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

export default function Management() {
  const { isDark } = useThemeToggle();
  const [refreshKey, setRefreshKey] = useState(0);
  const [detail, setDetail] = useState(null);
  const [diagnosticWorkspaceId, setDiagnosticWorkspaceId] = useState("");
  const [diagnosticTab, setDiagnosticTab] = useState("overview");
  const [diagnosticFlash, setDiagnosticFlash] = useState("");
  const [whatsAppTab, setWhatsAppTab] = useState("gateway");

  const [workspaceParams, setWorkspaceParams] = useState({
    page: 1,
    search: "",
    plan: "",
    subscriptionStatus: "",
  });
  const [userParams, setUserParams] = useState({
    page: 1,
    search: "",
    workspaceId: "",
  });
  const [clientParams, setClientParams] = useState({
    page: 1,
    search: "",
    workspaceId: "",
  });
  const [outboxParams, setOutboxParams] = useState({
    page: 1,
    search: "",
    workspaceId: "",
    status: "",
    sourceType: "",
  });
  const [messageLogParams, setMessageLogParams] = useState({
    page: 1,
    search: "",
    workspaceId: "",
    status: "",
    eventType: "",
  });

  const overviewLoader = useCallback(() => getAdminOverview(), []);
  const servicesLoader = useCallback(() => getAdminServices(), []);
  const gatewayMonitorLoader = useCallback(
    () => getAdminWhatsAppGatewayMonitor({ eventsLimit: 100 }),
    [],
  );
  const workspaceOptionsLoader = useCallback(
    () => listAdminWorkspaces({ page: 1, limit: 100 }),
    [],
  );
  const workspacesLoader = useCallback(
    () => listAdminWorkspaces({ ...workspaceParams, limit: 25 }),
    [workspaceParams],
  );
  const usersLoader = useCallback(
    () => listAdminUsers({ ...userParams, limit: 8 }),
    [userParams],
  );
  const tenantDiagnosticsLoader = useCallback(() => {
    if (!diagnosticWorkspaceId) return Promise.resolve(null);
    return getAdminTenantDiagnostics(diagnosticWorkspaceId, { days: 7 });
  }, [diagnosticWorkspaceId]);
  const clientsLoader = useCallback(
    () => listAdminClients({ ...clientParams, limit: 25 }),
    [clientParams],
  );
  const outboxLoader = useCallback(
    () => listAdminWhatsAppOutbox({ ...outboxParams, limit: 25 }),
    [outboxParams],
  );
  const messageLogsLoader = useCallback(
    () => listAdminWhatsAppMessageLogs({ ...messageLogParams, limit: 25 }),
    [messageLogParams],
  );

  const overviewState = useAsyncData(overviewLoader, [overviewLoader, refreshKey]);
  const servicesState = useAsyncData(servicesLoader, [servicesLoader, refreshKey], {
    items: [],
  });
  const gatewayMonitorState = useAsyncData(
    gatewayMonitorLoader,
    [gatewayMonitorLoader, refreshKey],
    null,
  );
  const workspaceOptionsState = useAsyncData(
    workspaceOptionsLoader,
    [workspaceOptionsLoader, refreshKey],
    { items: [] },
  );
  const workspacesState = useAsyncData(
    workspacesLoader,
    [workspacesLoader, refreshKey],
    { items: [], pagination: null },
  );
  const tenantDiagnosticsState = useAsyncData(
    tenantDiagnosticsLoader,
    [tenantDiagnosticsLoader, refreshKey],
    null,
  );
  const usersState = useAsyncData(usersLoader, [usersLoader, refreshKey], {
    items: [],
    pagination: null,
  });
  const clientsState = useAsyncData(clientsLoader, [clientsLoader, refreshKey], {
    items: [],
    pagination: null,
  });
  const outboxState = useAsyncData(outboxLoader, [outboxLoader, refreshKey], {
    items: [],
    pagination: null,
  });
  const messageLogsState = useAsyncData(
    messageLogsLoader,
    [messageLogsLoader, refreshKey],
    { items: [], pagination: null },
  );

  const workspaceOptions = useMemo(() => {
    const map = new Map();
    for (const workspace of workspaceOptionsState.data?.items || []) {
      map.set(String(workspace._id), workspace);
    }
    for (const workspace of workspacesState.data?.items || []) {
      map.set(String(workspace._id), workspace);
    }
    return Array.from(map.values());
  }, [workspaceOptionsState.data, workspacesState.data]);

  const overview = overviewState.data?.overview || null;
  const tenantDiagnostics =
    String(tenantDiagnosticsState.data?.diagnostics?.workspace?._id || "") ===
    String(diagnosticWorkspaceId || "")
      ? tenantDiagnosticsState.data?.diagnostics || null
      : null;
  const services = servicesState.data?.items || [];
  const gatewayMonitor = gatewayMonitorState.data?.monitor || null;
  const workspaces = workspacesState.data?.items || [];
  const users = usersState.data?.items || [];
  const clients = clientsState.data?.items || [];
  const outboxItems = outboxState.data?.items || [];
  const messageLogItems = messageLogsState.data?.items || [];

  const outboxCounts = overview?.whatsapp?.outboxStatusCounts || {};
  const messageLogCounts = overview?.whatsapp?.messageLogStatusCounts || {};
  const globalRefreshLoading =
    overviewState.loading ||
    servicesState.loading ||
    gatewayMonitorState.loading ||
    workspaceOptionsState.loading ||
    workspacesState.loading ||
    tenantDiagnosticsState.loading ||
    usersState.loading ||
    clientsState.loading ||
    outboxState.loading ||
    messageLogsState.loading;
  const [manualRefreshingAll, beginManualRefreshingAll] =
    useManualRefreshFeedback(globalRefreshLoading);
  const [manualRefreshingDiagnostics, beginManualRefreshingDiagnostics] =
    useManualRefreshFeedback(tenantDiagnosticsState.loading);
  const [manualRefreshingGateway, beginManualRefreshingGateway] =
    useManualRefreshFeedback(gatewayMonitorState.loading);

  useEffect(() => {
    if (!diagnosticFlash) return undefined;
    const timeoutId = window.setTimeout(() => setDiagnosticFlash(""), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [diagnosticFlash]);

  const handleRefreshAll = useCallback(() => {
    beginManualRefreshingAll();
    setRefreshKey((current) => current + 1);
  }, [beginManualRefreshingAll]);

  const handleRefreshDiagnostics = useCallback(() => {
    beginManualRefreshingDiagnostics();
    setRefreshKey((current) => current + 1);
  }, [beginManualRefreshingDiagnostics]);

  const handleRefreshGateway = useCallback(() => {
    beginManualRefreshingGateway();
    setRefreshKey((current) => current + 1);
  }, [beginManualRefreshingGateway]);

  function openDetail(title, summary, payload, extra = {}) {
    setDetail({
      title,
      summary,
      meta: {
        payload,
        ...extra,
      },
    });
  }

  async function handleCopy(label, value) {
    if (!value) {
      setDiagnosticFlash(`Sem ${label.toLowerCase()} para copiar.`);
      return;
    }

    try {
      const copied = await copyTextToClipboard(value);
      setDiagnosticFlash(
        copied
          ? `${label} copiado.`
          : `Nao foi possivel copiar ${label.toLowerCase()}.`,
      );
    } catch {
      setDiagnosticFlash(`Nao foi possivel copiar ${label.toLowerCase()}.`);
    }
  }

  function openTenantDiagnostics(workspaceId) {
    setDiagnosticWorkspaceId(String(workspaceId || ""));
    setDiagnosticTab("overview");
    scrollToSection("tenant-diagnostics");
  }

  function applyUserWorkspaceFilter(workspaceId) {
    setUserParams((current) => ({
      ...current,
      page: 1,
      workspaceId: String(workspaceId || ""),
    }));
    scrollToSection("usuarios");
  }

  function applyClientWorkspaceFilter(workspaceId) {
    setClientParams((current) => ({
      ...current,
      page: 1,
      workspaceId: String(workspaceId || ""),
    }));
    scrollToSection("clientes");
  }

  function applyOutboxWorkspaceFilter(workspaceId) {
    setWhatsAppTab("outbox");
    setOutboxParams((current) => ({
      ...current,
      page: 1,
      workspaceId: String(workspaceId || ""),
    }));
    scrollToSection("whatsapp");
  }

  function applyMessageLogWorkspaceFilter(workspaceId) {
    setWhatsAppTab("logs");
    setMessageLogParams((current) => ({
      ...current,
      page: 1,
      workspaceId: String(workspaceId || ""),
    }));
    scrollToSection("whatsapp");
  }

  return (
    <Shell>
      <div className="mx-auto max-w-[1500px] space-y-8">
        <PageHeader
          eyebrow="Master"
          title="Gerenciamento Master"
          subtitle="Monitoria global do backend, banco, clientes, workspaces, fila do WhatsApp e logs operacionais."
          actions={
            <Button size="lg" onClick={handleRefreshAll} disabled={manualRefreshingAll}>
              <RefreshCw
                className={`h-4 w-4 ${manualRefreshingAll ? "animate-spin" : ""}`}
              />
              {manualRefreshingAll ? "Atualizando tudo..." : "Atualizar tudo"}
            </Button>
          }
        />

        <section className="space-y-5">
          <SectionHeading
            id="visao-geral"
            eyebrow="Visao geral"
            title="Saude e volume"
            description="Cards rapidos para enxergar a situacao da API, banco, gateway e volumes principais do sistema."
          />

          <InlineError message={overviewState.error} />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {overviewState.loading && !overview ? (
              Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-44 rounded-[28px]" />
              ))
            ) : (
              <>
                <MetricCard
                  icon={Server}
                  title="API"
                  value={statusLabel(overview?.services?.find((item) => item.id === "api")?.status || "healthy")}
                  subtitle={overview?.services?.find((item) => item.id === "api")?.summary || "API online."}
                  status={overview?.services?.find((item) => item.id === "api")?.status || "healthy"}
                />
                <MetricCard
                  icon={Database}
                  title="Mongo"
                  value={statusLabel(overview?.database?.mongo?.status || "down")}
                  subtitle={overview?.database?.mongo?.summary || "Sem leitura do banco."}
                  status={overview?.database?.mongo?.status || "down"}
                />
                <MetricCard
                  icon={MessageSquareText}
                  title="WhatsApp Gateway"
                  value={statusLabel(overview?.whatsapp?.gateway?.status || "down")}
                  subtitle={overview?.whatsapp?.gateway?.summary || "Gateway indisponivel."}
                  status={overview?.whatsapp?.gateway?.status || "down"}
                />
                <MetricCard
                  icon={Building2}
                  title="Workspaces"
                  value={fmtNumber(overview?.totals?.workspaces || 0)}
                  subtitle="Visao global dos espacos cadastrados."
                  status="healthy"
                />
                <MetricCard
                  icon={Users}
                  title="Usuarios"
                  value={fmtNumber(overview?.totals?.users || 0)}
                  subtitle="Contas autenticaveis no sistema."
                  status="healthy"
                />
                <MetricCard
                  icon={ShieldCheck}
                  title="Clientes"
                  value={fmtNumber(overview?.totals?.clients || 0)}
                  subtitle="Cadastros totais de clientes."
                  status="healthy"
                />
                <MetricCard
                  icon={Activity}
                  title="Fila queued"
                  value={fmtNumber(outboxCounts.queued || 0)}
                  subtitle={`${fmtNumber(overview?.whatsapp?.failuresLast24h?.outbox || 0)} falhas da fila nas ultimas 24h`}
                  status={Number(outboxCounts.failed || 0) > 0 ? "warning" : "healthy"}
                />
                <MetricCard
                  icon={AlertTriangle}
                  title="Message logs failed"
                  value={fmtNumber(messageLogCounts.FAILED || 0)}
                  subtitle={`${fmtNumber(overview?.whatsapp?.failuresLast24h?.messageLogs || 0)} falhas de log nas ultimas 24h`}
                  status={Number(messageLogCounts.FAILED || 0) > 0 ? "warning" : "healthy"}
                />
              </>
            )}
          </div>

          <div id="usuarios">
          <Card>
            <CardHeader
              title="Usuarios"
              subtitle="Busca rapida das contas cadastradas, com indicacao de acesso master."
            />
            <CardBody className="space-y-4">
              <FilterRow>
                <Input
                  value={userParams.search}
                  onChange={(event) =>
                    setUserParams((current) => ({
                      ...current,
                      page: 1,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Buscar por nome ou email"
                />
                <SelectField
                  value={userParams.workspaceId}
                  onChange={(event) =>
                    setUserParams((current) => ({
                      ...current,
                      page: 1,
                      workspaceId: event.target.value,
                    }))
                  }
                >
                  <option value="">Todos os workspaces</option>
                  {workspaceOptions.map((workspace) => (
                    <option key={workspace._id} value={workspace._id}>
                      {workspace.name}
                    </option>
                  ))}
                </SelectField>
                <div />
                <div />
              </FilterRow>

              <InlineError message={usersState.error} />

              {usersState.loading && !users.length ? (
                <Skeleton className="h-52 rounded-2xl" />
              ) : users.length === 0 ? (
                <EmptyState message="Nenhum usuario encontrado para os filtros atuais." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className={isDark ? "text-slate-400" : "text-slate-500"}>
                        <th className="pb-3 font-semibold">Usuario</th>
                        <th className="pb-3 font-semibold">Workspace</th>
                        <th className="pb-3 font-semibold">Perfil</th>
                        <th className="pb-3 font-semibold">Status</th>
                        <th className="pb-3 font-semibold">Criado em</th>
                      </tr>
                    </thead>
                    <tbody className={isDark ? "divide-y divide-white/10" : "divide-y divide-slate-200/80"}>
                      {users.map((user) => (
                        <tr key={user._id}>
                          <td className="py-3">
                            <div className="font-semibold">{user.name || "Sem nome"}</div>
                            <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                              {user.email}
                            </div>
                          </td>
                          <td className="py-3">
                            <div>{user.workspace?.name || "--"}</div>
                            <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                              {user.workspace?.slug || "--"}
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-2">
                              <StatusBadge status={user.role}>{statusLabel(user.role)}</StatusBadge>
                              {user.isMasterAdmin ? (
                                <StatusBadge status="healthy">Master</StatusBadge>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-3">
                            <StatusBadge status={user.status}>{statusLabel(user.status)}</StatusBadge>
                          </td>
                          <td className="py-3">{fmtDateTime(user.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <PaginationBar
                pagination={usersState.data?.pagination}
                onPageChange={(page) =>
                  setUserParams((current) => ({ ...current, page }))
                }
              />
            </CardBody>
          </Card>
          </div>
        </section>

        <section className="space-y-5">
          <SectionHeading
            id="tenant-diagnostics"
            eyebrow="Diagnostico por tenant"
            title="Painel rapido por workspace"
            description="Selecione um tenant para enxergar plano, canais, uso do agente, fila do WhatsApp e falhas recentes sem sair do Gerenciamento."
          />

          <TenantDiagnosticsPanel
            diagnosticWorkspaceId={diagnosticWorkspaceId}
            workspaceOptions={workspaceOptions}
            tenantDiagnosticsState={tenantDiagnosticsState}
            tenantDiagnostics={tenantDiagnostics}
            diagnosticTab={diagnosticTab}
            onChangeTab={setDiagnosticTab}
            diagnosticFlash={diagnosticFlash}
            onSelectWorkspace={(workspaceId) => {
              setDiagnosticWorkspaceId(workspaceId);
              setDiagnosticTab("overview");
            }}
            onCopy={handleCopy}
            refreshing={manualRefreshingDiagnostics}
            onRefresh={handleRefreshDiagnostics}
            onOpenUsers={applyUserWorkspaceFilter}
            onOpenClients={applyClientWorkspaceFilter}
            onOpenOutbox={applyOutboxWorkspaceFilter}
            onOpenMessageLogs={applyMessageLogWorkspaceFilter}
            onOpenDetail={openDetail}
          />
        </section>

        <section className="space-y-5">
          <SectionHeading
            id="servicos"
            eyebrow="Servicos"
            title="Estado dos processos"
            description="Leitura consolidada da API, Mongo, gateway do WhatsApp e runners internos."
          />

          <InlineError message={servicesState.error} />

          <Card>
            <CardBody className="p-0">
              {servicesState.loading && services.length === 0 ? (
                <div className="p-5">
                  <Skeleton className="h-72 rounded-2xl" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className={isDark ? "text-slate-400" : "text-slate-500"}>
                        <th className="px-5 py-4 font-semibold">Servico</th>
                        <th className="px-5 py-4 font-semibold">Status</th>
                        <th className="px-5 py-4 font-semibold">Resumo</th>
                        <th className="px-5 py-4 font-semibold">Atualizado</th>
                        <th className="px-5 py-4 font-semibold text-right">Detalhes</th>
                      </tr>
                    </thead>
                    <tbody className={isDark ? "divide-y divide-white/10" : "divide-y divide-slate-200/80"}>
                      {services.map((service) => (
                        <tr key={service.id}>
                          <td className="px-5 py-4 font-semibold">{service.id}</td>
                          <td className="px-5 py-4">
                            <StatusBadge status={service.status} />
                          </td>
                          <td className="px-5 py-4">{service.summary}</td>
                          <td className="px-5 py-4">{fmtDateTime(service.updatedAt)}</td>
                          <td className="px-5 py-4 text-right">
                            <Button
                              variant="secondary"
                              onClick={() =>
                                openDetail(
                                  `Servico: ${service.id}`,
                                  service.summary,
                                  service.details,
                                )
                              }
                            >
                              <Eye className="h-4 w-4" />
                              Ver
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </section>

        <section className="space-y-5">
          <SectionHeading
            id="workspaces"
            eyebrow="Workspaces"
            title="Mapa dos workspaces"
            description="Busca global por nome, slug, owner, plano e situacao da assinatura."
          />

          <Card>
            <CardHeader
              title="Workspaces"
              subtitle="Contagens resumidas por workspace e ultimo movimento observado."
            />
            <CardBody className="space-y-4">
              <FilterRow>
                <Input
                  value={workspaceParams.search}
                  onChange={(event) =>
                    setWorkspaceParams((current) => ({
                      ...current,
                      page: 1,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Buscar por nome, slug, owner ou email"
                />
                <SelectField
                  value={workspaceParams.plan}
                  onChange={(event) =>
                    setWorkspaceParams((current) => ({
                      ...current,
                      page: 1,
                      plan: event.target.value,
                    }))
                  }
                >
                  <option value="">Todos os planos</option>
                  <option value="start">Start</option>
                  <option value="pro">Pro</option>
                  <option value="business">Business</option>
                  <option value="enterprise">Enterprise</option>
                </SelectField>
                <SelectField
                  value={workspaceParams.subscriptionStatus}
                  onChange={(event) =>
                    setWorkspaceParams((current) => ({
                      ...current,
                      page: 1,
                      subscriptionStatus: event.target.value,
                    }))
                  }
                >
                  <option value="">Todas as assinaturas</option>
                  <option value="inactive">Inactive</option>
                  <option value="active">Active</option>
                  <option value="past_due">Past due</option>
                  <option value="canceled">Canceled</option>
                </SelectField>
                <div />
              </FilterRow>

              <InlineError message={workspacesState.error} />

              {workspacesState.loading && workspaces.length === 0 ? (
                <Skeleton className="h-72 rounded-2xl" />
              ) : workspaces.length === 0 ? (
                <EmptyState message="Nenhum workspace encontrado." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className={isDark ? "text-slate-400" : "text-slate-500"}>
                        <th className="pb-3 font-semibold">Workspace</th>
                        <th className="pb-3 font-semibold">Owner</th>
                        <th className="pb-3 font-semibold">Plano</th>
                        <th className="pb-3 font-semibold">Contagens</th>
                        <th className="pb-3 font-semibold">Ultima atividade</th>
                        <th className="pb-3 font-semibold text-right">Diagnostico</th>
                      </tr>
                    </thead>
                    <tbody className={isDark ? "divide-y divide-white/10" : "divide-y divide-slate-200/80"}>
                      {workspaces.map((workspace) => (
                        <tr key={workspace._id}>
                          <td className="py-3">
                            <div className="font-semibold">{workspace.name}</div>
                            <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                              /{workspace.slug || "--"}
                            </div>
                          </td>
                          <td className="py-3">
                            <div>{workspace.owner?.name || "--"}</div>
                            <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                              {workspace.owner?.email || "--"}
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-2">
                              <StatusBadge status={workspace.plan}>{workspace.plan}</StatusBadge>
                              <StatusBadge status={workspace.subscription?.status || "inactive"}>
                                {workspace.subscription?.status || "inactive"}
                              </StatusBadge>
                            </div>
                          </td>
                          <td className="py-3">
                            <div className={isDark ? "text-xs text-slate-300" : "text-xs text-slate-700"}>
                              {fmtNumber(workspace.counts?.users || 0)} usuarios •{" "}
                              {fmtNumber(workspace.counts?.clients || 0)} clientes •{" "}
                              {fmtNumber(workspace.counts?.offers || 0)} offers
                            </div>
                          </td>
                          <td className="py-3">
                            <div>{fmtDateTime(workspace.lastActivityAt)}</div>
                            <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                              Criado em {fmtDateTime(workspace.createdAt)}
                            </div>
                          </td>
                          <td className="py-3 text-right">
                            <Button
                              variant="secondary"
                              onClick={() => openTenantDiagnostics(workspace._id)}
                            >
                              <Eye className="h-4 w-4" />
                              Diagnosticar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <PaginationBar
                pagination={workspacesState.data?.pagination}
                onPageChange={(page) =>
                  setWorkspaceParams((current) => ({ ...current, page }))
                }
              />
            </CardBody>
          </Card>
        </section>

        <section className="space-y-5">
          <SectionHeading
            id="clientes"
            eyebrow="Clientes"
            title="Clientes cadastrados"
            description="Busca global por cliente com filtro opcional por workspace."
          />

          <Card>
            <CardHeader
              title="Clientes"
              subtitle="Cadastro consolidado de clientes do sistema."
            />
            <CardBody className="space-y-4">
              <FilterRow>
                <Input
                  value={clientParams.search}
                  onChange={(event) =>
                    setClientParams((current) => ({
                      ...current,
                      page: 1,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Buscar por nome, email, ID do cliente ou telefone"
                />
                <SelectField
                  value={clientParams.workspaceId}
                  onChange={(event) =>
                    setClientParams((current) => ({
                      ...current,
                      page: 1,
                      workspaceId: event.target.value,
                    }))
                  }
                >
                  <option value="">Todos os workspaces</option>
                  {workspaceOptions.map((workspace) => (
                    <option key={workspace._id} value={workspace._id}>
                      {workspace.name}
                    </option>
                  ))}
                </SelectField>
                <div />
                <div />
              </FilterRow>

              <InlineError message={clientsState.error} />

              {clientsState.loading && clients.length === 0 ? (
                <Skeleton className="h-72 rounded-2xl" />
              ) : clients.length === 0 ? (
                <EmptyState message="Nenhum cliente encontrado." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className={isDark ? "text-slate-400" : "text-slate-500"}>
                        <th className="pb-3 font-semibold">Cliente</th>
                        <th className="pb-3 font-semibold">Contato</th>
                        <th className="pb-3 font-semibold">Workspace</th>
                        <th className="pb-3 font-semibold">Criado em</th>
                      </tr>
                    </thead>
                    <tbody className={isDark ? "divide-y divide-white/10" : "divide-y divide-slate-200/80"}>
                      {clients.map((client) => (
                        <tr key={client._id}>
                          <td className="py-3">
                            <div className="font-semibold">{client.fullName}</div>
                            <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                              {client.clientId}
                            </div>
                          </td>
                          <td className="py-3">
                            <div>{client.email || "--"}</div>
                            <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                              {client.phone || "--"}
                            </div>
                          </td>
                          <td className="py-3">
                            <div>{client.workspace?.name || "--"}</div>
                            <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                              /{client.workspace?.slug || "--"}
                            </div>
                          </td>
                          <td className="py-3">{fmtDateTime(client.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <PaginationBar
                pagination={clientsState.data?.pagination}
                onPageChange={(page) =>
                  setClientParams((current) => ({ ...current, page }))
                }
              />
            </CardBody>
          </Card>
        </section>

        <section className="space-y-5">
          <SectionHeading
            id="whatsapp"
            eyebrow="WhatsApp"
            title="Fila, logs e diagnostico"
            description="Use as abas para alternar entre troubleshooting do gateway, fila de envio e historico de mensagens."
          />

          <Card>
            <CardBody className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "gateway", label: "Gateway" },
                  { key: "outbox", label: "Outbox" },
                  { key: "logs", label: "Message Logs" },
                ].map((tab) => {
                  const active = whatsAppTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setWhatsAppTab(tab.key)}
                      className={`rounded-full border px-3.5 py-2 text-xs font-bold uppercase tracking-[0.16em] transition ${
                        active
                          ? isDark
                            ? "border-cyan-300/30 bg-cyan-400/15 text-cyan-100"
                            : "border-cyan-200 bg-cyan-50 text-cyan-700"
                          : isDark
                            ? "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {whatsAppTab === "gateway" ? (
                <WhatsAppGatewayMonitorPanel
                  monitorState={gatewayMonitorState}
                  monitor={gatewayMonitor}
                  refreshing={manualRefreshingGateway}
                  onRefresh={handleRefreshGateway}
                  onOpenDetail={(title, summary, payload) =>
                    openDetail(title, summary, payload)
                  }
                />
              ) : null}

              {whatsAppTab === "outbox" ? (
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <MetricCard
                      icon={MessageSquareText}
                      title="Queued"
                      value={fmtNumber(outboxCounts.queued || 0)}
                      subtitle="Mensagens aguardando processamento."
                      status="queued"
                    />
                    <MetricCard
                      icon={AlertTriangle}
                      title="Failed"
                      value={fmtNumber(outboxCounts.failed || 0)}
                      subtitle="Itens com falha definitiva na fila."
                      status={Number(outboxCounts.failed || 0) > 0 ? "warning" : "healthy"}
                    />
                  </div>

                  <Card>
                    <CardHeader
                      title="WhatsApp Outbox"
                      subtitle="Fila de mensagens do gateway, com tentativas, bloqueios e erro final."
                    />
                    <CardBody className="space-y-4">
              <FilterRow>
                <Input
                  value={outboxParams.search}
                  onChange={(event) =>
                    setOutboxParams((current) => ({
                      ...current,
                      page: 1,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Buscar por destino, mensagem, dedupeKey ou erro"
                />
                <SelectField
                  value={outboxParams.workspaceId}
                  onChange={(event) =>
                    setOutboxParams((current) => ({
                      ...current,
                      page: 1,
                      workspaceId: event.target.value,
                    }))
                  }
                >
                  <option value="">Todos os workspaces</option>
                  {workspaceOptions.map((workspace) => (
                    <option key={workspace._id} value={workspace._id}>
                      {workspace.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  value={outboxParams.status}
                  onChange={(event) =>
                    setOutboxParams((current) => ({
                      ...current,
                      page: 1,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="">Todos os status</option>
                  <option value="queued">Queued</option>
                  <option value="processing">Processing</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </SelectField>
                <SelectField
                  value={outboxParams.sourceType}
                  onChange={(event) =>
                    setOutboxParams((current) => ({
                      ...current,
                      page: 1,
                      sourceType: event.target.value,
                    }))
                  }
                >
                  <option value="">Todos os source types</option>
                  <option value="message_log">message_log</option>
                  <option value="offer_reminder_log">offer_reminder_log</option>
                  <option value="recurring_offer">recurring_offer</option>
                </SelectField>
              </FilterRow>

              <InlineError message={outboxState.error} />

              {outboxState.loading && outboxItems.length === 0 ? (
                <Skeleton className="h-72 rounded-2xl" />
              ) : outboxItems.length === 0 ? (
                <EmptyState message="Nenhum item encontrado na fila." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className={isDark ? "text-slate-400" : "text-slate-500"}>
                        <th className="pb-3 font-semibold">Destino</th>
                        <th className="pb-3 font-semibold">Workspace</th>
                        <th className="pb-3 font-semibold">Status</th>
                        <th className="pb-3 font-semibold">Entrega</th>
                        <th className="pb-3 font-semibold">Tentativas</th>
                        <th className="pb-3 font-semibold">Proxima tentativa</th>
                        <th className="pb-3 font-semibold">Mensagem</th>
                        <th className="pb-3 font-semibold text-right">Acoes</th>
                      </tr>
                    </thead>
                    <tbody className={isDark ? "divide-y divide-white/10" : "divide-y divide-slate-200/80"}>
                      {outboxItems.map((item) => (
                        <tr key={item._id}>
                          <td className="py-3">
                            <div className="font-semibold">{item.to || "--"}</div>
                            <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                              {item.sourceType || "--"}
                            </div>
                          </td>
                          <td className="py-3">
                            <div>{item.workspace?.name || "--"}</div>
                            <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                              /{item.workspace?.slug || "--"}
                            </div>
                          </td>
                          <td className="py-3">
                            <StatusBadge status={item.status} />
                          </td>
                          <td className="py-3">
                            <DeliveryStateCell item={item} />
                          </td>
                          <td className="py-3">
                            {fmtNumber(item.attempts || 0)} / {fmtNumber(item.maxAttempts || 0)}
                          </td>
                          <td className="py-3">
                            <div>{fmtDateTime(item.nextAttemptAt)}</div>
                            <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                              {fmtRelativeLike(item.nextAttemptAt)}
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="max-w-[320px]">{item.messagePreview || "--"}</div>
                            <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                              {item.lastError?.message || item.providerMessageId || "--"}
                            </div>
                          </td>
                          <td className="py-3 text-right">
                            <Button
                              variant="secondary"
                              onClick={() =>
                                openDetail(
                                  `Outbox ${item._id}`,
                                  `Status ${item.status} • criado em ${fmtDateTime(item.createdAt)}`,
                                  item,
                                  { message: item.message },
                                )
                              }
                            >
                              <Eye className="h-4 w-4" />
                              Ver
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <PaginationBar
                pagination={outboxState.data?.pagination}
                onPageChange={(page) =>
                  setOutboxParams((current) => ({ ...current, page }))
                }
              />
                    </CardBody>
                  </Card>
                </div>
              ) : null}

              {whatsAppTab === "logs" ? (
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <MetricCard
                      icon={Activity}
                      title="Logs sent"
                      value={fmtNumber(messageLogCounts.SENT || 0)}
                      subtitle="Registros de envio concluido."
                      status="healthy"
                    />
                    <MetricCard
                      icon={AlertTriangle}
                      title="Logs failed"
                      value={fmtNumber(messageLogCounts.FAILED || 0)}
                      subtitle="Registros com erro de envio."
                      status={Number(messageLogCounts.FAILED || 0) > 0 ? "warning" : "healthy"}
                    />
                  </div>

                  <Card>
                    <CardHeader
                      title="Message Logs"
                      subtitle="Historico das mensagens disparadas, com preview curto na grid e mensagem completa no detalhe."
                    />
                    <CardBody className="space-y-4">
              <FilterRow>
                <Input
                  value={messageLogParams.search}
                  onChange={(event) =>
                    setMessageLogParams((current) => ({
                      ...current,
                      page: 1,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Buscar por destino, evento, mensagem ou erro"
                />
                <SelectField
                  value={messageLogParams.workspaceId}
                  onChange={(event) =>
                    setMessageLogParams((current) => ({
                      ...current,
                      page: 1,
                      workspaceId: event.target.value,
                    }))
                  }
                >
                  <option value="">Todos os workspaces</option>
                  {workspaceOptions.map((workspace) => (
                    <option key={workspace._id} value={workspace._id}>
                      {workspace.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  value={messageLogParams.status}
                  onChange={(event) =>
                    setMessageLogParams((current) => ({
                      ...current,
                      page: 1,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="">Todos os status</option>
                  <option value="PENDING">Pending</option>
                  <option value="SENT">Sent</option>
                  <option value="FAILED">Failed</option>
                  <option value="SKIPPED">Skipped</option>
                </SelectField>
                <Input
                  value={messageLogParams.eventType}
                  onChange={(event) =>
                    setMessageLogParams((current) => ({
                      ...current,
                      page: 1,
                      eventType: event.target.value,
                    }))
                  }
                  placeholder="Filtrar por eventType"
                />
              </FilterRow>

              <InlineError message={messageLogsState.error} />

              {messageLogsState.loading && messageLogItems.length === 0 ? (
                <Skeleton className="h-72 rounded-2xl" />
              ) : messageLogItems.length === 0 ? (
                <EmptyState message="Nenhum message log encontrado." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className={isDark ? "text-slate-400" : "text-slate-500"}>
                        <th className="pb-3 font-semibold">Evento</th>
                        <th className="pb-3 font-semibold">Destino</th>
                        <th className="pb-3 font-semibold">Workspace</th>
                        <th className="pb-3 font-semibold">Status</th>
                        <th className="pb-3 font-semibold">Entrega</th>
                        <th className="pb-3 font-semibold">Mensagem</th>
                        <th className="pb-3 font-semibold">Enviado em</th>
                        <th className="pb-3 font-semibold text-right">Acoes</th>
                      </tr>
                    </thead>
                    <tbody className={isDark ? "divide-y divide-white/10" : "divide-y divide-slate-200/80"}>
                      {messageLogItems.map((item) => (
                        <tr key={item._id}>
                          <td className="py-3">
                            <div className="font-semibold">{item.eventType}</div>
                            <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                              {item.provider || "--"}
                            </div>
                          </td>
                          <td className="py-3">{item.to || "--"}</td>
                          <td className="py-3">
                            <div>{item.workspace?.name || "--"}</div>
                            <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                              /{item.workspace?.slug || "--"}
                            </div>
                          </td>
                          <td className="py-3">
                            <StatusBadge status={item.status} />
                          </td>
                          <td className="py-3">
                            <DeliveryStateCell item={item} />
                          </td>
                          <td className="py-3">
                            <div className="max-w-[320px]">{item.messagePreview || "--"}</div>
                            <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                              {item.error?.message || item.providerMessageId || "--"}
                            </div>
                          </td>
                          <td className="py-3">{fmtDateTime(item.sentAt || item.createdAt)}</td>
                          <td className="py-3 text-right">
                            <Button
                              variant="secondary"
                              onClick={() =>
                                openDetail(
                                  `Message log ${item._id}`,
                                  `Status ${item.status} • criado em ${fmtDateTime(item.createdAt)}`,
                                  item,
                                  { message: item.message },
                                )
                              }
                            >
                              <Eye className="h-4 w-4" />
                              Ver
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

                      <PaginationBar
                        pagination={messageLogsState.data?.pagination}
                        onPageChange={(page) =>
                          setMessageLogParams((current) => ({ ...current, page }))
                        }
                      />
                    </CardBody>
                  </Card>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </section>
      </div>

      <DetailModal detail={detail} onClose={() => setDetail(null)} />
    </Shell>
  );
}
