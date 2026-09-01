import { ConflictException, Injectable } from '@nestjs/common';
import { PlanStatus, TenantRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { PlatformSubscriptionsService } from '../../platform/subscriptions/platform-subscriptions.service';
import { TenantAuthResponse } from '../auth/tenant-auth.types';
import { TenantAuthService } from '../auth/tenant-auth.service';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { QuoteDto } from './dto/quote.dto';

@Injectable()
export class TenantOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: PlatformSubscriptionsService,
    private readonly auth: TenantAuthService,
  ) {}

  async listPlans() {
    const plans = await this.prisma.plan.findMany({
      where: { status: PlanStatus.ACTIVE },
      orderBy: [{ basePrice: 'asc' }, { name: 'asc' }],
      include: {
        planFeatures: { where: { enabled: true }, include: { feature: true } },
      },
    });
    return {
      items: plans.map((plan) => ({
        id: plan.id,
        key: plan.key,
        name: plan.name,
        description: plan.description,
        billingInterval: plan.billingInterval,
        basePrice: plan.basePrice.toString(),
        currency: plan.currency,
        trialDays: plan.trialDays,
        includedEmployeeCount: plan.includedEmployeeCount,
        additionalEmployeePrice: plan.additionalEmployeePrice.toString(),
        features: plan.planFeatures.map((item) => ({
          id: item.feature.id,
          key: item.feature.key,
          name: item.feature.name,
          description: item.feature.description,
          valueType: item.feature.valueType,
          value: item.value,
          isAddOn: item.isAddOn,
          addOnPrice: item.addOnPrice.toString(),
        })),
      })),
    };
  }

  quote(dto: QuoteDto) {
    return this.subscriptions.quote(
      dto.planId,
      dto.employeeCount,
      dto.featureIds ?? [],
    );
  }

  async register(
    dto: RegisterOrganizationDto,
  ): Promise<TenantAuthResponse & { subscription: unknown; invoice: unknown }> {
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    const email = dto.email.trim().toLowerCase();
    const primaryEmail = dto.primaryEmail.trim().toLowerCase();
    const slug = dto.slug?.trim().toLowerCase() || this.slugify(dto.name);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const plan = await tx.plan.findUnique({
          where: { id: dto.planId },
          select: { id: true, status: true },
        });
        if (!plan || plan.status !== PlanStatus.ACTIVE) {
          throw new ConflictException({
            code: 'PLAN_INACTIVE',
            message: 'Only an active plan can be selected.',
          });
        }
        const organization = await tx.organization.create({
          data: {
            name: dto.name.trim(),
            slug,
            primaryEmail,
            primaryContactName: `${dto.firstName.trim()} ${dto.lastName.trim()}`,
            primaryContactEmail: email,
          },
        });
        const user = await tx.tenantUser.create({
          data: {
            organizationId: organization.id,
            employeeId: `CFG-${randomUUID().slice(0, 8).toUpperCase()}`,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            email,
            passwordHash,
            role: TenantRole.CONFIGURATION_MANAGER,
          },
        });
        const commercial = await this.subscriptions.assignInTransaction(
          tx,
          {
            organizationId: organization.id,
            planId: plan.id,
            employeeCount: dto.employeeCount,
            featureIds: dto.featureIds,
          },
          null,
        );
        return { organization, user, commercial };
      });
      const auth = await this.auth.login({
        organizationId: result.organization.id,
        email,
        password: dto.password,
      });
      return {
        ...auth,
        subscription: result.commercial.subscription,
        invoice: result.commercial.invoice,
      };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'TENANT_REGISTRATION_CONFLICT',
          message:
            'An organization or administrator with these details already exists.',
        });
      }
      throw error;
    }
  }

  private slugify(value: string): string {
    const slug = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
    if (!slug)
      throw new ConflictException({
        code: 'ORGANIZATION_SLUG_INVALID',
        message: 'Organization name must produce a valid slug.',
      });
    return slug;
  }
}
