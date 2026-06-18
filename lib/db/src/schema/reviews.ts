import { pgTable, serial, text, integer, date, timestamp, doublePrecision, jsonb, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").notNull().unique(),
  author: text("author").notNull(),
  rating: integer("rating").notNull().default(5),
  text: text("text").notNull().default(""),
  date: date("date"),
  source: text("source"),
  sourceUrl: text("source_url"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
});

export const reviewsCacheTable = pgTable("reviews_cache", {
  id: integer("id").primaryKey().default(1),
  data: jsonb("data").notNull().default(sql`'[]'::jsonb`),
  avg: doublePrecision("avg").notNull().default(5),
  total: integer("total").notNull().default(0),
  overallCount: integer("overall_count").notNull().default(0),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow(),
});

export const reviewsMetaTable = pgTable("reviews_meta", {
  id: integer("id").primaryKey().default(1),
  overallCount: integer("overall_count").notNull().default(0),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }).defaultNow(),
});

export type Review = typeof reviewsTable.$inferSelect;
export type InsertReview = typeof reviewsTable.$inferInsert;
