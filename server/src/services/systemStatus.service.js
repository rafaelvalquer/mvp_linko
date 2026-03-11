import os from "node:os";
import process from "node:process";
import mongoose from "mongoose";

import { listRuntimeStatuses } from "./runtimeStatus.js";
import { getWhatsAppGatewayStatus } from "./waGateway.js";

const PROCESS_STARTED_AT = new Date();

const MONGO_STATE_LABEL = {
  0: "DISCONNECTED",
  1: "CONNECTED",
  2: "CONNECTING",
  3: "DISCONNECTING",
};

function safeIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildServiceItem({
  id,
  status,
  summary,
  updatedAt = null,
  details = null,
}) {
  return {
    id,
    status,
    summary,
    updatedAt: safeIso(updatedAt) || new Date().toISOString(),
    details,
  };
}

async function getMongoStatus() {
  const readyState = Number(mongoose.connection?.readyState || 0);
  const state = MONGO_STATE_LABEL[readyState] || "UNKNOWN";
  const db = mongoose.connection?.db;

  let ping = null;
  if (db && readyState === 1) {
    try {
      await db.admin().ping();
      ping = { ok: true };
    } catch (error) {
      ping = {
        ok: false,
        message: String(error?.message || "Ping failed"),
      };
    }
  }

  const status =
    readyState === 1 && ping?.ok !== false
      ? "healthy"
      : readyState === 2 || readyState === 3
        ? "warning"
        : "down";

  return buildServiceItem({
    id: "mongo",
    status,
    summary:
      status === "healthy"
        ? "Mongo conectado e respondendo ping."
        : ping?.ok === false
          ? "Mongo conectado, mas o ping falhou."
          : `Mongo em estado ${state.toLowerCase()}.`,
    updatedAt: new Date(),
    details: {
      state,
      readyState,
      host: mongoose.connection?.host || null,
      name: mongoose.connection?.name || null,
      ping,
    },
  });
}

async function getWhatsAppGatewayServiceStatus() {
  const hasConfig =
    String(process.env.WA_GATEWAY_URL || "").trim() &&
    String(process.env.WA_GATEWAY_API_KEY || "").trim();

  if (!hasConfig) {
    return buildServiceItem({
      id: "wa-gateway",
      status: "warning",
      summary: "WA gateway nao configurado no backend.",
      updatedAt: new Date(),
      details: {
        configured: false,
        state: "NOT_CONFIGURED",
      },
    });
  }

  try {
    const gateway = await getWhatsAppGatewayStatus();
    const state = String(gateway?.state || "UNKNOWN").toUpperCase();
    const raw = gateway?.raw || {};
    const status = gateway?.ready === true ? "healthy" : "warning";

    return buildServiceItem({
      id: "wa-gateway",
      status,
      summary:
        gateway?.ready === true
          ? "Gateway do WhatsApp conectado e pronto."
          : `Gateway do WhatsApp acessivel, mas em estado ${state.toLowerCase()}.`,
      updatedAt: new Date(),
      details: {
        configured: true,
        state,
        ready: gateway?.ready === true,
        phone: raw?.phone || null,
        lastSeen: safeIso(raw?.lastSeen) || raw?.lastSeen || null,
        hasLatestQr: raw?.hasLatestQr === true,
        latestQrAt: safeIso(raw?.latestQrAt) || raw?.latestQrAt || null,
        lastError: raw?.lastError || null,
        lastErrorAt: safeIso(raw?.lastErrorAt) || raw?.lastErrorAt || null,
        isInitializing: raw?.isInitializing === true,
      },
    });
  } catch (error) {
    return buildServiceItem({
      id: "wa-gateway",
      status: "down",
      summary: "Falha ao consultar o WA gateway.",
      updatedAt: new Date(),
      details: {
        configured: true,
        state: "UNAVAILABLE",
        error: {
          message: String(error?.message || "Gateway unavailable"),
          code: String(error?.code || error?.name || "WA_GATEWAY_UNAVAILABLE"),
          status: Number(error?.status || 0) || null,
        },
      },
    });
  }
}

function getApiServiceStatus() {
  const memory = process.memoryUsage();

  return buildServiceItem({
    id: "api",
    status: "healthy",
    summary: "API online e respondendo normalmente.",
    updatedAt: new Date(),
    details: {
      pid: process.pid,
      node: process.version,
      platform: process.platform,
      hostname: os.hostname(),
      startedAt: PROCESS_STARTED_AT.toISOString(),
      uptimeMs: Math.round(process.uptime() * 1000),
      memory: {
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
        external: memory.external,
      },
    },
  });
}

function getRunnerServiceStatus(runtime) {
  const lastErrorAt = safeIso(runtime?.lastError?.at);
  const lastFinishedAt = safeIso(runtime?.lastFinishedAt);
  const updatedAt =
    safeIso(runtime?.updatedAt) || lastErrorAt || lastFinishedAt || new Date().toISOString();

  let status = "warning";
  let summary = "Runner registrado, aguardando execucao.";

  if (runtime?.started !== true) {
    status = "warning";
    summary = "Runner ainda nao foi iniciado.";
  } else if (runtime?.running === true) {
    status = "healthy";
    summary = "Runner em execucao.";
  } else if (runtime?.lastError?.message) {
    status = "down";
    summary = "Ultimo ciclo terminou com erro.";
  } else if (runtime?.lastFinishedAt) {
    status = "healthy";
    summary = "Runner ativo com ultimo ciclo concluido.";
  }

  return buildServiceItem({
    id: runtime.name,
    status,
    summary,
    updatedAt,
    details: {
      type: runtime.type,
      started: runtime.started === true,
      running: runtime.running === true,
      startedAt: safeIso(runtime.startedAt),
      uptimeMs: Number(runtime.uptimeMs || 0),
      intervalMs: Number(runtime.intervalMs || 0) || null,
      lastStartedAt: safeIso(runtime.lastStartedAt),
      lastFinishedAt: safeIso(runtime.lastFinishedAt),
      lastSummary: runtime.lastSummary || null,
      lastError: runtime.lastError || null,
    },
  });
}

export async function getSystemServicesStatus() {
  const [mongo, waGateway] = await Promise.all([
    getMongoStatus(),
    getWhatsAppGatewayServiceStatus(),
  ]);

  const services = [
    getApiServiceStatus(),
    mongo,
    waGateway,
    ...listRuntimeStatuses().map(getRunnerServiceStatus),
  ];

  return services;
}

export async function getSystemHealthSnapshot() {
  const services = await getSystemServicesStatus();
  const servicesById = Object.fromEntries(services.map((item) => [item.id, item]));

  return {
    ok: true,
    now: new Date().toISOString(),
    services,
    api: servicesById.api || null,
    mongo: servicesById.mongo || null,
    waGateway: servicesById["wa-gateway"] || null,
  };
}
