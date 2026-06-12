import app from "./app";
import { logger } from "./lib/logger";
import { db, newsTable, brandsTable, usersTable, locationsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { runMigration } from "./migration";

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

async function main() {
  // Run migration first to fix schema mismatches
  await runMigration();
  // Then seed data
  await seedDatabase();
  // Start server
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

main();
