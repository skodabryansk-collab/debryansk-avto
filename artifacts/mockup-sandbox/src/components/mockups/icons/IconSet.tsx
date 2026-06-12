import React, { useState } from "react";

const BLUE = "#0070b8";
const GREEN = "#87b63c";

type IconColor = "blue" | "green";

function Ico({
  children,
  color = "blue",
  size = 24,
}: {
  children: React.ReactNode;
  color?: IconColor;
  size?: number;
}) {
  const stroke = color === "green" ? GREEN : BLUE;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/* ─── NAVIGATION (8) ─────────────────────────────────────── */

export const IcoMenu = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></Ico>
);

export const IcoSearch = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}><circle cx="10.5" cy="10.5" r="6.5"/><line x1="15.5" y1="15.5" x2="21" y2="21"/></Ico>
);

export const IcoFilters = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}>
    <line x1="3" y1="7" x2="6.5" y2="7"/><circle cx="8.5" cy="7" r="2"/><line x1="10.5" y1="7" x2="21" y2="7"/>
    <line x1="3" y1="12" x2="14.5" y2="12"/><circle cx="16.5" cy="12" r="2"/><line x1="18.5" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="17" x2="10.5" y2="17"/><circle cx="12.5" cy="17" r="2"/><line x1="14.5" y1="17" x2="21" y2="17"/>
  </Ico>
);

export const IcoHome = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}><path d="M3 10.5L12 3L21 10.5V21H15V15H9V21H3V10.5Z"/></Ico>
);

export const IcoGrid = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}>
    <rect x="3" y="3" width="8" height="8" rx="1.5"/>
    <rect x="13" y="3" width="8" height="8" rx="1.5"/>
    <rect x="3" y="13" width="8" height="8" rx="1.5"/>
    <rect x="13" y="13" width="8" height="8" rx="1.5"/>
  </Ico>
);

export const IcoHeart = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></Ico>
);

export const IcoPhone = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.69h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.1a16 16 0 0 0 6.12 6.12l1.47-1.47a2 2 0 0 1 2.11-.45c.907.34 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></Ico>
);

export const IcoClose = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Ico>
);

/* ─── CAR CHARACTERISTICS (12) ───────────────────────────── */

export const IcoEngine = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}>
    <rect x="3" y="8" width="18" height="9" rx="1.5"/>
    <circle cx="8" cy="12.5" r="2"/>
    <circle cx="12" cy="12.5" r="2"/>
    <circle cx="16" cy="12.5" r="2"/>
    <path d="M8 8V5m4 3V5m4 3V5"/>
    <line x1="3" y1="11" x2="1" y2="11"/>
    <line x1="21" y1="11" x2="23" y2="11"/>
  </Ico>
);

export const IcoHorsepower = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></Ico>
);

export const IcoGearbox = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}>
    <circle cx="7" cy="5" r="2"/>
    <circle cx="17" cy="5" r="2"/>
    <circle cx="7" cy="12" r="2"/>
    <circle cx="17" cy="12" r="2"/>
    <line x1="7" y1="7" x2="7" y2="10"/>
    <line x1="17" y1="7" x2="17" y2="10"/>
    <line x1="7" y1="5" x2="17" y2="5"/>
    <line x1="7" y1="12" x2="17" y2="12"/>
    <line x1="12" y1="8.5" x2="12" y2="20"/>
    <circle cx="12" cy="21" r="1.5"/>
  </Ico>
);

export const IcoDriveType = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}>
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>
    <path d="M5.64 5.64l2.83 2.83M15.54 15.54l2.83 2.83M18.36 5.64l-2.83 2.83M8.46 15.54l-2.83 2.83"/>
  </Ico>
);

