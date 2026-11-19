import "./_group.css";

const logo = "/__mockup/images/business-cards/debryansk-auto-space-logo.png";
const websiteQr = "/__mockup/images/business-cards/debryansk-auto-site-qr.svg";

export function ContactOrbit() {
  return (
    <main className="bc-showcase co-showcase">
      <header className="bc-showcase-head">
        <div>
          <p className="bc-showcase-kicker">Визитка сотрудника · вариант</p>
          <h1 className="bc-showcase-title">Связаться напрямую</h1>
        </div>
        <p className="bc-showcase-size">90 × 50 мм</p>
      </header>
      <section className="bc-pair" aria-label="Визитка: лицевая и оборотная стороны">
        <div className="bc-side-wrap">
          <p className="bc-side-label">Лицевая сторона · главный контакт</p>
          <article className="bc-card co-front" aria-label="Лицевая сторона визитки">
            <div className="co-orb co-orb-one" aria-hidden="true" />
            <div className="co-orb co-orb-two" aria-hidden="true" />
            <div className="co-front-top">
              <img className="bc-logo-art co-logo" src={logo} alt="Дебрянск Авто — Пространство автомобилей" />
            </div>
            <div className="co-person">
              <h2 className="bc-person-name co-name">Коновалов Артем</h2>
              <p className="bc-person-role co-role">Эксперт по автомобилям</p>
            </div>
            <div className="co-call">
              <span className="co-phone">8 920 607 28 57</span>
            </div>
          </article>
        </div>

        <div className="bc-side-wrap">
          <p className="bc-side-label">Оборотная сторона · остальные маршруты</p>
          <article className="bc-card co-back" aria-label="Оборотная сторона визитки">
            <header className="co-back-head">
              <h2>Выберите удобный способ</h2>
            </header>

            <div className="co-back-body">
              <div className="co-contact-list">
                <div className="co-contact-link">
                  <span className="co-contact-copy">
                    <span className="co-contact-label">САЙТ</span>
                    <span className="co-contact-value">debryansk-auto.ru</span>
                  </span>
                </div>
                <div className="co-contact-link">
                  <span className="co-contact-copy">
                    <span className="co-contact-label">ПОЧТА</span>
                    <span className="co-contact-value">info@debryansk-auto.ru</span>
                  </span>
                </div>
                <div className="co-contact-link">
                  <span className="co-contact-copy">
                    <span className="co-contact-label">КОНТАКТНЫЙ ЦЕНТР</span>
                    <span className="co-contact-value">+7 4832 77 77 70</span>
                  </span>
                </div>
              </div>

              <figure className="co-qr">
                <img className="co-qr-image" src={websiteQr} alt="QR-код сайта debryansk-auto.ru" />
                <figcaption className="co-qr-caption">Сайт</figcaption>
              </figure>
            </div>
          </article>
        </div>
      </section>
      <style>{`
        .co-showcase .bc-showcase-head { margin-bottom: 18px; }
        .co-front {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 7% 7.5%;
          color: #fff;
          background: #111317;
          isolation: isolate;
        }
        .co-front::before {
          position: absolute;
          inset: 0 auto 0 0;
          z-index: -1;
          width: 5px;
          background: var(--debryansk-gradient);
          content: "";
        }
        .co-orb {
          position: absolute;
          z-index: -1;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 50%;
          pointer-events: none;
        }
        .co-orb-one {
          top: -43%;
          right: -8%;
          width: 75%;
          aspect-ratio: 1;
          background: radial-gradient(circle at 38% 58%, rgba(0,112,184,.3), rgba(0,112,184,0) 65%);
        }
        .co-orb-two {
          right: 10%;
          bottom: -66%;
          width: 74%;
          aspect-ratio: 1;
          border-color: rgba(135,182,60,.15);
        }
        .co-front-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .co-logo {
          width: 42%;
          max-height: 28px;
          filter: brightness(0) invert(1);
        }
        .co-person { position: relative; z-index: 1; }
        .co-name { font-size: 23px; }
        .co-role { color: rgba(255,255,255,.65); }
        .co-call {
          display: flex;
          align-items: center;
          width: fit-content;
          color: #fff;
        }
        .co-phone { font-size: 13px; font-weight: 800; letter-spacing: -.02em; }
        .co-back {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 7% 7.5%;
          background: #fff;
          color: var(--debryansk-text);
        }
        .co-back-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }
        .co-back-head h2 {
          margin: 0;
          color: var(--debryansk-ink);
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -.04em;
          line-height: 1.1;
        }
        .co-back-body {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 28%;
          align-items: center;
          gap: 4%;
          min-height: 0;
        }
        .co-contact-list { display: grid; gap: 3px; min-width: 0; }
        .co-contact-link {
          display: block;
          min-width: 0;
          padding: 5px 0;
          border-bottom: 1px solid var(--debryansk-border);
          color: inherit;
        }
        .co-contact-copy { display: grid; min-width: 0; gap: 3px; }
        .co-contact-label {
          display: block;
          color: var(--debryansk-muted);
          font-size: 7px;
          font-weight: 800;
          letter-spacing: .12em;
          line-height: 1;
        }
        .co-contact-value {
          display: block;
          color: var(--debryansk-ink);
          font-size: 9px;
          font-weight: 800;
          line-height: 1.15;
          white-space: nowrap;
        }
        .co-qr {
          display: grid;
          justify-items: center;
          gap: 4px;
          width: 100%;
          margin: 0;
        }
        .co-qr-image {
          display: block;
          width: 100%;
          aspect-ratio: 1;
          background: #fff;
          object-fit: contain;
        }
        .co-qr-caption {
          color: var(--debryansk-muted);
          font-size: 7px;
          font-weight: 700;
          line-height: 1;
        }
        @media (max-width: 390px) {
          .co-name { font-size: 20px; }
          .co-phone { font-size: 11px; }
          .co-contact-value { font-size: 8px; }
          .co-back-body { grid-template-columns: minmax(0, 1fr) 25%; }
        }
      `}</style>
    </main>
  );
}
