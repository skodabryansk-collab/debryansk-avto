import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type News = typeof newsTable.$inferSelect;
export type InsertNews = typeof newsTable.$inferInsert;