export const IcoOdometer = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}>
    <path d="M5.5 17.5A7 7 0 0 1 18.5 17.5"/>
    <line x1="12" y1="5" x2="12" y2="8"/>
    <line x1="5.5" y1="8" x2="7" y2="9.5"/>
    <line x1="18.5" y1="8" x2="17" y2="9.5"/>
    <line x1="3" y1="17.5" x2="5.5" y2="17.5"/>
    <line x1="18.5" y1="17.5" x2="21" y2="17.5"/>
    <line x1="12" y1="17.5" x2="15.8" y2="11.5" strokeWidth="1.5"/>
    <circle cx="12" cy="17.5" r="1.5" fill={BLUE} stroke={BLUE}/>
  </Ico>
);

export const IcoCalendar = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}>
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
    <rect x="7" y="14" width="2" height="2"/>
    <rect x="11" y="14" width="2" height="2"/>
    <rect x="15" y="14" width="2" height="2"/>
  </Ico>
);

export const IcoFuelPump = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}>
    <path d="M4 20V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15"/>
    <line x1="3" y1="20" x2="14" y2="20"/>
    <path d="M14 9h2.5a1.5 1.5 0 0 1 1.5 1.5v3l1 2v3.5a1 1 0 0 1-2 0V16l-1-2V10.5"/>
    <line x1="7" y1="8" x2="11" y2="8"/>
    <line x1="7" y1="11" x2="11" y2="11"/>
  </Ico>
);

export const IcoSedan = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}>
    <path d="M2 15l2-5h16l2 5H2z"/>
    <path d="M7 10l2-4h6l2 4"/>
    <rect x="2" y="15" width="20" height="3" rx="1"/>
    <circle cx="6.5" cy="18" r="2"/>
    <circle cx="17.5" cy="18" r="2"/>
    <line x1="8.5" y1="18" x2="15.5" y2="18"/>
  </Ico>
);

export const IcoSuv = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}>
    <path d="M4 15V8a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v7"/>
    <path d="M7 7V5h10v2"/>
    <rect x="2" y="15" width="20" height="3" rx="1"/>
    <circle cx="6.5" cy="18" r="2"/>
    <circle cx="17.5" cy="18" r="2"/>
    <line x1="8.5" y1="18" x2="15.5" y2="18"/>
  </Ico>
);

export const IcoSeats = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}>
    <path d="M6 4h4a1 1 0 0 1 1 1v6H6V5a1 1 0 0 1 0 0z"/>
    <rect x="5" y="11" width="7" height="4" rx="1"/>
    <path d="M6 15v4"/>
    <path d="M10 15v4"/>
    <path d="M5 19h6"/>
    <circle cx="17" cy="7" r="3"/>
    <path d="M14 10v4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-4"/>
  </Ico>
);

export const IcoDoors = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}>
    <rect x="4" y="3" width="16" height="18" rx="2"/>
    <path d="M14.5 12.5h2v2h-2"/>
    <rect x="6" y="5" width="12" height="7" rx="1"/>
    <line x1="12" y1="14" x2="12" y2="20"/>
  </Ico>
);

export const IcoColorPalette = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}>
    <path d="M12 2C6.48 2 2 6.48 2 12c0 5.52 4.48 10 10 10 1.1 0 2-.9 2-2 0-.5-.2-1-.49-1.39-.3-.4-.51-.86-.51-1.36 0-1.1.9-2 2-2h2.36A5.62 5.62 0 0 0 22 9.62C22 5.4 17.52 2 12 2z"/>
    <circle cx="8" cy="9" r="1.5" fill={BLUE} stroke={BLUE}/>
    <circle cx="12" cy="7" r="1.5" fill={BLUE} stroke={BLUE}/>
    <circle cx="16" cy="9" r="1.5" fill={BLUE} stroke={BLUE}/>
    <circle cx="15" cy="13" r="1.5" fill={BLUE} stroke={BLUE}/>
  </Ico>
);

/* ─── DEALER SERVICES (8) ────────────────────────────────── */

export const IcoSteeringWheel = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}>
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="3"/>
    <line x1="12" y1="9" x2="12" y2="2"/>
    <line x1="14.6" y1="13.5" x2="21.2" y2="17.3"/>
    <line x1="9.4" y1="13.5" x2="2.8" y2="17.3"/>
  </Ico>
);

