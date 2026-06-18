import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  boolean,
  date,
  jsonb,
} from "drizzle-orm/pg-core";

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
});

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
});

export const journeys = pgTable("journeys", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id).notNull(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  serviceType: varchar("service_type", { length: 100 }),
  status: varchar("status", { length: 50 }).notNull().default("aguardando"),
  documents: jsonb("documents").default("[]"),
  aepFiles: jsonb("aep_files").default("[]"),
  reportUrl: varchar("report_url", { length: 1024 }),
  riskMapUrl: varchar("risk_map_url", { length: 1024 }),
  actionPlanUrl: varchar("action_plan_url", { length: 1024 }),
});

export const uploads = pgTable("uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  journeyId: uuid("journey_id").references(() => journeys.id),
  companyId: uuid("company_id").references(() => companies.id),
  clientId: uuid("client_id").references(() => clients.id),
  uploaderId: uuid("uploader_id"),
  uploaderType: varchar("uploader_type", { length: 50 }),
  category: varchar("category", { length: 100 }),
  originalName: varchar("original_name", { length: 255 }),
  uniqueName: varchar("unique_name", { length: 255 }),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
