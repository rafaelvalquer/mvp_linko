const runtimeRegistry = new Map();

function now() {
  return new Date();
}

function toPlainObject(value) {
  if (value == null) return null;
  if (typeof value !== "object") return value;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { value: String(value) };
  }
}

function buildErrorPayload(error) {
  if (!error) return null;
  return {
    message: String(error?.message || error),
    code: String(error?.code || error?.name || "RUNTIME_ERROR"),
    details: toPlainObject(error?.details || null),
    at: now().toISOString(),
  };
}

function ensureRuntime(name, patch = {}) {
  const existing = runtimeRegistry.get(name);
  if (existing) {
    const merged = { ...existing, ...patch };
    runtimeRegistry.set(name, merged);
    return merged;
  }

  const created = {
    name,
    type: "runner",
    started: false,
    running: false,
    registeredAt: now().toISOString(),
    startedAt: null,
    updatedAt: now().toISOString(),
    intervalMs: null,
    lastStartedAt: null,
    lastFinishedAt: null,
    lastSummary: null,
    lastError: null,
    ...patch,
  };
  runtimeRegistry.set(name, created);
  return created;
}

export function registerRuntime(name, patch = {}) {
  const entry = ensureRuntime(name, patch);
  entry.updatedAt = now().toISOString();
  runtimeRegistry.set(name, entry);
  return entry;
}

export function markRuntimeStarted(name, patch = {}) {
  const entry = ensureRuntime(name, patch);
  entry.started = true;
  entry.startedAt = entry.startedAt || now().toISOString();
  entry.updatedAt = now().toISOString();
  runtimeRegistry.set(name, entry);
  return entry;
}

export function markRuntimeCycleStart(name) {
  const entry = ensureRuntime(name);
  entry.running = true;
  entry.lastStartedAt = now().toISOString();
  entry.updatedAt = now().toISOString();
  runtimeRegistry.set(name, entry);
  return entry;
}

export function markRuntimeCycleSuccess(name, summary = null) {
  const entry = ensureRuntime(name);
  entry.running = false;
  entry.lastFinishedAt = now().toISOString();
  entry.lastSummary = toPlainObject(summary);
  entry.lastError = null;
  entry.updatedAt = now().toISOString();
  runtimeRegistry.set(name, entry);
  return entry;
}

export function markRuntimeCycleError(name, error) {
  const entry = ensureRuntime(name);
  entry.running = false;
  entry.lastFinishedAt = now().toISOString();
  entry.lastError = buildErrorPayload(error);
  entry.updatedAt = now().toISOString();
  runtimeRegistry.set(name, entry);
  return entry;
}

export function getRuntimeStatus(name) {
  const entry = ensureRuntime(name);
  return {
    ...entry,
    uptimeMs: entry.startedAt
      ? Math.max(0, Date.now() - new Date(entry.startedAt).getTime())
      : 0,
  };
}

export function listRuntimeStatuses() {
  return Array.from(runtimeRegistry.keys())
    .sort((left, right) => left.localeCompare(right))
    .map((name) => getRuntimeStatus(name));
}
