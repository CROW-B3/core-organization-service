import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const organization = sqliteTable('organization', {
  id: text('id').primaryKey(),
  betterAuthOrgId: text('betterAuthOrgId').notNull().unique(),
  name: text('name').notNull(),
  logo: text('logo'),
  status: text('status').notNull().default('pending'),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
});

export const organizationContext = sqliteTable('organization_context', {
  id: text('id').primaryKey(),
  organizationId: text('organizationId').notNull(),
  crawlId: text('crawlId').notNull(),
  contextType: text('contextType').notNull().default('ai_generated_summary'),
  structuredData: text('structuredData', { mode: 'json' }).notNull(),
  generatedAt: integer('generatedAt', { mode: 'timestamp' }).notNull(),
});
