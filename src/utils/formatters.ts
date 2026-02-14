import type { OrgBuilder } from '../services/org-builder-service';
import type { Organization } from '../services/organization-service';

export const formatOrgBuilderResponse = (builder: OrgBuilder) => ({
  ...builder,
  createdAt: new Date(builder.createdAt).toISOString(),
});

export const formatOrganizationResponse = (organization: Organization) => ({
  ...organization,
  createdAt: new Date(organization.createdAt).toISOString(),
  updatedAt: new Date(organization.updatedAt).toISOString(),
});
