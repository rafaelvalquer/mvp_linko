function mean(values = []) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + (Number(value) || 0), 0);
  return total / values.length;
}

function percentile(values = [], p = 0.95) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * p) - 1),
  );
  return sorted[index] || 0;
}

function sanitizeDetails(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(sanitizeDetails);

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, sanitizeDetails(item)])
        .filter(([, item]) => item !== undefined),
    );
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  return value;
}

export function createTelemetry({ recentEventsLimit = 200 } = {}) {
  const counters = new Map();
  const gauges = new Map();
  const timings = new Map();
  const recentEvents = [];

  function incrementCounter(name, delta = 1) {
    const next = (counters.get(name) || 0) + delta;
    counters.set(name, next);
    return next;
  }

  function setGauge(name, value) {
    gauges.set(name, Number(value) || 0);
  }

  function observeTiming(name, valueMs) {
    const numeric = Number(valueMs) || 0;
    const current = timings.get(name) || [];
    current.push(numeric);
    if (current.length > 1000) {
      current.splice(0, current.length - 1000);
    }
    timings.set(name, current);
  }

  function pushRecentEvent(entry) {
    recentEvents.push(entry);
    if (recentEvents.length > recentEventsLimit) {
      recentEvents.splice(0, recentEvents.length - recentEventsLimit);
    }
  }

  function log(level, event, details = {}) {
    const entry = {
      at: new Date().toISOString(),
      level,
      event,
      ...sanitizeDetails(details),
    };

    pushRecentEvent(entry);

    const serialized = JSON.stringify({
      service: "wa-gateway",
      ...entry,
    });

    if (level === "error") {
      console.error(serialized);
    } else if (level === "warn" || level === "warning") {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }

    return entry;
  }

  function getRecentEvents(limit = 50) {
    const normalizedLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
    return recentEvents.slice(-normalizedLimit).reverse();
  }

  function getTimingSummary(name) {
    const values = timings.get(name) || [];
    return {
      count: values.length,
      avgMs: Math.round(mean(values)),
      p95Ms: Math.round(percentile(values, 0.95)),
      maxMs: values.length ? Math.max(...values) : 0,
    };
  }

  function getSnapshot() {
    const countersObject = Object.fromEntries(counters.entries());
    const gaugesObject = Object.fromEntries(gauges.entries());
    const timingsObject = Object.fromEntries(
      [...timings.keys()].map((key) => [key, getTimingSummary(key)]),
    );

    return {
      counters: countersObject,
      gauges: gaugesObject,
      timings: timingsObject,
      recentEvents: getRecentEvents(),
    };
  }

  function renderPrometheusMetrics(extraGauges = {}) {
    const lines = [];

    for (const [name, value] of counters.entries()) {
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${value}`);
    }

    for (const [name, value] of gauges.entries()) {
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    }

    for (const [name, summary] of Object.entries(extraGauges || {})) {
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${Number(summary) || 0}`);
    }

    for (const [name] of timings.entries()) {
      const summary = getTimingSummary(name);
      lines.push(`# TYPE ${name}_avg_ms gauge`);
      lines.push(`${name}_avg_ms ${summary.avgMs}`);
      lines.push(`# TYPE ${name}_p95_ms gauge`);
      lines.push(`${name}_p95_ms ${summary.p95Ms}`);
      lines.push(`# TYPE ${name}_max_ms gauge`);
      lines.push(`${name}_max_ms ${summary.maxMs}`);
      lines.push(`# TYPE ${name}_count gauge`);
      lines.push(`${name}_count ${summary.count}`);
    }

    return `${lines.join("\n")}\n`;
  }

  return {
    incrementCounter,
    setGauge,
    observeTiming,
    log,
    getRecentEvents,
    getTimingSummary,
    getSnapshot,
    renderPrometheusMetrics,
  };
}

