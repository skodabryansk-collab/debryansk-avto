import { db } from "./index";
import { newsTable, dealersTable, brandsTable } from "./schema";

const brandSeed = [
  { name: "OMODA", websiteUrl: "https://omoda.ru" },
  { name: "JAECOO", websiteUrl: "https://jaecoo.ru" },
  { name: "Haval", websiteUrl: "https://haval.ru" },
  { name: "Jetour", websiteUrl: "https://jetour.ru" },
  { name: "Mercedes-Benz", websiteUrl: "https://mercedes-benz.ru" },
  { name: "VW", websiteUrl: "https://vw.ru" },
  { name: "Skoda", websiteUrl: "https://skoda-auto.ru" },
  { name: "Tenet", websiteUrl: "https://tenet-auto.ru" },
];

const newsSeed = [
  { title: "Jaecoo запускает новую линейку: чего ждать от бренда в 2026 году", excerpt: "Jaecoo готовит пополнение линейки: два новых кроссовера и обновление для моделей J7 и J8.", content: "Jaecoo готовит пополнение линейки: два новых кроссовера и обновление для моделей J7 и J8.", category: "Новинки", image: "https://www.omodajaecoo.co.nz/sites/default/files/styles/accelerator_landscape_crop_16_9/public/2024-06/J7-Page-Gallery-Image-1-HD.jpg", slug: "jaecoo-2026-lineup", publishedAt: new Date("2026-06-05"), readTime: 4 },
  { title: "Haval показал обновленный Haval Jolion: что изменилось", excerpt: "Обновленный Haval Jolion получил новый дизайн передней части, переработанный интерьер и расширенный список опций.", content: "Обновленный Haval Jolion получил новый дизайн передней части, переработанный интерьер и расширенный список опций.", category: "Новинки", image: "https://img-ik.cars.co.za/news-site-za/images/2024/04/2025-Haval-Jolion-Facelift-2.jpg", slug: "haval-jolion-update", publishedAt: new Date("2026-05-28"), readTime: 3 },
  { title: "Как получить автокредит по двум документам: разбор программ в Брянске", excerpt: "Все более дилерских центров Брянска предлагают автокредитование по двум документам.", content: "Автокредитование по двум документам — сейчас один из самых востребованных продуктов.", category: "Финансы", image: "https://thumbs.dreamstime.com/b/panorama-view-car-dealer-handing-key-vehicle-model-to-customer-contract-signing-concept-auto-loan-finance-407833732.jpg", slug: "auto-credit-two-docs", publishedAt: new Date("2026-05-20"), readTime: 5 },
  { title: "Trade-in в Брянске: как получить максимальную выгоду от обмена", excerpt: "Эксперты делятся, как продать старый автомобиль по выгодной цене.", content: "Эксперты делятся, как продать старый автомобиль по выгодной цене.", category: "Советы", image: "https://di-uploads-pod30.dealerinspire.com/serratraversecity/uploads/2025/07/used-cars_5.jpg", slug: "trade-in-bryansk", publishedAt: new Date("2026-05-15"), readTime: 4 },
];

const dealerSeed = [
  { id: 1, address: "бул. Советская, 114", shortName: "Дебрянск Авто — Советская", phone: "+7 (4832) 63-10-00", hours: "Пн–Пт 09:00–20:00, Сб 09:00–18:00", brands: ["OMODA", "JAECOO", "Haval"], photoUrl: "https://images.unsplash.com/photo-1552519507-da3b14219c7e", mapX: 45, mapY: 55 },
  { id: 2, address: "ул. Шопкинская, 14", shortName: "Дебрянск Авто — Шопкинская", phone: "+7 (4832) 63-10-01", hours: "Пн–Пт 09:00–20:00, Сб 09:00–18:00", brands: ["Haval", "Jetour"], photoUrl: "https://images.unsplash.com/photo-1552519507-da3b14219c7e", mapX: 55, mapY: 45 },
  { id: 3, address: "московский пр-т, 23", shortName: "Дебрянск Авто — Московский", phone: "+7 (4832) 63-10-02", hours: "Пн–Пт 09:00–20:00", brands: ["Mercedes-Benz", "VW"], photoUrl: "https://images.unsplash.com/photo-1552519507-da3b14219c7e", mapX: 35, mapY: 60 },
  { id: 4, address: "ул. Литейная, 67", shortName: "Дебрянск Авто — Литейная", phone: "+7 (4832) 63-10-03", hours: "Пн–Пт 09:00–20:00, Сб 09:00–18:00", brands: ["Skoda", "Tenet"], photoUrl: "https://images.unsplash.com/photo-1552519507-da3b14219c7e", mapX: 60, mapY: 65 },
  { id: 5, address: "бул. Советская, 14А", shortName: "Сервисцентр", phone: "+7 (4832) 63-10-05", hours: "Пн–Пт 08:00–20:00, Сб 08:00–18:00", brands: ["Skoda", "VW", "Mercedes-Benz"], photoUrl: "https://images.unsplash.com/photo-1552519507-da3b14219c7e", mapX: 50, mapY: 50 },
  { id: 6, address: "ул. Дукату, 25", shortName: "Дебрянск Авто — Дукату", phone: "+7 (4832) 63-10-06", hours: "Пн–Пт 09:00–20:00", brands: ["OMODA", "Haval"], photoUrl: "https://images.unsplash.com/photo-1552519507-da3b14219c7e", mapX: 40, mapY: 40 },
];

async function seed() {
  for (const b of brandSeed) {
    await db.insert(brandsTable).values(b).onConflictDoNothing();
  }
  console.log(`Seeded ${brandSeed.length} brands`);

  for (const n of newsSeed) {
    await db.insert(newsTable).values(n).onConflictDoNothing();
  }
  console.log(`Seeded ${newsSeed.length} news articles`);

  for (const d of dealerSeed) {
    await db.insert(dealersTable).values(d).onConflictDoNothing();
  }
  console.log(`Seeded ${dealerSeed.length} dealers`);
}

seed().catch(console.error).finally(() => process.exit(0));
