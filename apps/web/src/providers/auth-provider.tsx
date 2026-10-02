import { useEffect, useMemo, useState, type ReactNode } from "react";
import { foodmeApi } from "@/api/foodme";
import { ApiRequestError } from "@/api/client";
import {
  AUTH_CHANGED_EVENT,
  clearStoredAuth,
  readStoredAuth,
  writeStoredAuth,
} from "@/lib/auth-storage";
import { AuthContext, type AuthContextValue } from "@/providers/auth-context";

function readState() {
  const stored = readStoredAuth();
  return {
    token: stored?.token ?? null,
    customer: stored?.customer ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [{ token, customer }, setState] = useState(readState);

  useEffect(() => {
    const sync = () => setState(readState());
    window.addEventListener("storage", sync);
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    void foodmeApi.getMe().then((profile) => {
      const stored = readStoredAuth();
      if (!stored) return;
      writeStoredAuth({ token: stored.token, customer: profile });
    }).catch((error) => {
      if (error instanceof ApiRequestError && error.status === 401) {
        clearStoredAuth();
      }
    });
  }, [token]);

  const value = useMemo<AuthContextValue>(() => ({
    customer,
    token,
    isAuthenticated: Boolean(token && customer),
    login: async (payload) => {
      writeStoredAuth(await foodmeApi.login(payload));
    },
    register: async (payload) => {
      writeStoredAuth(await foodmeApi.register(payload));
    },
    logout: () => {
      clearStoredAuth();
    },
  }), [customer, token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
