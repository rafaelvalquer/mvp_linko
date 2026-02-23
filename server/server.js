import os from "node:os";
import process from "node:process";
import mongoose from "mongoose";

import { createApp } from "./src/app.js";
import { connectMongo } from "./src/config/mongo.js";
import { env } from "./src/config/env.js";

function ts() {
  return new Date().toISOString();
}

function log(level, scope, message, extra) {
  const base = `[${ts()}] [${level}] [${scope}] ${message}`;
  if (extra && Object.keys(extra).length) {
    console.log(base, extra);
  } else {
    console.log(base);
  }
}

function maskMongoUri(uri) {
  if (!uri) return "";
  // mascara credenciais: mongodb://user:pass@host -> mongodb://***:***@host
  return String(uri).replace(/\/\/([^:/]+):([^@]+)@/g, "//***:***@");
}

function countRoutes(app) {
  // Melhor esforço: conta rotas registradas no Express
  try {
    const stack = app?._router?.stack || [];
    let n = 0;

    const walk = (layer) => {
      if (!layer) return;
      if (layer.route && layer.route.path) {
        n += 1;
        return;
      }
      if (layer.name === "router" && layer.handle?.stack) {
        for (const l of layer.handle.stack) walk(l);
      }
    };

    for (const layer of stack) walk(layer);
    return n;
  } catch {
    return null;
  }
}

function attachMongoLogs() {
  const c = mongoose.connection;

  c.on("connecting", () => log("INFO", "mongo", "connecting"));
  c.on("connected", () => log("INFO", "mongo", "connected"));
  c.on("open", () => log("INFO", "mongo", "connection open (ready)"));
  c.on("reconnected", () => log("WARN", "mongo", "reconnected"));
  c.on("disconnected", () => log("WARN", "mongo", "disconnected"));
  c.on("error", (err) =>
    log("ERROR", "mongo", "connection error", { message: err?.message }),
  );
}

async function pingMongo() {
  try {
    const db = mongoose.connection?.db;
    if (!db) return { ok: false, reason: "NO_DB_HANDLE" };
    await db.admin().ping();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || "PING_FAILED" };
  }
}

async function bootstrap() {
  const bootAt = Date.now();

  const nodeEnv = String(process.env.NODE_ENV || env.nodeEnv || "development");
  const port = Number(process.env.PORT || env.port || 8011);

  log("INFO", "boot", "starting", {
    node: process.version,
    pid: process.pid,
    env: nodeEnv,
    host: os.hostname(),
    platform: process.platform,
  });

  // Loga URI mascarada (se existir em env)
  const mongoUri =
    process.env.MONGO_URL ||
    process.env.MONGODB_URI ||
    env.mongoUrl ||
    env.mongoUri ||
    "";

  attachMongoLogs();
  log("INFO", "mongo", "init connectMongo()", {
    uri: mongoUri ? maskMongoUri(mongoUri) : "(not logged)",
  });

  const mongoAt = Date.now();
  await connectMongo();
  const mongoMs = Date.now() - mongoAt;

  const ping = await pingMongo();
  log("INFO", "mongo", "ready", { ms: mongoMs, ping });

  const appAt = Date.now();
  const app = createApp();
  const appMs = Date.now() - appAt;

  const routes = countRoutes(app);
  log("INFO", "app", "created", { ms: appMs, routes });

  const server = app.listen(port, "0.0.0.0", () => {
    log("INFO", "http", "listening", {
      bind: "0.0.0.0",
      port,
      uptimeMs: Date.now() - bootAt,
    });
    log("INFO", "boot", "startup OK");
  });

  server.on("error", (err) => {
    log("ERROR", "http", "listen error", {
      message: err?.message,
      code: err?.code,
    });
    process.exitCode = 1;
  });

  // Shutdown limpo (Render/PM2/K8s mandam SIGTERM)
  const shutdown = async (signal) => {
    log("WARN", "shutdown", `signal received: ${signal}`);

    await new Promise((resolve) => {
      server.close(() => {
        log("INFO", "http", "server closed");
        resolve();
      });
    });

    try {
      await mongoose.disconnect();
      log("INFO", "mongo", "disconnected (shutdown)");
    } catch (e) {
      log("ERROR", "mongo", "disconnect failed", { message: e?.message });
    }

    log("INFO", "shutdown", "done");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Captura erros que normalmente “matam” o processo sem contexto
  process.on("unhandledRejection", (reason) => {
    log("ERROR", "process", "unhandledRejection", {
      reason: String(reason?.message || reason),
    });
  });

  process.on("uncaughtException", (err) => {
    log("ERROR", "process", "uncaughtException", { message: err?.message });
    // em uncaughtException o estado do app pode ficar inconsistente
    shutdown("uncaughtException").catch(() => process.exit(1));
  });
}

bootstrap().catch((err) => {
  log("ERROR", "boot", "startup failed", { message: err?.message });
  process.exit(1);
});
