import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, X } from "lucide-react";
import { createPortal } from "react-dom";

interface DisclaimerData {
  id: number;
  title: string;
  content: string;
}

interface DisclaimerBadgeProps {
  type: "price-from-new" | "price-from-used" | "promotion";
  brandName?: string;
  model?: string;
  promotionId?: number;
}

async function fetchPriceFromNew(brandName?: string, model?: string): Promise<DisclaimerData | null> {
  const params = new URLSearchParams();
  if (brandName) params.set("brandName", brandName);
  if (model) params.set("model", model);
  const r = await fetch(`/api/disclaimers/price-from-new?${params.toString()}`);
  if (!r.ok) throw new Error(String(r.status));
  const json = await r.json();
  return json.ok ? json.data : null;
}

async function fetchPriceFromUsed(): Promise<DisclaimerData | null> {
  const r = await fetch("/api/disclaimers/price-from-used");
  if (!r.ok) throw new Error(String(r.status));
  const json = await r.json();
  return json.ok ? json.data : null;
}

async function fetchPromotionDisclaimers(promotionId: number): Promise<DisclaimerData[]> {
  const r = await fetch(`/api/disclaimers/promotion/${promotionId}`);
  if (!r.ok) throw new Error(String(r.status));
  const json = await r.json();
  return json.ok ? json.data : [];
}

/* ── Inline popup (no Dialog, site-style modal) ──────────────────────────── */
function DisclaimerPopup({ item, onClose }: { item: DisclaimerData; onClose: () => void }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[440px] overflow-hidden max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-base font-extrabold text-slate-900 pr-6">{item.title}</h3>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-5">
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
            {item.content}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Disclaimer badge + popup ───────────────────────────────────── */
export default function DisclaimerBadge({ type, brandName, model, promotionId }: DisclaimerBadgeProps) {
  const [open, setOpen] = useState(false);

  const { data } = useQuery<unknown>({
    queryKey: ["disclaimer", type, brandName, model, promotionId],
    queryFn: () => {
      if (type === "price-from-new") return fetchPriceFromNew(brandName, model);
      if (type === "price-from-used") return fetchPriceFromUsed();
      if (type === "promotion" && promotionId) return fetchPromotionDisclaimers(promotionId);
      return null;
    },
    staleTime: 30 * 60 * 1000,
  });

  if (type !== "promotion" && !data) return null;
  if (type === "promotion" && (!data || (data as DisclaimerData[]).length === 0)) return null;

  const items: DisclaimerData[] = type === "promotion"
    ? (data as DisclaimerData[])
    : (data ? [data as DisclaimerData] : []);

  if (items.length === 0) return null;
  const item = items[0];

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true); }}
        className="inline-flex items-center justify-center ml-1 text-slate-400 hover:text-primary transition-colors"
        title={item.title}
        aria-label={item.title}
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && <DisclaimerPopup item={item} onClose={() => setOpen(false)} />}
    </>
  );
}
