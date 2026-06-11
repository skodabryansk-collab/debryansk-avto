import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

/* ── Types ────────────────────────────────────────────────── */
interface StatItem { label: string; value: number; suffix: string; accent: string; }
interface TabItem { label: string; sub: string; }

/* ── Data ─────────────────────────────────────────────────── */
const STATS: StatItem[] = [
  { label: "брендов",       value: 9,   suffix: "",  accent: "#0070b8" },
  { label: "центра",        value: 4,   suffix: "",  accent: "#87b63c" },
  { label: "лет на рынке",  value: 15,  suffix: "+", accent: "#0070b8" },
  { label: "авто в наличии",value: 100, suffix: "+", accent: "#87b63c" },
];

const TABS: TabItem[] = [
  { label: "Новые авто",   sub: "В наличии и под заказ" },
  { label: "С пробегом",  sub: "Проверенные авто" },
  { label: "Сервис",      sub: "Запись онлайн" },
  { label: "Выкуп авто",  sub: "Честная оценка" },
];

const BRANDS = [
  "OMODA", "JAECOO", "HAVAL", "CHERY", "TENET",
  "Mercedes-Benz", "Jetour", "Volkswagen",
];

/* ── Animated counter ─────────────────────────────────────── */
function CountUp({ target, suffix = "", active }: { target: number; suffix?: string; active: boolean }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    const duration = 1400;
    const fps = 60;
    const steps = fps * (duration / 1000);
    const step = target / steps;
    let cur = 0;
    const t = setInterval(() => {
      cur += step;
      if (cur >= target) { setCount(target); clearInterval(t); }
      else setCount(Math.floor(cur));
    }, 1000 / fps);
    return () => clearInterval(t);
  }, [target, active]);
  return <>{count}{suffix}</>;
}

