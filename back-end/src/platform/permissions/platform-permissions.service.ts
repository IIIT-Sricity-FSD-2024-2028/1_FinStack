import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ListPlatformPermissionsQueryDto } from './dto/list-platform-permissions-query.dto';
import {
  PlatformPermissionResponse,
  safePermissionSelect,
  toSafePermission,
} from '../roles/platform-roles.types';

@Injectable()
export class PlatformPermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: ListPlatformPermissionsQueryDto,
  ): Promise<PlatformPermissionResponse[]> {
    const search = query.search?.trim();
    const where: Prisma.PermissionWhereInput | undefined = search
      ? {
          OR: [
            { key: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined;
    const permissions = await this.prisma.permission.findMany({
      where,
      select: safePermissionSelect,
      orderBy: [{ key: 'asc' }, { id: 'asc' }],
    });
    return permissions.map(toSafePermission);
  }
}
