import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("projects_user_idx").on(t.userId)]);

export const sourceDocuments = pgTable("source_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  blobPathname: text("blob_pathname").notNull(),
  extractedText: text("extracted_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("source_documents_project_idx").on(t.projectId)]);

export const chunks = pgTable("document_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").notNull().references(() => sourceDocuments.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
}, (t) => [index("chunks_document_idx").on(t.documentId)]);

export const analyses = pgTable("project_analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().unique().references(() => projects.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  answers: jsonb("answers").$type<Record<string, string>>().default({}).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const generatedDocuments = pgTable("generated_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("generated_documents_project_idx").on(t.projectId)]);

export const sections = pgTable("document_sections", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").notNull().references(() => generatedDocuments.id, { onDelete: "cascade" }),
  sectionKey: text("section_key").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  version: integer("version").notNull().default(1),
  isCurrent: boolean("is_current").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("sections_document_key_idx").on(t.documentId, t.sectionKey)]);

export const messages = pgTable("chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  sourceReferences: jsonb("source_references").$type<{ label: string; content: string }[]>().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("messages_project_idx").on(t.projectId)]);

export const modelCalls = pgTable("model_calls", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("model_calls_user_time_idx").on(t.userId, t.createdAt)]);
