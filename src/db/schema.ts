import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const orgBuilder = sqliteTable('org_builder', {
  id: text('id').primaryKey(),
  betterAuthOrgId: text('betterAuthOrgId').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

export const organization = sqliteTable('organization', {
  id: text('id').primaryKey(),
  betterAuthOrgId: text('betterAuthOrgId').notNull().unique(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
});
