import type { PlatformStaffStatus } from './auth';
import type { PlatformRole } from './platform-role';

export type { PlatformStaffStatus } from './auth';

export interface PlatformStaff {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: PlatformStaffStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformStaffListResponse {
  items: PlatformStaff[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PlatformStaffListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: PlatformStaffStatus | '';
  sortBy?:
    | 'firstName'
    | 'lastName'
    | 'email'
    | 'status'
    | 'createdAt'
    | 'updatedAt';
  order?: 'asc' | 'desc';
}

export interface CreatePlatformStaffPayload {
  firstName: string;
  lastName: string;
  email: string;
  initialPassword: string;
}

export interface UpdatePlatformStaffPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface PlatformStaffRoleAssignment {
  staffId: string;
  role: Pick<
    PlatformRole,
    'id' | 'key' | 'name' | 'description' | 'isSystemPreset' | 'isActive'
  >;
  assignedAt: string;
  assignedByStaffId: string | null;
}
