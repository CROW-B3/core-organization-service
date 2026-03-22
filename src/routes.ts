import { createRoute, z } from '@hono/zod-openapi';
import {
  ContextGenerationResponseSchema,
  CreateOrgBuilderSchema,
  FinalizeOrgBuilderSchema,
  HelloWorldSchema,
  OnboardOrganizationResponseSchema,
  OnboardOrganizationSchema,
  OrganizationContextSchema,
  OrganizationMembersResponseSchema,
  OrganizationSchema,
  OrgBuilderSchema,
  TriggerContextGenerationSchema,
  UpdateOrganizationSchema,
} from './types';

export const HelloWorldRoute = createRoute({
  method: 'get',
  path: '/',
  request: {},
  responses: {
    200: {
      content: { 'application/json': { schema: HelloWorldSchema } },
      description: 'Hello World',
    },
  },
});

export const CreateOrgBuilderRoute = createRoute({
  method: 'post',
  path: '/api/v1/organizations/org-builders',
  request: {
    body: {
      content: { 'application/json': { schema: CreateOrgBuilderSchema } },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: OrgBuilderSchema } },
      description: 'Org builder created',
    },
  },
});

export const GetOrgBuilderRoute = createRoute({
  method: 'get',
  path: '/api/v1/organizations/org-builders/{id}',
  request: {
    params: OrgBuilderSchema.pick({ id: true }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OrgBuilderSchema } },
      description: 'Org builder found',
    },
    404: {
      description: 'Org builder not found',
    },
  },
});

export const FinalizeOrgBuilderRoute = createRoute({
  method: 'post',
  path: '/api/v1/organizations/org-builders/{id}/finalize',
  request: {
    params: OrgBuilderSchema.pick({ id: true }),
    body: {
      content: { 'application/json': { schema: FinalizeOrgBuilderSchema } },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OrganizationSchema } },
      description: 'Organization created from builder',
    },
    404: {
      description: 'Org builder not found',
    },
  },
});

export const ListOrganizationsRoute = createRoute({
  method: 'get',
  path: '/api/v1/organizations',
  request: {},
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            organizations: z.array(OrganizationSchema),
          }),
        },
      },
      description: 'List of all organizations',
    },
  },
});

export const GetOrganizationRoute = createRoute({
  method: 'get',
  path: '/api/v1/organizations/{id}',
  request: {
    params: OrganizationSchema.pick({ id: true }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OrganizationSchema } },
      description: 'Organization found',
    },
    404: {
      description: 'Organization not found',
    },
  },
});

export const GetOrganizationByBetterAuthIdRoute = createRoute({
  method: 'get',
  path: '/api/v1/organizations/by-auth-id/{betterAuthOrgId}',
  request: {
    params: OrganizationSchema.pick({ betterAuthOrgId: true }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OrganizationSchema } },
      description: 'Organization found',
    },
    404: {
      description: 'Organization not found',
    },
  },
});

export const UpdateOrganizationRoute = createRoute({
  method: 'patch',
  path: '/api/v1/organizations/{id}',
  request: {
    params: OrganizationSchema.pick({ id: true }),
    body: {
      content: { 'application/json': { schema: UpdateOrganizationSchema } },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OrganizationSchema } },
      description: 'Organization updated',
    },
    400: {
      description: 'Invalid request body',
    },
    403: {
      description: 'Access denied',
    },
    404: {
      description: 'Organization not found',
    },
  },
});

export const TriggerContextGenerationRoute = createRoute({
  method: 'post',
  path: '/api/v1/organizations/{id}/context/trigger',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: TriggerContextGenerationSchema,
        },
      },
      required: false,
    },
  },
  responses: {
    202: {
      content: {
        'application/json': {
          schema: ContextGenerationResponseSchema,
        },
      },
      description: 'Context generation triggered (async)',
    },
    404: {
      description: 'Organization not found',
    },
  },
});

export const GetOrganizationContextRoute = createRoute({
  method: 'get',
  path: '/api/v1/organizations/{id}/context',
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: OrganizationContextSchema,
        },
      },
      description: 'Organization context found',
    },
    404: {
      description: 'Context not found',
    },
  },
});

export const GetOrganizationMembersRoute = createRoute({
  method: 'get',
  path: '/api/v1/organizations/{id}/members',
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: OrganizationMembersResponseSchema,
        },
      },
      description: 'Organization members retrieved successfully',
    },
    404: {
      description: 'Organization not found',
    },
    500: {
      description: 'Internal server error',
    },
  },
});

export const OnboardOrganizationRoute = createRoute({
  method: 'post',
  path: '/api/v1/organizations/onboard',
  request: {
    body: {
      content: { 'application/json': { schema: OnboardOrganizationSchema } },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': { schema: OnboardOrganizationResponseSchema },
      },
      description: 'Organization and owner created for onboarding',
    },
    400: {
      description: 'Invalid request',
    },
  },
});

export const InviteMemberRoute = createRoute({
  method: 'post',
  path: '/api/v1/organizations/{organizationId}/members',
  request: {
    params: z.object({ organizationId: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.string().email(),
            role: z.enum(['admin', 'member']).optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
            email: z.string(),
            organizationId: z.string(),
            role: z.string(),
          }),
        },
      },
      description: 'Member invited successfully',
    },
    404: {
      description: 'Organization not found',
    },
  },
});
