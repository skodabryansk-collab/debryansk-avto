export function DargoTypographic() {
  return (
    <div className="dargo-type">
      <style>{`
        * { box-sizing: border-box; }
        .dargo-type {
          min-height: 100vh;
          padding: 22px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          background: #dededc;
          color: #151515;
          font-family: "Arial Narrow", "Roboto Condensed", "Helvetica Neue", sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .dargo-type-sheet {
          position: relative;
          width: min(100%, 210mm);
          min-height: 297mm;
          padding: 11mm 13mm 9mm;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #fdfdfb;
          box-shadow: 0 12px 38px rgba(0,0,0,.16);
        }
        .dargo-type-sheet::before {
          position: absolute;
          z-index: 0;
          top: 0;
          left: 0;
          width: 5mm;
          height: 100%;
          background: #171717;
          content: "";
        }
        .dargo-type-sheet > * { position: relative; z-index: 1; }
        .dargo-type-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          min-height: 13mm;
          padding-bottom: 4mm;
          border-bottom: 1px solid #161616;
        }
        .dargo-type-logo {
          width: 53mm;
          max-height: 11mm;
          object-fit: contain;
          object-position: left center;
          filter: brightness(0);
        }
        .dargo-type-issue {
          text-align: right;
          font-size: 7pt;
          line-height: 1.6;
          letter-spacing: .14em;
          text-transform: uppercase;
        }
        .dargo-type-issue strong { display: block; font-size: 8pt; letter-spacing: .2em; }
        .dargo-type-hero {
          padding: 9mm 0 2mm;
          border-bottom: 1px solid #aaa;
        }
        .dargo-type-eyebrow {
          margin: 0 0 2mm;
          font-size: 7pt;
          font-weight: 700;
          letter-spacing: .25em;
          text-transform: uppercase;
        }
        .dargo-type-name {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 8mm;
        }
        .dargo-type-mark { min-width: 0; }
        .dargo-type-make {
          margin: 0 0 1mm 1mm;
          font-size: 11pt;
          font-weight: 800;
          letter-spacing: .47em;
        }
        .dargo-type-model {
          margin: 0;
          font-family: "Arial Black", "Arial Narrow", sans-serif;
          font-size: clamp(66px, 13vw, 112px);
          font-weight: 900;
          line-height: .79;
          letter-spacing: -.085em;
        }
        .dargo-type-index {
          padding-bottom: 2mm;
          font-size: 7pt;
          line-height: 1.5;
          letter-spacing: .16em;
          text-align: right;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .dargo-type-index b { display: block; font-size: 10pt; letter-spacing: .06em; }
        .dargo-type-subhead {
          display: flex;
          justify-content: space-between;
          gap: 8mm;
          margin-top: 4mm;
          padding: 2mm 0 3mm;
          border-top: 1px solid #d2d2d0;
          font-size: 8pt;
          letter-spacing: .07em;
          text-transform: uppercase;
        }
        .dargo-type-subhead span:last-child { text-align: right; }
        .dargo-type-illustration {
          height: 51mm;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2mm 0 1mm;
          border-bottom: 1px solid #161616;
        }
        .dargo-type-illustration svg { width: 100%; height: 100%; }
        .dargo-type-illustration .fine { stroke: #6b6b68; stroke-width: 1.1; }
        .dargo-type-illustration .bold { stroke: #171717; stroke-width: 2.2; }
        .dargo-type-illustration .detail { stroke: #171717; stroke-width: 1.4; }
        .dargo-type-config {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: end;
          gap: 5mm;
          margin: 5mm 0 4mm;
          padding: 0 0 3.5mm;
          border-bottom: 2px solid #171717;
        }
        .dargo-type-label {
          margin: 0 0 1.5mm;
          font-size: 7pt;
          font-weight: 700;
          letter-spacing: .2em;
          text-transform: uppercase;
        }
        .dargo-type-trim {
          margin: 0;
          font-size: 23pt;
          font-weight: 900;
          line-height: 1;
          letter-spacing: -.04em;
          text-transform: uppercase;
        }
        .dargo-type-powertrain {
          margin: 1.5mm 0 0;
          font-size: 8pt;
          font-weight: 700;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .dargo-type-vin {
          font-size: 7pt;
          line-height: 1.6;
          letter-spacing: .12em;
          text-align: right;
          text-transform: uppercase;
        }
        .dargo-type-vin b { display: block; font-size: 8pt; letter-spacing: .15em; }
        .dargo-type-tables {
          display: grid;
          grid-template-columns: .92fr 1.08fr;
          gap: 9mm;
        }
        .dargo-type-table-title {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 3mm;
          margin: 0 0 2mm;
          padding-bottom: 1.8mm;
          border-bottom: 1px solid #171717;
          font-size: 9pt;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .dargo-type-table-title small {
          font-size: 6.5pt;
          font-weight: 500;
          letter-spacing: .1em;
        }
        .dargo-type-spec-row {
          min-height: 8.2mm;
          display: grid;
          grid-template-columns: 43% 1fr;
          align-items: center;
          gap: 3mm;
          border-bottom: 1px solid #d4d4d2;
        }
        .dargo-type-spec-row span:first-child { font-size: 7pt; line-height: 1.25; color: #555; }
        .dargo-type-spec-row b { font-size: 8pt; line-height: 1.25; }
        .dargo-type-equipment {
          display: grid;
          grid-template-columns: 1fr 1fr;
          column-gap: 5mm;
          row-gap: 0;
        }
        .dargo-type-equipment li {
          min-height: 8.2mm;
          display: flex;
          align-items: center;
          gap: 2mm;
          border-bottom: 1px solid #d4d4d2;
          font-size: 7.5pt;
          line-height: 1.22;
          list-style: none;
        }
        .dargo-type-equipment li::before {
          width: 3.5mm;
          height: 1px;
          flex: 0 0 3.5mm;
          background: #171717;
          content: "";
        }
        .dargo-type-qr {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 8mm;
          margin-top: auto;
          padding: 5mm 0 3mm;
          border-top: 1.5px solid #171717;
        }
        .dargo-type-qr-copy { max-width: 105mm; }
        .dargo-type-qr-kicker {
          margin: 0 0 1.5mm;
          font-size: 7pt;
          font-weight: 700;
          letter-spacing: .2em;
          text-transform: uppercase;
        }
        .dargo-type-qr-title {
          margin: 0;
          font-size: 17pt;
          font-weight: 900;
          line-height: 1;
          letter-spacing: -.035em;
          text-transform: uppercase;
        }
        .dargo-type-qr-note {
          margin: 2mm 0 0;
          font-size: 8pt;
          line-height: 1.4;
        }
        .dargo-type-url {
          display: block;
          margin-top: 1.5mm;
          font-size: 7pt;
          font-weight: 700;
          letter-spacing: .08em;
        }
        .dargo-type-code {
          display: block;
          width: 30mm;
          height: 30mm;
          padding: 1mm;
          border: 1px solid #171717;
        }
        .dargo-type-foot {
          display: flex;
          justify-content: space-between;
          gap: 5mm;
          padding-top: 2.5mm;
          border-top: 1px solid #aaa;
          font-size: 6.5pt;
          letter-spacing: .16em;
          text-transform: uppercase;
        }
        .dargo-type-foot strong { font-size: 7pt; letter-spacing: .2em; }
        @media (max-width: 680px) {
          .dargo-type { padding: 8px; }
          .dargo-type-sheet { padding: 7mm 7mm 6mm 10mm; }
          .dargo-type-name { align-items: flex-start; flex-direction: column; gap: 3mm; }
          .dargo-type-index { text-align: left; }
          .dargo-type-model { font-size: clamp(58px, 19vw, 92px); }
          .dargo-type-illustration { height: 38mm; }
          .dargo-type-tables { grid-template-columns: 1fr; gap: 5mm; }
          .dargo-type-config { grid-template-columns: 1fr; }
          .dargo-type-vin { text-align: left; }
          .dargo-type-qr { gap: 4mm; }
          .dargo-type-qr-title { font-size: 14pt; }
          .dargo-type-foot { flex-wrap: wrap; }
        }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body, #root { width: 210mm; min-height: 297mm; margin: 0 !important; padding: 0 !important; }
          .dargo-type { min-height: 297mm; padding: 0; background: #fdfdfb; }
          .dargo-type-sheet {
            width: 210mm;
            height: 297mm;
            min-height: 297mm;
            padding: 11mm 13mm 9mm;
            box-shadow: none;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .dargo-type-name { flex-direction: row; align-items: flex-end; }
          .dargo-type-model { font-size: 100pt; }
          .dargo-type-illustration { height: 51mm; }
          .dargo-type-tables { grid-template-columns: .92fr 1.08fr; }
        }
      `}</style>

      <main className="dargo-type-sheet" aria-label="Чёрно-белая спецификация Haval Dargo формата A4">
        <header className="dargo-type-head">
          <img
            className="dargo-type-logo"
            src="/__mockup/images/vehicle-tag/debryansk-auto-logo.svg"
            alt="Дебрянск Авто — территория автомобилей"
          />
          <div className="dargo-type-issue">
            <strong>Дебрянск Авто</strong>
            Официальный дилер · Брянск
          </div>
        </header>

        <section className="dargo-type-hero" aria-labelledby="dargo-type-model">
          <p className="dargo-type-eyebrow">Карточка модели / 2026</p>
          <div className="dargo-type-name">
            <div className="dargo-type-mark">
              <p className="dargo-type-make">HAVAL</p>
              <h1 className="dargo-type-model" id="dargo-type-model">DARGO</h1>
            </div>
            <div className="dargo-type-index">
              Внедорожник<br />
              <b>4WD · 2.0T</b>
              Линейка DARGO
            </div>
          </div>
          <div className="dargo-type-subhead">
            <span>Характеристики и комплектация автомобиля</span>
            <span>Модельный ряд · 2026</span>
          </div>
        </section>

        <div className="dargo-type-illustration" aria-label="Линейная иллюстрация автомобиля Haval Dargo">
          <svg viewBox="0 0 860 245" role="img" aria-hidden="true" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path className="fine" d="M47 183h61l17-49 60-13 77-68c13-12 27-17 47-17h179c28 0 47 8 65 25l50 48 111 17 49 47h43"/>
            <path className="bold" strokeLinecap="round" strokeLinejoin="round" d="M66 180h58l15-41c5-14 16-23 32-27l42-10 67-61c13-12 28-18 47-18h166c27 0 46 7 64 23l50 46 97 14c13 2 24 8 32 18l29 37 52 7v20H66v-8Z"/>
            <path className="detail" d="m234 99 38-36c11-10 21-15 36-15h61v60H221m161-60h71c18 0 31 5 43 17l41 43H382V48Z"/>
            <path className="fine" d="M371 49v58m15-58v58m-117-20h239m-317 34h92m180 2h115m45-36 18 22m57-7 16 3"/>
            <path className="bold" strokeLinecap="round" d="M93 158h45m-47 10h36m597-4h48"/>
            <path className="detail" d="M164 126h41m-37 5h26m367-45 18 3m-2 5 30 5"/>
            <path className="fine" d="M128 180h27m124 0h282m127 0h86"/>
            <circle className="bold" cx="224" cy="178" r="35"/>
            <circle className="detail" cx="224" cy="178" r="23"/>
            <circle className="fine" cx="224" cy="178" r="9"/>
            <path className="fine" d="m224 155 0 46m-23-23h46m-39-16 32 32m0-32-32 32"/>
            <circle className="bold" cx="644" cy="178" r="35"/>
            <circle className="detail" cx="644" cy="178" r="23"/>
            <circle className="fine" cx="644" cy="178" r="9"/>
            <path className="fine" d="m644 155 0 46m-23-23h46m-39-16 32 32m0-32-32 32"/>
            <path className="fine" d="M76 206h680"/>
          </svg>
        </div>

        <section className="dargo-type-config" aria-label="Выбранная комплектация">
          <div>
            <p className="dargo-type-label">Комплектация выбранного автомобиля</p>
            <p className="dargo-type-trim">Премиум</p>
            <p className="dargo-type-powertrain">2.0T · полный привод · 7DCT</p>
          </div>
          <div className="dargo-type-vin">
            Идентификатор / VIN
            <b>·················</b>
          </div>
        </section>

        <div className="dargo-type-tables">
          <section aria-labelledby="dargo-type-spec-title">
            <h2 className="dargo-type-table-title" id="dargo-type-spec-title">
              <span>Характеристики</span><small>01 / 02</small>
            </h2>
            <div className="dargo-type-spec-row"><span>Двигатель</span><b>Бензин · 2.0 л · турбо</b></div>
            <div className="dargo-type-spec-row"><span>Мощность</span><b>200 л.с.</b></div>
            <div className="dargo-type-spec-row"><span>Крутящий момент</span><b>380 Н·м</b></div>
            <div className="dargo-type-spec-row"><span>Трансмиссия</span><b>7-ступ. DCT</b></div>
            <div className="dargo-type-spec-row"><span>Привод</span><b>Полный · 4WD</b></div>
            <div className="dargo-type-spec-row"><span>Дорожный просвет</span><b>200 мм</b></div>
            <div className="dargo-type-spec-row"><span>Колёсная база</span><b>2 738 мм</b></div>
            <div className="dargo-type-spec-row"><span>Габариты</span><b>4 620 × 1 890 × 1 780 мм</b></div>
            <div className="dargo-type-spec-row"><span>Расход, смешанный</span><b>8,8 л / 100 км</b></div>
          </section>

          <section aria-labelledby="dargo-type-equipment-title">
            <h2 className="dargo-type-table-title" id="dargo-type-equipment-title">
              <span>Оснащение</span><small>02 / 02</small>
            </h2>
            <ul className="dargo-type-equipment">
              <li>Климат-контроль</li>
              <li>Камера кругового обзора</li>
              <li>Панорамная крыша</li>
              <li>Адаптивный круиз-контроль</li>
              <li>Подогрев передних сидений</li>
              <li>Система удержания в полосе</li>
              <li>Электропривод водительского сиденья</li>
              <li>Бесключевой доступ</li>
              <li>Мультимедийная система</li>
              <li>Система помощи при спуске</li>
            </ul>
          </section>
        </div>

        <section className="dargo-type-qr" aria-label="Подборка модели Haval Dargo">
          <div className="dargo-type-qr-copy">
            <p className="dargo-type-qr-kicker">Продолжить знакомство</p>
            <h2 className="dargo-type-qr-title">Подборка Haval Dargo</h2>
            <p className="dargo-type-qr-note">Сканируйте код, чтобы посмотреть доступные автомобили и выбрать свой DARGO.</p>
            <span className="dargo-type-url">debryansk-auto.ru/new-cars</span>
          </div>
          <img
            className="dargo-type-code"
            src="/__mockup/images/vehicle-tag/dargo-catalog-qr.svg"
            alt="QR-код на подборку модели Haval Dargo"
          />
        </section>

        <footer className="dargo-type-foot">
          <strong>Дебрянск Авто</strong>
          <span>Территория автомобилей</span>
          <span>debryansk-auto.ru</span>
        </footer>
      </main>
    </div>
  );
}
