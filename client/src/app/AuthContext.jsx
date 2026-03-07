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

function extractToken(data) {
  return (
    data?.token ||
    data?.accessToken ||
    data?.authToken ||
    data?.auth_token ||
    data?.jwt ||
    ""
  );
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
    planStatus: ws.planStatus || "free",
    subscription: ws.subscription || null,
  };
}

function normalizeBilling(bRaw) {
  const b = bRaw && typeof bRaw === "object" ? bRaw : null;
  if (!b?.ok) return null;
  return {
    ok: true,
    plan: b.plan,
    pixMonthlyLimit: b.pixMonthlyLimit,
    pixUsedThisCycle: b.pixUsedThisCycle,
    pixRemaining: b.pixRemaining,
    cycleKey: b.cycleKey,
    planStatus: b.planStatus,
    subscription: b.subscription || null,
  };
}

export function AuthProvider({ children }) {
  const [loadingMe, setLoadingMe] = useState(true);
  const [loadingBilling, setLoadingBilling] = useState(false);

  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [billing, setBilling] = useState(null);

  const clearSession = useCallback(() => {
    setToken("");
    setUser(null);
    setWorkspace(null);
    setBilling(null);
    setLoadingMe(false);
    setLoadingBilling(false);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const refreshBilling = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setBilling(null);
      return null;
    }

    setLoadingBilling(true);
    try {
      const s = await api("/billing/stripe/status");
      const b = normalizeBilling(s);
      setBilling(b);

      if (b) {
        setWorkspace((prev) => {
          const base = prev && typeof prev === "object" ? prev : {};
          return normalizeWorkspace({
            ...base,
            plan: b.plan ?? base.plan,
            pixMonthlyLimit: b.pixMonthlyLimit ?? base.pixMonthlyLimit,
            pixUsedThisCycle: b.pixUsedThisCycle ?? base.pixUsedThisCycle,
            pixRemaining: b.pixRemaining ?? base.pixRemaining,
            cycleKey: b.cycleKey ?? base.cycleKey,
            planStatus: b.planStatus ?? base.planStatus,
            subscription: b.subscription ?? base.subscription,
          });
        });
      }

      return b;
    } catch {
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

      refreshBilling().catch(() => {});
      return ws;
    } catch (e) {
      if (e?.status === 401) clearSession();
      return null;
    } finally {
      setLoadingMe(false);
    }
  }, [refreshBilling, clearSession]);

  const applyAuthenticatedSession = useCallback(
    async (data) => {
      const token = extractToken(data);
      if (token) setToken(token);

      const ws = normalizeWorkspace(data?.workspace || data?.user?.workspace);
      setUser(data?.user || null);
      setWorkspace(ws);
      setLoadingMe(false);

      if (!ws && token) {
        await refreshWorkspace();
      }

      if (token) {
        refreshBilling().catch(() => {});
      }

      return data;
    },
    [refreshWorkspace, refreshBilling],
  );

  const signIn = useCallback(
    async ({ email, password }) => {
      const d = await authApi.login({ email, password });
      return applyAuthenticatedSession(d);
    },
    [applyAuthenticatedSession],
  );

  const signUp = useCallback(
    async ({ name, email, password, workspaceName }) => {
      setLoadingMe(false);

      return authApi.register({
        name,
        email,
        password,
        workspaceName,
      });
    },
    [],
  );

  const resendRegisterCode = useCallback(async ({ email }) => {
    return api("/auth/register/resend-code", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }, []);

  const verifyRegisterCode = useCallback(
    async ({ email, code }) => {
      const d = await api("/auth/register/verify-code", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });

      return applyAuthenticatedSession(d);
    },
    [applyAuthenticatedSession],
  );

  useEffect(() => {
    refreshWorkspace();
  }, [refreshWorkspace]);

  const subscriptionStatus =
    billing?.subscription?.status ||
    workspace?.subscription?.status ||
    "inactive";

  const canCreatePix = subscriptionStatus === "active";

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
      isAuthenticated: !!user,
      subscriptionStatus,
      canCreatePix,
      perms,
      signIn,
      login: signIn,
      signUp,
      register: signUp,
      requestRegisterCode: signUp,
      resendRegisterCode,
      verifyRegisterCode,
      completeSignUp: verifyRegisterCode,
      signOut,
      logout: signOut,
      refreshWorkspace,
      refreshMe: refreshWorkspace,
      refreshBilling,
      refreshSession: refreshWorkspace,
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
      resendRegisterCode,
      verifyRegisterCode,
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
