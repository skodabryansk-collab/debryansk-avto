import { useEffect } from "react";
import { useLocation } from "wouter";

/* Глобальный защитник телефонов от React re-render.
 *
 * Работает постоянно (не 12 сек, а бесконечно):
 * 1. MutationObserver ловит любое изменение DOM в реальном времени
 * 2. Периодически проверяет каждые 2 сек (первые 20 сек — каждые 500мс)
 * 3. Перехватывает setAttribute/href на уровне прототипа ссылок
 * 4. При навигации перезапускает агрессивный режим
 */
export function CTPhoneGuard() {
  const [location] = useLocation();

  useEffect(() => {
    const CACHE = new Map<string, string>(); // original -> substituted
    let active = true;
    let fastTimer: ReturnType<typeof setTimeout> | null = null;
    let slowTimer: ReturnType<typeof setTimeout> | null = null;
    let fastCount = 0;
    const FAST_MAX = 40; // 20 сек по 500мс

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
      const currentHref = el.getAttribute("href") || "";
      const currentText = el.textContent?.trim() || "";

      // Определяем, подменён ли номер сейчас
      const isSubstituted = currentHref !== orig || (currentHref === orig && currentText && currentText !== orig.replace("tel:", "").replace(/\+/g, ""));

      if (isSubstituted) {
        // Кешируем подмену (последний виденный номер)
        if (!CACHE.has(orig) || CACHE.get(orig) !== currentHref) {
          CACHE.set(orig, currentHref);
        }
      } else {
        // Текущий = оригинал, но в кеше есть подмена — восстанавливаем
        const sub = CACHE.get(orig);
        if (sub && sub !== orig) {
          el.setAttribute("href", sub);
        }
      }
    }

    function scan() {
      if (!active) return;
      document.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]').forEach(restore);
    }

    function scheduleFast() {
      if (!active || fastCount >= FAST_MAX) {
        scheduleSlow();
        return;
      }
      fastCount++;
      fastTimer = setTimeout(() => {
        scan();
        scheduleFast();
      }, 500);
    }

    function scheduleSlow() {
      if (!active) return;
      slowTimer = setTimeout(() => {
        scan();
        scheduleSlow();
      }, 2000);
    }

    // Первичный скан
    scan();
    scheduleFast();

    // MutationObserver — мгновенная реакция
    let rafId: number | null = null;
    const observer = new MutationObserver((mutations) => {
      if (!active) return;
      // Проверяем быстро без raf для перехвата href
      let needsScan = false;
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "href") {
          const el = m.target as HTMLAnchorElement;
          const href = el.getAttribute("href") || "";
          if (href.startsWith("tel:")) {
            restore(el);
          }
        } else if (m.type === "childList") {
          needsScan = true;
        }
      }
      if (needsScan) {
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          rafId = null;
          scan();
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href"],
    });

    return () => {
      active = false;
      if (fastTimer) clearTimeout(fastTimer);
      if (slowTimer) clearTimeout(slowTimer);
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [location]);

  return null;
}
