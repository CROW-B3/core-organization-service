import type { Context, Next } from 'hono';
import type { Environment } from '../types';
import { verify } from 'hono/jwt';
import { createRemoteJWKSet, jwtVerify } from 'jose';

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
    jwtPayload: Record<string, unknown>;
    isSystem: boolean;
  }
}

let cachedJsonWebKeySet: ReturnType<typeof createRemoteJWKSet> | null = null;

const getOrCreateJsonWebKeySet = (authServiceUrl: string) => {
  if (!cachedJsonWebKeySet) {
    cachedJsonWebKeySet = createRemoteJWKSet(
      new URL(`${authServiceUrl}/api/v1/auth/jwks`)
    );
  }
  return cachedJsonWebKeySet;
};

const verifySystemToken = async (
  context: Context<{ Bindings: Environment }>,
  token: string,
  secret: string,
  next: Next
) => {
  try {
    const payload = await verify(token, secret, 'HS256');
    if (payload.type !== 'system') {
      return context.json({ error: 'System token required' }, 401);
    }
    context.set('jwtPayload', payload);
    context.set('isSystem', true);
    return next();
  } catch {
    return context.json({ error: 'Invalid system token' }, 401);
  }
};

const verifyUserToken = async (
  context: Context<{ Bindings: Environment }>,
  token: string,
  authServiceUrl: string,
  next: Next
) => {
  try {
    const jsonWebKeySet = getOrCreateJsonWebKeySet(authServiceUrl);
    const { payload } = await jwtVerify(token, jsonWebKeySet);
    context.set('jwtPayload', payload as Record<string, unknown>);
    context.set('userId', payload.sub as string);
    context.set('isSystem', false);
    return next();
  } catch {
    return context.json({ error: 'Invalid token' }, 401);
  }
};

export const createJWTMiddleware = (env: Environment) => {
  return async (c: Context<{ Bindings: Environment }>, next: Next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);
    const isSystemRequest = c.req.header('X-System-Token');

    if (isSystemRequest) {
      return verifySystemToken(c, token, env.BETTER_AUTH_SECRET, next);
    }

    return verifyUserToken(c, token, env.AUTH_SERVICE_URL, next);
  };
};
