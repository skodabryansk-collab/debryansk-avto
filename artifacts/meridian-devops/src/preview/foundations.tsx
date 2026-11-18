import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { tokens } from '../generated/tokens';
import { Guidelines } from './parts';

type ColorRole = keyof typeof tokens.color.light;

const CORE_SWATCHES: Array<{
  name: string;
  role: ColorRole;
  className: string;
}> = [
  {
    name: 'Primary · signal red',
    role: 'primary',
    className: 'bg-primary text-primary-foreground',
  },
  {
    name: 'Secondary · ink',
    role: 'secondary',
    className: 'bg-secondary text-secondary-foreground',
  },
  {
    name: 'Accent · warm paper',
    role: 'accent',
    className: 'bg-accent text-accent-foreground',
  },
];

const NEUTRAL_SWATCHES: Array<{
  name: string;
  role: ColorRole;
  className: string;
}> = [
  {
    name: 'Background',
    role: 'background',
    className: 'bg-background text-foreground',
  },
  { name: 'Foreground', role: 'foreground', className: 'bg-foreground text-background' },
  { name: 'Card', role: 'card', className: 'bg-card text-card-foreground' },
  { name: 'Muted', role: 'muted', className: 'bg-muted text-muted-foreground' },
  { name: 'Border', role: 'border', className: 'bg-border text-foreground' },
];

const SEMANTIC_SWATCHES: Array<{
  name: string;
  role: ColorRole;
  className: string;
}> = [
  {
    name: 'Primary',
    role: 'primary',
    className: 'bg-primary text-primary-foreground',
  },
  {
    name: 'Destructive',
    role: 'destructive',
    className: 'bg-destructive text-destructive-foreground',
  },
  { name: 'Input', role: 'input', className: 'bg-input text-foreground' },
  { name: 'Focus ring', role: 'ring', className: 'bg-ring text-primary-foreground' },
  {
    name: 'Sidebar',
    role: 'sidebar',
    className: 'bg-sidebar text-sidebar-foreground',
  },
];

const TYPE_SCALE = [
  { label: 'Display', className: 'text-5xl font-black leading-[0.86] tracking-[-0.045em]' },
  { label: 'Heading', className: 'text-3xl font-extrabold leading-none tracking-[-0.04em]' },
  { label: 'Body', className: 'text-base font-medium leading-snug' },
  { label: 'Label', className: 'font-mono text-xs uppercase tracking-[0.18em]' },
  { label: 'Caption', className: 'font-mono text-[10px] uppercase tracking-[0.15em]' },
] as const;

const SPACING_SCALE = [
  { label: '4', className: 'w-1' },
  { label: '8', className: 'w-2' },
  { label: '12', className: 'w-3' },
  { label: '16', className: 'w-4' },
  { label: '24', className: 'w-6' },
] as const;

function Swatch({
  name,
  role,
  className,
}: {
  name: string;
  role: ColorRole;
  className: string;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <div className={`flex h-16 items-end border p-2 ${className}`}>
        <span className="font-mono text-[10px] uppercase tracking-wider">{name}</span>
      </div>
      <p className="truncate text-xs font-semibold">{name}</p>
      <div className="font-mono text-[10px] leading-relaxed text-muted-foreground">
        <p>LIGHT {tokens.color.light[role]}</p>
        <p>DARK&nbsp; {tokens.color.dark[role]}</p>
      </div>
    </div>
  );
}

