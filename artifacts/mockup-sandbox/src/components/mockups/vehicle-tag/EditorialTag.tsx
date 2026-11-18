export function EditorialTag() {
  return (
    <div className="editorial-tag-preview">
      <style>{`
        @font-face {
          font-family: EditorialManrope;
          src: url("/__mockup/images/vehicle-tag/manrope-400.woff2") format("woff2");
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: EditorialManrope;
          src: url("/__mockup/images/vehicle-tag/manrope-600.woff2") format("woff2");
          font-weight: 600;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: EditorialManrope;
          src: url("/__mockup/images/vehicle-tag/manrope-700.woff2") format("woff2");
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: EditorialSerif;
          src: local("Georgia");
          font-weight: 400;
          font-style: normal;
        }
        .editorial-tag-preview,
        .editorial-tag-preview * { box-sizing: border-box; }
        .editorial-tag-preview {
          min-height: 100vh;
          padding: 22px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          background: #e9e6df;
          color: #22231f;
          font-family: EditorialManrope, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .editorial-sheet {
          width: min(100%, 210mm);
          min-height: 297mm;
          padding: 12mm 13mm 10mm;
          display: flex;
          flex-direction: column;
          background: #fbfaf6;
          box-shadow: 0 12px 38px rgba(40, 37, 30, .16);
        }
        .editorial-masthead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 7mm;
          padding-bottom: 4mm;
          border-bottom: 1px solid #7c7b72;
        }
        .editorial-brand {
          position: relative;
          width: 46mm;
          height: 8mm;
          flex: 0 0 auto;
        }
        .editorial-logo {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: fill;
          object-position: left center;
          filter: brightness(0);
        }
        .editorial-tagline {
          position: absolute;
          top: 76%;
          right: 0;
          left: 22.1%;
          height: 24%;
          margin: 0;
          overflow: hidden;
          background: #fbfaf6;
          font-size: 5.2pt;
          font-weight: 600;
          letter-spacing: .1em;
          line-height: 1;
          white-space: nowrap;
        }
        .editorial-mast-note {
          color: #68685f;
          font-size: 7pt;
          letter-spacing: .12em;
          text-align: right;
          text-transform: uppercase;
        }
        .editorial-lead {
          position: relative;
          padding: 9mm 0 7mm;
          border-bottom: 2px solid #292a25;
        }
        .editorial-kicker {
          display: flex;
          align-items: center;
          gap: 3mm;
          margin: 0 0 3mm;
          color: #68685f;
          font-size: 7.5pt;
          font-weight: 700;
          letter-spacing: .2em;
          text-transform: uppercase;
        }
        .editorial-kicker:before {
          width: 12mm;
          height: 1px;
          background: #8d8c81;
          content: "";
        }
        .editorial-title-line {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 8mm;
        }
        .editorial-make {
          margin: 0 0 1mm 1mm;
          font-size: 11pt;
          line-height: 1.1;
          font-weight: 700;
          letter-spacing: .25em;
        }
        .editorial-model {
          margin: 0;
          font-family: EditorialSerif, Georgia, serif;
          font-size: clamp(72px, 11vw, 104px);
          line-height: .82;
          font-weight: 400;
          letter-spacing: -.075em;
        }
        .editorial-year {
          flex: 0 0 auto;
          margin: 0 0 2mm;
          padding: 0 0 1.5mm 4mm;
          border-left: 1px solid #aaa99e;
          color: #4f5049;
          font-size: 8pt;
          line-height: 1.3;
          letter-spacing: .04em;
        }
        .editorial-year strong {
          display: block;
          color: #242520;
          font-family: EditorialSerif, Georgia, serif;
          font-size: 25pt;
          font-weight: 400;
          line-height: 1;
          letter-spacing: -.04em;
        }
        .editorial-subline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6mm;
          margin-top: 5mm;
          color: #62635b;
          font-family: EditorialSerif, Georgia, serif;
          font-size: 11pt;
          font-style: italic;
        }
        .editorial-subline span:last-child {
          font-family: EditorialManrope, sans-serif;
          font-size: 7pt;
          font-style: normal;
          letter-spacing: .13em;
          text-transform: uppercase;
        }
        .editorial-configs { padding-top: 6.5mm; }
        .editorial-section-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 5mm;
          margin-bottom: 2.5mm;
        }
        .editorial-section-title {
          margin: 0;
          font-size: 9pt;
          font-weight: 700;
          letter-spacing: .14em;
          text-transform: uppercase;
        }
        .editorial-section-index {
          color: #818177;
          font-family: EditorialSerif, Georgia, serif;
          font-size: 11pt;
          font-style: italic;
        }
        .editorial-config-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .editorial-config-table th {
          padding: 2.2mm 1.5mm;
          border-top: 1px solid #3c3d37;
          border-bottom: 1px solid #aaa99e;
          color: #68685f;
          font-size: 6.5pt;
          font-weight: 600;
          letter-spacing: .12em;
          text-align: left;
          text-transform: uppercase;
        }
        .editorial-config-table td {
          padding: 3.2mm 1.5mm;
          border-bottom: 1px solid #d8d6cc;
          font-size: 9pt;
          line-height: 1.25;
          vertical-align: middle;
        }
        .editorial-config-table td:first-child {
          font-family: EditorialSerif, Georgia, serif;
          font-size: 12pt;
        }
        .editorial-config-table td:not(:first-child) { color: #474841; }
        .editorial-config-table th:nth-child(1) { width: 25%; }
        .editorial-config-table th:nth-child(2) { width: 34%; }
        .editorial-config-table th:nth-child(3) { width: 25%; }
        .editorial-config-table th:nth-child(4) { width: 16%; }
        .editorial-specs {
          display: grid;
          grid-template-columns: .72fr 1.28fr;
          gap: 10mm;
          margin-top: 7mm;
          padding-top: 5mm;
          border-top: 1px solid #8d8c81;
        }
        .editorial-spec-intro {
          padding-right: 4mm;
        }
        .editorial-spec-intro .editorial-section-title {
          max-width: 44mm;
          font-family: EditorialSerif, Georgia, serif;
          font-size: 20pt;
          font-weight: 400;
          letter-spacing: -.04em;
          line-height: 1.04;
          text-transform: none;
        }
        .editorial-spec-intro p {
          max-width: 39mm;
          margin: 3mm 0 0;
          color: #73736b;
          font-size: 7pt;
          line-height: 1.5;
        }
        .editorial-spec-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          column-gap: 6mm;
        }
        .editorial-spec {
          min-height: 17mm;
          padding: 2.2mm 0 1.8mm;
          border-top: 1px solid #d0cec4;
        }
        .editorial-spec dt {
          margin-bottom: 1.4mm;
          color: #727269;
          font-size: 7pt;
          line-height: 1.25;
        }
        .editorial-spec dd {
          margin: 0;
          font-family: EditorialSerif, Georgia, serif;
          font-size: 14pt;
          line-height: 1.05;
          letter-spacing: -.025em;
        }
        .editorial-spec dd.editorial-wide-value { font-size: 10pt; }
        .editorial-bottom {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 29mm;
          align-items: center;
          gap: 7mm;
          margin-top: 6mm;
          padding: 4mm 0;
          border-top: 1px solid #8d8c81;
          border-bottom: 1px solid #8d8c81;
        }
        .editorial-qr-kicker {
          margin: 0 0 1.4mm;
          color: #73736b;
          font-size: 6.5pt;
          font-weight: 700;
          letter-spacing: .15em;
          text-transform: uppercase;
        }
        .editorial-qr-title {
          margin: 0;
          font-family: EditorialSerif, Georgia, serif;
          font-size: 16pt;
          font-weight: 400;
          line-height: 1.1;
        }
        .editorial-qr-copy {
          margin: 1.5mm 0 0;
          color: #66665e;
          font-size: 7pt;
          line-height: 1.4;
        }
        .editorial-qr {
          display: block;
          width: 27mm;
          height: 27mm;
          justify-self: end;
          padding: 1mm;
          border: 1px solid #77766d;
          background: #fbfaf6;
        }
        .editorial-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 5mm;
          margin-top: auto;
          padding-top: 3.5mm;
          color: #77776e;
          font-size: 6.5pt;
          letter-spacing: .08em;
        }
        .editorial-footer span:last-child { color: #4f5049; }
        @media (max-width: 700px) {
          .editorial-tag-preview { padding: 8px; }
          .editorial-sheet { padding: 8mm 7mm 7mm; }
          .editorial-mast-note { font-size: 6pt; }
          .editorial-model { font-size: clamp(58px, 17vw, 84px); }
          .editorial-lead { padding: 7mm 0 5.5mm; }
          .editorial-title-line { gap: 4mm; }
          .editorial-year { padding-left: 2.5mm; font-size: 6.5pt; }
          .editorial-year strong { font-size: 20pt; }
          .editorial-config-table, .editorial-config-table tbody { display: block; width: 100%; }
          .editorial-config-table thead { display: none; }
          .editorial-config-table tr {
            display: grid;
            grid-template-columns: 1.05fr 1fr .65fr;
            gap: 2mm;
            padding: 2.4mm 1mm;
            border-bottom: 1px solid #d8d6cc;
          }
          .editorial-config-table td {
            min-width: 0;
            padding: 0;
            border: 0;
            font-size: 7.5pt;
          }
          .editorial-config-table td:first-child {
            grid-column: 1 / -1;
            padding-bottom: 1.4mm;
            border-bottom: 1px solid #d8d6cc;
            font-size: 10.5pt;
          }
          .editorial-config-table td:not(:first-child):before {
            display: block;
            margin-bottom: .6mm;
            color: #77776e;
            content: attr(data-label);
            font-size: 5.5pt;
            font-weight: 600;
            letter-spacing: .04em;
            text-transform: uppercase;
          }
          .editorial-specs { grid-template-columns: 1fr; gap: 4mm; margin-top: 5mm; }
          .editorial-spec-intro { padding: 0; }
          .editorial-spec-intro .editorial-section-title { max-width: none; font-size: 17pt; }
          .editorial-spec-intro p { max-width: none; margin-top: 1.5mm; }
          .editorial-spec { min-height: 14mm; }
          .editorial-spec dd { font-size: 12pt; }
          .editorial-bottom { grid-template-columns: minmax(0, 1fr) 25mm; gap: 3mm; }
          .editorial-qr { width: 23mm; height: 23mm; }
        }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body, #root { width: 210mm; min-height: 297mm; margin: 0 !important; padding: 0 !important; }
          .editorial-tag-preview { width: 210mm; min-height: 297mm; padding: 0; background: #fbfaf6; }
          .editorial-sheet {
            width: 210mm;
            height: 297mm;
            min-height: 297mm;
            padding: 12mm 13mm 10mm;
            box-shadow: none;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .editorial-model { font-size: 78pt; }
        }
      `}</style>

      <main className="editorial-sheet" aria-label="Информационный лист Haval Dargo">
        <header className="editorial-masthead">
          <div className="editorial-brand">
            <img
              className="editorial-logo"
              src="/__mockup/images/vehicle-tag/debryansk-auto-logo.svg"
              alt="Дебрянск Авто"
            />
            <span className="editorial-tagline">ПРОСТРАНСТВО АВТОМОБИЛЕЙ</span>
          </div>
          <div className="editorial-mast-note">Гид по модели<br />Новые автомобили</div>
        </header>

        <section className="editorial-lead" aria-labelledby="editorial-vehicle-name">
          <p className="editorial-kicker">HAVAL · Модельный ряд</p>
          <div className="editorial-title-line">
            <div>
              <p className="editorial-make">HAVAL</p>
              <h1 className="editorial-model" id="editorial-vehicle-name">DARGO</h1>
            </div>
            <p className="editorial-year">Модельный год<strong>2026</strong></p>
          </div>
          <div className="editorial-subline">
            <span>Комплектации и характеристики</span>
            <span>01 / Автомобиль</span>
          </div>
        </section>

        <section className="editorial-configs" aria-labelledby="editorial-config-title">
          <div className="editorial-section-head">
            <h2 className="editorial-section-title" id="editorial-config-title">Комплектации</h2>
            <span className="editorial-section-index">Три варианта</span>
          </div>
          <table className="editorial-config-table" aria-label="Комплектации и технические варианты Haval Dargo">
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
                <td data-label="Комплектация">Оптимум</td>
                <td data-label="Двигатель">Бензин, 2,0 л, 200 л.с.</td>
                <td data-label="Коробка передач">7DCT, робот</td>
                <td data-label="Привод">4WD</td>
              </tr>
              <tr>
                <td data-label="Комплектация">Премиум</td>
                <td data-label="Двигатель">Бензин, 2,0 л, 200 л.с.</td>
                <td data-label="Коробка передач">7DCT, робот</td>
                <td data-label="Привод">4WD</td>
              </tr>
              <tr>
                <td data-label="Комплектация">Техно+</td>
                <td data-label="Двигатель">Бензин, 2,0 л, 200 л.с.</td>
                <td data-label="Коробка передач">7DCT, робот</td>
                <td data-label="Привод">4WD</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="editorial-specs" aria-labelledby="editorial-specs-title">
          <div className="editorial-spec-intro">
            <h2 className="editorial-section-title" id="editorial-specs-title">Технические характеристики</h2>
            <p>Ключевые параметры модели — в одном месте.</p>
          </div>
          <dl className="editorial-spec-grid">
            <div className="editorial-spec"><dt>Крутящий момент</dt><dd>380 Н·м</dd></div>
            <div className="editorial-spec"><dt>Дорожный просвет</dt><dd>200 мм</dd></div>
            <div className="editorial-spec"><dt>Максимальная скорость</dt><dd>180 км/ч</dd></div>
            <div className="editorial-spec"><dt>Колёсная база</dt><dd>2 738 мм</dd></div>
            <div className="editorial-spec"><dt>Разгон до 100 км/ч</dt><dd>10,5 с</dd></div>
            <div className="editorial-spec"><dt>Габариты</dt><dd className="editorial-wide-value">4 620 × 1 890 × 1 780 мм</dd></div>
            <div className="editorial-spec"><dt>Расход топлива</dt><dd>8,8 л/100 км</dd></div>
            <div className="editorial-spec"><dt>Объём топливного бака</dt><dd>60 л</dd></div>
          </dl>
        </section>

        <section className="editorial-bottom" aria-label="Подборка модели на сайте">
          <div>
            <p className="editorial-qr-kicker">Продолжить знакомство</p>
            <h2 className="editorial-qr-title">Каталог Haval Dargo</h2>
            <p className="editorial-qr-copy">Комплектации и доступные автомобили модели.</p>
          </div>
          <img
            className="editorial-qr"
            src="/__mockup/images/vehicle-tag/dargo-catalog-qr.svg"
            alt="QR-код на подборку Haval Dargo на сайте Дебрянск Авто"
          />
        </section>

        <footer className="editorial-footer">
          <span>DEBRYANSK AUTO</span>
          <span>debryansk-auto.ru</span>
        </footer>
      </main>
    </div>
  );
}
