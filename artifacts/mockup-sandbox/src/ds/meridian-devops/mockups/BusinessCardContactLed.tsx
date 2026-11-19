export function BusinessCardContactLed() {
  return (
    <main className="bc-preview">
      <style>{`
        .bc-preview {
          box-sizing: border-box;
          display: flex;
          min-height: 100vh;
          align-items: center;
          justify-content: center;
          padding: 28px;
          background: hsl(var(--muted));
          color: hsl(var(--foreground));
          font-family: var(--font-sans);
        }
        .bc-preview *,
        .bc-preview *::before,
        .bc-preview *::after {
          box-sizing: border-box;
        }
        .bc-presentation {
          width: 100%;
          max-width: 880px;
        }
        .bc-caption {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 16px;
          margin: 0 0 18px;
          color: hsl(var(--muted-foreground));
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .bc-pair {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          gap: 28px;
        }
        .bc-side {
          width: 90mm;
          height: 50mm;
          flex: 0 0 auto;
          overflow: hidden;
          border: 1px solid hsl(var(--border));
          position: relative;
        }
        .bc-front {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 5.5mm 6mm 4.7mm;
          background: hsl(var(--background));
        }
        .bc-front::before {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          width: 1.1mm;
          background: hsl(var(--primary));
          content: "";
        }
        .bc-person {
          margin: 0;
          font-size: 14pt;
          font-weight: 700;
          letter-spacing: -.035em;
          line-height: 1.08;
        }
        .bc-role {
          margin: 1.5mm 0 0;
          color: hsl(var(--muted-foreground));
          font-size: 7.2pt;
          font-weight: 500;
          letter-spacing: .005em;
          line-height: 1.2;
        }
        .bc-front-bottom {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 3mm;
        }
        .bc-location {
          max-width: 43mm;
          margin: 0;
          border-left: 1px solid hsl(var(--border));
          padding-left: 2.5mm;
          font-size: 6.4pt;
          font-weight: 500;
          line-height: 1.35;
        }
        .bc-lockup {
          position: relative;
          width: 35mm;
          height: 5.1mm;
          flex: 0 0 auto;
          overflow: hidden;
        }
        .bc-logo {
          display: block;
          width: 35mm;
          height: auto;
          filter: brightness(0);
        }
        .bc-tagline {
          position: absolute;
          right: 0;
          bottom: 0;
          left: 22.1%;
          margin: 0;
          overflow: hidden;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          font-size: 4.7pt;
          font-weight: 600;
          letter-spacing: .085em;
          line-height: 1.25;
          white-space: nowrap;
        }
        .bc-back {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 5.2mm 6mm 4.6mm;
          background: hsl(var(--sidebar));
          color: hsl(var(--sidebar-foreground));
          border-color: hsl(var(--sidebar-border));
        }
        .bc-back::after {
          position: absolute;
          top: 0;
          right: 0;
          width: 1.1mm;
          height: 15mm;
          background: hsl(var(--primary));
          content: "";
        }
        .bc-back-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 4mm;
        }
        .bc-back .bc-lockup {
          width: 32mm;
          height: 4.65mm;
        }
        .bc-back .bc-logo {
          width: 32mm;
          filter: none;
        }
        .bc-back .bc-tagline {
          background: hsl(var(--sidebar));
          color: hsl(var(--sidebar-foreground));
          font-size: 4.2pt;
        }
        .bc-back-label {
          margin: .2mm 0 0;
          color: hsl(var(--sidebar-foreground));
          font-family: var(--font-mono);
          font-size: 5.1pt;
          letter-spacing: .12em;
          line-height: 1;
          text-align: right;
          text-transform: uppercase;
        }
        .bc-contact {
          display: flex;
          flex-direction: column;
          gap: 2mm;
          margin: 0;
          border-left: 1px solid hsl(var(--sidebar-border));
          padding-left: 3mm;
        }
        .bc-phone {
          margin: 0;
          font-size: 11.5pt;
          font-weight: 700;
          letter-spacing: .015em;
          line-height: 1;
        }
        .bc-email,
        .bc-site {
          margin: 0;
          font-size: 6.25pt;
          font-weight: 500;
          letter-spacing: .005em;
          line-height: 1.15;
        }
        .bc-back-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 3mm;
          border-top: 1px solid hsl(var(--sidebar-border));
          padding-top: 2mm;
          color: hsl(var(--sidebar-foreground));
          font-family: var(--font-mono);
          font-size: 5.2pt;
          line-height: 1;
        }
        .bc-side-name {
          margin: 0 0 7px;
          color: hsl(var(--muted-foreground));
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: .04em;
          text-align: center;
        }
        @media (max-width: 760px) {
          .bc-preview { padding: 24px 12px; }
          .bc-caption { justify-content: center; flex-wrap: wrap; }
          .bc-pair { flex-direction: column; align-items: center; gap: 20px; }
        }
        @media (max-width: 380px) {
          .bc-side { transform: scale(.88); transform-origin: top center; margin-bottom: -23px; }
        }
      `}</style>
      <section className="bc-presentation" aria-label="Визитная карточка Дебрянск Авто, 90 на 50 миллиметров">
        <p className="bc-caption">
          <span>Визитная карточка сотрудника</span>
          <span>90 × 50 мм</span>
        </p>
        <div className="bc-pair">
          <div>
            <p className="bc-side-name">Лицевая сторона</p>
            <article className="bc-side bc-front" aria-label="Лицевая сторона визитной карточки">
              <div>
                <h1 className="bc-person">Коновалов Артем</h1>
                <p className="bc-role">Менеджер по продажам автомобилей</p>
              </div>
              <div className="bc-front-bottom">
                <p className="bc-location">с. Супонево, ул. Шоссейная, 12Г</p>
                <div className="bc-lockup">
                  <img className="bc-logo" src="/__mockup/images/vehicle-tag/debryansk-auto-logo.svg" alt="ДЕБРЯНСК АВТО" />
                  <p className="bc-tagline">ПРОСТРАНСТВО АВТОМОБИЛЕЙ</p>
                </div>
              </div>
            </article>
          </div>
          <div>
            <p className="bc-side-name">Оборотная сторона</p>
            <article className="bc-side bc-back" aria-label="Оборотная сторона визитной карточки">
              <div className="bc-back-top">
                <div className="bc-lockup">
                  <img className="bc-logo" src="/__mockup/images/vehicle-tag/debryansk-auto-logo.svg" alt="ДЕБРЯНСК АВТО" />
                  <p className="bc-tagline">ПРОСТРАНСТВО АВТОМОБИЛЕЙ</p>
                </div>
                <p className="bc-back-label">Прямой<br />контакт</p>
              </div>
              <div className="bc-contact">
                <p className="bc-phone">8 920 607 28 57</p>
                <p className="bc-email">artem.konovalov@debryansk-auto.ru</p>
              </div>
              <div className="bc-back-footer">
                <span>с. Супонево, ул. Шоссейная, 12Г</span>
                <span>debryansk-auto.ru</span>
              </div>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
