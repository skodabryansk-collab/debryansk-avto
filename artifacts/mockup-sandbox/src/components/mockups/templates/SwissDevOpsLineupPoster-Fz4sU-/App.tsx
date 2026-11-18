import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Plus } from 'lucide-react';

const DAYS = [
  {
    id: 0,
    label: 'DAY 01',
    date: 'TUE 14.01',
    track: 'PROVISION',
    stage: 'STAGE A — INFRASTRUCTURE',
    command: '$ meridian init --provider aws',
    note: 'Declare your world before you build it. State files, modules, drift detection.',
    headliner: 'TERRAFORM',
    second: ['VAULT', 'PACKER', 'CONSUL'],
    third: ['ATLANTIS', 'SPACELIFT', 'CROSSPLANE', 'PULUMI', 'OPENTOFU', 'CDKTF'],
  },
  {
    id: 1,
    label: 'DAY 02',
    date: 'WED 15.01',
    track: 'DEPLOY',
    stage: 'STAGE B — ORCHESTRATION',
    command: '$ meridian ship --env production',
    note: 'From commit to cluster in one motion. Progressive rollouts, instant rollback.',
    headliner: 'KUBERNETES',
    second: ['HELM', 'ARGO CD', 'ISTIO'],
    third: ['FLUX', 'KUSTOMIZE', 'DAGGER', 'BUILDKITE', 'SKAFFOLD', 'KARPENTER'],
  },
  {
    id: 2,
    label: 'DAY 03',
    date: 'THU 16.01',
    track: 'OBSERVE',
    stage: 'STAGE C — TELEMETRY',
    command: '$ meridian watch --slo 99.95',
    note: 'If you cannot measure it, you do not own it. Metrics, traces, logs — unified.',
    headliner: 'PROMETHEUS',
    second: ['GRAFANA', 'LOKI', 'TEMPO'],
    third: ['JAEGER', 'OPENTELEMETRY', 'THANOS', 'ALERTMANAGER', 'VECTOR', 'PYROSCOPE'],
  },
];

