// src/app/AuthContext.jsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as authApi from "./authApi.js";

const AuthCtx = createContext(null);
const TOKEN_KEY = "auth_token";

function derivePerms(workspace) {
  const plan = workspace?.plan || "free";
  return {
    plan,
    isPremium: plan === "premium",
    store: plan === "premium", // ✅ Sua Loja
  };
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) || "" : "",
  );
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(() => {
    if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUser(null);
    setWorkspace(null);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!token) {
      setUser(null);
      setWorkspace(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const d = await authApi.me();
      setUser(d?.user || null);
      setWorkspace(d?.workspace || null);
    } catch (e) {
      if (e?.status === 401) signOut();
      setUser(null);
      setWorkspace(null);
    } finally {
      setLoading(false);
    }
  }, [token, signOut]);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const signIn = useCallback(
    async ({ email, password }) => {
      const d = await authApi.login({ email, password });
      if (typeof window !== "undefined")
        localStorage.setItem(TOKEN_KEY, d.token);
      setToken(d.token);
      await refreshMe();
      return d;
    },
    [refreshMe],
  );

  const signUp = useCallback(
    async ({ name, email, password, workspaceName, plan }) => {
      const d = await authApi.register({
        name,
        email,
        password,
        workspaceName,
        plan, // ✅ free | premium
      });
      if (typeof window !== "undefined")
        localStorage.setItem(TOKEN_KEY, d.token);
      setToken(d.token);
      await refreshMe();
      return d;
    },
    [refreshMe],
  );

  const perms = useMemo(() => derivePerms(workspace), [workspace]);

  const value = useMemo(
    () => ({
      user,
      workspace,
      perms,
      token,
      loading,
      signIn,
      signUp,
      signOut,
      refreshMe,
    }),
    [
      user,
      workspace,
      perms,
      token,
      loading,
      signIn,
      signUp,
      signOut,
      refreshMe,
    ],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
