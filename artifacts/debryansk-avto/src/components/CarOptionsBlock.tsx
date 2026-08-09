import React, { useState } from "react";
import { CheckCircle, ChevronDown, ChevronUp } from "lucide-react";

const PREVIEW_COUNT = 10;

export default function CarOptionsBlock({
  extras,
  className = "",
  title = "Опции и комплектация",
  titleClassName = "",
}: {
  extras: string;
  className?: string;
  title?: string;
  titleClassName?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const allOptions = extras
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  if (allOptions.length === 0) return null;

  const hasMore = allOptions.length > PREVIEW_COUNT;
  const shown = expanded ? allOptions : allOptions.slice(0, PREVIEW_COUNT);

  return (
    <div className={className}>
      <h2 className={titleClassName}>{title}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
        {shown.map((opt, i) => (
          <div
            key={i}
            className="flex items-start gap-2 bg-slate-50/80 rounded-xl px-3 py-2.5 border border-slate-100/80"
          >
            <CheckCircle className="w-4 h-4 text-[#87b63c] shrink-0 mt-0.5" />
            <span className="text-xs font-semibold text-slate-700 leading-snug">
              {opt}
            </span>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-bold text-primary hover:text-[#0058a0] transition-colors py-2 rounded-xl border border-slate-100 hover:bg-slate-50"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" /> Свернуть
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" /> Показать все ({allOptions.length})
            </>
          )}
        </button>
      )}
    </div>
  );
}