export const IcoCreditCard = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}>
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <line x1="2" y1="10" x2="22" y2="10"/>
    <circle cx="14.5" cy="14" r="1.2"/>
    <circle cx="17.5" cy="14" r="1.2"/>
    <line x1="15.5" y1="12.5" x2="16.5" y2="15.5"/>
    <line x1="6" y1="14" x2="10" y2="14"/>
  </Ico>
);

export const IcoTradeIn = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}>
    <path d="M5 8H16"/>
    <path d="M13 5l3 3-3 3"/>
    <path d="M19 16H8"/>
    <path d="M11 13l-3 3 3 3"/>
  </Ico>
);

export const IcoWrench = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></Ico>
);

export const IcoShieldCheck = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </Ico>
);

export const IcoCertificate = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="13" x2="15" y2="13"/>
    <line x1="9" y1="16.5" x2="13" y2="16.5"/>
    <circle cx="16" cy="17" r="2.5"/>
    <path d="M14.2 19.4l-1 2.1 1.8-1 1.8 1-1-2.1"/>
  </Ico>
);

export const IcoKey = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></Ico>
);

export const IcoCarClock = ({ size = 24 }: { size?: number }) => (
  <Ico size={size}>
    <path d="M2 15l2-5h12"/>
    <path d="M2 15v2a1 1 0 0 0 1 1h1.5"/>
    <circle cx="6.5" cy="18" r="2"/>
    <line x1="8.5" y1="18" x2="11" y2="18"/>
    <circle cx="18" cy="14" r="5"/>
    <polyline points="18 11 18 14 20 15"/>
  </Ico>
);

/* ─── USP / ADVANTAGES (6) ───────────────────────────────── */

export const IcoBadge = ({ size = 24 }: { size?: number }) => (
  <Ico color="green" size={size}>
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 7l1.55 3.14 3.45.5-2.5 2.44.59 3.44L12 15l-3.09 1.52.59-3.44-2.5-2.44 3.45-.5z"/>
  </Ico>
);

export const IcoTrophy = ({ size = 24 }: { size?: number }) => (
  <Ico color="green" size={size}>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
    <path d="M6 4h12"/>
    <path d="M6 4v7a6 6 0 0 0 12 0V4"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
  </Ico>
);

export const IcoLocation = ({ size = 24 }: { size?: number }) => (
  <Ico color="green" size={size}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </Ico>
);

export const IcoThumbsUp = ({ size = 24 }: { size?: number }) => (
  <Ico color="green" size={size}><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></Ico>
);

export const IcoClock24 = ({ size = 24 }: { size?: number }) => (
  <Ico color="green" size={size}>
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
    <path d="M7 16.5h1.5l2-5h-2.5v-1h2.5"/>
    <path d="M13.5 11h2v2.5H14v.5h1.5V15h-2"/>
  </Ico>
);

export const IcoMedal = ({ size = 24 }: { size?: number }) => (
  <Ico color="green" size={size}>
    <circle cx="12" cy="9" r="6"/>
    <path d="M12 6l1.2 2.4 2.7.4-2 1.9.5 2.7L12 12.2l-2.4 1.2.5-2.7-2-1.9 2.7-.4z"/>
    <path d="M9 14.5l-2 6 5-2 5 2-2-6"/>
  </Ico>
);

/* ─── ALL ICONS DATA ─────────────────────────────────────── */

