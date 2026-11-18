import { Badge } from '@workspace/meridian-devops/components/ui/badge';

const configurations = [
  {
    trim: 'Оптимум',
    engine: 'Бензин · 2,0 л · 200 л.с.',
    transmission: '7DCT · робот',
    drive: '4WD',
  },
  {
    trim: 'Премиум',
    engine: 'Бензин · 2,0 л · 200 л.с.',
    transmission: '7DCT · робот',
    drive: '4WD',
  },
  {
    trim: 'Техно+',
    engine: 'Бензин · 2,0 л · 200 л.с.',
    transmission: '7DCT · робот',
    drive: '4WD',
  },
];

const specificationGroups = [
  {
    title: 'Динамика и расход',
    values: [
      ['Крутящий момент', '380 Н·м'],
      ['Максимальная скорость', '180 км/ч'],
      ['Разгон до 100 км/ч', '10,5 с'],
      ['Расход топлива', '8,8 л/100 км'],
    ],
  },
  {
    title: 'Габариты и топливный бак',
    values: [
      ['Дорожный просвет', '200 мм'],
      ['Колёсная база', '2 738 мм'],
      ['Габариты', '4 620 × 1 890 × 1 780 мм'],
      ['Объём топливного бака', '60 л'],
    ],
  },
];

