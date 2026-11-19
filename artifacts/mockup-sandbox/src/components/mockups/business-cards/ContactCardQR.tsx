import "./_group.css";

const logo = "/__mockup/images/business-cards/debryansk-auto-space-logo.png";
const vCard = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "N:Коновалов;Артем;;;",
  "FN:Артем Коновалов",
  "ORG:Дебрянск Авто",
  "TITLE:Менеджер по продажам автомобилей",
  "TEL;TYPE=WORK,VOICE:+79206072857",
  "EMAIL;TYPE=WORK:artem.konovalov@debryansk-auto.ru",
  "ADR;TYPE=WORK:;;ул. Шоссейная\\, 12Г;Супонево;;;Россия",
  "URL:https://debryansk-auto.ru",
  "END:VCARD",
].join("\r\n");
const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&format=svg&margin=0&data=${encodeURIComponent(vCard)}`;
const vCardHref = `data:text/vcard;charset=utf-8,${encodeURIComponent(vCard)}`;

export function ContactCardQR() {
  return (
    <main className="bc-showcase ccqr-showcase">
      <header className="bc-showcase-head">
        <div>
          <p className="bc-showcase-kicker">Визитка сотрудника · QR-контакт</p>
          <h1 className="bc-showcase-title">Контактная — QR</h1>
        </div>
        <p className="bc-showcase-size">90 × 50 мм</p>
      </header>

      <section className="bc-pair" aria-label="Лицевая и оборотная стороны визитки">
        <div className="bc-side-wrap">
          <p className="bc-side-label">Лицевая сторона</p>
          <article className="bc-card ccqr-front" aria-label="Лицевая сторона">
            <img className="bc-logo-art" src={logo} alt="Дебрянск Авто — Пространство автомобилей" />
            <div className="ccqr-front-copy">
              <h2 className="bc-person-name">Коновалов Артем</h2>
              <p className="bc-person-role">Менеджер по продажам автомобилей</p>
            </div>
            <span className="ccqr-index" aria-hidden="true">01 / 02</span>
          </article>
        </div>

        <div className="bc-side-wrap">
          <p className="bc-side-label">Оборотная сторона · сохранить контакт</p>
          <article className="bc-card ccqr-back" aria-label="Оборотная сторона">
            <div className="ccqr-back-info">
              <div className="ccqr-back-heading">
                <p className="bc-showcase-kicker">Дебрянск · Брянск</p>
                <h2>Свяжитесь<br />напрямую</h2>
              </div>
              <div className="ccqr-details">
                <div>
                  <span className="bc-contact-label">Телефон</span>
                  <a className="bc-contact-value" href="tel:+79206072857">8 920 607 28 57</a>
                </div>
                <div>
                  <span className="bc-contact-label">Электронная почта</span>
                  <a className="bc-contact-value ccqr-email" href="mailto:artem.konovalov@debryansk-auto.ru">artem.konovalov@debryansk-auto.ru</a>
                </div>
                <div>
                  <span className="bc-contact-label">Адрес</span>
                  <span className="bc-contact-value">с. Супонево, ул. Шоссейная, 12Г</span>
                </div>
              </div>
              <div className="ccqr-site">
                <span>debryansk-auto.ru</span>
                <i aria-hidden="true" />
              </div>
            </div>
            <a
              className="ccqr-qr-link"
              href={vCardHref}
              download="Artem-Konovalov.vcf"
              aria-label="Скачать контактную карточку vCard"
            >
              <img src={qrSrc} alt="QR-код для сохранения контакта Артема Коновалова" />
              <span>СКАНИРУЙТЕ<br />ДЛЯ СОХРАНЕНИЯ</span>
            </a>
            <span className="ccqr-back-corner" aria-hidden="true" />
          </article>
        </div>
      </section>

      <style>{`
        .ccqr-showcase .bc-pair { grid-template-columns: repeat(2, minmax(0, 440px)); }
        .ccqr-front {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: space-between;
          padding: 8% 7%;
          background: #fff;
          color: var(--debryansk-ink);
        }
        .ccqr-front::before {
          position: absolute;
          inset: 0 auto 0 0;
          width: 4px;
          background: var(--debryansk-gradient);
          content: "";
        }
        .ccqr-front .bc-logo-art { width: 57%; }
        .ccqr-front-copy { position: relative; z-index: 1; }
        .ccqr-front .bc-person-role { color: var(--debryansk-muted); }
        .ccqr-index {
          position: absolute;
          right: 7%;
          bottom: 8%;
          color: var(--debryansk-muted);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .14em;
        }
        .ccqr-back {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 4%;
          padding: 6% 6.5%;
          background: #fff;
          color: var(--debryansk-text);
        }
        .ccqr-back-info {
          display: flex;
          min-width: 0;
          height: 100%;
          flex: 1;
          flex-direction: column;
          justify-content: space-between;
        }
        .ccqr-back-heading .bc-showcase-kicker { margin-bottom: 6px; font-size: 7px; }
        .ccqr-back-heading h2 {
          margin: 0;
          color: var(--debryansk-ink);
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -.045em;
          line-height: 1.02;
        }
        .ccqr-details { display: grid; gap: 7px; }
        .ccqr-details > div { min-width: 0; }
        .ccqr-details .bc-contact-label { margin-bottom: 3px; font-size: 6.5px; }
        .ccqr-details .bc-contact-value { font-size: 8px; }
        .ccqr-details a { color: inherit; text-decoration: none; }
        .ccqr-email { font-size: 7px !important; letter-spacing: -.025em; }
        .ccqr-site {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--debryansk-muted);
          font-size: 7px;
          font-weight: 700;
          white-space: nowrap;
        }
        .ccqr-site i {
          width: 28px;
          height: 2px;
          border-radius: 99px;
          background: var(--debryansk-gradient);
        }
        .ccqr-qr-link {
          display: flex;
          flex: 0 0 31%;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          color: var(--debryansk-blue);
          text-align: center;
          text-decoration: none;
        }
        .ccqr-qr-link img {
          display: block;
          width: 100%;
          aspect-ratio: 1;
          border: 5px solid #fff;
          outline: 1px solid var(--debryansk-border);
          background: #fff;
          object-fit: contain;
        }
        .ccqr-qr-link span {
          font-size: 6px;
          font-weight: 800;
          letter-spacing: .09em;
          line-height: 1.35;
          white-space: nowrap;
        }
        .ccqr-back-corner {
          position: absolute;
          top: 0;
          right: 0;
          width: 4px;
          height: 100%;
          background: var(--debryansk-gradient);
        }
        @media (max-width: 760px) {
          .ccqr-showcase .bc-pair { grid-template-columns: minmax(0, 440px); }
        }
        @media print {
          .ccqr-back,
          .ccqr-front { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </main>
  );
}