const CATEGORIES = [
  {
    title: "Навигация",
    subtitle: "Navigation",
    color: BLUE,
    icons: [
      { name: "Menu", label: "Меню", Component: IcoMenu },
      { name: "Search", label: "Поиск", Component: IcoSearch },
      { name: "Filters", label: "Фильтры", Component: IcoFilters },
      { name: "Home", label: "Главная", Component: IcoHome },
      { name: "Grid", label: "Каталог", Component: IcoGrid },
      { name: "Heart", label: "Избранное", Component: IcoHeart },
      { name: "Phone", label: "Телефон", Component: IcoPhone },
      { name: "Close", label: "Закрыть", Component: IcoClose },
    ],
  },
  {
    title: "Характеристики авто",
    subtitle: "Car Characteristics",
    color: BLUE,
    icons: [
      { name: "Engine", label: "Двигатель", Component: IcoEngine },
      { name: "Horsepower", label: "Мощность", Component: IcoHorsepower },
      { name: "Gearbox", label: "КПП", Component: IcoGearbox },
      { name: "DriveType", label: "Привод", Component: IcoDriveType },
      { name: "Odometer", label: "Пробег", Component: IcoOdometer },
      { name: "Calendar", label: "Год выпуска", Component: IcoCalendar },
      { name: "FuelPump", label: "Топливо", Component: IcoFuelPump },
      { name: "Sedan", label: "Седан", Component: IcoSedan },
      { name: "Suv", label: "Внедорожник", Component: IcoSuv },
      { name: "Seats", label: "Сиденья", Component: IcoSeats },
      { name: "Doors", label: "Двери", Component: IcoDoors },
      { name: "ColorPalette", label: "Цвет", Component: IcoColorPalette },
    ],
  },
  {
    title: "Услуги дилера",
    subtitle: "Dealer Services",
    color: BLUE,
    icons: [
      { name: "SteeringWheel", label: "Тест-драйв", Component: IcoSteeringWheel },
      { name: "CreditCard", label: "Кредит", Component: IcoCreditCard },
      { name: "TradeIn", label: "Trade-in", Component: IcoTradeIn },
      { name: "Wrench", label: "Сервис", Component: IcoWrench },
      { name: "ShieldCheck", label: "Гарантия", Component: IcoShieldCheck },
      { name: "Certificate", label: "Сертификат", Component: IcoCertificate },
      { name: "Key", label: "Выдача авто", Component: IcoKey },
      { name: "CarClock", label: "Быстрая сделка", Component: IcoCarClock },
    ],
  },
  {
    title: "Преимущества",
    subtitle: "USP / Advantages",
    color: GREEN,
    icons: [
      { name: "Badge", label: "Официальный дилер", Component: IcoBadge },
      { name: "Trophy", label: "Лучшая цена", Component: IcoTrophy },
      { name: "Location", label: "Местоположение", Component: IcoLocation },
      { name: "ThumbsUp", label: "Довольные клиенты", Component: IcoThumbsUp },
      { name: "Clock24", label: "Поддержка 24/7", Component: IcoClock24 },
      { name: "Medal", label: "Качество", Component: IcoMedal },
    ],
  },
];

const SIZE_OPTIONS = [16, 24, 32] as const;

