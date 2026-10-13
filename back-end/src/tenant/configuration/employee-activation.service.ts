import { appendAudit } from '../audit/tenant-audit-write';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { EmployeeImportService } from './employee-import.service';

@Injectable()
export class EmployeeActivationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imports: EmployeeImportService,
  ) {}
  async issue(organizationId: string, jobId: string) {
    const job = await this.imports.get(organizationId, jobId);
    if (job.status !== 'COMPLETED')
      throw new BadRequestException(
        'Complete the import before issuing activation links.',
      );
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const items: { employeeId: string; email: string; token: string }[] = [];
    let after = 0;
    while (true) {
      const rows = await this.prisma.employeeImportRow.findMany({
        where: { jobId, status: 'SUCCEEDED', rowNumber: { gt: after } },
        orderBy: { rowNumber: 'asc' },
        take: 200,
        select: { userId: true, rowNumber: true },
      });
      if (!rows.length) break;
      after = rows[rows.length - 1].rowNumber;
      const users = await this.prisma.tenantUser.findMany({
        where: {
          organizationId,
          id: { in: rows.map((row) => row.userId) },
          credentialSetupRequired: true,
          status: 'INACTIVE',
        },
        select: { id: true, employeeId: true, email: true },
      });
      if (!users.length) continue;
      const issued = users.map((user) => {
        const token = randomBytes(32).toString('hex');
        return {
          ...user,
          token,
          hash: createHash('sha256').update(token).digest('hex'),
        };
      });
      const updated = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`UPDATE "TenantUser" u SET "activationTokenHash"=v.hash,"activationExpiresAt"=${expiresAt},"updatedAt"=CURRENT_TIMESTAMP FROM (VALUES ${Prisma.join(issued.map((item) => Prisma.sql`(${item.id}::uuid,${item.hash})`))}) AS v(id,hash) WHERE u.id=v.id AND u."organizationId"=${organizationId}::uuid AND u."credentialSetupRequired"=true AND u.status='INACTIVE' RETURNING u.id`,
        );
        if (updated.length)
          await appendAudit(
            tx,
            organizationId,
            'credential.activation_links_issued',
            'import',
            jobId,
            {
              affectedUserIds: updated.map((row) => row.id),
              expiresAt: expiresAt.toISOString(),
            },
          );
        return updated;
      });
      const ids = new Set(updated.map((row) => row.id));
      items.push(
        ...issued
          .filter((item) => ids.has(item.id))
          .map(({ employeeId, email, token }) => ({
            employeeId,
            email,
            token,
          })),
      );
    }
    return { expiresAt, items };
  }
  async activate(employeeId: string, token: string, password: string) {
    const hash = createHash('sha256').update(token).digest('hex');
    const user = await this.prisma.tenantUser.findFirst({
      where: {
        employeeId,
        activationTokenHash: hash,
        activationExpiresAt: { gt: new Date() },
        credentialSetupRequired: true,
        status: 'INACTIVE',
      },
      include: { organization: true },
    });
    const org = user?.organization;
    const allowed =
      org &&
      (org.registrationStatus === 'LEGACY_APPROVED'
        ? ['PROVISIONING', 'ACTIVE', 'TRIAL'].includes(org.status)
        : org.registrationStatus === 'APPROVED' &&
          ['ACTIVE', 'TRIAL'].includes(org.status));
    if (!user || !allowed)
      throw new BadRequestException(
        'Activation link is invalid or expired. Request a new link from your Configuration Manager.',
      );
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.tenantUser.updateMany({
        where: {
          id: user.id,
          activationTokenHash: hash,
          activationExpiresAt: { gt: new Date() },
          credentialSetupRequired: true,
          status: 'INACTIVE',
        },
        data: {
          passwordHash,
          status: 'ACTIVE',
          credentialSetupRequired: false,
          activationTokenHash: null,
          activationExpiresAt: null,
        },
      });
      if (!result.count)
        throw new BadRequestException('Activation link is invalid or expired.');
      await appendAudit(
        tx,
        user.organizationId,
        'credential.activated',
        'credential',
        user.id,
        {
          before: { status: 'INACTIVE', credentialSetupRequired: true },
          after: { status: 'ACTIVE', credentialSetupRequired: false },
        },
        {
          organizationId: user.organizationId,
          actorUserId: user.id,
          actorKind: 'USER',
          actorName: `${user.firstName} ${user.lastName}`,
          actorRole: user.role,
        },
      );
    });
    return { message: 'Your password is set. Sign in with your employee ID.' };
  }
}
