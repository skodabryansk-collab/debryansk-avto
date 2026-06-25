import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";

const integerArray = customType<{ data: number[]; driverData: number[] }>({
  dataType() { return "integer[]"; },
  fromDriver(val) { return val as number[]; },
  toDriver(val) { return val; },
});

export const newsTable = pgTable("news", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  excerpt: text("excerpt"),
  content: text("content"),
  category: text("category").default("Новости"),
  image: text("image"),
  imageMobile: text("image_mobile"),
  slug: text("slug").unique().notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow(),
  readTime: integer("read_time").default(3),
  brandId: integer("brand_id"),
  brandIds: integerArray("brand_ids").default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type News = typeof newsTable.$inferSelect;
export type InsertNews = typeof newsTable.$inferInsert;
