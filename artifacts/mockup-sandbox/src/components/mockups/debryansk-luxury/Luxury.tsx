import React, { useEffect } from 'react';
import { ChevronRight, ArrowRight, Phone, MapPin, Mail, Clock, ShieldCheck, Car, Key, Settings, Zap, Star } from 'lucide-react';
import './_group.css';

export function Luxury() {
  useEffect(() => {
    // Add font dynamically
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600;700&display=swap';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return (
    <div className="luxury-theme min-h-[100vh] w-[1280px] mx-auto overflow-hidden relative selection:bg-[#d4af37] selection:text-black">
      
      {/* Navbar */}
      <nav className="absolute top-0 w-full z-50 flex items-center justify-between px-16 py-8 border-b border-white/10 bg-gradient-to-b from-[#0d0f14]/80 to-transparent backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <img src="/__mockup/images/logo-white.png" alt="Дебрянск Авто" className="h-10" />
        </div>
        <div className="flex gap-10 text-sm tracking-widest uppercase font-semibold text-white/80">
          <a href="#about" className="hover:text-[#d4af37] transition-colors">О группе</a>
          <a href="#dealers" className="hover:text-[#d4af37] transition-colors">Дилеры</a>
          <a href="#services" className="hover:text-[#d4af37] transition-colors">Услуги</a>
          <a href="#contact" className="hover:text-[#d4af37] transition-colors">Контакты</a>
        </div>
        <div>
          <button className="px-6 py-3 border border-[#d4af37] text-[#d4af37] uppercase tracking-wider text-xs font-bold hover:bg-[#d4af37] hover:text-black transition-all duration-300">
            Заказать звонок
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative h-[800px] flex items-center justify-center pt-20">
        <div className="absolute inset-0 z-0">
          <img src="/__mockup/images/hero-luxury.jpg" alt="Hero" className="w-full h-full object-cover object-center opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0f14] via-[#0d0f14]/60 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#0d0f14] via-transparent to-[#0d0f14]/80"></div>
        </div>

        <div className="relative z-10 text-center max-w-4xl px-8 flex flex-col items-center">
          <span className="text-[#d4af37] tracking-[0.3em] uppercase text-sm mb-6 block">Дебрянск Авто</span>
          <h1 className="font-serif-luxury text-7xl md:text-8xl font-bold leading-tight mb-6">
            АВТОМОБИЛЬНЫЙ<br />
            <span className="gold-text italic font-light">холдинг</span>
          </h1>
          <p className="text-xl text-white/70 max-w-2xl mx-auto font-light mb-16 leading-relaxed">
            Премиальный уровень сервиса и эксклюзивный выбор автомобилей. Искусство движения, возведенное в абсолют.
          </p>
          
          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-12 border-y border-[#d4af37]/20 py-8 w-full backdrop-blur-md bg-black/20">
            <div className="text-center">
              <div className="font-serif-luxury text-4xl gold-text mb-2">15+</div>
              <div className="text-xs uppercase tracking-widest text-white/60">Лет на рынке</div>
            </div>
            <div className="text-center border-l border-[#d4af37]/10">
              <div className="font-serif-luxury text-4xl gold-text mb-2">8</div>
              <div className="text-xs uppercase tracking-widest text-white/60">Брендов</div>
            </div>
            <div className="text-center border-l border-[#d4af37]/10">
              <div className="font-serif-luxury text-4xl gold-text mb-2">12 000+</div>
              <div className="text-xs uppercase tracking-widest text-white/60">Клиентов</div>
            </div>
            <div className="text-center border-l border-[#d4af37]/10">
              <div className="font-serif-luxury text-4xl gold-text mb-2">3</div>
              <div className="text-xs uppercase tracking-widest text-white/60">Города</div>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-32 px-16 relative">
        <div className="grid grid-cols-2 gap-20 items-center">
          <div>
            <h2 className="font-serif-luxury text-5xl mb-8 leading-tight">
              Искусство <br/><span className="gold-text italic">превосходства</span>
            </h2>
            <div className="space-y-6 text-lg text-white/70 font-light leading-relaxed">
              <p>
                «Дебрянск Авто» — это не просто автомобильный холдинг. Это философия бескомпромиссного качества и исключительного внимания к каждой детали. Мы создаем пространство, где выбор автомобиля становится искусством.
              </p>
              <p>
                Наши дилерские центры предлагают высочайший стандарт обслуживания, объединяя передовые технологии, многолетний опыт и персонализированный подход к каждому клиенту. Мы представляем лучшие мировые бренды для тех, кто не привык соглашаться на меньшее.
              </p>
              <p>
                Ваш комфорт и уверенность — наша главная привилегия.
              </p>
            </div>
            <button className="mt-12 flex items-center gap-3 text-[#d4af37] uppercase tracking-widest text-sm hover:gap-5 transition-all duration-300">
              Подробнее о компании <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] bg-gradient-to-br from-zinc-800 to-black rounded-sm overflow-hidden p-1">
              <div className="w-full h-full bg-[#0d0f14] flex flex-col justify-end p-8 relative overflow-hidden group">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?q=80&w=2069&auto=format&fit=crop')] bg-cover bg-center opacity-30 group-hover:opacity-40 transition-opacity duration-700 mix-blend-luminosity"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
                <div className="relative z-10">
                  <div className="w-12 h-1 bg-[#d4af37] mb-6"></div>
                  <h3 className="font-serif-luxury text-3xl mb-2">Надежность & Статус</h3>
                  <p className="text-white/60 font-light">Доверие, проверенное временем</p>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-10 -left-10 w-48 h-48 border border-[#d4af37]/30 border-l-0 border-t-0"></div>
            <div className="absolute -top-10 -right-10 w-48 h-48 border border-[#d4af37]/30 border-r-0 border-b-0"></div>
          </div>
        </div>
      </section>

      {/* Dealers */}
      <section id="dealers" className="py-32 px-16 bg-[#0a0c10] relative border-t border-white/5">
        <div className="mb-20 text-center">
          <span className="text-[#d4af37] tracking-[0.2em] uppercase text-xs mb-4 block">Наши партнеры</span>
          <h2 className="font-serif-luxury text-5xl">Дилерские <span className="italic font-light text-white/60">центры</span></h2>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Card 1 */}
          <div className="luxury-card group cursor-pointer h-[400px] flex flex-col justify-end p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-black z-0"></div>
            <div className="absolute top-8 right-8 z-10 px-4 py-1 border border-[#d4af37]/50 text-[#d4af37] text-xs uppercase tracking-widest bg-black/50 backdrop-blur-md">Официальный дилер</div>
            <div className="relative z-10 mt-auto">
              <h3 className="text-4xl font-bold mb-2 tracking-wide group-hover:text-[#d4af37] transition-colors">BMW</h3>
              <p className="text-white/50 flex items-center gap-2"><MapPin className="w-4 h-4"/> г. Брянск, ул. Автомобилистов, 1</p>
            </div>
            <div className="absolute bottom-8 right-8 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="w-12 h-12 rounded-full border border-[#d4af37] flex items-center justify-center text-[#d4af37]">
                <ArrowRight className="w-5 h-5 -rotate-45 group-hover:rotate-0 transition-transform duration-500" />
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="luxury-card group cursor-pointer h-[400px] flex flex-col justify-end p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/30 to-black z-0"></div>
            <div className="absolute top-8 right-8 z-10 px-4 py-1 border border-[#d4af37]/50 text-[#d4af37] text-xs uppercase tracking-widest bg-black/50 backdrop-blur-md">Официальный дилер</div>
            <div className="relative z-10 mt-auto">
              <h3 className="text-4xl font-bold mb-2 tracking-wide group-hover:text-[#d4af37] transition-colors">Mercedes-Benz</h3>
              <p className="text-white/50 flex items-center gap-2"><MapPin className="w-4 h-4"/> г. Брянск, пр-т Московский, 10</p>
            </div>
            <div className="absolute bottom-8 right-8 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="w-12 h-12 rounded-full border border-[#d4af37] flex items-center justify-center text-[#d4af37]">
                <ArrowRight className="w-5 h-5 -rotate-45 group-hover:rotate-0 transition-transform duration-500" />
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="luxury-card group cursor-pointer h-[400px] flex flex-col justify-end p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-red-900/10 to-black z-0"></div>
            <div className="absolute top-8 right-8 z-10 px-4 py-1 border border-[#d4af37]/50 text-[#d4af37] text-xs uppercase tracking-widest bg-black/50 backdrop-blur-md">Официальный дилер</div>
            <div className="relative z-10 mt-auto">
              <h3 className="text-4xl font-bold mb-2 tracking-wide group-hover:text-[#d4af37] transition-colors">Toyota</h3>
              <p className="text-white/50 flex items-center gap-2"><MapPin className="w-4 h-4"/> г. Брянск, ул. Станке Димитрова, 114</p>
            </div>
            <div className="absolute bottom-8 right-8 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="w-12 h-12 rounded-full border border-[#d4af37] flex items-center justify-center text-[#d4af37]">
                <ArrowRight className="w-5 h-5 -rotate-45 group-hover:rotate-0 transition-transform duration-500" />
              </div>
            </div>
          </div>

          {/* Card 4 */}
          <div className="luxury-card group cursor-pointer h-[400px] flex flex-col justify-end p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 to-black z-0"></div>
            <div className="absolute top-8 right-8 z-10 px-4 py-1 border border-[#d4af37]/50 text-[#d4af37] text-xs uppercase tracking-widest bg-black/50 backdrop-blur-md">Официальный дилер</div>
            <div className="relative z-10 mt-auto">
              <h3 className="text-4xl font-bold mb-2 tracking-wide group-hover:text-[#d4af37] transition-colors">Hyundai</h3>
              <p className="text-white/50 flex items-center gap-2"><MapPin className="w-4 h-4"/> г. Брянск, ул. Объездная, 30</p>
            </div>
            <div className="absolute bottom-8 right-8 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="w-12 h-12 rounded-full border border-[#d4af37] flex items-center justify-center text-[#d4af37]">
                <ArrowRight className="w-5 h-5 -rotate-45 group-hover:rotate-0 transition-transform duration-500" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-32 px-16 relative">
        <div className="absolute right-0 top-0 w-1/3 h-full bg-[#0a0c10] -z-10"></div>
        
        <div className="mb-20 flex justify-between items-end">
          <div>
            <span className="text-[#d4af37] tracking-[0.2em] uppercase text-xs mb-4 block">Привилегии</span>
            <h2 className="font-serif-luxury text-5xl">Эксклюзивные <span className="italic font-light text-white/60">услуги</span></h2>
          </div>
          <button className="text-sm uppercase tracking-widest border-b border-[#d4af37] text-[#d4af37] pb-1 hover:text-white hover:border-white transition-colors">
            Все услуги
          </button>
        </div>

        <div className="grid grid-cols-3 gap-x-12 gap-y-16">
          {[
            { num: "01", title: "ТО и сервис", desc: "Обслуживание по стандартам производителя с использованием оригинальных запчастей.", icon: Settings },
            { num: "02", title: "Продажа новых авто", desc: "Широкий выбор автомобилей премиум-класса в наличии и под индивидуальный заказ.", icon: Car },
            { num: "03", title: "Trade-in", desc: "Выгодный обмен вашего автомобиля на новый с справедливой оценкой стоимости.", icon: Zap },
            { num: "04", title: "Страхование", desc: "Премиальные программы КАСКО и ОСАГО от ведущих страховых партнеров.", icon: ShieldCheck },
            { num: "05", title: "Кредитование", desc: "Индивидуальные финансовые решения и персональный менеджер.", icon: Key },
            { num: "06", title: "Детейлинг", desc: "Профессиональный уход, защита кузова и восстановление эстетики.", icon: Star }
          ].map((srv, i) => (
            <div key={i} className="group relative border-t border-white/10 pt-8 hover:border-[#d4af37] transition-colors duration-500">
              <div className="font-serif-luxury text-6xl text-white/5 absolute top-4 right-0 group-hover:text-[#d4af37]/10 transition-colors duration-500">
                {srv.num}
              </div>
              <srv.icon className="w-8 h-8 text-[#d4af37] mb-6" strokeWidth={1.5} />
              <h3 className="text-2xl font-serif-luxury mb-4">{srv.title}</h3>
              <p className="text-white/50 font-light text-sm leading-relaxed pr-8">
                {srv.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-32 px-16 bg-[#08090b] relative border-t border-white/5">
        <div className="grid grid-cols-2 gap-20">
          <div>
            <span className="text-[#d4af37] tracking-[0.2em] uppercase text-xs mb-4 block">Связь с нами</span>
            <h2 className="font-serif-luxury text-5xl mb-12">Персональный <br/><span className="italic font-light text-white/60">подход</span></h2>
            
            <div className="space-y-8">
              <div className="flex items-start gap-6">
                <div className="w-12 h-12 border border-[#d4af37]/30 rounded-full flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-[#d4af37]" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-white/40 mb-1">Телефон</div>
                  <div className="text-xl font-light">+7 (4832) 58-00-00</div>
                </div>
              </div>
              
              <div className="flex items-start gap-6">
                <div className="w-12 h-12 border border-[#d4af37]/30 rounded-full flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-[#d4af37]" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-white/40 mb-1">Центральный офис</div>
                  <div className="text-lg font-light">г. Брянск, ул. Автомобилистов, 1</div>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="w-12 h-12 border border-[#d4af37]/30 rounded-full flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-[#d4af37]" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-white/40 mb-1">Режим работы</div>
                  <div className="text-lg font-light">Ежедневно 09:00 — 21:00</div>
                </div>
              </div>
            </div>
          </div>

          <div className="luxury-card p-12">
            <h3 className="text-2xl font-serif-luxury mb-8">Заказать консультацию</h3>
            <form className="space-y-6">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-widest text-white/40">Ваше имя</label>
                <input type="text" className="w-full bg-transparent border-b border-white/20 py-3 text-white focus:outline-none focus:border-[#d4af37] transition-colors" placeholder="Константин" />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-widest text-white/40">Телефон</label>
                <input type="tel" className="w-full bg-transparent border-b border-white/20 py-3 text-white focus:outline-none focus:border-[#d4af37] transition-colors" placeholder="+7 (999) 000-00-00" />
              </div>
              <div className="pt-4">
                <button type="button" className="w-full py-4 bg-[#d4af37] text-black font-bold uppercase tracking-widest text-sm hover:bg-white transition-colors duration-300">
                  Оставить заявку
                </button>
              </div>
              <p className="text-xs text-white/30 text-center font-light">
                Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-16 border-t border-white/10 flex justify-between items-center text-sm text-white/40 font-light">
        <div>© {new Date().getFullYear()} Дебрянск Авто. Все права защищены.</div>
        <div className="flex gap-8">
          <a href="#" className="hover:text-[#d4af37] transition-colors">Политика конфиденциальности</a>
          <a href="#" className="hover:text-[#d4af37] transition-colors">Карта сайта</a>
        </div>
      </footer>

    </div>
  );
}
