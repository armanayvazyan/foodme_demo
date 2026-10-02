import { createContext, useContext } from "react";
import type { CustomerLoginRequest, CustomerProfile, CustomerRegisterRequest } from "@/types";

export interface AuthContextValue {
  customer: CustomerProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (payload: CustomerLoginRequest) => Promise<void>;
  register: (payload: CustomerRegisterRequest) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
