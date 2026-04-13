import crypto from "node:crypto";
import os from "node:os";
import process from "node:process";

import { BackgroundLease } from "../models/BackgroundLease.js";
import { env } from "../config/env.js";

const DEFAULT_LEASE_TTL_MS = 60 * 1000;
const LEASE_HOLDER_ID = `${os.hostname()}:${process.pid}`;

function now() {
  return new Date();
}

function normalizeTtlMs(value, fallback = DEFAULT_LEASE_TTL_MS) {
  return Math.max(5_000, Number(value) || fallback);
}

function buildLeaseExpiry(ttlMs) {
  return new Date(Date.now() + normalizeTtlMs(ttlMs));
}

function logLease(level, message, extra = {}) {
  const payload = {
    role: env.appRole,
    holderId: LEASE_HOLDER_ID,
    ...extra,
  };

  if (level === "error") {
    console.error("[distributed-lease]", message, payload);
    return;
  }

  if (level === "warn") {
    console.warn("[distributed-lease]", message, payload);
    return;
  }

  console.log("[distributed-lease]", message, payload);
}

export async function acquireDistributedLease({
  key,
  ttlMs = DEFAULT_LEASE_TTL_MS,
  meta = null,
  holderId = LEASE_HOLDER_ID,
} = {}) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) {
    throw new Error("Lease key is required");
  }

  const acquiredAt = now();
  const lockId = crypto.randomUUID();
  const expiresAt = new Date(acquiredAt.getTime() + normalizeTtlMs(ttlMs));

  try {
    const lease = await BackgroundLease.findOneAndUpdate(
      {
        key: normalizedKey,
        $or: [
          { expiresAt: { $lte: acquiredAt } },
          { expiresAt: null },
        ],
      },
      {
        $set: {
          holderId,
          lockId,
          expiresAt,
          meta,
          acquiredAt,
        },
        $setOnInsert: {
          key: normalizedKey,
        },
      },
      {
        new: true,
        upsert: true,
        strict: false,
      },
    ).lean();

    if (!lease?.lockId || lease.lockId !== lockId) return null;

    return {
      key: normalizedKey,
      holderId,
      lockId,
      expiresAt,
      meta,
    };
  } catch (error) {
    if (Number(error?.code) === 11000) {
      return null;
    }
    throw error;
  }
}

export async function renewDistributedLease({
  key,
  lockId,
  ttlMs = DEFAULT_LEASE_TTL_MS,
  holderId = LEASE_HOLDER_ID,
} = {}) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey || !lockId) return false;

  const nextExpiry = buildLeaseExpiry(ttlMs);
  const result = await BackgroundLease.updateOne(
    {
      key: normalizedKey,
      lockId,
      holderId,
      expiresAt: { $gt: now() },
    },
    {
      $set: {
        expiresAt: nextExpiry,
      },
    },
    { strict: false },
  ).catch(() => null);

  return Number(result?.modifiedCount || 0) > 0;
}

export async function releaseDistributedLease({
  key,
  lockId,
  holderId = LEASE_HOLDER_ID,
} = {}) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey || !lockId) return false;

  const result = await BackgroundLease.deleteOne({
    key: normalizedKey,
    lockId,
    holderId,
  }).catch(() => null);

  return Number(result?.deletedCount || 0) > 0;
}

export async function runWithDistributedLease(
  {
    key,
    ttlMs = DEFAULT_LEASE_TTL_MS,
    meta = null,
    holderId = LEASE_HOLDER_ID,
    onLeaseUnavailable = null,
    renewLabel = "",
  } = {},
  task,
) {
  const lease = await acquireDistributedLease({
    key,
    ttlMs,
    meta,
    holderId,
  });

  if (!lease) {
    if (typeof onLeaseUnavailable === "function") {
      return onLeaseUnavailable();
    }
    return null;
  }

  const renewEveryMs = Math.max(5_000, Math.floor(normalizeTtlMs(ttlMs) / 3));
  const heartbeat = setInterval(async () => {
    try {
      const renewed = await renewDistributedLease({
        key: lease.key,
        lockId: lease.lockId,
        ttlMs,
        holderId: lease.holderId,
      });

      if (!renewed) {
        logLease("warn", "lease heartbeat lost", {
          key: lease.key,
          lockId: lease.lockId,
          renewLabel,
          reason: "renew_failed",
        });
      }
    } catch (error) {
      logLease("error", "lease heartbeat error", {
        key: lease.key,
        lockId: lease.lockId,
        renewLabel,
        message: String(error?.message || error),
      });
    }
  }, renewEveryMs);

  heartbeat.unref?.();

  try {
    return await task(lease);
  } finally {
    clearInterval(heartbeat);
    await releaseDistributedLease({
      key: lease.key,
      lockId: lease.lockId,
      holderId: lease.holderId,
    }).catch(() => {});
  }
}
