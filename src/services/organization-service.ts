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
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  return (await fetchOrganizationById(database, orgId))!;
};

export const updateOrganization = async (
  database: Database,
  organizationId: string,
  updates: { name?: string; logo?: string | null }
): Promise<Organization | null> => {
  const existing = await fetchOrganizationById(database, organizationId);
  if (!existing) return null;

  const fields: Partial<typeof schema.organization.$inferInsert> = {
    updatedAt: Date.now(),
  };
  if (updates.name !== undefined) fields.name = updates.name;
  if (updates.logo !== undefined) fields.logo = updates.logo;

  await database
    .update(schema.organization)
    .set(fields)
    .where(eq(schema.organization.id, organizationId));

  return fetchOrganizationById(database, organizationId);
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

export const validateOnboardingPayload = (body: {
  organizationName: string;
  ownerEmail: string;
  ownerName: string;
}): string | null => {
  if (!body.organizationName) return 'organizationName is required';
  if (!body.ownerEmail) return 'ownerEmail is required';
  if (!body.ownerName) return 'ownerName is required';
  return null;
};

export const createOrganizationRecord = async (
  database: Database,
  name: string
): Promise<Organization> => {
  const orgId = crypto.randomUUID();
  const now = Date.now();

  await database.insert(schema.organization).values({
    id: orgId,
    betterAuthOrgId: orgId,
    name,
    logo: null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  return (await fetchOrganizationById(database, orgId))!;
};

export interface OwnerUser {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: string;
}

export const createOwnerUser = async (
  userServiceUrl: string,
  email: string,
  name: string,
  organizationId: string,
  internalGatewayKey: string,
  serviceApiKey: string
): Promise<OwnerUser> => {
  const response = await fetch(`${userServiceUrl}/api/v1/users/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Key': internalGatewayKey,
      'X-Service-API-Key': serviceApiKey,
    },
    body: JSON.stringify({
      email,
      name,
      organizationId,
      role: 'owner',
      sendWelcomeEmail: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create owner user: ${response.status}`);
  }

  const user = (await response.json()) as {
    id: string;
    organizationId: string;
    email: string;
    name: string;
    role: string;
  };

  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    name: user.name,
    role: user.role,
  };
};

export const generateOnboardingApiKey = (): string => {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  return `crow_${Array.from(randomBytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')}`;
};
