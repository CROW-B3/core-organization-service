import type { Context, Next } from 'hono';
import type { Environment } from '../types';

interface JWTPayload {
  sub: string;
  sessionId: string;
  organizationId?: string;
  role?: string;
  permissions?: Record<string, boolean>;
  type?: 'user' | 'system';
  iat: number;
  exp: number;
}

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
    sessionId: string;
    organizationId?: string;
    role?: string;
    permissions?: Record<string, boolean>;
    jwtType: 'user' | 'system';
  }
}

export const createJWTMiddleware = (env: Environment) => {
  const JWKS_URL = `${env.AUTH_SERVICE_URL}/api/v1/auth/.well-known/jwks.json`;
  const CACHE_TTL = 86400;

  let cachedJWKS: any = null;
  let cacheExpiry = 0;

  const fetchJWKS = async () => {
    const now = Date.now() / 1000;
    if (cachedJWKS && now < cacheExpiry) {
      return cachedJWKS;
    }

    const response = await fetch(JWKS_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch JWKS');
    }

    cachedJWKS = await response.json();
    cacheExpiry = now + CACHE_TTL;
    return cachedJWKS;
  };

  const verifyToken = async (token: string): Promise<JWTPayload | null> => {
    try {
      const jwks = await fetchJWKS();

      const [headerB64] = token.split('.');
      const header = JSON.parse(
        atob(headerB64.replace(/-/g, '+').replace(/_/g, '/'))
      );

      const key = jwks.keys.find((k: any) => k.kid === header.kid);
      if (!key) {
        return null;
      }

      const response = await fetch(
        `${env.AUTH_SERVICE_URL}/api/v1/auth/jwt/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        }
      );

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      return result.payload as JWTPayload;
    } catch (error) {
      console.error('JWT verification error:', error);
      return null;
    }
  };

  return async (c: Context<{ Bindings: Environment }>, next: Next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const cookie = c.req.header('Cookie');
      if (!cookie || !cookie.includes('better-auth.session_token')) {
        return c.json(
          {
            error: 'Unauthorized',
            message: 'No authentication token provided',
          },
          401
        );
      }

      return next();
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return c.json(
        { error: 'Unauthorized', message: 'Invalid or expired token' },
        401
      );
    }

    if (payload.exp < Date.now() / 1000) {
      return c.json({ error: 'Unauthorized', message: 'Token expired' }, 401);
    }

    c.set('userId', payload.sub);
    c.set('sessionId', payload.sessionId);
    c.set('organizationId', payload.organizationId);
    c.set('role', payload.role);
    c.set('permissions', payload.permissions);
    c.set('jwtType', payload.type || 'user');

    return next();
  };
};

export const requirePermission = (permission: string) => {
  return async (c: Context, next: Next) => {
    const permissions = c.get('permissions');
    const jwtType = c.get('jwtType');

    if (jwtType === 'system') {
      return next();
    }

    if (!permissions || !permissions[permission]) {
      return c.json(
        {
          error: 'Forbidden',
          message: `Missing required permission: ${permission}`,
        },
        403
      );
    }

    return next();
  };
};

export const requireOrganization = () => {
  return async (c: Context, next: Next) => {
    const organizationId = c.get('organizationId');
    const jwtType = c.get('jwtType');

    if (jwtType === 'system') {
      return next();
    }

    if (!organizationId) {
      return c.json(
        { error: 'Forbidden', message: 'Organization membership required' },
        403
      );
    }

    return next();
  };
};

export const systemOnly = () => {
  return async (c: Context, next: Next) => {
    const jwtType = c.get('jwtType');

    if (jwtType !== 'system') {
      return c.json({ error: 'Forbidden', message: 'System access only' }, 403);
    }

    return next();
  };
};
