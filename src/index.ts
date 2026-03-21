import type { ContextGenerationMessage, Environment } from './types';
import { OpenAPIHono } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { logger } from 'hono/logger';
import { createLogger } from './config/logger';
import { validateEnv } from './config/validate-env';
import * as schema from './db/schema';
import { requireOrganization } from './middleware/authorization';
import { createJWTMiddleware } from './middleware/jwt';
import { serviceAuthMiddleware } from './middleware/service-auth';
import { handleContextGenerationMessage } from './queue-handlers';
import {
  GetOrganizationByBetterAuthIdRoute,
  GetOrganizationContextRoute,
  GetOrganizationMembersRoute,
  GetOrganizationRoute,
  HelloWorldRoute,
  InviteMemberRoute,
  OnboardOrganizationRoute,
  TriggerContextGenerationRoute,
  UpdateOrganizationRoute,
} from './routes';
import { HealthCheckRoute, ReadinessCheckRoute } from './routes/health';
import { fetchContextByOrganizationId } from './services/organization-context-service';
import {
  createOrganization,
  createOrganizationRecord,
  createOwnerUser,
  fetchOrganizationByBetterAuthId,
  fetchOrganizationById,
  generateOnboardingApiKey,
  updateOrganization,
  validateOnboardingPayload,
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

const app = new OpenAPIHono<{ Bindings: Environment }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        { error: 'Bad Request', message: 'Invalid request parameters' },
        400
      );
    }
  },
});

app.use(logger());

app.use('/api/v1/*', async (c, next) => {
  if (!c.env.INTERNAL_GATEWAY_KEY) {
    return c.json({ error: 'Service unavailable' }, 503);
  }
  const key = c.req.header('X-Internal-Key');
  if (!key || key !== c.env.INTERNAL_GATEWAY_KEY) {
    return c.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      401
    );
  }
  return next();
});

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

app.use(
  '/api/v1/organizations/by-auth-id/:betterAuthOrgId',
  serviceAuthMiddleware()
);
app.use(
  '/api/v1/organizations/by-auth-id/:betterAuthOrgId',
  async (c, next) => {
    // Allow requests that already passed the global X-Internal-Key check
    // (the global /api/v1/* middleware ensures X-Internal-Key is valid before reaching here)
    const internalKey = c.req.header('X-Internal-Key');
    if (
      internalKey &&
      c.env.INTERNAL_GATEWAY_KEY &&
      internalKey === c.env.INTERNAL_GATEWAY_KEY
    ) {
      return next();
    }
    if (!c.get('callingService')) {
      return c.json(
        { error: 'Unauthorized', message: 'Service authentication required' },
        401
      );
    }
    return next();
  }
);

app.use('/api/v1/organizations/:id', async (c, next) =>
  createJWTMiddleware(c.env)(c, next)
);
app.use('/api/v1/organizations/:id', requireOrganization());
app.use('/api/v1/organizations/:id/context/*', async (c, next) =>
  createJWTMiddleware(c.env)(c, next)
);
app.use('/api/v1/organizations/:id/context/*', requireOrganization());
app.use('/api/v1/organizations/:id/members', async (c, next) =>
  createJWTMiddleware(c.env)(c, next)
);
app.use('/api/v1/organizations/:id/members', requireOrganization());

app.openapi(HelloWorldRoute, context => {
  return context.json({ text: 'Hello Hono!' });
});

app.use('/api/v1/organizations', serviceAuthMiddleware());
app.use('/api/v1/organizations', async (c, next) => {
  if (c.req.method === 'POST' && !c.get('callingService')) {
    return c.json(
      { error: 'Unauthorized', message: 'Service authentication required' },
      401
    );
  }
  return next();
});

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

app.use('/api/v1/organizations/onboard', serviceAuthMiddleware());
app.use('/api/v1/organizations/onboard', async (c, next) => {
  if (!c.get('callingService')) {
    return c.json(
      { error: 'Unauthorized', message: 'Service authentication required' },
      401
    );
  }
  return next();
});

app.openapi(OnboardOrganizationRoute, async context => {
  const database = drizzle(context.env.DB, { schema });
  const body = context.req.valid('json');

  const validationError = validateOnboardingPayload(body);
  if (validationError) {
    return context.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: validationError,
          timestamp: new Date().toISOString(),
        },
      },
      400
    );
  }

  const organization = await createOrganizationRecord(
    database,
    body.organizationName
  );

  const ownerUser = await createOwnerUser(
    context.env.USER_SERVICE_URL,
    body.ownerEmail,
    body.ownerName,
    organization.id,
    context.env.INTERNAL_GATEWAY_KEY || '',
    context.env.SERVICE_API_KEY_ORGANIZATION || ''
  );

  const apiKey = generateOnboardingApiKey();

  return context.json(
    {
      organizationId: organization.id,
      userId: ownerUser.id,
      apiKey,
    },
    201
  );
});

