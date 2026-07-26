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

export interface DashboardData {
  calls: { total30d: number; missedToday: number; answeredToday: number };
  cars: { newCount: number; usedCount: number; lastSyncAt: string | null };
  leads: { total: number; today: number; byType: { callback: number; testdrive: number; credit: number; tradein: number } };
  reviews: { avgRating: number; total: number; lastSyncAt: string | null };
  navigator: { total: number; today: number; rated: number };
  content: { news: number; promotions: number; faqs: number; vacancies: number };
  seoPositions: Array<{ query: string; position: number; change: number | null }>;
  visitors: { today: number; week: number; month: number } | null;
}
export function getDashboard() { return api<DashboardData & { ok: boolean }>("GET", "/admin/dashboard"); }

export interface TrendDay { date: string; total: number }
export interface DashboardTrends { calls: TrendDay[]; leads: TrendDay[] }
export function getDashboardTrends() { return api<DashboardTrends & { ok: boolean }>("GET", "/admin/dashboard/trends"); }

/* News */
export interface NewsItem {
  id: number; title: string; excerpt: string; content: string; category: string;
  image: string; imageMobile: string | null; slug: string; publishedAt: string; readTime: number;
  brandId: number | null;
  brandIds: number[];
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
  id: number; name: string; slug: string | null; websiteUrl: string | null; logoUrl: string | null; isServiceOnly: boolean; carMark: string | null; createdAt: string;
}

export function getCarMarks(): Promise<string[]> {
  return api<string[]>("GET", "/admin/brands/car-marks");
}

export function getCarModels(mark: string): Promise<string[]> {
  return api<string[]>("GET", `/admin/brands/car-models?mark=${encodeURIComponent(mark)}`);
}
export function getBrands() { return api<Brand[]>("GET", "/admin/brands"); }
export function getBrand(id: number) { return api<Brand>("GET", `/admin/brands/${id}`); }
export function createBrand(data: Omit<Brand, "id" | "createdAt" | "carMark"> & { carMark?: string | null }) { return api<Brand>("POST", "/admin/brands", data); }
export function updateBrand(id: number, data: Partial<Brand>) { return api<Brand>("PUT", `/admin/brands/${id}`, data); }
export function deleteBrand(id: number) { return api<{ ok: true }>("DELETE", `/admin/brands/${id}`); }

