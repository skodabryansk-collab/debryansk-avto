// Isometric Hero Mockup — Территория автомобилей
// CX=720, CY=440, TX=60, TY=30, TZ=50

const CX = 720, CY = 440, TX = 60, TY = 30, TZ = 50;

function sp(c: number, r: number, z = 0) {
  return { x: CX + (c - r) * TX, y: CY + (c + r) * TY - z * TZ };
}
function pt(c: number, r: number, z = 0) {
  const p = sp(c, r, z);
  return `${+p.x.toFixed(1)},${+p.y.toFixed(1)}`;
}
function tile(c: number, r: number, w: number, d: number, z = 0) {
  return `${pt(c, r, z)} ${pt(c + w, r, z)} ${pt(c + w, r + d, z)} ${pt(c, r + d, z)}`;
}
function bTop(c: number, r: number, w: number, d: number, h: number) {
  return tile(c, r, w, d, h);
}
// South-facing = LEFT wall in screen
function bLeft(c: number, r: number, w: number, d: number, h: number) {
  return `${pt(c, r + d, 0)} ${pt(c + w, r + d, 0)} ${pt(c + w, r + d, h)} ${pt(c, r + d, h)}`;
}
// East-facing = RIGHT wall in screen
function bRight(c: number, r: number, w: number, d: number, h: number) {
  return `${pt(c + w, r, 0)} ${pt(c + w, r + d, 0)} ${pt(c + w, r + d, h)} ${pt(c + w, r, h)}`;
}

// Isometric box component
function Box({
  c, r, w, d, h,
  topColor = '#E8ECF0',
  leftColor = '#C0CAD0',
  rightColor = '#A0AAB0',
  cls = '',
}: {
  c: number; r: number; w: number; d: number; h: number;
  topColor?: string; leftColor?: string; rightColor?: string; cls?: string;
}) {
  return (
    <>
      <polygon points={bRight(c, r, w, d, h)} fill={rightColor} className={cls} />
      <polygon points={bLeft(c, r, w, d, h)} fill={leftColor} className={cls} />
      <polygon points={bTop(c, r, w, d, h)} fill={topColor} className={cls} />
    </>
  );
}

// Tree element
function Tree({ c, r }: { c: number; r: number }) {
  const p = sp(c, r, 0);
  return (
    <g>
      <ellipse cx={p.x + 3} cy={p.y - 10} rx={9} ry={5} fill="#2D5A1B" opacity="0.4" />
      <circle cx={p.x} cy={p.y - 14} r={9} fill="#4A8A30" />
      <circle cx={p.x - 3} cy={p.y - 18} r={6} fill="#5EAA3E" />
    </g>
  );
}

// Car silhouette on isometric road
function Car({ c, r, dir = 1 }: { c: number; r: number; dir?: 1 | -1 }) {
  const p = sp(c, r, 0.05);
  const skew = dir === 1 ? 'skewX(30)' : 'scale(-1,1) skewX(30)';
  return (
    <g transform={`translate(${p.x},${p.y})`} opacity="0.85">
      <g transform={skew}>
        <rect x={-18} y={-12} width={36} height={8} rx={2} fill="#3A4558" />
        <rect x={-12} y={-20} width={24} height={10} rx={3} fill="#4A5568" />
        <ellipse cx={-11} cy={-4} rx={5} ry={5} fill="#222" />
        <ellipse cx={11} cy={-4} rx={5} ry={5} fill="#222" />
        <ellipse cx={-11} cy={-4} rx={3} ry={3} fill="#555" />
        <ellipse cx={11} cy={-4} rx={3} ry={3} fill="#555" />
      </g>
    </g>
  );
}

// Lane dashes
function LaneDash({ c, r, w, d }: { c: number; r: number; w: number; d: number }) {
  return (
    <polygon points={tile(c, r, w, d)} fill="rgba(255,255,255,0.25)" />
  );
}

