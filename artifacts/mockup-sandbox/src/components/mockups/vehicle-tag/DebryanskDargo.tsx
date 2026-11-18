export function DebryanskDargo() {
  return (
    <div className="tag-preview">
      <style>{`
        @font-face {
          font-family: TaglineManrope;
          src: url("/__mockup/images/vehicle-tag/manrope-400.woff2") format("woff2");
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }
        * { box-sizing: border-box; }
        .tag-preview {
          min-height: 100vh;
          padding: 20px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          background: #e8e9eb;
          color: #111;
          font-family: Arial, Helvetica, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .tag-sheet {
          width: min(100%, 210mm);
          min-height: 297mm;
          padding: 11mm 12mm 9mm;
          display: flex;
          flex-direction: column;
          background: #fff;
          box-shadow: 0 8px 30px rgba(0,0,0,.14);
        }
        .tag-top {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          padding-bottom: 4mm;
          border-bottom: 1.2px solid #111;
        }
        .tag-logo-lockup {
          position: relative;
          width: 56mm;
          height: 9.3mm;
          flex: 0 0 auto;
        }
        .tag-logo {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: fill;
          filter: brightness(0);
        }
        .tag-logo-tagline {
          position: absolute;
          top: 76%;
          right: 0;
          left: 22.1%;
          height: 22%;
          overflow: hidden;
          background: #fff;
          color: #111;
          font-family: TaglineManrope, Arial, Helvetica, sans-serif;
          font-size: 1.43mm;
          font-weight: 400;
          line-height: 1.15;
          letter-spacing: .025em;
          white-space: nowrap;
        }
        .tag-hero {
          min-height: 49mm;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 8mm;
          padding: 8mm 0 6mm;
          border-bottom: 1px solid #bbb;
        }
        .tag-kicker {
          margin: 0 0 2.5mm;
          color: #555;
          font-size: 8pt;
          font-weight: 700;
          letter-spacing: .17em;
          text-transform: uppercase;
        }
        .tag-make {
          margin: 0;
          font-size: 12pt;
          font-weight: 800;
          letter-spacing: .24em;
        }
        .tag-model {
          margin: 0;
          font-size: clamp(48px, 8vw, 68px);
          line-height: .94;
          font-weight: 900;
          letter-spacing: -.055em;
        }
        .tag-year {
          min-width: 30mm;
          margin-bottom: 1mm;
          padding-left: 4mm;
          border-left: 1px solid #888;
          text-align: left;
        }
        .tag-year-label {
          display: block;
          margin-bottom: 1mm;
          color: #555;
          font-size: 7.5pt;
          font-weight: 700;
          letter-spacing: .13em;
          text-transform: uppercase;
        }
        .tag-year-value {
          display: block;
          font-size: 21pt;
          line-height: 1;
          font-weight: 800;
          letter-spacing: -.04em;
        }
        .tag-configs {
          margin-top: 7mm;
        }
        .tag-config-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .tag-config-table th {
          padding: 1.8mm 1.5mm;
          border-bottom: 1.2px solid #111;
          color: #555;
          font-size: 7.5pt;
          font-weight: 700;
          letter-spacing: .1em;
          text-align: left;
          text-transform: uppercase;
        }
        .tag-config-table td {
          padding: 3mm 1.5mm;
          border-bottom: 1px solid #ccc;
          font-size: 9pt;
          line-height: 1.3;
          vertical-align: middle;
        }
        .tag-config-table td:first-child {
          font-size: 10pt;
          font-weight: 800;
        }
        .tag-config-table td:not(:first-child) {
          font-weight: 600;
        }
        .tag-config-table th:nth-child(1) { width: 23%; }
        .tag-config-table th:nth-child(2) { width: 35%; }
        .tag-config-table th:nth-child(3) { width: 25%; }
        .tag-config-table th:nth-child(4) { width: 17%; }
        }
        .tag-specs {
          margin-top: 3mm;
        }
        .tag-section-title {
          margin: 0 0 2mm;
          padding-bottom: 1.6mm;
          border-bottom: 1.3px solid #111;
          font-size: 11pt;
          font-weight: 800;
          letter-spacing: .09em;
          text-transform: uppercase;
        }
        .tag-spec-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          column-gap: 8mm;
        }
        .tag-spec {
          min-height: 14mm;
          display: grid;
          grid-template-columns: 39% 1fr;
          align-items: center;
          gap: 2mm;
          border-bottom: 1px solid #d0d0d0;
        }
        .tag-spec-label {
          color: #606060;
          font-size: 8pt;
          line-height: 1.25;
        }
        .tag-spec-value {
          font-size: 9.5pt;
          line-height: 1.25;
          font-weight: 700;
        }
        .tag-bottom {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 8mm;
          margin-top: auto;
          padding-top: 5mm;
          border-top: 1.2px solid #111;
        }
        .tag-bottom-copy {
          max-width: 95mm;
        }
        .tag-qr-title {
          margin: 0 0 1.8mm;
          font-size: 11pt;
          line-height: 1.2;
          font-weight: 800;
        }
        .tag-qr-copy {
          margin: 0;
          color: #4c4c4c;
          font-size: 8.5pt;
          line-height: 1.45;
        }
        .tag-qr {
          width: 32mm;
          height: 32mm;
          display: block;
          padding: 1mm;
          border: 1px solid #111;
          background: #fff;
        }
        .tag-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6mm;
          margin-top: 4mm;
          padding-top: 2.5mm;
          border-top: 1px solid #bbb;
          color: #555;
          font-size: 7pt;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        @media (max-width: 680px) {
          .tag-preview { padding: 8px; }
          .tag-sheet { padding: 7mm 7mm 6mm; }
          .tag-hero { min-height: 42mm; }
          .tag-model { font-size: clamp(40px, 12vw, 58px); }
          .tag-year { min-width: 24mm; }
          .tag-spec-grid { column-gap: 5mm; }
          .tag-spec { grid-template-columns: 42% 1fr; }
        }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body, #root { width: 210mm; min-height: 297mm; margin: 0 !important; padding: 0 !important; }
          .tag-preview { min-height: 297mm; padding: 0; background: #fff; }
          .tag-sheet {
            width: 210mm;
            min-height: 297mm;
            height: 297mm;
            padding: 11mm 12mm 9mm;
            box-shadow: none;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>

      <main className="tag-sheet" aria-label="Макет ценника автомобиля Haval Dargo">
        <header className="tag-top">
          <div className="tag-logo-lockup">
            <img
              className="tag-logo"
              src="/__mockup/images/vehicle-tag/debryansk-auto-logo.svg"
              alt="Дебрянск Авто"
            />
            <span className="tag-logo-tagline">Пространство автомобилей</span>
          </div>
        </header>

        <section className="tag-hero" aria-labelledby="vehicle-name">
          <div>
            <p className="tag-kicker">Новый автомобиль</p>
            <p className="tag-make">HAVAL</p>
            <h1 className="tag-model" id="vehicle-name">DARGO</h1>
          </div>
          <div className="tag-year">
            <span className="tag-year-label">Модельный год</span>
            <strong className="tag-year-value">2026</strong>
          </div>
        </section>

        <section className="tag-configs" aria-labelledby="config-title">
          <h2 className="tag-section-title" id="config-title">Комплектации и силовые агрегаты</h2>
          <table className="tag-config-table" aria-label="Комплектации и технические варианты Haval Dargo">
            <thead>
              <tr>
                <th>Комплектация</th>
                <th>Двигатель</th>
                <th>Коробка передач</th>
                <th>Привод</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Оптимум</td>
                <td>Бензин · 2,0 л · 200 л.с.</td>
                <td>7DCT · робот</td>
                <td>4WD</td>
              </tr>
              <tr>
                <td>Премиум</td>
                <td>Бензин · 2,0 л · 200 л.с.</td>
                <td>7DCT · робот</td>
                <td>4WD</td>
              </tr>
              <tr>
                <td>Техно+</td>
                <td>Бензин · 2,0 л · 200 л.с.</td>
                <td>7DCT · робот</td>
                <td>4WD</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="tag-specs" aria-labelledby="specs-title">
          <h2 className="tag-section-title" id="specs-title">Технические характеристики</h2>
          <div className="tag-spec-grid">
            <div className="tag-spec">
              <span className="tag-spec-label">Крутящий момент</span>
              <span className="tag-spec-value">380 Н·м</span>
            </div>
            <div className="tag-spec">
              <span className="tag-spec-label">Дорожный просвет</span>
              <span className="tag-spec-value">200 мм</span>
            </div>
            <div className="tag-spec">
              <span className="tag-spec-label">Колёсная база</span>
              <span className="tag-spec-value">2 738 мм</span>
            </div>
            <div className="tag-spec">
              <span className="tag-spec-label">Габариты</span>
              <span className="tag-spec-value">4 620 × 1 890 × 1 780 мм</span>
            </div>
            <div className="tag-spec">
              <span className="tag-spec-label">Максимальная скорость</span>
              <span className="tag-spec-value">180 км/ч</span>
            </div>
            <div className="tag-spec">
              <span className="tag-spec-label">Разгон до 100 км/ч</span>
              <span className="tag-spec-value">10,5 с</span>
            </div>
            <div className="tag-spec">
              <span className="tag-spec-label">Расход топлива, смешанный</span>
              <span className="tag-spec-value">8,8 л/100 км</span>
            </div>
            <div className="tag-spec">
              <span className="tag-spec-label">Объём топливного бака</span>
              <span className="tag-spec-value">60 л</span>
            </div>
          </div>
        </section>

        <section className="tag-bottom" aria-label="Подборка модели на сайте">
          <div className="tag-bottom-copy">
            <h2 className="tag-qr-title">Каталог Haval Dargo</h2>
            <p className="tag-qr-copy">
              Комплектации и доступные автомобили модели.
            </p>
          </div>
          <img
            className="tag-qr"
            src="/__mockup/images/vehicle-tag/dargo-catalog-qr.svg"
            alt="QR-код на подборку Haval Dargo на сайте Дебрянск Авто"
          />
        </section>

        <footer className="tag-footer">
          <span>debryansk-auto.ru</span>
        </footer>
      </main>
    </div>
  );
}
