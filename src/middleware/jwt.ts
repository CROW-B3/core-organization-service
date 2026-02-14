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

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

const getJWKS = (authServiceUrl: string) => {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${authServiceUrl}/api/v1/auth/jwks`));
  }
  return jwks;
};

export const createJWTMiddleware = (env: Environment) => {
  return async (c: Context<{ Bindings: Environment }>, next: Next) => {
    const systemHeader = c.req.header('X-System-Token');
    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);

    // System JWT: HS256 with shared secret
    if (systemHeader) {
      try {
        const payload = await verify(token, env.BETTER_AUTH_SECRET, 'HS256');
        if (payload.type !== 'system') {
          return c.json({ error: 'System token required' }, 401);
        }
        c.set('jwtPayload', payload);
        c.set('isSystem', true);
        return next();
      } catch {
        return c.json({ error: 'Invalid system token' }, 401);
      }
    }

    // User JWT: RS256 via JWKS from Better Auth
    try {
      const jwksSet = getJWKS(env.AUTH_SERVICE_URL);
      const { payload } = await jwtVerify(token, jwksSet);
      c.set('jwtPayload', payload as Record<string, unknown>);
      c.set('userId', payload.sub as string);
      c.set('isSystem', false);
      return next();
    } catch {
      return c.json({ error: 'Invalid token' }, 401);
    }
  };
};
