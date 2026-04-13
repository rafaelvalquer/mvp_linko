import os from "node:os";
import process from "node:process";
import mongoose from "mongoose";

import { connectMongo } from "./src/config/mongo.js";
import { env } from "./src/config/env.js";
import { startBackgroundRunners, stopBackgroundRunners } from "./src/services/backgroundRunners.js";

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
  return String(uri).replace(/\/\/([^:/]+):([^@]+)@/g, "//***:***@");
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
  } catch (error) {
    return { ok: false, reason: error?.message || "PING_FAILED" };
  }
}

async function bootstrap() {
  const bootAt = Date.now();

  log("INFO", "boot", "starting worker", {
    node: process.version,
    pid: process.pid,
    env: env.nodeEnv,
    role: env.appRole,
    host: os.hostname(),
    platform: process.platform,
  });

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

  startBackgroundRunners();
  log("INFO", "worker", "background runners ready", {
    uptimeMs: Date.now() - bootAt,
  });

  const shutdown = async (signal) => {
    log("WARN", "shutdown", `signal received: ${signal}`);

    stopBackgroundRunners();

    try {
      await mongoose.disconnect();
      log("INFO", "mongo", "disconnected (shutdown)");
    } catch (error) {
      log("ERROR", "mongo", "disconnect failed", { message: error?.message });
    }

    log("INFO", "shutdown", "done");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    log("ERROR", "process", "unhandledRejection", {
      reason: String(reason?.message || reason),
    });
  });

  process.on("uncaughtException", (error) => {
    log("ERROR", "process", "uncaughtException", { message: error?.message });
    shutdown("uncaughtException").catch(() => process.exit(1));
  });
}

bootstrap().catch((error) => {
  log("ERROR", "boot", "startup failed", { message: error?.message });
  process.exit(1);
});
