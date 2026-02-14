import type { ContextGenerationMessage, Environment } from './types';
import { OpenAPIHono } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { logger } from 'hono/logger';
import { poweredBy } from 'hono/powered-by';
import { createLogger } from './config/logger';
import { validateEnv } from './config/validate-env';
import * as schema from './db/schema';
import { requireOrganization } from './middleware/authorization';
import { createJWTMiddleware } from './middleware/jwt';
import { handleContextGenerationMessage } from './queue-handlers';
import {
  GetOrganizationByBetterAuthIdRoute,
  GetOrganizationContextRoute,
  GetOrganizationMembersRoute,
  GetOrganizationRoute,
  HelloWorldRoute,
  TriggerContextGenerationRoute,
} from './routes';
import { HealthCheckRoute, ReadinessCheckRoute } from './routes/health';
import { fetchContextByOrganizationId } from './services/organization-context-service';
import {
  createOrganization,
  fetchOrganizationByBetterAuthId,
  fetchOrganizationById,
} from './services/organization-service';
import { handleErrorResponse } from './utils/error-handler';
import { formatOrganizationResponse } from './utils/formatters';

async function checkDatabaseHealth(
  db: ReturnType<typeof drizzle>
): Promise<boolean> {
  try {
    await db.run('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

const app = new OpenAPIHono<{ Bindings: Environment }>();

app.use(poweredBy());
app.use(logger());

app.use('*', async (c, next) => {
  try {
    validateEnv(c.env);
  } catch (error) {
    const logger = createLogger(c.env);
    return handleErrorResponse(c, error, logger);
  }

  await next();
});

app.openapi(HealthCheckRoute, c => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'core-organization-service',
    version: '1.0.0',
    environment: c.env.ENVIRONMENT || 'prod',
  });
});

app.openapi(ReadinessCheckRoute, async c => {
  const database = drizzle(c.env.DB, { schema });
  const isDatabaseHealthy = await checkDatabaseHealth(database);

  const isReady = isDatabaseHealthy;
  const statusCode = isReady ? 200 : 503;

  return c.json(
    {
      ready: isReady,
      checks: {
        database: isDatabaseHealthy,
      },
    },
    statusCode
  );
});

app.use('/api/v1/organizations/*', async (c, next) => {
  return createJWTMiddleware(c.env)(c, next);
});

// Organization ownership check for routes that need it
app.use('/api/v1/organizations/:id/context/*', requireOrganization());
app.use('/api/v1/organizations/:id/members', requireOrganization());

app.openapi(HelloWorldRoute, context => {
  return context.json({ text: 'Hello Hono!' });
});

// Create organization
app.post('/api/v1/organizations', async context => {
  const database = drizzle(context.env.DB, { schema });
  const body = await context.req.json();

  if (!body.betterAuthOrgId || !body.name) {
    return context.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'betterAuthOrgId and name are required',
        },
      },
      400
    );
  }

  try {
    const organization = await createOrganization(
      database,
      body.betterAuthOrgId,
      body.name
    );

    return context.json(formatOrganizationResponse(organization), 201);
  } catch (error) {
    const appLogger = createLogger(context.env);
    appLogger.error(
      { error, betterAuthOrgId: body.betterAuthOrgId },
      'Failed to create organization'
    );
    return context.json(
      {
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create organization',
        },
      },
      500
    );
  }
});

app.openapi(GetOrganizationRoute, async context => {
  const database = drizzle(context.env.DB, { schema });
  const { id } = context.req.valid('param');

  const organization = await fetchOrganizationById(database, id);

  if (!organization) {
    return context.json(
      {
        error: {
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'Organization not found',
          timestamp: new Date().toISOString(),
        },
      },
      404
    );
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
    return context.json(
      {
        error: {
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'Organization not found',
          timestamp: new Date().toISOString(),
        },
      },
      404
    );
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
    return context.json(
      {
        error: {
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'Organization not found',
          timestamp: new Date().toISOString(),
        },
      },
      404
    );
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
    return context.json(
      {
        error: {
          code: 'CONTEXT_NOT_FOUND',
          message: 'Organization context not found',
          timestamp: new Date().toISOString(),
        },
      },
      404
    );
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

app.openapi(GetOrganizationMembersRoute, async context => {
  const database = drizzle(context.env.DB, { schema });
  const appLogger = createLogger(context.env);
  const { id } = context.req.valid('param');

  // Verify organization exists
  const organization = await fetchOrganizationById(database, id);
  if (!organization) {
    return context.json(
      {
        error: {
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'Organization not found',
          timestamp: new Date().toISOString(),
        },
      },
      404
    );
  }

  // Fetch members from user service
  try {
    const userServiceUrl = context.env.USER_SERVICE_URL;
    const response = await fetch(
      `${userServiceUrl}/api/v1/users/by-organization/${id}`,
      {
        headers: {
          Authorization: context.req.header('Authorization') || '',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return context.json({
          members: [],
          total: 0,
        });
      }

      appLogger.error({
        message: 'Failed to fetch members from user service',
        status: response.status,
        organizationId: id,
      });

      return context.json(
        {
          error: {
            code: 'USER_SERVICE_ERROR',
            message: 'Failed to fetch organization members',
            timestamp: new Date().toISOString(),
          },
        },
        500
      );
    }

    const data = await response.json();
    return context.json({
      members: data.users || [],
      total: data.users?.length || 0,
    });
  } catch (error) {
    appLogger.error({
      message: 'Error calling user service',
      error,
      organizationId: id,
    });

    return context.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while fetching organization members',
          timestamp: new Date().toISOString(),
        },
      },
      500
    );
  }
});

app.doc('/api/docs', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'CROW Organization API',
    description: 'Organization management service for CROW platform',
  },
});

app.notFound(c =>
  c.json({ error: 'Not Found', message: 'Route not found' }, 404)
);

app.onError((error, c) => {
  const logger = createLogger(c.env);
  return handleErrorResponse(c, error, logger);
});

export default {
  fetch: app.fetch,

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
