export function BusinessCardInkSignature() {
  return (
    <div className="bcis-preview dark min-h-screen bg-muted px-4 py-8 text-foreground">
      <style>{`
        @font-face {
          font-family: "Manrope Card";
          src: url("/__mockup/images/vehicle-tag/manrope-400.woff2") format("woff2");
          font-style: normal;
          font-weight: 400;
          font-display: swap;
        }
        @font-face {
          font-family: "Manrope Card";
          src: url("/__mockup/images/vehicle-tag/manrope-600.woff2") format("woff2");
          font-style: normal;
          font-weight: 600;
          font-display: swap;
        }
        @font-face {
          font-family: "Manrope Card";
          src: url("/__mockup/images/vehicle-tag/manrope-700.woff2") format("woff2");
          font-style: normal;
          font-weight: 700;
          font-display: swap;
        }
        @font-face {
          font-family: "Manrope Card";
          src: url("/__mockup/images/vehicle-tag/manrope-800.woff2") format("woff2");
          font-style: normal;
          font-weight: 800;
          font-display: swap;
        }
        .bcis-preview {
          font-family: "Manrope Card", var(--font-sans), sans-serif;
        }
        .bcis-stage {
          width: min(100%, 1100px);
        }
        .bcis-card {
          position: relative;
          width: 100%;
          aspect-ratio: 9 / 5;
          overflow: hidden;
          box-shadow: 0 1.25rem 2.5rem hsl(var(--foreground) / 0.16), 0 0.2rem 0.5rem hsl(var(--foreground) / 0.12);
        }
        .bcis-brand {
          position: relative;
          width: 62mm;
          max-width: 62%;
          height: 11mm;
          flex: none;
          overflow: hidden;
        }
        .bcis-logo {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: fill;
          filter: brightness(0) invert(1);
        }
        .bcis-tagline {
          position: absolute;
          top: 75%;
          right: 0;
          left: 22.1%;
          height: 25%;
          margin: 0;
          overflow: hidden;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          font-size: 7pt;
          font-weight: 600;
          line-height: 1;
          letter-spacing: .02em;
          white-space: nowrap;
        }
        .bcis-reverse-mark {
          width: 55%;
        }
        .bcis-reverse-brand {
          height: 8.3mm;
        }
        .bcis-reverse-brand .bcis-tagline {
          left: 10%;
          right: 1%;
          font-size: 7pt;
        }
        .bcis-watermark {
          position: absolute;
          right: -4%;
          bottom: -38%;
          width: 44%;
          opacity: .075;
          filter: brightness(0) invert(1);
        }
        @media (max-width: 640px) {
          .bcis-preview { padding: 1rem .75rem; }
          .bcis-stage { gap: 1rem; }
          .bcis-brand { width: 47mm; height: 9mm; }
          .bcis-tagline { font-size: 6.8pt; }
          .bcis-reverse-brand { width: 100%; max-width: none; height: 8.3mm; }
          .bcis-reverse-brand .bcis-tagline { font-size: 6.8pt; }
          .bcis-front-content { padding: 5% !important; }
          .bcis-name { font-size: clamp(1rem, 5vw, 2rem) !important; }
          .bcis-role { font-size: clamp(.55rem, 2.3vw, 1rem) !important; }
          .bcis-back-content { padding: 5% !important; }
        }
      `}</style>

      <main className="bcis-stage mx-auto flex flex-col gap-4 md:flex-row">
        <article aria-label="Лицевая сторона визитной карточки" className="bcis-card min-w-0 flex-1 bg-background text-foreground">
          <div className="absolute inset-y-0 left-0 w-[2mm] bg-primary" aria-hidden="true" />
          <img
            className="bcis-watermark"
            src="/__mockup/images/vehicle-tag/debryansk-auto-logo.svg"
            alt=""
            aria-hidden="true"
          />
          <div className="bcis-front-content relative flex h-full flex-col justify-between px-[8%] py-[7%]">
            <div className="bcis-brand">
              <img
                className="bcis-logo"
                src="/__mockup/images/vehicle-tag/debryansk-auto-logo.svg"
                alt="Дебрянск Авто"
              />
              <p className="bcis-tagline">ПРОСТРАНСТВО АВТОМОБИЛЕЙ</p>
            </div>
            <div className="relative max-w-[73%]">
              <p className="bcis-name m-0 text-[25pt] font-extrabold leading-none tracking-tight">
                Коновалов Артем
              </p>
              <p className="bcis-role mb-0 mt-[3mm] text-[11pt] font-medium leading-tight text-muted-foreground">
                Менеджер по продажам автомобилей
              </p>
              <div className="mt-[6mm] h-[1px] w-[16mm] bg-primary" aria-hidden="true" />
            </div>
          </div>
        </article>

        <article aria-label="Оборотная сторона визитной карточки" className="bcis-card min-w-0 flex-1 bg-background text-foreground">
          <div className="absolute inset-y-0 right-0 w-[2mm] bg-primary" aria-hidden="true" />
          <div className="bcis-back-content relative flex h-full items-center justify-between gap-[5%] px-[7%] py-[6%]">
            <div className="min-w-0 flex-1">
              <p className="mb-[3mm] mt-0 font-mono text-[7pt] font-semibold uppercase tracking-[0.14em] text-primary">
                Дебрянск Авто
              </p>
              <div className="bcis-contact space-y-[2.5mm] text-[9.5pt] leading-snug">
                <p className="m-0 font-semibold">8 920 607 28 57</p>
                <p className="m-0 break-words">artem.konovalov@debryansk-auto.ru</p>
                <p className="bcis-address m-0 max-w-[75mm] text-muted-foreground">
                  с. Супонево, ул. Шоссейная, 12Г
                </p>
                <p className="m-0 font-semibold">debryansk-auto.ru</p>
              </div>
              <div className="mt-[4mm] h-px w-full max-w-[72mm] bg-border" aria-hidden="true" />
            </div>

            <div className="bcis-reverse-mark flex w-[31%] shrink-0 flex-col items-center">
              <div className="bcis-brand bcis-reverse-brand w-full max-w-none">
                <img
                  className="bcis-logo"
                  src="/__mockup/images/vehicle-tag/debryansk-auto-logo.svg"
                  alt="Дебрянск Авто"
                />
                <p className="bcis-tagline">ПРОСТРАНСТВО АВТОМОБИЛЕЙ</p>
              </div>
              <div className="mt-[3mm] h-[1.4mm] w-full bg-primary" aria-hidden="true" />
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}
