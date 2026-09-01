import app from "./app";
import { logger } from "./lib/logger";
import { db, newsTable, brandsTable, usersTable, locationsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { runMigration } from "./migration";
import path from "path";
import { spawn } from "child_process";
import { setPrerendererRunning } from "./lib/chrome-semaphore";
import { scheduleCmDealerFuelSync } from "./services/cm-expert-dealer";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/* ── Canonical brand/dealer/news data ── */
const CANONICAL_BRANDS = [
  { name: "OMODA",         websiteUrl: "https://omoda-debryansk.ru",    logoUrl: "/uploads/logo-omoda.webp",    isServiceOnly: false },
  { name: "JAECOO",        websiteUrl: "https://jaecoo-debryansk.ru",   logoUrl: "/uploads/logo-jaecoo.webp",   isServiceOnly: false },
  { name: "Haval City",    websiteUrl: "https://debryansk-haval.ru",    logoUrl: "/uploads/logo-haval.svg",     isServiceOnly: false },
  { name: "Haval Pro",     websiteUrl: "https://debryansk-haval.pro",   logoUrl: "/uploads/logo-haval.svg",     isServiceOnly: false },
  { name: "Tenet",         websiteUrl: "https://tenet-debryansk.ru",    logoUrl: "/uploads/logo-tenet.webp",    isServiceOnly: false },
  { name: "Jetour",        websiteUrl: "https://jetour-mbbryansky.ru",  logoUrl: "/uploads/logo-jetour.svg",    isServiceOnly: false },
  { name: "Soueast",       websiteUrl: "https://soueast-debryansk.ru",  logoUrl: null,                          isServiceOnly: false },
  { name: "МБ-Брянск",     websiteUrl: "https://mb-debryansk.ru",       logoUrl: "/uploads/logo-mercedes.webp", isServiceOnly: false },
  { name: "С пробегом",    websiteUrl: "https://debryansk-avto.ru",     logoUrl: null,                          isServiceOnly: false },
  { name: "Volkswagen",    websiteUrl: null,                            logoUrl: null,                          isServiceOnly: true  },
  { name: "SKODA",         websiteUrl: null,                            logoUrl: null,                          isServiceOnly: true  },
  { name: "Exeed",         websiteUrl: null,                            logoUrl: null,                          isServiceOnly: true  },
  { name: "Mercedes-Benz", websiteUrl: "https://mb-debryansk.ru",       logoUrl: "/uploads/logo-mercedes.webp", isServiceOnly: true  },
];

const CANONICAL_NEWS = [
  { slug: "jaecoo-2026-lineup",     title: "Jaecoo запускает новую линейку: чего ждать от бренда в 2026 году", excerpt: "Jaecoo готовит пополнение линейки: два новых кроссовера и обновление для моделей J7 и J8.", content: "Jaecoo готовит пополнение линейки: два новых кроссовера и обновление для моделей J7 и J8. Дебрянск Авто уже принимает предзаказы.", category: "Новинки", image: "https://www.omodajaecoo.co.nz/sites/default/files/styles/accelerator_landscape_crop_16_9/public/2024-06/J7-Page-Gallery-Image-1-HD.jpg", publishedAt: new Date("2026-06-05"), readTime: 4 },
  { slug: "haval-jolion-update",    title: "Haval показал обновленный Haval Jolion: что изменилось", excerpt: "Обновленный Haval Jolion получил новый дизайн передней части, переработанный интерьер и расширенный список опций.", content: "Обновленный Haval Jolion получил новый дизайн передней части, переработанный интерьер и расширенный список опций.", category: "Новинки", image: "https://img-ik.cars.co.za/news-site-za/images/2024/04/2025-Haval-Jolion-Facelift-2.jpg", publishedAt: new Date("2026-05-28"), readTime: 3 },
  { slug: "auto-credit-two-docs",   title: "Как получить автокредит по двум документам: разбор программ в Брянске", excerpt: "Всё больше дилерских центров Брянска предлагают автокредитование по двум документам.", content: "Автокредитование по двум документам — один из самых востребованных продуктов.", category: "Финансы", image: "https://thumbs.dreamstime.com/b/panorama-view-car-dealer-handing-key-vehicle-model-to-customer-contract-signing-concept-auto-loan-finance-407833732.jpg", publishedAt: new Date("2026-05-20"), readTime: 5 },
  { slug: "trade-in-bryansk",       title: "Trade-in в Брянске: как получить максимальную выгоду от обмена", excerpt: "Эксперты делятся, как продать старый автомобиль по выгодной цене.", content: "Эксперты делятся, как продать старый автомобиль по выгодной цене.", category: "Советы", image: "https://di-uploads-pod30.dealerinspire.com/serratraversecity/uploads/2025/07/used-cars_5.jpg", publishedAt: new Date("2026-05-15"), readTime: 4 },
  { slug: "dilerskaya-akademiya-2026",      title: "Запуск программы «Дилерская академия»: обучение без опыта", excerpt: "Набираем 15 молодых менеджеров по продажам с обучением с нуля.", content: "Группа компаний «Дебрянск Авто» запускает программу «Дилерская академия» для молодых людей без опыта в автобизнесе.", category: "Жизнь компании", image: "https://www.cyberleadinc.com/wp-content/uploads/2019/01/Auto-Salesman-Training.jpeg", publishedAt: new Date("2026-05-10"), readTime: 3 },
  { slug: "haval-mekhaniki-kvalifikaciya-2026", title: "Автомеханикам дилера Haval — повышение квалификации", excerpt: "Дилерский центр Haval City запускает сертификационную программу для автомехаников.", content: "Дилерский центр Haval City в Брянске запускает сертификационную программу повышения квалификации для автомехаников.", category: "Жизнь компании", image: "https://apexlearning.org.uk/wp-content/uploads/2022/03/Car-Mechanic-and-Repair-Training-Diploma-1-1.webp", publishedAt: new Date("2026-04-22"), readTime: 3 },
  { slug: "letny-korporativ-2026",  title: "Летний корпоратив для всей команды дилера", excerpt: "Группа компаний организовала масштабный летний корпоратив на базе отдыха за городом.", content: "Этой весной группа компаний организовала масштабный летний корпоратив на базе отдыха за городом.", category: "Жизнь компании", image: "https://www.jamesevents.com/wp-content/uploads/2025/02/Picnic-Games-Corporate-Team-Building-Activities-1024x576.jpg", publishedAt: new Date("2026-04-05"), readTime: 3 },
  { slug: "kariernyj-rost-debryansk-2026", title: "Из администратора в зав. отделом: истории карьерного роста", excerpt: "Екатерина К. пришла в дилерский центр на позицию администратора. Через год возглавила отдел клиентского сервиса.", content: "Екатерина К. пришла в дилерский центр весной 2024 года на позицию администратора зоны приёма.", category: "Жизнь компании", image: null, publishedAt: new Date("2026-03-18"), readTime: 4 },
];

/* ── Seed database on first start only ── */
async function seedDatabase() {
  try {
    // ── Brands: only on empty table ──
    const existingBrands = await db.select().from(brandsTable).limit(1);
    if (existingBrands.length === 0) {
      for (const b of CANONICAL_BRANDS) {
        await db.insert(brandsTable).values(b).onConflictDoNothing();
      }
      logger.info("Brands seeded");
    } else {
      logger.info("Brands already exist — skipping seed");
    }

    // ── Locations + location_brands: only on empty table ──
    // Brands must be seeded first since location_brands references brand_id.
    const existingLocations = await db.select().from(locationsTable).limit(1);
    if (existingLocations.length === 0) {
      logger.info("Empty locations — seeding initial locations and brand links");

      await db.execute(sql`
        INSERT INTO locations (title, address, map_x, map_y, phone, hours, sort_order) VALUES
          ('Литейная',    'г. Брянск, ул. Литейная, 3/2',        53.304566, 34.266973, '+7 (4832) 63-10-00', 'Ежедневно 9:00–21:00', 1),
          ('Советская',  'г. Брянск, ул. Советская, 77',          53.256552, 34.345028, '+7 (4832) 63-10-00', 'Ежедневно 9:00–21:00', 2),
          ('Супонево',   'с. Супонево, ул. Шоссейная, 12Г',       53.215014, 34.309688, '+7 (4832) 63-10-00', 'Ежедневно 9:00–21:00', 3),
          ('Московский', 'г. Брянск, пр. Московский, 2Г',         53.221619, 34.373370, '+7 (4832) 63-10-00', 'Ежедневно 9:00–21:00', 4)
        ON CONFLICT (title) DO NOTHING
      `);

      // Литейная: Haval City (dealer)
      await db.execute(sql`
        INSERT INTO location_brands (location_id, brand_id, is_service, sort_order)
        SELECT l.id, b.id, false, 1 FROM locations l, brands b
        WHERE l.title='Литейная' AND b.name='Haval City' ON CONFLICT DO NOTHING`);
      // Советская: Tenet (dealer), Volkswagen (service)
      await db.execute(sql`
        INSERT INTO location_brands (location_id, brand_id, is_service, sort_order)
        SELECT l.id, b.id, false, 1 FROM locations l, brands b
        WHERE l.title='Советская' AND b.name='Tenet' ON CONFLICT DO NOTHING`);
      await db.execute(sql`
        INSERT INTO location_brands (location_id, brand_id, is_service, sort_order)
        SELECT l.id, b.id, true, 2 FROM locations l, brands b
        WHERE l.title='Советская' AND b.name='Volkswagen' ON CONFLICT DO NOTHING`);
      // Супонево: OMODA, JAECOO (dealer), SKODA, Exeed (service)
      await db.execute(sql`
        INSERT INTO location_brands (location_id, brand_id, is_service, sort_order)
        SELECT l.id, b.id, false, 1 FROM locations l, brands b
        WHERE l.title='Супонево' AND b.name='OMODA' ON CONFLICT DO NOTHING`);
      await db.execute(sql`
        INSERT INTO location_brands (location_id, brand_id, is_service, sort_order)
        SELECT l.id, b.id, false, 2 FROM locations l, brands b
        WHERE l.title='Супонево' AND b.name='JAECOO' ON CONFLICT DO NOTHING`);
      await db.execute(sql`
        INSERT INTO location_brands (location_id, brand_id, is_service, sort_order)
        SELECT l.id, b.id, true, 3 FROM locations l, brands b
        WHERE l.title='Супонево' AND b.name='SKODA' ON CONFLICT DO NOTHING`);
      await db.execute(sql`
        INSERT INTO location_brands (location_id, brand_id, is_service, sort_order)
        SELECT l.id, b.id, true, 4 FROM locations l, brands b
        WHERE l.title='Супонево' AND b.name='Exeed' ON CONFLICT DO NOTHING`);
      // Московский: Haval Pro, Jetour (dealer), Mercedes-Benz (service)
      await db.execute(sql`
        INSERT INTO location_brands (location_id, brand_id, is_service, sort_order)
        SELECT l.id, b.id, false, 1 FROM locations l, brands b
        WHERE l.title='Московский' AND b.name='Haval Pro' ON CONFLICT DO NOTHING`);
      await db.execute(sql`
        INSERT INTO location_brands (location_id, brand_id, is_service, sort_order)
        SELECT l.id, b.id, false, 2 FROM locations l, brands b
        WHERE l.title='Московский' AND b.name='Jetour' ON CONFLICT DO NOTHING`);
      await db.execute(sql`
        INSERT INTO location_brands (location_id, brand_id, is_service, sort_order)
        SELECT l.id, b.id, true, 3 FROM locations l, brands b
        WHERE l.title='Московский' AND b.name='Mercedes-Benz' ON CONFLICT DO NOTHING`);

      logger.info("Locations and brand links seeded");
    } else {
      // Always update isServiceOnly on existing brands from canonical list
      for (const b of CANONICAL_BRANDS) {
        await db.execute(sql`
          UPDATE brands SET is_service_only = ${b.isServiceOnly} WHERE name = ${b.name}
        `);
      }
      logger.info("Locations already exist — updated isServiceOnly flags from canonical list");
    }

    // ── News: only on empty table ──
    const existingNews = await db.select().from(newsTable).limit(1);
    if (existingNews.length === 0) {
      for (const n of CANONICAL_NEWS) {
        await db.insert(newsTable).values(n).onConflictDoNothing();
      }
      logger.info("News seeded");
    } else {
      logger.info("News already exist — skipping seed");
    }

    // ── Users: seed admin if no users ──
    const existingUsers = await db.select().from(usersTable).limit(1);
    if (existingUsers.length === 0) {
      const hash = await bcrypt.hash("test123", 10);
      await db.insert(usersTable).values({
        email: "test@example.com",
        password: hash,
        fullName: "Тестовый Пользователь",
        isActive: true,
        isAdmin: true,
      }).onConflictDoNothing();
      logger.info("Seeded admin user");
    }
  } catch (err) {
    logger.error({ err }, "Database seed error");
  }
}

let _prerenderChild: ReturnType<typeof spawn> | null = null;

function spawnPrerender(args: string[]): void {
  if (process.env.PRERENDER_ENABLED !== "true") return;
  if (_prerenderChild !== null) {
    logger.warn({ args }, "prerender: skipping spawn — another process is already running");
    return;
  }
  const scriptPath = path.resolve(__dirname, "../scripts/prerender.mjs");
  const child = spawn(process.execPath, [scriptPath, ...args], {
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });
  _prerenderChild = child;
  setPrerendererRunning(true);
  child.stdout?.on("data", (d: Buffer) =>
    logger.info({ src: "prerender" }, d.toString().trim()),
  );
  child.stderr?.on("data", (d: Buffer) =>
    logger.warn({ src: "prerender" }, d.toString().trim()),
  );
  child.on("exit", (code: number | null) => {
    _prerenderChild = null;
    setPrerendererRunning(false);
    logger.info({ code, args }, "prerender: script exited");
    if (code === 0 && process.env.PRERENDER_ENABLED === "true") {
      import("./middleware/prerender")
        .then(({ loadPrerenderCacheFromGCS }) => loadPrerenderCacheFromGCS())
        .catch(err => logger.warn({ err }, "prerender: cache reload after script failed"));
    }
  });
}

async function handlePrerenderAfterSync(
  stats: import("./services/car-sync").SyncStats,
): Promise<void> {
  if (process.env.PRERENDER_ENABLED !== "true") return;
  try {
    const { deletePrerendered } = await import("./lib/prerenderStorage");
    const { deletePrerenderCache } = await import("./middleware/prerender");

    for (const car of stats.removedCars) {
      const route =
        car.type === "new"
          ? `/new-cars/${encodeURIComponent(car.externalId)}`
          : `/cars/${encodeURIComponent(car.externalId)}`;
      await deletePrerendered(route);
      deletePrerenderCache(route);
      logger.info({ route }, "prerender: marked removed car as gone");
    }

    // Only re-render when cars are genuinely new — updates (price/availability changes)
    // don't justify a full 400+ page crawl every 30 minutes that exhausts the DB pool.
    if (stats.addedNewCarIds.length > 0 || stats.addedUsedCarIds.length > 0) {
      spawnPrerender(["--cars-only"]);
    }

  } catch (err) {
    logger.warn({ err }, "prerender: post-sync handler failed");
  }
}

async function handleIndexNowAfterSync(
  stats: import("./services/car-sync").SyncStats,
): Promise<void> {
  const { addedNewCarIds, addedUsedCarIds } = stats;
  if (!addedNewCarIds.length && !addedUsedCarIds.length) return;
  const urls = [
    ...addedNewCarIds.map(id => `https://debryansk-auto.ru/new-cars/${encodeURIComponent(id)}`),
    ...addedUsedCarIds.map(id => `https://debryansk-auto.ru/cars/${encodeURIComponent(id)}`),
  ];
  try {
    const { pingIndexNow } = await import("./services/indexnow");
    pingIndexNow(urls).catch(err => logger.warn({ err }, "[indexnow] ping failed"));
    logger.info({ newCount: addedNewCarIds.length, usedCount: addedUsedCarIds.length }, "[indexnow] queued ping for new cars");
  } catch (err) {
    logger.warn({ err }, "[indexnow] post-sync handler failed");
  }
}

async function main() {
  // Run migration first to fix schema mismatches
  await runMigration();
  // Then seed data
  await seedDatabase();

  // IndexNow: ping any STATIC_PAGES that haven't been pinged before
  // (auto-pings /service/bonus, /corporate, and any future additions on first deploy)
  import("./services/indexnow").then(({ pingNewStaticPages }) => {
    pingNewStaticPages().catch(err => logger.warn({ err }, "[indexnow] startup ping failed"));
  }).catch(err => logger.warn({ err }, "[indexnow] module load failed"));

  // Load TO catalog from DB (seeds from bundled JSON on first run)
  import("./services/to-catalog.service").then(({ initCatalog }) => {
    initCatalog()
      .then(() => logger.info("TO catalog ready"))
      .catch(err => logger.warn({ err }, "TO catalog init failed"));
  }).catch(err => logger.warn({ err }, "TO catalog module load failed"));

  // Initial car sync (non-blocking)
  import("./services/car-sync").then(({ syncCars }) => {
    syncCars()
      .then(stats => {
        logger.info(stats, "Startup car sync complete");
        scheduleCmDealerFuelSync("startup");
        handlePrerenderAfterSync(stats);
        handleIndexNowAfterSync(stats);
      })
      .catch(err => logger.warn({ err }, "Startup car sync failed"));

    // Sync every 30 minutes
    setInterval(() => {
      syncCars()
        .then(stats => {
          logger.info(stats, "Scheduled car sync complete");
          scheduleCmDealerFuelSync("scheduled");
          handlePrerenderAfterSync(stats);
          handleIndexNowAfterSync(stats);
        })
        .catch(err => logger.warn({ err }, "Scheduled car sync failed"));
    }, 30 * 60 * 1000);

    // Full prerender refresh every 6 hours (covers new brands, news, cars)
    setInterval(() => {
      if (process.env.PRERENDER_ENABLED === "true") {
        logger.info("Scheduled full prerender triggered");
        spawnPrerender([]);
      }
    }, 6 * 60 * 60 * 1000);
  }).catch(err => logger.warn({ err }, "Car sync module load failed"));

  // Reviews sync — initial full load if table empty, then every 8 hours
  import("./services/reviews-sync").then(({ syncAllReviews, syncRecentReviews }) => {
    db.execute(sql`SELECT COUNT(*)::int AS cnt FROM reviews`)
      .then(r => {
        const cnt = Number((r.rows[0] as any)?.cnt ?? 0);
        if (cnt === 0) {
          logger.info("[reviews-sync] Table is empty — running initial full sync");
          syncAllReviews()
            .then(s => logger.info(s, "[reviews-sync] Initial full sync done"))
            .catch(err => logger.warn({ err }, "[reviews-sync] Initial sync failed"));
        } else {
          logger.info({ cnt }, "[reviews-sync] Table has rows — running recent sync on startup");
          syncRecentReviews()
            .then(s => logger.info(s, "[reviews-sync] Startup recent sync done"))
            .catch(err => logger.warn({ err }, "[reviews-sync] Startup recent sync failed"));
        }
      })
      .catch(err => logger.warn({ err }, "[reviews-sync] Count check failed"));

    // Sync recent reviews every 8 hours
    setInterval(() => {
      syncRecentReviews()
        .then(s => logger.info(s, "[reviews-sync] Scheduled sync done"))
        .catch(err => logger.warn({ err }, "[reviews-sync] Scheduled sync failed"));
    }, 8 * 60 * 60 * 1000);
  }).catch(err => logger.warn({ err }, "[reviews-sync] Module load failed"));

  // Calltouch REST API sync — fetch today + yesterday on startup, then every 30 min
  import("./services/calltouch-sync").then(({ syncCalltouchCalls }) => {
    syncCalltouchCalls(1)
      .then(s => logger.info(s, "[calltouch-sync] Startup sync complete"))
      .catch(err => logger.warn({ err }, "[calltouch-sync] Startup sync failed"));

    setInterval(() => {
      syncCalltouchCalls(1)
        .then(s => logger.info(s, "[calltouch-sync] Scheduled sync complete"))
        .catch(err => logger.warn({ err }, "[calltouch-sync] Scheduled sync failed"));
    }, 30 * 60 * 1000);
  }).catch(err => logger.warn({ err }, "[calltouch-sync] Module load failed"));

  // Warm Navigator context cache on startup so the first user doesn't hit a cold cache
  import("./routes/chat").then(({ warmContext }) => {
    warmContext()
      .then(() => logger.info("Navigator context cache warmed"))
      .catch(err => logger.warn({ err }, "Navigator context cache warmup failed"));
  }).catch(err => logger.warn({ err }, "Chat module load failed"));

  // Seed FAQ data if table is empty (dev data doesn't auto-migrate to prod)
  import("./lib/seedFaqs").then(({ seedFaqsIfEmpty }) => {
    seedFaqsIfEmpty()
      .then(() => logger.info("[faq-seed] Startup check done"))
      .catch(err => logger.warn({ err }, "[faq-seed] Startup seed failed"));
  }).catch(err => logger.warn({ err }, "[faq-seed] Module load failed"));

  // Metrika daily report — 9:00 MSK (06:00 UTC)
  import("./services/metrika-report").then(({ scheduleMetrikaReport }) => {
    scheduleMetrikaReport();
  }).catch(err => logger.warn({ err }, "[metrika] Scheduler load failed"));

  // SEO positions — Webmaster API, weekly Sunday 10:00 MSK (07:00 UTC)
  // The evaluator also has its own daily catch-up scheduler. The weekly
  // callback is kept so fresh position data is evaluated immediately.
  import("./services/seo-positions").then(({ scheduleSeoPositions }) => {
    import("./services/seo-evaluator").then(({ runEvaluation, scheduleSeoEvaluation }) => {
      scheduleSeoEvaluation();
      scheduleSeoPositions(() => {
        runEvaluation()
          .then(r => logger.info(r, "[seo-evaluator] Evaluation triggered by positions fetch"))
          .catch(err => logger.error({ err }, "[seo-evaluator] Evaluation failed"));
      });
    }).catch(() => {
      scheduleSeoPositions(); // fallback without evaluator
    });
  }).catch(err => logger.warn({ err }, "[seo-positions] Scheduler load failed"));

  // Wordstat snapshot — weekly Wednesday 03:00 MSK (00:00 UTC)
  import("./services/wordstat").then(({ scheduleWordstatFetch }) => {
    scheduleWordstatFetch();
  }).catch(err => logger.warn({ err }, "[wordstat] Scheduler load failed"));

  // DB backup — nightly at 03:00 MSK, keep last 7 days in GCS
  import("./services/db-backup").then(({ scheduleDbBackup }) => {
    scheduleDbBackup();
  }).catch(err => logger.warn({ err }, "[db-backup] Scheduler load failed"));

  // Expire stale 'started' calls — if call-complete webhook never arrived
  const expireStuckCalls = () =>
    db.execute(sql`
      UPDATE calltouch_calls
      SET status = 'missed', completed_at = started_at
      WHERE status = 'started'
        AND started_at < NOW() - INTERVAL '2 hours'
    `).then(r => {
      const n = (r as any).rowCount ?? 0;
      if (n > 0) logger.info({ count: n }, "[calltouch] Expired stuck started calls");
    }).catch(err => logger.warn({ err }, "[calltouch] Expire stuck calls failed"));

  expireStuckCalls();
  setInterval(expireStuckCalls, 60 * 60 * 1000); // каждый час

  // Start server
  app.listen(port, () => {
    logger.info({ port }, "Server listening");

    if (process.env.PRERENDER_ENABLED === "true") {
      import("./middleware/prerender")
        .then(async ({ updatePrerenderCache, setCurrentAssetTags }) => {
          // Load fresh SSG HTML from dist/public into prerender cache
          // instead of stale GCS cache (GCS cache has old asset hashes)
          const { readFileSync, readdirSync, statSync, existsSync } = await import("fs");
          const { join } = await import("path");
          const distDir =
            process.env.FRONTEND_DIST_PATH ||
            join(__dirname, "../../debryansk-avto/dist/public");

          // Cache the current build's script/link asset tags once at startup
          // so cached snapshot HTML can always be rewritten to reference the
          // JS/CSS that actually exists on disk right now, regardless of
          // which build the snapshot itself was captured under.
          try {
            const rootIndexHtml = readFileSync(join(distDir, "index.html"), "utf-8");
            setCurrentAssetTags(rootIndexHtml);
          } catch (err) {
            logger.warn({ err }, "prerender: failed to read dist/public/index.html for asset tags");
          }

          // Always load Puppeteer cache from disk first — independent of distDir existence.
          // This ensures pages cached by prerender.mjs (brands, cars, etc.) are served
          // to bots even when the dist/ SSG files are unavailable.
          const { loadPrerenderCacheFromGCS: loadCacheEarly } = await import("./middleware/prerender");
          await loadCacheEarly().catch(err =>
            logger.warn({ err }, "prerender: early disk cache load failed (non-fatal)")
          );

          function findHtmlFiles(dir: string, prefix = ""): string[] {
            const entries = readdirSync(dir, { withFileTypes: true });
            const files: string[] = [];
            for (const entry of entries) {
              const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
              const full = join(dir, entry.name);
              if (entry.isDirectory()) {
                files.push(...findHtmlFiles(full, rel));
              } else if (entry.name.endsWith(".html")) {
                files.push(rel);
              }
            }
            return files;
          }

          // Only load truly-static SSG routes from dist/public.
          // All other routes (/, /cars, /new-cars, /brands/*, /cars/*, etc.) are
          // Puppeteer-rendered and live in GCS — loading shells from dist here
          // would block GCS from populating the cache (cache already-has check).
          const SSG_ONLY_ROUTES = new Set([
            "/vacancies", "/contacts", "/legal", "/privacy",
          ]);
          function isDistSsgRoute(route: string): boolean {
            if (SSG_ONLY_ROUTES.has(route)) return true;
            if (route.startsWith("/news/")) return true; // article pages have real SSG HTML
            return false;
          }

          const htmlFiles = findHtmlFiles(distDir);
          let loaded = 0;
          let skipped = 0;
          for (const file of htmlFiles) {
            if (file === "index.html") continue; // root SPA shell — skip
            const route = "/" + file.replace(/\/index\.html$/, "");
            if (!isDistSsgRoute(route)) continue; // let GCS handle dynamic/Puppeteer routes
            const html = readFileSync(join(distDir, file), "utf-8");
            // Guard: if dist HTML is < 5KB it's likely a SPA shell (no SSG
            // content generated for this route), don't overwrite a full
            // Puppeteer-cached page with it.
            const { getPrerenderCache } = await import("./middleware/prerender");
            const prerenderCache = getPrerenderCache();
            if (html.length < 5000 && prerenderCache.pages.has(route)) {
              skipped++;
              continue;
            }
            updatePrerenderCache(route, html);
            loaded++;
          }
          logger.info({ loaded }, "prerender: loaded fresh SSG HTML into cache");
          // Pre-load GCS before spawning prerender so dynamic routes (especially /)
          // are immediately available from the previous run, rather than waiting 30 min.
          const { loadPrerenderCacheFromGCS } = await import("./middleware/prerender");
          await loadPrerenderCacheFromGCS().catch(err =>
            logger.warn({ err }, "prerender: initial GCS pre-load failed (non-fatal)")
          );
          // Guard: skip startup prerender if DB is unhealthy — running Puppeteer
          // during a DB outage renders empty/broken pages and overwrites the good
          // GCS cache with broken HTML. We already loaded the GCS cache above, so
          // visitors are served from the last good run while DB recovers.
          let dbHealthy = false;
          try {
            await db.execute(sql`SELECT 1`);
            dbHealthy = true;
          } catch (err) {
            logger.warn({ err }, "prerender: startup prerender SKIPPED — DB health check failed");
          }

          // PRERENDER_STARTUP_SPAWN=false disables the full Chrome crawl on server start.
          // Useful on memory-constrained VPS (≤1GB) where startup Chrome causes OOM.
          // Cache is already loaded from disk above; cron handles periodic refresh.
          const startupSpawnEnabled = process.env.PRERENDER_STARTUP_SPAWN !== "false";

          if (dbHealthy && startupSpawnEnabled) {
            logger.info("prerender: triggering full prerender on startup (refreshes GCS cache)");
            spawnPrerender([]);
          } else if (!startupSpawnEnabled) {
            logger.info("prerender: startup spawn DISABLED (PRERENDER_STARTUP_SPAWN=false) — cache loaded from disk, cron handles refresh");
          } else {
            logger.warn("prerender: startup prerender deferred — will run on next scheduled cycle or manual trigger");
          }
        })
        .catch(err => logger.warn({ err }, "prerender: startup init failed"));
    }
  });
}

main();
