import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const calltouchCalls = pgTable("calltouch_calls", {
  id: serial("id").primaryKey(),
  callId: text("call_id").notNull().unique(),
  phoneNumber: text("phone_number"),
  trackingNumber: text("tracking_number"),
  source: text("source"),
  campaign: text("campaign"),
  landingPage: text("landing_page"),
  status: text("status").notNull().default("started"),
  durationSeconds: integer("duration_seconds"),
  callRecordingUrl: text("call_recording_url"),
  recordingStoredPath: text("recording_stored_path"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type CalltouchCall = typeof calltouchCalls.$inferSelect;
export type InsertCalltouchCall = typeof calltouchCalls.$inferInsert;
