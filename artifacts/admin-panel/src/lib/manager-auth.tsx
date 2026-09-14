import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";

const MANAGER_TOKEN_KEY = "manager_token";
const MANAGER_NAME_KEY = "manager_name";
const ADMIN_TOKEN_KEY = "admin_token";

export function isAdminUsingManagerPortal(): boolean {
  return !localStorage.getItem(MANAGER_TOKEN_KEY) && !!localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function getManagerToken(): string | null {
  return localStorage.getItem(MANAGER_TOKEN_KEY) || localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function isManagerLoggedIn(): boolean {
  return !!localStorage.getItem(MANAGER_TOKEN_KEY) || !!localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function logoutManager() {
  localStorage.removeItem(MANAGER_TOKEN_KEY);
  localStorage.removeItem(MANAGER_NAME_KEY);
}

export async function loginManager(login: string, password: string): Promise<string> {
  const res = await fetch("/api/manager/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Ошибка входа" }));
    throw new Error(err.error || "Ошибка входа");
  }
  const data = await res.json();
  localStorage.setItem(MANAGER_TOKEN_KEY, data.token);
  localStorage.setItem(MANAGER_NAME_KEY, data.name || "");
  return data.token;
}

export function getManagerName(): string {
  if (isAdminUsingManagerPortal()) return "Администратор";
  return localStorage.getItem(MANAGER_NAME_KEY) || "Менеджер";
}

async function managerApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getManagerToken();
  const res = await fetch(`/api/manager${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface CarSearchResult {
  id: number;
  externalId: string;
  type: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  modification: string | null;
  complectation: string | null;
  color: string | null;
  price: number | null;
  imageUrl: string | null;
  vin: string | null;
  dealer: string | null;
  bodyType: string | null;
}

export interface QuoteDiscount { label: string; value: number; }

export interface QuoteHistoryItem {
  id: number;
  carId: string;
  carType: string;
  carSnapshot: Record<string, unknown>;
  clientName: string;
  clientPhone: string;
  clientGender: "male" | "female" | null;
  discounts: QuoteDiscount[];
  priceOriginal: number;
  priceFinal: number;
  validUntil: string;
  extraEquipment: QuoteExtraEquipment | null;
  extraAddToRrp: boolean;
  creditOffer: QuoteCreditOffer | null;
  tradeIn: QuoteTradeIn | null;
  pdfUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export function searchCars(opts: {
  q?: string; brand?: string; model?: string; type?: string;
}): Promise<{ ok: boolean; data: CarSearchResult[] }> {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.brand) params.set("brand", opts.brand);
  if (opts.model) params.set("model", opts.model);
  if (opts.type) params.set("type", opts.type);
  return managerApi("GET", `/cars/search?${params}`);
}

export function fetchCarBrands(type?: string): Promise<{ ok: boolean; data: string[] }> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  return managerApi("GET", `/cars/brands?${params}`);
}

export function fetchCarModels(brand: string, type?: string): Promise<{ ok: boolean; data: string[] }> {
  const params = new URLSearchParams({ brand });
  if (type) params.set("type", type);
  return managerApi("GET", `/cars/models?${params}`);
}

export interface QuoteExtraEquipment { text: string; price?: number; }
export interface QuoteCreditOffer {
  term: string;
  rate: string;
  monthlyPayment: number;
  downPayment?: number;
}
export interface QuoteTradeIn { priceFrom?: number; priceTo?: number; }

export function createQuote(data: {
  carId: string; carType: string; clientName: string; clientPhone: string;
  clientGender?: "male" | "female";
  discounts: QuoteDiscount[]; validUntil: string;
  priceOverride?: number;
  extraEquipment?: QuoteExtraEquipment;
  extraAddToRrp?: boolean;
  creditOffer?: QuoteCreditOffer;
  tradeIn?: QuoteTradeIn;
}): Promise<{ ok: boolean; quoteId: number; pdfUrl: string | null }> {
  return managerApi("POST", "/quotes", data);
}

export function getMyQuotes(): Promise<{ ok: boolean; data: QuoteHistoryItem[] }> {
  return managerApi("GET", "/quotes");
}

export function updateQuote(quoteId: number, data: {
  clientName: string; clientPhone: string;
  clientGender?: "male" | "female";
  discounts: QuoteDiscount[]; validUntil: string;
  priceOverride?: number;
  extraEquipment?: QuoteExtraEquipment;
  creditOffer?: QuoteCreditOffer;
  tradeIn?: QuoteTradeIn;
}): Promise<{ ok: boolean; quoteId: number; pdfUrl: string | null }> {
  return managerApi("PUT", `/quotes/${quoteId}`, data);
}

export function regenerateQuotePdf(quoteId: number): Promise<{ ok: boolean; quoteId: number; pdfUrl: string }> {
  return managerApi("POST", `/quotes/${quoteId}/pdf`);
}

export function createQuoteShareLink(quoteId: number): Promise<{
  ok: boolean;
  shareUrl: string;
  expiresAt: string;
}> {
  return managerApi("POST", `/quotes/${quoteId}/share-link`);
}

export function pdfDownloadUrl(quoteId: number): string {
  const token = getManagerToken() ?? "";
  return `/api/manager/quotes/${quoteId}/pdf?token=${encodeURIComponent(token)}`;
}

interface ManagerAuthContextType {
  authenticated: boolean;
  setAuthenticated: (v: boolean) => void;
  logout: () => void;
}

const ManagerAuthContext = createContext<ManagerAuthContextType>({
  authenticated: false,
  setAuthenticated: () => {},
  logout: () => {},
});

export function ManagerAuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(isManagerLoggedIn());
  const logout = () => { logoutManager(); setAuthenticated(false); };
  return (
    <ManagerAuthContext.Provider value={{ authenticated, setAuthenticated, logout }}>
      {children}
    </ManagerAuthContext.Provider>
  );
}

export function useManagerAuth() { return useContext(ManagerAuthContext); }

export function RequireManagerAuth({ children }: { children: ReactNode }) {
  const { authenticated } = useManagerAuth();
  const [, setLocation] = useLocation();
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    setChecked(true);
    if (!authenticated) setLocation("/manager/login");
  }, [authenticated, setLocation]);
  if (!checked || !authenticated) return null;
  return <>{children}</>;
}
