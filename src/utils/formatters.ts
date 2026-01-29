import type { OrgBuilder } from '../services/org-builder-service';
import type { Organization } from '../services/organization-service';

export const formatOrgBuilderResponse = (builder: OrgBuilder) => ({
  ...builder,
  createdAt: builder.createdAt.toISOString(),
});

export const formatOrganizationResponse = (organization: Organization) => ({
  ...organization,
  createdAt: organization.createdAt.toISOString(),
  updatedAt: organization.updatedAt.toISOString(),
});