app.openapi(GetOrganizationRoute, async context => {
  const database = drizzle(context.env.DB, { schema });
  const { id } = context.req.valid('param');

  const callerOrgId = context.req.header('X-Organization-Id');
  if (!callerOrgId || callerOrgId !== id) {
    return context.json(
      { error: 'Forbidden', message: 'Access denied to this organization' },
      403
    ) as never;
  }

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

app.openapi(UpdateOrganizationRoute, async context => {
  const database = drizzle(context.env.DB, { schema });
  const { id } = context.req.valid('param');
  const body = context.req.valid('json');

  const callerOrgId = context.req.header('X-Organization-Id');
  if (!callerOrgId || callerOrgId !== id) {
    return context.json(
      { error: 'Forbidden', message: 'Access denied to this organization' },
      403
    ) as never;
  }

  if (!body.name && body.logo === undefined) {
    return context.json(
      {
        error: 'Bad Request',
        message: 'At least one field (name or logo) must be provided',
      },
      400
    ) as never;
  }

  const updated = await updateOrganization(database, id, {
    name: body.name,
    logo: body.logo,
  });

  if (!updated) {
    return context.json(
      {
        error: {
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'Organization not found',
          timestamp: new Date().toISOString(),
        },
      },
      404
    ) as never;
  }

  return context.json(formatOrganizationResponse(updated));
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
  const body = context.req.valid('json') as { crawl_id?: string } | undefined;
  const crawl_id = body?.crawl_id;

  const callerOrgId = context.req.header('X-Organization-Id');
  if (!callerOrgId || callerOrgId !== id) {
    return context.json(
      { error: 'Forbidden', message: 'Access denied to this organization' },
      403
    ) as never;
  }

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

  const contextGenerationJobId = crypto.randomUUID();

  await context.env.ORGANIZATION_CONTEXT_QUEUE.send({
    organizationId: id,
    crawlId: crawl_id,
    timestamp: Date.now(),
    jobId: contextGenerationJobId,
  });

  return context.json(
    {
      message: 'Context generation triggered',
      job_id: contextGenerationJobId,
    },
    202
  );
});

app.openapi(GetOrganizationContextRoute, async context => {
  const database = drizzle(context.env.DB, { schema });
  const { id } = context.req.valid('param');

  const callerOrgId = context.req.header('X-Organization-Id');
  if (!callerOrgId || callerOrgId !== id) {
    return context.json(
      { error: 'Forbidden', message: 'Access denied to this organization' },
      403
    ) as never;
  }

  const contextData = await fetchContextByOrganizationId(database, id);

  if (!contextData) {
    return context.json(
      {
        id: null,
        organizationId: id,
        crawlId: null,
        contextType: null,
        structuredData: {},
        summary: null,
        generatedAt: null,
        createdAt: null,
        updatedAt: null,
      },
      200
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

  const callerOrgId = context.req.header('X-Organization-Id');
  if (!callerOrgId || callerOrgId !== id) {
    return context.json(
      { error: 'Forbidden', message: 'Access denied to this organization' },
      403
    ) as never;
  }

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

  try {
    const userServiceUrl = context.env.USER_SERVICE_URL;
    const response = await fetch(
      `${userServiceUrl}/api/v1/users/by-organization/${id}`,
      {
        headers: {
          'X-Internal-Key': context.env.INTERNAL_GATEWAY_KEY || '',
          'X-Service-API-Key': context.env.SERVICE_API_KEY_ORGANIZATION || '',
          'X-Organization-Id': id,
        },
      }
    );

    if (response.status === 404) {
      return context.json({ members: [], total: 0 });
    }

    if (!response.ok) {
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

    const data = (await response.json()) as { users?: Array<unknown> };
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

app.openapi(InviteMemberRoute, async context => {
  const database = drizzle(context.env.DB, { schema });
  const { organizationId } = context.req.valid('param');
  const { email, role } = context.req.valid('json');

  const callerOrgId = context.req.header('X-Organization-Id');
  if (!callerOrgId || callerOrgId !== organizationId) {
    return context.json(
      { error: 'Forbidden', message: 'Access denied to this organization' },
      403
    ) as never;
  }

  const organization = await fetchOrganizationById(database, organizationId);
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

  const resolvedRole = role ?? 'member';

  return context.json(
    {
      message: 'Member invited successfully',
      email,
      organizationId,
      role: resolvedRole,
    },
    201
  );
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
