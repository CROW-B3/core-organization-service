import type { Environment } from './types';
import { OpenAPIHono } from '@hono/zod-openapi';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { logger } from 'hono/logger';
import { poweredBy } from 'hono/powered-by';
import * as schema from './db/schema';
import {
  CreateOrgBuilderRoute,
  FinalizeOrgBuilderRoute,
  GetOrganizationByBetterAuthIdRoute,
  GetOrganizationRoute,
  GetOrgBuilderRoute,
  HelloWorldRoute,
} from './routes';

const app = new OpenAPIHono<{ Bindings: Environment }>();
app.use(poweredBy());
app.use(logger());

const createOrgBuilderInDatabase = async (
  database: ReturnType<typeof drizzle>,
  builderId: string,
  betterAuthOrgId: string,
  organizationName: string,
  timestamp: Date
) => {
  await database.insert(schema.orgBuilder).values({
    id: builderId,
    betterAuthOrgId,
    name: organizationName,
    createdAt: timestamp,
  });
  return builderId;
};

const fetchOrgBuilderById = async (
  database: ReturnType<typeof drizzle>,
  builderId: string
) => {
  const results = await database
    .select()
    .from(schema.orgBuilder)
    .where(eq(schema.orgBuilder.id, builderId))
    .limit(1);
  return results[0] ?? null;
};

const formatOrgBuilderResponse = (
  builder: typeof schema.orgBuilder.$inferSelect
) => ({
  ...builder,
  createdAt: builder.createdAt.toISOString(),
});

const createOrganizationFromBuilder = async (
  database: ReturnType<typeof drizzle>,
  builder: typeof schema.orgBuilder.$inferSelect,
  slug: string,
  timestamp: Date
) => {
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

const markBuilderAsActive = async (
  database: ReturnType<typeof drizzle>,
  builderId: string
) => {
  await database
    .update(schema.orgBuilder)
    .set({ status: 'active' })
    .where(eq(schema.orgBuilder.id, builderId));
};

const fetchOrganizationById = async (
  database: ReturnType<typeof drizzle>,
  organizationId: string
) => {
  const results = await database
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);
  return results[0] ?? null;
};

const fetchOrganizationByBetterAuthId = async (
  database: ReturnType<typeof drizzle>,
  betterAuthOrgId: string
) => {
  const results = await database
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.betterAuthOrgId, betterAuthOrgId))
    .limit(1);
  return results[0] ?? null;
};

const formatOrganizationResponse = (
  org: typeof schema.organization.$inferSelect
) => ({
  ...org,
  createdAt: org.createdAt.toISOString(),
  updatedAt: org.updatedAt.toISOString(),
});

app.openapi(HelloWorldRoute, context => {
  return context.json({ text: 'Hello Hono!' });
});

app.openapi(CreateOrgBuilderRoute, async context => {
  const database = drizzle(context.env.DB, { schema });
  const body = context.req.valid('json');
  const builderId = crypto.randomUUID();
  const timestamp = new Date();

  await createOrgBuilderInDatabase(
    database,
    builderId,
    body.betterAuthOrgId,
    body.name,
    timestamp
  );

  const builder = await fetchOrgBuilderById(database, builderId);
  return context.json(formatOrgBuilderResponse(builder!), 201);
});

app.openapi(GetOrgBuilderRoute, async context => {
  const database = drizzle(context.env.DB, { schema });
  const { id } = context.req.valid('param');

  const builder = await fetchOrgBuilderById(database, id);
  if (!builder) return context.json({ error: 'Not found' }, 404);

  return context.json(formatOrgBuilderResponse(builder));
});

app.openapi(FinalizeOrgBuilderRoute, async context => {
  const database = drizzle(context.env.DB, { schema });
  const { id } = context.req.valid('param');
  const body = context.req.valid('json');

  const builder = await fetchOrgBuilderById(database, id);
  if (!builder) return context.json({ error: 'Builder not found' }, 404);

  const timestamp = new Date();
  const organizationId = await createOrganizationFromBuilder(
    database,
    builder,
    body.slug,
    timestamp
  );

  await markBuilderAsActive(database, id);

  const organization = await fetchOrganizationById(database, organizationId);
  return context.json(formatOrganizationResponse(organization!));
});

app.openapi(GetOrganizationRoute, async context => {
  const database = drizzle(context.env.DB, { schema });
  const { id } = context.req.valid('param');

  const organization = await fetchOrganizationById(database, id);
  if (!organization) return context.json({ error: 'Not found' }, 404);

  return context.json(formatOrganizationResponse(organization));
});

app.openapi(GetOrganizationByBetterAuthIdRoute, async context => {
  const database = drizzle(context.env.DB, { schema });
  const { betterAuthOrgId } = context.req.valid('param');

  const organization = await fetchOrganizationByBetterAuthId(
    database,
    betterAuthOrgId
  );
  if (!organization) return context.json({ error: 'Not found' }, 404);

  return context.json(formatOrganizationResponse(organization));
});

app.doc('/docs', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Organization Service API',
  },
});

export default app;