/* Brand page content */
export interface BrandAdvantage { icon: string; text: string; }
export interface BrandFaqItem {
  question: string;
  answer: string;
  is_published?: boolean;
  include_in_schema?: boolean;
  sort_order?: number;
}
export interface BrandPromotion {
  id?: number;
  title: string;
  description: string;
  image?: string;
  badge?: string;
  expiresAt?: string;
  buttonText?: string;
  buttonUrl?: string;
  isActive?: boolean;
}
export interface BrandModel {
  id?: string;
  feedDealer: string;
  feedModel: string;
  displayName: string;
  image?: string;
  description?: string;
  badge?: string;
  isActive?: boolean;
  sort?: number;
}
export interface BrandService {
  id?: string;
  icon: string;
  title: string;
  description?: string;
  sort?: number;
}
export interface CatalogModel {
  dealer: string;
  model: string;
  min_price: number;
  count: number;
}
export interface BrandPageContent {
  id: number; brandId: number;
  description: string | null; serviceText: string | null; promoText: string | null;
  advantages: BrandAdvantage[] | null;
  features: string[] | null;
  faq: BrandFaqItem[] | null;
  heroImageUrl: string | null;
  heroImageMobileUrl: string | null;
  promotions: BrandPromotion[] | null;
  models: BrandModel[] | null;
  services: BrandService[] | null;
  metaTitle: string | null; metaDescription: string | null; updatedAt: string | null;
}
export function getBrandPageContent(brandId: number) {
  return api<{ ok: true; data: { brand: Brand; content: BrandPageContent | null } }>(
    "GET", `/admin/brand-pages/${brandId}`
  ).then(r => r.data);
}
export function getBrandCatalogModels(brandId: number) {
  return api<{ ok: true; data: CatalogModel[] }>(
    "GET", `/admin/brand-pages/${brandId}/catalog-models`
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

export function syncCalltouchCalls(daysBack = 1) {
  return api<{ ok: true; stats: { inserted: number; updated: number; total: number; errors: number } }>(
    "POST", "/admin/calltouch-calls/sync", { daysBack }
  );
}

/* Locations */
export interface LocationBrandItem {
  id: number; name: string; logoUrl: string | null; bgColor: string | null;
  isService: boolean; sortOrder: number;
}
export interface Location {
  id: number; title: string; address: string; phone: string | null;
  hours: string | null; email: string | null; mapX: number | null; mapY: number | null;
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

/* Cache rebuild */
export function rebuildCache() {
  return api<{ status: string; message: string }>("POST", "/admin/cache/rebuild");
}
export function getRebuildStatus() {
  return api<{ status: "idle" | "running" }>("GET", "/admin/cache/rebuild/status");
}
export function runPrerender() {
  return api<{ status: string; message: string }>("POST", "/admin/cache/prerender");
}
export function getPrerenderStatus() {
  return api<{ status: "idle" | "running" }>("GET", "/admin/cache/prerender/status");
}
export function prerenderRoute(route: string) {
  return api<{ ok: true; route: string; message: string }>("POST", "/admin/cache/prerender/route", { route });
}
export function prerenderBulk(routes: string[]) {
  return api<{ ok: true; count: number; message: string }>("POST", "/admin/cache/prerender/bulk", { routes });
}
export function flushOgCache() {
  return api<{ ok: true; deleted: number }>("POST", "/admin/og-image/flush");
}
export function clearPrerenderCache(route: string) {
  return api<{ ok: true; route: string; message: string }>("POST", "/admin/cache/prerender/clear", { route });
}

export interface SeoPageItem {
  route: string;
  title: string;
  description: string;
  source: "ssg" | "brand" | "promotion" | "car" | "static";
  isCached: boolean;
  isGone: boolean;
  canonical: string;
  ogImage?: string;
}
export function getSeoPages() {
  return api<{ ok: true; data: SeoPageItem[] }>("GET", "/admin/seo/pages").then(r => r.data);
}
export function requestYandexRecrawl(url: string) {
  return api<{ ok: true; task_id: string; quota_remainder: number }>("POST", "/admin/seo/recrawl", { url });
}

export interface SeoAuditResult {
  ranAt: string;
  items: Array<SeoPageItem & { issues: string[]; isStale: boolean; cachedTitle?: string; cachedDescription?: string }>;
}
export function getSeoAudit() {
  return api<{ ok: true; data: SeoAuditResult }>("GET", "/admin/seo/audit").then(r => r.data);
}
export function runSeoAudit() {
  return api<{ ok: true; data: SeoAuditResult }>("POST", "/admin/seo/audit").then(r => r.data);
}
export interface GeneratedBrandDescription {
  slug: string;
  brandName: string;
  title: string;
  description: string;
}
export function generateBrandDescriptions(apply = false) {
  return api<{ ok: true; data: { generated: GeneratedBrandDescription[]; applied?: { updated: number; skipped: number } } }>("POST", "/admin/seo/generate-brand-descriptions", { apply }).then(r => r.data);
}

/* Promotions */
export interface Promotion {
  id: number;
  title: string;
  slug: string;
  description: string;
  image: string | null;
  badge: string | null;
  expiresAt: string | null;
  isActive: boolean;
  buttonText: string | null;
  buttonUrl: string | null;
  brandIds: number[];
  promotionType: "sales" | "service";
  createdAt: string;
  updatedAt: string;
}
export type PromotionInput = {
  title: string;
  slug?: string | null;
  description?: string;
  image?: string | null;
  badge?: string | null;
  expiresAt?: string | null;
  isActive?: boolean;
  buttonText?: string | null;
  buttonUrl?: string | null;
  brandIds?: number[];
  promotionType?: "sales" | "service";
};
export function getPromotions(brandId?: number) {
  const q = brandId ? `?brandId=${brandId}` : "";
  return api<{ ok: true; data: Promotion[] }>("GET", `/admin/promotions${q}`).then(r => r.data);
}
export function createPromotion(data: PromotionInput) {
  return api<{ ok: true; data: Promotion }>("POST", "/admin/promotions", data).then(r => r.data);
}
export function updatePromotion(id: number, data: PromotionInput) {
  return api<{ ok: true; data: Promotion }>("PUT", `/admin/promotions/${id}`, data).then(r => r.data);
}
export function deletePromotion(id: number) {
  return api<{ ok: true }>("DELETE", `/admin/promotions/${id}`);
}

/* Upload - Object Storage (GCS) */
export async function uploadFile(file: File): Promise<string> {
  const token = getToken();
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  // Images go through the server-side optimisation pipeline (sharp → WebP → GCS)
  if (file.type.startsWith("image/")) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/storage/uploads/image`, {
      method: "POST",
      headers: authHeader,
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const { url } = await res.json();
    return url;
  }

  // Non-image files (PDF, etc.) — direct GCS presigned upload
  const metaRes = await fetch(`${API_BASE}/storage/uploads/request-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
    },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
    }),
  });
  if (!metaRes.ok) throw new Error("Failed to get upload URL");
  const { uploadURL, objectPath } = await metaRes.json();

  const uploadRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!uploadRes.ok) throw new Error("Upload to storage failed");

  return `${API_BASE}/storage${objectPath}`;
}

