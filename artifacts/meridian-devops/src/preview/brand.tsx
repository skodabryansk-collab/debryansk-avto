import { Guidelines } from './parts';

export function BrandPage() {
  return (
    <div className="space-y-6">
      <section className="border bg-card p-5 text-card-foreground">
        <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Source lockup
          </h2>
          <span className="font-mono text-[10px] text-muted-foreground">MASTHEAD</span>
        </div>
        <div className="my-6 flex items-center gap-3 border-y border-border py-8">
          <span aria-hidden="true" className="h-3.5 w-3.5 bg-primary" />
          <span className="text-[15px] font-extrabold tracking-tight">MERIDIAN</span>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          The selected poster contains this inline red-square and wordmark lockup.
          It does not include a separate logo file, so no standalone image has been
          created for the design system.
        </p>
      </section>

      <section className="space-y-4 border bg-card p-5 text-card-foreground">
        <h2 className="font-semibold">Identity guidance</h2>
        <Guidelines
          items={[
            { kind: 'do', text: 'Keep the red square directly beside the uppercase MERIDIAN wordmark.' },
            { kind: 'do', text: 'Use the lockup in the compact masthead, aligned with the grid.' },
            { kind: 'dont', text: 'Invent a separate symbol or add effects to the wordmark.' },
          ]}
        />
      </section>
    </div>
  );
}
