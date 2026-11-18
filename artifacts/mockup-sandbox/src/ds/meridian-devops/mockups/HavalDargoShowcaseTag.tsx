import {
  Card,
  CardContent,
} from '@workspace/meridian-devops/components/ui/card';
import { Separator } from '@workspace/meridian-devops/components/ui/separator';

const trims = [
  { name: 'Оптимум', engine: 'Бензин, 2,0 л, 200 л.с.', gearbox: '7DCT, робот', drive: '4WD' },
  { name: 'Премиум', engine: 'Бензин, 2,0 л, 200 л.с.', gearbox: '7DCT, робот', drive: '4WD' },
  { name: 'Техно+', engine: 'Бензин, 2,0 л, 200 л.с.', gearbox: '7DCT, робот', drive: '4WD' },
];

const specs = [
  ['Крутящий момент', '380 Н·м'],
  ['Максимальная скорость', '180 км/ч'],
  ['Разгон до 100 км/ч', '10,5 с'],
  ['Расход топлива', '8,8 л/100 км'],
  ['Дорожный просвет', '200 мм'],
  ['Колёсная база', '2 738 мм'],
  ['Габариты', '4 620 × 1 890 × 1 780 мм'],
  ['Объём топливного бака', '60 л'],
];

export function HavalDargoShowcaseTag() {
  return (
    <div className="ept-preview min-h-screen bg-muted px-4 py-6 text-foreground">
      <style>{`
        .ept-brand-lockup {
          position: relative;
          width: 54mm;
          height: 9mm;
          flex: 0 0 auto;
          overflow: hidden;
        }
        .ept-logo {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: fill;
          filter: brightness(0);
        }
        .ept-tagline {
          position: absolute;
          top: 76%;
          right: 0;
          left: 22.1%;
          height: 24%;
          margin: 0;
          overflow: hidden;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          font-family: var(--font-sans);
          font-size: 5.8pt;
          font-weight: 500;
          line-height: 1;
          letter-spacing: .08em;
          white-space: nowrap;
        }
        @media (max-width: 680px) {
          .ept-preview { padding: 8px; }
          .ept-sheet { min-height: auto; padding: 7mm 7mm 6mm 9mm; }
          .ept-brand-lockup { width: 48mm; max-width: 62%; }
          .ept-identity { grid-template-columns: minmax(0, 1fr) 24mm; gap: 3mm; }
          .ept-config-list { grid-template-columns: 1fr; }
          .ept-spec-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .ept-lower { grid-template-columns: minmax(0, 1fr) 38mm; gap: 3mm; }
        }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body, #root { width: 210mm; min-height: 297mm; margin: 0 !important; padding: 0 !important; }
          .ept-preview { min-height: 297mm; padding: 0; background: hsl(var(--background)); }
          .ept-sheet { width: 210mm; height: 297mm; min-height: 297mm; padding: 11mm 13mm 9mm; }
        }
      `}</style>

      <main className="ept-sheet relative mx-auto flex min-h-[297mm] w-full max-w-[210mm] flex-col overflow-hidden bg-background px-[13mm] pb-[9mm] pt-[11mm] text-foreground shadow-lg">
        <div aria-hidden="true" className="absolute bottom-0 left-0 top-0 w-[2mm] bg-primary" />

        <header className="flex items-start justify-between gap-6">
          <div className="ept-brand-lockup">
            <img
              className="ept-logo"
              src="/__mockup/images/vehicle-tag/debryansk-auto-logo.svg"
              alt="Дебрянск Авто"
            />
            <p className="ept-tagline">ПРОСТРАНСТВО АВТОМОБИЛЕЙ</p>
          </div>
        </header>

        <Separator className="mt-[5mm]" />

        <section
          className="ept-identity grid grid-cols-[minmax(0,1fr)_32mm] items-end gap-[7mm] border-b-2 border-foreground py-[8mm]"
          aria-labelledby="dargo-title"
        >
          <div>
            <p className="mb-1 mt-0 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Haval
            </p>
            <h1
              id="dargo-title"
              className="m-0 text-6xl font-extrabold leading-[0.9] tracking-tighter sm:text-7xl"
            >
              DARGO
            </h1>
          </div>
          <div className="border-l border-border pb-1 pl-4">
            <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted-foreground">
              Модельный год
            </p>
            <p className="mt-1 text-3xl font-semibold leading-none tracking-tight">2026</p>
          </div>
        </section>

        <section className="grid grid-cols-[35mm_minmax(0,1fr)] gap-[6mm] border-b border-border py-[6mm]" aria-labelledby="trims-title">
          <div className="pt-[3.5mm]">
            <h2 id="trims-title" className="m-0 text-sm font-bold leading-snug">
              Комплектации<br />и агрегаты
            </h2>
          </div>
          <div className="ept-config-list grid grid-cols-3 gap-[3mm]">
            {trims.map((trim) => (
              <Card key={trim.name} className="min-w-0">
                <CardContent className="p-[3.5mm]">
                  <h3 className="m-0 text-sm font-bold">{trim.name}</h3>
                  <p className="mb-0 mt-2 text-xs leading-relaxed text-muted-foreground">
                    {trim.engine}
                  </p>
                  <p className="mb-0 mt-1 text-xs leading-relaxed text-muted-foreground">
                    {trim.gearbox}
                  </p>
                  <p className="mb-0 mt-1 font-mono text-xs font-semibold">{trim.drive}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="py-[6mm]" aria-labelledby="specs-title">
          <div className="mb-[3mm]">
            <h2 id="specs-title" className="m-0 text-lg font-bold">
              Технические характеристики
            </h2>
          </div>
          <dl className="ept-spec-grid m-0 grid grid-cols-4 border-l border-t border-border">
            {specs.map(([label, value], index) => (
              <div
                key={label}
                className="min-h-[22mm] border-b border-r border-border p-[3mm]"
              >
                <dt className="mb-2 text-xs leading-snug text-muted-foreground">{label}</dt>
                <dd className={`m-0 font-semibold leading-tight ${index === 6 ? 'text-sm' : 'text-lg tracking-tight'}`}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <Separator />

        <section className="ept-lower mt-[6mm] grid grid-cols-[minmax(0,1fr)_42mm] items-stretch gap-[7mm]" aria-label="Подборка модели">
          <div className="flex flex-col justify-center">
            <h2 className="m-0 text-lg font-bold">Подборка модели</h2>
            <p className="mb-0 mt-2 max-w-[78mm] text-sm leading-relaxed text-muted-foreground">
              Комплектации и доступные модели.
            </p>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center p-[3mm] text-center">
              <img
                className="block h-[29mm] w-[29mm] object-contain"
                src="/__mockup/images/vehicle-tag/dargo-catalog-qr.svg"
                alt="QR-код на подборку Haval Dargo на сайте Дебрянск Авто"
              />
              <p className="mb-0 mt-2 text-xs font-semibold">Каталог Haval Dargo</p>
            </CardContent>
          </Card>
        </section>

        <footer className="mt-auto flex items-center justify-between gap-5 border-t border-foreground pt-[3mm] text-xs text-muted-foreground">
          <span className="font-mono">Брянск, Литейная 3/2</span>
          <span className="font-mono">debryansk-auto.ru</span>
        </footer>
      </main>
    </div>
  );
}