// Tooltip box
function Tooltip({ c, r, title, lines }: { c: number; r: number; title: string; lines: string[] }) {
  const p = sp(c, r, 3);
  const bw = 160, bh = 16 + lines.length * 16 + 10;
  return (
    <g className="complex-tooltip">
      <rect x={p.x - bw / 2} y={p.y - bh} width={bw} height={bh} rx={6} fill="rgba(10,15,30,0.82)" />
      <text x={p.x} y={p.y - bh + 16} textAnchor="middle" fontSize="12" fontWeight="700" fontFamily="Inter, Arial, sans-serif" fill="white">
        {title}
      </text>
      {lines.map((l, i) => (
        <text key={i} x={p.x} y={p.y - bh + 30 + i * 15} textAnchor="middle" fontSize="10" fontFamily="Inter, Arial, sans-serif" fill="#B0C0D0">
          {l}
        </text>
      ))}
    </g>
  );
}

// Lane dashes along road 1 (along row direction, c constant)
function Road1Dashes() {
  const dashes = [];
  for (let c = -11; c < 11; c += 2) {
    if (Math.abs(c) < 1.5) continue; // skip center intersection
    dashes.push(<LaneDash key={c} c={c + 0.4} r={-0.05} w={0.7} d={0.1} />);
  }
  return <>{dashes}</>;
}

// Lane dashes along road 2 (col direction, r constant)
function Road2Dashes() {
  const dashes = [];
  for (let r = -11; r < 11; r += 2) {
    if (Math.abs(r) < 1.5) continue;
    dashes.push(<LaneDash key={r} c={-0.05} r={r + 0.4} w={0.1} d={0.7} />);
  }
  return <>{dashes}</>;
}

// Parking grid
function ParkingLot({ c, r, w, d }: { c: number; r: number; w: number; d: number }) {
  const lines = [];
  for (let i = 0; i <= Math.round(w / 0.8); i++) {
    const x = c + i * 0.8;
    if (x > c + w) break;
    lines.push(<polygon key={`v${i}`} points={tile(x, r, 0.06, d)} fill="rgba(255,255,255,0.2)" />);
  }
  return (
    <>
      <polygon points={tile(c, r, w, d)} fill="#B4ACA0" />
      {lines}
    </>
  );
}

