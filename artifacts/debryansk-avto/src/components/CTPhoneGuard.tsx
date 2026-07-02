import { useEffect } from "react";

/* Глобальный защитник телефонов от React re-render.
 *
 * Логика:
 * 1. Маркирует все <a href="tel:..."> атрибутом data-ct-orig
 * 2. Кеширует ТОЛЬКО подменённые Calltouch номера
 * 3. При любой мутации DOM — сканирует все ссылки
 *    если текущий href = оригинал, а в кеше есть подмена — восстанавливает подмену
 */
export function CTPhoneGuard() {
  useEffect(() => {
    const CACHE = new Map<string, string>(); // original -> substituted

    function scan() {
      document.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]').forEach((el) => {
        const href = el.getAttribute("href") || "";
        if (!href.startsWith("tel:")) return;

        // Маркируем оригинал
        if (!el.hasAttribute("data-ct-orig")) {
          el.setAttribute("data-ct-orig", href);
        }
        const orig = el.getAttribute("data-ct-orig") || href;
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
      });
    }

    // Первичный скан с задержкой (даём Calltouch время подменить)
    const initialTimeout = setTimeout(scan, 3000);

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
      clearTimeout(initialTimeout);
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return null;
}
