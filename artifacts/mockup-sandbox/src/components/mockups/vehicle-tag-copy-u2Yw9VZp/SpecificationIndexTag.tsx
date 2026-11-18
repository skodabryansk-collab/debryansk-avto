export function SpecificationIndexTag() {
  return (
    <div className="sit-preview">
      <style>{`
        @font-face {
          font-family: Manrope;
          src: url("/__mockup/images/vehicle-tag/manrope-400.woff2") format("woff2");
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: Manrope;
          src: url("/__mockup/images/vehicle-tag/manrope-600.woff2") format("woff2");
          font-weight: 600;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: Manrope;
          src: url("/__mockup/images/vehicle-tag/manrope-700.woff2") format("woff2");
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: Manrope;
          src: url("/__mockup/images/vehicle-tag/manrope-800.woff2") format("woff2");
          font-weight: 800;
          font-style: normal;
          font-display: swap;
        }
        .sit-preview, .sit-preview * { box-sizing: border-box; }
        .sit-preview {
          min-height: 100vh;
          padding: 20px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          background: #e7e6e2;
          color: #20211f;
          font-family: Manrope, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .sit-sheet {
          position: relative;
          width: min(100%, 210mm);
          min-height: 297mm;
          padding: 10mm 12mm 9mm;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background: #fbfaf6;
          box-shadow: 0 8px 30px rgba(28, 28, 24, .14);
        }
        .sit-masthead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8mm;
          min-height: 13mm;
          padding-bottom: 4mm;
          border-bottom: 1px solid #272824;
        }
        .sit-brand {
          position: relative;
          width: 47mm;
          height: 8mm;
          flex: 0 0 auto;
        }
        .sit-logo { display: block; width: 100%; height: 100%; object-fit: fill; object-position: left center; filter: brightness(0); }
        .sit-tagline {
          position: absolute;
          top: 76%;
          right: 0;
          left: 22.1%;
          height: 24%;
          margin: 0;
          overflow: hidden;
          background: #fbfaf6;
          font-size: 5.2pt;
          line-height: 1;
          letter-spacing: .1em;
          font-weight: 600;
          white-space: nowrap;
        }
        .sit-docmark {
          display: flex;
          align-items: center;
          gap: 2mm;
          color: #4f514b;
          font-family: Manrope, sans-serif;
          font-size: 7pt;
          font-weight: 600;
          letter-spacing: .13em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .sit-docmark::before { content: ""; width: 8mm; height: 1px; background: #72736c; }
        .sit-titleband {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: end;
          gap: 8mm;
          padding: 7mm 0 5mm;
          border-bottom: 1px solid #8c8d85;
        }
        .sit-overline {
          margin: 0 0 2mm;
          color: #585a53;
          font-size: 8pt;
          line-height: 1.2;
          font-weight: 700;
          letter-spacing: .2em;
        }
        .sit-heading {
          margin: 0;
          font-size: clamp(35px, 6vw, 54px);
          line-height: .94;
          letter-spacing: -.055em;
          font-weight: 800;
        }
        .sit-modelyear {
          display: grid;
          gap: 1mm;
          padding: 0 0 1mm 4mm;
          border-left: 1px solid #8c8d85;
          text-align: left;
        }
        .sit-modelyear span {
          color: #66675f;
          font-size: 6.8pt;
          line-height: 1.2;
          font-weight: 600;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .sit-modelyear strong {
          font-family: Manrope, sans-serif;
          font-size: 22pt;
          line-height: 1;
          font-weight: 700;
          letter-spacing: -.04em;
        }
        .sit-specs { padding-top: 5mm; }
        .sit-sectionhead {
          display: flex;
          align-items: baseline;
          gap: 3mm;
          margin: 0 0 3mm;
        }
        .sit-sectionno {
          color: #74756e;
          font-family: Manrope, sans-serif;
          font-size: 7pt;
          font-weight: 700;
          letter-spacing: .1em;
        }
        .sit-sectiontitle {
          margin: 0;
          font-size: 9pt;
          line-height: 1;
          font-weight: 800;
          letter-spacing: .095em;
          text-transform: uppercase;
        }
        .sit-specgrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          border-top: 1px solid #292a26;
          border-left: 1px solid #bdbdb5;
        }
        .sit-specitem {
          min-height: 25mm;
          padding: 3mm 3mm 2.5mm;
          border-right: 1px solid #bdbdb5;
          border-bottom: 1px solid #bdbdb5;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .sit-specitem:nth-child(7) { grid-column: span 2; }
        .sit-speclabel {
          color: #60615b;
          font-size: 7pt;
          line-height: 1.3;
          font-weight: 600;
        }
        .sit-specvalue {
          margin: 5mm 0 0;
          font-size: clamp(14px, 2vw, 18px);
          line-height: 1.05;
          font-weight: 700;
          letter-spacing: -.035em;
          overflow-wrap: anywhere;
        }
        .sit-specvalue--wide { font-size: clamp(12px, 1.7vw, 15px); letter-spacing: -.045em; white-space: nowrap; }
        .sit-unit {
          font-size: .62em;
          letter-spacing: -.01em;
          font-weight: 600;
        }
        .sit-configs { padding-top: 5mm; }
        .sit-config-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 4mm;
          margin-bottom: 2mm;
          padding-bottom: 2mm;
          border-bottom: 1px solid #292a26;
        }
        .sit-config-note {
          margin: 0;
          color: #686961;
          font-size: 6.5pt;
          letter-spacing: .04em;
        }
        .sit-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .sit-table th {
          padding: 1.8mm 2mm;
          color: #686961;
          font-size: 6.4pt;
          line-height: 1.2;
          font-weight: 700;
          letter-spacing: .09em;
          text-align: left;
          text-transform: uppercase;
        }
        .sit-table td {
          padding: 2.3mm 2mm;
          border-top: 1px solid #d4d3cc;
          font-size: 8pt;
          line-height: 1.25;
          vertical-align: middle;
        }
        .sit-table td:first-child { font-weight: 800; }
        .sit-table td:not(:first-child) { font-weight: 600; }
        .sit-table th:nth-child(1) { width: 23%; }
        .sit-table th:nth-child(2) { width: 35%; }
        .sit-table th:nth-child(3) { width: 26%; }
        .sit-table th:nth-child(4) { width: 16%; }
        .sit-end {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 8mm;
          margin-top: auto;
          padding-top: 4mm;
          border-top: 1px solid #292a26;
        }
        .sit-endcopy { display: flex; flex-direction: column; gap: 1.5mm; }
        .sit-endtitle {
          margin: 0;
          font-size: 10pt;
          font-weight: 800;
          letter-spacing: -.02em;
        }
        .sit-endtext {
          max-width: 85mm;
          margin: 0;
          color: #62635c;
          font-size: 7.3pt;
          line-height: 1.45;
        }
        .sit-qrcode {
          display: block;
          width: 25mm;
          height: 25mm;
          padding: 1mm;
          border: 1px solid #b7b7af;
          background: #fff;
        }
        .sit-footer {
          display: flex;
          justify-content: space-between;
          gap: 5mm;
          margin-top: 3mm;
          color: #71726a;
          font-size: 6.5pt;
          font-weight: 600;
          letter-spacing: .06em;
        }
        @media (max-width: 600px) {
          .sit-preview { padding: 8px; }
          .sit-sheet { min-height: auto; padding: 7mm 6mm; }
          .sit-masthead { gap: 3mm; }
          .sit-brand { width: 40mm; }
          .sit-docmark { font-size: 5.7pt; letter-spacing: .08em; }
          .sit-docmark::before { width: 4mm; }
          .sit-titleband { gap: 4mm; padding: 6mm 0 4mm; }
          .sit-heading { font-size: clamp(34px, 11vw, 48px); }
          .sit-specitem { min-height: 22mm; padding: 2.5mm 2mm; }
          .sit-specgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .sit-specitem:nth-child(7) { grid-column: span 2; }
          .sit-specvalue { font-size: 16px; }
          .sit-specvalue--wide { font-size: clamp(12px, 3.8vw, 15px); }
          .sit-configs { padding-top: 5mm; }
          .sit-table, .sit-table tbody { display: block; width: 100%; }
          .sit-table thead { display: none; }
          .sit-table tr {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 2mm;
            padding: 2.5mm 1mm;
            border-top: 1px solid #d4d3cc;
          }
          .sit-table td { min-width: 0; padding: 0; border: 0; font-size: 7.3pt; }
          .sit-table td:first-child {
            grid-column: 1 / -1;
            padding-bottom: 1.5mm;
            border-bottom: 1px solid #d4d3cc;
            font-size: 9pt;
          }
          .sit-table td:not(:first-child)::before {
            display: block;
            margin-bottom: .7mm;
            color: #74756e;
            content: attr(data-label);
            font-size: 5.7pt;
            line-height: 1.15;
            font-weight: 700;
            letter-spacing: .04em;
          }
          .sit-config-note { font-size: 5.7pt; text-align: right; }
          .sit-end { gap: 4mm; }
          .sit-qrcode { width: 23mm; height: 23mm; }
        }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body, #root { width: 210mm; min-height: 297mm; margin: 0 !important; padding: 0 !important; }
          .sit-preview { min-height: 297mm; padding: 0; background: #fbfaf6; }
          .sit-sheet {
            width: 210mm;
            height: 297mm;
            min-height: 297mm;
            padding: 10mm 12mm 9mm;
            box-shadow: none;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .sit-heading { font-size: 42pt; }
        }
      `}</style>

      <main className="sit-sheet" aria-label="Технический справочник Haval Dargo">
        <header className="sit-masthead">
          <div className="sit-brand">
            <img className="sit-logo" src="/__mockup/images/vehicle-tag/debryansk-auto-logo.svg" alt="Дебрянск Авто" />
            <span className="sit-tagline">ПРОСТРАНСТВО АВТОМОБИЛЕЙ</span>
          </div>
          <span className="sit-docmark">Индекс модели / 2026</span>
        </header>

        <section className="sit-titleband" aria-labelledby="sit-name">
          <div>
            <p className="sit-overline">HAVAL&nbsp; / &nbsp;ТЕХНИЧЕСКИЙ ЛИСТ</p>
            <h1 className="sit-heading" id="sit-name">DARGO</h1>
          </div>
          <div className="sit-modelyear">
            <span>Модельный год</span>
            <strong>2026</strong>
          </div>
        </section>

        <section className="sit-specs" aria-labelledby="sit-spec-heading">
          <div className="sit-sectionhead">
            <span className="sit-sectionno">01</span>
            <h2 className="sit-sectiontitle" id="sit-spec-heading">Технические характеристики</h2>
          </div>
          <div className="sit-specgrid">
            <div className="sit-specitem"><span className="sit-speclabel">Крутящий момент</span><p className="sit-specvalue">380 <span className="sit-unit">Н·м</span></p></div>
            <div className="sit-specitem"><span className="sit-speclabel">Максимальная скорость</span><p className="sit-specvalue">180 <span className="sit-unit">км/ч</span></p></div>
            <div className="sit-specitem"><span className="sit-speclabel">Разгон до 100 км/ч</span><p className="sit-specvalue">10,5 <span className="sit-unit">с</span></p></div>
            <div className="sit-specitem"><span className="sit-speclabel">Расход топлива</span><p className="sit-specvalue">8,8 <span className="sit-unit">л/100 км</span></p></div>
            <div className="sit-specitem"><span className="sit-speclabel">Дорожный просвет</span><p className="sit-specvalue">200 <span className="sit-unit">мм</span></p></div>
            <div className="sit-specitem"><span className="sit-speclabel">Колёсная база</span><p className="sit-specvalue">2 738 <span className="sit-unit">мм</span></p></div>
            <div className="sit-specitem"><span className="sit-speclabel">Габариты (Д × Ш × В)</span><p className="sit-specvalue sit-specvalue--wide">4 620 × 1 890 × 1 780 <span className="sit-unit">мм</span></p></div>
            <div className="sit-specitem"><span className="sit-speclabel">Объём топливного бака</span><p className="sit-specvalue">60 <span className="sit-unit">л</span></p></div>
          </div>
        </section>

        <section className="sit-configs" aria-labelledby="sit-config-heading">
          <div className="sit-config-head">
            <div className="sit-sectionhead" style={{ margin: 0 }}>
              <span className="sit-sectionno">02</span>
              <h2 className="sit-sectiontitle" id="sit-config-heading">Варианты исполнения</h2>
            </div>
            <p className="sit-config-note">Двигатель · трансмиссия · привод</p>
          </div>
          <table className="sit-table" aria-label="Комплектации Haval Dargo">
            <thead><tr><th>Комплектация</th><th>Двигатель</th><th>Коробка передач</th><th>Привод</th></tr></thead>
            <tbody>
              <tr><td>Оптимум</td><td data-label="Двигатель">Бензин, 2,0 л, 200 л.с.</td><td data-label="Коробка">7DCT, робот</td><td data-label="Привод">4WD</td></tr>
              <tr><td>Премиум</td><td data-label="Двигатель">Бензин, 2,0 л, 200 л.с.</td><td data-label="Коробка">7DCT, робот</td><td data-label="Привод">4WD</td></tr>
              <tr><td>Техно+</td><td data-label="Двигатель">Бензин, 2,0 л, 200 л.с.</td><td data-label="Коробка">7DCT, робот</td><td data-label="Привод">4WD</td></tr>
            </tbody>
          </table>
        </section>

        <section className="sit-end" aria-label="Подборка модели на сайте">
          <div className="sit-endcopy">
            <h2 className="sit-endtitle">Каталог Haval Dargo</h2>
            <p className="sit-endtext">Комплектации и доступные автомобили модели.</p>
          </div>
          <img className="sit-qrcode" src="/__mockup/images/vehicle-tag/dargo-catalog-qr.svg" alt="QR-код на подборку Haval Dargo на сайте Дебрянск Авто" />
        </section>
        <footer className="sit-footer"><span>debryansk-auto.ru</span><span>HAVAL DARGO · 2026</span></footer>
      </main>
    </div>
  );
}
