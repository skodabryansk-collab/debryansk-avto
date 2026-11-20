import { pgTable, serial, text, boolean, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { carsTable } from "./cars";

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

export type ManagerClientNeed = {
  brand: string | null;
  model: string | null;
  undecided: boolean;
  budgetRange: string | null;
  plannedPurchaseDate: string | null;
};

export type ManagerClientCurrentCar = {
  brand: string;
  model: string;
  year: number;
  mileage: number;
  generation: string | null;
  bodyType: string | null;
  ownersCount: string | null;
  snapshot: Record<string, unknown> | null;
  tradeInPlan: string | null;
};

export type ManagerClientCardFieldChange = {
  field: string;
  oldValue: unknown;
  newValue: unknown;
};

export const managerClientCardsTable = pgTable("manager_client_cards", {
  id: serial("id").primaryKey(),
  managerId: integer("manager_id").notNull().references(() => managersTable.id, { onDelete: "restrict" }),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone").notNull(),
  clientGender: text("client_gender"),
  desiredBrand: text("desired_brand"),
  desiredModel: text("desired_model"),
  desiredVehicleUndecided: boolean("desired_vehicle_undecided").notNull().default(false),
  budgetRange: text("budget_range"),
  currentCar: text("current_car"),
  currentCarBrand: text("current_car_brand"),
  currentCarModel: text("current_car_model"),
  currentCarYear: integer("current_car_year"),
  currentCarMileage: integer("current_car_mileage"),
  currentCarGeneration: text("current_car_generation"),
  currentCarBodyType: text("current_car_body_type"),
  currentCarOwnersCount: text("current_car_owners_count"),
  currentCarInventoryId: integer("current_car_inventory_id").references(() => carsTable.id, { onDelete: "set null" }),
  currentCarSnapshot: jsonb("current_car_snapshot"),
  tradeInPlan: text("trade_in_plan"),
  needs: jsonb("needs").$type<ManagerClientNeed[]>().notNull().default([]),
  currentCars: jsonb("current_cars").$type<ManagerClientCurrentCar[]>().notNull().default([]),
  commercialBrand: text("commercial_brand"),
  commercialModel: text("commercial_model"),
  commercialCarId: integer("commercial_car_id").references(() => carsTable.id, { onDelete: "set null" }),
  commercialCarSnapshot: jsonb("commercial_car_snapshot"),
  paymentMethod: text("payment_method"),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const managerClientCardHistoryTable = pgTable("manager_client_card_history", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => managerClientCardsTable.id, { onDelete: "cascade" }),
  editorManagerId: integer("editor_manager_id").references(() => managersTable.id, { onDelete: "set null" }),
  editorName: text("editor_name").notNull(),
  editorRole: text("editor_role").notNull(),
  changes: jsonb("changes").$type<ManagerClientCardFieldChange[]>().notNull(),
  previousBrands: jsonb("previous_brands").$type<string[]>().notNull().default([]),
  currentBrands: jsonb("current_brands").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
export type ManagerClientCard = typeof managerClientCardsTable.$inferSelect;
export type ManagerClientCardHistory = typeof managerClientCardHistoryTable.$inferSelect;
export type SalesHeadManager = typeof salesHeadManagersTable.$inferSelect;
