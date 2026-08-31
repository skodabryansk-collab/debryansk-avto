import React, { useState } from "react";
import { ymGoal } from "@/lib/ym";
import { ensureLeadSubmissionMetadata } from "../lib/leadSubmission";
import { Link, useRoute } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, Calendar, CheckCircle, ExternalLink, Phone, Share2, Check,
} from "lucide-react";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import { formatPhone, isPhoneValid } from "@/hooks/usePhoneMask";

interface PromoBrand {
  id: number;
  name: string;
  logoUrl: string | null;
  bgColor: string | null;
}

interface PromotionDetail {
  id: number;
  title: string;
  slug: string;
  description: string;
  image: string | null;
  badge: string | null;
  expiresAt: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
  promotionType: "sales" | "service";
  brandIds: number[];
  brands: PromoBrand[];
  isActive: boolean;
  isExpired: boolean;
}

async function fetchPromotion(slug: string): Promise<PromotionDetail | null> {
  const r = await fetch(`/api/promotions/${slug}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("API error");
  const json = await r.json();
  return json.ok ? json.data : null;
}

export default function PromotionDetailPage() {
  const [, params] = useRoute("/promotions/:slug");
  const slug = params?.slug ?? "";

  const { data: promo, isLoading } = useQuery({
    queryKey: ["promotion", slug],
    queryFn: () => fetchPromotion(slug),
    enabled: !!slug,
  });

  const [showForm, setShowForm] = useState(false);
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPhoneValid(phone) || !promo) return;
    setSending(true);
    setError(false);
    try {
      const fd = new FormData();
      fd.append("type", "promo");
      fd.append("phone", phone);
      const brandNames = promo.brands.map(brand => brand.name).filter(Boolean);
      if (brandNames.length > 0) fd.append("brand", brandNames.join(", "));
      fd.append("source", `Акция (прямая ссылка): ${promo.title}`);
      const r = await fetch("/api/send-email", { method: "POST", body: ensureLeadSubmissionMetadata(fd) });
      if (!r.ok) { setError(true); setSending(false); return; }
      ymGoal("lead_submit");
      setSubmitted(true);
    } catch {
      setError(true);
    }
    setSending(false);
  }

  async function handleCopyLink() {
    const url = `https://debryansk-auto.ru/promotions/${slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: promo?.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // user cancelled share or clipboard unavailable — ignore
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 sm:px-6 py-8 max-w-2xl animate-pulse space-y-4">
          <div className="h-4 bg-slate-100 rounded w-1/3" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
          <div className="h-8 bg-slate-100 rounded w-2/3" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-4 bg-slate-100 rounded" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!promo) {
    return (
      <Layout>
        <SEO title="Акция не найдена" description="Запрашиваемая акция не найдена или была удалена." canonical="/promotions" />
        <div className="text-center text-slate-400 py-20 px-4">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Акция не найдена</h1>
          <p className="text-sm text-slate-400 mb-6">Возможно, ссылка устарела или акция была удалена.</p>
          <Link href="/" className="text-[#0070b8] font-bold text-sm hover:underline">
            <ArrowLeft className="w-4 h-4 inline mr-1" />
            На главную
          </Link>
        </div>
        <div data-prerender-ready="true" style={{ display: "none" }} />
      </Layout>
    );
  }

  const notAvailable = !promo.isActive || promo.isExpired;
  const btnText = promo.buttonText || "Оставить заявку";

  return (
    <Layout>
      <SEO
        title={promo.title}
        description={promo.description?.slice(0, 155) || `Акция «${promo.title}» — Дебрянск Авто`}
        canonical={`/promotions/${promo.slug}`}
        image={promo.image ?? undefined}
        type="article"
        breadcrumbs={[
          { name: "Главная", url: "/" },
          { name: promo.title, url: `/promotions/${promo.slug}` },
        ]}
      />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-2xl">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
          <Link href="/" className="hover:text-[#0070b8] transition-colors">Главная</Link>
          <ArrowRight className="w-3 h-3" />
          <span className="text-slate-600 truncate">{promo.title}</span>
        </div>

        <motion.article
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm"
        >
          {promo.image && (
            <div className="w-full h-52 sm:h-72 overflow-hidden relative">
              <img src={promo.image} alt={promo.title} className="w-full h-full object-cover" />
              {promo.brands.length > 0 && (
                <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
                  {promo.brands.slice(0, 4).map(b => (
                    <div key={b.id} className="flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 shadow-sm">
                      {b.logoUrl && <img src={b.logoUrl} alt={b.name} className="w-4 h-3 object-contain" />}
                      <span className="text-[10px] font-bold text-slate-700">{b.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                {promo.badge && (
                  <span className="inline-flex items-center gap-1 bg-[#87b63c]/15 text-[#4a7a0f] text-xs font-bold px-3 py-1 rounded-full">
                    {promo.badge}
                  </span>
                )}
                {promo.expiresAt && (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${promo.isExpired ? "bg-red-50 text-red-600 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                    <Calendar className="w-3 h-3" />
                    {promo.isExpired ? "акция истекла" : "до"} {new Date(promo.expiresAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                  </span>
                )}
              </div>
              <button
                onClick={handleCopyLink}
                className="shrink-0 inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-3 py-1 rounded-full text-xs transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-[#87b63c]" /> : <Share2 className="w-3 h-3" />}
                {copied ? "Скопировано" : "Поделиться"}
              </button>
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-4 leading-tight">
              {promo.title}
            </h1>

            <p className="text-slate-600 leading-relaxed whitespace-pre-line mb-6 text-sm sm:text-base">
              {promo.description}
            </p>

            {!promo.image && promo.brands.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {promo.brands.map(b => (
                  <div key={b.id} className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5">
                    {b.logoUrl && <img src={b.logoUrl} alt={b.name} className="w-10 h-5 object-contain" />}
                    <span className="text-xs font-semibold text-slate-600">{b.name}</span>
                  </div>
                ))}
              </div>
            )}

            {notAvailable ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center">
                <p className="font-bold text-slate-700">Акция больше недоступна</p>
                <p className="text-sm text-slate-500 mt-1">
                  Уточните актуальные предложения по телефону{" "}
                  <a href="tel:+74832777770" className="text-[#0070b8] font-bold">+7 (4832) 77-77-70</a>
                </p>
              </div>
            ) : submitted ? (
              <div className="bg-[#87b63c]/10 border border-[#87b63c]/30 rounded-2xl p-5 text-center">
                <CheckCircle className="w-10 h-10 text-[#87b63c] mx-auto mb-2" />
                <p className="font-bold text-slate-900">Заявка отправлена!</p>
                <p className="text-sm text-slate-500 mt-1">Мы свяжемся с вами в ближайшее время</p>
              </div>
            ) : !showForm ? (
              <div className="flex flex-col sm:flex-row gap-3">
                {promo.buttonUrl && (
                  <a href={promo.buttonUrl} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-5 py-3 rounded-xl text-sm transition-colors">
                    Узнать подробнее <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button onClick={() => setShowForm(true)}
                  className="flex-1 bg-gradient-to-r from-[#0070b8] to-[#005a94] text-white font-bold px-5 py-3 rounded-xl text-sm hover:opacity-90 transition-opacity">
                  {btnText}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
                    Ваш телефон
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="tel" inputMode="tel" maxLength={18}
                      value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
                      placeholder="+7 (___) ___-__-__" required
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0070b8] transition-colors"
                    />
                  </div>
                </div>
                {error && <p className="text-xs text-red-500 text-center">Не удалось отправить. Попробуйте ещё раз.</p>}
                <button type="submit" disabled={sending || !isPhoneValid(phone)}
                  className="w-full bg-gradient-to-r from-[#0070b8] to-[#005a94] text-white font-bold rounded-xl py-3 text-sm hover:opacity-90 transition-opacity disabled:opacity-60">
                  {sending ? "Отправляем…" : "Отправить заявку"}
                </button>
                <p className="text-[10px] text-slate-400 text-center">
                  Нажимая кнопку, вы соглашаетесь с{" "}
                  <Link href="/privacy" className="underline">политикой конфиденциальности</Link>
                </p>
              </form>
            )}
          </div>
        </motion.article>
        <div data-prerender-ready="true" style={{ display: "none" }} />
      </div>
    </Layout>
  );
}
