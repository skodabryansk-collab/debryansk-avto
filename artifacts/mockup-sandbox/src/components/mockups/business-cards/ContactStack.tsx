import "./_group.css";

const logo = "/__mockup/images/business-cards/debryansk-auto-space-logo.png";

export function ContactStack() {
  return (
    <main className="bc-showcase bc-contact-stack">
      <header className="bc-showcase-head">
        <div>
          <p className="bc-showcase-kicker">Визитка сотрудника</p>
          <h1 className="bc-showcase-title">Контактная · Вертикальная подача</h1>
        </div>
        <p className="bc-showcase-size">90 × 50 мм</p>
      </header>

      <section className="bc-contact-stack-pair" aria-label="Лицевая и оборотная стороны визитки">
        <div className="bc-side-wrap">
          <p className="bc-side-label">Лицевая сторона</p>
          <article className="bc-card bc-stack-front" aria-label="Лицевая сторона">
            <img className="bc-logo-art" src={logo} alt="Дебрянск Авто — Пространство автомобилей" />
            <div className="bc-stack-front-person">
              <span className="bc-stack-index">Персональный контакт</span>
              <h2 className="bc-person-name">Коновалов Артем</h2>
              <p className="bc-person-role">Менеджер по продажам автомобилей</p>
            </div>
            <div className="bc-stack-front-accent" aria-hidden="true" />
          </article>
        </div>

        <div className="bc-side-wrap">
          <p className="bc-side-label">Оборотная сторона</p>
          <article className="bc-card bc-stack-back" aria-label="Оборотная сторона">
            <header className="bc-stack-back-head">
              <div>
                <span className="bc-stack-index">Связаться напрямую</span>
                <h2>Контакты</h2>
              </div>
              <span className="bc-stack-mark" aria-hidden="true" />
            </header>
            <dl className="bc-stack-contact-list">
              <div className="bc-stack-contact-item bc-stack-contact-phone">
                <dt className="bc-contact-label">Телефон</dt>
                <dd className="bc-contact-value">8 920 607 28 57</dd>
              </div>
              <div className="bc-stack-contact-item">
                <dt className="bc-contact-label">Сайт</dt>
                <dd className="bc-contact-value">debryansk-auto.ru</dd>
              </div>
              <div className="bc-stack-contact-item">
                <dt className="bc-contact-label">Электронная почта</dt>
                <dd className="bc-contact-value">artem.konovalov@debryansk-auto.ru</dd>
              </div>
              <div className="bc-stack-contact-item">
                <dt className="bc-contact-label">Адрес</dt>
                <dd className="bc-contact-value">с. Супонево, ул. Шоссейная, 12Г</dd>
              </div>
            </dl>
            <div className="bc-stack-back-rule" aria-hidden="true" />
          </article>
        </div>
      </section>

      <style>{`
        .bc-contact-stack {
          padding: 24px 28px;
        }
        .bc-contact-stack .bc-showcase-head {
          max-width: 480px;
          margin-bottom: 12px;
        }
        .bc-contact-stack .bc-showcase-title {
          font-size: 18px;
        }
        .bc-contact-stack-pair {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .bc-contact-stack-pair .bc-side-wrap {
          width: min(100%, 480px);
        }
        .bc-stack-front {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 6% 7%;
          background: #fff;
          color: var(--debryansk-ink);
        }
        .bc-stack-front::before {
          position: absolute;
          inset: 0 auto 0 0;
          width: 4px;
          background: var(--debryansk-gradient);
          content: "";
        }
        .bc-stack-front .bc-logo-art {
          width: 48%;
          max-height: 38px;
        }
        .bc-stack-front-person {
          position: relative;
          z-index: 1;
        }
        .bc-stack-index {
          display: block;
          margin-bottom: 7px;
          color: var(--debryansk-blue);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .13em;
          line-height: 1;
          text-transform: uppercase;
        }
        .bc-stack-front .bc-person-role {
          color: var(--debryansk-muted);
        }
        .bc-stack-front-accent {
          position: absolute;
          right: 7%;
          bottom: 9%;
          width: 12%;
          height: 3px;
          border-radius: 99px;
          background: var(--debryansk-gradient);
        }
        .bc-stack-back {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 5.5% 7%;
          background: #fff;
          color: var(--debryansk-text);
        }
        .bc-stack-back-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .bc-stack-back-head h2 {
          margin: 0;
          color: var(--debryansk-ink);
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -.03em;
          line-height: 1;
        }
        .bc-stack-back-head .bc-stack-index {
          margin-bottom: 5px;
        }
        .bc-stack-mark {
          width: 28px;
          height: 28px;
          border: 1px solid var(--debryansk-border);
          border-radius: 50%;
          background: linear-gradient(135deg, #fff 0 46%, #eaf4f9 47% 100%);
        }
        .bc-stack-contact-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin: 10px 0;
        }
        .bc-stack-contact-item {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 6px;
          border-bottom: 1px solid var(--debryansk-border);
        }
        .bc-stack-contact-item dt,
        .bc-stack-contact-item dd {
          margin: 0;
        }
        .bc-stack-contact-item .bc-contact-label {
          flex: 0 0 auto;
          margin: 0;
          font-size: 7px;
        }
        .bc-stack-contact-item .bc-contact-value {
          text-align: right;
          font-size: 9px;
        }
        .bc-stack-contact-phone .bc-contact-value {
          color: var(--debryansk-ink);
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -.02em;
        }
        .bc-stack-back-rule {
          width: 100%;
          height: 3px;
          border-radius: 99px;
          background: var(--debryansk-gradient);
        }
        @media (max-width: 520px) {
          .bc-contact-stack {
            padding: 20px 12px;
          }
          .bc-contact-stack .bc-showcase-title {
            font-size: 16px;
          }
          .bc-stack-contact-item {
            gap: 7px;
          }
          .bc-stack-contact-item .bc-contact-value {
            font-size: 8px;
          }
        }
        @media print {
          .bc-contact-stack-pair {
            align-items: flex-start;
          }
          .bc-contact-stack-pair .bc-side-wrap {
            width: 90mm;
          }
        }
      `}</style>
    </main>
  );
}
