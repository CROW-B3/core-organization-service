import type { Context, Next } from 'hono';
import type { Environment } from '../types';

interface ServiceCredentials {
  serviceId: string;
  apiKey: string;
  allowedScopes: string[];
}

declare module 'hono' {
  interface ContextVariableMap {
    callingService?: string;
    serviceScopes?: string[];
  }
}

const SERVICE_REGISTRY: Record<string, ServiceCredentials> = {
  'service:auth': {
    serviceId: 'service:auth',
    apiKey: '', // Set via env
    allowedScopes: ['users:*'],
  },
  'service:organization': {
    serviceId: 'service:organization',
    apiKey: '', // Set via env
    allowedScopes: ['users:read', 'users:write'],
  },
  'service:billing': {
    serviceId: 'service:billing',
    apiKey: '', // Set via env
    allowedScopes: ['users:read'],
  },
  'service:notification': {
    serviceId: 'service:notification',
    apiKey: '', // Set via env
    allowedScopes: ['users:read'],
  },
};

const loadServiceRegistry = (
  env: Environment
): Record<string, ServiceCredentials> => {
  const registry = { ...SERVICE_REGISTRY };

  registry['service:auth'].apiKey = env.SERVICE_API_KEY_AUTH || '';
  registry['service:organization'].apiKey =
    env.SERVICE_API_KEY_ORGANIZATION || '';
  registry['service:billing'].apiKey = env.SERVICE_API_KEY_BILLING || '';
  registry['service:notification'].apiKey =
    env.SERVICE_API_KEY_NOTIFICATION || '';

  return registry;
};

const verifyServiceApiKey = (
  registry: Record<string, ServiceCredentials>,
  apiKey: string
): ServiceCredentials | null => {
  for (const serviceId in registry) {
    if (registry[serviceId].apiKey === apiKey && apiKey !== '') {
      return registry[serviceId];
    }
  }
  return null;
};

export const serviceAuthMiddleware = () => {
  return async (c: Context<{ Bindings: Environment }>, next: Next) => {
    const apiKeyHeader = c.req.header('X-Service-API-Key');

    if (!apiKeyHeader) {
      return next();
    }

    const registry = loadServiceRegistry(c.env);
    const service = verifyServiceApiKey(registry, apiKeyHeader);

    if (!service) {
      return c.json(
        { error: 'Unauthorized', message: 'Invalid service API key' },
        401
      );
    }

    c.set('callingService', service.serviceId);
    c.set('serviceScopes', service.allowedScopes);

    return next();
  };
};

export const requireServiceScope = (scope: string) => {
  return async (c: Context, next: Next) => {
    const serviceScopes = c.get('serviceScopes');

    if (!serviceScopes) {
      return c.json(
        { error: 'Forbidden', message: 'Service authentication required' },
        403
      );
    }

    const hasScope = serviceScopes.some(allowedScope => {
      if (allowedScope.endsWith(':*')) {
        const prefix = allowedScope.slice(0, -2);
        return scope.startsWith(prefix);
      }
      return allowedScope === scope;
    });

    if (!hasScope) {
      return c.json(
        { error: 'Forbidden', message: `Missing required scope: ${scope}` },
        403
      );
    }

    return next();
  };
};
