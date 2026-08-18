import { useRef, useEffect, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

interface SortOption<T extends string> {
  value: T;
  label: string;
}

interface SortPopoverProps<T extends string> {
  value: T;
  options: SortOption<T>[];
  onChange: (value: T) => void;
}

export function SortPopover<T extends string>({ value, options, onChange }: SortPopoverProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = options.find(o => o.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 bg-white hover:border-[#0070b8] hover:text-[#0070b8] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0070b8] focus-visible:ring-offset-2 whitespace-nowrap"
      >
        {label}
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Сортировка"
          className="absolute right-0 top-full mt-1.5 z-30 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 min-w-[220px]"
        >
          {options.map(opt => {
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                role="option"
                aria-selected={selected}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors hover:bg-slate-50 ${
                  selected ? "text-[#0070b8]" : "text-slate-700"
                }`}
              >
                {opt.label}
                {selected && <Check className="w-4 h-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
