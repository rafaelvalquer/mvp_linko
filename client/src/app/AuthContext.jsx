// src/app/AuthContext.jsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as authApi from "./authApi.js";
import { api } from "./api.js";
import { getMonthlyLimit, normalizePlan } from "../utils/planQuota.js";

const AuthCtx = createContext(null);

function getToken() {
  try {
    return localStorage.getItem("auth_token") || "";
  } catch {
    return "";
  }
}

function setToken(token) {
  try {
    if (!token) localStorage.removeItem("auth_token");
    else localStorage.setItem("auth_token", token);
  } catch {}
}

function normalizeWorkspace(wsRaw) {
  const ws = wsRaw && typeof wsRaw === "object" ? wsRaw : null;
  if (!ws) return null;

  const plan = normalizePlan(ws.plan);
  const limit = getMonthlyLimit(plan, ws.pixMonthlyLimit);

  const used = Number(ws.pixUsedThisCycle);
  const remaining = Number(ws.pixRemaining);

  const pixUsedThisCycle = Number.isFinite(used) ? used : 0;
  const pixRemaining = Number.isFinite(remaining)
    ? remaining
    : Math.max(0, limit - pixUsedThisCycle);

  return {
    ...ws,
    plan,
    pixMonthlyLimit: limit,
    pixUsedThisCycle,
    pixRemaining,
    cycleKey: ws.cycleKey || "",
    subscription: ws.subscription || null,
  };
}

function normalizeBilling(billingRaw) {
  const b = billingRaw && typeof billingRaw === "object" ? billingRaw : null;
  if (!b?.ok) return null;

  const plan = normalizePlan(b.plan);
  const limit = getMonthlyLimit(plan, b.pixMonthlyLimit);

  const used = Number(b.pixUsedThisCycle);
  const remaining = Number(b.pixRemaining);

  return {
    ok: true,
    plan,
    pixMonthlyLimit: Number.isFinite(limit) ? limit : 0,
    pixUsedThisCycle: Number.isFinite(used) ? used : 0,
    pixRemaining: Number.isFinite(remaining) ? remaining : 0,
    cycleKey: b.cycleKey || "",
    subscription: b.subscription || null,
  };
}

export function AuthProvider({ children }) {
  const [loadingMe, setLoadingMe] = useState(true);
  const [loadingBilling, setLoadingBilling] = useState(false);

  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);

  const [billing, setBilling] = useState(null);

  const signOut = useCallback(() => {
    setToken("");
    setUser(null);
    setWorkspace(null);
    setBilling(null);
    setLoadingMe(false);
    setLoadingBilling(false);
  }, []);

  const refreshBilling = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setBilling(null);
      return null;
    }

    setLoadingBilling(true);
    try {
      const d = await api("/billing/stripe/status");
      const b = normalizeBilling(d);
      setBilling(b);

      // Merge billing -> workspace (para Topbar/QuotaBadge)
      if (b) {
        setWorkspace((prev) => {
          const base = prev && typeof prev === "object" ? prev : {};
          const merged = {
            ...base,
            plan: b.plan,
            pixMonthlyLimit: b.pixMonthlyLimit,
            pixUsedThisCycle: b.pixUsedThisCycle,
            pixRemaining: b.pixRemaining,
            cycleKey: b.cycleKey,
            subscription: b.subscription || base.subscription || null,
          };
          return normalizeWorkspace(merged);
        });
      }

      return b;
    } catch (e) {
      // Se billing ainda não estiver plugado no backend, não derruba o app.
      // Apenas não exibe status.
      setBilling(null);
      return null;
    } finally {
      setLoadingBilling(false);
    }
  }, []);

  const refreshWorkspace = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setLoadingMe(false);
      setUser(null);
      setWorkspace(null);
      setBilling(null);
      return null;
    }

    setLoadingMe(true);
    try {
      const d = await authApi.me();
      const ws = normalizeWorkspace(d?.workspace || d?.user?.workspace);
      setUser(d?.user || null);
      setWorkspace(ws);

      // Carrega billing depois do /me (não bloqueia login)
      refreshBilling().catch(() => {});
      return ws;
    } catch (e) {
      if (e?.status === 401) signOut();
      return null;
    } finally {
      setLoadingMe(false);
    }
  }, [refreshBilling, signOut]);

  const signIn = useCallback(
    async ({ email, password }) => {
      const d = await authApi.login({ email, password });

      const token =
        d?.token ||
        d?.accessToken ||
        d?.authToken ||
        d?.auth_token ||
        d?.jwt ||
        "";

      if (token) setToken(token);

      const ws = normalizeWorkspace(d?.workspace || d?.user?.workspace);
      setUser(d?.user || null);
      setWorkspace(ws);
      setLoadingMe(false);

      if (!ws) await refreshWorkspace();

      // tenta carregar billing sempre após login
      refreshBilling().catch(() => {});
      return d;
    },
    [refreshWorkspace, refreshBilling],
  );

  // ✅ ADD: signUp para o Register.jsx
  const signUp = useCallback(
    async ({ name, email, password, workspaceName, plan, pixMonthlyLimit }) => {
      const d = await authApi.register({
        name,
        email,
        password,
        workspaceName,
        plan,
        pixMonthlyLimit,
      });

      const token =
        d?.token ||
        d?.accessToken ||
        d?.authToken ||
        d?.auth_token ||
        d?.jwt ||
        "";

      if (token) setToken(token);

      const ws = normalizeWorkspace(d?.workspace || d?.user?.workspace);
      setUser(d?.user || null);
      setWorkspace(ws);
      setLoadingMe(false);

      if (!ws) await refreshWorkspace();

      refreshBilling().catch(() => {});
      return d;
    },
    [refreshWorkspace, refreshBilling],
  );

  // boot: se houver token, carrega /me
  useEffect(() => {
    refreshWorkspace();
  }, [refreshWorkspace]);

  const subscriptionStatus =
    billing?.subscription?.status || workspace?.subscription?.status || null;

  // Só bloqueia visualmente se conhecemos o status
  const billingKnown = !!subscriptionStatus;
  const canCreatePix = billingKnown ? subscriptionStatus === "active" : true;

  const perms = useMemo(() => {
    const plan = workspace?.plan || "start";
    const store =
      plan === "pro" || plan === "business" || plan === "enterprise";
    return {
      plan,
      store,
      workspaceId: workspace?._id || workspace?.id || null,
    };
  }, [workspace]);

  const value = useMemo(
    () => ({
      loadingMe,
      loadingBilling,
      user,
      workspace,
      billing,
      subscriptionStatus,
      canCreatePix,
      perms,
      signIn,
      signUp,
      signOut,
      refreshWorkspace,
      refreshBilling,
    }),
    [
      loadingMe,
      loadingBilling,
      user,
      workspace,
      billing,
      subscriptionStatus,
      canCreatePix,
      perms,
      signIn,
      signUp,
      signOut,
      refreshWorkspace,
      refreshBilling,
    ],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
