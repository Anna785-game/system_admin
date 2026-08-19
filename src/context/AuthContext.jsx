import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, bindTokenGetter, ApiError } from "../api/client";

const AuthContext = createContext(null);

const STORAGE_KEY = "admin_session_v1";

function loadStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadStoredSession());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Le client API doit toujours pouvoir lire le token courant, y compris
  // juste après un login (avant que le re-render ait propagé la prop).
  useEffect(() => {
    bindTokenGetter(() => session?.access_token || null);
  }, [session]);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(email, password);
      const role = res.user?.user_metadata?.role || res.user?.role || "user";
      if (role !== "admin") {
        throw new ApiError(
          "Ce compte n'a pas le rôle admin. Connecte-toi avec un compte administrateur.",
          403,
        );
      }
      const next = {
        access_token: res.access_token,
        refresh_token: res.refresh_token,
        email: res.user?.email || email,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSession(next);
      return true;
    } catch (e) {
      setError(e.message || "Échec de connexion");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      isAuthenticated: !!session?.access_token,
      loading,
      error,
      login,
      logout,
    }),
    [session, loading, error, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
