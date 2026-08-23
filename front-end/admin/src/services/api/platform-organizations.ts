import type {
  Organization,
  OrganizationListQuery,
  OrganizationListResponse,
  OrganizationPayload,
} from '../../types/organization';
import { apiRequest } from './client';

function queryString(query: OrganizationListQuery): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

export function getOrganizations(
  query: OrganizationListQuery,
  signal?: AbortSignal,
) {
  return apiRequest<OrganizationListResponse>(
    `/organizations${queryString(query)}`,
    { signal },
  );
}

export function getOrganization(id: string, signal?: AbortSignal) {
  return apiRequest<Organization>(`/organizations/${id}`, { signal });
}

export function createOrganization(payload: OrganizationPayload) {
  return apiRequest<Organization>('/organizations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateOrganization(
  id: string,
  payload: Omit<OrganizationPayload, 'status'>,
) {
  return apiRequest<Organization>(`/organizations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function suspendOrganization(id: string, reason?: string) {
  return lifecycle(id, 'suspensions', reason);
}

export function reactivateOrganization(id: string, reason?: string) {
  return lifecycle(id, 'reactivations', reason);
}

export function cancelOrganization(id: string, reason?: string) {
  return lifecycle(id, 'cancellations', reason);
}

export function archiveOrganization(id: string, reason?: string) {
  return lifecycle(id, 'archivals', reason);
}

function lifecycle(id: string, action: string, reason?: string) {
  return apiRequest<Organization>(`/organizations/${id}/${action}`, {
    method: 'POST',
    body: JSON.stringify(reason ? { reason } : {}),
  });
}
