import { pgTable, serial, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod";

export const brandsTable = pgTable("brands", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").unique(),
  websiteUrl: text("website_url"),
  logoUrl: text("logo_url"),
  bgColor: text("bg_color"),
  subName: text("sub_name"),
  isServiceOnly: boolean("is_service_only").default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const brandPageContentTable = pgTable("brand_page_content", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id")
    .notNull()
    .unique()
    .references(() => brandsTable.id, { onDelete: "cascade" }),
  description: text("description"),
  serviceText: text("service_text"),
  promoText: text("promo_text"),
  advantages: jsonb("advantages").$type<{ icon: string; text: string }[]>().default([]),
  features: jsonb("features").$type<string[]>().default([]),
  faq: jsonb("faq").$type<{ question: string; answer: string; is_published?: boolean; include_in_schema?: boolean; sort_order?: number }[]>().default([]),
  heroImageUrl: text("hero_image_url"),
  heroImageMobileUrl: text("hero_image_mobile_url"),
  promotions: jsonb("promotions").$type<{ title: string; description: string; image?: string; badge?: string; expiresAt?: string; buttonText?: string; buttonUrl?: string; isActive?: boolean }[]>().default([]),
  models: jsonb("models").$type<{ id?: string; feedDealer: string; feedModel: string; displayName: string; image?: string; description?: string; badge?: string; isActive?: boolean; sort?: number }[]>().default([]),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const insertBrandSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  websiteUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  bgColor: z.string().optional(),
  subName: z.string().optional(),
  isServiceOnly: z.boolean().optional(),
});

export const updateBrandSchema = insertBrandSchema.partial();

export const insertBrandPageContentSchema = z.object({
  brandId: z.number(),
  description: z.string().optional(),
  serviceText: z.string().optional(),
  promoText: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
});

export const updateBrandPageContentSchema = insertBrandPageContentSchema.omit({ brandId: true }).partial();

export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type Brand = typeof brandsTable.$inferSelect;
export type BrandPageContent = typeof brandPageContentTable.$inferSelect;
