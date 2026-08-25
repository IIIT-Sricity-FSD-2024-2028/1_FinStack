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

type SafePlatformStaffRecord = Prisma.PlatformStaffGetPayload<{
  select: typeof safePlatformStaffSelect;
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
