export function VehicleTagCopyO2UjK0R() {
  return (
    <div className="ept-preview">
      <style>{`
        @font-face {
          font-family: EptManrope;
          src: url("/__mockup/images/vehicle-tag/manrope-400.woff2") format("woff2");
          font-weight: 400;
          font-display: swap;
        }
        @font-face {
          font-family: EptManrope;
          src: url("/__mockup/images/vehicle-tag/manrope-600.woff2") format("woff2");
          font-weight: 600;
          font-display: swap;
        }
        @font-face {
          font-family: EptManrope;
          src: url("/__mockup/images/vehicle-tag/manrope-700.woff2") format("woff2");
          font-weight: 700;
          font-display: swap;
        }
        @font-face {
          font-family: EptManrope;
          src: url("/__mockup/images/vehicle-tag/manrope-800.woff2") format("woff2");
          font-weight: 800;
          font-display: swap;
        }
        .ept-preview, .ept-preview * { box-sizing: border-box; }
        .ept-preview {
          min-height: 100dvh;
          padding: 24px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          background: #e9e7e1;
          color: #20211f;
          font-family: EptManrope, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .ept-sheet {
          position: relative;
          width: min(100%, 210mm);
          min-height: 297mm;
          padding: 11mm 13mm 9mm;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #fbfaf6;
          box-shadow: 0 14px 44px rgba(38, 37, 32, .15);
        }
        .ept-sheet::before {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          width: 4mm;
          background: #d8d4ca;
          content: "";
        }
        .ept-masthead {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8mm;
          padding-bottom: 5mm;
          border-bottom: 1px solid #9b9992;
        }
        .ept-brand-lockup { position: relative; width: 54mm; height: 9mm; flex: 0 0 auto; }
        .ept-logo { display: block; width: 100%; height: 100%; object-fit: fill; filter: brightness(0); }
        .ept-tagline {
          position: absolute;
          top: 76%;
          right: 0;
          left: 22.1%;
          height: 24%;
          margin: 0;
          overflow: hidden;
          background: #fbfaf6;
          font-size: 5.8pt;
          line-height: 1;
          letter-spacing: .08em;
          white-space: nowrap;
        }
        .ept-docmark {
          display: flex;
          align-items: baseline;
          gap: 2.5mm;
          padding-top: 1mm;
          color: #575750;
          font-size: 7pt;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .ept-docmark b { color: #20211f; font-size: 11pt; letter-spacing: .04em; }
        .ept-identity {
          display: grid;
          grid-template-columns: 1fr 32mm;
          column-gap: 7mm;
          align-items: end;
          padding: 8mm 0 7mm;
          border-bottom: 2px solid #20211f;
        }
        .ept-kicker {
          display: flex;
          align-items: center;
          gap: 2mm;
          margin: 0 0 2mm;
          color: #62625d;
          font-size: 7pt;
          font-weight: 700;
          letter-spacing: .18em;
        }
        .ept-kicker::before { width: 8mm; height: 1px; background: #20211f; content: ""; }
        .ept-make { margin: 0 0 1mm; font-size: 11pt; font-weight: 800; letter-spacing: .2em; }
        .ept-model { margin: 0; font-size: clamp(50px, 7vw, 68px); line-height: .9; font-weight: 800; letter-spacing: -.065em; }
        .ept-year {
          position: relative;
          padding: 3mm 0 1.5mm 4mm;
          border-left: 1px solid #a6a39c;
        }
        .ept-year-label {
          display: block;
          margin-bottom: 1.2mm;
          color: #696963;
          font-size: 6.6pt;
          font-weight: 700;
          letter-spacing: .09em;
          text-transform: uppercase;
        }
        .ept-year-value { display: block; font-size: 25pt; line-height: 1; font-weight: 600; letter-spacing: -.06em; }
        .ept-config {
          display: grid;
          grid-template-columns: 35mm 1fr;
          gap: 6mm;
          padding: 6mm 0 6.5mm;
          border-bottom: 1px solid #aaa79f;
        }
        .ept-section-index { color: #77766f; font-size: 7pt; font-weight: 700; letter-spacing: .13em; }
        .ept-section-index strong {
          display: block;
          margin: 0 0 1.5mm;
          color: #20211f;
          font-size: 17pt;
          line-height: 1;
          font-weight: 600;
          letter-spacing: -.04em;
        }
        .ept-section-heading { margin: 0; font-size: 9pt; line-height: 1.25; font-weight: 700; }
        .ept-config-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; }
        .ept-trim { min-width: 0; padding: 0 3.4mm; border-left: 1px solid #c7c4bc; }
        .ept-trim:first-child { padding-left: 0; border-left: 0; }
        .ept-trim-name { margin: 0 0 2mm; font-size: 10pt; font-weight: 800; }
        .ept-trim-detail { margin: 0; color: #4d4d48; font-size: 7.5pt; line-height: 1.5; }
        .ept-trim-detail + .ept-trim-detail { margin-top: .7mm; }
        .ept-specs {
          padding: 6mm 0 5mm;
          border-bottom: 1px solid #aaa79f;
        }
        .ept-spec-head {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 6mm;
          margin-bottom: 3mm;
        }
        .ept-spec-head .ept-section-heading { font-size: 11pt; }
        .ept-spec-caption { color: #77766f; font-size: 7pt; letter-spacing: .08em; text-transform: uppercase; }
        .ept-spec-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid #20211f; border-left: 1px solid #d0cdc5; }
        .ept-spec {
          min-height: 22mm;
          padding: 3mm 3mm 2.5mm;
          border-right: 1px solid #d0cdc5;
          border-bottom: 1px solid #d0cdc5;
        }
        .ept-spec dt { margin: 0 0 2mm; color: #6b6a64; font-size: 7pt; line-height: 1.25; }
        .ept-spec dd { margin: 0; font-size: 13pt; line-height: 1.05; font-weight: 700; letter-spacing: -.04em; }
        .ept-spec-wide dd { font-size: 9.6pt; line-height: 1.25; letter-spacing: -.025em; }
        .ept-lower {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 42mm;
          gap: 7mm;
          align-items: stretch;
          padding: 6mm 0 5mm;
        }
        .ept-measure {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          padding: 3mm 0;
        }
        .ept-measure-title {
          margin: 0 0 2mm;
          font-size: 12pt;
          font-weight: 700;
        }
        .ept-measure-copy { max-width: 78mm; margin: 0; color: #65645e; font-size: 8.5pt; line-height: 1.5; }
        .ept-measure-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 2mm;
          padding: 2.2mm 0;
          border-top: 1px solid #cbc8c0;
        }
        .ept-measure-row span { color: #65645e; font-size: 7.2pt; line-height: 1.25; }
        .ept-measure-row b { flex: 0 0 auto; font-size: 9pt; font-weight: 700; text-align: right; }
        .ept-qr-block {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          padding: 3mm;
          border: 1px solid #aaa79f;
          text-align: center;
        }
        .ept-qr { display: block; width: 29mm; height: 29mm; object-fit: contain; }
        .ept-qr-caption { margin: 2mm 0 0; font-size: 7.5pt; font-weight: 700; }
        .ept-qr-note { margin: 1mm 0 0; color: #66655f; font-size: 6.5pt; line-height: 1.3; }
        .ept-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 5mm;
          margin-top: auto;
          padding-top: 3mm;
          border-top: 1px solid #20211f;
          color: #62615b;
          font-size: 7pt;
          letter-spacing: .04em;
        }
        .ept-footer-mark { display: flex; align-items: center; gap: 2mm; }
        .ept-footer-mark::before { width: 6mm; height: 1px; background: #20211f; content: ""; }
        @media (max-width: 680px) {
          .ept-preview { padding: 8px; }
          .ept-sheet { min-height: auto; padding: 7mm 7mm 6mm 9mm; }
          .ept-sheet::before { width: 2mm; }
          .ept-masthead { gap: 3mm; }
          .ept-brand-lockup { width: 48mm; max-width: 62%; }
          .ept-tagline { font-size: 5pt; }
          .ept-docmark { font-size: 5.8pt; gap: 1.5mm; }
          .ept-identity { grid-template-columns: 1fr 24mm; gap: 3mm; padding: 7mm 0 6mm; }
          .ept-model { font-size: clamp(44px, 13vw, 62px); }
          .ept-year { padding-left: 2.5mm; }
          .ept-year-value { font-size: 20pt; }
          .ept-config { grid-template-columns: 1fr; gap: 3mm; padding: 5mm 0; }
          .ept-section-index strong { display: inline; margin-right: 2mm; font-size: 12pt; }
          .ept-config-list { gap: 0; }
          .ept-trim { padding: 0 2mm; }
          .ept-trim-name { font-size: 8.5pt; }
          .ept-trim-detail { font-size: 6.6pt; }
          .ept-specs { padding: 5mm 0 4mm; }
          .ept-spec-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .ept-spec { min-height: 19mm; padding: 2.5mm; }
          .ept-spec dd { font-size: 11.5pt; }
          .ept-spec-wide dd { font-size: 8.5pt; }
          .ept-lower { grid-template-columns: minmax(0, 1fr) 31mm; gap: 3mm; padding: 5mm 0; }
          .ept-measure-title { font-size: 9pt; }
          .ept-measure-copy { font-size: 7pt; }
          .ept-qr-block { padding: 2mm; }
          .ept-qr { width: 25mm; height: 25mm; }
          .ept-footer { font-size: 6pt; }
        }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body, #root { width: 210mm; min-height: 297mm; margin: 0 !important; padding: 0 !important; }
          .ept-preview { min-height: 297mm; padding: 0; background: #fbfaf6; }
          .ept-sheet { width: 210mm; height: 297mm; min-height: 297mm; padding: 11mm 13mm 9mm; box-shadow: none; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .ept-sheet::before { width: 4mm; }
          .ept-model { font-size: 52pt; }
        }
      `}</style>

      <main className="ept-sheet" aria-label="Информационная табличка Haval Dargo">
        <header className="ept-masthead">
          <div className="ept-brand-lockup">
            <img className="ept-logo" src="/__mockup/images/vehicle-tag/debryansk-auto-logo.svg" alt="Дебрянск Авто" />
            <p className="ept-tagline">ПРОСТРАНСТВО АВТОМОБИЛЕЙ</p>
          </div>
          <div className="ept-docmark"><b>01</b><span>Модель / 2026</span></div>
        </header>

        <section className="ept-identity" aria-labelledby="ept-model-name">
          <div>
            <p className="ept-kicker">АВТОМОБИЛЬ</p>
            <p className="ept-make">HAVAL</p>
            <h1 className="ept-model" id="ept-model-name">DARGO</h1>
          </div>
          <div className="ept-year">
            <span className="ept-year-label">Модельный год</span>
            <strong className="ept-year-value">2026</strong>
          </div>
        </section>

        <section className="ept-config" aria-labelledby="ept-config-title">
          <div className="ept-section-index">
            <strong>01</strong>
            <h2 className="ept-section-heading" id="ept-config-title">Комплектации<br />и агрегаты</h2>
          </div>
          <div className="ept-config-list">
            {["Оптимум", "Премиум", "Техно+"].map((trim) => (
              <article className="ept-trim" key={trim}>
                <h3 className="ept-trim-name">{trim}</h3>
                <p className="ept-trim-detail">Бензин, 2,0 л, 200 л.с.</p>
                <p className="ept-trim-detail">7DCT, робот</p>
                <p className="ept-trim-detail">4WD</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ept-specs" aria-labelledby="ept-spec-title">
          <div className="ept-spec-head">
            <h2 className="ept-section-heading" id="ept-spec-title">Технические характеристики</h2>
            <span className="ept-spec-caption">Ключевые данные</span>
          </div>
          <dl className="ept-spec-grid">
            <div className="ept-spec"><dt>Крутящий момент</dt><dd>380 Н·м</dd></div>
            <div className="ept-spec"><dt>Максимальная скорость</dt><dd>180 км/ч</dd></div>
            <div className="ept-spec"><dt>Разгон до 100 км/ч</dt><dd>10,5 с</dd></div>
            <div className="ept-spec"><dt>Расход топлива</dt><dd>8,8 л/100 км</dd></div>
            <div className="ept-spec"><dt>Дорожный просвет</dt><dd>200 мм</dd></div>
            <div className="ept-spec"><dt>Колёсная база</dt><dd>2 738 мм</dd></div>
            <div className="ept-spec ept-spec-wide"><dt>Габариты</dt><dd>4 620 × 1 890 × 1 780 мм</dd></div>
            <div className="ept-spec"><dt>Объём топливного бака</dt><dd>60 л</dd></div>
          </dl>
        </section>

        <section className="ept-lower" aria-label="Дополнительные сведения и каталог">
          <div className="ept-measure">
            <h2 className="ept-measure-title">Подборка модели</h2>
            <p className="ept-measure-copy">Комплектации и доступные автомобили модели.</p>
          </div>
          <div className="ept-qr-block">
            <div>
              <img className="ept-qr" src="/__mockup/images/vehicle-tag/dargo-catalog-qr.svg" alt="QR-код на подборку Haval Dargo на сайте Дебрянск Авто" />
              <h2 className="ept-qr-caption">Каталог Haval Dargo</h2>
              <p className="ept-qr-note">Комплектации и доступные автомобили модели.</p>
            </div>
          </div>
        </section>

        <footer className="ept-footer">
          <span className="ept-footer-mark">Дебрянск Авто</span>
          <span>debryansk-auto.ru</span>
        </footer>
      </main>
    </div>
  );
}
