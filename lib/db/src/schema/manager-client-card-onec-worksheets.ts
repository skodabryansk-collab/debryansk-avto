import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { managerClientCardsTable } from "./managers";

export const managerClientCardOnecWorksheetsTable = pgTable("manager_client_card_onec_worksheets", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => managerClientCardsTable.id, { onDelete: "cascade" }),
  sourceKey: text("source_key").notNull(),
  organizationCode: text("organization_code").notNull(),
  departmentCode: text("department_code").notNull(),
  brandNames: jsonb("brand_names").$type<string[]>().notNull().default([]),
  contentHash: text("content_hash").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  dealerManager: text("onec_dealer_manager"),
  worksheetStatus: text("onec_worksheet_status"),
  archiveReason: text("onec_archive_reason"),
  onecUpdatedAt: timestamp("onec_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("manager_client_card_onec_worksheets_source_key_uidx").on(table.sourceKey),
  uniqueIndex("manager_client_card_onec_worksheets_division_uidx")
    .on(table.cardId, table.organizationCode, table.departmentCode),
  index("manager_client_card_onec_worksheets_active_id_idx").on(table.isActive, table.id),
  index("manager_client_card_onec_worksheets_card_active_idx").on(table.cardId, table.isActive),
]);

export const managerClientCardOnecChangesTable = pgTable("manager_client_card_onec_changes", {
  id: serial("id").primaryKey(),
  worksheetId: integer("worksheet_id")
    .notNull()
    .references(() => managerClientCardOnecWorksheetsTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("manager_client_card_onec_changes_worksheet_idx").on(table.worksheetId, table.id),
]);

export type ManagerClientCardOnecWorksheet = typeof managerClientCardOnecWorksheetsTable.$inferSelect;
export type ManagerClientCardOnecChange = typeof managerClientCardOnecChangesTable.$inferSelect;
