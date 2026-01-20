import { createRoute } from '@hono/zod-openapi';
import {
  CreateOrgBuilderSchema,
  FinalizeOrgBuilderSchema,
  HelloWorldSchema,
  OrganizationSchema,
  OrgBuilderSchema,
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
  path: '/api/v1/org-builders',
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
  path: '/api/v1/org-builders/{id}',
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
  path: '/api/v1/org-builders/{id}/finalize',
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
