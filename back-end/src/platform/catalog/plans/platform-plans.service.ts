import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { ListPlansQueryDto } from './dto/list-plans-query.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

async function auditPlan(
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
      resourceType: 'Plan',
      resourceId,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.DbNull,
    },
  });
}

@Injectable()
export class PlatformPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListPlansQueryDto) {
    const { page, limit, search, status, sortBy, order } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PlanWhereInput = {
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { key: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.plan.count({ where }),
      this.prisma.plan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
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
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: {
        planFeatures: {
          include: { feature: true },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Plan not found.',
      });
    }

    return plan;
  }

  async create(dto: CreatePlanDto, actorStaffId: string) {
    try {
      const plan = await this.prisma.$transaction(async (tx) => {
        const created = await tx.plan.create({
          data: {
            key: dto.key,
            name: dto.name,
            description: dto.description,
            billingInterval: dto.billingInterval,
            basePrice: dto.basePrice,
            currency: dto.currency,
            trialDays: dto.trialDays,
          },
        });

        await auditPlan(tx, actorStaffId, 'plan.created', created.id, {
          key: created.key,
        });

        return created;
      });

      return plan;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'PLAN_ALREADY_EXISTS',
          message: 'A plan with this key or name already exists.',
        });
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdatePlanDto, actorStaffId: string) {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Plan not found.',
      });
    }

    try {
      const plan = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.plan.update({
          where: { id },
          data: dto,
        });

        await auditPlan(tx, actorStaffId, 'plan.updated', updated.id);

        return updated;
      });

      return plan;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'PLAN_NAME_IN_USE',
          message: 'This plan name is already in use.',
        });
      }
      throw error;
    }
  }

  async activate(id: string, actorStaffId: string) {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Plan not found.',
      });
    }

    if (existing.status === 'ACTIVE') {
      throw new ConflictException({
        code: 'PLAN_ALREADY_ACTIVE',
        message: 'Plan is already active.',
      });
    }

    const plan = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.plan.update({
        where: { id },
        data: { status: 'ACTIVE' },
      });

      await auditPlan(tx, actorStaffId, 'plan.activated', updated.id);

      return updated;
    });

    return plan;
  }

  async deactivate(id: string, actorStaffId: string) {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Plan not found.',
      });
    }

    if (existing.status === 'INACTIVE') {
      throw new ConflictException({
        code: 'PLAN_ALREADY_INACTIVE',
        message: 'Plan is already inactive.',
      });
    }

    const plan = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.plan.update({
        where: { id },
        data: { status: 'INACTIVE' },
      });

      await auditPlan(tx, actorStaffId, 'plan.deactivated', updated.id);

      return updated;
    });

    return plan;
  }

  async findFeatures(planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Plan not found.',
      });
    }

    const planFeatures = await this.prisma.planFeature.findMany({
      where: { planId },
      include: { feature: true },
    });

    return planFeatures;
  }
}
