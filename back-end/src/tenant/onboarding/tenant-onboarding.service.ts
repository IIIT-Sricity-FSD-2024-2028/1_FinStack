import { ConflictException, Injectable, OnModuleInit } from '@nestjs/common';
import { PlanStatus, TenantRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { PlatformSubscriptionsService } from '../../platform/subscriptions/platform-subscriptions.service';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { QuoteDto } from './dto/quote.dto';
import { organizationDomainAliases } from '../../platform/organizations/organization-domain';
import { verifyManualQaDatabase } from '../../common/config/manual-qa';
import { registrationIdentity } from './registration-identity';

@Injectable()
export class TenantOnboardingService implements OnModuleInit {
  private manualQa = false;
  async onModuleInit() {
    this.manualQa = await verifyManualQaDatabase(this.prisma);
  }
  registrationEnvironment() {
    return { manualQa: this.manualQa };
  }
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: PlatformSubscriptionsService,
  ) {}

  async listPlans() {
    const plans = await this.prisma.plan.findMany({
      where: { status: PlanStatus.ACTIVE },
      orderBy: [{ basePrice: 'asc' }, { name: 'asc' }],
      include: {
        planFeatures: {
          where: { enabled: true },
          include: { feature: true },
        },
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

  async register(dto: RegisterOrganizationDto) {
    const identity = registrationIdentity(dto, this.manualQa);
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const { email, primaryEmail } = identity;
    const slug = dto.slug?.trim().toLowerCase() || `org-${randomUUID()}`;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Serialize self-service attempts against historical rows without domain keys.
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${identity.normalizedDomain}))`;
        const duplicate = await tx.organization.findFirst({
          where: {
            OR: [
              { normalizedDomain: identity.normalizedDomain },
              ...organizationDomainAliases(identity.normalizedDomain).map(
                (alias) => ({
                  primaryEmail: {
                    endsWith: '@' + alias,
                    mode: 'insensitive' as const,
                  },
                }),
              ),
              ...(identity.registrationIdentifierKey
                ? [
                    {
                      registrationCountry: dto.registrationCountry,
                      registrationIdentifierKey:
                        identity.registrationIdentifierKey,
                    },
                  ]
                : []),
            ],
          },
          select: { id: true },
        });
        if (duplicate)
          throw new ConflictException({
            code: 'TENANT_REGISTRATION_CONFLICT',
            message:
              'An organization with these identity details already exists. Contact FinStack if you need access or share a company domain.',
          });
        const plan = await tx.plan.findUnique({
          where: { id: dto.planId },
          select: {
            id: true,
            status: true,
          },
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
            normalizedDomain: identity.normalizedDomain,
            registrationIdentifier: identity.registrationIdentifier,
            registrationIdentifierKey: identity.registrationIdentifierKey,
            registrationExemptionReason: identity.registrationExemptionReason,
            primaryEmail,
            registrationCountry: dto.registrationCountry,
            country: dto.registrationCountry,
            authorizedContactTitle: dto.authorizedContactTitle.trim(),
            registrationStatus: 'PENDING_ORGANIZATION_REVIEW',
            registrationSubmittedAt: new Date(),
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

        await tx.platformAuditLog.create({
          data: {
            action: 'organization.registration.submitted',
            resourceType: 'Organization',
            resourceId: organization.id,
            newValue: {
              registrationStatus: 'PENDING_ORGANIZATION_REVIEW',
              domainVerified: false,
            },
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

        return {
          organization,
          user,
          commercial,
        };
      });

      return {
        organizationId: result.organization.id,
        organizationSlug: result.organization.slug || '',
        employeeId: result.user.employeeId,
        registrationStatus: result.organization.registrationStatus,
        domainVerified: false,
        message:
          'Submitted for organization review. Domain ownership and legal identity have not been verified. Email verification delivery is unavailable; no verification email was sent. Tenant access requires Admin approval.',
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

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
}
