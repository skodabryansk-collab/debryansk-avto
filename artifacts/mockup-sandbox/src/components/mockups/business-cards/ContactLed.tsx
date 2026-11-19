import "./_group.css";

const logo = "/__mockup/images/business-cards/debryansk-auto-space-logo.png";

export function ContactLed() {
  return (
    <main className="bc-showcase">
      <header className="bc-showcase-head">
        <div>
          <p className="bc-showcase-kicker">Визитка сотрудника</p>
          <h1 className="bc-showcase-title">Контактная</h1>
        </div>
        <p className="bc-showcase-size">90 × 50 мм</p>
      </header>

      <section className="bc-pair" aria-label="Лицевая и оборотная стороны визитки">
        <div className="bc-side-wrap">
          <p className="bc-side-label">Лицевая сторона</p>
          <article className="bc-card bc-contact-front" aria-label="Лицевая сторона">
            <img className="bc-logo-art" src={logo} alt="Дебрянск Авто — Пространство автомобилей" />
            <div className="bc-contact-front-person">
              <h2 className="bc-person-name">Коновалов Артем</h2>
              <p className="bc-person-role">Менеджер по продажам автомобилей</p>
            </div>
            <div className="bc-contact-front-accent" aria-hidden="true" />
          </article>
        </div>

        <div className="bc-side-wrap">
          <p className="bc-side-label">Оборотная сторона</p>
          <article className="bc-card bc-contact-back" aria-label="Оборотная сторона">
            <header className="bc-contact-back-head">
              <h2>Контакты</h2>
              <span aria-hidden="true" />
            </header>
            <dl className="bc-contact-grid">
              <div className="bc-contact-item">
                <dt className="bc-contact-label">Телефон</dt>
                <dd className="bc-contact-value">8 920 607 28 57</dd>
              </div>
              <div className="bc-contact-item">
                <dt className="bc-contact-label">Сайт</dt>
                <dd className="bc-contact-value">debryansk-auto.ru</dd>
              </div>
              <div className="bc-contact-item bc-contact-item--wide">
                <dt className="bc-contact-label">Электронная почта</dt>
                <dd className="bc-contact-value">artem.konovalov@debryansk-auto.ru</dd>
              </div>
              <div className="bc-contact-item bc-contact-item--wide">
                <dt className="bc-contact-label">Адрес</dt>
                <dd className="bc-contact-value">с. Супонево, ул. Шоссейная, 12Г</dd>
              </div>
            </dl>
            <div className="bc-contact-back-rule" aria-hidden="true" />
          </article>
        </div>
      </section>

      <style>{`
        .bc-contact-front {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 8% 7%;
          background: #fff;
          color: var(--debryansk-ink);
        }
        .bc-contact-front::before {
          position: absolute;
          inset: 0 auto 0 0;
          width: 4px;
          background: var(--debryansk-gradient);
          content: "";
        }
        .bc-contact-front .bc-logo-art { width: 57%; }
        .bc-contact-front-person { position: relative; z-index: 1; }
        .bc-contact-front .bc-person-role { color: var(--debryansk-muted); }
        .bc-contact-front-accent {
          position: absolute;
          right: 7%;
          bottom: 9%;
          width: 13%;
          height: 3px;
          border-radius: 99px;
          background: var(--debryansk-gradient);
        }
        .bc-contact-back {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 7%;
          background: #fff;
          color: var(--debryansk-text);
        }
        .bc-contact-back-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .bc-contact-back-head h2 {
          margin: 0;
          color: var(--debryansk-ink);
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -.03em;
          line-height: 1;
        }
        .bc-contact-back-head span {
          width: 34px;
          height: 3px;
          border-radius: 99px;
          background: var(--debryansk-gradient);
        }
        .bc-contact-back .bc-contact-value { font-size: 10.5px; }
        .bc-contact-back-rule {
          width: 100%;
          height: 1px;
          background: var(--debryansk-border);
        }
      `}</style>
    </main>
  );
}
