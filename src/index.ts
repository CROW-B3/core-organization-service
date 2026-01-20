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

app.openapi(HelloWorldRoute, c => {
  return c.json({ text: 'Hello Hono!' });
});

app.openapi(CreateOrgBuilderRoute, async c => {
  const db = drizzle(c.env.DB, { schema });
  const body = c.req.valid('json');
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(schema.orgBuilder).values({
    id,
    betterAuthOrgId: body.betterAuthOrgId,
    name: body.name,
    createdAt: now,
  });

  const result = await db
    .select()
    .from(schema.orgBuilder)
    .where(eq(schema.orgBuilder.id, id))
    .limit(1);

  return c.json(
    {
      ...result[0],
      createdAt: result[0].createdAt.toISOString(),
    },
    201
  );
});

app.openapi(GetOrgBuilderRoute, async c => {
  const db = drizzle(c.env.DB, { schema });
  const { id } = c.req.valid('param');

  const result = await db
    .select()
    .from(schema.orgBuilder)
    .where(eq(schema.orgBuilder.id, id))
    .limit(1);

  if (!result[0]) return c.json({ error: 'Not found' }, 404);

  return c.json({
    ...result[0],
    createdAt: result[0].createdAt.toISOString(),
  });
});

app.openapi(FinalizeOrgBuilderRoute, async c => {
  const db = drizzle(c.env.DB, { schema });
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');

  const builderResult = await db
    .select()
    .from(schema.orgBuilder)
    .where(eq(schema.orgBuilder.id, id))
    .limit(1);

  if (!builderResult[0]) return c.json({ error: 'Builder not found' }, 404);

  const builder = builderResult[0];
  const orgId = crypto.randomUUID();
  const now = new Date();

  await db.insert(schema.organization).values({
    id: orgId,
    betterAuthOrgId: builder.betterAuthOrgId,
    name: builder.name,
    slug: body.slug,
    createdAt: now,
    updatedAt: now,
  });

  await db
    .update(schema.orgBuilder)
    .set({ status: 'active' })
    .where(eq(schema.orgBuilder.id, id));

  const orgResult = await db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.id, orgId))
    .limit(1);

  return c.json({
    ...orgResult[0],
    createdAt: orgResult[0].createdAt.toISOString(),
    updatedAt: orgResult[0].updatedAt.toISOString(),
  });
});

app.openapi(GetOrganizationRoute, async c => {
  const db = drizzle(c.env.DB, { schema });
  const { id } = c.req.valid('param');

  const result = await db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.id, id))
    .limit(1);

  if (!result[0]) return c.json({ error: 'Not found' }, 404);

  return c.json({
    ...result[0],
    createdAt: result[0].createdAt.toISOString(),
    updatedAt: result[0].updatedAt.toISOString(),
  });
});

app.openapi(GetOrganizationByBetterAuthIdRoute, async c => {
  const db = drizzle(c.env.DB, { schema });
  const { betterAuthOrgId } = c.req.valid('param');

  const result = await db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.betterAuthOrgId, betterAuthOrgId))
    .limit(1);

  if (!result[0]) return c.json({ error: 'Not found' }, 404);

  return c.json({
    ...result[0],
    createdAt: result[0].createdAt.toISOString(),
    updatedAt: result[0].updatedAt.toISOString(),
  });
});

app.doc('/docs', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Organization Service API',
  },
});

export default app;
