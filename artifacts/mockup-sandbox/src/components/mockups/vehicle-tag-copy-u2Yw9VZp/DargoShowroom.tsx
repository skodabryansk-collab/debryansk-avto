export function DargoShowroom() {
  return (
    <div className="showroom-tag">
      <style>{`
        @font-face {
          font-family: ShowroomManrope;
          src: url("/__mockup/images/vehicle-tag/manrope-400.woff2") format("woff2");
          font-weight: 400;
          font-display: swap;
        }
        .showroom-tag, .showroom-tag * { box-sizing: border-box; }
        .showroom-tag {
          min-height: 100vh;
          padding: 18px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          background: #e8e9e9;
          color: #151515;
          font-family: "ShowroomManrope", "Helvetica Neue", sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .showroom-sheet {
          position: relative;
          width: min(100%, 210mm);
          min-height: 297mm;
          padding: 10mm 12mm 9mm;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 8px 32px rgba(0,0,0,.14);
        }
        .showroom-masthead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 4mm;
          border-bottom: 1.2px solid #161616;
        }
        .showroom-lockup { position: relative; width: 54mm; height: 9mm; }
        .showroom-logo { width: 100%; height: 100%; object-fit: fill; filter: brightness(0); }
        .showroom-tagline {
          position: absolute; top: 76%; right: 0; left: 22.1%; height: 23%;
          overflow: hidden; background: #fff; color: #111;
          font-size: 1.42mm; line-height: 1.1; letter-spacing: .025em; white-space: nowrap;
        }
        .showroom-stock-label {
          display: flex; align-items: center; gap: 2mm;
          font-size: 7.5pt; font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
        }
        .showroom-stock-dot { width: 2.2mm; height: 2.2mm; border: 1px solid #111; border-radius: 50%; }
        .showroom-hero {
          position: relative;
          padding: 9mm 0 5.5mm;
          border-bottom: 1px solid #a9a9a9;
        }
        .showroom-eyebrow {
          margin: 0 0 2mm;
          font-size: 8pt; font-weight: 700; letter-spacing: .22em; text-transform: uppercase;
        }
        .showroom-model {
          margin: 0;
          font-family: "Arial Narrow", "Helvetica Neue", sans-serif;
          font-size: clamp(78px, 15vw, 122px);
          line-height: .78;
          font-weight: 900;
          letter-spacing: -.085em;
        }
        .showroom-model-meta {
          display: flex; align-items: baseline; gap: 4mm;
          margin-top: 4mm;
        }
        .showroom-make { font-size: 13pt; font-weight: 900; letter-spacing: .27em; }
        .showroom-year { color: #4c4c4c; font-size: 8pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
        .showroom-selected {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: stretch;
          gap: 6mm;
          margin-top: 7mm;
          border: 1.6px solid #111;
        }
        .showroom-selected-main { padding: 4.2mm 5mm 4.5mm; }
        .showroom-selected-label {
          display: block; margin-bottom: 1.8mm;
          font-size: 7pt; font-weight: 800; letter-spacing: .16em; text-transform: uppercase;
        }
        .showroom-trim {
          margin: 0;
          font-family: "Arial Narrow", "Helvetica Neue", sans-serif;
          font-size: 26pt; font-weight: 900; line-height: .98; letter-spacing: -.045em;
          text-transform: uppercase;
        }
        .showroom-trim-detail { margin: 1.8mm 0 0; font-size: 9pt; font-weight: 700; }
        .showroom-vin {
          min-width: 57mm;
          padding: 4mm 4.5mm;
          display: flex; flex-direction: column; justify-content: center;
          border-left: 1px solid #111;
          background: #151515; color: #fff;
        }
        .showroom-vin-label { margin-bottom: 1.4mm; color: #d6d6d6; font-size: 6.8pt; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
        .showroom-vin-value { font-family: ui-monospace, "SFMono-Regular", Consolas, monospace; font-size: 11pt; font-weight: 700; letter-spacing: .06em; }
        .showroom-config {
          margin-top: 6mm;
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 5mm;
        }
        .showroom-config-copy { display: flex; align-items: center; gap: 3mm; }
        .showroom-config-marker { width: 3mm; height: 3mm; flex: 0 0 auto; background: #111; }
        .showroom-config-kicker { margin: 0 0 1mm; color: #555; font-size: 7pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
        .showroom-config-name { margin: 0; font-size: 11pt; font-weight: 800; }
        .showroom-powertrain { text-align: right; font-size: 8.5pt; line-height: 1.45; font-weight: 700; }
        .showroom-rule-title {
          display: flex; align-items: baseline; justify-content: space-between;
          margin: 8mm 0 0; padding-bottom: 2mm; border-bottom: 1.2px solid #111;
          font-size: 10pt; font-weight: 900; letter-spacing: .1em; text-transform: uppercase;
        }
        .showroom-rule-title span { color: #666; font-size: 7pt; letter-spacing: .11em; }
        .showroom-specs {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-bottom: 1px solid #bcbcbc;
        }
        .showroom-spec {
          min-height: 23mm;
          padding: 3.5mm 3mm 3mm 0;
          display: flex; flex-direction: column; justify-content: space-between;
          border-right: 1px solid #c8c8c8;
        }
        .showroom-spec:nth-child(4n) { border-right: 0; padding-left: 3mm; }
        .showroom-spec:nth-child(4n + 2), .showroom-spec:nth-child(4n + 3) { padding-left: 3mm; }
        .showroom-spec:nth-child(n + 5) { border-top: 1px solid #c8c8c8; }
        .showroom-spec-label { max-width: 36mm; color: #555; font-size: 7.2pt; line-height: 1.25; }
        .showroom-spec-value { margin-top: 3mm; font-size: 13pt; font-weight: 900; line-height: 1.05; letter-spacing: -.025em; }
        .showroom-bottom {
          margin-top: auto;
          padding-top: 5mm;
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 8mm;
          border-top: 1.2px solid #111;
        }
        .showroom-catalog-eyebrow { margin: 0 0 2mm; font-size: 7pt; font-weight: 800; letter-spacing: .17em; text-transform: uppercase; }
        .showroom-catalog-title { margin: 0; font-family: "Arial Narrow", "Helvetica Neue", sans-serif; font-size: 20pt; line-height: 1; font-weight: 900; letter-spacing: -.035em; }
        .showroom-catalog-copy { max-width: 88mm; margin: 2mm 0 0; color: #4d4d4d; font-size: 8pt; line-height: 1.45; }
        .showroom-qr-wrap { display: flex; align-items: center; gap: 3mm; }
        .showroom-qr-caption { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 6.5pt; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
        .showroom-qr { width: 29mm; height: 29mm; display: block; padding: 1mm; border: 1px solid #111; background: #fff; }
        .showroom-footer {
          display: flex; justify-content: space-between; gap: 5mm;
          margin-top: 4mm; padding-top: 2.5mm; border-top: 1px solid #bcbcbc;
          color: #555; font-size: 6.8pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
        }
        @media (max-width: 700px) {
          .showroom-tag { padding: 8px; }
          .showroom-sheet { padding: 7mm 7mm 6mm; }
          .showroom-model { font-size: clamp(68px, 18vw, 112px); }
          .showroom-selected { grid-template-columns: 1fr; gap: 0; }
          .showroom-vin { min-width: 0; padding: 3mm 5mm; border-left: 0; border-top: 1px solid #111; }
          .showroom-specs { grid-template-columns: repeat(2, 1fr); }
          .showroom-spec { min-height: 20mm; }
          .showroom-spec:nth-child(4n) { border-right: 1px solid #c8c8c8; padding-left: 0; }
          .showroom-spec:nth-child(2n) { border-right: 0; padding-left: 3mm; }
          .showroom-spec:nth-child(3) { border-top: 1px solid #c8c8c8; }
        }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body, #root { width: 210mm; min-height: 297mm; margin: 0 !important; padding: 0 !important; }
          .showroom-tag { min-height: 297mm; padding: 0; background: #fff; }
          .showroom-sheet { width: 210mm; min-height: 297mm; height: 297mm; padding: 10mm 12mm 9mm; box-shadow: none; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
      <main className="showroom-sheet" aria-label="Ценник Haval Dargo, комплектация Премиум">
        <header className="showroom-masthead">
          <div className="showroom-lockup">
            <img className="showroom-logo" src="/__mockup/images/vehicle-tag/debryansk-auto-logo.svg" alt="Дебрянск Авто" />
            <span className="showroom-tagline">Пространство автомобилей</span>
          </div>
          <div className="showroom-stock-label"><span className="showroom-stock-dot" /> Автомобиль в наличии</div>
        </header>

        <section className="showroom-hero" aria-labelledby="showroom-model">
          <p className="showroom-eyebrow">Новый автомобиль · модельный год 2026</p>
          <h1 className="showroom-model" id="showroom-model">DARGO</h1>
          <div className="showroom-model-meta">
            <span className="showroom-make">HAVAL</span>
            <span className="showroom-year">4WD · SUV</span>
          </div>
          <div className="showroom-selected">
            <div className="showroom-selected-main">
              <span className="showroom-selected-label">Комплектация этого автомобиля</span>
              <h2 className="showroom-trim">Премиум</h2>
              <p className="showroom-trim-detail">2.0 Turbo · робот 7DCT · полный привод</p>
            </div>
            <div className="showroom-vin">
              <span className="showroom-vin-label">VIN · идентификатор автомобиля</span>
              <strong className="showroom-vin-value">LGWDF6A57PK602418</strong>
            </div>
          </div>
        </section>

        <section className="showroom-config" aria-label="Данные выбранной модификации">
          <div className="showroom-config-copy">
            <span className="showroom-config-marker" />
            <div>
              <p className="showroom-config-kicker">Двигатель и трансмиссия</p>
              <p className="showroom-config-name">Бензин · 2,0 л · 200 л.с.</p>
            </div>
          </div>
          <div className="showroom-powertrain">380 Н·м<br />4WD · 7DCT</div>
        </section>

        <h2 className="showroom-rule-title">Главное о Dargo <span>Ключевые характеристики</span></h2>
        <section className="showroom-specs" aria-label="Ключевые характеристики">
          <div className="showroom-spec"><span className="showroom-spec-label">Дорожный просвет</span><strong className="showroom-spec-value">200 мм</strong></div>
          <div className="showroom-spec"><span className="showroom-spec-label">Колёсная база</span><strong className="showroom-spec-value">2 738 мм</strong></div>
          <div className="showroom-spec"><span className="showroom-spec-label">Разгон до 100 км/ч</span><strong className="showroom-spec-value">10,5 с</strong></div>
          <div className="showroom-spec"><span className="showroom-spec-label">Расход, смешанный</span><strong className="showroom-spec-value">8,8 л</strong></div>
        </section>

        <section className="showroom-bottom" aria-label="Каталог модели">
          <div>
            <p className="showroom-catalog-eyebrow">Больше информации о модели</p>
            <h2 className="showroom-catalog-title">Каталог HAVAL DARGO</h2>
            <p className="showroom-catalog-copy">Наведите камеру, чтобы посмотреть варианты комплектаций и доступные автомобили в каталоге Дебрянск Авто.</p>
          </div>
          <div className="showroom-qr-wrap">
            <span className="showroom-qr-caption">Смотреть каталог</span>
            <img className="showroom-qr" src="/__mockup/images/vehicle-tag/dargo-catalog-qr.svg" alt="QR-код каталога Haval Dargo" />
          </div>
        </section>
        <footer className="showroom-footer"><span>Дебрянск Авто</span><span>debryansk-auto.ru</span></footer>
      </main>
    </div>
  );
}
