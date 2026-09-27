import { Prisma } from '@prisma/client';

export const safePlatformRoleManagementSelect = {
  id: true,
  key: true,
  name: true,
  description: true,
  isSystemPreset: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PlatformRoleSelect;

export const safePermissionSelect = {
  id: true,
  key: true,
  description: true,
} satisfies Prisma.PermissionSelect;

export const safePlatformRolePermissionSelect = {
  roleId: true,
  assignedAt: true,
  permission: { select: safePermissionSelect },
} satisfies Prisma.PlatformRolePermissionSelect;

type SafePlatformRoleRecord = Prisma.PlatformRoleGetPayload<{
  select: typeof safePlatformRoleManagementSelect;
}>;

type SafePermissionRecord = Prisma.PermissionGetPayload<{
  select: typeof safePermissionSelect;
}>;

type SafePlatformRolePermissionRecord =
  Prisma.PlatformRolePermissionGetPayload<{
    select: typeof safePlatformRolePermissionSelect;
  }>;

export interface PlatformRoleManagementResponse {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystemPreset: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformPermissionResponse {
  id: string;
  key: string;
  description: string;
}

export interface PlatformRolePermissionResponse {
  roleId: string;
  permission: PlatformPermissionResponse;
  assignedAt: Date;
}

export function toSafePlatformRole(
  role: SafePlatformRoleRecord,
): PlatformRoleManagementResponse {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystemPreset: role.isSystemPreset,
    isActive: role.isActive,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

export function toSafePermission(
  permission: SafePermissionRecord,
): PlatformPermissionResponse {
  return {
    id: permission.id,
    key: permission.key,
    description: permission.description,
  };
}

export function toSafePlatformRolePermission(
  assignment: SafePlatformRolePermissionRecord,
): PlatformRolePermissionResponse {
  return {
    roleId: assignment.roleId,
    permission: toSafePermission(assignment.permission),
    assignedAt: assignment.assignedAt,
  };
}
