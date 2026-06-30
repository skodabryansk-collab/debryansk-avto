import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const bonusProgramContent = pgTable("bonus_program_content", {
  id: serial("id").primaryKey(),
  heroTitle: text("hero_title").notNull().default("Бонусная программа Дебрянск Авто"),
  heroDescription: text("hero_description").notNull().default(""),
  perks: jsonb("perks").$type<Perk[]>().notNull().default([]),
  discountLevels: jsonb("discount_levels").$type<DiscountLevel[]>().notNull().default([]),
  redemptionRules: jsonb("redemption_rules").$type<string[]>().notNull().default([]),
  bonusActions: jsonb("bonus_actions").$type<BonusAction[]>().notNull().default([]),
  importantNotes: text("important_notes").default(""),
  fullRulesSections: jsonb("full_rules_sections").$type<RulesSection[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export interface Perk {
  icon: string;
  title: string;
  description: string;
}

export interface DiscountLevel {
  level: number;
  name: string;
  threshold: number;
  percent: number;
  color: string;
}

export interface BonusAction {
  title: string;
  items: string[];
}

export interface RulesSection {
  title: string;
  items: string[];
}

export type BonusProgramContent = typeof bonusProgramContent.$inferSelect;
