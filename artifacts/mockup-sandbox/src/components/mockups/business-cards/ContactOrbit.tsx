import "./_group.css";

const logo = "/__mockup/images/business-cards/debryansk-auto-space-logo.png";

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
            <a className="co-call" href="tel:+79206072857" aria-label="Позвонить Артему: 8 920 607 28 57">
              <span className="co-phone">8 920 607 28 57</span>
              <span className="co-arrow" aria-hidden="true">↗</span>
            </a>
          </article>
        </div>

        <div className="bc-side-wrap">
          <p className="bc-side-label">Оборотная сторона · остальные маршруты</p>
          <article className="bc-card co-back" aria-label="Оборотная сторона визитки">
            <header className="co-back-head">
              <div>
                <p className="co-eyebrow">Дебрянск Авто</p>
                <h2>Выберите удобный способ</h2>
              </div>
              <span className="co-back-mark" aria-hidden="true">↗</span>
            </header>

            <div className="co-contact-list">
              <a href="https://debryansk-auto.ru" className="co-contact-link">
                <span className="co-contact-number">01</span>
                <span className="co-contact-copy">
                  <span className="co-contact-label">ОНЛАЙН</span>
                  <span className="co-contact-value">debryansk-auto.ru</span>
                </span>
                <span className="co-link-arrow" aria-hidden="true">↗</span>
              </a>
              <a href="mailto:artem.konovalov@debryansk-auto.ru" className="co-contact-link">
                <span className="co-contact-number">02</span>
                <span className="co-contact-copy">
                  <span className="co-contact-label">ПОЧТА</span>
                  <span className="co-contact-value co-email">artem.konovalov@debryansk-auto.ru</span>
                </span>
                <span className="co-link-arrow" aria-hidden="true">↗</span>
              </a>
            </div>

            <footer className="co-address">
              <span className="co-address-pin" aria-hidden="true">●</span>
              <span>
                <span className="co-contact-label">ЖДЁМ В ГОСТИ</span>
                <span className="co-address-value">с. Супонево, ул. Шоссейная, 12Г</span>
              </span>
              <span className="co-side-index" aria-hidden="true">02 / 02</span>
            </footer>
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
        .co-eyebrow {
          margin: 0 0 6px;
          color: #a8c2d2;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .14em;
          line-height: 1;
          text-transform: uppercase;
        }
        .co-name { font-size: 23px; }
        .co-role { color: rgba(255,255,255,.65); }
        .co-call {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          width: fit-content;
          color: #fff;
          text-decoration: none;
        }
        .co-call::before {
          position: absolute;
          inset: -8px -12px;
          z-index: -1;
          border: 1px solid rgba(255,255,255,.18);
          border-radius: 5px;
          background: rgba(255,255,255,.06);
          content: "";
          transition: background .18s ease, border-color .18s ease;
        }
        .co-call:hover::before {
          border-color: rgba(135,182,60,.8);
          background: rgba(135,182,60,.12);
        }
        .co-phone { font-size: 13px; font-weight: 800; letter-spacing: -.02em; }
        .co-arrow { color: #a9cc7b; font-size: 14px; }
        .co-side-index {
          color: #87919d;
          font-size: 7px;
          font-weight: 700;
          letter-spacing: .1em;
          white-space: nowrap;
        }
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
        .co-back-head .co-eyebrow { margin-bottom: 5px; color: var(--debryansk-blue); }
        .co-back-head h2 {
          margin: 0;
          color: var(--debryansk-ink);
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -.04em;
          line-height: 1.1;
        }
        .co-back-mark {
          display: grid;
          width: 24px;
          height: 24px;
          flex: 0 0 auto;
          place-items: center;
          border-radius: 50%;
          background: var(--debryansk-soft);
          color: var(--debryansk-blue);
          font-size: 12px;
          font-weight: 800;
        }
        .co-contact-list { display: grid; gap: 8px; }
        .co-contact-link {
          display: flex;
          align-items: center;
          min-width: 0;
          gap: 9px;
          padding: 7px 0;
          border-bottom: 1px solid var(--debryansk-border);
          color: inherit;
          text-decoration: none;
        }
        .co-contact-link:hover .co-link-arrow { color: var(--debryansk-green); transform: translate(2px,-2px); }
        .co-contact-number {
          color: #94a3b8;
          font-size: 8px;
          font-weight: 700;
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
          font-size: 10px;
          font-weight: 800;
          line-height: 1.15;
          white-space: nowrap;
        }
        .co-email { font-size: 8px; }
        .co-link-arrow {
          margin-left: auto;
          color: var(--debryansk-blue);
          font-size: 12px;
          transition: color .18s ease, transform .18s ease;
        }
        .co-address {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-top: 7px;
        }
        .co-address-pin { color: var(--debryansk-green); font-size: 9px; }
        .co-address-value {
          display: block;
          margin-top: 3px;
          color: var(--debryansk-ink);
          font-size: 8px;
          font-weight: 700;
          line-height: 1.1;
          white-space: nowrap;
        }
        .co-address .co-side-index { margin-left: auto; align-self: flex-end; }
        @media (max-width: 390px) {
          .co-name { font-size: 20px; }
          .co-phone { font-size: 11px; }
          .co-contact-value { font-size: 9px; }
          .co-email { font-size: 7px; }
          .co-address-value { font-size: 7px; }
        }
      `}</style>
    </main>
  );
}
