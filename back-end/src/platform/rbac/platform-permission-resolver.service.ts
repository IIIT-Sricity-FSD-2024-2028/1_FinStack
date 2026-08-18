import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuthContext, PlatformStaffIdentity } from '../auth/auth.types';

@Injectable()
export class PlatformPermissionResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    staff: PlatformStaffIdentity,
    sessionId: string,
  ): Promise<PlatformAuthContext> {
    const assignments = await this.prisma.platformStaffRole.findMany({
      where: { staffId: staff.id, role: { isActive: true } },
      include: {
        role: {
          include: { rolePermissions: { include: { permission: true } } },
        },
      },
    });

    const permissions = new Set<string>();
    for (const assignment of assignments) {
      for (const rolePermission of assignment.role.rolePermissions) {
        permissions.add(rolePermission.permission.key);
      }
    }

    return {
      sessionId,
      staff,
      roles: assignments.map(({ role }) => ({
        id: role.id,
        key: role.key,
        name: role.name,
      })),
      permissions: [...permissions].sort(),
    };
  }
}
