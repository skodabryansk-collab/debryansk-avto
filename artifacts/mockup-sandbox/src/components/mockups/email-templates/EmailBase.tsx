import React from "react";

export const BLUE = "#0070b8";
export const DARK = "#1a2332";

/* ── Inline logo (logo-white.svg) ── */
export function LogoSvg() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 327.34 54.48" width="180" height="30" style={{ display: "block" }}>
      <defs>
        <linearGradient id="eg" x1="72.33" y1="28.75" x2="327.2" y2="28.75" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0070b8"/>
          <stop offset="1" stopColor="#87b63c"/>
        </linearGradient>
      </defs>
      <path d="M54.46,26.33C53.96,11.29,41.36-.49,26.33.02,11.29.52-.49,13.12.02,28.15c.15,4.46,1.36,8.63,3.39,12.28l4.49-7.06c-.55-1.73-.87-3.56-.94-5.46-.38-11.2,8.4-20.58,19.6-20.96,11.2-.38,20.58,8.4,20.96,19.6.38,11.2-8.4,20.58-19.6,20.96-2.24.08-4.4-.23-6.43-.83l.09-.09,10.68-29.09-1.21.04s-19.3,30.23-19.56,31.09c0,0,1.04,1.09,2.05,1.85,1.04.78,2.38,1.54,2.38,1.54,3.72,1.7,7.87,2.59,12.24,2.44,15.04-.5,26.81-13.1,26.31-28.14Z" fill="#fff"/>
      <g fill="#fff">
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
      <rect x="72.33" y="28.3" width="254.87" height=".91" fill="url(#eg)"/>
    </svg>
  );
}

