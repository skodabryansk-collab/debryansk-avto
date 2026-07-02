import React from "react";
import { Phone } from "lucide-react";

/* Calltouch-safe phone link.
 * 1. data-ct-original — оригинальный номер, React не трогает (статический атрибут)
 * 2. shouldComponentUpdate = false — React НИКОГДА не перерисовывает DOM после mount
 * 3. componentDidMount — проверяем, если Calltouch уже подменил, оставляем подмену
 */
class CTPhoneLink extends React.Component<{
  className: string;
  phone: string;
  children?: React.ReactNode;
}> {
  private ref = React.createRef<HTMLAnchorElement>();

  shouldComponentUpdate() {
    return false;
  }

  componentDidMount() {
    const el = this.ref.current;
    if (!el) return;
    // Если Calltouch уже подменил href — не трогаем
    const h = el.getAttribute("href");
    const defaultHref = "tel:+" + this.props.phone.replace(/\D/g, "");
    if (!h || h === defaultHref) {
      el.href = defaultHref;
    }
  }

  render() {
    const href = "tel:+" + this.props.phone.replace(/\D/g, "");
    return (
      <a
        ref={this.ref}
        href={href}
        data-ct-original={href}
        className={this.props.className}
      >
        {this.props.children || this.props.phone}
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
