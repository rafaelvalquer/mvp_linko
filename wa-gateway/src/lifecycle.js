export function createGatewayRuntime({ config, telemetry, now = () => new Date() }) {
  const runtime = {
    state: "INIT",
    waSessionState: "INIT",
    phone: null,
    lastSeen: now().toISOString(),
    latestQr: null,
    latestQrAt: null,
    lastError: null,
    lastErrorAt: null,
    lastDisconnectReason: null,
    lastDisconnectAt: null,
    reconnectAttempts: 0,
    reconnectCount: 0,
    disconnectCount: 0,
    nextReconnectAt: null,
    reconnectDelayMs: null,
    reconnectTimer: null,
    clientGeneration: 0,
    isInitializing: false,
    waReady: false,
    readySinceAt: null,
    forwardDegraded: false,
    lastForwardError: null,
    lastForwardErrorAt: null,
    lastForwardOkAt: null,
    watchdogTimer: null,
    bootValidation: null,
  };

  function isoNow() {
    return now().toISOString();
  }

  function touch() {
    runtime.lastSeen = isoNow();
  }

  function clearReconnectSchedule() {
    if (runtime.reconnectTimer) {
      clearTimeout(runtime.reconnectTimer);
      runtime.reconnectTimer = null;
    }
    runtime.nextReconnectAt = null;
    runtime.reconnectDelayMs = null;
  }

  function resetReconnectState() {
    clearReconnectSchedule();
    runtime.reconnectAttempts = 0;
  }

  function setLastError(where, err) {
    runtime.lastErrorAt = isoNow();
    runtime.lastError = `${where}: ${err?.message || String(err)}`;
    touch();
  }

  function setState(nextState, extras = {}) {
    runtime.state = nextState;
    Object.assign(runtime, extras);
    touch();
  }

  function markBootValidation(result) {
    runtime.bootValidation = result || null;

    if (result?.ok === false && result?.errors?.length) {
      const first = result.errors[0];
      runtime.state = String(first?.code || "MISCONFIGURED").toUpperCase();
      runtime.lastError = first?.message || "Configuracao invalida.";
      runtime.lastErrorAt = isoNow();
    }
  }

  function markDisconnected(reason, nextState = "DISCONNECTED") {
    runtime.state = nextState;
    runtime.waReady = false;
    runtime.readySinceAt = null;
    runtime.lastDisconnectAt = isoNow();
    runtime.lastDisconnectReason = String(reason?.message || reason || "unknown");
    runtime.disconnectCount += 1;
    touch();
  }

  function markForwardFailure(error) {
    runtime.forwardDegraded = true;
    runtime.lastForwardError = String(error?.message || error || "FORWARD_FAILED");
    runtime.lastForwardErrorAt = isoNow();

    if (runtime.waReady) {
      runtime.state = "FORWARD_DEGRADED";
    }
    touch();
  }

  function markForwardRecovered() {
    runtime.forwardDegraded = false;
    runtime.lastForwardError = null;
    runtime.lastForwardErrorAt = null;
    runtime.lastForwardOkAt = isoNow();

    if (runtime.waReady) {
      runtime.state = "READY";
    }
    touch();
  }

  function noteQr(qr) {
    runtime.state = "QR";
    runtime.waSessionState = "QR";
    runtime.latestQr = qr;
    runtime.latestQrAt = isoNow();
    runtime.waReady = false;
    runtime.readySinceAt = null;
    touch();
    telemetry.incrementCounter("wa_qr_generated_total");
  }

  function noteReady(phoneDigits) {
    runtime.state = runtime.forwardDegraded ? "FORWARD_DEGRADED" : "READY";
    runtime.waSessionState = "READY";
    runtime.phone = phoneDigits || null;
    runtime.latestQr = null;
    runtime.latestQrAt = null;
    runtime.lastError = null;
    runtime.lastErrorAt = null;
    runtime.lastDisconnectReason = null;
    runtime.lastDisconnectAt = null;
    runtime.waReady = true;
    runtime.readySinceAt = isoNow();
    resetReconnectState();
    touch();
  }

  function scheduleReconnect(reason, handler) {
    clearReconnectSchedule();
    runtime.reconnectAttempts += 1;
    runtime.reconnectDelayMs = Math.min(
      config.reconnect.maxMs,
      config.reconnect.baseMs * 2 ** (runtime.reconnectAttempts - 1),
    );
    runtime.nextReconnectAt = new Date(
      Date.now() + runtime.reconnectDelayMs,
    ).toISOString();

    telemetry.incrementCounter("wa_reconnect_scheduled_total");

    runtime.reconnectTimer = setTimeout(() => {
      runtime.reconnectTimer = null;
      runtime.nextReconnectAt = null;
      runtime.reconnectDelayMs = null;
      runtime.reconnectCount += 1;
      handler();
    }, runtime.reconnectDelayMs);

    telemetry.log("warn", "reconnect_scheduled", {
      reason: String(reason || "unknown"),
      attempt: runtime.reconnectAttempts,
      delayMs: runtime.reconnectDelayMs,
      nextReconnectAt: runtime.nextReconnectAt,
    });
  }

  function startWatchdog(handler) {
    if (!config.watchdog.enabled || runtime.watchdogTimer) return;

    runtime.watchdogTimer = setInterval(() => {
      void handler();
    }, config.watchdog.intervalMs);
  }

  function stopWatchdog() {
    if (!runtime.watchdogTimer) return;
    clearInterval(runtime.watchdogTimer);
    runtime.watchdogTimer = null;
  }

  function snapshot(extra = {}) {
    return {
      ...runtime,
      ...extra,
    };
  }

  return {
    runtime,
    touch,
    setState,
    setLastError,
    markBootValidation,
    markDisconnected,
    markForwardFailure,
    markForwardRecovered,
    noteQr,
    noteReady,
    clearReconnectSchedule,
    resetReconnectState,
    scheduleReconnect,
    startWatchdog,
    stopWatchdog,
    snapshot,
  };
}

