const API_BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("admin_token");
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/* Admin auth */
export async function loginAdmin(login: string, password: string) {
  const { token } = await api<{ token: string }>("POST", "/admin/login", { login, password });
  localStorage.setItem("admin_token", token);
  return token;
}
export function logoutAdmin() { localStorage.removeItem("admin_token"); }
export function isLoggedIn() { return !!getToken(); }

/* Dashboard */
export interface Stats { news: number; leads: number; leadsToday: number; dealers: number; brands: number; users: number; }
export function getStats() { return api<Stats>("GET", "/admin/stats"); }

/* News */
export interface NewsItem {
  id: number; title: string; excerpt: string; content: string; category: string;
  image: string; imageMobile: string | null; slug: string; publishedAt: string; readTime: number;
  createdAt: string; updatedAt: string;
}
export function getNews() { return api<{ data: NewsItem[] }>("GET", "/admin/news").then(r => r.data); }
export function getNewsItem(id: number) { return api<{ data: NewsItem }>("GET", `/admin/news/${id}`).then(r => r.data); }
export function createNews(data: Omit<NewsItem, "id" | "createdAt" | "updatedAt">) { return api<NewsItem>("POST", "/admin/news", data); }
export function updateNews(id: number, data: Partial<NewsItem>) { return api<NewsItem>("PUT", `/admin/news/${id}`, data); }
export function deleteNews(id: number) { return api<{ ok: true }>("DELETE", `/admin/news/${id}`); }