/* ── Shared layout ── */
export function EmailLayout({
  children,
  accent = BLUE,
  timestamp = "08.06.2026, 14:32",
}: {
  children: React.ReactNode;
  accent?: string;
  timestamp?: string;
}) {
  return (
    <div style={{ background: "#e8eef4", minHeight: "100vh", padding: "28px 16px", fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", borderRadius: 12, overflow: "hidden", boxShadow: "0 6px 32px rgba(0,0,0,0.13)" }}>

        {/* ── HEADER ── */}
        <div style={{ background: `linear-gradient(135deg, ${DARK} 0%, #253447 100%)`, padding: "20px 28px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <LogoSvg />
            <div style={{ background: accent, color: "#fff", fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 20, letterSpacing: 0.5, textTransform: "uppercase" as const, flexShrink: 0, marginLeft: 12 }}>
              Новая заявка
            </div>
          </div>
          <div style={{ color: "#546e8a", fontSize: 10, marginTop: 8, letterSpacing: 0.2 }}>
            debryansk-auto.ru · sales@debryansk-auto.ru · +7 (4832) 000-000
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ background: "#fff" }}>
          {children}
        </div>

        {/* ── FOOTER ── */}
        <div style={{ background: "#f2f5f8", borderTop: "1px solid #dde3ea", padding: "14px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 6 }}>
            <span style={{ color: "#8fa8c0", fontSize: 11 }}>
              Дебрянск Авто · ул. Советская 77, Брянск · +7 (4832) 000-000
            </span>
            <span style={{ color: "#8fa8c0", fontSize: 11 }}>{timestamp}</span>
          </div>
          <div style={{ marginTop: 5, color: "#b0bec5", fontSize: 10 }}>
            Это автоматическое уведомление. Все данные заявки содержатся в этом письме.
          </div>
        </div>
      </div>

      {/* Email meta */}
      <div style={{ maxWidth: 600, margin: "10px auto 0", display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#94a3b8", fontSize: 10 }}>Кому: sales@debryansk-auto.ru</span>
        <span style={{ color: "#94a3b8", fontSize: 10 }}>debryansk-auto.ru</span>
      </div>
    </div>
  );
}

/* ── Reusable blocks ── */
export function Banner({ color, label, icon }: { color: string; label: string; icon: string }) {
  return (
    <div style={{ background: `${color}12`, borderLeft: `4px solid ${color}`, margin: "20px 28px 0", padding: "10px 16px", borderRadius: "0 8px 8px 0", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 19 }}>{icon}</span>
      <span style={{ color, fontWeight: 700, fontSize: 14 }}>{label}</span>
    </div>
  );
}

export function Heading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ padding: "14px 28px 0" }}>
      <div style={{ fontWeight: 800, fontSize: 16, color: DARK }}>{title}</div>
      {sub && <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export function DataTable({ rows }: { rows: [string, string | undefined][] }) {
  const visible = rows.filter(([, v]) => v) as [string, string][];
  return (
    <table cellPadding={0} cellSpacing={0} style={{ width: "calc(100% - 56px)", margin: "14px 28px 0", borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
      <tbody>
        {visible.map(([l, v], i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
            <td style={{ padding: "9px 13px", color: "#64748b", fontSize: 11, fontWeight: 600, width: "37%", borderRight: "1px solid #e2e8f0", verticalAlign: "top" }}>{l}</td>
            <td style={{ padding: "9px 13px", color: DARK, fontSize: 13 }}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CarCard({ mark, model, year, price, dealer }: { mark: string; model: string; year: number; price: number; dealer?: string }) {
  return (
    <div style={{ margin: "14px 28px 0", background: "linear-gradient(135deg,#f0f7ff,#e8f3fc)", border: `1px solid ${BLUE}22`, borderRadius: 10, padding: "13px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, background: BLUE, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>🚗</div>
      <div>
        <div style={{ fontWeight: 800, color: DARK, fontSize: 15 }}>{mark} {model}</div>
        <div style={{ color: "#64748b", fontSize: 12, marginTop: 1 }}>{year} · {dealer || mark} · {price.toLocaleString("ru-RU")} ₽</div>
      </div>
    </div>
  );
}

export function VacancyCard({ title, dept, dealer, salary }: { title: string; dept: string; dealer: string; salary: string }) {
  return (
    <div style={{ margin: "14px 28px 0", background: "linear-gradient(135deg,#faf5ff,#f3e8ff)", border: "1px solid #c4b5fd", borderRadius: 10, padding: "13px 16px" }}>
      <div style={{ fontWeight: 800, color: "#4c1d95", fontSize: 14 }}>{title}</div>
      <div style={{ color: "#6d28d9", fontSize: 12, marginTop: 2 }}>{dept} · {dealer} · {salary}</div>
    </div>
  );
}

export function MsgBox({ text }: { text: string }) {
  return (
    <div style={{ margin: "14px 28px 0", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "13px 15px" }}>
      <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 5 }}>Текст сообщения</div>
      <div style={{ color: DARK, fontSize: 13, lineHeight: 1.65 }}>{text}</div>
    </div>
  );
}

export function AttachmentSection({ files }: { files: { name: string; size: string; type: string }[] }) {
  return (
    <div style={{ margin: "14px 28px 0" }}>
      <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 8 }}>
        📎 Прикреплённые файлы ({files.length})
      </div>
      {files.map((f, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "#f8fafc", border: "1px solid #e2e8f0",
          borderRadius: 8, padding: "10px 14px",
          marginBottom: i < files.length - 1 ? 6 : 0,
        }}>
          <div style={{ width: 34, height: 34, background: "#ef4444", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>
            {f.type}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: DARK, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{f.name}</div>
            <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 1 }}>{f.size}</div>
          </div>
          <div style={{ color: "#94a3b8", fontSize: 10, flexShrink: 0 }}>вложение</div>
        </div>
      ))}
    </div>
  );
}

export function Tip({ text }: { text: string }) {
  return <div style={{ margin: "12px 28px 0", background: "#f0fdf4", borderRadius: 8, padding: "9px 13px", fontSize: 12, color: "#166534" }}>{text}</div>;
}

export function Hr() {
  return <div style={{ height: 1, background: "#e8edf2", margin: "18px 28px 0" }} />;
}

/* Action block — shows phone / email prominently, no CRM */
export function ActionBlock({
  phone,
  email,
  label = "Связаться с клиентом",
  accent = BLUE,
}: {
  phone?: string;
  email?: string;
  label?: string;
  accent?: string;
}) {
  return (
    <div style={{ margin: "18px 28px 24px", background: `${accent}0d`, border: `1px solid ${accent}25`, borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 12 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 10 }}>
        {phone && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: accent, color: "#fff", padding: "10px 18px", borderRadius: 9, fontWeight: 700, fontSize: 14 }}>
            <span>📞</span>
            <span>{phone}</span>
          </div>
        )}
        {email && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", color: accent, border: `1.5px solid ${accent}`, padding: "10px 18px", borderRadius: 9, fontWeight: 700, fontSize: 13 }}>
            <span>✉️</span>
            <span>{email}</span>
          </div>
        )}
      </div>
    </div>
  );
}
