import type { Context, Next } from 'hono';
import type { Environment } from '../types';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { fetchOrganizationByBetterAuthId } from '../services/organization-service';

export const requireOwnership = (resourceIdParam: string = 'id') => {
  return async (c: Context, next: Next) => {
    if (c.get('isSystem')) return next();

    const jwtPayload = c.get('jwtPayload');
    const resourceId = c.req.param(resourceIdParam);

    if (jwtPayload?.sub !== resourceId && !jwtPayload?.organizationId) {
      return c.json({ error: 'Forbidden', message: 'Access denied' }, 403);
    }

    return next();
  };
};

export const requireOrganization = () => {
  return async (c: Context<{ Bindings: Environment }>, next: Next) => {
    if (c.get('isSystem')) return next();

    const jwtPayload = c.get('jwtPayload');
    const urlOrgId =
      c.req.param('id') ||
      c.req.param('organizationId') ||
      c.req.query('organizationId');

    if (!urlOrgId) {
      return c.json(
        { error: 'Forbidden', message: 'Access denied to this organization' },
        403
      );
    }

    const betterAuthOrgIdFromJwt = jwtPayload?.organizationId as
      | string
      | undefined;
    const betterAuthOrgIdFromHeader = c.req.header('X-Organization-Id');

    const betterAuthOrgId = betterAuthOrgIdFromJwt || betterAuthOrgIdFromHeader;

    if (!betterAuthOrgId) {
      return c.json(
        { error: 'Forbidden', message: 'Access denied to this organization' },
        403
      );
    }

    if (betterAuthOrgId === urlOrgId) {
      return next();
    }

    try {
      const database = drizzle(c.env.DB, { schema });
      const org = await fetchOrganizationByBetterAuthId(
        database,
        betterAuthOrgId
      );

      if (!org || org.id !== urlOrgId) {
        return c.json(
          { error: 'Forbidden', message: 'Access denied to this organization' },
          403
        );
      }
    } catch {
      return c.json(
        { error: 'Forbidden', message: 'Access denied to this organization' },
        403
      );
    }

    return next();
  };
};
