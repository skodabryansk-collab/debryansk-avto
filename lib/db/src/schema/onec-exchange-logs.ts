import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const onecExchangeLogsTable = pgTable(
  "onec_exchange_logs",
  {
    id: serial("id").primaryKey(),
    eventType: text("event_type").notNull(),
    endpoint: text("endpoint"),
    method: text("method").notNull(),
    httpStatus: integer("http_status"),
    outcome: text("outcome").notNull(),
    afterId: integer("after_id"),
    nextCursor: integer("next_cursor"),
    itemCount: integer("item_count").notNull().default(0),
    hasMore: boolean("has_more"),
    durationMs: integer("duration_ms"),
    errorCode: text("error_code"),
    requestId: text("request_id"),
    entityType: text("entity_type"),
    entityId: integer("entity_id"),
    entityName: text("entity_name"),
    previousCode: text("previous_code"),
    newCode: text("new_code"),
    actorLogin: text("actor_login"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index("onec_exchange_logs_created_at_idx").on(table.createdAt),
    index("onec_exchange_logs_event_created_at_idx").on(table.eventType, table.createdAt),
  ],
);

export type OneCExchangeLog = typeof onecExchangeLogsTable.$inferSelect;
export type InsertOneCExchangeLog = typeof onecExchangeLogsTable.$inferInsert;
