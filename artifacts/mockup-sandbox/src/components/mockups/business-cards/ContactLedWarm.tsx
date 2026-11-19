import "./_group.css";

const logo = "/__mockup/images/business-cards/debryansk-auto-space-logo.png";

export function ContactLedWarm() {
  return (
    <main className="bc-showcase bc-warm-showcase">
      <header className="bc-showcase-head">
        <div>
          <p className="bc-showcase-kicker">Визитка сотрудника</p>
          <h1 className="bc-showcase-title">Тёплая классика</h1>
        </div>
        <p className="bc-showcase-size">90 × 50 мм</p>
      </header>

      <section className="bc-pair" aria-label="Лицевая и оборотная стороны визитки">
        <div className="bc-side-wrap">
          <p className="bc-side-label">Лицевая сторона</p>
          <article className="bc-card bc-warm-front" aria-label="Лицевая сторона">
            <img className="bc-logo-art" src={logo} alt="Дебрянск Авто — Пространство автомобилей" />
            <div className="bc-warm-front-person">
              <h2 className="bc-person-name">Коновалов Артем</h2>
              <p className="bc-person-role">Менеджер по продажам автомобилей</p>
            </div>
            <div className="bc-warm-front-accent" aria-hidden="true" />
          </article>
        </div>

        <div className="bc-side-wrap">
          <p className="bc-side-label">Оборотная сторона</p>
          <article className="bc-card bc-warm-back" aria-label="Оборотная сторона">
            <header className="bc-warm-back-head">
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
            <div className="bc-warm-back-rule" aria-hidden="true" />
          </article>
        </div>
      </section>

      <style>{`
        .bc-warm-showcase {
          background: #e9e1d5;
          color: #403a32;
        }
        .bc-warm-showcase .bc-showcase-kicker {
          color: #956342;
        }
        .bc-warm-showcase .bc-showcase-title {
          color: #332c25;
        }
        .bc-warm-showcase .bc-showcase-size,
        .bc-warm-showcase .bc-side-label {
          color: #786d60;
        }
        .bc-warm-showcase .bc-card {
          border-color: rgba(66, 52, 39, .13);
          border-radius: 7px;
          box-shadow: 0 12px 27px rgba(66, 52, 39, .14), 0 2px 5px rgba(66, 52, 39, .06);
        }
        .bc-warm-front {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 8% 7%;
          background: #f8f4ec;
          color: #332c25;
        }
        .bc-warm-front::before {
          position: absolute;
          inset: 0 auto 0 0;
          width: 4px;
          background: #a86f46;
          content: "";
        }
        .bc-warm-front .bc-logo-art {
          width: 57%;
          filter: saturate(.68);
        }
        .bc-warm-front-person {
          position: relative;
          z-index: 1;
        }
        .bc-warm-front .bc-person-name {
          color: #332c25;
        }
        .bc-warm-front .bc-person-role {
          color: #817466;
        }
        .bc-warm-front-accent {
          position: absolute;
          right: 7%;
          bottom: 9%;
          width: 13%;
          height: 2px;
          border-radius: 99px;
          background: #a86f46;
        }
        .bc-warm-back {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 7%;
          background: #f8f4ec;
          color: #403a32;
        }
        .bc-warm-back-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .bc-warm-back-head h2 {
          margin: 0;
          color: #332c25;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -.03em;
          line-height: 1;
        }
        .bc-warm-back-head span {
          width: 34px;
          height: 2px;
          border-radius: 99px;
          background: #a86f46;
        }
        .bc-warm-back .bc-contact-label {
          color: #956342;
        }
        .bc-warm-back .bc-contact-value {
          color: #403a32;
          font-size: 10.5px;
        }
        .bc-warm-back-rule {
          width: 100%;
          height: 1px;
          background: #ded3c4;
        }
      `}</style>
    </main>
  );
}
