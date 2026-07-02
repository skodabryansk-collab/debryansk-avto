import { useEffect } from "react";
import { useLocation } from "wouter";

/* Глобальный защитник телефонов от React re-render.
 *
 * Принцип: глобальный кеш по оригинальному номеру.
 * Когда Calltouch подменил номер на любом элементе,
 * мы запоминаем: кеш["tel:+74832777770"] = "tel:+79123456789".
 * При любом последующем setAttribute("href", "tel:+74832777770")
 * патч сразу подменяет на значение из кеша.
 *
 * MutationObserver отслеживает изменения href в реальном времени
 * и пополняет кеш мгновенно, без ожидания сканера.
 */

export function CTPhoneGuard() {
  const [location] = useLocation();

  useEffect(() => {
    // === Патчим DOM API только один раз (глобально) ===
    if (!(window as any).__CT_PATCHED__) {
      (window as any).__CT_PATCHED__ = true;

      const origSetAttr = HTMLAnchorElement.prototype.setAttribute;
      const origRemoveAttr = HTMLAnchorElement.prototype.removeAttribute;

      // Глобальный кеш: оригинальный href -> подмена
      const subCache = new Map<string, string>();
      (window as any).__CT_SUB_CACHE__ = subCache;

      function applyCache(el: HTMLAnchorElement, value: string): string | null {
        const sub = subCache.get(value);
        if (sub && sub !== value) {
          // Есть подмена в кеше — возвращаем её
          return sub;
        }
        return null;
      }

      HTMLAnchorElement.prototype.setAttribute = function (name: string, value: string) {
        if (name.toLowerCase() === "href" && value?.startsWith("tel:")) {
          const sub = applyCache(this, value);
          if (sub) {
            return origSetAttr.call(this, name, sub);
          }
        }
        return origSetAttr.call(this, name, value);
      };

      HTMLAnchorElement.prototype.removeAttribute = function (name: string) {
        if (name.toLowerCase() === "href") {
          const current = this.getAttribute("href") || "";
          const sub = subCache.get(current);
          if (sub && sub !== current) {
            // Восстанавливаем подмену вместо удаления
            return origSetAttr.call(this, "href", sub);
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
            if (value?.startsWith("tel:")) {
              const sub = subCache.get(value);
              if (sub && sub !== value) {
                origDescriptor.set!.call(this, sub);
                return;
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

    // === MutationObserver для мгновенного обнаружения подмен ===
    const subCache = (window as any).__CT_SUB_CACHE__ as Map<string, string>;
    let active = true;

    function scanAll() {
      if (!active) return;
      document.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]').forEach((el) => {
        const domOrig = el.getAttribute("data-ct-orig");
        if (!domOrig) return;

        const current = el.getAttribute("href") || "";

        if (current !== domOrig) {
          // Есть подмена — обновляем кеш
          if (!subCache.has(domOrig) || subCache.get(domOrig) !== current) {
            subCache.set(domOrig, current);
          }
        } else {
          // Текущий = оригинал, но в кеше есть подмена — применяем
          const sub = subCache.get(domOrig);
          if (sub && sub !== current) {
            el.setAttribute("href", sub);
          }
        }
      });
    }

    // MutationObserver ловит изменения href в реальном времени
    let rafId: number | null = null;
    const observer = new MutationObserver((mutations) => {
      if (!active) return;

      let needScan = false;
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "href") {
          const el = m.target as HTMLAnchorElement;
          const href = el.getAttribute("href") || "";
          if (href.startsWith("tel:")) {
            const domOrig = el.getAttribute("data-ct-orig");
            if (domOrig && href !== domOrig) {
              // Calltouch подменил — мгновенно в кеш
              subCache.set(domOrig, href);
            }
          }
        } else if (m.type === "childList") {
          needScan = true;
        }
      }

      if (needScan) {
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          rafId = null;
          scanAll();
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href"],
    });

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