/* Leads */
export interface Lead {
  id: number; type: string; name: string; phone: string; email: string | null;
  message: string | null; car: string | null; extra: string | null; createdAt: string;
}
export function getLeads() { return api<{ data: Lead[] }>("GET", "/admin/leads").then(r => r.data); }
export async function exportLeads() {
  const token = getToken();
  const res = await fetch(`${API_BASE}/admin/leads/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "leads.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* Dealers */
export interface Dealer {
  id: number; address: string; shortName: string; phone: string; hours: string;
  brands: string; brandIds: string | null; photoUrl: string; mapX: number; mapY: number; email: string | null;
}
export function getDealers() { return api<{ data: Dealer[] }>("GET", "/admin/dealers").then(r => r.data); }
export function createDealer(data: Omit<Dealer, "id">) { return api<{ ok: true; data: Dealer }>("POST", "/admin/dealers", data); }
export function updateDealer(id: number, data: Partial<Dealer>) { return api<{ ok: true; data: Dealer }>("PUT", `/admin/dealers/${id}`, data); }
export function deleteDealer(id: number) { return api<{ ok: true }>("DELETE", `/admin/dealers/${id}`); }

/* Brands */
export interface Brand {
  id: number; name: string; slug: string | null; websiteUrl: string | null; logoUrl: string | null; isServiceOnly: boolean; createdAt: string;
}
export function getBrands() { return api<Brand[]>("GET", "/admin/brands"); }
export function getBrand(id: number) { return api<Brand>("GET", `/admin/brands/${id}`); }
export function createBrand(data: Omit<Brand, "id" | "createdAt">) { return api<Brand>("POST", "/admin/brands", data); }
export function updateBrand(id: number, data: Partial<Brand>) { return api<Brand>("PUT", `/admin/brands/${id}`, data); }
export function deleteBrand(id: number) { return api<{ ok: true }>("DELETE", `/admin/brands/${id}`); }

/* Brand page content */
export interface BrandPageContent {
  id: number; brandId: number;
  description: string | null; serviceText: string | null; promoText: string | null;
  metaTitle: string | null; metaDescription: string | null; updatedAt: string | null;
}
export function getBrandPageContent(brandId: number) {
  return api<{ ok: true; data: { brand: Brand; content: BrandPageContent | null } }>(
    "GET", `/admin/brand-pages/${brandId}`
  ).then(r => r.data);
}
export function updateBrandPageContent(brandId: number, data: Omit<BrandPageContent, "id" | "brandId" | "updatedAt">) {
  return api<{ ok: true; data: BrandPageContent }>("PUT", `/admin/brand-pages/${brandId}`, data).then(r => r.data);
}

/* Users */
export interface User {
  id: number; email: string; password: string; fullName: string;
  isActive: boolean; isAdmin: boolean; createdAt: string; updatedAt: string;
}
export function getUsers() { return api<User[]>("GET", "/admin/users"); }
export function getUser(id: number) { return api<User>("GET", `/admin/users/${id}`); }
export function createUser(data: Omit<User, "id" | "createdAt" | "updatedAt">) { return api<User>("POST", "/admin/users", data); }
export function updateUser(id: number, data: Partial<User>) { return api<User>("PUT", `/admin/users/${id}`, data); }
export function deleteUser(id: number) { return api<{ ok: true }>("DELETE", `/admin/users/${id}`); }

/* Reviews */
export interface AdminReview {
  id: number; external_id: string; author: string; rating: number;
  text: string; date: string | null; source: string | null; source_url: string | null;
  synced_at: string;
}
export interface ReviewsMeta {
  data: AdminReview[]; total: number; avg: number; overallCount: number;
  lastSyncAt: string | null; page: number; pages: number;
}
export function getAdminReviews(page = 1) {
  return api<ReviewsMeta>("GET", `/admin/reviews?page=${page}`);
}
export function syncReviews(type: "full" | "recent" | "custom" = "full", days?: number) {
  return api<{ ok: boolean; upserted: number; skipped: number; overallCount: number; durationMs: number }>(
    "POST", "/admin/reviews/sync", { type, ...(days !== undefined && { days }) }
  );
}

/* Locations */
export interface LocationBrandItem {
  id: number; name: string; logoUrl: string | null; bgColor: string | null;
  isService: boolean; sortOrder: number;
}
export interface Location {
  id: number; title: string; address: string; phone: string | null;
  hours: string | null; mapX: number | null; mapY: number | null;
  sortOrder: number; brands: LocationBrandItem[];
}
export function getLocations() { return api<{ ok: true; data: Location[] }>("GET", "/admin/locations").then(r => r.data); }
export function getLocation(id: number) { return api<{ ok: true; data: Location }>("GET", `/admin/locations/${id}`).then(r => r.data); }
export function createLocation(data: Omit<Location, "id" | "brands">) { return api<{ ok: true; data: Location }>("POST", "/admin/locations", data); }
export function updateLocation(id: number, data: Partial<Omit<Location, "id" | "brands">>) { return api<{ ok: true; data: Location }>("PUT", `/admin/locations/${id}`, data); }
export function deleteLocation(id: number) { return api<{ ok: true }>("DELETE", `/admin/locations/${id}`); }
export function addBrandToLocation(locationId: number, brandId: number, isService: boolean, sortOrder?: number) {
  return api<{ ok: true }>("POST", `/admin/locations/${locationId}/brands`, { brandId, isService, sortOrder });
}
export function toggleBrandService(locationId: number, brandId: number, isService: boolean) {
  return api<{ ok: true }>("PATCH", `/admin/locations/${locationId}/brands/${brandId}`, { isService });
}
export function removeBrandFromLocation(locationId: number, brandId: number) {
  return api<{ ok: true }>("DELETE", `/admin/locations/${locationId}/brands/${brandId}`);
}

/* Site Settings */
export interface SiteSettings { header_phone?: string; [key: string]: string | undefined; }
export function getSettings() { return api<{ ok: true; data: SiteSettings }>("GET", "/admin/settings").then(r => r.data); }
export function updateSetting(key: string, value: string) { return api<{ ok: true }>("PUT", `/admin/settings/${key}`, { value }); }

/* Navigator — chat history (Task #94) */
export interface ChatListItem {
  id: number;
  session_id: string | null;
  created_at: string;
  consented_at: string | null;
  msg_count: number;
  rated_count: number;
  avg_rating: number | null;
}
export interface ChatDetail {
  conversation: Record<string, unknown>;
  messages: {
    id: number; role: string; content: string;
    car_ids: string | null; rating: number | null; created_at: string;
  }[];
}
export function getChats() {
  return api<{ ok: true; data: ChatListItem[] }>("GET", "/admin/navigator/chats").then(r => r.data);
}
export function getChatDetail(id: number) {
  return api<{ ok: true; data: ChatDetail }>("GET", `/admin/navigator/chats/${id}`).then(r => r.data);
}
export async function exportChatsJsonl() {
  const token = getToken();
  const res = await fetch(`${API_BASE}/admin/navigator/chats/export-jsonl`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "navigator-finetune.jsonl";
  a.click();
  URL.revokeObjectURL(url);
}
export function syncCars() {
  return api<{ ok: true; added: number; updated: number; removed: number; total: number; durationMs: number }>(
    "POST", "/admin/navigator/sync-cars"
  );
}
export function getSyncStatus() {
  return api<{ ok: true; total: number; lastSynced: string | null; byDealer?: { dealer: string; type: string; cnt: number }[] }>("GET", "/admin/navigator/sync-status");
}

/* Upload - Object Storage (GCS) */
export async function uploadFile(file: File): Promise<string> {
  const token = getToken();
  // 1. Request presigned URL from API
  const metaRes = await fetch(`${API_BASE}/storage/uploads/request-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
    }),
  });
  if (!metaRes.ok) throw new Error("Failed to get upload URL");
  const { uploadURL, objectPath } = await metaRes.json();

  // 2. Upload directly to GCS presigned URL
  const uploadRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!uploadRes.ok) throw new Error("Upload to storage failed");

  // 3. Return serving URL
  return `${API_BASE}/storage${objectPath}`;
}
