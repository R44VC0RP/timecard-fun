import { pgTable, uuid, timestamp, text, decimal, integer, boolean, index } from "drizzle-orm/pg-core";

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

export const userConfig = pgTable("user_config", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique(),
  businessName: text("business_name"),
  fullName: text("full_name"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  logoUrl: text("logo_url"),
  taxId: text("tax_id"), // For VAT/GST/EIN numbers
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const invoiceSettings = pgTable("invoice_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique(),
  defaultHourlyRate: decimal("default_hourly_rate", { precision: 10, scale: 2 }),
  currency: text("currency").default("USD").notNull(),
  paymentTerms: text("payment_terms"),
  defaultNotes: text("default_notes"),
  defaultDueDate: integer("default_due_date").default(30), // Days after invoice date
  invoiceNumberPrefix: text("invoice_number_prefix").default("INV-"),
  invoiceNumberSuffix: text("invoice_number_suffix"),
  nextInvoiceNumber: integer("next_invoice_number").default(1),
  showProjectTotals: boolean("show_project_totals").default(true),
  showHourlyBreakdown: boolean("show_hourly_breakdown").default(true),
  dateFormat: text("date_format").default("MM/DD/YYYY"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projectRates = pgTable("project_rates", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id).notNull(),
  userId: text("user_id").notNull(),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  status: text("status").default("draft").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index("invoices_user_id_idx").on(table.userId),
  };
});

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  rate: decimal("rate", { precision: 10, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    invoiceIdIdx: index("invoice_line_items_invoice_id_idx").on(table.invoiceId),
    projectIdIdx: index("invoice_line_items_project_id_idx").on(table.projectId),
  };
});

// Types for TypeScript
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type ClockInRecord = typeof clockInRecords.$inferSelect;
export type NewClockInRecord = typeof clockInRecords.$inferInsert;

export type ClockOutRecord = typeof clockOutRecords.$inferSelect;
export type NewClockOutRecord = typeof clockOutRecords.$inferInsert;

export type UserConfig = typeof userConfig.$inferSelect;
export type NewUserConfig = typeof userConfig.$inferInsert;

export type InvoiceSettings = typeof invoiceSettings.$inferSelect;
export type NewInvoiceSettings = typeof invoiceSettings.$inferInsert;

export type ProjectRate = typeof projectRates.$inferSelect;
export type NewProjectRate = typeof projectRates.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert; 