export function BusinessCardSpatial() {
  return (
    <main className="bc-preview min-h-screen bg-muted px-4 py-8 text-foreground sm:px-8 sm:py-12">
      <style>{`
        .bc-preview {
          font-family: var(--font-sans);
        }
        .bc-board {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 90mm));
          justify-content: center;
          gap: 8mm;
        }
        .bc-item {
          min-width: 0;
        }
        .bc-caption {
          margin: 0 0 2mm;
          color: hsl(var(--muted-foreground));
          font-family: var(--font-mono);
          font-size: 8pt;
          font-weight: 500;
          letter-spacing: .1em;
          line-height: 1;
          text-transform: uppercase;
        }
        .bc-card {
          position: relative;
          width: 90mm;
          max-width: 100%;
          aspect-ratio: 9 / 5;
          overflow: hidden;
          box-sizing: border-box;
          padding: 5.5mm;
          border: 1px solid hsl(var(--border));
        }
        .bc-front {
          display: flex;
          flex-direction: column;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
        }
        .bc-back {
          display: flex;
          flex-direction: column;
          background: hsl(var(--secondary));
          color: hsl(var(--secondary-foreground));
          border-color: hsl(var(--secondary));
        }
        .bc-lockup {
          position: relative;
          width: 56mm;
          max-width: 76%;
          height: 9.4mm;
          flex: 0 0 auto;
          overflow: hidden;
        }
        .bc-lockup img {
          display: block;
          width: 100%;
          height: auto;
          filter: brightness(0);
        }
        .bc-back .bc-lockup img {
          filter: none;
        }
        .bc-lockup-mask {
          position: absolute;
          top: 72%;
          right: 0;
          bottom: 0;
          left: 0;
          background: hsl(var(--background));
        }
        .bc-back .bc-lockup-mask {
          background: hsl(var(--secondary));
        }
        .bc-tagline {
          position: absolute;
          top: 75%;
          left: 21.5%;
          width: 78.5%;
          margin: 0;
          overflow: hidden;
          color: hsl(var(--foreground));
          font-family: var(--font-sans);
          font-size: 5.8pt;
          font-weight: 600;
          letter-spacing: .055em;
          line-height: 1.1;
          white-space: nowrap;
        }
        .bc-back .bc-tagline {
          color: hsl(var(--secondary-foreground));
        }
        .bc-rule {
          height: 1px;
          flex: 0 0 auto;
          margin-top: 3.5mm;
          background: hsl(var(--border));
        }
        .bc-front .bc-rule {
          background: hsl(var(--foreground));
        }
        .bc-identity {
          display: flex;
          flex: 1;
          flex-direction: column;
          justify-content: flex-end;
          min-height: 0;
          padding-top: 4mm;
        }
        .bc-name {
          margin: 0;
          font-size: 16pt;
          font-weight: 700;
          letter-spacing: -.035em;
          line-height: 1.05;
        }
        .bc-role {
          max-width: 65mm;
          margin: 2mm 0 0;
          color: hsl(var(--muted-foreground));
          font-size: 8.2pt;
          font-weight: 500;
          line-height: 1.25;
        }
        .bc-front .bc-bottom-rule {
          width: 11mm;
          height: 1.2mm;
          margin-top: 4mm;
          background: hsl(var(--primary));
        }
        .bc-reverse-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 3mm;
        }
        .bc-seal {
          position: relative;
          width: 15mm;
          height: 15mm;
          flex: 0 0 auto;
          overflow: hidden;
          border: 1px solid hsl(var(--border));
        }
        .bc-seal img {
          position: absolute;
          top: 50%;
          left: 0;
          width: 86mm;
          max-width: none;
          height: auto;
          transform: translateY(-50%);
          filter: none;
        }
        .bc-reverse-rule {
          height: 1px;
          margin: 3mm 0 2.5mm;
          background: hsl(var(--border));
        }
        .bc-contact-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          column-gap: 5mm;
          row-gap: 2.4mm;
          margin: auto 0 0;
        }
        .bc-contact {
          min-width: 0;
          margin: 0;
          font-size: 6.7pt;
          font-weight: 500;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }
        .bc-contact dt {
          margin: 0 0 .8mm;
          color: hsl(var(--muted-foreground));
          font-family: var(--font-mono);
          font-size: 5.6pt;
          letter-spacing: .06em;
          line-height: 1;
          text-transform: uppercase;
        }
        .bc-back .bc-contact dt {
          color: hsl(var(--chart-4));
        }
        .bc-contact dd {
          margin: 0;
        }
        .bc-contact-wide {
          grid-column: 1 / -1;
        }
        @media (max-width: 760px) {
          .bc-board {
            grid-template-columns: minmax(0, 90mm);
            gap: 7mm;
          }
          .bc-card {
            width: min(90mm, calc(100vw - 32px));
          }
        }
        @media print {
          .bc-preview {
            min-height: auto;
            padding: 0;
            background: hsl(var(--background));
          }
          .bc-board {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 8mm;
          }
          .bc-caption {
            display: none;
          }
          .bc-card {
            width: 90mm;
            max-width: none;
          }
        }
      `}</style>

      <section className="bc-board" aria-label="Две стороны визитной карточки 90 на 50 миллиметров">
        <div className="bc-item">
          <p className="bc-caption">Лицевая сторона</p>
          <article className="bc-card bc-front" aria-label="Лицевая сторона визитной карточки">
            <div className="bc-lockup" aria-label="Дебрянск Авто — Пространство автомобилей">
              <img src="/__mockup/images/vehicle-tag/debryansk-auto-logo.svg" alt="Дебрянск Авто" />
              <span className="bc-lockup-mask" aria-hidden="true" />
              <p className="bc-tagline">ПРОСТРАНСТВО АВТОМОБИЛЕЙ</p>
            </div>
            <div className="bc-rule" aria-hidden="true" />
            <div className="bc-identity">
              <h1 className="bc-name">Коновалов Артем</h1>
              <p className="bc-role">Менеджер по продажам автомобилей</p>
              <div className="bc-bottom-rule" aria-hidden="true" />
            </div>
          </article>
        </div>

        <div className="bc-item">
          <p className="bc-caption">Оборотная сторона</p>
          <article className="bc-card bc-back" aria-label="Оборотная сторона визитной карточки">
            <div className="bc-reverse-head">
              <div className="bc-lockup" aria-label="Дебрянск Авто — Пространство автомобилей">
                <img src="/__mockup/images/vehicle-tag/debryansk-auto-logo.svg" alt="Дебрянск Авто" />
                <span className="bc-lockup-mask" aria-hidden="true" />
                <p className="bc-tagline">ПРОСТРАНСТВО АВТОМОБИЛЕЙ</p>
              </div>
              <div className="bc-seal" aria-hidden="true">
                <img src="/__mockup/images/vehicle-tag/debryansk-auto-logo.svg" alt="" />
              </div>
            </div>
            <div className="bc-reverse-rule" aria-hidden="true" />
            <dl className="bc-contact-grid">
              <div className="bc-contact">
                <dt>Телефон</dt>
                <dd>8 920 607 28 57</dd>
              </div>
              <div className="bc-contact">
                <dt>Сайт</dt>
                <dd>debryansk-auto.ru</dd>
              </div>
              <div className="bc-contact bc-contact-wide">
                <dt>Электронная почта</dt>
                <dd>artem.konovalov@debryansk-auto.ru</dd>
              </div>
              <div className="bc-contact bc-contact-wide">
                <dt>Адрес</dt>
                <dd>с. Супонево, ул. Шоссейная, 12Г</dd>
              </div>
            </dl>
          </article>
        </div>
      </section>
    </main>
  );
}