/* ── FAQ ───────────────────────────────────────────────────────────────── */

export interface FaqItem {
  id: number;
  pageSlug: string;
  question: string;
  answer: string;
  sortOrder: number;
  isPublished: boolean;
  includeInSchema: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function getAdminFaq(pageSlug: string) {
  return api<{ ok: true; faqs: FaqItem[] }>("GET", `/admin/faq?page=${encodeURIComponent(pageSlug)}`).then(r => r.faqs);
}

export function createFaq(data: Omit<FaqItem, "id" | "createdAt" | "updatedAt">) {
  return api<{ ok: true; faq: FaqItem }>("POST", "/admin/faq", data).then(r => r.faq);
}

export function updateFaq(id: number, data: Partial<Omit<FaqItem, "id" | "createdAt" | "updatedAt">>) {
  return api<{ ok: true; faq: FaqItem }>("PUT", `/admin/faq/${id}`, data).then(r => r.faq);
}

export function deleteFaq(id: number) {
  return api<{ ok: true }>("DELETE", `/admin/faq/${id}`);
}

export function reorderFaq(items: Array<{ id: number; sortOrder: number }>) {
  return api<{ ok: true }>("PATCH", "/admin/faq/reorder", { items });
}

/* ── Disclaimers ─────────────────────────────────────────────────────────── */
export interface Disclaimer {
  id: number;
  scope: string;
  brand_id: number | null;
  model: string | null;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
}

export interface DisclaimerVersion {
  id: number;
  version_number: number;
  content: string;
  changed_at: string;
}

export function getDisclaimers(scope?: string) {
  const q = scope ? `?scope=${encodeURIComponent(scope)}` : "";
  return api<{ ok: true; data: Disclaimer[] }>("GET", `/admin/disclaimers${q}`).then(r => r.data);
}

export function createDisclaimer(data: { scope: string; brandId?: number; model?: string; title: string; content: string }) {
  return api<{ ok: true; id: number }>("POST", "/admin/disclaimers", data);
}

export function updateDisclaimer(id: number, data: { brandId?: number; model?: string; title?: string; content?: string; isActive?: boolean }) {
  return api<{ ok: true }>("PUT", `/admin/disclaimers/${id}`, data);
}

export function deleteDisclaimer(id: number) {
  return api<{ ok: true }>("DELETE", `/admin/disclaimers/${id}`);
}

export function getDisclaimerVersions(id: number) {
  return api<{ ok: true; data: DisclaimerVersion[] }>("GET", `/admin/disclaimers/${id}/versions`).then(r => r.data);
}

/* ── Bonus Program ────────────────────────────────────────────────────────── */
export interface BonusPerk { icon: string; title: string; description: string; }
export interface BonusDiscountLevel { level: number; name: string; threshold: number; percent: number; color: string; }
export interface BonusAction { title: string; items: string[]; }
export interface BonusRulesSection { title: string; items: string[]; }
export interface BonusProgramData {
  id: number;
  hero_title: string;
  hero_description: string;
  perks: BonusPerk[];
  discount_levels: BonusDiscountLevel[];
  redemption_rules: string[];
  bonus_actions: BonusAction[];
  important_notes: string;
  full_rules_sections: BonusRulesSection[];
  updated_at: string;
}

export function getBonusProgram() {
  return api<{ ok: true; data: BonusProgramData | null }>("GET", "/admin/bonus-program").then(r => r.data);
}

export function updateBonusProgram(data: Partial<Omit<BonusProgramData, "id" | "updated_at">>) {
  return api<{ ok: true; data: BonusProgramData }>("PUT", "/admin/bonus-program", data).then(r => r.data);
}

/* ── SEO Positions ─────────────────────────────────────────────────────────── */
export interface SeoQueryRow {
  query_text: string;
  total_shows: number;
  total_clicks: number;
  avg_position: number;
}
export interface SeoCommercialRow extends SeoQueryRow {
  old_position: number | null;
}
export interface SeoCompareRow extends SeoQueryRow {
  position_change: number;
}
export interface SeoLatestResponse {
  ok: boolean;
  date: string | null;
  data: SeoQueryRow[];
}
export interface SeoCompareResponse {
  ok: boolean;
  newDate: string | null;
  oldDate: string | null;
  improved: SeoCompareRow[];
  declined: SeoCompareRow[];
  stable: SeoCompareRow[];
  newQueries: SeoQueryRow[];
  lostQueries: SeoQueryRow[];
}
export interface SeoCommercialResponse {
  ok: boolean;
  date: string | null;
  oldDate: string | null;
  data: SeoCommercialRow[];
}

export function getSeoLatest() {
  return api<SeoLatestResponse>("GET", "/admin/seo-positions/latest");
}
export function getSeoCompare(days = 7) {
  return api<SeoCompareResponse>("GET", `/admin/seo-positions/compare?days=${days}`);
}
export function getSeoCommercial() {
  return api<SeoCommercialResponse>("GET", "/admin/seo-positions/commercial");
}
export function triggerSeoFetch() {
  return api<{ ok: boolean; upserted: number; skipped: boolean; error?: string }>(
    "POST", "/admin/seo-positions/fetch-now"
  );
}

/* Calltouch */
export interface CalltouchCall {
  id: number;
  callId: string;
  phoneNumber: string | null;
  trackingNumber: string | null;
  source: string | null;
  campaign: string | null;
  landingPage: string | null;
  status: string;
  durationSeconds: number | null;
  subPoolName: string | null;
  callRecordingUrl: string | null;
  recordingStoredPath: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
}

export function getCalltouchCalls(params: { page?: number; status?: string; phone?: string; dateFrom?: string; dateTo?: string } = {}) {
  const { page = 1, status = "all", phone = "", dateFrom = "", dateTo = "" } = params;
  const qs = new URLSearchParams({ page: String(page), status });
  if (phone) qs.set("phone", phone);
  if (dateFrom) qs.set("dateFrom", dateFrom);
  if (dateTo) qs.set("dateTo", dateTo);
  return api<{ ok: boolean; data: CalltouchCall[]; total: number; page: number; limit: number }>(
    "GET", `/admin/calltouch-calls?${qs}`
  );
}

export function getCalltouchRecordingUrl(id: number) {
  return api<{ ok: boolean; url: string; external?: boolean }>(
    "GET", `/admin/calltouch-calls/${id}/recording`
  );
}

export async function exportCalltouchCalls(params: { status?: string; phone?: string; dateFrom?: string; dateTo?: string } = {}) {
  const token = getToken();
  const qs = new URLSearchParams();
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.phone) qs.set("phone", params.phone);
  if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params.dateTo) qs.set("dateTo", params.dateTo);
  const res = await fetch(`${API_BASE}/admin/calltouch-calls/export?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `calltouch-calls-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Managers (КП) ─────────────────────────────────────────────────────── */
export interface ManagerItem {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  login: string;
  isActive: boolean | null;
  photoUrl: string | null;
  brands: string[] | null;
  registrationPending: boolean | null;
  createdAt: string | null;
}

export function getManagers() {
  return api<{ ok: true; data: ManagerItem[] }>("GET", "/admin/managers");
}

export function createManager(data: { name: string; phone?: string; email?: string; login: string; password: string; isActive?: boolean }) {
  return api<{ ok: true; data: ManagerItem }>("POST", "/admin/managers", data);
}

export function toggleManager(id: number, isActive: boolean) {
  return api<{ ok: true; data: ManagerItem }>("PATCH", `/admin/managers/${id}`, { isActive });
}

export function activateManager(id: number) {
  return api<{ ok: true; emailSent: boolean; emailError?: string }>("POST", `/admin/managers/${id}/activate`);
}

export function updateManagerBrands(id: number, brands: string[]) {
  return api<{ ok: true; data: ManagerItem }>("PATCH", `/admin/managers/${id}`, { brands });
}

export function resendManagerEmail(id: number) {
  return api<{ ok: true }>("POST", `/admin/managers/${id}/resend-email`);
}

/* ── Admin Quotes ──────────────────────────────────────────────────────── */
export interface AdminQuoteItem {
  id: number;
  managerId: number;
  managerName: string | null;
  carId: string;
  carType: string;
  carSnapshot: unknown;
  clientName: string;
  clientPhone: string;
  discounts: unknown;
  priceOriginal: number;
  priceFinal: number;
  validUntil: string;
  pdfUrl: string | null;
  createdAt: string;
}

export function getAdminQuotes(params?: { managerId?: number; from?: string; to?: string }) {
  const qs = new URLSearchParams();
  if (params?.managerId) qs.set("managerId", String(params.managerId));
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  const q = qs.toString();
  return api<{ ok: true; data: AdminQuoteItem[] }>("GET", `/admin/quotes${q ? "?" + q : ""}`);
}

/* ── Metrika / Visitors ── */
export interface MetrikaSummaryResult {
  ok: boolean;
  period: string;
  date1: string;
  date2: string;
  current: { visits: number; users: number; pageviews: number; bounceRate: number; avgDuration: number; avgDurationFormatted: string };
  previous: { visits: number; users: number; pageviews: number; bounceRate: number; avgDuration: number; avgDurationFormatted: string };
}
export interface MetrikaChartResult {
  ok: boolean;
  rows: Array<{ date: string; visits: number; users: number }>;
}
export interface MetrikaSourcesResult {
  ok: boolean;
  rows: Array<{ name: string; visits: number }>;
}
export interface MetrikaPagesResult {
  ok: boolean;
  rows: Array<{ path: string; visits: number; pageviews: number }>;
}
export interface MetrikaOnlineResult {
  ok: boolean;
  online: number | null;
}

export function getMetrikaSummary(period: "today" | "7d" | "30d") {
  return api<MetrikaSummaryResult>("GET", `/admin/metrika/summary?period=${period}`);
}
export function getMetrikaChart(date1: string, date2: string) {
  return api<MetrikaChartResult>("GET", `/admin/metrika/chart?date1=${date1}&date2=${date2}`);
}
export function getMetrikaSources(date1: string, date2: string) {
  return api<MetrikaSourcesResult>("GET", `/admin/metrika/sources?date1=${date1}&date2=${date2}`);
}
export function getMetrikaPages(date1: string, date2: string) {
  return api<MetrikaPagesResult>("GET", `/admin/metrika/pages?date1=${date1}&date2=${date2}`);
}
export function getMetrikaOnline() {
  return api<MetrikaOnlineResult>("GET", "/admin/metrika/online");
}

/* ── SEO Autopilot ────────────────────────────────────────────────────── */
export interface SeoSuggestion {
  id: number;
  type: string;
  page_url: string;
  current_value: string | null;
  proposed_value: string | null;
  reasoning: string | null;
  priority_score: number;
  demand: number;
  position_factor: number;
  ease: number;
  status: string;
  blocked_by_tech: boolean;
  applied_at: string | null;
  verified_at: string | null;
  verification_log: string | null;
  result_delta: number | null;
  // Петля Карпаты evaluation fields
  snapshot_before: { position: number | null; clicks: number | null; date: string; queryCount: number } | null;
  evaluate_at: string | null;
  evaluated_at: string | null;
  evaluation_result: "improved" | "stable" | "fell" | "falsified" | null;
  evaluation_note: string | null;
  content_draft: string | null;
  created_at: string;
  updated_at: string;
}

/* ── SEO Anchor Queries ───────────────────────────────────────────────── */
export interface AnchorQuery {
  id: number;
  query_text: string;
  page_url: string;
  target_position: number;
  current_position: number | null;
  total_clicks: number | null;
  last_checked_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnchorSuggestion {
  query_text: string;
  avg_position: number;
  total_shows: number;
  total_clicks: number;
  snapshot_date: string;
}

export function getAnchorQueries() {
  return api<{ ok: boolean; data: AnchorQuery[] }>("GET", "/admin/seo-anchor");
}

export function createAnchorQuery(data: { query_text: string; page_url: string; target_position?: number; notes?: string }) {
  return api<{ ok: boolean; data: AnchorQuery }>("POST", "/admin/seo-anchor", data);
}

export function updateAnchorQuery(id: number, data: Partial<AnchorQuery>) {
  return api<{ ok: boolean }>("PUT", `/admin/seo-anchor/${id}`, data);
}

export function deleteAnchorQuery(id: number) {
  return api<{ ok: boolean }>("DELETE", `/admin/seo-anchor/${id}`);
}

export function suggestAnchorQueries(limit = 20) {
  return api<{ ok: boolean; data: AnchorSuggestion[] }>("GET", `/admin/seo-anchor/suggest?limit=${limit}`);
}

export interface OauthAlert {
  id: number;
  service: string;
  status: string;
  message: string;
  created_at: string;
  resolved_at: string | null;
}

export interface WordstatQuotaEntry {
  date: string;
  calls_used: number;
  calls_estimated: number;
  updated_at: string;
}

export function getSeoAutopilotSuggestions(params?: {
  type?: string; status?: string; blocked_by_tech?: boolean; page?: number; limit?: number; evaluated?: boolean;
}) {
  const qs = new URLSearchParams();
  if (params?.type) qs.set("type", params.type);
  if (params?.status) qs.set("status", params.status);
  if (params?.blocked_by_tech !== undefined) qs.set("blocked_by_tech", String(params.blocked_by_tech));
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.evaluated !== undefined) qs.set("evaluated", String(params.evaluated));
  const q = qs.toString();
  return api<{ ok: boolean; data: SeoSuggestion[]; total: number; page: number; limit: number }>(
    "GET", `/admin/seo-autopilot/suggestions${q ? "?" + q : ""}`
  );
}

export function applySeoSuggestion(id: number) {
  return api<{ ok: boolean; message: string }>("POST", `/admin/seo-autopilot/suggestions/${id}/apply`);
}

export function rejectSeoSuggestion(id: number) {
  return api<{ ok: boolean }>("POST", `/admin/seo-autopilot/suggestions/${id}/reject`);
}

export function getSeoAutopilotAlerts() {
  return api<{ ok: boolean; data: OauthAlert[] }>("GET", "/admin/seo-autopilot/alerts");
}

export function resolveOauthAlert(id: number) {
  return api<{ ok: boolean }>("POST", `/admin/seo-autopilot/alerts/${id}/resolve`);
}

export function getSeoAutopilotQuota() {
  return api<{ ok: boolean; data: WordstatQuotaEntry[] }>("GET", "/admin/seo-autopilot/quota");
}

export function getSeoAutopilotStatus() {
  return api<{
    ok: boolean;
    counts: { pending: number; applied: number; errors: number; rejected: number; blocked: number };
    unresolvedAlerts: number;
    wordstatRunning: boolean;
    gapRunning: boolean;
  }>("GET", "/admin/seo-autopilot/status");
}

export function runWordstatFetch() {
  return api<{ ok: boolean; message: string }>("POST", "/admin/seo-autopilot/run-wordstat");
}

export function runGapAnalysis() {
  return api<{ ok: boolean; message: string }>("POST", "/admin/seo-autopilot/run-gap");
}

export interface GapRun {
  id: number;
  status: "running" | "completed" | "error";
  triggered_by: "manual" | "auto";
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  suggestions_created: number | null;
  wordstat_rows: number | null;
  webmaster_rows: number | null;
  error_message: string | null;
}

export function getGapRuns(params?: { limit?: number; offset?: number }) {
  const q = new URLSearchParams();
  if (params?.limit)  q.set("limit",  String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  return api<{ ok: boolean; data: GapRun[]; total: number }>(
    "GET", `/admin/seo-autopilot/gap-runs?${q}`
  );
}

export interface FaqPreviewItem { modelTerm: string; question: string; answer: string; }
export function getSuggestionPreview(id: number) {
  return api<{ ok: boolean; faqs: FaqPreviewItem[] }>("GET", `/admin/seo-autopilot/suggestions/${id}/preview`);
}
