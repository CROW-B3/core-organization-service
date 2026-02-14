import type { Context, Next } from 'hono';

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
  return async (c: Context, next: Next) => {
    if (c.get('isSystem')) return next();

    const jwtPayload = c.get('jwtPayload');
    const organizationId =
      c.req.param('organizationId') || c.req.query('organizationId');

    if (jwtPayload?.organizationId !== organizationId) {
      return c.json(
        { error: 'Forbidden', message: 'Access denied to this organization' },
        403
      );
    }

    return next();
  };
};
