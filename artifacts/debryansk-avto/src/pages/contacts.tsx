import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, MapPin, Phone, Clock, Mail, Navigation,
  MessageSquare, CheckCircle, Send
} from "lucide-react";
import SEO from "@/components/SEO";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { YandexMap, type YandexMapHandle } from "@/components/YandexMap";

const DEALER_COLORS = ["#0070b8", "#87b63c", "#0070b8", "#87b63c"];

interface LocationBrandItem {
  id: number; name: string; logoUrl: string | null;
  bgColor: string | null; isService: boolean; sortOrder: number;
}

interface Location {
  id: number;
  title: string;
  address: string;
  phone: string | null;
  hours: string | null;
  mapX: number | null;
  mapY: number | null;
  brands: LocationBrandItem[];
}

async function fetchLocations(): Promise<Location[]> {
  const r = await fetch("/api/locations");
  if (!r.ok) throw new Error("API error");
  const json = await r.json();
  return json.ok ? json.data : [];
}

/* ─── Form state ────────────────────────────────────────────────────────────────────────────────────── */
function FeedbackForm() {
  const { toast } = useToast();
  const [form, setForm] = React.useState({ name: "", phone: "", email: "", message: "" });
  const [sent, setSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      toast({ title: "Заполните обязательные поля", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("type", "feedback");
      fd.append("name", form.name);
      fd.append("phone", form.phone);
      fd.append("email", form.email);
      fd.append("message", form.message);
      await fetch("/api/send-email", { method: "POST", body: fd });
    } catch (_) {}
    setLoading(false);
    setSent(true);
    toast({ title: "Сообщение отправлено", description: "Мы свяжемся с вами в ближайшее время" });
    setForm({ name: "", phone: "", email: "", message: "" });
  };

  if (sent) {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Спасибо!</h3>
        <p className="text-slate-500 text-sm">Мы получили ваше сообщение. Менеджер свяжется с вами в ближайшее время.</p>
        <button
          onClick={() => setSent(false)}
          className="mt-4 text-[#0070b8] text-sm font-bold hover:underline"
        >
          Отправить ещё
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Имя *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0070b8]/50 transition-colors"
            placeholder="Ваше имя"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Телефон *</label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0070b8]/50 transition-colors"
            placeholder="+7 (___) ___-__-__"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
        <input
          type="email"
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0070b8]/50 transition-colors"
          placeholder="email@example.com"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Сообщение</label>
        <textarea
          value={form.message}
          onChange={e => setForm({ ...form, message: e.target.value })}
          rows={4}
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0070b8]/50 transition-colors resize-none"
          placeholder="Что вас интересует?"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#0070b8] text-white font-bold py-3.5 rounded-xl hover:bg-[#005a94] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Отправляем...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Отправить сообщение
          </>
        )}
      </button>
      <p className="text-xs text-slate-400 text-center">
        Нажимая кнопку, вы соглашаетесь на обработку персональных данных
      </p>
    </form>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────────────────────────── */