function IconCard({ name, label, Component, accent }: {
  name: string;
  label: string;
  Component: ({ size }: { size?: number }) => React.ReactElement;
  accent: boolean;
}) {
  const [size, setSize] = useState<16 | 24 | 32>(24);
  const [copied, setCopied] = useState(false);

  const copyName = () => {
    navigator.clipboard.writeText(`Ico${name}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      onClick={copyName}
      style={{
        background: "white",
        border: "1.5px solid #e8edf3",
        borderRadius: 14,
        padding: "16px 12px 12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        transition: "box-shadow .15s, border-color .15s",
        userSelect: "none",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,112,184,.12)";
        (e.currentTarget as HTMLDivElement).style.borderColor = accent ? GREEN : BLUE;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        (e.currentTarget as HTMLDivElement).style.borderColor = "#e8edf3";
      }}
    >
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        background: accent ? `${GREEN}14` : `${BLUE}0e`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <Component size={size} />
      </div>

      <div style={{ fontSize: 11, color: "#64748b", textAlign: "center", lineHeight: 1.4 }}>{label}</div>

      <div style={{
        fontSize: 9,
        fontFamily: "monospace",
        color: copied ? (accent ? GREEN : BLUE) : "#94a3b8",
        background: "#f8fafc",
        padding: "2px 6px",
        borderRadius: 4,
        letterSpacing: 0.3,
      }}>
        {copied ? "✓ скопировано" : `Ico${name}`}
      </div>

      <div style={{ display: "flex", gap: 4 }}>
        {SIZE_OPTIONS.map(s => (
          <button
            key={s}
            onClick={e => { e.stopPropagation(); setSize(s as 16 | 24 | 32); }}
            style={{
              fontSize: 9,
              padding: "2px 5px",
              borderRadius: 4,
              border: `1px solid ${size === s ? (accent ? GREEN : BLUE) : "#e2e8f0"}`,
              background: size === s ? (accent ? `${GREEN}18` : `${BLUE}12`) : "transparent",
              color: size === s ? (accent ? GREEN : BLUE) : "#94a3b8",
              cursor: "pointer",
              fontFamily: "inherit",
              lineHeight: 1.5,
            }}
          >
            {s}px
          </button>
        ))}
      </div>
    </div>
  );
}

export default function IconSet() {
  return (
    <div style={{
      fontFamily: "Manrope, system-ui, sans-serif",
      background: "#f1f5f9",
      minHeight: "100vh",
      padding: "40px 32px 64px",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: `${BLUE}14`,
          borderRadius: 8,
          padding: "4px 12px",
          marginBottom: 12,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: BLUE }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: BLUE, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Дебрянск Авто
          </span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: "0 0 8px" }}>
          Icon Set «Территория Автомобилей»
        </h1>
        <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.6 }}>
          34 кастомных иконки · Outline style · 1.5px stroke · viewBox 0 0 24 24 · Клик на иконку копирует имя компонента
        </p>

        {/* Color swatches */}
        <div style={{ display: "flex", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
          {[
            { color: BLUE, label: "Primary #0070b8", usage: "Навигация, характеристики, услуги" },
            { color: GREEN, label: "Accent #87b63c", usage: "Преимущества, USP" },
          ].map(({ color, label, usage }) => (
            <div key={color} style={{ display: "flex", alignItems: "center", gap: 10, background: "white", borderRadius: 10, padding: "8px 14px", border: "1px solid #e8edf3" }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, background: color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{label}</div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>{usage}</div>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "white", borderRadius: 10, padding: "8px 14px", border: "1px solid #e8edf3" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[16, 24, 32].map(s => (
                <div key={s} style={{ width: s / 2, height: s / 2, background: "#0070b8", borderRadius: 2, opacity: 0.5 + s / 80 }} />
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>Размеры: 16 / 24 / 32 px</div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>Интерактивно — на каждой иконке</div>
            </div>
          </div>
        </div>
      </div>

      {/* Categories */}
      {CATEGORIES.map((cat) => (
        <section key={cat.title} style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 }}>{cat.title}</h2>
            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>{cat.subtitle}</span>
            <span style={{
              marginLeft: "auto",
              fontSize: 11,
              fontWeight: 700,
              color: "white",
              background: cat.color,
              padding: "2px 8px",
              borderRadius: 999,
            }}>
              {cat.icons.length} icons
            </span>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
            gap: 12,
          }}>
            {cat.icons.map(({ name, label, Component }) => (
              <IconCard
                key={name}
                name={name}
                label={label}
                Component={Component}
                accent={cat.color === GREEN}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Footer */}
      <div style={{
        marginTop: 48,
        padding: "20px 24px",
        background: "white",
        borderRadius: 14,
        border: "1px solid #e8edf3",
        fontSize: 12,
        color: "#64748b",
        lineHeight: 1.7,
      }}>
        <strong style={{ color: "#1e293b" }}>Спецификация:</strong> · 24×24 px viewBox · stroke-based (fill: none) · strokeWidth 1.5 · strokeLinecap round · strokeLinejoin round · Primary: <span style={{ color: BLUE }}>#0070b8</span> · Accent: <span style={{ color: GREEN }}>#87b63c</span> · Font: Manrope
        <br/>
        <strong style={{ color: "#1e293b" }}>Использование:</strong> Импортировать именованный экспорт (<code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>import {"{ IcoEngine }"} from "./icons/IconSet"</code>) и передать проп <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>size</code> (16 | 24 | 32).
      </div>
    </div>
  );
}
