export type OrganizationStatus =
  | 'PROVISIONING'
  | 'TRIAL'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'ARCHIVED';

export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  primaryEmail: string;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  billingEmail: string | null;
  country: string | null;
  defaultCurrency: string;
  timezone: string | null;
  status: OrganizationStatus;
  externalCustomerRef: string | null;
  metadata: Record<string, unknown> | null;
  statusChangedAt: string | null;
  suspendedAt: string | null;
  cancelledAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationListResponse {
  items: Organization[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface OrganizationListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: OrganizationStatus | '';
  sortBy?: 'name' | 'status' | 'createdAt' | 'updatedAt';
  order?: 'asc' | 'desc';
}

export interface OrganizationPayload {
  name: string;
  slug?: string;
  primaryEmail: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  billingEmail?: string;
  country?: string;
  defaultCurrency?: string;
  timezone?: string;
  status?: OrganizationStatus;
  externalCustomerRef?: string;
  metadata?: Record<string, unknown>;
}
