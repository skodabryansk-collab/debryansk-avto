import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";

const integerArray = customType<{ data: number[]; driverData: number[] }>({
  dataType() { return "integer[]"; },
  fromDriver(val) { return val as number[]; },
  toDriver(val) { return val; },
});

export const promotionsTable = pgTable("promotions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  image: text("image"),
  badge: text("badge"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  buttonText: text("button_text"),
  buttonUrl: text("button_url"),
  brandIds: integerArray("brand_ids").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type Promotion = typeof promotionsTable.$inferSelect;
export type InsertPromotion = typeof promotionsTable.$inferInsert;
