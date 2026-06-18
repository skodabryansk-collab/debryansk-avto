import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const carsTable = pgTable("cars", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").notNull().unique(),
  type: text("type").notNull(),
  brand: text("brand"),
  model: text("model"),
  year: integer("year"),
  color: text("color"),
  price: integer("price"),
  mileage: integer("mileage").default(0),
  bodyType: text("body_type"),
  modification: text("modification"),
  complectation: text("complectation"),
  extras: text("extras"),
  description: text("description"),
  imageUrl: text("image_url"),
  ownersNumber: integer("owners_number"),
  vin: text("vin"),
  dealer: text("dealer"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  maxDiscount: integer("max_discount").notNull().default(0),
  creditDiscount: integer("credit_discount").notNull().default(0),
  tradeinDiscount: integer("tradein_discount").notNull().default(0),
});

export type Car = typeof carsTable.$inferSelect;
