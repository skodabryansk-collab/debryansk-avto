import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { isLoggedIn, logoutAdmin } from "./api";

interface AuthContextType {
  authenticated: boolean;
  setAuthenticated: (v: boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({ authenticated: false, setAuthenticated: () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(isLoggedIn());
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setAuthenticated(isLoggedIn());
    setLoading(false);
  }, []);
  const logout = () => {
    logoutAdmin();
    setAuthenticated(false);
  };
  return (
    <AuthContext.Provider value={{ authenticated, setAuthenticated, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }

export function RequireAuth({ children }: { children: ReactNode }) {
  const { authenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    setChecked(true);
    if (!authenticated) setLocation("/login");
  }, [authenticated, setLocation]);
  if (!checked || !authenticated) return null;
  return <>{children}</>;
}