export default function ContactsPage() {
  const yandexMapRef = React.useRef<YandexMapHandle>(null);

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["contacts-locations"],
    queryFn: fetchLocations,
    staleTime: 5 * 60 * 1000,
  });

  const dealerMapLocations = React.useMemo(() => {
    if (locations.length === 0) return [];
    return locations
      .filter(loc => loc.mapX != null && loc.mapY != null)
      .map((loc, idx) => ({
        id: loc.id,
        address: loc.address,
        short: loc.title,
        brands: loc.brands.filter(b => !b.isService).map(b => b.name),
        serviceBrands: loc.brands.filter(b => b.isService).map(b => b.name),
        lat: loc.mapX as number,
        lng: loc.mapY as number,
        color: DEALER_COLORS[idx % DEALER_COLORS.length],
        phone: loc.phone ?? undefined,
        hours: loc.hours ?? undefined,
      }));
  }, [locations]);

  const dealersSchema = locations.map((loc) => ({
    "@type": "AutoDealer",
    "name": `Дебрянск Авто — ${loc.title}`,
    "url": "https://debryansk-auto.ru/contacts",
    "telephone": loc.phone ?? "+7-4832-63-10-00",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": loc.address,
      "addressLocality": "Брянск",
      "addressRegion": "Брянская область",
      "addressCountry": "RU"
    },
    ...(loc.hours ? { "openingHours": loc.hours } : {}),
  }));

  return (
    <Layout>
      <SEO
        title="Контакты Дебрянск Авто — дилерские центры в Брянске"
        description="Адреса, телефоны, часы работы автосалонов Дебрянск Авто в Брянске. Оставьте заявку онлайн."
        canonical="/contacts"
        jsonLd={dealersSchema.length > 0 ? dealersSchema : undefined}
        breadcrumbs={[
          { name: "Главная", url: "/" },
          { name: "Контакты", url: "/contacts" },
        ]}
      />

      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Title */}
        <div className="mb-8 sm:mb-10">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl sm:text-3xl font-black text-slate-900"
          >
            Контакты
          </motion.h1>
          <p className="text-slate-500 text-sm mt-1">
            6 дилерских центров в Брянске и Брянской области
          </p>
        </div>

        {/* Quick contact bar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 sm:mb-10"
        >
          <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-[#0070b8]/10 rounded-xl flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5 text-[#0070b8]" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase">Телефон</p>
              <a href="tel:+74832631000" className="text-lg font-bold text-slate-900 hover:text-[#0070b8] transition-colors">
                +7 (4832) 63-10-00
              </a>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-[#0070b8]/10 rounded-xl flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-[#0070b8]" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase">Режим работы</p>
              <p className="text-sm font-bold text-slate-900">Ежедневно 9:00–21:00</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-[#0070b8]/10 rounded-xl flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-[#0070b8]" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase">Email</p>
              <a href="mailto:info@debryansk-auto.ru" className="text-sm font-bold text-slate-900 hover:text-[#0070b8] transition-colors">
                info@debryansk-auto.ru
              </a>
            </div>
          </div>
        </motion.div>

        {/* Map */}
        {dealerMapLocations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-8 sm:mb-10 rounded-2xl overflow-hidden border border-slate-200 shadow-sm"
            style={{ height: 420 }}
          >
            <YandexMap ref={yandexMapRef} locations={dealerMapLocations} />
          </motion.div>
        )}

        {/* Dealers grid + Form */}
        <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Left: dealers */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Наши салоны</h2>
            {locations.map((loc, i) => (
              <motion.div
                key={loc.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.06 }}
                className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 cursor-pointer hover:border-[#0070b8]/30 transition-colors"
                onClick={() => yandexMapRef.current?.openLocation(loc.id)}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-bold text-slate-900">{loc.title}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {loc.brands.filter(b => !b.isService).map(b => (
                        <span key={b.id} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {b.name}
                        </span>
                      ))}
                      {loc.brands.filter(b => b.isService).map(b => (
                        <span key={b.id} className="text-[10px] font-bold bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                          {b.name} Сервис
                        </span>
                      ))}
                    </div>
                  </div>
                  <a
                    href={`tel:${(loc.phone || "").replace(/\D/g, "")}`}
                    className="text-[#0070b8] font-bold text-sm hover:underline shrink-0"
                  >
                    {loc.phone || "—"}
                  </a>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-500">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{loc.address}</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-500 mt-1">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{loc.hours || "—"}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={`https://yandex.ru/maps/?text=${encodeURIComponent(loc.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-100 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Построить маршрут
                  </a>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Right: feedback form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 sticky top-24">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-[#0070b8]" />
                <h2 className="text-lg font-bold text-slate-900">Написать нам</h2>
              </div>
              <p className="text-sm text-slate-500 mb-5">
                Есть вопросы? Заполните форму и мы перезвоним вам.
              </p>
              <FeedbackForm />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
