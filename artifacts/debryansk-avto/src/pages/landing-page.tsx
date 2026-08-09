import React, { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { useReducedMotion } from "framer-motion";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import Layout from "@/components/Layout";
import { Phone, ArrowRight, CheckCircle } from "lucide-react";
import { CTPhone } from "@/components/CTPhone";

interface LandingPageData {
  slug: string;
  route: string;
  meta_title: string | null;
  meta_description: string | null;
  h1: string | null;
  paragraphs: string[];
  faq_items: { q: string; a: string }[];
  created_at: string;
  updated_at: string;
}

async function fetchLandingPage(slug: string): Promise<LandingPageData> {
  const r = await fetch(`/api/p/${slug}`);
  if (!r.ok) throw new Error("Not found");
  const json = await r.json();
  if (!json.ok) throw new Error(json.error ?? "Error");
  return json.data as LandingPageData;
}

function LeadForm({ pageSlug }: { pageSlug: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) { setError("Укажите телефон"); return; }
    setError("");
    const fd = new FormData();
    fd.append("name", name);
    fd.append("phone", phone);
    fd.append("subject", `Заявка с SEO-страницы /p/${pageSlug}`);
    fd.append("message", `Имя: ${name}\nТелефон: ${phone}\nСтраница: /p/${pageSlug}`);
    try {
      await fetch("/api/send-email", { method: "POST", body: fd });
      setSent(true);
    } catch {
      setError("Ошибка отправки. Позвоните нам напрямую.");
    }
  }

  if (sent) {
    return (
      <div className="flex items-center gap-3 py-4 text-green-700 font-semibold">
        <CheckCircle className="w-5 h-5" />
        Заявка отправлена! Менеджер свяжется с вами в течение 30 минут.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Ваше имя"
          value={name}
          onChange={e => setName(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <input
          type="tel"
          placeholder="Телефон *"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          required
          className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          className="bg-primary hover:bg-[#005a94] text-white font-bold px-6 py-3 rounded-xl text-sm whitespace-nowrap transition-colors flex items-center gap-2"
        >
          Получить консультацию
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </form>
  );
}

function LandingFaq({ items }: { items: { q: string; a: string }[] }) {
  if (!items || items.length === 0) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": items.map(item => ({
      "@type": "Question",
      "name": item.q,
      "acceptedAnswer": { "@type": "Answer", "text": item.a },
    })),
  };

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      <section className="py-14 sm:py-20 bg-white border-t border-slate-100">
        <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2 text-center">FAQ</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-8 sm:mb-10">
            Часто задаваемые вопросы
          </h2>
          <Accordion type="single" collapsible className="space-y-3">
            {items.map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border border-slate-200 rounded-xl px-4 sm:px-5 data-[state=open]:border-primary/30 transition-colors"
              >
                <AccordionTrigger className="text-left text-sm sm:text-base font-bold hover:no-underline py-4">
                  <span className="flex items-start gap-3">
                    <span className="text-primary font-extrabold text-xs shrink-0 mt-0.5">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {item.q}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 leading-relaxed pb-4 pl-7">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </>
  );
}

export default function LandingPage() {
  const prefersReduced = useReducedMotion();
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["landing-page", slug],
    queryFn: () => fetchLandingPage(slug),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Layout>
        <div className={`container mx-auto px-4 py-20 max-w-3xl space-y-4${prefersReduced ? "" : " animate-pulse"}`}>
          <div className="h-10 bg-slate-100 rounded-xl w-3/4" />
          <div className="h-4 bg-slate-100 rounded w-full" />
          <div className="h-4 bg-slate-100 rounded w-5/6" />
        </div>
      </Layout>
    );
  }

  if (isError || !data) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 max-w-2xl text-center">
          <h1 className="text-3xl font-extrabold mb-4">Страница не найдена</h1>
          <p className="text-slate-500 mb-8">Запрашиваемая страница не существует или была удалена.</p>
          <Link href="/" className="inline-flex items-center gap-2 bg-primary text-white font-bold px-6 py-3 rounded-xl">
            На главную
          </Link>
        </div>
      </Layout>
    );
  }

  const title = data.meta_title || data.h1 || "Дебрянск Авто";
  const description = data.meta_description || "";

  return (
    <Layout>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`https://debryansk-auto.ru/p/${slug}`} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={`https://debryansk-auto.ru/p/${slug}`} />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
      </Helmet>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="bg-slate-50 border-b border-slate-100">
        <div className="container mx-auto px-4 sm:px-6 py-3 max-w-5xl">
          <ol className="flex items-center gap-2 text-xs text-slate-500">
            <li><Link href="/" className="hover:text-primary">Главная</Link></li>
            <li className="select-none">/</li>
            <li className="text-slate-700 font-medium truncate max-w-xs">{data.h1 || title}</li>
          </ol>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white py-14 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight mb-6">
            {data.h1 || title}
          </h1>
          <p className="text-slate-300 text-base sm:text-lg mb-8 max-w-2xl">
            {description}
          </p>
          <div className="flex flex-wrap gap-3">
            <CTPhone className="inline-flex items-center gap-2 bg-primary hover:bg-[#005a94] text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors">
              <Phone className="w-4 h-4" />
              Позвонить
            </CTPhone>
            <a
              href="#lead-form"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              Оставить заявку
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Body paragraphs */}
      {data.paragraphs && data.paragraphs.length > 0 && (
        <section className="py-14 sm:py-20 bg-white">
          <div className="container mx-auto px-4 sm:px-6 max-w-3xl prose prose-slate prose-lg max-w-none">
            {data.paragraphs.map((p, i) => (
              <p key={i} className="text-slate-700 leading-relaxed mb-5 text-base sm:text-lg">
                {p}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <LandingFaq items={data.faq_items ?? []} />

      {/* CTA / Lead form */}
      <section id="lead-form" className="scroll-mt-24 bg-slate-50 border-t border-slate-100 py-14 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2 text-center">Дебрянск Авто</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-3">
            Остались вопросы?
          </h2>
          <p className="text-slate-500 text-center mb-8 text-sm">
            Оставьте заявку — менеджер перезвонит в течение 30 минут в рабочее время.
          </p>
          <LeadForm pageSlug={slug} />
        </div>
      </section>
    </Layout>
  );
}
