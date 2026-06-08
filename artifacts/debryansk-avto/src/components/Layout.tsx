import React, { useState, useCallback, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Heart, Scale, ArrowLeft, Phone, User, CheckCircle } from "lucide-react";
import { useCarStorage } from "@/hooks/useCarStorage";
import { SiVk, SiTelegram } from "react-icons/si";
import miniLogo from "@/assets/mini-logo.webp";
import logoWhiteSvg from "@/assets/logo-white.svg";
import logoPng from "@/assets/logo-optimized.webp";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

/* ── Nav links ──────────────────────────────────────────── */
const NAV_LINKS: [string, string, string][] = [
  ["О группе", "about", "/about"],
  ["Дилеры", "dealers", "/#dealers"],
  ["Услуги", "services", "/service"],
  ["Контакты", "contacts", "/contacts"],
];

/* ── Callback modal ────────────────────────────────────────── */
function CallbackModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("type", "callback");
      fd.append("name", name);
      fd.append("phone", phone);
      await fetch("/api/send-email", { method: "POST", body: fd });
    } catch (_) {}
    setLoading(false);
    setSent(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
          <X className="w-4 h-4 text-slate-600" />
        </button>
        {sent ? (
          <div className="p-10 text-center">
            <CheckCircle className="w-14 h-14 text-[#87b63c] mx-auto mb-4" />
            <h3 className="text-xl font-extrabold mb-2">Заявка принята!</h3>
            <p className="text-slate-500 text-sm">Менеджер свяжется с вами в ближайшее время.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 sm:p-8">
            <h3 className="text-xl font-extrabold mb-1">Заказать звонок</h3>
            <p className="text-sm text-slate-500 mb-5">Оставьте контакты и мы перезвоним вам в ближайшее время.</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Имя</label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                  <User className="w-4 h-4 text-slate-400" />
                  <input
                    type="text" required value={name} onChange={e => setName(e.target.value)}
                    className="bg-transparent flex-1 text-sm outline-none placeholder:text-slate-400"
                    placeholder="Ваше имя"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Телефон</label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <input
                    type="tel" required value={phone} onChange={e => setPhone(e.target.value)}
                    className="bg-transparent flex-1 text-sm outline-none placeholder:text-slate-400"
                    placeholder="+7 (___) ___-__-__"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full brand-gradient border-0 text-white font-bold rounded-xl h-12 hover:opacity-90">
                Отправить заявку
              </Button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}

/* ── Layout ──────────────────────────────────────────────────── */
export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [callbackOpen, setCallbackOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();
  const { favorites, compare } = useCarStorage();
  const favCount = favorites.length;
  const compCount = compare.length;
  const { toast } = useToast();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNav = useCallback((href: string) => {
    setMobileMenuOpen(false);
    if (href.startsWith("/#")) {
      window.location.href = href;
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-[Manrope,sans-serif] flex flex-col">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#111317] text-white">
        {/* Top info bar */}
        <div className="border-b border-white/[0.07]">
          <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between h-10">
            <div className="flex items-center gap-4 text-[11px] font-medium text-white/40">
              <span>г. Брянск</span>
              <span className="hidden sm:block">Ежедневно 9:00–21:00</span>
            </div>
            <div className="flex items-center gap-3">
              <a href="tel:+74832000000"
                className="text-xs sm:text-sm font-bold text-white/70 hover:text-white transition-colors">
                +7 (4832) 000-000
              </a>
              <Button size="sm"
                className="h-7 sm:h-8 px-3 sm:px-4 brand-gradient border-0 text-white font-bold rounded-lg text-[11px] sm:text-xs hover:opacity-90"
                onClick={() => setCallbackOpen(true)}>
                Заказать звонок
              </Button>
            </div>
          </div>
        </div>

        {/* Main nav row */}
        <div className="container mx-auto px-4 sm:px-6 flex items-center gap-4 sm:gap-6 h-[3.75rem]">
          <motion.button
            onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); window.location.href = "/"; }}
            className="shrink-0 relative h-8 flex items-center overflow-hidden"
            animate={{ width: scrolled ? 40 : 200 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <motion.img
              src={miniLogo}
              alt="Д"
              className="h-8 w-8 object-contain absolute left-0"
              animate={{ opacity: scrolled ? 1 : 0, scale: scrolled ? 1 : 0.6 }}
              transition={{ duration: 0.25 }}
            />
            <motion.img
              src={logoWhiteSvg}
              alt="Дебрянск Авто"
              className="h-7 sm:h-8 w-auto"
              animate={{ opacity: scrolled ? 0 : 1, x: scrolled ? -10 : 0 }}
              transition={{ duration: 0.25 }}
            />
          </motion.button>

          <nav className="hidden lg:flex items-center gap-0.5 ml-2">
            {NAV_LINKS.map(([label, id, href]) => (
              href.startsWith("/") ? (
                <Link key={id} href={href}
                  className={`px-3 py-2 text-sm font-semibold rounded-lg transition-all ${
                    location === href
                      ? "text-white bg-white/10"
                      : "text-white/60 hover:text-white hover:bg-white/8"
                  }`}>
                  {label}
                </Link>
              ) : (
                <button key={id} onClick={() => handleNav(href)}
                  className="px-3 py-2 text-sm font-semibold text-white/60 hover:text-white hover:bg-white/8 rounded-lg transition-all">
                  {label}
                </button>
              )
            ))}
            <Link href="/vacancies"
              className={`px-3 py-2 text-sm font-semibold rounded-lg transition-all ${
                location === "/vacancies" ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/8"
              }`}>
              Вакансии
            </Link>
            <Link href="/news"
              className={`px-3 py-2 text-sm font-semibold rounded-lg transition-all ${
                location === "/news" ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/8"
              }`}>
              Новости
            </Link>
          </nav>

          <div className="flex-1" />

          <div className="hidden lg:flex items-center gap-2 mr-3">
            <Link href="/favorites"
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-all ${
                location === "/favorites" ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/8"
              }`}>
              <Heart className="w-4 h-4" />
              <span>Избранное</span>
              {favCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">{favCount}</span>
              )}
            </Link>
            <Link href="/compare"
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-all ${
                location === "/compare" ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/8"
              }`}>
              <Scale className="w-4 h-4" />
              <span>Сравнить</span>
              {compCount > 0 && (
                <span className="bg-[#0070b8] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">{compCount}</span>
              )}
            </Link>
          </div>

          <button className="lg:hidden p-1.5 text-white/60 hover:text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-white/[0.07] bg-[#111317]">
              <div className="px-4 py-3 flex flex-col gap-0.5">
                {NAV_LINKS.map(([label, id, href]) => (
                  href.startsWith("/") ? (
                    <Link key={id} href={href}
                      className="text-left text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors block">
                      {label}
                    </Link>
                  ) : (
                    <button key={id} onClick={() => handleNav(href)}
                      className="text-left text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors">
                      {label}
                    </button>
                  )
                ))}
                <Link href="/vacancies"
                  className="text-left text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors block">
                  Вакансии
                </Link>
                <Link href="/news"
                  className="text-left text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors block">
                  Новости
                </Link>
                <Link href="/favorites"
                  className="text-left text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors block flex items-center gap-2">
                  <Heart className="w-4 h-4" /> Избранное {favCount > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{favCount}</span>}
                </Link>
                <Link href="/compare"
                  className="text-left text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors block flex items-center gap-2">
                  <Scale className="w-4 h-4" /> Сравнить {compCount > 0 && <span className="bg-[#0070b8] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{compCount}</span>}
                </Link>
                <div className="pt-3 flex items-center justify-between">
                  <a href="tel:+74832000000" className="text-base font-bold text-[#0070b8]">+7 (4832) 000-000</a>
                  <div className="flex gap-2">
                    <a href="#" className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center hover:bg-[#0070b8] transition-colors">
                      <SiVk size={14} />
                    </a>
                    <a href="#" className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center hover:bg-[#0070b8] transition-colors">
                      <SiTelegram size={14} />
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-[6.25rem]" />

      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="bg-[#0d0f14] text-slate-400 pt-12 sm:pt-14 pb-8 border-t border-white/[0.07]">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 mb-10 sm:mb-12">
            <div className="col-span-2 sm:col-span-1 lg:col-span-1">
              <img src={logoPng} alt="Дебрянск Авто" className="h-8 sm:h-9 w-auto mb-4 sm:mb-5 opacity-50 hover:opacity-100 transition-opacity" />
              <p className="text-sm text-slate-500 mb-4 sm:mb-5 leading-relaxed">
                Территория Автомобилей. Группа компаний с 9 брендами в Брянске с 2011 года.
              </p>
              <div className="flex gap-2.5">
                <a href="#" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-[#0070b8] transition-colors group">
                  <SiVk className="text-white/40 group-hover:text-white" size={15} />
                </a>
                <a href="#" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-[#0070b8] transition-colors group">
                  <SiTelegram className="text-white/40 group-hover:text-white" size={15} />
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-[10px] sm:text-xs tracking-widest uppercase text-white/70">Бренды</h4>
              <ul className="space-y-2 text-sm">
                {["CHERY","OMODA","JAECOO","HAVAL"].map(b => (
                  <li key={b}><span className="hover:text-[#0070b8] transition-colors cursor-pointer">{b}</span></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-[10px] sm:text-xs tracking-widest uppercase text-white/70">Ещё бренды</h4>
              <ul className="space-y-2 text-sm">
                {["TENET","МБ-Брянск","С пробегом"].map(b => (
                  <li key={b}><span className="hover:text-[#0070b8] transition-colors cursor-pointer">{b}</span></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-[10px] sm:text-xs tracking-widest uppercase text-white/70">Навигация</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="hover:text-[#0070b8] transition-colors">О группе</Link></li>
                <li><Link href="/service" className="hover:text-[#0070b8] transition-colors">Услуги</Link></li>
                <li><Link href="/contacts" className="hover:text-[#0070b8] transition-colors">Контакты</Link></li>
                <li><Link href="/vacancies" className="hover:text-[#0070b8] transition-colors">Вакансии</Link></li>
                <li><Link href="/news" className="hover:text-[#0070b8] transition-colors">Новости</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-6 sm:pt-8 border-t border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <p>© {new Date().getFullYear()} Дебрянск Авто — Территория Автомобилей</p>
            <Link href="#" className="hover:text-white transition-colors">Политика конфиденциальности</Link>
          </div>
        </div>
      </footer>

      {/* Callback modal */}
      <AnimatePresence>
        {callbackOpen && <CallbackModal onClose={() => setCallbackOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
