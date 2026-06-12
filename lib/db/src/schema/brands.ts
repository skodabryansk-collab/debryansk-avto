import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { z } from "zod";

export const brandsTable = pgTable("brands", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  websiteUrl: text("website_url"),
  logoUrl: text("logo_url"),
  bgColor: text("bg_color"),
  subName: text("sub_name"),
  isServiceOnly: boolean("is_service_only").default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const insertBrandSchema = z.object({
  name: z.string().min(1),
  websiteUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  bgColor: z.string().optional(),
  subName: z.string().optional(),
  isServiceOnly: z.boolean().optional(),
});

export const updateBrandSchema = insertBrandSchema.partial();

export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type Brand = typeof brandsTable.$inferSelect;
