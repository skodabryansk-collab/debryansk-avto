import React from "react";
import { Phone } from "lucide-react";

/* Calltouch-safe phone link.
 * 1. data-ct-orig — оригинальный номер (задан при рендере, не изменяется)
 * 2. shouldComponentUpdate — разрешаем перерисовку ТОЛЬКО если поменялся
 *    исходный phone (реальные данные, например ответ API). Если phone
 *    не изменился — блокируем, чтобы React не затёр подмену Calltouch.
 * 3. CTPhoneGuard читает data-ct-orig для определения оригинала
 */
class CTPhoneLink extends React.Component<{
  className: string;
  phone: string;
  children?: React.ReactNode;
}> {
  shouldComponentUpdate(nextProps: Readonly<{ className: string; phone: string; children?: React.ReactNode }>) {
    // Разрешить перерисовку если поменялся исходный номер
    // (реальные данные изменились — например пришёл ответ API)
    if (nextProps.phone !== this.props.phone) {
      return true;
    }
    // Иначе (тот же исходный номер) — не перерисовывать,
    // чтобы React не затёр подмену Calltouch
    return false;
  }

  render() {
    const phone = this.props.phone || "";
    const digits = phone.replace(/\D/g, "");
    const href = digits ? "tel:+" + digits : "tel:";
    return (
      <a
        href={href}
        data-ct-orig={href}
        className={this.props.className}
      >
        {this.props.children || phone}
      </a>
    );
  }
}

/* Desktop: с иконкой + текст */
export function CTPhoneDesktop({
  className,
  phone,
}: {
  className: string;
  phone: string;
}) {
  return (
    <CTPhoneLink className={className} phone={phone}>
      <Phone className="w-4 h-4" />
      {phone}
    </CTPhoneLink>
  );
}

/* Mobile: только иконка */
export function CTPhoneMobile({
  className,
  phone,
}: {
  className: string;
  phone: string;
}) {
  return (
    <CTPhoneLink className={className} phone={phone}>
      <Phone className="w-4 h-4" />
    </CTPhoneLink>
  );
}

/* Generic: произвольный children */
export function CTPhone({
  className,
  phone,
  children,
}: {
  className: string;
  phone: string;
  children?: React.ReactNode;
}) {
  return (
    <CTPhoneLink className={className} phone={phone}>
      {children || phone}
    </CTPhoneLink>
  );
}
