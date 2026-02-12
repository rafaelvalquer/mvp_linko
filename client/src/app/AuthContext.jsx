//src/app/AuthContext.jsx

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

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) || "" : "",
  );
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(() => {
    if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const d = await authApi.me();
      setUser(d?.user || null);
    } catch (e) {
      if (e?.status === 401) signOut();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token, signOut]);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const signIn = useCallback(async ({ email, password }) => {
    const d = await authApi.login({ email, password });
    if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, d.token);
    setToken(d.token);
    await authApi.me().then((meRes) => setUser(meRes.user));
    return d;
  }, []);

  const signUp = useCallback(
    async ({ name, email, password, workspaceName }) => {
      const d = await authApi.register({
        name,
        email,
        password,
        workspaceName,
      });
      if (typeof window !== "undefined")
        localStorage.setItem(TOKEN_KEY, d.token);
      setToken(d.token);
      await authApi.me().then((meRes) => setUser(meRes.user));
      return d;
    },
    [],
  );

  const value = useMemo(
    () => ({ user, token, loading, signIn, signUp, signOut, refreshMe }),
    [user, token, loading, signIn, signUp, signOut, refreshMe],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
