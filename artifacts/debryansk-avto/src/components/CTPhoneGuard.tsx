import { useEffect } from "react";
import { useLocation } from "wouter";

/* Ядерный вариант защиты: патчим DOM API напрямую.
 * React перезаписывает href через setAttribute — мы перехватываем это на уровне прототипа.
 * Когда Calltouch подменил номер, мы запоминаем подмену.
 * Когда React пытается вернуть оригинал — перехватчик восстанавливает подмену ещё до того, как изменение попадёт в DOM.
 */

const CT_ORIG = Symbol.for("ct-orig");
const CT_SUB = Symbol.for("ct-sub");

export function CTPhoneGuard() {
  const [location] = useLocation();

  useEffect(() => {
    if ((window as any).__CT_PATCHED__) return;
    (window as any).__CT_PATCHED__ = true;

    const origSetAttr = HTMLAnchorElement.prototype.setAttribute;
    const origRemoveAttr = HTMLAnchorElement.prototype.removeAttribute;

    HTMLAnchorElement.prototype.setAttribute = function (
      name: string,
      value: string,
    ) {
      if (name.toLowerCase() === "href" && value?.startsWith("tel:")) {
        // Запоминаем оригинал (если ещё не запомнен)
        if (!(this as any)[CT_ORIG]) {
          const current = this.getAttribute("href") || "";
          if (current.startsWith("tel:")) {
            (this as any)[CT_ORIG] = current;
          }
        }
        const storedOrig = (this as any)[CT_ORIG] as string | undefined;
        const storedSub = (this as any)[CT_SUB] as string | undefined;

        if (storedOrig && storedSub) {
          // React пытается вернуть оригинал — мы восстанавливаем подмену
          if (value === storedOrig) {
            return origSetAttr.call(this, name, storedSub);
          }
          // Calltouch подменил на новый номер — обновляем кеш
          if (value !== storedOrig && value !== storedSub) {
            (this as any)[CT_SUB] = value;
          }
        }
      }
      return origSetAttr.call(this, name, value);
    };

    HTMLAnchorElement.prototype.removeAttribute = function (name: string) {
      if (name.toLowerCase() === "href") {
        const storedOrig = (this as any)[CT_ORIG] as string | undefined;
        const storedSub = (this as any)[CT_SUB] as string | undefined;
        if (storedOrig && storedSub) {
          // Восстанавливаем подмену вместо удаления
          return origSetAttr.call(this, "href", storedSub);
        }
      }
      return origRemoveAttr.call(this, name);
    };

    // Также патчим Object.defineProperty для href, чтобы React не мог обойти через него
    const origDescriptor = Object.getOwnPropertyDescriptor(
      HTMLAnchorElement.prototype,
      "href",
    );
    if (origDescriptor && origDescriptor.set) {
      Object.defineProperty(HTMLAnchorElement.prototype, "href", {
        set(value: string) {
          const storedOrig = (this as any)[CT_ORIG] as string | undefined;
          const storedSub = (this as any)[CT_SUB] as string | undefined;
          if (
            storedOrig &&
            storedSub &&
            value === storedOrig
          ) {
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

    // Периодически сканируем все ссылки — запоминаем подмены Calltouch
    let active = true;
    function scan() {
      if (!active) return;
      document.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]').forEach((el) => {
        if (!(el as any)[CT_ORIG]) {
          const current = el.getAttribute("href") || "";
          if (current.startsWith("tel:")) {
            (el as any)[CT_ORIG] = current;
          }
        }
        const orig = (el as any)[CT_ORIG] as string | undefined;
        const current = el.getAttribute("href") || "";
        if (orig && current !== orig && (!(el as any)[CT_SUB] || (el as any)[CT_SUB] !== current)) {
          (el as any)[CT_SUB] = current;
        }
      });
    }

    scan();
    const interval = setInterval(scan, 2000);

    return () => {
      active = false;
      clearInterval(interval);
      // Не убираем патчи, т.к. они глобальные и не могут быть откатаны без релоада
    };
  }, [location]);

  return null;
}
