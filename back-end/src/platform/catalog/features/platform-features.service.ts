import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { ListFeaturesQueryDto } from './dto/list-features-query.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';

async function auditFeature(
  tx: Prisma.TransactionClient,
  actorStaffId: string,
  action: string,
  resourceId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await tx.platformAuditLog.create({
    data: {
      actorStaffId,
      action,
      resourceType: 'Feature',
      resourceId,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.DbNull,
    },
  });
}

@Injectable()
export class PlatformFeaturesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListFeaturesQueryDto) {
    const { page, limit, search, isActive, sortBy, order } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.FeatureWhereInput = {
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { key: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.feature.count({ where }),
      this.prisma.feature.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: { _count: { select: { planFeatures: true } } },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const feature = await this.prisma.feature.findUnique({
      where: { id },
      include: {
        planFeatures: {
          include: { plan: true },
        },
      },
    });

    if (!feature) {
      throw new NotFoundException({
        code: 'FEATURE_NOT_FOUND',
        message: 'Feature not found.',
      });
    }

    return feature;
  }

  async create(dto: CreateFeatureDto, actorStaffId: string) {
    try {
      const feature = await this.prisma.$transaction(async (tx) => {
        const created = await tx.feature.create({
          data: {
            key: dto.key,
            name: dto.name,
            description: dto.description,
            valueType: dto.valueType,
            isActive: true,
          },
        });

        await auditFeature(tx, actorStaffId, 'feature.created', created.id, {
          key: created.key,
        });

        return created;
      });

      return feature;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'FEATURE_ALREADY_EXISTS',
          message: 'A feature with this key or name already exists.',
        });
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateFeatureDto, actorStaffId: string) {
    const existing = await this.prisma.feature.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'FEATURE_NOT_FOUND',
        message: 'Feature not found.',
      });
    }

    try {
      const feature = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.feature.update({
          where: { id },
          data: dto,
        });

        await auditFeature(tx, actorStaffId, 'feature.updated', updated.id);

        return updated;
      });

      return feature;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'FEATURE_NAME_IN_USE',
          message: 'This feature name is already in use.',
        });
      }
      throw error;
    }
  }

  async activate(id: string, actorStaffId: string) {
    const existing = await this.prisma.feature.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'FEATURE_NOT_FOUND',
        message: 'Feature not found.',
      });
    }

    if (existing.isActive) {
      throw new ConflictException({
        code: 'FEATURE_ALREADY_ACTIVE',
        message: 'Feature is already active.',
      });
    }

    const feature = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.feature.update({
        where: { id },
        data: { isActive: true },
      });

      await auditFeature(tx, actorStaffId, 'feature.activated', updated.id);

      return updated;
    });

    return feature;
  }

  async deactivate(id: string, actorStaffId: string) {
    const existing = await this.prisma.feature.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'FEATURE_NOT_FOUND',
        message: 'Feature not found.',
      });
    }

    if (!existing.isActive) {
      throw new ConflictException({
        code: 'FEATURE_ALREADY_INACTIVE',
        message: 'Feature is already inactive.',
      });
    }

    const feature = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.feature.update({
        where: { id },
        data: { isActive: false },
      });

      await auditFeature(tx, actorStaffId, 'feature.deactivated', updated.id);

      return updated;
    });

    return feature;
  }
}
