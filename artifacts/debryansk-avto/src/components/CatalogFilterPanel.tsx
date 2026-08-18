import { X } from "lucide-react";

/** Общие справочники фильтров каталога (без элемента «Все …» — он задаётся страницей). */
export const BODY_TYPE_NAMES = [
  "Внедорожник 5 дв.",
  "Внедорожник 3 дв.",
  "Седан",
  "Хэтчбек 5 дв.",
  "Универсал 5 дв.",
  "Лифтбек",
  "Минивэн",
  "Пикап",
];
export const TRANSMISSIONS = ["Любая", "Робот", "Автомат", "Механика", "Вариатор"];
export const DRIVES = ["Любой", "Полный", "Передний"];

export type PillSection = {
  kind: "pills";
  label: string;
  options: string[];
  value: string;
  onSelect: (value: string) => void;
  /** Tailwind-класс фона активной пилюли; по умолчанию синий бренд-цвет. */
  activeClass?: string;
};

export type RangeSection = {
  kind: "range";
  label: string;
  min: string;
  max: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
};

export type FilterSection = PillSection | RangeSection;

interface CatalogFilterPanelProps {
  sections: FilterSection[];
  activeCount: number;
  onReset: () => void;
}

const rangeInputClass =
  "flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0070b8] focus-visible:ring-2 focus-visible:ring-[#0070b8] focus-visible:ring-offset-2 transition-colors";

/**
 * Универсальная панель фильтров каталога (новые и б/у авто).
 * Рендерится и в десктопном sidebar, и в мобильном drawer.
 */
export default function CatalogFilterPanel({ sections, activeCount, onReset }: CatalogFilterPanelProps) {
  return (
    <div className="space-y-6">
      {sections.map(section => (
        <div key={section.label}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
            {section.label}
          </div>
          {section.kind === "pills" ? (
            <div
              role="radiogroup"
              aria-label={section.label}
              className="flex flex-wrap gap-1.5"
              onKeyDown={e => {
                if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) return;
                e.preventDefault();
                const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
                const idx = section.options.indexOf(section.value);
                const next = section.options[(idx + dir + section.options.length) % section.options.length];
                section.onSelect(next);
                const group = e.currentTarget;
                requestAnimationFrame(() => {
                  const target = group.querySelector<HTMLButtonElement>('[aria-checked="true"]');
                  target?.focus();
                });
              }}
            >
              {section.options.map(option => (
                <button
                  key={option}
                  role="radio"
                  aria-checked={section.value === option}
                  tabIndex={section.value === option ? 0 : -1}
                  onClick={() => section.onSelect(option)}
                  className={`px-4 py-2.5 rounded-full text-[11px] font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0070b8] focus-visible:ring-offset-2 ${
                    section.value === option
                      ? `${section.activeClass ?? "bg-[#0070b8]"} text-white`
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={section.min}
                onChange={e => section.onMinChange(e.target.value)}
                placeholder="от"
                aria-label={`${section.label}: от`}
                className={rangeInputClass}
              />
              <span className="text-slate-300 shrink-0">—</span>
              <input
                type="number"
                value={section.max}
                onChange={e => section.onMaxChange(e.target.value)}
                placeholder="до"
                aria-label={`${section.label}: до`}
                className={rangeInputClass}
              />
            </div>
          )}
        </div>
      ))}

      {activeCount > 0 && (
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-sm font-bold text-rose-500 hover:text-rose-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0070b8] focus-visible:ring-offset-2 rounded-lg"
        >
          <X className="w-3.5 h-3.5" /> Сбросить ({activeCount})
        </button>
      )}
    </div>
  );
}
