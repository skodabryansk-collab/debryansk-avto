import { Guidelines } from './parts';

export function ContentGuidelinesPage() {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 border bg-card p-5 text-card-foreground md:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Metadata
          </p>
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.18em]">
            DAY 02 · WED 15.01
          </p>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            SESSION 25.01 · PLATFORM ENGINEERING
          </p>
        </div>
        <div className="border-t border-border pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Command
          </p>
          <p className="mt-4 font-mono text-sm text-primary">
            $ meridian ship --env production
          </p>
        </div>
      </section>

      <section className="space-y-4 border bg-card p-5 text-card-foreground">
        <h2 className="font-semibold">Voice and labels</h2>
        <Guidelines
          items={[
            { kind: 'do', text: 'Use concise, technical labels and short operational copy.' },
            { kind: 'do', text: 'Use uppercase monospaced styling for dates, IDs, labels, and commands.' },
            { kind: 'dont', text: 'Replace the direct event copy with generic promotional phrases.' },
          ]}
        />
      </section>
    </div>
  );
}

export function MotionGuidelinesPage() {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="border bg-card p-5 text-card-foreground">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Content change
          </p>
          <p className="mt-4 text-3xl font-black leading-none">350 ms</p>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            FADE + VERTICAL MOVE
          </p>
        </div>
        <div className="border bg-card p-5 text-card-foreground">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Active tab
          </p>
          <p className="mt-4 text-3xl font-black leading-none">200 ms</p>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            COLOR TRANSITION
          </p>
        </div>
        <div className="border bg-card p-5 text-card-foreground">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Plus icon
          </p>
          <p className="mt-4 text-3xl font-black leading-none">45°</p>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            300 MS ROTATION
          </p>
        </div>
      </section>
      <section className="space-y-4 border bg-card p-5 text-card-foreground">
        <h2 className="font-semibold">Motion guidance</h2>
        <Guidelines
          items={[
            { kind: 'do', text: 'Use a short fade and vertical shift when the selected lineup changes.' },
            { kind: 'do', text: 'Keep tab feedback and icon rotation brief and tied to the active state.' },
            { kind: 'dont', text: 'Add motion that does not communicate a state change.' },
          ]}
        />
        <p className="border-t border-border pt-4 font-mono text-[10px] text-muted-foreground">
          CONTENT EASE: CUBIC-BEZIER(0.22, 1, 0.36, 1)
        </p>
      </section>
    </div>
  );
}
