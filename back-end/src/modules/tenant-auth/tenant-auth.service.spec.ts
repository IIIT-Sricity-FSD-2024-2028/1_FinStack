import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { UsersRepository } from '../users/users.repository';
import { TenantAuthService } from './tenant-auth.service';

describe('TenantAuthService', () => {
  let service: TenantAuthService;

  const canonicalOrganization = {
    id: '7d887ac7-aa7c-47f8-9401-c6a2ced17cfe',
    slug: 'finstack-tech-01',
    externalCustomerRef: 'finstack-tech-01',
  };

  const usersRepo = {
    findAll: jest.fn(),
  };

  const jwtService = {
    signAsync: jest.fn(),
  };

  const prisma = {
    organization: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantAuthService,
        { provide: UsersRepository, useValue: usersRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(TenantAuthService);
    jest.clearAllMocks();
    prisma.organization.findFirst.mockResolvedValue(canonicalOrganization);
    jwtService.signAsync.mockResolvedValue('tenant-token');
  });

  it('issues tenant tokens with the canonical organization ID', async () => {
    usersRepo.findAll.mockReturnValue([
      {
        id: 'user-id',
        employeeId: 'CFG-1001',
        fullName: 'Config Manager',
        email: 'config@example.test',
        roles: ['configuration_manager'],
        organizationId: 'finstack-tech-01',
        password: 'FinStack@123',
        status: 'Active',
        accountStatus: 'approved',
      },
    ]);

    const result = await service.login({
      organizationId: 'finstack-tech-01',
      employeeId: 'CFG-1001',
      password: 'FinStack@123',
    });

    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: canonicalOrganization.id,
      }),
      expect.any(Object),
    );
    expect(result.user.organizationId).toBe(canonicalOrganization.id);
    expect(result.user.organizationDisplayId).toBe('finstack-tech-01');
  });

  it('rejects tenant login when the organization is not canonical', async () => {
    prisma.organization.findFirst.mockResolvedValue(null);

    await expect(
      service.login({
        organizationId: 'missing-org',
        employeeId: 'CFG-1001',
        password: 'FinStack@123',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
