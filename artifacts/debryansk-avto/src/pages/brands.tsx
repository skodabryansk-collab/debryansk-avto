import { useQuery } from "@tanstack/react-query";
import { Car, ChevronRight, Wrench } from "lucide-react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";

type Brand = {
  id: number;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  isServiceOnly: boolean;
  carCount: number;
};

type BrandGroup = {
  title: string;
  description: string;
  icon: typeof Car;
  items: Array<Brand & { href: string; displayName: string }>;
};

async function fetchBrands(): Promise<Brand[]> {
  const response = await fetch("/api/brands");
  if (!response.ok) throw new Error("Не удалось загрузить бренды");
  const payload = await response.json();
  return payload.ok ? payload.data as Brand[] : [];
}

function groupBrands(brands: Brand[]): BrandGroup[] {
  const groups: BrandGroup[] = [
    {
      title: "Новые автомобили",
      description: "Официальные дилерские страницы с моделями, актуальными предложениями и записью на тест-драйв.",
      icon: Car,
      items: [],
    },
    {
      title: "Автомобили с пробегом",
      description: "Проверенные автомобили с пробегом — в отдельном каталоге с актуальным наличием и ценами.",
      icon: Car,
      items: [],
    },
    {
      title: "Сервисные бренды",
      description: "Официальный сервис, ТО, ремонт и оригинальные запчасти для указанных марок.",
      icon: Wrench,
      items: [],
    },
  ];

  for (const brand of brands) {
    if (!brand.slug || brand.slug === "mb-bryansk") continue;

    const isUsedCars = brand.slug === "s-probegom" || /пробег/i.test(brand.name);
    const groupIndex = brand.isServiceOnly ? 2 : isUsedCars ? 1 : 0;
    groups[groupIndex].items.push({
      ...brand,
      displayName: isUsedCars ? "Автомобили с пробегом" : brand.name,
      href: isUsedCars ? "/cars" : `/brands/${brand.slug}`,
    });
  }

  return groups.filter((group) => group.items.length > 0);
}

export default function BrandsPage() {
  const { data: brands = [], isLoading, isError } = useQuery({
    queryKey: ["public-brands"],
    queryFn: fetchBrands,
    staleTime: 60 * 60 * 1000,
    retry: 0,
  });
  const groups = groupBrands(brands);
  const itemList = groups.flatMap((group) => group.items).map((brand, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: brand.displayName,
    url: `https://debryansk-auto.ru${brand.href}`,
  }));

  return (
    <Layout>
      <SEO
        title="Бренды автомобилей и официальный сервис в Брянске — Дебрянск Авто"
        description="Официальные дилеры новых автомобилей и сервисные бренды в Брянске. Каталог автомобилей с пробегом, адреса дилерских центров и актуальные предложения Дебрянск Авто."
        canonical="/brands"
        jsonLd={{
          "@type": "CollectionPage",
          name: "Бренды автомобилей и сервис Дебрянск Авто",
          description: "Официальные дилеры новых автомобилей, сервисные бренды и автомобили с пробегом в Брянске.",
          url: "https://debryansk-auto.ru/brands",
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: itemList.length,
            itemListElement: itemList,
          },
        }}
        breadcrumbs={[
          { name: "Главная", url: "/" },
          { name: "Бренды", url: "/brands" },
        ]}
      />

      <main className="flex-1 pt-24 pb-16 sm:pt-32 sm:pb-24">
        <section className="bg-slate-950 text-white">
          <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#87b63c]">Дебрянск Авто · Брянск</p>
            <h1 className="max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">
              Бренды автомобилей и сервис Дебрянск Авто в Брянске
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-white/70 sm:text-lg">
              Выберите официальный дилерский центр новых автомобилей, сервисный бренд или перейдите в отдельный каталог автомобилей с пробегом.
            </p>
          </div>
        </section>

        <section className="container mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
          {isLoading ? (
            <div className="grid gap-5 md:grid-cols-3" aria-label="Загрузка брендов">
              {[0, 1, 2].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl bg-slate-100" />)}
            </div>
          ) : isError || groups.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <p className="font-semibold text-slate-800">Список брендов временно недоступен.</p>
              <Link href="/contacts" className="mt-3 inline-block font-bold text-[#0070b8] hover:underline">Связаться с нами</Link>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-3">
              {groups.map((group) => {
                const Icon = group.icon;
                return (
                  <section key={group.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="mb-5 flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0070b8]/10 text-[#0070b8]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <h2 className="text-lg font-extrabold text-slate-900">{group.title}</h2>
                    </div>
                    <p className="mb-5 text-sm leading-relaxed text-slate-500">{group.description}</p>
                    <ul className="divide-y divide-slate-100">
                      {group.items.map((brand) => (
                        <li key={brand.slug}>
                          <Link href={brand.href} className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                            <span className="flex h-9 w-14 shrink-0 items-center justify-center rounded border border-slate-100 bg-white px-1">
                              {brand.logoUrl ? (
                                <img src={brand.logoUrl} alt={`Логотип ${brand.displayName}`} className="max-h-6 max-w-12 object-contain" loading="lazy" />
                              ) : (
                                <span className="text-[10px] font-bold text-slate-500">{brand.displayName}</span>
                              )}
                            </span>
                            <span className="min-w-0 flex-1 text-sm font-bold text-slate-800 group-hover:text-[#0070b8]">{brand.displayName}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#0070b8]" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </Layout>
  );
}