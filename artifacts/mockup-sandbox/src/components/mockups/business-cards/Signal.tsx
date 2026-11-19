import "./_group.css";

const logo = "/__mockup/images/business-cards/debryansk-auto-space-logo.png";

export function Signal() {
  return (
    <main className="bc-showcase">
      <header className="bc-showcase-head">
        <div>
          <p className="bc-showcase-kicker">Визитка сотрудника</p>
          <h1 className="bc-showcase-title">Сигнал</h1>
        </div>
        <p className="bc-showcase-size">90 × 50 мм</p>
      </header>

      <section className="bc-pair" aria-label="Лицевая и оборотная стороны визитки">
        <div className="bc-side-wrap">
          <p className="bc-side-label">Лицевая сторона</p>
          <article className="bc-card bc-signal-front" aria-label="Лицевая сторона">
            <div className="bc-signal-top">
              <img className="bc-logo-art" src={logo} alt="Дебрянск Авто — Пространство автомобилей" />
              <span className="bc-signal-marker" aria-hidden="true" />
            </div>
            <div className="bc-signal-identity">
              <h2 className="bc-person-name">Коновалов Артем</h2>
              <p className="bc-person-role">Менеджер по продажам автомобилей</p>
            </div>
            <div className="bc-signal-footer" aria-hidden="true" />
          </article>
        </div>

        <div className="bc-side-wrap">
          <p className="bc-side-label">Оборотная сторона</p>
          <article className="bc-card bc-signal-back" aria-label="Оборотная сторона">
            <div className="bc-signal-rail" aria-hidden="true" />
            <div className="bc-signal-back-content">
              <p className="bc-signal-back-label">Связаться с Артемом</p>
              <p className="bc-signal-phone">8 920 607 28 57</p>
              <div className="bc-signal-contact-row">
                <span className="bc-contact-label">Почта</span>
                <span className="bc-signal-value">artem.konovalov@debryansk-auto.ru</span>
              </div>
              <div className="bc-signal-contact-row">
                <span className="bc-contact-label">Адрес</span>
                <span className="bc-signal-value">с. Супонево, ул. Шоссейная, 12Г</span>
              </div>
              <div className="bc-signal-site">debryansk-auto.ru</div>
            </div>
          </article>
        </div>
      </section>

      <style>{`
        .bc-signal-front {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 7%;
          background: #fff;
          color: var(--debryansk-ink);
        }
        .bc-signal-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .bc-signal-top .bc-logo-art { width: 58%; }
        .bc-signal-marker {
          width: 8px;
          height: 8px;
          margin-top: 3px;
          border-radius: 50%;
          background: var(--debryansk-green);
          box-shadow: 0 0 0 5px rgba(135, 182, 60, .12);
        }
        .bc-signal-identity { position: relative; z-index: 1; }
        .bc-signal-identity .bc-person-name { font-size: 26px; }
        .bc-signal-identity .bc-person-role { color: var(--debryansk-muted); }
        .bc-signal-footer {
          position: absolute;
          right: 0;
          bottom: 0;
          left: 0;
          height: 4px;
          background: var(--debryansk-gradient);
        }
        .bc-signal-back {
          display: flex;
          align-items: stretch;
          background: #fff;
          color: var(--debryansk-ink);
        }
        .bc-signal-rail {
          width: 7px;
          flex: 0 0 7px;
          background: var(--debryansk-gradient);
        }
        .bc-signal-back-content {
          display: flex;
          min-width: 0;
          flex: 1;
          flex-direction: column;
          justify-content: center;
          gap: 7px;
          padding: 6% 7%;
        }
        .bc-signal-back-label {
          margin: 0;
          color: var(--debryansk-blue);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .11em;
          line-height: 1;
          text-transform: uppercase;
        }
        .bc-signal-phone {
          margin: 0 0 3px;
          font-size: 21px;
          font-weight: 800;
          letter-spacing: -.035em;
          line-height: 1;
          white-space: nowrap;
        }
        .bc-signal-contact-row {
          display: flex;
          min-width: 0;
          align-items: baseline;
          gap: 10px;
          padding-top: 6px;
          border-top: 1px solid var(--debryansk-border);
        }
        .bc-signal-contact-row .bc-contact-label {
          width: 37px;
          flex: 0 0 37px;
          margin: 0;
        }
        .bc-signal-value {
          min-width: 0;
          font-size: 9px;
          font-weight: 700;
          line-height: 1.1;
          white-space: nowrap;
        }
        .bc-signal-site {
          align-self: flex-end;
          margin-top: 2px;
          color: var(--debryansk-muted);
          font-size: 9px;
          font-weight: 700;
          line-height: 1;
        }
      `}</style>
    </main>
  );
}
