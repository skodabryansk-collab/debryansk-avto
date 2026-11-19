import "./_group.css";

const logo = "/__mockup/images/business-cards/debryansk-auto-space-logo.png";
const contactVCard = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "FN:Артем Коновалов",
  "TITLE:Менеджер по продажам автомобилей",
  "TEL:+79206072857",
  "EMAIL:artem.konovalov@debryansk-auto.ru",
  "ADR:Шоссейная 12Г, Супонево",
  "END:VCARD",
].join("\r\n");

function makeContactQr(value: string) {
  const version = 10;
  const size = version * 4 + 17;
  const dataCapacity = 274;
  const eccLength = 18;
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => {
    if (x >= 0 && y >= 0 && x < size && y < size) {
      modules[y][x] = dark;
      reserved[y][x] = true;
    }
  };
  const bytes = Array.from(new TextEncoder().encode(value));
  const bits: number[] = [];
  const appendBits = (number: number, count: number) => {
    for (let i = count - 1; i >= 0; i -= 1) bits.push((number >>> i) & 1);
  };
  appendBits(0b0100, 4);
  appendBits(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((byte) => appendBits(byte, 8));
  for (let i = 0; i < Math.min(4, dataCapacity * 8 - bits.length); i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
  }
  for (let pad = 0; data.length < dataCapacity; pad += 1) data.push(pad % 2 === 0 ? 0xec : 0x11);

  const multiply = (left: number, right: number) => {
    let result = 0;
    for (let i = 7; i >= 0; i -= 1) {
      result = (result << 1) ^ ((result >>> 7) * 0x11d);
      result ^= ((right >>> i) & 1) * left;
    }
    return result;
  };
  const generator = [1];
  let root = 1;
  for (let i = 0; i < eccLength; i += 1) {
    const next = Array(generator.length + 1).fill(0);
    generator.forEach((coefficient, index) => {
      next[index] ^= coefficient;
      next[index + 1] ^= multiply(coefficient, root);
    });
    generator.splice(0, generator.length, ...next);
    root = multiply(root, 2);
  }
  const remainderFor = (block: number[]) => {
    const remainder = [...block, ...Array(eccLength).fill(0)];
    for (let i = 0; i < block.length; i += 1) {
      const factor = remainder[i];
      if (factor !== 0) {
        generator.forEach((coefficient, index) => {
          remainder[i + index] ^= multiply(coefficient, factor);
        });
      }
    }
    return remainder.slice(block.length);
  };
  const blocks = [
    data.slice(0, 68),
    data.slice(68, 136),
    data.slice(136, 205),
    data.slice(205, 274),
  ];
  const eccBlocks = blocks.map(remainderFor);
  const codewords: number[] = [];
  for (let i = 0; i < 69; i += 1) blocks.forEach((block) => {
    if (i < block.length) codewords.push(block[i]);
  });
  for (let i = 0; i < eccLength; i += 1) eccBlocks.forEach((block) => codewords.push(block[i]));

  const finder = (originX: number, originY: number) => {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) {
        const edge = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
        const dark = edge && Math.max(Math.abs(dx - 3), Math.abs(dy - 3)) !== 2;
        set(originX + dx, originY + dy, dark);
      }
    }
  };
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);

  for (let i = 8; i < size - 8; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const alignmentCenters = [6, 28, 50];
  alignmentCenters.forEach((centerY) => {
    alignmentCenters.forEach((centerX) => {
      if (reserved[centerY][centerX]) return;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          set(centerX + dx, centerY + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    });
  });

  const versionBits = (version << 12) | (() => {
    let remainder = version << 12;
    for (let bit = 17; bit >= 12; bit -= 1) {
      if (((remainder >>> bit) & 1) !== 0) remainder ^= 0x1f25 << (bit - 12);
    }
    return remainder & 0xfff;
  })();
  for (let i = 0; i < 18; i += 1) {
    const dark = ((versionBits >>> i) & 1) !== 0;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    set(a, b, dark);
    set(b, a, dark);
  }

  const formatData = (0b01 << 3) | 0;
  let formatRemainder = formatData << 10;
  for (let i = 0; i < 10; i += 1) {
    if (((formatRemainder >>> (14 - i)) & 1) !== 0) formatRemainder ^= 0x537 << (9 - i);
  }
  const formatBits = ((formatData << 10) | (formatRemainder & 0x3ff)) ^ 0x5412;
  const firstFormat = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  const secondFormat = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8],
    [size - 6, 8], [size - 7, 8], [size - 8, 8], [8, size - 7], [8, size - 6],
    [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1],
  ];
  firstFormat.forEach(([x, y], i) => set(x, y, ((formatBits >>> i) & 1) !== 0));
  secondFormat.forEach(([x, y], i) => set(x, y, ((formatBits >>> i) & 1) !== 0));
  set(8, size - 8, true);

  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let step = 0; step < size; step += 1) {
      const y = upward ? size - 1 - step : step;
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        if (reserved[y][x]) continue;
        const valueBit = bitIndex < codewords.length * 8
          ? (codewords[Math.floor(bitIndex / 8)] >>> (7 - (bitIndex % 8))) & 1
          : 0;
        modules[y][x] = (valueBit === 1) !== ((x + y) % 2 === 0);
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
  const path = modules.flatMap((row, y) =>
    row.flatMap((dark, x) => (dark ? [`M${x + 4} ${y + 4}h1v1h-1z`] : [])),
  ).join("");
  return { path, viewBox: `0 0 ${size + 8} ${size + 8}` };
}

