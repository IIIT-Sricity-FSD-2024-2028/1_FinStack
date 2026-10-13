/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matchers are typed as any. */
import { TenantRole, Prisma } from '@prisma/client';
import { appendAudit, auditSnapshot } from './tenant-audit-write';
import { auditContext, AuditActor } from './tenant-audit-context';
import {
  auditCsvCell,
  auditWhere,
  AuditQuery,
} from './tenant-audit.controller';
const actor: AuditActor = {
  organizationId: 'org-a',
  actorUserId: 'user-a',
  actorKind: 'USER',
  actorRole: TenantRole.CONFIGURATION_MANAGER,
  actorName: 'Historical Actor',
};
describe('Tenant audit safety', () => {
  it('rejects missing and foreign actor contexts instead of silently losing audit', async () => {
    const create = jest.fn();
    const tx = {
      tenantAuditLog: { create },
    } as unknown as Prisma.TransactionClient;
    await expect(
      appendAudit(tx, 'org-a', 'employee.created', 'employee', 'id', {}),
    ).rejects.toThrow('actor');
    await expect(
      auditContext.run(actor, () =>
        appendAudit(tx, 'org-b', 'employee.created', 'employee', 'id', {}),
      ),
    ).rejects.toThrow('actor');
    expect(create).not.toHaveBeenCalled();
  });
  it('writes immutable role/name snapshots from context without reading mutable user names later', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'event' }),
      tx = {
        tenantAuditLog: { create },
      } as unknown as Prisma.TransactionClient;
    await auditContext.run(actor, () =>
      appendAudit(tx, 'org-a', 'employee.updated', 'employee', 'id', {
        changedFields: ['email'],
      }),
    );
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorName: 'Historical Actor',
        actorRole: 'CONFIGURATION_MANAGER',
        actorUserId: 'user-a',
        occurredAt: expect.any(Date),
      }),
    });
  });
  it('never copies arbitrary sensitive user/import fields into snapshots', () => {
    expect(
      auditSnapshot('employee', {
        role: 'MANAGER',
        passwordHash: 'secret',
        activationTokenHash: 'token',
        email: 'private@example.test',
      }),
    ).toEqual(expect.objectContaining({ role: 'MANAGER' }));
    expect(
      JSON.stringify(
        auditSnapshot('employee', {
          passwordHash: 'secret',
          email: 'private@example.test',
        }),
      ),
    ).not.toMatch(/secret|private/);
  });
  it('bounds event summaries', async () => {
    const create = jest.fn(),
      tx = {
        tenantAuditLog: { create },
      } as unknown as Prisma.TransactionClient;
    await expect(
      appendAudit(
        tx,
        'org-a',
        'import.completed',
        'import',
        'id',
        { text: 'x'.repeat(65537) },
        actor,
      ),
    ).rejects.toThrow('limit');
    expect(create).not.toHaveBeenCalled();
  });
  it('forces tenant scope and treats wildcard search as literal', () => {
    expect(
      auditWhere('trusted-tenant', { ...new AuditQuery(), search: '%_' }),
    ).toMatchObject({
      organizationId: 'trusted-tenant',
      OR: expect.arrayContaining([
        { actorName: { contains: '\\%\\_', mode: 'insensitive' } },
      ]),
    });
  });
  it('escapes real CSV including spreadsheet formulas, commas, quotes and line breaks', () => {
    expect(auditCsvCell('=2+2')).toBe('"\'=2+2"');
    expect(auditCsvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
  });
});