export function OverviewPage() {
  return (
    <div className="space-y-6">
      <section className="border bg-card p-5 text-card-foreground">
        <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Core palette
          </h2>
          <span className="font-mono text-[10px] text-muted-foreground">01 / 03</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {CORE_SWATCHES.map((swatch) => (
            <Swatch key={swatch.name} {...swatch} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="border bg-card p-5 text-card-foreground">
          <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Typography
            </h2>
            <span className="font-mono text-[10px] text-muted-foreground">INTER TIGHT</span>
          </div>
          <p className="mt-8 text-[clamp(3rem,8vw,5rem)] font-black leading-[0.86] tracking-[-0.05em]">
            SHIP<span className="text-primary">FEST</span>
          </p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            SESSION 25.01 · PLATFORM ENGINEERING
          </p>
          <p className="mt-6 border-t border-border pt-4 text-sm font-medium">
            Large, compressed headlines. Compact technical metadata.
          </p>
        </section>

        <section className="border bg-card p-5 text-card-foreground">
          <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Components in use
            </h2>
            <span className="font-mono text-[10px] text-muted-foreground">DAY 02</span>
          </div>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>DEPLOY</CardTitle>
              <CardDescription>
                A compact session card using the system's ink, paper, and red.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="overview-command">Environment</Label>
                <Input id="overview-command" defaultValue="production" />
              </div>
              <div className="flex items-center gap-2">
                <Switch defaultChecked id="overview-live" />
                <Label htmlFor="overview-live">Live walkthrough</Label>
                <Badge className="ml-auto font-mono uppercase tracking-wider">Headliner</Badge>
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button>VIEW SCHEDULE</Button>
              <Button variant="outline">DETAILS</Button>
            </CardFooter>
          </Card>
        </section>
      </div>

      <section className="space-y-4 border bg-card p-5 text-card-foreground">
        <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Actions and states
          </h2>
          <span className="font-mono text-[10px] text-muted-foreground">RED = ACTIVE</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button>SHIP</Button>
          <Button variant="secondary">INK</Button>
          <Button variant="outline">OUTLINE</Button>
          <Button variant="ghost">GHOST</Button>
          <Badge>DAY 02</Badge>
          <Badge variant="secondary">PROVISION</Badge>
          <Badge variant="outline">OBSERVE</Badge>
        </div>
      </section>

      <section className="grid gap-4 border bg-secondary p-5 text-secondary-foreground md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
            Source reference
          </p>
          <p className="mt-2 max-w-2xl text-sm">
            Extracted from the MERIDIAN SHIPFEST '25 lineup poster. The poster itself remains
            unchanged until you approve applying this system.
          </p>
        </div>
        <span className="font-mono text-xs">12-COLUMN GRID · 4 PX BASE</span>
      </section>
    </div>
  );
}

export function ColorsPage() {
  return (
    <div className="space-y-6">
      <section className="space-y-4 border bg-card p-5 text-card-foreground">
        <div>
          <h2 className="font-semibold">Brand colors</h2>
          <p className="text-sm text-muted-foreground">
            Signal red, editorial ink, and warm paper are the source palette.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {CORE_SWATCHES.map((swatch) => (
            <Swatch key={swatch.name} {...swatch} />
          ))}
        </div>
        <Guidelines
          items={[
            { kind: 'do', text: 'Reserve signal red for active states and small, high-priority emphasis.' },
            { kind: 'do', text: 'Use paper and ink as the default contrast pair.' },
            { kind: 'dont', text: 'Add a second saturated accent to the source palette.' },
          ]}
        />
      </section>
    </div>
  );
}

export function NeutralsPage() {
  return (
    <section className="space-y-5 border bg-card p-5 text-card-foreground">
      <div>
        <h2 className="font-semibold">Paper, ink, and rules</h2>
        <p className="text-sm text-muted-foreground">
          The source uses warm paper, near-black type, and softer ink-derived separators.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {NEUTRAL_SWATCHES.map((swatch) => (
          <Swatch key={swatch.name} {...swatch} />
        ))}
      </div>
    </section>
  );
}

export function SemanticColorsPage() {
  return (
    <section className="space-y-5 border bg-card p-5 text-card-foreground">
      <div>
        <h2 className="font-semibold">Interface roles</h2>
        <p className="text-sm text-muted-foreground">
          Semantic roles stay within the poster's paper, ink, and red palette.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {SEMANTIC_SWATCHES.map((swatch) => (
          <Swatch key={swatch.name} {...swatch} />
        ))}
      </div>
    </section>
  );
}

export function ChartColorsPage() {
  const chartSwatches = [
    { name: 'Chart 1', role: 'chart1' as const, className: 'bg-chart-1 text-background' },
    { name: 'Chart 2', role: 'chart2' as const, className: 'bg-chart-2 text-background' },
    { name: 'Chart 3', role: 'chart3' as const, className: 'bg-chart-3 text-background' },
    { name: 'Chart 4', role: 'chart4' as const, className: 'bg-chart-4 text-foreground' },
    { name: 'Chart 5', role: 'chart5' as const, className: 'bg-chart-5 text-foreground' },
  ];

  return (
    <section className="space-y-5 border bg-card p-5 text-card-foreground">
      <div>
        <h2 className="font-semibold">Chart palette</h2>
        <p className="text-sm text-muted-foreground">
          Red leads; the remaining series use graduated ink and paper neutrals.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {chartSwatches.map(({ name, role, className }) => (
          <Swatch
            key={role}
            name={name}
            role={role}
            className={className}
          />
        ))}
      </div>
    </section>
  );
}

