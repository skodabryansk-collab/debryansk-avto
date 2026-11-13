export type SessionStorageKey = "admin_token" | "manager_token";

export const ADMIN_SESSION_EXPIRED_EVENT = "debryansk:admin-session-expired";
export const MANAGER_SESSION_EXPIRED_EVENT = "debryansk:manager-session-expired";

export function processSessionResponse(
  response: Response,
  sentToken: string | null,
  storageKey: SessionStorageKey,
): void {
  if (!sentToken || typeof window === "undefined") return;

  const currentToken = localStorage.getItem(storageKey);
  if (currentToken !== sentToken) return;

  if (response.status === 401) {
    localStorage.removeItem(storageKey);
    if (storageKey === "manager_token") localStorage.removeItem("manager_name");
    window.dispatchEvent(new Event(
      storageKey === "admin_token" ? ADMIN_SESSION_EXPIRED_EVENT : MANAGER_SESSION_EXPIRED_EVENT,
    ));
    if (storageKey === "admin_token") {
      window.dispatchEvent(new Event(MANAGER_SESSION_EXPIRED_EVENT));
    }
    return;
  }

  const renewedToken = response.headers.get("X-Session-Token");
  if (renewedToken) localStorage.setItem(storageKey, renewedToken);
}
