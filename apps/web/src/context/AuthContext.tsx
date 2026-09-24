import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi, clearAuthSession, getApiErrorMessage } from "../lib/api";
import type { LoginPayload, User } from "../types/api";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearLocalSession = useCallback(() => {
    clearAuthSession();
    void queryClient.cancelQueries();
    queryClient.clear();
    setUser(null);
    setIsLoading(false);
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await authApi.me();
      setUser(currentUser);
    } catch (error) {
      clearLocalSession();
      if (import.meta.env.DEV && error instanceof Error) {
        console.warn("Impossible de restaurer la session", getApiErrorMessage(error));
      }
    } finally {
      setIsLoading(false);
    }
  }, [clearLocalSession]);

  useEffect(() => {
    void refreshUser();
    const handleUnauthorized = () => clearLocalSession();
    window.addEventListener("stockpilot:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("stockpilot:unauthorized", handleUnauthorized);
  }, [clearLocalSession, refreshUser]);

  const login = useCallback(async (payload: LoginPayload) => {
    const result = await authApi.login(payload);
    setUser(result.user);
    setIsLoading(false);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearLocalSession();
    }
  }, [clearLocalSession]);

  const value = useMemo(
    () => ({ user, isLoading, isAuthenticated: Boolean(user), login, logout }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return context;
}