/* ── Main component ───────────────────────────────────────── */
export function HeroBanner() {
  const [activeTab, setActiveTab] = useState(0);
  const [countersOn, setCountersOn] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setCountersOn(true), 700);
    return () => clearTimeout(t);
  }, []);

  /* brand ticker needs 3 copies to loop seamlessly */
  const tickerBrands = [...BRANDS, ...BRANDS, ...BRANDS];

  return (
    <section
      style={{ minHeight: "100dvh", background: "#0a0c10", fontFamily: "'Manrope', sans-serif" }}
      className="relative flex flex-col overflow-hidden"
    >
      {/* ── Google Fonts ────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-33.333%); }
        }
        @keyframes noisePulse {
          0%,100% { opacity: 0.03; }
          50%      { opacity: 0.06; }
        }
        .hero-tab-btn { transition: all 0.2s ease; }
        .hero-tab-btn:hover { background: rgba(255,255,255,0.08) !important; }
        .hero-cta-btn { transition: opacity 0.2s ease, transform 0.15s ease; }
        .hero-cta-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .hero-cta-btn:active { transform: scale(0.98); }
      `}</style>

      {/* ── Ambient glow blobs ──────────────────────────────── */}
      <div style={{
        position: "absolute", top: "5%", left: "-18%",
        width: "70%", height: "70%", borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(0,112,184,0.22) 0%, transparent 65%)",
        filter: "blur(48px)", pointerEvents: "none"
      }} />
      <div style={{
        position: "absolute", top: "20%", right: "-20%",
        width: "65%", height: "65%", borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(135,182,60,0.14) 0%, transparent 65%)",
        filter: "blur(60px)", pointerEvents: "none"
      }} />
      {/* subtle grid overlay */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
        maskImage: "radial-gradient(ellipse 80% 80% at 50% 40%, black 30%, transparent 100%)"
      }} />

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pt-24 pb-6">
        <div className="w-full max-w-4xl mx-auto text-center">

          {/* Pill badge */}
          <motion.div
            initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 16px", borderRadius: 100, marginBottom: 28,
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#87b63c", animation: "noisePulse 2s ease infinite" }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>
              Группа компаний · Брянск
            </span>
          </motion.div>

          {/* H1 */}
          <motion.h1
            initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontSize: "clamp(2.4rem, 7vw, 5rem)", fontWeight: 800,
              lineHeight: 1.06, letterSpacing: "-0.025em",
              color: "#fff", marginBottom: "1rem"
            }}
          >
            Дебрянск Авто —<br />
            <span style={{
              background: "linear-gradient(135deg, #0070b8 0%, #4ba8e8 40%, #87b63c 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text"
            }}>
              Территория Автомобилей.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            style={{ fontSize: "clamp(0.875rem, 2vw, 1.05rem)", color: "rgba(255,255,255,0.42)", lineHeight: 1.75, fontWeight: 500, marginBottom: "2.5rem" }}
          >
            9 официальных брендов · 4 дилерских центра · Брянск<br />
            Продажа, сервис и финансирование с 2011 года
          </motion.p>

          {/* ── Stats row ──────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.48 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8"
          >
            {STATS.map((stat, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20, padding: "1rem 0.875rem",
                backdropFilter: "blur(16px)"
              }}>
                <div style={{
                  fontWeight: 800, fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
                  lineHeight: 1, letterSpacing: "-0.04em", color: "#fff", marginBottom: 4
                }}>
                  <CountUp target={stat.value} suffix={stat.suffix} active={countersOn} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.03em" }}>
                  {stat.label}
                </div>
                {/* bottom accent bar */}
                <div style={{ height: 2, borderRadius: 2, marginTop: 10, background: stat.accent, opacity: 0.5 }} />
              </div>
            ))}
          </motion.div>

          {/* ── Action panel ───────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.62 }}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 26, padding: "1.125rem",
              backdropFilter: "blur(20px)",
              maxWidth: 660, margin: "0 auto"
            }}
          >
            {/* Tab pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {TABS.map((tab, i) => (
                <button
                  key={i}
                  className="hero-tab-btn"
                  onClick={() => setActiveTab(i)}
                  style={{
                    padding: "0.6rem 0.5rem", borderRadius: 13, fontSize: 12.5,
                    fontWeight: 700, letterSpacing: "0.01em",
                    background: activeTab === i ? "rgba(0,112,184,0.22)" : "transparent",
                    border: `1px solid ${activeTab === i ? "rgba(0,112,184,0.38)" : "transparent"}`,
                    color: activeTab === i ? "#fff" : "rgba(255,255,255,0.45)",
                    cursor: "pointer", textAlign: "center" as const
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {/* Active tab sub-label */}
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 500, marginBottom: 10, paddingLeft: 2 }}>
              {TABS[activeTab].sub}
            </div>
            {/* CTA button */}
            <button
              className="hero-cta-btn"
              style={{
                width: "100%", padding: "0.9rem 1rem", borderRadius: 15,
                fontWeight: 800, fontSize: 15, letterSpacing: "0.01em",
                color: "#fff", cursor: "pointer", border: "none",
                background: "linear-gradient(135deg, #0070b8 0%, #87b63c 100%)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8
              }}
            >
              Подобрать автомобиль
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </motion.div>

        </div>
      </div>

      {/* ── Brand ticker ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.9 }}
        style={{
          position: "relative", zIndex: 10,
          background: "rgba(255,255,255,0.03)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(8px)",
          padding: "14px 0", overflow: "hidden"
        }}
      >
        {/* fade masks */}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 96, background: "linear-gradient(to right, #0a0c10, transparent)", zIndex: 2, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 96, background: "linear-gradient(to left, #0a0c10, transparent)", zIndex: 2, pointerEvents: "none" }} />
        <div style={{ display: "flex", animation: "marquee 22s linear infinite", width: "max-content" }}>
          {tickerBrands.map((brand, i) => (
            <span key={i} style={{
              display: "inline-flex", alignItems: "center", gap: 14,
              padding: "0 20px", fontSize: 12, fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap"
            }}>
              {brand}
              <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.18)", flexShrink: 0 }} />
            </span>
          ))}
        </div>
      </motion.div>

      {/* ── Scroll cue ─────────────────────────────────────── */}
      <motion.div
        style={{ position: "absolute", bottom: 68, left: "50%", x: "-50%", zIndex: 10, color: "rgba(255,255,255,0.22)" }}
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2.3 }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </motion.div>
    </section>
  );
}

export default HeroBanner;
