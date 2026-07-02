import { useEffect } from "react";
import { useLocation } from "wouter";

/* Глобальный защитник телефонов от React re-render.
 * Патчим setAttribute/removeAttribute/href на уровне прототипа.
 * Оригинал берем из data-ct-orig (задан в JSX при рендере).
 */

const CT_ORIG = Symbol.for("ct-orig");
const CT_SUB = Symbol.for("ct-sub");

export function CTPhoneGuard() {
  const [location] = useLocation();

  useEffect(() => {
    // === Патчим DOM API только один раз (глобально) ===
    if (!(window as any).__CT_PATCHED__) {
      (window as any).__CT_PATCHED__ = true;

      const origSetAttr = HTMLAnchorElement.prototype.setAttribute;
      const origRemoveAttr = HTMLAnchorElement.prototype.removeAttribute;

      function getOrig(el: HTMLAnchorElement): string | undefined {
        return (el as any)[CT_ORIG] as string | undefined;
      }
      function setOrig(el: HTMLAnchorElement, val: string) {
        (el as any)[CT_ORIG] = val;
      }
      function getSub(el: HTMLAnchorElement): string | undefined {
        return (el as any)[CT_SUB] as string | undefined;
      }
      function setSub(el: HTMLAnchorElement, val: string) {
        (el as any)[CT_SUB] = val;
      }

      HTMLAnchorElement.prototype.setAttribute = function (name: string, value: string) {
        if (name.toLowerCase() === "href" && value?.startsWith("tel:")) {
          const orig = getOrig(this);
          const storedSub = getSub(this);

          if (orig && storedSub) {
            // React пытается вернуть оригинал — восстанавливаем подмену
            if (value === orig) {
              return origSetAttr.call(this, name, storedSub);
            }
            // Calltouch подменил на новый номер — обновляем кеш
            if (value !== orig && value !== storedSub) {
              setSub(this, value);
            }
          }
        }
        return origSetAttr.call(this, name, value);
      };

      HTMLAnchorElement.prototype.removeAttribute = function (name: string) {
        if (name.toLowerCase() === "href") {
          const storedSub = getSub(this);
          if (storedSub) {
            return origSetAttr.call(this, "href", storedSub);
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
            const storedOrig = getOrig(this as HTMLAnchorElement);
            const storedSub = getSub(this as HTMLAnchorElement);
            if (storedOrig && storedSub && value === storedOrig) {
              origDescriptor.set!.call(this, storedSub);
              return;
            }
            origDescriptor.set!.call(this, value);
          },
          get: origDescriptor.get,
          configurable: true,
          enumerable: true,
        });
      }
    }

    // === Сканер запускается при каждой смене локации ===
    let active = true;

    function getOrig(el: HTMLAnchorElement): string | undefined {
      return (el as any)[CT_ORIG] as string | undefined;
    }
    function setOrig(el: HTMLAnchorElement, val: string) {
      (el as any)[CT_ORIG] = val;
    }
    function getSub(el: HTMLAnchorElement): string | undefined {
      return (el as any)[CT_SUB] as string | undefined;
    }
    function setSub(el: HTMLAnchorElement, val: string) {
      (el as any)[CT_SUB] = val;
    }

    function scan() {
      if (!active) return;
      document.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]').forEach((el) => {
        // Запоминаем оригинал из data-ct-orig (задан в JSX)
        const domOrig = el.getAttribute("data-ct-orig");
        if (domOrig && !getOrig(el)) {
          setOrig(el, domOrig);
        }

        const current = el.getAttribute("href") || "";
        const orig = getOrig(el);

        if (orig && current !== orig) {
          // Есть подмена — запоминаем/обновляем
          if (!getSub(el) || getSub(el) !== current) {
            setSub(el, current);
          }
        }
      });
    }

    // Агрессивный запуск первые 10 сек (500мс), потом режим 2 сек
    let fastCount = 0;
    const FAST_MAX = 20;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function tick() {
      if (!active) return;
      scan();
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
    };
  }, [location]);

  return null;
}
