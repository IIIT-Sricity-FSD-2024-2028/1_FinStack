import { PlatformStaffStatus, Prisma } from '@prisma/client';

export const safePlatformStaffSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PlatformStaffSelect;

export const safePlatformRoleSelect = {
  id: true,
  key: true,
  name: true,
  description: true,
  isSystemPreset: true,
  isActive: true,
} satisfies Prisma.PlatformRoleSelect;

export const safePlatformStaffRoleAssignmentSelect = {
  staffId: true,
  assignedAt: true,
  assignedByStaffId: true,
  role: { select: safePlatformRoleSelect },
} satisfies Prisma.PlatformStaffRoleSelect;

type SafePlatformStaffRecord = Prisma.PlatformStaffGetPayload<{
  select: typeof safePlatformStaffSelect;
}>;

type SafePlatformStaffRoleAssignmentRecord =
  Prisma.PlatformStaffRoleGetPayload<{
    select: typeof safePlatformStaffRoleAssignmentSelect;
  }>;

export interface PlatformStaffResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: PlatformStaffStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformRoleResponse {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystemPreset: boolean;
  isActive: boolean;
}

export interface PlatformStaffRoleAssignmentResponse {
  staffId: string;
  role: PlatformRoleResponse;
  assignedAt: Date;
  assignedByStaffId: string | null;
}

export function toSafePlatformStaff(
  staff: SafePlatformStaffRecord,
): PlatformStaffResponse {
  return {
    id: staff.id,
    firstName: staff.firstName,
    lastName: staff.lastName,
    email: staff.email,
    status: staff.status,
    lastLoginAt: staff.lastLoginAt,
    createdAt: staff.createdAt,
    updatedAt: staff.updatedAt,
  };
}

export function toSafePlatformStaffRoleAssignment(
  assignment: SafePlatformStaffRoleAssignmentRecord,
): PlatformStaffRoleAssignmentResponse {
  return {
    staffId: assignment.staffId,
    role: {
      id: assignment.role.id,
      key: assignment.role.key,
      name: assignment.role.name,
      description: assignment.role.description,
      isSystemPreset: assignment.role.isSystemPreset,
      isActive: assignment.role.isActive,
    },
    assignedAt: assignment.assignedAt,
    assignedByStaffId: assignment.assignedByStaffId,
  };
}
