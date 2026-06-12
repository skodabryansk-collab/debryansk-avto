import { pgTable, serial, text, real, boolean } from "drizzle-orm/pg-core";

export const dealersTable = pgTable("dealers", {
  id: serial("id").primaryKey(),
  address: text("address").notNull(),
  shortName: text("short_name").notNull(),
  phone: text("phone"),
  hours: text("hours"),
  brands: text("brands").array(),
  photoUrl: text("photo_url"),
  mapX: real("map_x"),
  mapY: real("map_y"),
  email: text("email"),
  isService: boolean("is_service").default(false),
  services: text("services").array(),
});

export type Dealer = typeof dealersTable.$inferSelect;
export type InsertDealer = typeof dealersTable.$inferInsert;
