import React, { useState, useEffect } from "react";
import {
  MapPin,
  Phone,
  Clock,
  Menu,
  ChevronRight,
  Wrench,
  Car,
  RefreshCcw,
  ShieldCheck,
  CreditCard,
  Sparkles,
  ArrowRight
} from "lucide-react";
import "./_group.css";

export function Dynamic() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      style={{ minHeight: "100vh", width: "1280px" }}
      className="mx-auto bg-slate-50 font-sans text-slate-900 relative overflow-hidden"
    >
      <link
        rel="stylesheet"
        media="print"
        // @ts-ignore
        onload="this.media='all'"
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
      />
      <style dangerouslySetInnerHTML={{ __html: `
        .font-sans { font-family: 'Manrope', sans-serif; }
      `}} />

      {/* Header */}
      <header
        className={`fixed top-0 w-[1280px] z-50 transition-all duration-300 ${
          scrolled ? "bg-white shadow-md py-4" : "bg-white/90 backdrop-blur-md py-6 border-b border-slate-200"
        }`}
      >
        <div className="container mx-auto px-12 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src="/__mockup/images/logo-dark.svg" alt="Дебрянск Авто" className="h-8" />
          </div>
          <nav className="hidden md:flex items-center gap-8 font-semibold text-sm tracking-wide">
            <a href="#about" className="hover:text-[#0070b8] transition-colors">О группе</a>
            <a href="#dealers" className="hover:text-[#0070b8] transition-colors">Дилеры</a>
            <a href="#services" className="hover:text-[#0070b8] transition-colors">Услуги</a>
            <a href="#contacts" className="hover:text-[#0070b8] transition-colors">Контакты</a>
          </nav>
          <div className="flex items-center gap-6">
            <div className="text-right hidden lg:block">
              <a href="tel:+74832123456" className="block font-bold text-lg hover:text-[#0070b8] transition-colors">+7 (4832) 12-34-56</a>
              <span className="text-xs text-slate-500 font-medium">Ежедневно 9:00 - 21:00</span>
            </div>
            <button className="bg-[#0070b8] text-white px-6 py-2.5 rounded hover:bg-[#005a96] transition-colors font-semibold text-sm">
              Заказать звонок
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-24 relative overflow-hidden bg-white">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-slate-100 dynamic-clip-path opacity-50 pointer-events-none" />
        
        <div className="container mx-auto px-12 relative z-10 grid grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-[#0070b8] rounded-full text-sm font-bold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-[#87b63c]" />
              ПРЕМИАЛЬНЫЙ АВТОХОЛДИНГ
            </div>
            <h1 className="text-6xl font-extrabold leading-[1.1] tracking-tight">
              Движение <br />в <span className="dynamic-gradient-text">будущее</span>
            </h1>
            <p className="text-xl text-slate-600 leading-relaxed font-medium max-w-lg">
              Инновационный подход к выбору и обслуживанию автомобилей в Брянске. Официальный дилер ведущих мировых брендов.
            </p>
            <div className="flex gap-4">
              <button className="dynamic-gradient text-white px-8 py-4 rounded-lg font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
                Выбрать автомобиль
              </button>
              <button className="border-2 border-slate-200 px-8 py-4 rounded-lg font-bold text-lg hover:border-[#0070b8] hover:text-[#0070b8] transition-all">
                Записаться на сервис
              </button>
            </div>
          </div>
          
          <div className="relative">
            <div className="absolute -inset-4 dynamic-gradient rounded-[2rem] opacity-20 blur-xl"></div>
            <img 
              src="/__mockup/images/hero-dynamic.jpg" 
              alt="Showroom" 
              className="relative w-full h-[500px] object-cover rounded-[2rem] shadow-2xl z-10"
              onError={(e) => {
                e.currentTarget.src = "https://images.unsplash.com/photo-1562426509-5044a121aa49?auto=format&fit=crop&q=80&w=1000";
              }}
            />
            
            {/* Floating Stats */}
            <div className="absolute -left-12 bottom-12 bg-white p-6 rounded-xl shadow-xl z-20 flex gap-8">
              <div>
                <div className="text-3xl font-extrabold text-[#0070b8]">15+</div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Лет на рынке</div>
              </div>
              <div className="w-px bg-slate-200"></div>
              <div>
                <div className="text-3xl font-extrabold text-[#87b63c]">8</div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Брендов</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full dynamic-gradient opacity-10 transform skew-x-[-15deg]"></div>
        
        <div className="container mx-auto px-12 relative z-10">
          <div className="grid grid-cols-12 gap-12 items-center">
            <div className="col-span-5 relative">
              <div className="text-[12rem] font-black leading-none text-white/5 select-none absolute -top-20 -left-10">
                12k
              </div>
              <div className="relative z-10">
                <h2 className="text-5xl font-extrabold mb-6">
                  Надежность,<br/>проверенная<br/>временем
                </h2>
                <div className="dynamic-gradient w-20 h-2 rounded-full mb-8"></div>
                <p className="text-slate-400 text-lg leading-relaxed mb-8">
                  Мы гордимся тем, что более 12 000 клиентов доверили нам выбор своего автомобиля. 
                  Наш опыт и стандарты качества позволяют нам предоставлять сервис высочайшего уровня 
                  в трех городах присутствия.
                </p>
                <div className="flex items-center gap-4 text-sm font-bold uppercase tracking-wider text-[#87b63c]">
                  <span>Узнать больше о компании</span>
                  <ArrowRight className="w-5 h-5" />
                </div>
              </div>
            </div>
            
            <div className="col-span-7 grid grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-colors">
                <div className="text-4xl font-black text-[#0070b8] mb-2">12 000+</div>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Довольных клиентов</div>
              </div>
              <div className="bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-colors mt-8">
                <div className="text-4xl font-black text-[#87b63c] mb-2">3</div>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Города присутствия</div>
              </div>
              <div className="bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-colors">
                <div className="text-4xl font-black text-white mb-2">100%</div>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Гарантия качества</div>
              </div>
              <div className="bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-colors mt-8">
                <div className="text-4xl font-black text-[#0070b8] mb-2">24/7</div>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Поддержка клиентов</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dealers Section */}
      <section id="dealers" className="py-24 bg-slate-50 relative">
        <div className="container mx-auto px-12">
          <div className="flex justify-between items-end mb-16">
            <div>
              <h2 className="text-4xl font-extrabold mb-4">Наши бренды</h2>
              <p className="text-slate-500 font-medium text-lg">Официальные дилерские центры в Брянске</p>
            </div>
            <button className="text-[#0070b8] font-bold flex items-center gap-2 hover:gap-3 transition-all">
              Все автомобили в наличии <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {/* BMW Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover-scale group cursor-pointer relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-600"></div>
              <div className="p-8 pb-0 flex justify-between items-start">
                <div>
                  <h3 className="text-3xl font-black tracking-tight mb-2">BMW</h3>
                  <p className="text-slate-500 font-medium flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> Брянск, ул. Бурова, 14
                  </p>
                </div>
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center font-bold text-2xl text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  B
                </div>
              </div>
              <div className="p-8 pt-12 flex justify-between items-end">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-400 uppercase">В наличии</div>
                  <div className="text-xl font-extrabold">24 автомобиля</div>
                </div>
                <button className="bg-slate-100 text-slate-700 px-6 py-2.5 rounded-lg font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  Подробнее
                </button>
              </div>
            </div>

            {/* Mercedes-Benz Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover-scale group cursor-pointer relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-slate-800"></div>
              <div className="p-8 pb-0 flex justify-between items-start">
                <div>
                  <h3 className="text-3xl font-black tracking-tight mb-2">Mercedes-Benz</h3>
                  <p className="text-slate-500 font-medium flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> Брянск, пр-т Ст. Димитрова, 114
                  </p>
                </div>
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center font-bold text-2xl text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-800 transition-colors">
                  M
                </div>
              </div>
              <div className="p-8 pt-12 flex justify-between items-end">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-400 uppercase">В наличии</div>
                  <div className="text-xl font-extrabold">18 автомобилей</div>
                </div>
                <button className="bg-slate-100 text-slate-700 px-6 py-2.5 rounded-lg font-bold group-hover:bg-slate-800 group-hover:text-white transition-colors">
                  Подробнее
                </button>
              </div>
            </div>

            {/* Toyota Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover-scale group cursor-pointer relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-red-600"></div>
              <div className="p-8 pb-0 flex justify-between items-start">
                <div>
                  <h3 className="text-3xl font-black tracking-tight mb-2">Toyota</h3>
                  <p className="text-slate-500 font-medium flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> Брянск, ул. Объездная, 8
                  </p>
                </div>
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center font-bold text-2xl text-slate-400 group-hover:bg-red-50 group-hover:text-red-600 transition-colors">
                  T
                </div>
              </div>
              <div className="p-8 pt-12 flex justify-between items-end">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-400 uppercase">В наличии</div>
                  <div className="text-xl font-extrabold">32 автомобиля</div>
                </div>
                <button className="bg-slate-100 text-slate-700 px-6 py-2.5 rounded-lg font-bold group-hover:bg-red-600 group-hover:text-white transition-colors">
                  Подробнее
                </button>
              </div>
            </div>

            {/* Hyundai Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover-scale group cursor-pointer relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-800"></div>
              <div className="p-8 pb-0 flex justify-between items-start">
                <div>
                  <h3 className="text-3xl font-black tracking-tight mb-2">Hyundai</h3>
                  <p className="text-slate-500 font-medium flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> Брянск, ул. Красноармейская, 93Б
                  </p>
                </div>
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center font-bold text-2xl text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-800 transition-colors">
                  H
                </div>
              </div>
              <div className="p-8 pt-12 flex justify-between items-end">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-400 uppercase">В наличии</div>
                  <div className="text-xl font-extrabold">45 автомобилей</div>
                </div>
                <button className="bg-slate-100 text-slate-700 px-6 py-2.5 rounded-lg font-bold group-hover:bg-blue-800 group-hover:text-white transition-colors">
                  Подробнее
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 bg-white relative">
        <div className="container mx-auto px-12">
          <h2 className="text-4xl font-extrabold mb-16">Наши услуги</h2>
          
          <div className="grid grid-cols-3 gap-6 auto-rows-[240px]">
            {/* Large Card 1 */}
            <div className="col-span-2 bg-slate-50 rounded-2xl p-10 flex flex-col justify-between hover-scale group border border-slate-100">
              <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center text-[#0070b8] mb-6 group-hover:scale-110 transition-transform">
                <Wrench className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-2xl font-extrabold mb-3 group-hover:text-[#0070b8] transition-colors">ТО и сервис</h3>
                <p className="text-slate-500 font-medium text-lg">Официальное обслуживание с гарантией качества и оригинальными запчастями</p>
              </div>
            </div>

            {/* Small Card 1 */}
            <div className="bg-slate-50 rounded-2xl p-8 flex flex-col justify-between hover-scale group border border-slate-100">
              <div className="w-14 h-14 bg-white rounded-xl shadow-sm flex items-center justify-center text-[#87b63c] group-hover:scale-110 transition-transform">
                <Car className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold mb-2 group-hover:text-[#87b63c] transition-colors">Продажа новых авто</h3>
                <p className="text-slate-500 font-medium">Широкий выбор комплектаций</p>
              </div>
            </div>

            {/* Small Card 2 */}
            <div className="bg-slate-50 rounded-2xl p-8 flex flex-col justify-between hover-scale group border border-slate-100">
              <div className="w-14 h-14 bg-white rounded-xl shadow-sm flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
                <RefreshCcw className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold mb-2 group-hover:text-purple-500 transition-colors">Trade-in</h3>
                <p className="text-slate-500 font-medium">Выгодный обмен старого авто</p>
              </div>
            </div>

            {/* Small Card 3 */}
            <div className="bg-slate-50 rounded-2xl p-8 flex flex-col justify-between hover-scale group border border-slate-100">
              <div className="w-14 h-14 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold mb-2 group-hover:text-blue-500 transition-colors">Страхование</h3>
                <p className="text-slate-500 font-medium">ОСАГО и КАСКО на месте</p>
              </div>
            </div>

            {/* Small Card 4 */}
            <div className="bg-slate-50 rounded-2xl p-8 flex flex-col justify-between hover-scale group border border-slate-100">
              <div className="w-14 h-14 bg-white rounded-xl shadow-sm flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                <CreditCard className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold mb-2 group-hover:text-emerald-500 transition-colors">Кредитование</h3>
                <p className="text-slate-500 font-medium">Одобрение от ведущих банков</p>
              </div>
            </div>

             {/* Small Card 5 */}
             <div className="bg-[#0070b8] text-white rounded-2xl p-8 flex flex-col justify-between hover-scale group shadow-xl">
              <div className="w-14 h-14 bg-white/20 rounded-xl backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold mb-2">Детейлинг</h3>
                <p className="text-blue-100 font-medium">Премиальный уход за кузовом</p>
              </div>
            </div>
            
             <div className="col-span-2 flex items-center justify-center p-8">
               <div className="text-center">
                 <div className="text-2xl font-bold mb-4">Нужна консультация по услугам?</div>
                 <button className="border-2 border-slate-200 px-8 py-3 rounded-lg font-bold text-lg hover:border-[#0070b8] hover:text-[#0070b8] transition-all">
                   Оставить заявку
                 </button>
               </div>
             </div>

          </div>
        </div>
      </section>

      {/* Contacts Section */}
      <section id="contacts" className="py-24 bg-slate-100 relative">
        <div className="container mx-auto px-12">
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row border border-slate-200">
            {/* Form & Info */}
            <div className="w-full md:w-1/2 p-12 lg:p-16">
              <h2 className="text-4xl font-extrabold mb-8">Свяжитесь с нами</h2>
              
              <div className="space-y-6 mb-12">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#0070b8] shrink-0 mt-1">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-400 uppercase mb-1">Телефон</div>
                    <div className="text-xl font-bold">+7 (4832) 12-34-56</div>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-[#87b63c] shrink-0 mt-1">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-400 uppercase mb-1">Режим работы</div>
                    <div className="text-lg font-bold">Ежедневно с 9:00 до 21:00</div>
                  </div>
                </div>
              </div>

              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <h3 className="text-xl font-bold mb-4">Остались вопросы?</h3>
                <input 
                  type="text" 
                  placeholder="Ваше имя" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 font-medium focus:outline-none focus:ring-2 focus:ring-[#0070b8] focus:border-transparent transition-all"
                />
                <input 
                  type="tel" 
                  placeholder="Номер телефона" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 font-medium focus:outline-none focus:ring-2 focus:ring-[#0070b8] focus:border-transparent transition-all"
                />
                <button className="w-full dynamic-gradient text-white rounded-xl px-5 py-4 font-bold text-lg hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  Жду звонка
                </button>
                <p className="text-xs text-slate-400 text-center mt-4">
                  Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности
                </p>
              </form>
            </div>

            {/* Map Placeholder */}
            <div className="w-full md:w-1/2 relative min-h-[400px] bg-slate-200">
              <div className="absolute inset-0 dynamic-gradient opacity-80 mix-blend-multiply"></div>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-8 text-center">
                <MapPin className="w-16 h-16 mb-4 opacity-80" />
                <h3 className="text-2xl font-bold mb-2">Мы на карте</h3>
                <p className="text-blue-100 font-medium">Интерактивная карта дилерских центров</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-white/10">
        <div className="container mx-auto px-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <img src="/__mockup/images/logo-white.png" alt="Дебрянск Авто" className="h-8 opacity-50 grayscale" />
          <div className="text-sm font-medium">
            © {new Date().getFullYear()} Дебрянск Авто. Все права защищены.
          </div>
          <div className="flex gap-6 text-sm font-medium">
            <a href="#" className="hover:text-white transition-colors">Политика конфиденциальности</a>
            <a href="#" className="hover:text-white transition-colors">Правовая информация</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
