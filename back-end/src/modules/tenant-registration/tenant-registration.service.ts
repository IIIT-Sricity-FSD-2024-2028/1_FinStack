import { ConflictException, Injectable } from '@nestjs/common';
import { OrganizationStatus } from '@prisma/client';
import { CoreSubscriptionsService } from '../../core/subscriptions/core-subscriptions.service';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { TenantRegisterOrganizationDto } from './dto/tenant-register-organization.dto';

@Injectable()
export class TenantRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: CoreSubscriptionsService,
    private readonly users: UsersService,
  ) {}

  async registerOrganization(dto: TenantRegisterOrganizationDto) {
    const slug = dto.organizationId.trim().toLowerCase();
    const organizationEmail = dto.organizationEmail.trim().toLowerCase();
    const adminEmail = dto.adminEmail.trim().toLowerCase();
    const enabledRoles = this.normalizeRoles(dto.enabledRoles);

    const existingOrganization = await this.prisma.organization.findFirst({
      where: {
        OR: [
          { slug },
          { externalCustomerRef: slug },
          { primaryEmail: organizationEmail },
        ],
      },
    });

    if (existingOrganization) {
      throw new ConflictException({
        code: 'ORGANIZATION_ALREADY_EXISTS',
        message: 'An organization with this ID or email already exists.',
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName.trim(),
          slug,
          primaryEmail: organizationEmail,
          primaryContactName: dto.adminName.trim(),
          primaryContactEmail: adminEmail,
          billingEmail: organizationEmail,
          defaultCurrency: 'INR',
          timezone: 'Asia/Kolkata',
          status: OrganizationStatus.TRIAL,
          statusChangedAt: new Date(),
          externalCustomerRef: slug,
          metadata: {
            companySize: dto.companySize?.trim() || null,
            enabledRoles,
          },
        },
      });

      const subscription = await this.subscriptions.startTrialInTransaction(
        tx,
        organization.id,
        dto.planId,
      );

      return { organization, subscription };
    });

    const superUser = this.users.create({
      employeeId: dto.adminEmployeeId.trim(),
      fullName: dto.adminName.trim(),
      email: adminEmail,
      department: 'Administration',
      roles: ['configuration_manager'],
      status: 'Active',
      accountStatus: 'approved',
      organizationId: result.organization.id,
      password: dto.adminPassword,
      firstLoginRequired: false,
    });

    return {
      organization: result.organization,
      subscription: result.subscription,
      selectedPlan: result.subscription.plan,
      superUser: {
        id: superUser.id,
        employeeId: superUser.employeeId,
        fullName: superUser.fullName,
        email: superUser.email,
        roles: superUser.roles,
        organizationId: superUser.organizationId,
      },
    };
  }

  private normalizeRoles(roles: string[] | undefined) {
    const selected = new Set(roles ?? []);
    selected.add('expense_submitter');
    selected.add('configuration_manager');
    return Array.from(selected);
  }
}
