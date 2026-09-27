import { ForbiddenException } from '@nestjs/common';
import { PlatformStaffStatus, Prisma } from '@prisma/client';

export const PLATFORM_SUPER_ADMIN_ROLE_KEY = 'PLATFORM_SUPER_ADMIN';

interface AuthorityViolation {
  code: string;
  message: string;
}

export async function resolveEffectivePermissionIds(
  transaction: Prisma.TransactionClient,
  staffId: string,
): Promise<Set<string>> {
  const staff = await transaction.platformStaff.findFirst({
    where: { id: staffId, status: PlatformStaffStatus.ACTIVE },
    select: {
      roles: {
        where: { role: { isActive: true } },
        select: {
          role: {
            select: {
              rolePermissions: { select: { permissionId: true } },
            },
          },
        },
      },
    },
  });

  return new Set(
    staff?.roles.flatMap(({ role }) =>
      role.rolePermissions.map(({ permissionId }) => permissionId),
    ) ?? [],
  );
}

export async function assertPermissionsWithinActorAuthority(
  transaction: Prisma.TransactionClient,
  authenticatedStaffId: string,
  permissionIds: Iterable<string>,
  violation: AuthorityViolation,
): Promise<void> {
  const requiredPermissionIds = new Set(permissionIds);
  if (requiredPermissionIds.size === 0) {
    return;
  }
  const actorPermissionIds = await resolveEffectivePermissionIds(
    transaction,
    authenticatedStaffId,
  );
  for (const permissionId of requiredPermissionIds) {
    if (!actorPermissionIds.has(permissionId)) {
      throw new ForbiddenException(violation);
    }
  }
}

export async function assertEffectiveSuperAdmin(
  transaction: Prisma.TransactionClient,
  authenticatedStaffId: string,
): Promise<void> {
  const effectiveSuperAdmin = await transaction.platformStaff.findFirst({
    where: {
      id: authenticatedStaffId,
      status: PlatformStaffStatus.ACTIVE,
      roles: {
        some: {
          role: { key: PLATFORM_SUPER_ADMIN_ROLE_KEY, isActive: true },
        },
      },
    },
    select: { id: true },
  });
  if (!effectiveSuperAdmin) {
    throw new ForbiddenException({
      code: 'EFFECTIVE_SUPER_ADMIN_REQUIRED',
      message: 'An effective Super Admin is required for this operation.',
    });
  }
}
