import { NotFoundException } from '@nestjs/common';
import { PlatformAuditLogService } from './platform-audit.service';

describe('PlatformAuditLogService', () => {
  it('sanitizes metadata to an allowlist and ignores unsafe values', async () => {
    const create = jest.fn<
      Promise<{ id: string }>,
      [Record<string, unknown>]
    >();
    create.mockResolvedValue({ id: 'audit-1' });

    const prisma: {
      platformAuditLog: {
        create: typeof create;
      };
    } = {
      platformAuditLog: { create },
    };

    const service = new PlatformAuditLogService(prisma as never);
    await service.recordEvent({
      actorStaffId: 'staff-1',
      eventCode: 'ORGANIZATION_CREATED',
      category: 'ORGANIZATION',
      resourceType: 'Organization',
      resourceId: 'org-1',
      summary: 'Organization created',
      metadata: {
        password: 'secret',
        requestId: 'req-1',
        correlationId: 'corr-1',
        statusBefore: 'PROVISIONING',
        statusAfter: 'ACTIVE',
        ignored: 'bad',
      },
    });

    const call = create.mock.calls[0]?.[0] as {
      data: {
        actorStaffId: string;
        eventCode: string;
        category: string;
        resourceType: string;
        resourceId: string;
        summary: string;
        metadata: {
          requestId: string;
          correlationId: string;
          statusBefore: string;
          statusAfter: string;
        };
      };
    };

    expect(call.data.actorStaffId).toBe('staff-1');
    expect(call.data.eventCode).toBe('ORGANIZATION_CREATED');
    expect(call.data.category).toBe('ORGANIZATION');
    expect(call.data.resourceType).toBe('Organization');
    expect(call.data.resourceId).toBe('org-1');
    expect(call.data.summary).toBe('Organization created');
    expect(call.data.metadata).toEqual({
      requestId: 'req-1',
      correlationId: 'corr-1',
      statusBefore: 'PROVISIONING',
      statusAfter: 'ACTIVE',
    });
  });

  it('finds a single audit log for a valid id', async () => {
    const findUnique = jest.fn<Promise<{ id: string } | null>, [string]>();
    findUnique.mockResolvedValue({ id: 'audit-1' });

    const prisma: {
      platformAuditLog: {
        findUnique: typeof findUnique;
      };
    } = {
      platformAuditLog: {
        findUnique,
      },
    };

    const service = new PlatformAuditLogService(prisma as never);
    await expect(service.findOne('audit-1')).resolves.toMatchObject({
      id: 'audit-1',
    });
  });

  it('throws a not-found error for a missing audit log', async () => {
    const findUnique = jest.fn<Promise<null>, [string]>();
    findUnique.mockResolvedValue(null);

    const prisma: {
      platformAuditLog: {
        findUnique: typeof findUnique;
      };
    } = {
      platformAuditLog: {
        findUnique,
      },
    };

    const service = new PlatformAuditLogService(prisma as never);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
