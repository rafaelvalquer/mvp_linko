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
  };
}

export function AuthProvider({ children }) {
  const [loadingMe, setLoadingMe] = useState(true);
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);

  const signOut = useCallback(() => {
    setToken("");
    setUser(null);
    setWorkspace(null);
    setLoadingMe(false);
  }, []);

  const refreshWorkspace = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setLoadingMe(false);
      setUser(null);
      setWorkspace(null);
      return null;
    }

    setLoadingMe(true);
    try {
      const d = await authApi.me();
      const ws = normalizeWorkspace(d?.workspace || d?.user?.workspace);
      setUser(d?.user || null);
      setWorkspace(ws);
      return ws;
    } catch (e) {
      if (e?.status === 401) signOut();
      return null;
    } finally {
      setLoadingMe(false);
    }
  }, [signOut]);

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

      // se login não vier completo, busca /me
      if (!ws) await refreshWorkspace();
      return d;
    },
    [refreshWorkspace],
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
      return d;
    },
    [refreshWorkspace],
  );

  // boot: se houver token, carrega /me
  useEffect(() => {
    refreshWorkspace();
  }, [refreshWorkspace]);

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
      user,
      workspace,
      perms,
      signIn,
      signUp, // ✅ exporta
      signOut,
      refreshWorkspace,
    }),
    [
      loadingMe,
      user,
      workspace,
      perms,
      signIn,
      signUp,
      signOut,
      refreshWorkspace,
    ],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
