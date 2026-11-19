import "./_group.css";

const logo = "/__mockup/images/business-cards/debryansk-auto-space-logo.png";

export function Graphite() {
  return (
    <main className="bc-showcase">
      <header className="bc-showcase-head">
        <div>
          <p className="bc-showcase-kicker">Визитка сотрудника</p>
          <h1 className="bc-showcase-title">Графит</h1>
        </div>
        <p className="bc-showcase-size">90 × 50 мм</p>
      </header>

      <section className="bc-pair" aria-label="Лицевая и оборотная стороны визитки">
        <div className="bc-side-wrap">
          <p className="bc-side-label">Лицевая сторона</p>
          <article className="bc-card bc-graphite-front" aria-label="Лицевая сторона">
            <div className="bc-graphite-logo-panel">
              <img src={logo} alt="Дебрянск Авто — Пространство автомобилей" />
            </div>
            <div className="bc-graphite-person">
              <h2 className="bc-person-name">Коновалов Артем</h2>
              <p className="bc-person-role">Менеджер по продажам автомобилей</p>
            </div>
            <div className="bc-graphite-corner" aria-hidden="true" />
          </article>
        </div>

        <div className="bc-side-wrap">
          <p className="bc-side-label">Оборотная сторона</p>
          <article className="bc-card bc-graphite-back" aria-label="Оборотная сторона">
            <p className="bc-graphite-label">Прямой контакт</p>
            <p className="bc-graphite-phone">8 920 607 28 57</p>
            <div className="bc-graphite-divider" aria-hidden="true" />
            <p className="bc-graphite-email">artem.konovalov@debryansk-auto.ru</p>
            <div className="bc-graphite-footer">
              <span>с. Супонево, ул. Шоссейная, 12Г</span>
              <span>debryansk-auto.ru</span>
            </div>
            <div className="bc-graphite-gradient" aria-hidden="true" />
          </article>
        </div>
      </section>

      <style>{`
        .bc-graphite-front {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 7%;
          background: var(--debryansk-ink);
          color: #fff;
          border-color: rgba(17, 19, 23, .2);
        }
        .bc-graphite-logo-panel {
          width: 62%;
          max-width: 260px;
          padding: 7px 10px;
          border-radius: 5px;
          background: #fff;
        }
        .bc-graphite-logo-panel img {
          display: block;
          width: 100%;
          height: auto;
          object-fit: contain;
        }
        .bc-graphite-person { position: relative; z-index: 1; }
        .bc-graphite-front .bc-person-name { font-size: 25px; }
        .bc-graphite-front .bc-person-role { color: rgba(255, 255, 255, .7); }
        .bc-graphite-corner {
          position: absolute;
          top: 0;
          right: 0;
          width: 4px;
          height: 100%;
          background: var(--debryansk-gradient);
        }
        .bc-graphite-back {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
          padding: 7%;
          background: var(--debryansk-ink);
          color: #fff;
          border-color: var(--debryansk-ink);
        }
        .bc-graphite-label {
          margin: 0;
          color: #9ac7e2;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .13em;
          line-height: 1;
          text-transform: uppercase;
        }
        .bc-graphite-phone {
          margin: 0;
          font-size: 23px;
          font-weight: 800;
          letter-spacing: -.03em;
          line-height: 1;
          white-space: nowrap;
        }
        .bc-graphite-divider {
          width: 45px;
          height: 3px;
          border-radius: 99px;
          background: var(--debryansk-gradient);
        }
        .bc-graphite-email {
          margin: 0;
          font-size: 10.5px;
          font-weight: 600;
          line-height: 1.2;
          white-space: nowrap;
        }
        .bc-graphite-footer {
          position: absolute;
          right: 7%;
          bottom: 7%;
          left: 7%;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding-top: 8px;
          border-top: 1px solid rgba(255, 255, 255, .16);
          color: rgba(255, 255, 255, .68);
          font-size: 8.5px;
          font-weight: 500;
          line-height: 1;
          white-space: nowrap;
        }
        .bc-graphite-gradient {
          position: absolute;
          right: 0;
          bottom: 0;
          left: 0;
          height: 3px;
          background: var(--debryansk-gradient);
        }
      `}</style>
    </main>
  );
}
