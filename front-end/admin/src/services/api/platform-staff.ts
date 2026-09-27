import type {
  CreatePlatformStaffPayload,
  PlatformStaff,
  PlatformStaffListQuery,
  PlatformStaffListResponse,
  PlatformStaffRoleAssignment,
  UpdatePlatformStaffPayload,
} from '../../types/platform-staff';
import { apiRequest } from './client';
import { queryString } from './query-string';

export function getPlatformStaff(
  query: PlatformStaffListQuery,
  signal?: AbortSignal,
) {
  return apiRequest<PlatformStaffListResponse>(
    `/staff${queryString(query)}`,
    { signal },
  );
}

export function getPlatformStaffMember(id: string, signal?: AbortSignal) {
  return apiRequest<PlatformStaff>(`/staff/${id}`, { signal });
}

export function createPlatformStaff(payload: CreatePlatformStaffPayload) {
  return apiRequest<PlatformStaff>('/staff', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updatePlatformStaff(
  id: string,
  payload: UpdatePlatformStaffPayload,
) {
  return apiRequest<PlatformStaff>(`/staff/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deactivatePlatformStaff(id: string) {
  return staffLifecycle(id, 'deactivations');
}

export function reactivatePlatformStaff(id: string) {
  return staffLifecycle(id, 'reactivations');
}

export function getPlatformStaffRoles(id: string, signal?: AbortSignal) {
  return apiRequest<PlatformStaffRoleAssignment[]>(`/staff/${id}/roles`, {
    signal,
  });
}

export function assignPlatformStaffRole(staffId: string, roleId: string) {
  return apiRequest<PlatformStaffRoleAssignment>(
    `/staff/${staffId}/role-assignments`,
    { method: 'POST', body: JSON.stringify({ roleId }) },
  );
}

export function removePlatformStaffRole(staffId: string, roleId: string) {
  return apiRequest<PlatformStaffRoleAssignment>(
    `/staff/${staffId}/role-assignments/${roleId}`,
    { method: 'DELETE' },
  );
}

function staffLifecycle(id: string, action: string) {
  return apiRequest<PlatformStaff>(`/staff/${id}/${action}`, {
    method: 'POST',
  });
}
