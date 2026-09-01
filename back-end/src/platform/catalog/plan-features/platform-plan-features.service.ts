import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeatureValueType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AssignPlanFeatureDto } from './dto/assign-plan-feature.dto';
import { UpdatePlanFeatureDto } from './dto/update-plan-feature.dto';

function validateFeatureValue(
  valueType: FeatureValueType,
  value: unknown,
): void {
  if (value === null || value === undefined) return;
  switch (valueType) {
    case 'BOOLEAN':
      if (typeof value !== 'boolean') {
        throw new BadRequestException({
          code: 'INVALID_FEATURE_VALUE',
          message: `Feature expects a boolean value, got ${typeof value}.`,
        });
      }
      break;
    case 'INTEGER':
      if (!Number.isInteger(value)) {
        throw new BadRequestException({
          code: 'INVALID_FEATURE_VALUE',
          message: `Feature expects an integer value.`,
        });
      }
      break;
    case 'DECIMAL':
      if (typeof value !== 'number') {
        throw new BadRequestException({
          code: 'INVALID_FEATURE_VALUE',
          message: `Feature expects a numeric (decimal) value.`,
        });
      }
      break;
    case 'STRING':
      if (typeof value !== 'string') {
        throw new BadRequestException({
          code: 'INVALID_FEATURE_VALUE',
          message: `Feature expects a string value.`,
        });
      }
      break;
    case 'JSON':
      // Any JSON-compatible value is acceptable
      break;
  }
}

async function auditPlanFeature(
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
      resourceType: 'PlanFeature',
      resourceId,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.DbNull,
    },
  });
}

@Injectable()
export class PlatformPlanFeaturesService {
  constructor(private readonly prisma: PrismaService) {}

  async assign(
    planId: string,
    dto: AssignPlanFeatureDto,
    actorStaffId: string,
  ) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Plan not found.',
      });
    }

    const feature = await this.prisma.feature.findUnique({
      where: { id: dto.featureId },
    });
    if (!feature) {
      throw new NotFoundException({
        code: 'FEATURE_NOT_FOUND',
        message: 'Feature not found.',
      });
    }

    if (!feature.isActive) {
      throw new BadRequestException({
        code: 'FEATURE_INACTIVE',
        message: 'Cannot assign an inactive feature.',
      });
    }

    validateFeatureValue(feature.valueType, dto.value);

    try {
      const planFeature = await this.prisma.$transaction(async (tx) => {
        const created = await tx.planFeature.create({
          data: {
            planId,
            featureId: dto.featureId,
            enabled: dto.enabled ?? true,
            value:
              dto.value !== undefined
                ? (dto.value as Prisma.InputJsonValue)
                : Prisma.DbNull,
          },
          include: { feature: true },
        });

        await auditPlanFeature(
          tx,
          actorStaffId,
          'plan_feature.assigned',
          created.id,
          {
            planKey: plan.key,
            featureKey: feature.key,
          },
        );

        return created;
      });

      return planFeature;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'PLAN_FEATURE_ALREADY_ASSIGNED',
          message: 'This feature is already assigned to the plan.',
        });
      }
      throw error;
    }
  }

  async update(
    planId: string,
    featureId: string,
    dto: UpdatePlanFeatureDto,
    actorStaffId: string,
  ) {
    const planFeature = await this.prisma.planFeature.findUnique({
      where: { planId_featureId: { planId, featureId } },
      include: { feature: true },
    });
    if (!planFeature) {
      throw new NotFoundException({
        code: 'PLAN_FEATURE_NOT_FOUND',
        message: 'Plan feature assignment not found.',
      });
    }

    if (dto.value !== undefined) {
      validateFeatureValue(planFeature.feature.valueType, dto.value);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedPlanFeature = await tx.planFeature.update({
        where: { planId_featureId: { planId, featureId } },
        data: {
          ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
          ...(dto.value !== undefined
            ? { value: dto.value as Prisma.InputJsonValue }
            : {}),
        },
        include: { feature: true },
      });

      await auditPlanFeature(
        tx,
        actorStaffId,
        'plan_feature.updated',
        updatedPlanFeature.id,
        {
          featureKey: planFeature.feature.key,
        },
      );

      return updatedPlanFeature;
    });

    return updated;
  }

  async remove(
    planId: string,
    featureId: string,
    actorStaffId: string,
  ): Promise<void> {
    const planFeature = await this.prisma.planFeature.findUnique({
      where: { planId_featureId: { planId, featureId } },
      include: { feature: true, plan: true },
    });
    if (!planFeature) {
      throw new NotFoundException({
        code: 'PLAN_FEATURE_NOT_FOUND',
        message: 'Plan feature assignment not found.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.planFeature.delete({
        where: { planId_featureId: { planId, featureId } },
      });

      await auditPlanFeature(
        tx,
        actorStaffId,
        'plan_feature.removed',
        planFeature.id,
        {
          planKey: planFeature.plan.key,
          featureKey: planFeature.feature.key,
        },
      );
    });
  }
}