export default function App() {
  const [active, setActive] = useState(1);
  const day = DAYS[active];

  return (
    <div className="min-h-screen bg-[#101010] flex items-center justify-center py-10 px-4 font-sans">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .ff-display { font-family: 'Inter Tight', Helvetica, Arial, sans-serif; }
            .ff-mono { font-family: 'IBM Plex Mono', monospace; }
            .headline-stroke {
              -webkit-text-stroke: 2px #0d0d0d;
              color: transparent;
            }
            .barcode {
              background-image: repeating-linear-gradient(
                90deg,
                #0d0d0d 0px, #0d0d0d 2px,
                transparent 2px, transparent 5px,
                #0d0d0d 5px, #0d0d0d 6px,
                transparent 6px, transparent 11px,
                #0d0d0d 11px, #0d0d0d 14px,
                transparent 14px, transparent 17px
              );
            }
            ::selection { background: #E63312; color: #F4F1EA; }
          `,
        }}
      />

      {/* ---------- POSTER ---------- */}
      <div className="w-full max-w-[860px] bg-[#F4F1EA] text-[#0d0d0d] ff-display shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)]">

        {/* ===== Masthead ===== */}
        <header className="grid grid-cols-12 border-b border-[#0d0d0d]">
          <div className="col-span-3 flex items-center gap-3 px-6 py-4 border-r border-[#0d0d0d]">
            <div className="w-3.5 h-3.5 bg-[#E63312]" />
            <span className="font-extrabold tracking-tight text-[15px]">MERIDIAN</span>
          </div>
          <div className="col-span-6 flex items-center px-6 py-4 border-r border-[#0d0d0d]">
            <span className="ff-mono text-[10px] tracking-[0.18em] uppercase text-[#0d0d0d]/70">
              User Onboarding · Session 25.01 · Platform Engineering Division
            </span>
          </div>
          <div className="col-span-3 flex items-center justify-between px-6 py-4">
            <span className="ff-mono text-[10px] tracking-[0.18em]">N° 0042</span>
            <ArrowUpRight size={16} strokeWidth={2.5} />
          </div>
        </header>

        {/* ===== Title block ===== */}
        <section className="grid grid-cols-12 border-b border-[#0d0d0d]">
          <div className="col-span-12 px-6 pt-10 pb-2">
            <h1 className="font-black leading-[0.86] tracking-[-0.045em] text-[clamp(72px,13vw,148px)]">
              SHIP<span className="text-[#E63312]">FEST</span>
            </h1>
            <h1 className="font-black leading-[0.86] tracking-[-0.045em] text-[clamp(72px,13vw,148px)] headline-stroke">
              ’25
            </h1>
          </div>
          <div className="col-span-12 grid grid-cols-12 mt-6 border-t border-[#0d0d0d]/30">
            <p className="col-span-5 px-6 py-4 text-[13px] font-semibold leading-snug border-r border-[#0d0d0d]/30">
              Three days. One terminal. Zero downtime.
              The complete onboarding circuit for your delivery pipeline —
              played live, in order, end to end.
            </p>
            <div className="col-span-4 px-6 py-4 border-r border-[#0d0d0d]/30">
              <p className="ff-mono text-[10px] tracking-[0.15em] uppercase text-[#0d0d0d]/60 mb-1">Dates</p>
              <p className="text-[22px] font-extrabold tracking-tight leading-none">JAN 14 — 16</p>
            </div>
            <div className="col-span-3 px-6 py-4">
              <p className="ff-mono text-[10px] tracking-[0.15em] uppercase text-[#0d0d0d]/60 mb-1">Main stage</p>
              <p className="text-[22px] font-extrabold tracking-tight leading-none">YOUR&nbsp;CLI</p>
            </div>
          </div>
        </section>

        {/* ===== Day selector ===== */}
        <nav className="grid grid-cols-3 border-b border-[#0d0d0d]">
          {DAYS.map((d) => {
            const isActive = d.id === active;
            return (
              <button
                key={d.id}
                onClick={() => setActive(d.id)}
                className={`group text-left px-6 py-5 transition-colors duration-200 ${
                  d.id < 2 ? 'border-r border-[#0d0d0d]' : ''
                } ${isActive ? 'bg-[#E63312] text-[#F4F1EA]' : 'hover:bg-[#0d0d0d] hover:text-[#F4F1EA]'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="ff-mono text-[10px] tracking-[0.2em]">{d.label}</span>
                  <span className="ff-mono text-[10px] tracking-[0.2em] opacity-60">{d.date}</span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-[26px] font-black tracking-tight leading-none">{d.track}</span>
                  <Plus
                    size={14}
                    strokeWidth={3}
                    className={`transition-transform duration-300 ${isActive ? 'rotate-45' : 'group-hover:rotate-45'}`}
                  />
                </div>
              </button>
            );
          })}
        </nav>

        {/* ===== Lineup ===== */}
        <section className="grid grid-cols-12 border-b border-[#0d0d0d] min-h-[420px]">
          {/* Left rail — schedule meta */}
          <aside className="col-span-3 border-r border-[#0d0d0d] flex flex-col">
            <div className="px-6 py-5 border-b border-[#0d0d0d]/30">
              <p className="ff-mono text-[10px] tracking-[0.15em] uppercase text-[#0d0d0d]/60 mb-2">Stage</p>
              <p className="text-[13px] font-bold leading-tight">{day.stage}</p>
            </div>
            <div className="px-6 py-5 border-b border-[#0d0d0d]/30">
              <p className="ff-mono text-[10px] tracking-[0.15em] uppercase text-[#0d0d0d]/60 mb-2">Doors open</p>
              <p className="text-[13px] font-bold">git push origin main</p>
            </div>
            <div className="px-6 py-5 flex-1">
              <p className="ff-mono text-[10px] tracking-[0.15em] uppercase text-[#0d0d0d]/60 mb-2">Field notes</p>
              <p className="text-[12px] leading-relaxed text-[#0d0d0d]/80">{day.note}</p>
            </div>
            <div className="px-6 py-4 border-t border-[#0d0d0d]/30">
              <p className="ff-mono text-[10px] tracking-[0.1em] text-[#E63312]">{day.command}</p>
            </div>
          </aside>

          {/* Lineup typography */}
          <div className="col-span-9 relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={day.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="px-8 py-8 flex flex-col h-full"
              >
                {/* Headliner */}
                <div className="flex items-start justify-between">
                  <h2 className="font-black tracking-[-0.04em] leading-[0.9] text-[clamp(48px,8.5vw,96px)]">
                    {day.headliner}
                  </h2>
                  <span className="ff-mono text-[10px] tracking-[0.2em] mt-2 px-2 py-1 border border-[#0d0d0d]">
                    HEADLINER
                  </span>
                </div>
                <p className="ff-mono text-[10px] tracking-[0.2em] uppercase text-[#0d0d0d]/50 mt-2">
                  Set 01 · 21:00 · {day.track} fundamentals — live walkthrough
                </p>

                {/* Second tier */}
                <div className="mt-8 pt-6 border-t border-[#0d0d0d]/30">
                  <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
                    {day.second.map((act, i) => (
                      <span key={act} className="flex items-baseline gap-5">
                        <span className="text-[clamp(26px,3.6vw,40px)] font-extrabold tracking-tight hover:text-[#E63312] transition-colors cursor-default">
                          {act}
                        </span>
                        {i < day.second.length - 1 && (
                          <span className="w-2 h-2 bg-[#E63312] inline-block" />
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Third tier */}
                <div className="mt-6 pt-5 border-t border-[#0d0d0d]/30">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
                    {day.third.map((act, i) => (
                      <span key={act} className="flex items-baseline gap-4">
                        <span className="text-[15px] font-bold tracking-tight text-[#0d0d0d]/80 hover:text-[#E63312] transition-colors cursor-default">
                          {act}
                        </span>
                        {i < day.third.length - 1 && (
                          <span className="text-[#0d0d0d]/30 text-[13px]">/</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Step index */}
                <div className="mt-auto pt-8 grid grid-cols-3 gap-px bg-[#0d0d0d]/20 border border-[#0d0d0d]/20">
                  {['Initialize workspace', 'Run the pipeline', 'Verify & sign off'].map((step, i) => (
                    <div key={step} className="bg-[#F4F1EA] px-4 py-3">
                      <p className="ff-mono text-[10px] text-[#E63312] mb-1">0{i + 1}</p>
                      <p className="text-[11px] font-semibold leading-tight">{step}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* ===== Footer ===== */}
        <footer className="grid grid-cols-12">
          <div className="col-span-5 px-6 py-5 border-r border-[#0d0d0d] flex flex-col justify-between">
            <p className="ff-mono text-[10px] tracking-[0.18em] uppercase text-[#0d0d0d]/60">Admission</p>
            <p className="text-[15px] font-bold mt-2 leading-snug">
              Free with <span className="text-[#E63312]">meridian init</span>.
              No queue. No re-entry required.
            </p>
          </div>
          <div className="col-span-4 px-6 py-5 border-r border-[#0d0d0d]">
            <p className="ff-mono text-[10px] tracking-[0.18em] uppercase text-[#0d0d0d]/60">Presented by</p>
            <p className="text-[13px] font-bold mt-2">Meridian Platform GmbH · Zürich / SF / Singapore</p>
            <p className="ff-mono text-[10px] mt-1 text-[#0d0d0d]/50">docs.meridian.dev/onboarding</p>
          </div>
          <div className="col-span-3 px-6 py-5 flex flex-col justify-between">
            <div className="barcode h-8 w-full" />
            <div className="flex items-center justify-between mt-3">
              <span className="ff-mono text-[9px] tracking-[0.15em]">SF-25.01-0042</span>
              <span className="ff-mono text-[9px] tracking-[0.15em] text-[#E63312]">47.37°N 8.54°E</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}