import type { Organization } from '../services/organization-service';

export const formatOrganizationResponse = (organization: Organization) => ({
  ...organization,
  createdAt: new Date(organization.createdAt).toISOString(),
  updatedAt: new Date(organization.updatedAt).toISOString(),
});
