import React from "react";
import { useFaq } from "@/hooks/useFaq";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Helmet } from "react-helmet-async";

interface FaqBlockProps {
  pageSlug: string;
  title?: string;
}

export default function FaqBlock({ pageSlug, title = "\u0427\u0430\u0441\u0442\u043e \u0437\u0430\u0434\u0430\u0432\u0430\u0435\u043c\u044b\u0435 \u0432\u043e\u043f\u0440\u043e\u0441\u044b" }: FaqBlockProps) {
  const { data: faqs, isLoading } = useFaq(pageSlug);

  if (isLoading) {
    return (
      <section className="py-14 sm:py-20 bg-white border-t border-slate-100">
        <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!faqs || faqs.length === 0) return null;

  const schemaFaq = faqs.filter(f => f.includeInSchema !== false);
  const jsonLd = schemaFaq.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": schemaFaq.map(f => ({
      "@type": "Question",
      "name": f.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": f.answer,
      },
    })),
  } : null;

  return (
    <>
      {jsonLd && (
        <Helmet>
          <script type="application/ld+json">
            {JSON.stringify(jsonLd)}
          </script>
        </Helmet>
      )}
      <section id="section-faq" className="scroll-mt-24 py-14 sm:py-20 bg-white border-t border-slate-100">
        <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2 text-center">
            FAQ
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-8 sm:mb-10">
            {title}
          </h2>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((item, i) => (
              <AccordionItem
                key={item.id}
                value={`faq-${item.id}`}
                className="border border-slate-200 rounded-xl px-4 sm:px-5 data-[state=open]:border-primary/30 transition-colors"
              >
                <AccordionTrigger className="text-left text-sm sm:text-base font-bold hover:no-underline py-4">
                  <span className="flex items-start gap-3">
                    <span className="text-primary font-extrabold text-xs shrink-0 mt-0.5">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {item.question}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 leading-relaxed pb-4 pl-7">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </>
  );
}
