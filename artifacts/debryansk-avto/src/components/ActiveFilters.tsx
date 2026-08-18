import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export interface ActiveFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface ActiveFiltersProps {
  chips: ActiveFilterChip[];
  onReset: () => void;
}

export function ActiveFilters({ chips, onReset }: ActiveFiltersProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <AnimatePresence initial={false}>
        {chips.map(chip => (
          <motion.button
            key={chip.key}
            layout
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15 }}
            type="button"
            onClick={chip.onRemove}
            aria-label={`Снять фильтр: ${chip.label}`}
            className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-[#0070b8]/10 text-[#0070b8] text-xs font-semibold hover:bg-[#0070b8]/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0070b8] focus-visible:ring-offset-1 whitespace-nowrap"
          >
            {chip.label}
            <X className="w-3.5 h-3.5 shrink-0" />
          </motion.button>
        ))}
      </AnimatePresence>

      {chips.length > 1 && (
        <motion.button
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          type="button"
          onClick={onReset}
          className="text-xs text-slate-400 hover:text-slate-600 font-medium underline-offset-2 hover:underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
        >
          Сбросить всё
        </motion.button>
      )}
    </div>
  );
}
