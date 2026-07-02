import { useEffect } from "react";
import { useLocation } from "wouter";

/* Глобальный защитник телефонов от React re-render.
 *
 * Ключевой принцип: глобальный кеш по data-ct-orig.
 * Когда Calltouch подменил номер на любом элементе с data-ct-orig="tel:+74832777770",
 * мы запоминаем: кеш["tel:+74832777770"] = "tel:+79123456789".
 * Когда React создаёт новый элемент с тем же data-ct-orig,
 * патч setAttribute сразу подменяет href, не ждя сканера.
 */

export function CTPhoneGuard() {
  const [location] = useLocation();

  useEffect(() => {
    // === Патчим DOM API только один раз (глобально) ===
    if (!(window as any).__CT_PATCHED__) {
      (window as any).__CT_PATCHED__ = true;

      const origSetAttr = HTMLAnchorElement.prototype.setAttribute;
      const origRemoveAttr = HTMLAnchorElement.prototype.removeAttribute;

      // Глобальный кеш: оригинал -> подмена
      const subCache = new Map<string, string>();
      (window as any).__CT_SUB_CACHE__ = subCache;

      function readDataCtOrig(el: HTMLAnchorElement): string | null {
        return el.getAttribute("data-ct-orig");
      }

      function applySubIfKnown(el: HTMLAnchorElement, value: string): string {
        const domOrig = readDataCtOrig(el);
        if (domOrig && subCache.has(domOrig) && value === domOrig) {
          return subCache.get(domOrig)!;
        }
        return value;
      }

      HTMLAnchorElement.prototype.setAttribute = function (name: string, value: string) {
        if (name.toLowerCase() === "href" && value?.startsWith("tel:")) {
          const domOrig = readDataCtOrig(this);

          if (domOrig) {
            // Если это оригинал и в кеше есть подмена — подменяем
            const sub = subCache.get(domOrig);
            if (sub && value === domOrig) {
              return origSetAttr.call(this, name, sub);
            }
            // Если это новая подмена (не оригинал и не текущая кешированная) — обновляем кеш
            if (value !== domOrig && (!sub || value !== sub)) {
              subCache.set(domOrig, value);
            }
          } else {
            // Нет data-ct-orig — запоминаем оригинал первый раз
            if (!subCache.has(value)) {
              subCache.set(value, value); // пока нет подмены, оригинал = оригинал
            }
          }
        }
        return origSetAttr.call(this, name, value);
      };

      HTMLAnchorElement.prototype.removeAttribute = function (name: string) {
        if (name.toLowerCase() === "href") {
          const domOrig = readDataCtOrig(this);
          if (domOrig && subCache.has(domOrig)) {
            return origSetAttr.call(this, "href", subCache.get(domOrig)!);
          }
        }
        return origRemoveAttr.call(this, name);
      };

      // Патчим также Object.defineProperty для href
      const origDescriptor = Object.getOwnPropertyDescriptor(
        HTMLAnchorElement.prototype,
        "href",
      );
      if (origDescriptor && origDescriptor.set) {
        Object.defineProperty(HTMLAnchorElement.prototype, "href", {
          set(value: string) {
            const domOrig = readDataCtOrig(this as HTMLAnchorElement);
            if (domOrig) {
              const sub = subCache.get(domOrig);
              if (sub && value === domOrig) {
                origDescriptor.set!.call(this, sub);
                return;
              }
              if (value !== domOrig && (!sub || value !== sub)) {
                subCache.set(domOrig, value);
              }
            }
            origDescriptor.set!.call(this, value);
          },
          get: origDescriptor.get,
          configurable: true,
          enumerable: true,
        });
      }
    }

    // === MutationObserver для мгновенной реакции на новые элементы ===
    const subCache = (window as any).__CT_SUB_CACHE__ as Map<string, string>;
    let active = true;

    function scanAll() {
      if (!active) return;
      document.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]').forEach((el) => {
        const domOrig = el.getAttribute("data-ct-orig");
        if (!domOrig) return;
        const current = el.getAttribute("href") || "";
        const sub = subCache.get(domOrig);

        if (sub && current === domOrig) {
          // Есть подмена в кеше, но элемент имеет оригинал — применяем
          el.setAttribute("href", sub);
        } else if (current !== domOrig && (!sub || current !== sub)) {
          // Новая подмена — обновляем кеш
          subCache.set(domOrig, current);
        }
      });
    }

    // MutationObserver ловит новые элементы мгновенно
    let rafId: number | null = null;
    const observer = new MutationObserver(() => {
      if (!active) return;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        scanAll();
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Периодический скан (агрессивный первые 10 сек)
    let fastCount = 0;
    const FAST_MAX = 20;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function tick() {
      if (!active) return;
      scanAll();
      fastCount++;
      if (fastCount < FAST_MAX) {
        timer = setTimeout(tick, 500);
      } else {
        timer = setTimeout(tick, 2000);
      }
    }

    tick();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [location]);

  return null;
}
