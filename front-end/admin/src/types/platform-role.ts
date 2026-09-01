export interface PlatformRole {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystemPreset: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformPermission {
  id: string;
  key: string;
  description: string;
}

export interface PlatformRolePermissionAssignment {
  roleId: string;
  permission: PlatformPermission;
  assignedAt: string;
}

export interface PlatformRoleListResponse {
  items: PlatformRole[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PlatformRoleListQuery {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean | '';
  isSystemPreset?: boolean | '';
  sortBy?:
    | 'key'
    | 'name'
    | 'isActive'
    | 'isSystemPreset'
    | 'createdAt'
    | 'updatedAt';
  order?: 'asc' | 'desc';
}

export interface CreatePlatformRolePayload {
  key: string;
  name: string;
  description?: string;
}

export interface UpdatePlatformRolePayload {
  name?: string;
  description?: string | null;
}
