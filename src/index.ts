import type { ContextGenerationMessage, Environment } from './types';
import { OpenAPIHono } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { logger } from 'hono/logger';
import { poweredBy } from 'hono/powered-by';
import * as schema from './db/schema';
import { jwtAuth, systemJwtAuth } from './middleware/auth';
import { handleContextGenerationMessage } from './queue-handlers';
import {
  CreateOrgBuilderRoute,
  FinalizeOrgBuilderRoute,
  GetOrganizationByBetterAuthIdRoute,
  GetOrganizationContextRoute,
  GetOrganizationRoute,
  GetOrgBuilderRoute,
  HelloWorldRoute,
  TriggerContextGenerationRoute,
} from './routes';
import {
  createOrganizationFromBuilder,
  createOrgBuilderInDatabase,
  fetchOrgBuilderById,
  markBuilderAsActive,
} from './services/org-builder-service';
import { fetchContextByOrganizationId } from './services/organization-context-service';
import {
  fetchOrganizationByBetterAuthId,
  fetchOrganizationById,
} from './services/organization-service';
import {
  formatOrganizationResponse,
  formatOrgBuilderResponse,
} from './utils/formatters';

const app = new OpenAPIHono<{ Bindings: Environment }>();
app.use(poweredBy());
app.use(logger());

app.use('/api/v1/organizations/*', async (c, next) => {
  const systemHeader = c.req.header('X-System-Token');
  if (systemHeader) {
    return systemJwtAuth(c.env.BETTER_AUTH_SECRET)(c, next);
  }
  return jwtAuth(c.env.BETTER_AUTH_SECRET)(c, next);
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

  if (!builder) {
    return context.json({ error: 'Failed to create org builder' }, 500);
  }

  return context.json(formatOrgBuilderResponse(builder), 201);
});

app.openapi(GetOrgBuilderRoute, async context => {
  const database = drizzle(context.env.DB, { schema });
  const { id } = context.req.valid('param');

  const builder = await fetchOrgBuilderById(database, id);

  if (!builder) {
    return context.json({ error: 'Not found' }, 404);
  }

  return context.json(formatOrgBuilderResponse(builder));
});

app.openapi(FinalizeOrgBuilderRoute, async context => {
  const database = drizzle(context.env.DB, { schema });
  const { id } = context.req.valid('param');

  const builder = await fetchOrgBuilderById(database, id);

  if (!builder) {
    return context.json({ error: 'Builder not found' }, 404);
  }

  const timestamp = new Date();
  const organizationId = await createOrganizationFromBuilder(
    database,
    builder,
    timestamp
  );

  await markBuilderAsActive(database, id);

  const organization = await fetchOrganizationById(database, organizationId);

  if (!organization) {
    return context.json({ error: 'Failed to create organization' }, 500);
  }

  return context.json(formatOrganizationResponse(organization));
});

app.openapi(GetOrganizationRoute, async context => {
  const database = drizzle(context.env.DB, { schema });
  const { id } = context.req.valid('param');

  const organization = await fetchOrganizationById(database, id);

  if (!organization) {
    return context.json({ error: 'Not found' }, 404);
  }

  return context.json(formatOrganizationResponse(organization));
});

app.openapi(GetOrganizationByBetterAuthIdRoute, async context => {
  const database = drizzle(context.env.DB, { schema });
  const { betterAuthOrgId } = context.req.valid('param');

  const organization = await fetchOrganizationByBetterAuthId(
    database,
    betterAuthOrgId
  );

  if (!organization) {
    return context.json({ error: 'Not found' }, 404);
  }

  return context.json(formatOrganizationResponse(organization));
});

app.openapi(TriggerContextGenerationRoute, async context => {
  const database = drizzle(context.env.DB, { schema });
  const { id } = context.req.valid('param');
  const { crawl_id } = context.req.valid('json');

  // Validate organization exists
  const org = await fetchOrganizationById(database, id);
  if (!org) {
    return context.json({ error: 'Organization not found' }, 404);
  }

  // Generate job ID for tracking
  const jobId = crypto.randomUUID();

  // Publish to queue
  await context.env.ORGANIZATION_CONTEXT_QUEUE.send({
    organizationId: id,
    crawlId: crawl_id,
    timestamp: Date.now(),
    jobId,
  });

  return context.json(
    {
      message: 'Context generation triggered',
      job_id: jobId,
    },
    202
  );
});

app.openapi(GetOrganizationContextRoute, async context => {
  const database = drizzle(context.env.DB, { schema });
  const { id } = context.req.valid('param');

  const contextData = await fetchContextByOrganizationId(database, id);

  if (!contextData) {
    return context.json({ error: 'Context not found' }, 404);
  }

  return context.json({
    id: contextData.id,
    organizationId: contextData.organizationId,
    crawlId: contextData.crawlId,
    contextType: contextData.contextType,
    structuredData: contextData.structuredData as Record<string, unknown>,
    generatedAt: contextData.generatedAt.toISOString(),
  });
});

app.doc('/docs', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Organization Service API',
  },
});

export default {
  fetch: app.fetch,

  // Queue consumer
  queue: async (
    batch: MessageBatch<ContextGenerationMessage>,
    env: Environment
  ) => {
    for (const message of batch.messages) {
      try {
        await handleContextGenerationMessage(message.body, env);
        message.ack();
      } catch (error) {
        console.error('Failed to process context generation:', error);
        message.retry();
      }
    }
  },
};