export function ContactOneSide() {
  const qr = makeContactQr(contactVCard);

  return (
    <main className="bc-showcase bc-one-showcase">
      <header className="bc-showcase-head">
        <div>
          <p className="bc-showcase-kicker">Визитка сотрудника</p>
          <h1 className="bc-showcase-title">Контактная · односторонняя</h1>
        </div>
        <p className="bc-showcase-size">90 × 50 мм · одна сторона</p>
      </header>

      <section className="bc-one-wrap" aria-label="Односторонняя визитка">
        <p className="bc-side-label">Лицевая сторона</p>
        <article className="bc-card bc-one-card" aria-label="Визитка Артема Коновалова">
          <div className="bc-one-accent" aria-hidden="true" />
          <div className="bc-one-identity">
            <img className="bc-one-logo" src={logo} alt="Дебрянск Авто — Пространство автомобилей" />
            <div className="bc-one-person">
              <h2>Коновалов Артем</h2>
              <p>Менеджер по продажам автомобилей</p>
            </div>
            <div className="bc-one-divider" aria-hidden="true" />
            <div className="bc-one-contacts">
              <div className="bc-one-contact">
                <span className="bc-contact-label">Телефон</span>
                <span className="bc-one-value bc-one-phone">8 920 607 28 57</span>
              </div>
              <div className="bc-one-contact">
                <span className="bc-contact-label">Электронная почта</span>
                <span className="bc-one-value bc-one-email">artem.konovalov@debryansk-auto.ru</span>
              </div>
              <div className="bc-one-contact bc-one-address">
                <span className="bc-contact-label">Адрес</span>
                <span className="bc-one-value">с. Супонево, ул. Шоссейная, 12Г</span>
              </div>
            </div>
          </div>
          <aside className="bc-one-qr-wrap">
            <svg className="bc-one-qr" viewBox={qr.viewBox} role="img" aria-label="QR-код контактной карточки">
              <rect width="100%" height="100%" fill="#fff" />
              <path d={qr.path} fill="#111317" />
            </svg>
            <span>Сохранить контакт</span>
          </aside>
          <div className="bc-one-footer">ДЕБРЯНСК АВТО</div>
        </article>
      </section>

      <style>{`
        .bc-one-showcase { min-height: 100vh; }
        .bc-one-wrap { width: min(100%, 900px); margin: 0 auto; }
        .bc-one-card {
          display: flex;
          align-items: stretch;
          gap: 4%;
          padding: 5.6% 5.4%;
          background: #fff;
          color: var(--debryansk-ink);
        }
        .bc-one-accent {
          position: absolute;
          inset: 0 auto 0 0;
          width: 4px;
          background: var(--debryansk-gradient);
        }
        .bc-one-identity {
          display: flex;
          min-width: 0;
          flex: 1;
          flex-direction: column;
          align-items: flex-start;
        }
        .bc-one-logo {
          display: block;
          width: 34%;
          height: auto;
          max-height: 34px;
          object-fit: contain;
          object-position: left center;
        }
        .bc-one-person { margin-top: 12%; }
        .bc-one-person h2 {
          margin: 0;
          font-size: 23px;
          font-weight: 800;
          letter-spacing: -.045em;
          line-height: 1;
          white-space: nowrap;
        }
        .bc-one-person p {
          margin: 5px 0 0;
          color: var(--debryansk-muted);
          font-size: 10px;
          font-weight: 600;
          line-height: 1.15;
          white-space: nowrap;
        }
        .bc-one-divider {
          width: 100%;
          height: 1px;
          margin: 9px 0 8px;
          background: var(--debryansk-border);
        }
        .bc-one-contacts {
          display: grid;
          width: 100%;
          grid-template-columns: 1fr;
          gap: 5px;
        }
        .bc-one-contact { min-width: 0; }
        .bc-one-contact .bc-contact-label { margin-bottom: 2px; font-size: 7px; }
        .bc-one-value {
          display: block;
          margin: 0;
          font-size: 9px;
          font-weight: 700;
          line-height: 1.1;
          white-space: nowrap;
        }
        .bc-one-phone { font-size: 12px; font-weight: 800; letter-spacing: -.02em; }
        .bc-one-email { font-size: 8px; letter-spacing: -.025em; }
        .bc-one-qr-wrap {
          display: flex;
          width: 25%;
          flex: 0 0 25%;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          align-self: center;
          gap: 5px;
          padding: 5px;
          border: 1px solid var(--debryansk-border);
          border-radius: 6px;
          background: #fff;
        }
        .bc-one-qr { display: block; width: 100%; height: auto; }
        .bc-one-qr-wrap span {
          color: var(--debryansk-muted);
          font-size: 7px;
          font-weight: 700;
          line-height: 1;
          text-align: center;
          white-space: nowrap;
        }
        .bc-one-footer {
          position: absolute;
          right: 5.4%;
          bottom: 5.7%;
          color: var(--debryansk-muted);
          font-size: 6px;
          font-weight: 800;
          letter-spacing: .1em;
          line-height: 1;
        }
        @media (max-width: 520px) {
          .bc-one-card { gap: 3%; padding: 5.2% 4.8%; }
          .bc-one-person h2 { font-size: 19px; }
          .bc-one-person p { font-size: 8px; }
          .bc-one-contact .bc-contact-label { font-size: 6px; }
          .bc-one-value { font-size: 8px; }
          .bc-one-phone { font-size: 10px; }
          .bc-one-email { font-size: 6.5px; }
          .bc-one-qr-wrap { width: 26%; flex-basis: 26%; padding: 3px; }
          .bc-one-qr-wrap span { font-size: 5px; }
        }
        @media print {
          .bc-one-showcase { min-height: auto; padding: 0; background: #fff; }
          .bc-one-showcase .bc-showcase-head,
          .bc-one-showcase .bc-side-label { display: none; }
          .bc-one-wrap { width: 90mm; }
          .bc-one-card {
            width: 90mm;
            height: 50mm;
            aspect-ratio: auto;
            border: 0;
            border-radius: 0;
            box-shadow: none;
          }
        }
      `}</style>
    </main>
  );
}
