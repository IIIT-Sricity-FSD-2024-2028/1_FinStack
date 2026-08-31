import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationStatus } from '@prisma/client';
import { CoreSubscriptionsService } from '../../core/subscriptions/core-subscriptions.service';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { TenantRegisterOrganizationDto } from './dto/tenant-register-organization.dto';
import { TenantRegistrationService } from './tenant-registration.service';

describe('TenantRegistrationService', () => {
  let service: TenantRegistrationService;

  const prisma = {
    organization: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const subscriptions = {
    startTrialInTransaction: jest.fn(),
  };

  const users = {
    create: jest.fn(),
  };

  const dto: TenantRegisterOrganizationDto = {
    organizationName: 'Acme Corp',
    organizationEmail: 'hello@acme.test',
    organizationId: 'acme-corp',
    companySize: '51-200 employees',
    adminName: 'Asha Rao',
    adminEmployeeId: 'CFG-9001',
    adminEmail: 'asha@acme.test',
    adminPassword: 'FinStack@123',
    planId: 'a3c759d4-8178-4a86-83d4-acbfa5db080a',
    enabledRoles: ['manager'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantRegistrationService,
        { provide: PrismaService, useValue: prisma },
        { provide: CoreSubscriptionsService, useValue: subscriptions },
        { provide: UsersService, useValue: users },
      ],
    }).compile();

    service = module.get(TenantRegistrationService);
    jest.clearAllMocks();
  });

  it('creates organization and subscription in one transaction, then creates tenant admin user', async () => {
    prisma.organization.findFirst.mockResolvedValue(null);

    const organization = {
      id: '7d887ac7-aa7c-47f8-9401-c6a2ced17cfe',
      slug: 'acme-corp',
      primaryEmail: 'hello@acme.test',
    };
    const subscription = {
      id: 'sub-id',
      status: 'TRIAL',
      plan: { id: dto.planId, name: 'Professional' },
    };
    const tx = {
      organization: {
        create: jest.fn().mockResolvedValue(organization),
      },
    };

    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    subscriptions.startTrialInTransaction.mockResolvedValue(subscription);
    users.create.mockReturnValue({
      id: 'user-id',
      employeeId: dto.adminEmployeeId,
      fullName: dto.adminName,
      email: dto.adminEmail,
      roles: ['configuration_manager'],
      organizationId: organization.id,
    });

    const result = await service.registerOrganization(dto);

    expect(tx.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: 'acme-corp',
          status: OrganizationStatus.TRIAL,
          metadata: expect.objectContaining({
            enabledRoles: expect.arrayContaining([
              'expense_submitter',
              'configuration_manager',
              'manager',
            ]),
          }),
        }),
      }),
    );
    expect(subscriptions.startTrialInTransaction).toHaveBeenCalledWith(
      tx,
      organization.id,
      dto.planId,
    );
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: dto.adminEmployeeId,
        organizationId: organization.id,
        roles: ['configuration_manager'],
      }),
    );
    expect(result.subscription).toBe(subscription);
    expect(result.superUser).not.toHaveProperty('password');
  });

  it('rejects duplicate organization IDs or emails before creating tenant users', async () => {
    prisma.organization.findFirst.mockResolvedValue({ id: 'existing-org' });

    await expect(service.registerOrganization(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(users.create).not.toHaveBeenCalled();
  });
});