export function HavalDargoTag() {
  return (
    <div className="tag-preview min-h-screen bg-muted px-3 py-5 text-foreground">
      <style>{`
        .tag-logo-lockup {
          position: relative;
          width: 56mm;
          height: 9.3mm;
          flex: 0 0 auto;
          overflow: hidden;
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
          top: 72%;
          right: 0;
          left: 22.1%;
          height: 28%;
          overflow: hidden;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          font-family: var(--font-sans);
          font-size: 2.35mm;
          font-weight: 500;
          line-height: 1;
          letter-spacing: .025em;
          white-space: nowrap;
        }
        .dargo-table th:nth-child(1) { width: 23%; }
        .dargo-table th:nth-child(2) { width: 35%; }
        .dargo-table th:nth-child(3) { width: 25%; }
        .dargo-table th:nth-child(4) { width: 17%; }
        @media (max-width: 680px) {
          .tag-preview { padding: 8px; }
          .tag-sheet { padding: 7mm; }
          .dargo-table,
          .dargo-table tbody { display: block; width: 100%; }
          .dargo-table thead { display: none; }
          .dargo-table tr {
            display: grid;
            grid-template-columns: 1.15fr 1fr .62fr;
            column-gap: 2mm;
            padding: 2.4mm 1.5mm;
            border-bottom: 1px solid hsl(var(--border));
          }
          .dargo-table td {
            display: block;
            min-width: 0;
            padding: 0;
            border: 0;
            font-size: 8pt;
            line-height: 1.25;
          }
          .dargo-table td:first-child {
            grid-column: 1 / -1;
            margin-bottom: 1.6mm;
            padding-bottom: 1.4mm;
            border-bottom: 1px solid hsl(var(--border));
            font-size: 10pt;
          }
          .dargo-table td:not(:first-child)::before {
            display: block;
            margin-bottom: .6mm;
            color: hsl(var(--muted-foreground));
            content: attr(data-label);
            font-family: var(--font-mono);
            font-size: 6.5pt;
            font-weight: 500;
            line-height: 1.2;
            text-transform: uppercase;
          }
          .tag-spec-groups { grid-template-columns: 1fr; row-gap: 4mm; }
          .tag-bottom { grid-template-columns: minmax(0, 1fr) 30mm; gap: 4mm; }
        }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body, #root { width: 210mm; min-height: 297mm; margin: 0 !important; padding: 0 !important; }
          .tag-preview { min-height: 297mm; padding: 0; background: hsl(var(--background)); }
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

      <main className="tag-sheet mx-auto flex min-h-[297mm] w-full max-w-[210mm] flex-col bg-background px-[12mm] pb-[9mm] pt-[11mm] text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.14)]">
        <header className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border pb-[4mm]">
          <div className="tag-logo-lockup">
            <img
              className="tag-logo"
              src="/__mockup/images/vehicle-tag/debryansk-auto-logo.svg"
              alt="Дебрянск Авто"
            />
            <span className="tag-logo-tagline">ПРОСТРАНСТВО АВТОМОБИЛЕЙ</span>
          </div>
          <Badge
            variant="outline"
            className="rounded-none border-foreground px-2 py-1 font-mono text-[8px] uppercase tracking-[0.16em]"
          >
            Новый автомобиль
          </Badge>
        </header>

        <section className="grid grid-cols-[1fr_auto] items-end gap-6 border-b border-foreground/70 py-[8mm]">
          <div className="min-w-0 border-l-[3px] border-primary pl-4">
            <p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
              Haval
            </p>
            <h1 className="m-0 text-[clamp(56px,9vw,82px)] font-black leading-[0.84] tracking-[-0.05em]">
              DARGO
            </h1>
          </div>
          <div className="min-w-[30mm] border-l border-border pb-1 pl-4">
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground">
              Модельный год
            </p>
            <p className="mt-1 text-3xl font-extrabold leading-none tracking-tight">2026</p>
          </div>
        </section>

        <section className="mt-[8mm]" aria-labelledby="config-title">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-foreground pb-2">
            <h2
              id="config-title"
              className="m-0 text-[11pt] font-extrabold uppercase tracking-[0.04em]"
            >
              Комплектации и силовые агрегаты
            </h2>
            <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-muted-foreground">
              3 варианта
            </span>
          </div>
          <table className="dargo-table mt-2 w-full table-fixed border-collapse text-left">
            <thead>
              <tr className="border-b border-foreground">
                {['Комплектация', 'Двигатель', 'Коробка передач', 'Привод'].map((label) => (
                  <th
                    key={label}
                    className="px-[1.5mm] py-[2mm] font-mono text-[7.5pt] font-medium uppercase tracking-[0.04em] text-muted-foreground"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {configurations.map((configuration) => (
                <tr key={configuration.trim} className="border-b border-border last:border-0">
                  <td
                    data-label="Комплектация"
                    className="px-[1.5mm] py-[3.2mm] text-[10pt] font-extrabold"
                  >
                    {configuration.trim}
                  </td>
                  <td
                    data-label="Двигатель"
                    className="px-[1.5mm] py-[3.2mm] text-[9pt] font-semibold"
                  >
                    {configuration.engine}
                  </td>
                  <td
                    data-label="Коробка передач"
                    className="px-[1.5mm] py-[3.2mm] text-[9pt] font-semibold"
                  >
                    {configuration.transmission}
                  </td>
                  <td
                    data-label="Привод"
                    className="px-[1.5mm] py-[3.2mm] text-[9pt] font-semibold"
                  >
                    {configuration.drive}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-[8mm]" aria-labelledby="specs-title">
          <h2
            id="specs-title"
            className="m-0 border-b border-foreground pb-[1.8mm] text-[11pt] font-extrabold uppercase tracking-[0.04em]"
          >
            Технические характеристики
          </h2>
          <div className="tag-spec-groups mt-3 grid grid-cols-2 gap-x-[8mm]">
            {specificationGroups.map((group) => (
              <section key={group.title}>
                <h3 className="m-0 border-b border-border pb-[1.8mm] text-[8.5pt] font-bold">
                  {group.title}
                </h3>
                <dl className="m-0">
                  {group.values.map(([label, value]) => (
                    <div
                      key={label}
                      className="grid min-h-[11mm] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border/70 py-[1.5mm] last:border-0"
                    >
                      <dt className="text-[8pt] leading-tight text-muted-foreground">{label}</dt>
                      <dd className="m-0 max-w-[48mm] text-right text-[9pt] font-bold leading-tight">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </section>

        <section
          className="tag-bottom mt-auto grid grid-cols-[minmax(0,1fr)_32mm] items-center gap-[8mm] border-t border-foreground pt-[5mm]"
          aria-label="Подборка модели на сайте"
        >
          <div>
            <p className="mb-2 font-mono text-[8px] uppercase tracking-[0.18em] text-primary">
              QR · Каталог модели
            </p>
            <h2 className="m-0 text-[15pt] font-extrabold leading-tight">
              Haval Dargo
            </h2>
            <p className="mt-1 max-w-[95mm] text-[8.5pt] leading-relaxed text-muted-foreground">
              Наведите камеру, чтобы посмотреть комплектации и доступные автомобили.
            </p>
          </div>
          <img
            className="block h-[32mm] w-[32mm] border border-foreground bg-background p-[1.2mm]"
            src="/__mockup/images/vehicle-tag/dargo-catalog-qr.svg"
            alt="QR-код на подборку Haval Dargo на сайте Дебрянск Авто"
          />
        </section>

        <footer className="mt-[4mm] flex items-center justify-between gap-4 border-t border-border pt-[3mm] font-mono text-[8px] tracking-[0.04em] text-muted-foreground">
          <span>debryansk-auto.ru</span>
          <span>HAVAL DARGO · 2026</span>
        </footer>
      </main>
    </div>
  );
}
