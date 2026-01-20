import { z } from '@hono/zod-openapi';

export interface Environment {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  ENVIRONMENT: 'local' | 'dev' | 'prod';
}

export const HelloWorldSchema = z
  .object({
    text: z.string(),
  })
  .openapi('HelloWorld');

export const OrgBuilderSchema = z
  .object({
    id: z.string(),
    betterAuthOrgId: z.string(),
    name: z.string(),
    status: z.enum(['draft', 'active']),
    createdAt: z.string(),
  })
  .openapi('OrgBuilder');

export const CreateOrgBuilderSchema = z
  .object({
    betterAuthOrgId: z.string(),
    name: z.string(),
  })
  .openapi('CreateOrgBuilder');

export const OrganizationSchema = z
  .object({
    id: z.string(),
    betterAuthOrgId: z.string(),
    name: z.string(),
    slug: z.string(),
    logo: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Organization');

export const FinalizeOrgBuilderSchema = z
  .object({
    slug: z.string(),
  })
  .openapi('FinalizeOrgBuilder');
