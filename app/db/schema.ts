import { pgTable, uuid, timestamp, text } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  link: text("link"),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const clockInRecords = pgTable("clock_in_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  shiftId: uuid("shift_id").notNull(),
  projectId: uuid("project_id").references(() => projects.id),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const clockOutRecords = pgTable("clock_out_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  shiftId: uuid("shift_id").notNull(),
  projectId: uuid("project_id").references(() => projects.id),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Types for TypeScript
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type ClockInRecord = typeof clockInRecords.$inferSelect;
export type NewClockInRecord = typeof clockInRecords.$inferInsert;

export type ClockOutRecord = typeof clockOutRecords.$inferSelect;
export type NewClockOutRecord = typeof clockOutRecords.$inferInsert; 