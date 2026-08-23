import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  name: text("name"),
  phone: text("phone"),
  email: text("email"),
  message: text("message"),
  car: text("car"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  extraJson: jsonb("extra_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type Lead = typeof leadsTable.$inferSelect;
export type InsertLead = typeof leadsTable.$inferInsert;
