import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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

  // For price types: data is single DisclaimerData or null
  if (type !== "promotion" && !data) return null;
  // For promotion type: data is array
  if (type === "promotion" && (!data || (data as DisclaimerData[]).length === 0)) return null;

  const items: DisclaimerData[] = type === "promotion"
    ? (data as DisclaimerData[])
    : (data ? [data as DisclaimerData] : []);

  if (items.length === 0) return null;

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="inline-flex items-center justify-center ml-1 text-slate-400 hover:text-[#0070b8] transition-colors"
        title={items[0].title}
        aria-label={items[0].title}
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{items[0].title}</DialogTitle>
          </DialogHeader>
          {items.map((item, idx) => (
            <div key={item.id}>
              <DialogDescription className="text-sm text-slate-600 leading-relaxed">
                {item.content}
              </DialogDescription>
              {idx < items.length - 1 && <hr className="my-3 border-slate-100" />}
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
