import { pgTable, serial, text, real, integer, boolean } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

export const locationsTable = pgTable("locations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  address: text("address").notNull(),
  mapX: real("map_x"),
  mapY: real("map_y"),
  phone: text("phone"),
  hours: text("hours"),
  sortOrder: integer("sort_order").default(0),
});

export const locationBrandsTable = pgTable("location_brands", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id")
    .notNull()
    .references(() => locationsTable.id, { onDelete: "cascade" }),
  brandId: integer("brand_id")
    .notNull()
    .references(() => brandsTable.id, { onDelete: "cascade" }),
  isService: boolean("is_service").default(false),
  sortOrder: integer("sort_order").default(0),
});

export type Location = typeof locationsTable.$inferSelect;
export type InsertLocation = typeof locationsTable.$inferInsert;
export type LocationBrand = typeof locationBrandsTable.$inferSelect;