export function FontsPage() {
  return (
    <div className="space-y-6">
      <section className="space-y-5 border bg-card p-5 text-card-foreground">
        <div>
          <h2 className="font-semibold">Font families</h2>
          <p className="text-sm text-muted-foreground">
            Inter Tight carries the hierarchy; IBM Plex Mono marks technical metadata.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="border p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Inter Tight · display and body
            </p>
            <p className="mt-5 text-4xl font-black leading-[0.9] tracking-[-0.04em]">
              KUBERNETES
            </p>
            <p className="mt-3 text-sm font-medium">Build products people understand.</p>
          </div>
          <div className="border p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              IBM Plex Mono · labels and data
            </p>
            <p className="mt-5 font-mono text-xs uppercase tracking-[0.16em]">DAY 02 · WED 15.01</p>
            <p className="mt-3 font-mono text-[10px] text-muted-foreground">
              $ meridian ship --env production
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-5 border bg-card p-5 text-card-foreground">
        <div>
          <h2 className="font-semibold">Type scale</h2>
          <p className="text-sm text-muted-foreground">
            Display type is heavy and tightly tracked; labels stay small and monospaced.
          </p>
        </div>
        <div className="space-y-5 border-t border-border pt-5">
          {TYPE_SCALE.map((entry) => (
            <div key={entry.label} className="grid gap-2 sm:grid-cols-[100px_1fr]">
              <span className="pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {entry.label}
              </span>
              <p className={entry.className}>SHIPFEST / 25</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function LayoutPage() {
  return (
    <div className="space-y-6">
      <section className="space-y-5 border bg-card p-5 text-card-foreground">
        <div>
          <h2 className="font-semibold">Twelve-column grid</h2>
          <p className="text-sm text-muted-foreground">
            The source assembles editorial bands from a 12-column grid and thin dividers.
          </p>
        </div>
        <div className="grid grid-cols-12 gap-px border border-border bg-border">
          {Array.from({ length: 12 }, (_, index) => (
            <div
              key={index}
              className="flex h-12 items-end bg-muted p-1 font-mono text-[9px] text-muted-foreground"
            >
              {String(index + 1).padStart(2, '0')}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-12 gap-px border border-border bg-border">
          <div className="col-span-3 bg-accent p-3 font-mono text-[10px] uppercase">3</div>
          <div className="col-span-6 bg-muted p-3 font-mono text-[10px] uppercase">6</div>
          <div className="col-span-3 bg-accent p-3 font-mono text-[10px] uppercase">3</div>
        </div>
        <Guidelines
          items={[
            { kind: 'do', text: 'Use 1px ink rules to divide content into clear bands.' },
            { kind: 'do', text: 'Build varied column spans such as 3/6/3 and 5/4/3.' },
            { kind: 'dont', text: 'Round panels or use decorative gradients.' },
          ]}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="border bg-card p-5 text-card-foreground">
          <h2 className="font-semibold">Spacing</h2>
          <p className="mt-1 text-sm text-muted-foreground">A 4px base step fits the source's modular spacing.</p>
          <div className="mt-6 space-y-4">
            {SPACING_SCALE.map((space) => (
              <div key={space.label} className="flex items-center gap-4">
                <span className="w-8 font-mono text-[10px] text-muted-foreground">
                  {space.label}
                </span>
                <div className={`h-2 bg-primary ${space.className}`} />
              </div>
            ))}
          </div>
        </section>

        <section className="border bg-card p-5 text-card-foreground">
          <h2 className="font-semibold">Surfaces and corners</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Flat paper surfaces, crisp borders, and no corner radius.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="flex h-24 items-end border bg-background p-3">
              <span className="font-mono text-[10px] uppercase">Paper · 0px radius</span>
            </div>
            <div className="flex h-24 items-end border bg-secondary p-3 text-secondary-foreground">
              <span className="font-mono text-[10px] uppercase">Ink · 1px rule</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
