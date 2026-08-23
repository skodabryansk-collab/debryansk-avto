not wait past
  // this ceiling with no marker at all, or the whole home route times out empty.
  const [prerenderFallback, setPrerenderFallback] = useState(false);
  useEffect(() => {
    // Fires well before Puppeteer's 20s [data-prerender-ready] wait ceiling
    // (prerender.mjs) — leaves margin for goto/hydration time so the marker
    // is guaranteed to exist before the selector wait gives up.
    const t = setTimeout(() => setPrerenderFallback(true), 9_000);
    return () => clearTimeout(t);
  }, []);
  const showPrerenderReady = isPrerenderReady || prerenderFallback;

  const openModal = useCallback((type: ModalType) => setModal(type), []);
  const closeModal = useCallback(() => setModal(null), []);

  // Contacts form (inline, not modal)
  const contactForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", phone: "", message: "" },
  });
  const { toast } = useToast();
  const onContactSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await sendEmail("callback", {
        name: values.name,
        phone: values.phone,
        message: values.message || "",
        location: "Советская",
      });
      ymGoal("lead_submit");
      toast({ title: "Заявка отправлена", description: "Мы свяжемся с вами в ближайшее время." });
      contactForm.reset();
    } catch (err) {
      toast({ title: "Ошибка", description: "Не удалось отправить заявку. Попробуйте позже." });
    }
  };

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex flex-col min-h-screen bg-white font-sans text-slate-900">
      {showPrerenderReady && (
        <div data-prerender-ready="true" style={{ display: "none" }} />
      )}

      <SEO
        title="Дебрянск Авто | Территория Автомобилей"
        description={`Группа компаний ${apiBrands.length || 13} брендов в Брянске. Продажа, сервис и финансирование с 2011 года. Новые автомобили и авто с пробегом.`}
        canonical="/"
        jsonLd={[
          organizationSchema,
          localBusinessSchema,
          webSiteSchema
        ]}
        breadcrumbs={[
          { name: "Главная", url: "/" },
        ]}
      />

      {/* ── Modal ──────────────────────────────────────────── */}
      {modal && modal !== "tradein" && <Modal type={modal} onClose={closeModal} />}
      {modal === "tradein" && <TradeInModal onClose={closeModal} />}

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#111317] text-white">
        {/* Top info bar */}
        <div className="border-b border-white/[0.07]">
          <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between h-10">
            <div className="flex items-center gap-4 text-[11px] font-medium text-white/40">
              <span>г. Брянск</span>
            </div>
            <div className="flex items-center gap-3">
              <CTPhone className="text-xs sm:text-sm font-bold text-white/70 hover:text-white transition-colors"
                phone={headerPhone} />
              <Button size="sm"
                className="h-7 sm:h-8 px-3 sm:px-4 brand-gradient border-0 text-white font-bold rounded-xl text-[11px] sm:text-xs hover:opacity-90"
                onClick={() => openModal("callback")}>
                Заказать звонок
              </Button>
            </div>
          </div>
        </div>

        {/* Main nav row */}
        <div className="container mx-auto px-4 sm:px-6 flex items-center gap-2 sm:gap-4 h-[3.75rem]">
          <motion.button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="shrink-0 relative h-8 flex items-center overflow-hidden"
            animate={{ width: scrolled ? 40 : 140 }}
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

          <nav className="hidden lg:flex items-center gap-0 ml-1 whitespace-nowrap">
            {/* Автомобили dropdown */}
            <div className="relative" onMouseLeave={() => setCarsDropdown(false)}>
              <button
                onMouseEnter={() => setCarsDropdown(true)}
                onClick={() => setCarsDropdown(v => !v)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCarsDropdown(v => !v); }
                  if (e.key === "Escape") setCarsDropdown(false);
                }}
                aria-haspopup="true"
                aria-expanded={carsDropdown}
                 className="flex shrink-0 items-center gap-1 px-2 py-2 text-xs font-semibold whitespace-nowrap text-white/60 hover:text-white hover:bg-white/8 rounded-xl transition-all">
                Автомобили <ChevronDown className={`w-3.5 h-3.5 transition-transform ${carsDropdown ? "rotate-180" : ""}`} />
              </button>
              {carsDropdown && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-[#1a1d23] border border-white/10 rounded-xl shadow-xl py-1 z-50">
                  <Link href="/new-cars" onClick={() => setCarsDropdown(false)}
                     className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-semibold text-white/70 hover:text-white hover:bg-white/8 transition-colors">
                    <Car className="w-4 h-4 text-[#0070b8]" /> Новые автомобили
                  </Link>
                  <Link href="/cars" onClick={() => setCarsDropdown(false)}
                     className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-semibold text-white/70 hover:text-white hover:bg-white/8 transition-colors">
                    <RotateCcw className="w-4 h-4 text-[#0070b8]" /> С пробегом
                  </Link>
                </div>
              )}
            </div>
            {[["О группе","about","/about"],["Для бизнеса","corporate","/corporate"],["Услуги","services","/service"],["Бонусы","bonus","/service/bonus"],["Выкуп","buyout","/buyout"],["Контакты","contacts","/contacts"]].map(([label, id, href]) => (
              <Link key={id} href={href}
                  className="shrink-0 px-2 py-2 text-xs font-semibold whitespace-nowrap text-white/60 hover:text-white hover:bg-white/8 rounded-xl transition-all">
                {label}
              </Link>
            ))}
            <Link href="/vacancies"
               className="shrink-0 px-2 py-2 text-xs font-semibold whitespace-nowrap text-white/60 hover:text-white hover:bg-white/8 rounded-xl transition-all">
              Вакансии
            </Link>
            <Link href="/news"
               className="shrink-0 px-2 py-2 text-xs font-semibold whitespace-nowrap text-white/60 hover:text-white hover:bg-white/8 rounded-xl transition-all">
              Новости
            </Link>
          </nav>

          <div className="flex-1" />

          <div className="hidden lg:flex items-center gap-2 mr-3">
            <Link href="/favorites"
              className="flex shrink-0 items-center gap-1.5 px-2 py-2 text-xs font-semibold whitespace-nowrap text-white/60 hover:text-white hover:bg-white/8 rounded-xl transition-all">
              <Heart className="w-3.5 h-3.5" />
              <span>Избранное</span>
              {favCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">{favCount}</span>
              )}
            </Link>
            <Link href="/compare"
              className="flex shrink-0 items-center gap-1.5 px-2 py-2 text-xs font-semibold whitespace-nowrap text-white/60 hover:text-white hover:bg-white/8 rounded-xl transition-all">
              <Scale className="w-3.5 h-3.5" />
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

        {/* Mobile menu dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-white/[0.07] bg-[#111317]">
              <div className="px-4 py-3 flex flex-col gap-0.5">
                <Link href="/new-cars" onClick={() => setMobileMenuOpen(false)}
                  className="text-left text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors flex items-center gap-2">
                  <Car className="w-4 h-4 text-[#0070b8]" /> Новые автомобили
                </Link>
                <Link href="/cars" onClick={() => setMobileMenuOpen(false)}
                  className="text-left text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-[#0070b8]" /> Автомобили с пробегом
                </Link>
                {[["О группе","about","/about"],["Для бизнеса","corporate","/corporate"],["Услуги","services","/service"],["Бонусы","bonus","/service/bonus"],["Выкуп","buyout","/buyout"],["Контакты","contacts","/contacts"]].map(([label, id, href]) => (
                  href.startsWith("/") ? (
                    <Link key={id} href={href}
                      className="text-left text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors block">
                      {label}
                    </Link>
                  ) : (
                    <button key={id} onClick={() => scrollTo(id)}
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
                  <CTPhone className="text-base font-bold text-[#0070b8]" phone={headerPhone} />
                  <div className="flex gap-2">
                    <a href="https://vk.com/debryanskavto" aria-label="ВКонтакте" target="_blank" rel="noopener noreferrer" className="w-11 h-11 rounded-full bg-white/8 flex items-center justify-center hover:bg-[#0070b8] transition-colors">
                      <SiVk size={14} />
                    </a>
                    <a href="https://t.me/debryanskavto" aria-label="Telegram" target="_blank" rel="noopener noreferrer" className="w-11 h-11 rounded-full bg-white/8 flex items-center justify-center hover:bg-[#0070b8] transition-colors">
                      <SiTelegram size={14} />
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Hero — full screen ─────────────────────────────── */}
      <section className="relative flex items-center justify-center overflow-hidden" style={{ minHeight: "100dvh" }}>
        {/* Background */}
        <div className="absolute inset-0">
          <picture>
            <source media="(max-width: 640px)" srcSet={heroMobile} />
            <img
              src={heroDynamic}
              alt="Автосалон Дебрянск Авто"
              className="w-full h-full object-cover object-center"
              loading="eager"
              decoding="async"
              onError={e => {
                e.currentTarget.src = "https://images.unsplash.com/photo-1567818735868-e71b99932e29?auto=format&fit=crop&q=85&w=1920";
              }}
            />
          </picture>
          {/* Dark overlay — heavier at top (under header) and bottom */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
          <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* Centred content */}
        <div className="relative z-10 w-full pt-[6rem] pb-8 sm:pt-[5.5rem] sm:pb-0">
          <div className="container mx-auto px-4 sm:px-6 flex flex-col items-center text-center">

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-[10px] sm:text-xs font-bold tracking-widest uppercase text-white/70 mb-5 sm:mb-7 border border-white/15"
            >
              Группа компаний
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={heroHeadlineContainer}
              initial="hidden"
              animate="visible"
              className="text-[2.6rem] sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight text-white mb-4 sm:mb-5 max-w-3xl"
            >
              <span className="block overflow-hidden sm:inline-block">
                <motion.span variants={heroHeadlineLine} className="inline-block sm:block">
                  Дебрянск Авто
                </motion.span>
              </span>{" "}
              <span className="block overflow-hidden sm:inline-block">
                <motion.span variants={heroHeadlineLine} className="inline-block sm:block">
                  <span className="brand-gradient-text">Территория Автомобилей.</span>
                </motion.span>
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-sm sm:text-base md:text-lg text-white/55 leading-relaxed max-w-md font-medium mb-8 sm:mb-10"
            >
              {apiBrands.length} брендов · 4 дилерских центра<br className="hidden sm:block" />{" "}
              Продажа, сервис и финансирование с 2011 года.
            </motion.p>

            {/* Quick-action tiles */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.55 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 w-full max-w-3xl"
            >
              {[
                { icon: Car,            label: "Новые авто",    sub: "В наличии и под заказ", type: null, href: "/new-cars" },
                { icon: RotateCcw,      label: "С пробегом",   sub: "Проверенные авто",       type: null, href: "/cars" },
                { icon: Wrench,         label: "Сервис",        sub: "Запись онлайн",          type: null, href: "/service" },
                { icon: Banknote,       label: "Выкуп авто",   sub: "Честная цена",           type: null, href: "/buyout" },
              ].map(({ icon: Icon, label, sub, type, href }) => {
                const cls = "bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 text-left hover:bg-white/18 hover:border-white/28 transition-all group active:scale-[0.98]";
                const inner = (
                  <>
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-[#0070b8] mb-2 group-hover:text-[#87b63c] transition-colors" />
                    <div className="font-bold text-white text-xs sm:text-sm leading-tight">{label}</div>
                    <div className="text-white/40 text-[10px] sm:text-xs mt-0.5 leading-snug">{sub}</div>
                  </>
                );
                const isExternal = href && href.startsWith("http");
                if (isExternal) return <a key={label} href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>;
                return href
                  ? <Link key={label} href={href} className={cls}>{inner}</Link>
                  : <button key={label} onClick={() => type && openModal(type)} className={cls}>{inner}</button>;
              })}
            </motion.div>

          </div>
        </div>

        {/* Scroll cue */}
        <motion.div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 text-white/25"
          animate={{ y: [0, 7, 0] }} transition={{ repeat: Infinity, duration: 2.2 }}>
          <ChevronRight className="rotate-90 w-5 h-5" />
        </motion.div>
      </section>

      {/* ── Brand logo tiles ───────────────────────────────── */}
      <section id="brands" className="py-14 sm:py-20 md:py-24 bg-white border-b border-slate-100">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 sm:gap-6">
            {apiBrands.map((b, i) => {
              const brandHref = !b.slug
                ? (b.websiteUrl ?? "#")
                : b.slug === "s-probegom"
                  ? "/cars"
                  : `/brands/${b.slug}`;
              const isExternal = !b.slug;
              return (
                <FadeIn key={`${b.name}-${b.subName ?? i}`} delay={i * 0.05}>
                  <a
                    href={brandHref}
                    {...(isExternal && b.websiteUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="group relative w-full block rounded-2xl overflow-hidden transition-all duration-500 hover:scale-[1.04] hover:-translate-y-1"
                    style={{ aspectRatio: "5/3" }}
                  >
                    {/* Card base */}
                    <div className="absolute inset-0 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] border border-slate-200/60 group-hover:shadow-[0_12px_40px_rgba(0,112,184,0.18),inset_0_1px_0_rgba(255,255,255,0.9)] group-hover:border-[#0070b8]/20 transition-all duration-500" />
                    {/* Gradient sheen */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white via-slate-50/50 to-blue-50/30" />
                    {/* Hover glow */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0070b8]/5 via-transparent to-emerald-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    {/* Top accent line */}
                    <div className="absolute top-0 left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-[#0070b8]/30 to-transparent rounded-full opacity-60 group-hover:opacity-100 group-hover:via-[#0070b8]/50 transition-all duration-500" />
                    {/* Content */}
                    <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4 sm:p-5">
                      {b.logoUrl ? (
                        <>
                          <img
                            src={b.logoUrl}
                            alt={b.name}
                            className="w-full object-contain transition-all duration-500 group-hover:scale-110 drop-shadow-[0_2px_4px_rgba(0,0,0,0.08)]"
                            style={{ maxWidth: "85%", maxHeight: "70%" }}
                            loading="lazy"
                            decoding="async"
                            onError={e => { e.currentTarget.style.display = "none"; }}
                          />
                          {b.subName && (
                            <span className="mt-1 text-[10px] sm:text-xs font-black tracking-widest uppercase text-slate-500 group-hover:text-[#0070b8] transition-colors duration-300">
                              {b.subName}
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full">
                          <Car className="w-8 h-8 sm:w-10 sm:h-10 text-[#0070b8]/70 mb-1.5 group-hover:text-[#0070b8] group-hover:scale-110 transition-all duration-300" />
                          <span className="text-xs sm:text-sm font-bold text-slate-600 group-hover:text-[#0070b8] text-center leading-tight transition-colors duration-300">{b.name}</span>
                        </div>
                      )}
                      {/* Arrow */}
                      <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[#0070b8]/0 group-hover:bg-[#0070b8]/10 flex items-center justify-center transition-all duration-300">
                        <ArrowUpRight className="w-4 h-4 text-[#0070b8] opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0" />
                      </div>
                      {/* Service badge */}
                      {b.isServiceOnly && (
                        <span className="absolute bottom-2.5 left-3 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#0070b8] bg-[#0070b8]/10 border border-[#0070b8]/20 rounded-md px-1.5 py-0.5 leading-none">
                          Сервис
                        </span>
                      )}
                      {/* Car count badge */}
                      {!b.isServiceOnly && !!b.carCount && b.carCount > 0 && (
                        <span className="absolute bottom-2.5 right-3 text-[9px] sm:text-[10px] font-semibold text-slate-400 group-hover:text-[#0070b8] transition-colors duration-300 leading-none">
                          {b.carCount} авто
                        </span>
                      )}
                    </div>
                  </a>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      <SpecialOffersSection onOpenModal={openModal} />

      {/* ── Used Cars showcase ─────────────────────────────── */}
      <UsedCarsSection />

      {/* ── About ── Apple Bento Glass ─────────────────────── */}
      <section id="about" className="relative overflow-hidden py-20 sm:py-28 md:py-32">
        {/* Градиентный темный фон */}
        <div className="absolute inset-0 bg-[#0a0c10]">
          <div className="absolute inset-0 opacity-40"
            style={{
              background: `
                radial-gradient(ellipse 60% 50% at 20% 80%, rgba(0,112,184,0.15) 0%, transparent 70%),
                radial-gradient(ellipse 50% 40% at 80% 20%, rgba(135,182,60,0.10) 0%, transparent 70%),
                radial-gradient(ellipse 40% 60% at 50% 50%, rgba(0,112,184,0.05) 0%, transparent 60%)
              `
            }} />
          <div className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, rgba(10,12,16,0) 0%, rgba(0,112,184,0.03) 50%, rgba(10,12,16,0) 100%)`
            }} />
        </div>

        {/* Сетка сверху */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }} />

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-10 sm:gap-14 items-center">

            {/* Левая колонка — логотип + слоган + описание */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <img
                src={logoWhiteSvg}
                alt="Дебрянск Авто"
                className="h-[47px] sm:h-[78px] w-auto mb-6 sm:mb-7"
              />
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight mb-4 sm:mb-5 text-white"
                style={{ textShadow: '0 2px 30px rgba(0,0,0,0.6)' }}>
                Территория автомобилей
                <br />
                <span className="text-[#87b63c]">в Брянске с 2011 года</span>
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8 max-w-md">
                Группа компаний с {apiBrands.length} официальными брендами.
                Продажа новых автомобилей, авто с пробегом,
                сервис и финансирование: всё в одном холдинге.
              </p>
              <button
                onClick={() => openModal("callback")}
                className="inline-flex items-center gap-2 brand-gradient text-white font-bold rounded-xl px-6 py-3 text-sm hover:opacity-90 transition-opacity"
              >
                Связаться с нами <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>

            {/* Правая колонка — Apple Glass tiles */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            >
                <div className="flex flex-col gap-3 sm:gap-4">
                {/* Широкая карточка — 15 лет */}
                 <div className="relative group h-full overflow-hidden rounded-2xl border border-white/[0.12]
                  bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent
                  backdrop-blur-xl hover:border-white/[0.18] transition-all duration-500">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                    style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,112,184,0.12) 0%, transparent 60%)` }} />
                   <div className="relative flex h-full flex-col p-6 sm:p-7">
                     <div className="flex items-center gap-3">
                       <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0070b8]/20">
                        <Building2 className="w-5 h-5 text-[#0070b8]" />
                      </div>
                       <div className="text-xs font-medium leading-5 text-slate-400">С 2011 года в Брянске</div>
                    </div>
                     <div className="mt-8 text-4xl font-extrabold leading-none tracking-[-0.03em] text-white sm:text-5xl">
                      15<span className="text-[#0070b8]">+</span>
                    </div>
                     <div className="mt-3 text-base font-bold leading-snug text-white">лет на рынке</div>
                  </div>
                </div>

                {/* Две узкие карточки */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                   <div className="relative group h-full overflow-hidden rounded-2xl border border-white/[0.12]
                    bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent
                    backdrop-blur-xl hover:border-white/[0.18] transition-all duration-500">
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                      style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(135,182,60,0.12) 0%, transparent 60%)` }} />
                     <div className="relative flex h-full flex-col p-5 sm:p-6">
                       <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#87b63c]/20">
                        <Car className="w-5 h-5 text-[#87b63c]" />
                      </div>
                       <div className="mt-7 text-[clamp(1.75rem,3.5vw,2.25rem)] font-extrabold leading-none tracking-[-0.035em] tabular-nums text-white">
                         {sales ? formatSalesNumber(sales.total) : "—"}
                      </div>
                       <div className="mt-3 text-sm font-bold leading-snug text-white">автомобилей продано</div>
                       <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[0.1] pt-4 text-[11px] leading-tight text-slate-400">
                         <span className="min-w-0">
                           <strong className="mb-1 block text-sm font-bold leading-none tabular-nums text-white/90">
                             {sales ? formatSalesNumber(sales.sales_new) : "—"}
                           </strong>
                           новых
                         </span>
                         <span className="min-w-0">
                           <strong className="mb-1 block text-sm font-bold leading-none tabular-nums text-white/90">
                             {sales ? formatSalesNumber(sales.sales_used) : "—"}
                           </strong>
                           с пробегом
                         </span>
                       </div>
                    </div>
                  </div>

                   <div className="relative group h-full overflow-hidden rounded-2xl border border-white/[0.12]
                    bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent
                    backdrop-blur-xl hover:border-white/[0.18] transition-all duration-500">
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                      style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,112,184,0.12) 0%, transparent 60%)` }} />
                     <div className="relative flex h-full flex-col p-5 sm:p-6">
                       <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0070b8]/20">
                        <Sparkles className="w-5 h-5 text-[#0070b8]" />
                      </div>
                       <div className="mt-7 text-3xl font-extrabold leading-none tracking-[-0.03em] tabular-nums text-white sm:text-4xl">
                        {apiBrands.length || 9}
                      </div>
                       <div className="mt-3 text-sm font-bold leading-snug text-white">брендов</div>
                       <div className="mt-1 text-[11px] leading-4 text-slate-400">официально</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── Services ───────────────────────────────────────── */}
      <section id="services" className="py-14 sm:py-20 md:py-24 bg-[#f8f9fb]">
        <div className="container mx-auto px-4 sm:px-6">

          {/* Section header */}
          <FadeIn className="mb-10 sm:mb-14">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2 sm:mb-3">Что мы предлагаем</p>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-8">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight">
                Наши услуги
              </h2>
              <p className="text-sm sm:text-base text-slate-500 max-w-sm sm:text-right leading-relaxed">
                Всё для вашего автомобиля:<br className="hidden sm:block" /> от покупки до обслуживания и финансирования.
              </p>
            </div>
          </FadeIn>

          {/* 3-column category panels */}
          <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
            {serviceCategories.map((cat, ci) => (
              <FadeIn key={cat.key} delay={ci * 0.1} className="flex flex-col">
                <div className="bg-white rounded-3xl overflow-hidden flex flex-col h-full shadow-sm border border-slate-100">

                  {/* Category header band */}
                  <div className="px-6 pt-6 pb-5"
                    style={{ borderBottom: `1px solid ${cat.color}18` }}>
                    <div className="flex items-center gap-3.5 mb-3">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: cat.color + "14" }}>
                        <cat.icon className="w-6 h-6" style={{ color: cat.color }} />
                      </div>
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-900 leading-tight">{cat.label}</h3>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">{cat.subtitle}</p>
                      </div>
                    </div>
                  </div>

                  {/* Service items list */}
                  <div className="flex-1 flex flex-col gap-0 divide-y divide-slate-50">
                    {cat.items.map((item, ii) => (
                      <button
                        key={ii}
                        onClick={() => openModal(item.modal)}
                        className="group flex items-start gap-3.5 px-5 py-4 text-left hover:bg-slate-50 transition-colors active:scale-[0.99]"
                      >
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-transform group-hover:scale-110"
                          style={{ backgroundColor: cat.color + "14" }}>
                          <item.icon className="w-4 h-4" style={{ color: cat.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-slate-900 leading-snug mb-0.5">{item.title}</p>
                          <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 shrink-0 mt-1 text-slate-200 group-hover:text-slate-400 transition-colors" />
                      </button>
                    ))}
                  </div>

                  {/* Category CTA */}
                  <div className="p-5 pt-4">
                    <button
                      onClick={() => openModal(cat.ctaModal)}
                      className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.99]"
                      style={{ background: `linear-gradient(135deg, ${cat.color} 0%, ${cat.color}cc 100%)` }}
                    >
                      {cat.cta}
                    </button>
                  </div>

                </div>
              </FadeIn>
            ))}
          </div>

          {/* CTA banner */}
          <FadeIn delay={0.35} className="mt-6 sm:mt-8">
            <div className="bg-[#0d0f14] rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-5">
              <div>
                <p className="font-extrabold text-white text-lg sm:text-xl mb-1">Не нашли нужную услугу?</p>
                <p className="text-slate-400 text-sm">Позвоните или оставьте заявку, ответим в течение 5 минут</p>
              </div>
              <Button
                className="brand-gradient text-white font-bold rounded-2xl px-8 py-3 hover:opacity-90 shrink-0 border-0 text-sm"
                onClick={() => openModal("callback")}
              >
                Оставить заявку
              </Button>
            </div>
          </FadeIn>

        </div>
      </section>

      {/* ── Territory of centers ───────────────────────────── */}
      <section id="dealers" className="py-14 sm:py-20 md:py-24 bg-slate-50">
        <div className="container mx-auto px-4 sm:px-6">
          <FadeIn className="mb-8 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold">Территория центров в городе</h2>
            <p className="text-slate-500 mt-2 text-sm sm:text-base">4 локации в Брянске, более 11 торгово-сервисных точек</p>
          </FadeIn>

          <div ref={mapSectionRef} className="relative isolate z-0 w-full h-[400px] sm:h-[500px] md:h-[600px] rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
            <YandexMap ref={yandexMapRef} locations={dealerMapLocations} />
          </div>

          {/* Dealer list below map */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 sm:mt-10">
            {dealerLocations.map((loc) => {
              const isActive = activeCardId === loc.id;
              return (
                <FadeIn key={loc.id} delay={loc.id * 0.08}>
                  <button
                    onClick={() => {
                      setActiveCardId(loc.id);
                      yandexMapRef.current?.openLocation(loc.id);
                      mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                    className={`w-full text-left bg-white rounded-2xl border p-4 sm:p-5 transition-all ${
                      isActive
                        ? "border-[#0070b8] shadow-[0_0_0_2px_rgba(0,112,184,0.18)] shadow-md"
                        : "border-slate-100 hover:shadow-md hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-white text-sm transition-transform ${isActive ? "scale-110" : ""}`}
                        style={{ background: loc.color }}>
                        {loc.id}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 leading-snug">{loc.short}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{loc.address}</p>
                        {loc.hours && (
                          <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-500">
                            <Clock className="w-3 h-3" />
                            {loc.hours}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {loc.brands.map(b => (
                            <span key={b} className="inline-block px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-blue-100 text-blue-700">
                              {b}
                            </span>
                          ))}
                          {(loc.serviceBrands ?? []).map(b => (
                            <span key={`svc-${b}`} className="inline-block px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-orange-100 text-orange-700">
                              {b} Сервис
                            </span>
                          ))}
                        </div>
                        {loc.phone && (
                          <CTPhone className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0070b8] hover:text-[#0058a0] transition-colors mt-3"
                            phone={normalizePhone(loc.phone) || loc.phone}>
                            <Phone className="w-3.5 h-3.5" />
                            {normalizePhone(loc.phone) || loc.phone}
                          </CTPhone>
                        )}
                      </div>
                    </div>
                  </button>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Contacts ───────────────────────────────────────── */}
      <section id="contacts" className="relative overflow-hidden py-20 sm:py-28 md:py-32">
        <div className="absolute inset-0 bg-[#0a0c10]">
          <div className="absolute inset-0 opacity-40"
            style={{
              background: `
                radial-gradient(ellipse 60% 50% at 80% 80%, rgba(0,112,184,0.15) 0%, transparent 70%),
                radial-gradient(ellipse 50% 40% at 20% 20%, rgba(135,182,60,0.10) 0%, transparent 70%),
                radial-gradient(ellipse 40% 60% at 50% 50%, rgba(0,112,184,0.05) 0%, transparent 60%)
              `
            }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0c10]/80" />
        </div>

        <div className="relative z-10 container mx-auto px-4 sm:px-6">
          <motion.div
            className="mb-10 sm:mb-14"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white">Свяжитесь с нами</h2>
          </motion.div>

          <div className="lg:grid lg:grid-cols-2 gap-10">
            {/* Left — Contact info cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex flex-col gap-3 sm:gap-4 mb-8 lg:mb-0">
                {/* Phone card */}
                <div className="relative group overflow-hidden rounded-3xl border border-white/[0.12]
                  bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent
                  backdrop-blur-xl hover:border-white/[0.18] transition-all duration-500">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                    style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,112,184,0.12) 0%, transparent 60%)` }} />
                  <div className="relative p-6 sm:p-8 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#0070b8]/20 flex items-center justify-center shrink-0">
                      <Phone className="w-5 h-5 text-[#0070b8]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase mb-1">Телефон</div>
                      <CTPhone className="text-xl sm:text-2xl font-extrabold text-white hover:text-[#0070b8] transition-colors"
                        phone={headerPhone} />
                    </div>
                  </div>
                </div>

                {/* Hours card */}
                <div className="relative group overflow-hidden rounded-3xl border border-white/[0.12]
                  bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent
                  backdrop-blur-xl hover:border-white/[0.18] transition-all duration-500">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                    style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(135,182,60,0.12) 0%, transparent 60%)` }} />
                  <div className="relative p-6 sm:p-8 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#87b63c]/20 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-[#87b63c]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase mb-1">Режим работы</div>
                      <div className="text-xl sm:text-2xl font-extrabold text-white">{commonHours}</div>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>

            {/* Right — Form in glass card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              className="relative group overflow-hidden rounded-3xl border border-white/[0.12]
                bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent
                backdrop-blur-xl hover:border-white/[0.18] transition-all duration-500"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(135,182,60,0.12) 0%, transparent 60%)` }} />
              <div className="relative p-6 sm:p-8 md:p-10">
                <h3 className="text-lg sm:text-xl font-extrabold text-white mb-5 sm:mb-6">Оставить заявку</h3>
                <Form {...contactForm}>
                  <form onSubmit={contactForm.handleSubmit(onContactSubmit)} className="space-y-3 sm:space-y-4">
                    <FormField control={contactForm.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300 text-sm font-semibold">Имя</FormLabel>
                        <FormControl>
                          <Input placeholder="Ваше имя" {...field}
                            className="bg-white/10 border-white/15 text-white placeholder:text-slate-500 rounded-xl h-11 sm:h-12 focus-visible:ring-[#0070b8] focus-visible:ring-offset-0" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={contactForm.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300 text-sm font-semibold">Телефон</FormLabel>
                        <FormControl>
                          <Input placeholder="+7 (___) ___-__-__" {...field}
                            type="tel" inputMode="tel" maxLength={18}
                            onChange={e => field.onChange(formatPhone(e.target.value))}
                            className="bg-white/10 border-white/15 text-white placeholder:text-slate-500 rounded-xl h-11 sm:h-12 focus-visible:ring-[#0070b8] focus-visible:ring-offset-0" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={contactForm.control} name="message" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300 text-sm font-semibold">Сообщение (необязательно)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Ваш вопрос или пожелание" {...field}
                            className="bg-white/10 border-white/15 text-white placeholder:text-slate-500 rounded-xl min-h-[80px] sm:min-h-[90px] focus-visible:ring-[#0070b8] focus-visible:ring-offset-0 resize-none" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" size="lg" data-testid="btn-submit-contact"
                      className="w-full brand-gradient border-0 text-white font-bold rounded-xl text-base hover:opacity-90 shadow-md">
                      Жду звонка
                    </Button>
                    <p className="text-[11px] text-slate-500 text-center leading-snug">Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности</p>
                  </form>
                </Form>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Reviews ─────────────────────────────────────────── */}
      <ReviewsSection />

      {/* ── Navigator AI teaser ─────────────────────────────── */}
      <section className="py-10 sm:py-12 bg-white border-t border-slate-100">
        <div className="container mx-auto px-4 sm:px-6">
          <div
            className="relative overflow-hidden rounded-2xl px-6 py-5 sm:px-8 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
            style={{ background: "linear-gradient(135deg, #0070b8 0%, #005a96 60%, #004880 100%)" }}
          >
            {/* Subtle decorative ring */}
            <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full border-[20px] border-white/5 pointer-events-none" />
            <div className="absolute right-16 bottom-[-24px] w-24 h-24 rounded-full border-[12px] border-white/5 pointer-events-none" />

            <div className="flex items-center gap-3 shrink-0">
              <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center">
                <Navigation className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-extrabold text-base sm:text-lg leading-tight">Навигатор: AI‑помощник по выбору авто</p>
              <p className="text-white/70 text-xs sm:text-sm mt-0.5">Подберёт автомобиль по бюджету, расскажет об условиях кредита и трейд-ин, запишет на тест-драйв</p>
            </div>
            <button
              onClick={() => {
                const event = new CustomEvent("navigator:open");
                window.dispatchEvent(event);
              }}
              className="shrink-0 bg-white text-[#0070b8] font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-white/90 transition-colors whitespace-nowrap flex items-center gap-2"
            >
              <Navigation className="w-4 h-4" />
              Спросить Навигатора
            </button>
          </div>
        </div>
      </section>

      {/* ── News ───────────────────────────────────────────── */}
      <HomeNewsSection />

      {/* ── Newsletter ─────────────────────────────────────── */}
      <section className="py-12 sm:py-16 bg-slate-50 border-t border-slate-100">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center">
            <FadeIn>
              <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">Подпишитесь на рассылку</h2>
              <p className="text-slate-500 mb-6 text-sm sm:text-base">Узнавайте первыми об акциях, новинках и специальных предложениях</p>
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="Ваш email"
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0070b8]/50 transition-colors"
                />
                <Button className="brand-gradient border-0 text-white font-bold rounded-xl px-6 hover:opacity-90 shrink-0">
                  Подписаться
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-3 leading-snug">
                Нажимая кнопку, вы соглашаетесь на получение рассылки и обработку персональных данных
              </p>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="bg-[#0d0f14] text-slate-400 pt-12 sm:pt-14 pb-8 border-t border-white/[0.07]">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 mb-10 sm:mb-12">
            <div className="col-span-2 sm:col-span-1 lg:col-span-1">
              <img src={logoPng} alt="Дебрянск Авто" className="h-8 sm:h-9 w-auto mb-4 sm:mb-5 opacity-50 hover:opacity-100 transition-opacity" />
              <p className="text-sm text-slate-500 mb-4 sm:mb-5 leading-relaxed">
                Территория Автомобилей. Группа компаний с {apiBrands.length || 13} брендами в Брянске с 2011 года.
              </p>
              <div className="flex gap-2.5">
                <a href="https://vk.com/debryanskavto" aria-label="ВКонтакте" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-[#0070b8] transition-colors group">
                  <SiVk className="text-white/40 group-hover:text-white" size={15} />
                </a>
                <a href="https://t.me/debryanskavto" aria-label="Telegram" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-[#0070b8] transition-colors group">
                  <SiTelegram className="text-white/40 group-hover:text-white" size={15} />
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-[10px] sm:text-xs tracking-widest uppercase text-white/70">Каталог</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/new-cars" className="hover:text-[#0070b8] transition-colors">Новые автомобили</a></li>
                <li><a href="/cars" className="hover:text-[#0070b8] transition-colors">Автомобили с пробегом</a></li>
                <li><a href="/buyout" className="hover:text-[#0070b8] transition-colors">Выкуп и комиссия</a></li>
                <li><a href="/compare" className="hover:text-[#0070b8] transition-colors">Сравнение авто</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-[10px] sm:text-xs tracking-widest uppercase text-white/70">Услуги</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/service" className="hover:text-[#0070b8] transition-colors">Сервис и ТО</a></li>
                <li><a href="/about" className="hover:text-[#0070b8] transition-colors">О группе</a></li>
                {[
                  { label: "Haval City", href: "/new-cars?dealer=Haval%20City" },
                  { label: "Haval Pro", href: "/new-cars?dealer=Haval%20Pro" },
                  { label: "Jetour", href: "/new-cars?dealer=Jetour" },
                  { label: "Omoda", href: "/new-cars?dealer=Omoda" },
                  { label: "Jaecoo", href: "/new-cars?dealer=Jaecoo" },
                  { label: "Tenet", href: "/new-cars?dealer=Tenet" },
                  { label: "Soueast", href: "/new-cars?dealer=Soueast" },
                  { label: "Jeland", href: "/new-cars?dealer=Jeland" },
                ].map(b => (
                  <li key={b.label}>
                    <a href={b.href} className="hover:text-[#0070b8] transition-colors">{b.label}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-[10px] sm:text-xs tracking-widest uppercase text-white/70">Компания</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/contacts" className="hover:text-[#0070b8] transition-colors">Контакты</a></li>
                <li><a href="/vacancies" className="hover:text-[#0070b8] transition-colors">Вакансии</a></li>
                <li><a href="/news" className="hover:text-[#0070b8] transition-colors">Новости</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-6 sm:pt-8 border-t border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <p>© {new Date().getFullYear()} Дебрянск Авто · Территория Автомобилей</p>
            <a href="/privacy" className="hover:text-white transition-colors">Политика конфиденциальности</a>
          </div>
        </div>
      </footer>

      <ChatWidget onOpenCallback={() => setModal("callback")} />

      <FaqBlock pageSlug="main" />
    </div>
  );
}
