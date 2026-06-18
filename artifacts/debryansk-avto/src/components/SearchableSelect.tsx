import React, { useState, useEffect, useRef } from "react";

export interface SearchableSelectItem {
  id: string;
  name: string;
}

interface SearchableSelectProps {
  items: SearchableSelectItem[];
  value: string;
  onChange: (id: string, name: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export function SearchableSelect({
  items,
  value,
  onChange,
  placeholder = "Выберите...",
  disabled,
  loading,
  className = "",
}: SearchableSelectProps) {
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selected = items.find((i) => i.id === value);
    setInputValue(selected?.name ?? "");
  }, [value, items]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        const selected = items.find((i) => i.id === value);
        setInputValue(selected?.name ?? "");
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, value, items]);

  const filtered = inputValue
    ? items.filter((i) => i.name.toLowerCase().includes(inputValue.toLowerCase()))
    : items;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setOpen(true);
    if (!e.target.value) onChange("", "");
  };

  const handleSelect = (item: SearchableSelectItem) => {
    onChange(item.id, item.name);
    setInputValue(item.name);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      const selected = items.find((i) => i.id === value);
      setInputValue(selected?.name ?? "");
      setOpen(false);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      const selected = items.find((i) => i.id === value);
      setInputValue(selected?.name ?? "");
      setOpen(false);
    }, 150);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={loading ? "" : inputValue}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={loading ? "Загрузка…" : placeholder}
        disabled={disabled || loading}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className={className}
      />
      {open && !loading && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(item);
              }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors"
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
