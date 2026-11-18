export function DargoRail() {
  return (
    <div className="dargo-rail">
      <style>{`
        * { box-sizing: border-box; }
        .dargo-rail {
          --ink: #171817;
          --muted: #666762;
          --line: #c9cac5;
          --paper: #f7f7f3;
          min-height: 100vh;
          padding: 18px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          color: var(--ink);
          background: #e6e7e2;
          font-family: "Arial Narrow", "Aptos Narrow", Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .dr-sheet {
          width: min(100%, 210mm);
          min-height: 297mm;
          padding: 10mm 11mm 8mm;
          display: flex;
          flex-direction: column;
          background: var(--paper);
          box-shadow: 0 10px 36px rgba(23,24,23,.16);
        }
        .dr-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 3.5mm;
          border-bottom: 1px solid var(--ink);
        }
        .dr-logo { width: 51mm; max-height: 10mm; object-fit: contain; object-position: left center; filter: brightness(0); }
        .dr-dealer { text-align: right; text-transform: uppercase; letter-spacing: .13em; font-size: 7.5pt; line-height: 1.55; }
        .dr-dealer strong { display: block; font-size: 8.5pt; letter-spacing: .16em; }
        .dr-hero { position: relative; height: 76mm; margin-top: 5mm; overflow: hidden; background: #222; }
        .dr-photo { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 58% 54%; filter: grayscale(1) contrast(1.12); }
        .dr-photo::after { content: ""; }
        .dr-hero-copy {
          position: absolute;
          inset: auto 0 0;
          padding: 16mm 8mm 6mm;
          color: #fff;
          background: linear-gradient(0deg, rgba(0,0,0,.8), rgba(0,0,0,0));
        }
        .dr-kicker { margin: 0 0 1.5mm; color: rgba(255,255,255,.82); font-size: 7.5pt; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; }
        .dr-title-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; }
        .dr-name { margin: 0; font-size: clamp(44px, 8vw, 68px); line-height: .82; font-weight: 900; letter-spacing: -.065em; }
        .dr-make { margin: 0 0 2mm; font-size: 10pt; font-weight: 800; letter-spacing: .3em; }
        .dr-edition { margin: 0 0 1.5mm; color: rgba(255,255,255,.8); font-size: 7pt; letter-spacing: .14em; text-transform: uppercase; white-space: nowrap; }
        .dr-id {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 5mm;
          margin-top: 3mm;
          padding: 2.3mm 3mm;
          color: #fff;
          background: var(--ink);
          text-transform: uppercase;
          letter-spacing: .13em;
          font-size: 7pt;
        }
        .dr-id strong { font-size: 8.5pt; letter-spacing: .2em; white-space: nowrap; }
        .dr-main { display: grid; grid-template-columns: 36mm 1fr; gap: 6mm; margin-top: 5mm; }
        .dr-rail {
          padding: 3.5mm 3mm;
          color: #fff;
          background: var(--ink);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .dr-rail-label { margin: 0; color: #c8c9c3; font-size: 6.5pt; font-weight: 700; line-height: 1.4; letter-spacing: .15em; text-transform: uppercase; }
        .dr-grade { margin: 3mm 0 1.5mm; font-size: 19pt; line-height: 1; font-weight: 900; letter-spacing: -.04em; }
        .dr-engine { margin: 0; font-size: 7.5pt; font-weight: 700; line-height: 1.45; letter-spacing: .07em; }
        .dr-rail-rule { width: 100%; height: 1px; margin: 4mm 0 3mm; background: rgba(255,255,255,.38); }
        .dr-trim-caption { margin: 0 0 2mm; color: #c8c9c3; font-size: 6pt; line-height: 1.4; letter-spacing: .12em; text-transform: uppercase; }
        .dr-trims { display: flex; flex-direction: column; gap: 1.4mm; width: 100%; }
        .dr-trim { width: 100%; padding: 1.5mm 1.7mm; border: 1px solid rgba(255,255,255,.4); font-size: 7pt; font-weight: 700; }
        .dr-trim.active { color: var(--ink); background: #fff; border-color: #fff; }
        .dr-specs { min-width: 0; }
        .dr-spec-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; margin: 0 0 2mm; padding-bottom: 1.6mm; border-bottom: 1.4px solid var(--ink); }
        .dr-spec-heading h2 { margin: 0; font-size: 10pt; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
        .dr-spec-heading span { color: var(--muted); font-size: 6.5pt; letter-spacing: .1em; text-transform: uppercase; }
        .dr-spec-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 5mm; }
        .dr-spec { min-height: 10.6mm; display: grid; grid-template-columns: 42% 1fr; align-items: center; gap: 1.5mm; border-bottom: 1px solid var(--line); }
        .dr-spec-label { color: var(--muted); font-size: 6.7pt; line-height: 1.2; }
        .dr-spec-value { font-size: 8pt; font-weight: 800; line-height: 1.2; }
        .dr-bottom { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 7mm; margin-top: auto; padding-top: 5mm; }
        .dr-qr-copy { max-width: 104mm; }
        .dr-qr-copy h2 { margin: 0 0 1.5mm; font-size: 11pt; font-weight: 900; letter-spacing: -.02em; }
        .dr-qr-copy p { margin: 0; color: #50514c; font-size: 8pt; line-height: 1.4; }
        .dr-url { display: inline-block; margin-top: 2mm; color: var(--ink); font-size: 7pt; font-weight: 800; letter-spacing: .04em; }
        .dr-qr { display: block; width: 29mm; height: 29mm; padding: 1mm; border: 1px solid var(--ink); background: #fff; }
        .dr-foot { display: flex; justify-content: space-between; align-items: center; gap: 5mm; margin-top: 3.5mm; padding-top: 2mm; border-top: 1px solid var(--line); color: var(--muted); font-size: 6.5pt; letter-spacing: .12em; text-transform: uppercase; }
        .dr-foot strong { color: var(--ink); letter-spacing: .16em; }
        @media (max-width: 620px) {
          .dargo-rail { padding: 8px; }
          .dr-sheet { padding: 6mm; }
          .dr-hero { height: 59mm; }
          .dr-main { grid-template-columns: 1fr; gap: 4mm; }
          .dr-rail { display: grid; grid-template-columns: 1fr 1.15fr; gap: 0 4mm; align-items: center; }
          .dr-rail-label { grid-column: 1 / -1; }
          .dr-grade { margin: 1.5mm 0 0; }
          .dr-engine { margin-top: 1.5mm; }
          .dr-rail-rule { display: none; }
          .dr-trim-caption { grid-column: 1 / -1; margin-top: 2mm; }
          .dr-trims { flex-direction: row; flex-wrap: wrap; grid-column: 1 / -1; }
          .dr-trim { width: auto; }
          .dr-spec-grid { column-gap: 3mm; }
          .dr-spec { grid-template-columns: 43% 1fr; min-height: 11mm; }
        }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body, #root { width: 210mm; min-height: 297mm; margin: 0 !important; padding: 0 !important; }
          .dargo-rail { min-height: 297mm; padding: 0; background: #fff; }
          .dr-sheet { width: 210mm; min-height: 297mm; height: 297mm; padding: 10mm 11mm 8mm; box-shadow: none; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .dr-hero { height: 76mm; }
          .dr-main { grid-template-columns: 36mm 1fr; }
        }
      `}</style>
      <main className="dr-sheet" aria-label="Макет ценника автомобиля Haval Dargo">
        <header className="dr-head">
          <img className="dr-logo" src="/__mockup/images/vehicle-tag/debryansk-auto-logo.svg" alt="Дебрянск Авто — территория автомобилей" />
          <div className="dr-dealer"><strong>Автомобили в наличии</strong>Официальный дилер · Брянск</div>
        </header>

        <section className="dr-hero" aria-labelledby="dargo-name">
          <img className="dr-photo" src="/__mockup/images/vehicle-tag/haval-dargo.jpg" alt="Haval Dargo" />
          <div className="dr-hero-copy">
            <p className="dr-kicker">Новый автомобиль · 2026</p>
            <div className="dr-title-row">
              <div><p className="dr-make">HAVAL</p><h1 className="dr-name" id="dargo-name">DARGO</h1></div>
              <p className="dr-edition">Характеристики<br />и комплектации</p>
            </div>
          </div>
        </section>

        <div className="dr-id">
          <span>Идентификатор автомобиля</span>
          <strong aria-label="VIN будет подставлен по выбранному автомобилю">VIN ·················</strong>
        </div>

        <div className="dr-main">
          <section className="dr-rail" aria-labelledby="equipment-title">
            <p className="dr-rail-label" id="equipment-title">Комплектация по VIN</p>
            <p className="dr-grade">Премиум</p>
            <p className="dr-engine">2.0T · полный<br />привод · 7DCT</p>
            <div className="dr-rail-rule" />
            <p className="dr-trim-caption">Линейка модели</p>
            <div className="dr-trims" aria-label="Комплектации модели">
              <span className="dr-trim">Оптимум</span>
              <span className="dr-trim active">Премиум</span>
              <span className="dr-trim">Техно+</span>
            </div>
          </section>

          <section className="dr-specs" aria-labelledby="specs-title">
            <div className="dr-spec-heading"><h2 id="specs-title">Технические характеристики</h2><span>01 / 12</span></div>
            <div className="dr-spec-grid">
              <div className="dr-spec"><span className="dr-spec-label">Двигатель</span><span className="dr-spec-value">Бензиновый, 2.0 л, турбо</span></div>
              <div className="dr-spec"><span className="dr-spec-label">Мощность</span><span className="dr-spec-value">200 л.с.</span></div>
              <div className="dr-spec"><span className="dr-spec-label">Крутящий момент</span><span className="dr-spec-value">380 Н·м</span></div>
              <div className="dr-spec"><span className="dr-spec-label">Трансмиссия</span><span className="dr-spec-value">7-ступ. роботизированная DCT</span></div>
              <div className="dr-spec"><span className="dr-spec-label">Привод</span><span className="dr-spec-value">Полный, 4WD</span></div>
              <div className="dr-spec"><span className="dr-spec-label">Дорожный просвет</span><span className="dr-spec-value">200 мм</span></div>
              <div className="dr-spec"><span className="dr-spec-label">Колёсная база</span><span className="dr-spec-value">2 738 мм</span></div>
              <div className="dr-spec"><span className="dr-spec-label">Габариты</span><span className="dr-spec-value">4 620 × 1 890 × 1 780 мм</span></div>
              <div className="dr-spec"><span className="dr-spec-label">Максимальная скорость</span><span className="dr-spec-value">180 км/ч</span></div>
              <div className="dr-spec"><span className="dr-spec-label">Разгон до 100 км/ч</span><span className="dr-spec-value">10,5 с</span></div>
              <div className="dr-spec"><span className="dr-spec-label">Расход топлива, смешанный</span><span className="dr-spec-value">8,8 л/100 км</span></div>
              <div className="dr-spec"><span className="dr-spec-label">Объём топливного бака</span><span className="dr-spec-value">60 л</span></div>
            </div>
          </section>
        </div>

        <section className="dr-bottom" aria-label="Подборка модели на сайте">
          <div className="dr-qr-copy">
            <h2>Выберите свой Haval Dargo</h2>
            <p>Наведите камеру на QR-код — откроется подборка модели на сайте «Дебрянск Авто».</p>
            <span className="dr-url">debryansk-auto.ru/new-cars</span>
          </div>
          <img className="dr-qr" src="/__mockup/images/vehicle-tag/dargo-catalog-qr.svg" alt="QR-код на подборку Haval Dargo на сайте Дебрянск Авто" />
        </section>
        <footer className="dr-foot"><strong>Дебрянск Авто</strong><span>Территория автомобилей</span><span>debryansk-auto.ru</span></footer>
      </main>
    </div>
  );
}
