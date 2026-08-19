import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";

const STORAGE_KEY = "exit_intent_shown_at";
const DWELL_MS = 5_000;        // 5s on page before any trigger arms
const AUTO_MS  = 40_000;       // 40s total → auto-show (covers mobile)
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

function isDebugMode(): boolean {
  return typeof location !== "undefined" && location.search.includes("debug_exit=1");
}

function isCommercialRoute(path: string): boolean {
  return (
    path === "/" ||
    path === "/new-cars" ||
    path.startsWith("/new-cars/") ||
    path === "/cars" ||
    path.startsWith("/cars/") ||
    path.startsWith("/brands/")
  );
}

function canShow(): boolean {
  // URL debug bypass: ?debug_exit=1
  if (isDebugMode()) return true;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return true;
    return Date.now() - parseInt(stored, 10) > COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markShown(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {}
}

/**
 * Arms three independent exit-intent triggers after DWELL_MS on commercial pages.
 *
 * 1. Desktop — mousemove into top 80px while moving upward (cursor heading to address bar),
 *    plus a mouseout fallback when the pointer actually leaves through the browser chrome.
 * 2. Mobile/any — auto-show after AUTO_MS total (no cursor needed).
 * 3. Any — visibilitychange → hidden (tab switch, app background).
 *
 * Fires onShow at most once per 24 hours (localStorage cooldown).
 * Bypass for testing: add ?debug_exit=1 to the URL.
 */
export function useExitIntent(onShow: () => void): void {
  const [location] = useLocation();
  const dwellReadyRef = useRef(false);
  const firedRef      = useRef(false);
  const locationRef   = useRef(location);
  const dwellTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onShowRef     = useRef(onShow);

  useEffect(() => { onShowRef.current = onShow; }, [onShow]);

  function fire() {
    if (firedRef.current) return;
    if (!canShow()) return;
    firedRef.current = true;
    markShown();
    onShowRef.current();
  }

  // Reset all state on route change
  useEffect(() => {
    locationRef.current = location;
    dwellReadyRef.current = false;
    firedRef.current = false;

    if (dwellTimer.current) clearTimeout(dwellTimer.current);
    if (autoTimer.current)  clearTimeout(autoTimer.current);

    if (!isCommercialRoute(location)) return;

    const debugMode = isDebugMode();

    // Arm dwell flag after DWELL_MS (immediately in explicit debug mode)
    dwellTimer.current = setTimeout(() => {
      dwellReadyRef.current = true;
    }, debugMode ? 0 : DWELL_MS);

    // Auto-show after AUTO_MS (mobile primary trigger). Debug mode makes the
    // test URL deterministic without affecting normal visitors.
    autoTimer.current = setTimeout(() => {
      if (!firedRef.current && isCommercialRoute(locationRef.current)) fire();
    }, debugMode ? 500 : AUTO_MS);

    return () => {
      if (dwellTimer.current) clearTimeout(dwellTimer.current);
      if (autoTimer.current)  clearTimeout(autoTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // Desktop: cursor approaching top while moving upward
  useEffect(() => {
    let lastY = -1;
    let rafId = 0;

    function handleMouseMove(e: MouseEvent) {
      const y = e.clientY;
      const movingUp = lastY >= 0 && y < lastY;
      lastY = y;

      if (y > 80 || !movingUp) return;               // only top 80px, moving up
      if (!dwellReadyRef.current || firedRef.current) return;
      if (!isCommercialRoute(locationRef.current))    return;

      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => fire());
    }

    function handleMouseOut(e: MouseEvent) {
      // relatedTarget is null only when leaving the document, not when moving
      // between elements. Restrict to the top edge to avoid false positives.
      if (e.relatedTarget !== null || e.clientY > 0) return;
      if (!dwellReadyRef.current || firedRef.current) return;
      if (!isCommercialRoute(locationRef.current)) return;
      fire();
    }

    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseout", handleMouseOut, { passive: true });
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseout", handleMouseOut);
      cancelAnimationFrame(rafId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any device: tab switch / app background
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== "hidden") return;
      if (!dwellReadyRef.current || firedRef.current) return;
      if (!isCommercialRoute(locationRef.current)) return;
      fire();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
