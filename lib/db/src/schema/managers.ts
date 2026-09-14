import { pgTable, serial, text, boolean, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const managersTable = pgTable("managers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  login: text("login").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").default(true),
  photoUrl: text("photo_url"),
  brands: jsonb("brands").$type<string[]>(),
  registrationPending: boolean("registration_pending").default(false),
  tempPassword: text("temp_password"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const quotesTable = pgTable("quotes", {
  id: serial("id").primaryKey(),
  managerId: integer("manager_id").notNull().references(() => managersTable.id),
  carId: text("car_id").notNull(),
  carType: text("car_type").notNull(),
  carSnapshot: jsonb("car_snapshot").notNull(),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone").notNull(),
  clientGender: text("client_gender"),
  extraAddToRrp: boolean("extra_add_to_rrp").default(false),
  discounts: jsonb("discounts").notNull().default([]),
  priceOriginal: integer("price_original").notNull(),
  priceFinal: integer("price_final").notNull(),
  validUntil: text("valid_until").notNull(),
  extraEquipment: jsonb("extra_equipment"),
  creditOffer: jsonb("credit_offer"),
  tradeIn: jsonb("trade_in"),
  pdfUrl: text("pdf_url"),
  shareTokenHash: text("share_token_hash"),
  shareTokenExpiresAt: timestamp("share_token_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const salesHeadManagersTable = pgTable("sales_head_managers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  position: text("position").notNull().default("Руководитель отдела продаж"),
  phone: text("phone"),
  email: text("email"),
  brands: jsonb("brands").$type<string[]>().notNull().default([]),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type Manager = typeof managersTable.$inferSelect;
export type Quote = typeof quotesTable.$inferSelect;
export type SalesHeadManager = typeof salesHeadManagersTable.$inferSelect;
