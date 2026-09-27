import type {
  CreatePlatformRolePayload,
  PlatformPermission,
  PlatformRole,
  PlatformRoleListQuery,
  PlatformRoleListResponse,
  PlatformRolePermissionAssignment,
  UpdatePlatformRolePayload,
} from '../../types/platform-role';
import { apiRequest } from './client';
import { queryString } from './query-string';

export function getPlatformRoles(
  query: PlatformRoleListQuery,
  signal?: AbortSignal,
) {
  return apiRequest<PlatformRoleListResponse>(
    `/roles${queryString(query)}`,
    { signal },
  );
}

export function getPlatformRole(id: string, signal?: AbortSignal) {
  return apiRequest<PlatformRole>(`/roles/${id}`, { signal });
}

export function createPlatformRole(payload: CreatePlatformRolePayload) {
  return apiRequest<PlatformRole>('/roles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updatePlatformRole(
  id: string,
  payload: UpdatePlatformRolePayload,
) {
  return apiRequest<PlatformRole>(`/roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deactivatePlatformRole(id: string) {
  return roleLifecycle(id, 'deactivations');
}

export function reactivatePlatformRole(id: string) {
  return roleLifecycle(id, 'reactivations');
}

export function getPlatformRolePermissions(id: string, signal?: AbortSignal) {
  return apiRequest<PlatformRolePermissionAssignment[]>(
    `/roles/${id}/permissions`,
    { signal },
  );
}

export function assignPlatformRolePermission(
  roleId: string,
  permissionId: string,
) {
  return apiRequest<PlatformRolePermissionAssignment>(
    `/roles/${roleId}/permission-assignments`,
    { method: 'POST', body: JSON.stringify({ permissionId }) },
  );
}

export function removePlatformRolePermission(
  roleId: string,
  permissionId: string,
) {
  return apiRequest<PlatformRolePermissionAssignment>(
    `/roles/${roleId}/permission-assignments/${permissionId}`,
    { method: 'DELETE' },
  );
}

export function getPlatformPermissions(
  search = '',
  signal?: AbortSignal,
) {
  return apiRequest<PlatformPermission[]>(
    `/permissions${queryString({ search })}`,
    { signal },
  );
}

function roleLifecycle(id: string, action: string) {
  return apiRequest<PlatformRole>(`/roles/${id}/${action}`, {
    method: 'POST',
  });
}
