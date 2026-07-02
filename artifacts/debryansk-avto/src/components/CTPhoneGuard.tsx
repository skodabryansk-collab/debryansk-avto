import { useEffect } from "react";
import { useLocation } from "wouter";

/* Глобальный защитник телефонов от React re-render.
 *
 * Логика:
 * 1. Маркирует все <a href="tel:..."> атрибутом data-ct-orig
 * 2. Кеширует ТОЛЬКО подменённые Calltouch номера
 * 3. При любой мутации DOM — сканирует все ссылки
 *    если текущий href = оригинал, а в кеше есть подмена — восстанавливает подмену
 *
 * 4. Периодически проверяет Calltouch скрипт первые 12 сек
 * 5. При SPA-навигации — сбрасывает периодический проверки и пересканирует
 */
export function CTPhoneGuard() {
  const [location] = useLocation();

  useEffect(() => {
    const CACHE = new Map<string, string>(); // original -> substituted
    let checkTimer: ReturnType<typeof setTimeout> | null = null;
    let checkCount = 0;
    const MAX_CHECKS = 24; // 12 сек по 500мс

    function isCalltouchLoaded() {
      return !!(window as any).ct || !!(window as any).CalltouchDataObject;
    }

    function mark(el: HTMLAnchorElement) {
      if (el.hasAttribute("data-ct-orig")) return;
      const href = el.getAttribute("href") || "";
      if (href.startsWith("tel:")) {
        el.setAttribute("data-ct-orig", href);
      }
    }

    function restore(el: HTMLAnchorElement) {
      mark(el);
      const orig = el.getAttribute("data-ct-orig") || "";
      if (!orig) return;
      const current = el.getAttribute("href") || "";

      // Кешируем ТОЛЬКО подмену (текущий отличается от оригинала)
      if (current !== orig && (!CACHE.has(orig) || CACHE.get(orig) !== current)) {
        CACHE.set(orig, current);
      }

      // Восстанавливаем подмену, если React вернул оригинал
      if (current === orig) {
        const sub = CACHE.get(orig);
        if (sub && sub !== current) {
          el.setAttribute("href", sub);
        }
      }
    }

    function scan(scope: Element = document.body) {
      scope.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]').forEach(restore);
    }

    function scheduleCheck() {
      if (checkCount >= MAX_CHECKS) return;
      checkCount++;
      checkTimer = setTimeout(() => {
        scan();
        scheduleCheck();
      }, 500);
    }

    // Первичный скан
    scan();
    scheduleCheck();

    // MutationObserver для мгновенной реакции на любые изменения
    let rafId: number | null = null;
    const observer = new MutationObserver(() => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        scan();
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      if (checkTimer) clearTimeout(checkTimer);
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [location]); // Сбрасывает при каждой смене страницы

  return null;
}
