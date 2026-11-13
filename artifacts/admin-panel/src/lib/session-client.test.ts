import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  ADMIN_SESSION_EXPIRED_EVENT,
  MANAGER_SESSION_EXPIRED_EVENT,
  processSessionResponse,
} from "./session-client";

const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
let stored = new Map<string, string>();
let events: string[] = [];

function installBrowserStubs() {
  stored = new Map();
  events = [];
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      dispatchEvent: (event: Event) => {
        events.push(event.type);
        return true;
      },
    },
  });
}

afterEach(() => {
  if (originalLocalStorage) Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

test("stores a renewed admin token from an authenticated response", () => {
  installBrowserStubs();
  stored.set("admin_token", "old-admin-token");
  const response = new Response(null, {
    status: 200,
    headers: { "X-Session-Token": "new-admin-token" },
  });

  processSessionResponse(response, "old-admin-token", "admin_token");

  assert.equal(stored.get("admin_token"), "new-admin-token");
});

test("expired manager session is cleared and signals the manager screen", () => {
  installBrowserStubs();
  stored.set("manager_token", "expired-manager-token");
  stored.set("manager_name", "Manager");

  processSessionResponse(new Response(null, { status: 401 }), "expired-manager-token", "manager_token");

  assert.equal(stored.has("manager_token"), false);
  assert.equal(stored.has("manager_name"), false);
  assert.deepEqual(events, [MANAGER_SESSION_EXPIRED_EVENT]);
});

test("a late response cannot erase a newer token from another request", () => {
  installBrowserStubs();
  stored.set("admin_token", "newer-token");

  processSessionResponse(new Response(null, { status: 401 }), "older-token", "admin_token");

  assert.equal(stored.get("admin_token"), "newer-token");
  assert.deepEqual(events, []);
});

test("expired admin session also redirects the manager portal", () => {
  installBrowserStubs();
  stored.set("admin_token", "expired-admin-token");

  processSessionResponse(new Response(null, { status: 401 }), "expired-admin-token", "admin_token");

  assert.deepEqual(events, [ADMIN_SESSION_EXPIRED_EVENT, MANAGER_SESSION_EXPIRED_EVENT]);
});
