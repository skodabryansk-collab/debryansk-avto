import { useQuery } from "@tanstack/react-query";

export interface FaqItem {
  id: number;
  question: string;
  answer: string;
  includeInSchema: boolean | null;
  sortOrder: number | null;
}

export function useFaq(pageSlug: string) {
  return useQuery<FaqItem[]>({
    queryKey: ["faq", pageSlug],
    queryFn: async () => {
      const r = await fetch(`/api/faq?page=${encodeURIComponent(pageSlug)}`);
      if (!r.ok) throw new Error("FAQ fetch failed");
      const json = await r.json();
      return json.ok ? (json.faqs as FaqItem[]) : [];
    },
    staleTime: 1000 * 60 * 60,
    enabled: !!pageSlug,
  });
}