export default function IsometricHero() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#A0BAD0' }}>
      <svg
        viewBox="0 0 1440 810"
        style={{ width: '100%', height: '100%', display: 'block' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6A90B8" />
            <stop offset="55%" stopColor="#A8C4D8" />
            <stop offset="100%" stopColor="#C8D4DC" />
          </linearGradient>
          <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D0C8B8" />
            <stop offset="100%" stopColor="#C0B8A8" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.25)" />
          </filter>
        </defs>

        {/* ── SKY ──────────────────────────────────────────── */}
        <rect x="0" y="0" width="1440" height="810" fill="url(#skyGrad)" />

        {/* ── GROUND DIAMOND ───────────────────────────────── */}
        <polygon points="720,140 1470,575 720,810 -30,575" fill="url(#groundGrad)" />

        {/* ── GRASS ZONES (behind roads) ───────────────────── */}
        {/* NW grass — Литейная area */}
        <polygon points={tile(-12, -2, 6, 5)} fill="#8CB86A" opacity="0.75" />
        {/* NE grass — Советская area */}
        <polygon points={tile(-2, -12, 6, 5)} fill="#8CB86A" opacity="0.75" />
        {/* S grass — Супонево area */}
        <polygon points={tile(-2, 3, 8, 6)} fill="#8CB86A" opacity="0.75" />
        {/* E grass — Московский area */}
        <polygon points={tile(4, -3, 6, 6)} fill="#8CB86A" opacity="0.75" />
        {/* Central grass patches */}
        <polygon points={tile(-3, 1, 2.5, 2)} fill="#8CB86A" opacity="0.6" />
        <polygon points={tile(1, -3, 2.5, 2)} fill="#8CB86A" opacity="0.6" />

        {/* ── MAIN ROADS ───────────────────────────────────── */}
        {/* Road 1: diagonal NE→SW (along row≈0) */}
        <polygon points={tile(-13, -0.75, 26, 1.5)} fill="#3A3A3A" />
        {/* Road 2: diagonal NW→SE (along col≈0) */}
        <polygon points={tile(-0.75, -13, 1.5, 26)} fill="#3A3A3A" />
        {/* Center intersection (slightly lighter) */}
        <polygon points={tile(-0.75, -0.75, 1.5, 1.5)} fill="#444" />

        {/* Lane markings */}
        <Road1Dashes />
        <Road2Dashes />

        {/* ── BACKGROUND DECORATIVE TREES ─────────────────── */}
        {/* Trees scattered across scene */}
        <Tree c={-3} r={2} />
        <Tree c={-4} r={2.5} />
        <Tree c={2} r={-3} />
        <Tree c={2.5} r={-4} />
        <Tree c={-10} r={-1} />
        <Tree c={-11} r={0} />
        <Tree c={-10} r={1} />
        <Tree c={0} r={-10} />
        <Tree c={1} r={-11} />
        <Tree c={-1} r={-10} />
        <Tree c={3} r={3} />
        <Tree c={4} r={-4} />

        {/* ── COMPLEX: ЛИТЕЙНАЯ (HAVAL CITY) — NW ─────────── */}
        <g className="complex" id="liteynaya">
          {/* Parking lot */}
          <ParkingLot c={-11} r={0.2} w={3.2} d={1.8} />
          {/* Service building (smaller, back) */}
          <Box
            c={-11} r={-1.5} w={2} d={1.5} h={1.5}
            topColor="#D8DCE0" leftColor="#A8B4BC" rightColor="#8090A0"
            cls="b-liteynaya"
          />
          {/* Main showroom */}
          <polygon points={bRight(-11, 0, 3.5, 2, 2.5)} fill="#8A3A42" className="b-liteynaya" />
          <polygon points={bLeft(-11, 0, 3.5, 2, 2.5)} fill="#C8282E" className="b-liteynaya" />
          <polygon points={bTop(-11, 0, 3.5, 2, 2.5)} fill="#E8ECF0" className="b-liteynaya" />
          {/* Facade accent: white stripe */}
          <polygon points={bLeft(-11, 0, 3.5, 2, 0.35)} fill="rgba(255,255,255,0.18)" className="b-liteynaya" />
          {/* Brand label */}
          <text
            x={sp(-9.25, 2, 1.25).x} y={sp(-9.25, 2, 1.25).y}
            textAnchor="middle" fontSize="9.5" fontWeight="800"
            fontFamily="Inter, Arial, sans-serif" fill="white" letterSpacing="1.5"
            transform={`rotate(26.57, ${sp(-9.25, 2, 1.25).x}, ${sp(-9.25, 2, 1.25).y})`}
          >HAVAL CITY</text>
          {/* Trees around complex */}
          <Tree c={-12} r={2.5} />
          <Tree c={-12} r={3.5} />
          <Tree c={-8} r={2.5} />
          {/* Hover tooltip */}
          <Tooltip
            c={-10} r={0.5}
            title="Литейная"
            lines={['HAVAL CITY', 'ул. Литейная, 3/2']}
          />
        </g>

        {/* ── COMPLEX: СОВЕТСКАЯ (TENET, VW) — NE ─────────── */}
        <g className="complex" id="sovetskaya">
          {/* Parking */}
          <ParkingLot c={-2.5} r={-7} w={2.5} d={1.5} />
          {/* Service wing (VW Сервис) */}
          <Box
            c={0} r={-6} w={1.5} d={2} h={1.2}
            topColor="#D8DCE0" leftColor="#A8B4BC" rightColor="#8090A0"
            cls="b-sovetskaya"
          />
          {/* Main showroom */}
          <polygon points={bRight(-2.5, -7, 2.5, 2.5, 1.5)} fill="#1A3568" className="b-sovetskaya" />
          <polygon points={bLeft(-2.5, -7, 2.5, 2.5, 1.5)} fill="#1E4A8C" className="b-sovetskaya" />
          <polygon points={bTop(-2.5, -7, 2.5, 2.5, 1.5)} fill="#E8ECF0" className="b-sovetskaya" />
          {/* Facade accent */}
          <polygon points={bLeft(-2.5, -7, 2.5, 2.5, 0.3)} fill="rgba(255,255,255,0.18)" className="b-sovetskaya" />
          {/* Brand label */}
          <text
            x={sp(-1.25, -4.5, 0.75).x} y={sp(-1.25, -4.5, 0.75).y}
            textAnchor="middle" fontSize="9.5" fontWeight="800"
            fontFamily="Inter, Arial, sans-serif" fill="white" letterSpacing="1.5"
            transform={`rotate(26.57, ${sp(-1.25, -4.5, 0.75).x}, ${sp(-1.25, -4.5, 0.75).y})`}
          >TENET</text>
          {/* Trees */}
          <Tree c={-4.5} r={-5} />
          <Tree c={-5} r={-6} />
          <Tree c={1.5} r={-8.5} />
          {/* Tooltip */}
          <Tooltip
            c={-1.5} r={-6}
            title="Советская"
            lines={['TENET • VW Сервис', 'ул. Советская, 77']}
          />
        </g>

        {/* ── COMPLEX: СУПОНЕВО (OMODA, JAECOO) — S, LARGEST ─ */}
        <g className="complex" id="suponevo">
          {/* Used cars lot */}
          <ParkingLot c={-1.5} r={5.5} w={2.5} d={2} />
          {/* Service buildings */}
          <Box
            c={3.5} r={4} w={1.8} d={2} h={1.5}
            topColor="#D8DCE0" leftColor="#A8B4BC" rightColor="#8090A0"
            cls="b-suponevo"
          />
          <Box
            c={-1.5} r={4} w={1.5} d={1.5} h={1.5}
            topColor="#D8DCE0" leftColor="#A8B4BC" rightColor="#8090A0"
            cls="b-suponevo"
          />
          {/* Main showroom — OMODA */}
          <polygon points={bRight(0, 4, 3, 1.5, 2)} fill="#1A5F2A" className="b-suponevo" />
          <polygon points={bLeft(0, 4, 3, 1.5, 2)} fill="#24843A" className="b-suponevo" />
          <polygon points={bTop(0, 4, 3, 1.5, 2)} fill="#E8ECF0" className="b-suponevo" />
          {/* JAECOO wing */}
          <polygon points={bRight(0, 5.5, 3, 1.5, 2)} fill="#226B32" className="b-suponevo" />
          <polygon points={bLeft(0, 5.5, 3, 1.5, 2)} fill="#2E9040" className="b-suponevo" />
          <polygon points={bTop(0, 5.5, 3, 1.5, 2)} fill="#E0E8E0" className="b-suponevo" />
          {/* Facade accents */}
          <polygon points={bLeft(0, 4, 3, 1.5, 0.35)} fill="rgba(255,255,255,0.18)" className="b-suponevo" />
          <polygon points={bLeft(0, 5.5, 3, 1.5, 0.35)} fill="rgba(255,255,255,0.18)" className="b-suponevo" />
          {/* Brand labels */}
          <text
            x={sp(1.5, 5.5, 1).x} y={sp(1.5, 5.5, 1).y}
            textAnchor="middle" fontSize="9" fontWeight="800"
            fontFamily="Inter, Arial, sans-serif" fill="white" letterSpacing="1.5"
            transform={`rotate(26.57, ${sp(1.5, 5.5, 1).x}, ${sp(1.5, 5.5, 1).y})`}
          >OMODA</text>
          <text
            x={sp(1.5, 7, 1).x} y={sp(1.5, 7, 1).y}
            textAnchor="middle" fontSize="9" fontWeight="800"
            fontFamily="Inter, Arial, sans-serif" fill="white" letterSpacing="1.5"
            transform={`rotate(26.57, ${sp(1.5, 7, 1).x}, ${sp(1.5, 7, 1).y})`}
          >JAECOO</text>
          {/* Trees */}
          <Tree c={-2.5} r={7} />
          <Tree c={-2} r={7.5} />
          <Tree c={5} r={6.5} />
          <Tree c={5} r={5} />
          {/* Tooltip */}
          <Tooltip
            c={1} r={4.5}
            title="Супонево"
            lines={['OMODA • JAECOO', 'Skoda Сервис • Exeed Сервис', 'Автомобили с пробегом']}
          />
        </g>

        {/* ── COMPLEX: МОСКОВСКИЙ (HAVAL PRO, JETOUR) — E ──── */}
        <g className="complex" id="moskovskiy">
          {/* Parking */}
          <ParkingLot c={5.2} r={0.2} w={2.8} d={1.8} />
          {/* Service building (MB Сервис) */}
          <Box
            c={5} r={2} w={1.5} d={1.5} h={1.5}
            topColor="#D8DCE0" leftColor="#A8B4BC" rightColor="#8090A0"
            cls="b-moskovskiy"
          />
          {/* Main showroom */}
          <polygon points={bRight(5, 0, 3, 2, 2.5)} fill="#A04808" className="b-moskovskiy" />
          <polygon points={bLeft(5, 0, 3, 2, 2.5)} fill="#D45C0A" className="b-moskovskiy" />
          <polygon points={bTop(5, 0, 3, 2, 2.5)} fill="#E8ECF0" className="b-moskovskiy" />
          {/* Facade accent */}
          <polygon points={bLeft(5, 0, 3, 2, 0.35)} fill="rgba(255,255,255,0.18)" className="b-moskovskiy" />
          {/* Brand label */}
          <text
            x={sp(6.5, 2, 1.25).x} y={sp(6.5, 2, 1.25).y}
            textAnchor="middle" fontSize="9" fontWeight="800"
            fontFamily="Inter, Arial, sans-serif" fill="white" letterSpacing="1"
            transform={`rotate(26.57, ${sp(6.5, 2, 1.25).x}, ${sp(6.5, 2, 1.25).y})`}
          >HAVAL PRO</text>
          {/* Trees */}
          <Tree c={8.5} r={-0.5} />
          <Tree c={9} r={0.5} />
          <Tree c={5} r={3.5} />
          {/* Tooltip */}
          <Tooltip
            c={6.5} r={0.5}
            title="Московский"
            lines={['HAVAL PRO • JETOUR', 'MB Сервис', 'пр. Московский, 2Г']}
          />
        </g>

        {/* ── CARS ON ROADS ────────────────────────────────── */}
        {/* Road 1 cars (NE-SW) */}
        <Car c={-4} r={-0.3} dir={1} />
        <Car c={3} r={0.3} dir={-1} />
        <Car c={-7} r={0.3} dir={1} />
        {/* Road 2 cars (NW-SE) */}
        <Car c={0.3} r={-5} dir={1} />
        <Car c={-0.3} r={3} dir={-1} />

        {/* ── FOREGROUND TREES ─────────────────────────────── */}
        <Tree c={-1.5} r={1.5} />
        <Tree c={1.5} r={-1.5} />
        <Tree c={-2} r={-2} />

        {/* ── CENTER LOGO PLATFORM ─────────────────────────── */}
        {/* Elevated platform tile */}
        <polygon points={tile(-1.8, -1.8, 3.6, 3.6, 0.2)} fill="rgba(255,255,255,0.12)" />
        <polygon points={bLeft(-1.8, -1.8, 3.6, 3.6, 0.2)} fill="rgba(255,255,255,0.08)" />
        <polygon points={bRight(-1.8, -1.8, 3.6, 3.6, 0.2)} fill="rgba(255,255,255,0.05)" />

        {/* ── CENTER LOGO CONTENT ───────────────────────────── */}
        {/* Background backdrop for readability */}
        <ellipse
          cx={720} cy={430}
          rx={180} ry={110}
          fill="rgba(10,20,40,0.35)"
          filter="url(#shadow)"
        />

        {/* Logo — inline white SVG, centered at (720, 385) */}
        <g transform="translate(630, 364) scale(0.55)">
          {/* Дебрянск Авто logo — white paths */}
          <path d="M54.46,26.33C53.96,11.29,41.36-.49,26.33.02,11.29.52-.49,13.12.02,28.15c.15,4.46,1.36,8.63,3.39,12.28l4.49-7.06c-.55-1.73-.87-3.56-.94-5.46-.38-11.2,8.4-20.58,19.6-20.96,11.2-.38,20.58,8.4,20.96,19.6.38,11.2-8.4,20.58-19.6,20.96-2.24.08-4.4-.23-6.43-.83l.09-.09,10.68-29.09-1.21.04s-19.3,30.23-19.56,31.09c0,0,1.04,1.09,2.05,1.85,1.04.78,2.38,1.54,2.38,1.54,3.72,1.7,7.87,2.59,12.24,2.44,15.04-.5,26.81-13.1,26.31-28.14Z" fill="white"/>
          <g fill="white">
            <path d="M93.24,2.89h-12.46c-.75,0-1.46.16-2.12.47-.64.31-1.21.72-1.69,1.23-.47.51-.85,1.1-1.12,1.77-.27.67-.41,1.38-.41,2.13v9.39h-2.37v3.7h22.56v-3.7h-2.37V2.89ZM79.01,17.88v-9.39c0-.54.17-.99.52-1.36.34-.36.75-.54,1.25-.54h8.89v11.29h-10.66Z"/>
            <polygon points="97.98,21.58 115.79,21.58 115.79,17.88 101.55,17.88 101.55,14.08 113.41,14.08 113.41,10.39 101.55,10.39 101.55,6.59 115.79,6.59 115.79,2.89 97.98,2.89"/>
            <path d="M136.2,12.96c-.29-.67-.67-1.26-1.15-1.76-.48-.5-1.04-.91-1.68-1.19-.65-.29-1.34-.44-2.05-.44h-8.89v-2.97h11.86v-3.7h-15.44v18.68h12.46c.75,0,1.46-.16,2.12-.47.64-.31,1.21-.72,1.69-1.23.47-.51.85-1.1,1.12-1.77.27-.67.41-1.38.41-2.13v-.84c-.02-.77-.17-1.51-.46-2.18ZM122.43,13.26h8.89c.5,0,.91.18,1.25.54.35.37.52.81.52,1.36v.82c0,.54-.17.99-.52,1.36-.34.36-.75.54-1.25.54h-8.89v-4.62Z"/>
            <path d="M157.08,6.29c-.29-.67-.67-1.26-1.15-1.76-.48-.5-1.04-.91-1.68-1.19-.65-.29-1.34-.44-2.05-.44h-12.46v18.68h3.57v-5h8.89c.75,0,1.46-.16,2.12-.47.64-.31,1.21-.72,1.69-1.23.47-.51.85-1.1,1.12-1.77.27-.67.41-1.38.41-2.13v-2.51c-.02-.77-.17-1.51-.46-2.18ZM143.31,6.59h8.89c.5,0,.91.18,1.25.54.35.37.52.82.52,1.36v2.5c0,.54-.17.99-.52,1.36-.34.36-.75.54-1.25.54h-8.89v-6.29Z"/>
            <path d="M163.84,3.36c-.64.31-1.21.72-1.69,1.23-.48.51-.85,1.1-1.12,1.77-.27.67-.41,1.38-.41,2.13v2.5c0,.61.09,1.21.28,1.77.18.56.44,1.08.77,1.54.33.45.72.86,1.17,1.2.21.16.43.31.66.43l-2.88,3.03v2.61h2.54l4.75-5h6.95v5h3.57V2.89h-12.46c-.75,0-1.46.16-2.12.47ZM174.85,6.59v6.29h-8.89c-.5,0-.91-.18-1.25-.54-.35-.37-.52-.81-.52-1.36v-2.5c0-.54.17-.99.52-1.36.34-.36.75-.54,1.25-.54h8.89Z"/>
            <polygon points="196.21,10.39 185.55,10.39 185.55,2.89 181.97,2.89 181.97,21.58 185.55,21.58 185.55,14.08 196.21,14.08 196.21,21.58 199.78,21.58 199.78,2.89 196.21,2.89"/>
            <path d="M220.91,9.09v-.61c-.03-.77-.19-1.51-.48-2.18-.29-.67-.67-1.26-1.15-1.76-.48-.5-1.04-.91-1.68-1.19-.65-.29-1.33-.44-2.05-.44h-7.13c-.75.02-1.46.19-2.11.5-.64.3-1.21.71-1.68,1.22-.48.5-.86,1.09-1.13,1.76-.27.67-.41,1.38-.41,2.13v7.49c0,.78.14,1.51.43,2.19.28.67.67,1.27,1.15,1.77.49.5,1.06.9,1.71,1.19.65.29,1.34.44,2.06.44h7.12c.75,0,1.46-.16,2.12-.47.65-.31,1.21-.72,1.69-1.23.47-.51.85-1.1,1.13-1.77.27-.67.41-1.38.41-2.13v-.6h-3.57v.6c0,.54-.17.99-.52,1.36-.34.36-.75.54-1.25.54h-7.12c-.5,0-.91-.18-1.25-.54-.35-.37-.52-.81-.52-1.36v-7.49c0-.54.17-.99.52-1.36.34-.36.75-.54,1.25-.54h7.12c.5,0,.91.18,1.25.54.35.37.52.82.52,1.36v.6h3.58Z"/>
            <polygon points="237.58,2.89 230.46,10.39 227.54,10.39 227.54,2.89 223.97,2.89 223.97,21.58 227.54,21.58 227.54,14.08 230.46,14.08 237.58,21.58 242.58,21.58 233.7,12.24 242.58,2.89"/>
            <path d="M265.46,4.53c-.48-.5-1.04-.9-1.68-1.19-.65-.29-1.33-.44-2.05-.44h-7.12c-.75,0-1.46.16-2.12.47-.64.31-1.21.72-1.69,1.23-.48.51-.85,1.11-1.12,1.77-.27.67-.41,1.38-.41,2.13v13.09h3.57v-5h10.66v5h3.57v-13.1c-.02-.77-.17-1.51-.46-2.18-.29-.67-.67-1.26-1.15-1.76ZM263.5,8.49v4.4h-10.66v-4.4c0-.55.17-.99.52-1.36.34-.36.75-.54,1.25-.54h7.12c.5,0,.91.18,1.25.54.35.37.52.82.52,1.36Z"/>
            <path d="M287.98,6.29c-.29-.67-.68-1.26-1.16-1.77-.49-.5-1.06-.9-1.7-1.19-.65-.29-1.34-.44-2.04-.44h-12.46v18.68h12.48c.75-.02,1.45-.19,2.11-.5.64-.3,1.21-.71,1.68-1.21.48-.5.85-1.09,1.13-1.74.28-.66.41-1.38.41-2.14,0-1.45-.46-2.71-1.38-3.75.91-1.04,1.38-2.29,1.38-3.75,0-.78-.15-1.52-.44-2.2ZM274.19,14.08h8.89c.5,0,.91.18,1.25.54.35.37.52.82.52,1.36s-.17.99-.52,1.36c-.34.36-.75.54-1.25.54h-8.89v-3.8ZM283.08,10.39h-8.89v-3.8h8.89c.5,0,.91.18,1.25.54.35.37.52.82.52,1.36s-.17.99-.52,1.36c-.34.36-.75.54-1.25.54Z"/>
            <polygon points="290.07,6.59 297.19,6.59 297.19,21.58 300.76,21.58 300.76,6.59 307.88,6.59 307.88,2.89 290.07,2.89"/>
            <path d="M326.9,6.32c-.29-.67-.68-1.26-1.17-1.77-.48-.5-1.05-.9-1.68-1.2-.65-.3-1.34-.46-2.06-.46h-7.12c-.73,0-1.44.15-2.09.46-.64.3-1.21.7-1.69,1.21-.47.5-.86,1.1-1.14,1.77-.28.68-.43,1.41-.43,2.17v7.49c0,.78.14,1.51.41,2.18.27.67.65,1.27,1.13,1.78.48.5,1.05.91,1.7,1.2.65.29,1.36.44,2.11.44h7.12c.73,0,1.43-.15,2.09-.45.64-.3,1.21-.7,1.69-1.21.48-.5.86-1.1,1.14-1.77.28-.68.43-1.41.43-2.17v-7.49c0-.76-.15-1.49-.44-2.17ZM323.77,8.49v7.49c0,.54-.17.99-.52,1.36-.34.36-.75.54-1.25.54h-7.12c-.5,0-.91-.18-1.25-.54-.35-.37-.52-.81-.52-1.36v-7.49c0-.55.17-.99.52-1.36.34-.36.75-.54,1.25-.54h7.12c.5,0,.91.18,1.25.54.35.37.52.82.52,1.36Z"/>
          </g>
          <rect x="72.33" y="28.3" width="254.87" height=".91" fill="url(#logoGrad)"/>
          <defs>
            <linearGradient id="logoGrad" x1="72.33" y1="28.75" x2="327.2" y2="28.75" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#0070b8"/>
              <stop offset="1" stopColor="#87b63c"/>
            </linearGradient>
          </defs>
        </g>

        {/* ТЕРРИТОРИЯ АВТОМОБИЛЕЙ */}
        <text
          x={720} y={416}
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fontFamily="Inter, Arial, sans-serif"
          fill="rgba(255,255,255,0.75)"
          letterSpacing="3.5"
        >ТЕРРИТОРИЯ АВТОМОБИЛЕЙ</text>

        {/* Stats row */}
        <g fontFamily="Inter, Arial, sans-serif" textAnchor="middle">
          {/* 15 лет */}
          <text x={580} y={442} fontSize="20" fontWeight="700" fill="white">15</text>
          <text x={580} y={456} fontSize="8.5" fill="rgba(255,255,255,0.6)" letterSpacing="0.5">ЛЕТ ОПЫТА</text>
          {/* 10 брендов */}
          <text x={658} y={442} fontSize="20" fontWeight="700" fill="white">10</text>
          <text x={658} y={456} fontSize="8.5" fill="rgba(255,255,255,0.6)" letterSpacing="0.5">БРЕНДОВ</text>
          {/* 4 комплекса */}
          <text x={783} y={442} fontSize="20" fontWeight="700" fill="white">4</text>
          <text x={783} y={456} fontSize="8.5" fill="rgba(255,255,255,0.6)" letterSpacing="0.5">КОМПЛЕКСА</text>
          {/* 10 000+ */}
          <text x={866} y={442} fontSize="20" fontWeight="700" fill="white">10K+</text>
          <text x={866} y={456} fontSize="8.5" fill="rgba(255,255,255,0.6)" letterSpacing="0.5">КЛИЕНТОВ</text>
        </g>

        {/* Separator lines */}
        <line x1="619" y1="435" x2="619" y2="459" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
        <line x1="720" y1="435" x2="720" y2="459" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
        <line x1="823" y1="435" x2="823" y2="459" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
      </svg>

      <style>{`
        .complex { cursor: pointer; }
        .b-liteynaya,
        .b-sovetskaya,
        .b-suponevo,
        .b-moskovskiy { transition: filter 0.25s ease; }

        #liteynaya:hover .b-liteynaya { filter: brightness(1.18) drop-shadow(0 0 10px rgba(200,40,46,0.4)); }
        #sovetskaya:hover .b-sovetskaya { filter: brightness(1.18) drop-shadow(0 0 10px rgba(30,74,140,0.4)); }
        #suponevo:hover .b-suponevo { filter: brightness(1.18) drop-shadow(0 0 10px rgba(36,132,58,0.4)); }
        #moskovskiy:hover .b-moskovskiy { filter: brightness(1.18) drop-shadow(0 0 10px rgba(212,92,10,0.4)); }

        .complex-tooltip { opacity: 0; transition: opacity 0.2s ease; pointer-events: none; }
        .complex:hover .complex-tooltip { opacity: 1; }
      `}</style>
    </div>
  );
}
