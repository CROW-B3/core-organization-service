import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';

export type Organization = typeof schema.organization.$inferSelect;
export type Database = DrizzleD1Database<typeof schema>;

export const fetchOrganizationById = async (
  database: Database,
  organizationId: string
): Promise<Organization | null> => {
  const results = await database
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);

  return results[0] ?? null;
};

export const fetchOrganizationByBetterAuthId = async (
  database: Database,
  betterAuthOrgId: string
): Promise<Organization | null> => {
  const results = await database
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.betterAuthOrgId, betterAuthOrgId))
    .limit(1);

  return results[0] ?? null;
};

export const createOrganization = async (
  database: Database,
  betterAuthOrgId: string,
  name: string
): Promise<Organization> => {
  const existing = await fetchOrganizationByBetterAuthId(
    database,
    betterAuthOrgId
  );
  if (existing) return existing;

  const orgId = crypto.randomUUID();
  const now = Date.now();

  await database.insert(schema.organization).values({
    id: orgId,
    betterAuthOrgId,
    name,
    logo: null,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  return (await fetchOrganizationById(database, orgId))!;
};

export const activateOrganization = async (
  database: Database,
  organizationId: string
): Promise<void> => {
  await database
    .update(schema.organization)
    .set({ status: 'active', updatedAt: Date.now() })
    .where(eq(schema.organization.id, organizationId));
};
