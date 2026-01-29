import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';

export type OrgBuilder = typeof schema.orgBuilder.$inferSelect;
export type Database = DrizzleD1Database<typeof schema>;

export const createOrgBuilderInDatabase = async (
  database: Database,
  builderId: string,
  betterAuthOrgId: string,
  organizationName: string,
  timestamp: Date
): Promise<string> => {
  await database.insert(schema.orgBuilder).values({
    id: builderId,
    betterAuthOrgId,
    name: organizationName,
    createdAt: timestamp,
  });

  return builderId;
};

export const fetchOrgBuilderById = async (
  database: Database,
  builderId: string
): Promise<OrgBuilder | null> => {
  const results = await database
    .select()
    .from(schema.orgBuilder)
    .where(eq(schema.orgBuilder.id, builderId))
    .limit(1);

  return results[0] ?? null;
};

export const markBuilderAsActive = async (
  database: Database,
  builderId: string
): Promise<void> => {
  await database
    .update(schema.orgBuilder)
    .set({ status: 'active' })
    .where(eq(schema.orgBuilder.id, builderId));
};

export const createOrganizationFromBuilder = async (
  database: Database,
  builder: OrgBuilder,
  slug: string,
  timestamp: Date
): Promise<string> => {
  const organizationId = crypto.randomUUID();

  await database.insert(schema.organization).values({
    id: organizationId,
    betterAuthOrgId: builder.betterAuthOrgId,
    name: builder.name,
    slug,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return organizationId;
};
