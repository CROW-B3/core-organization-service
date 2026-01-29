import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { desc, eq } from 'drizzle-orm';
import * as schema from '../db/schema';

export type OrganizationContext =
  typeof schema.organizationContext.$inferSelect;
export type Database = DrizzleD1Database<typeof schema>;

export const createOrganizationContext = async (
  database: Database,
  organizationId: string,
  crawlId: string,
  structuredData: Record<string, unknown>,
  generatedAt: Date
): Promise<OrganizationContext> => {
  const id = crypto.randomUUID();

  const result = await database
    .insert(schema.organizationContext)
    .values({
      id,
      organizationId,
      crawlId,
      contextType: 'ai_generated_summary',
      structuredData,
      generatedAt,
    })
    .returning();

  return result[0];
};

export const fetchContextByOrganizationId = async (
  database: Database,
  organizationId: string
): Promise<OrganizationContext | null> => {
  const results = await database
    .select()
    .from(schema.organizationContext)
    .where(eq(schema.organizationContext.organizationId, organizationId))
    .orderBy(desc(schema.organizationContext.generatedAt))
    .limit(1);

  return results[0] ?? null;
};

export const fetchContextByCrawlId = async (
  database: Database,
  crawlId: string
): Promise<OrganizationContext | null> => {
  const results = await database
    .select()
    .from(schema.organizationContext)
    .where(eq(schema.organizationContext.crawlId, crawlId))
    .limit(1);

  return results[0] ?? null;
};
