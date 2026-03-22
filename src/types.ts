import { z } from '@hono/zod-openapi';

export interface Environment {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  AI: Ai;
  BETTER_AUTH_SECRET: string;
  AUTH_SERVICE_URL: string;
  USER_SERVICE_URL: string;
  PRODUCT_SERVICE_URL: string;
  ENVIRONMENT: 'local' | 'dev' | 'prod';
  SERVICE_API_KEY_AUTH?: string;
  SERVICE_API_KEY_ORGANIZATION?: string;
  SERVICE_API_KEY_BILLING?: string;
  SERVICE_API_KEY_NOTIFICATION?: string;
  SERVICE_API_KEY_GATEWAY?: string;
  ORGANIZATION_CONTEXT_QUEUE: Queue<ContextGenerationMessage>;
  INTERNAL_GATEWAY_KEY?: string;
}

export interface ContextGenerationMessage {
  organizationId: string;
  betterAuthOrgId: string;
  crawlId?: string;
  timestamp: number;
  jobId: string;
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
    logo: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Organization');

export const FinalizeOrgBuilderSchema = z
  .object({})
  .openapi('FinalizeOrgBuilder');

export const TriggerContextGenerationSchema = z
  .object({
    crawl_id: z.string().optional(),
  })
  .openapi('TriggerContextGeneration');

export const ContextGenerationResponseSchema = z
  .object({
    message: z.string(),
    job_id: z.string(),
  })
  .openapi('ContextGenerationResponse');

export const OrganizationContextSchema = z
  .object({
    id: z.string(),
    organizationId: z.string(),
    crawlId: z.string(),
    contextType: z.string(),
    structuredData: z.record(z.string(), z.unknown()),
    generatedAt: z.string(),
  })
  .openapi('OrganizationContext');

export const MemberSchema = z
  .object({
    id: z.string(),
    betterAuthUserId: z.string(),
    organizationId: z.string(),
    email: z.string(),
    name: z.string(),
    profilePictureUrl: z.string().nullable(),
    role: z.string(),
    status: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Member');

export const OrganizationMembersResponseSchema = z
  .object({
    members: z.array(MemberSchema),
    total: z.number(),
  })
  .openapi('OrganizationMembersResponse');

export const UpdateOrganizationSchema = z
  .object({
    name: z.string().min(1).optional(),
    logo: z.string().nullable().optional(),
  })
  .openapi('UpdateOrganization');

export const OnboardOrganizationSchema = z
  .object({
    organizationName: z.string(),
    ownerEmail: z.string().email(),
    ownerName: z.string(),
    plan: z.enum(['starter', 'pro', 'enterprise']).optional(),
    industry: z.string().optional(),
    size: z.enum(['small', 'medium', 'large']).optional(),
  })
  .openapi('OnboardOrganization');

export const OnboardOrganizationResponseSchema = z
  .object({
    organizationId: z.string(),
    userId: z.string(),
    apiKey: z.string(),
  })
  .openapi('OnboardOrganizationResponse');
