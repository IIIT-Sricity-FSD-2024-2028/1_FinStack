import { enqueueNotification } from '../notifications/tenant-notifications.service';
import {
  appendAudit,
  auditedMutation,
  auditSnapshot,
} from '../audit/tenant-audit-write';
import { workerActor } from '../audit/tenant-audit-context';
import { lockReporting } from './reporting-lock';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EmployeeImportRow, Prisma, TenantRole } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { unlink } from 'fs/promises';
import { parse } from 'csv-parse';
import { PrismaService } from '../../database/prisma.service';
import { TenantAuthContext } from '../auth/tenant-auth.types';
import {
  IMPORT_BATCH,
  IMPORT_HEADERS,
  IMPORT_LIMIT,
  ImportPayload,
  validateEmployeeRow,
} from './employee-import-validation';

@Injectable()
export class EmployeeImportService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private stopping = false;
  constructor(private readonly prisma: PrismaService) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      if (!this.running && !this.stopping) {
        this.running = this.tick()
          .catch(() => undefined)
          .finally(() => {
            this.running = undefined;
          });
      }
    }, 500);
    this.timer.unref();
  }
  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }

  private jobSelect() {
    return {
      id: true,
      status: true,
      totalCount: true,
      validCount: true,
      invalidCount: true,
      processedCount: true,
      successfulCount: true,
      failedCount: true,
      error: true,
      createdAt: true,
      confirmedAt: true,
      completedAt: true,
    } satisfies Prisma.EmployeeImportJobSelect;
  }
  async list(organizationId: string) {
    return this.prisma.employeeImportJob.findMany({
      where: { organizationId },
      select: this.jobSelect(),
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async get(organizationId: string, id: string) {
    const job = await this.prisma.employeeImportJob.findFirst({
      where: { id, organizationId },
      select: this.jobSelect(),
    });
    if (!job) throw new NotFoundException('Import job not found.');
    return job;
  }
  async rows(organizationId: string, id: string, page: number) {
    await this.get(organizationId, id);
    return this.prisma.employeeImportRow.findMany({
      where: { jobId: id },
      orderBy: { rowNumber: 'asc' },
      skip: (page - 1) * 100,
      take: 100,
      select: {
        rowNumber: true,
        employeeId: true,
        email: true,
        status: true,
        errors: true,
        payload: true,
      },
    });
  }

  async upload(
    actor: TenantAuthContext,
    file: Express.Multer.File | undefined,
    key: string,
  ) {
    if (!file) throw new BadRequestException('Upload a CSV file.');
    let jobId: string | undefined;
    try {
      const hash = createHash('sha256');
      for await (const chunk of createReadStream(file.path))
        hash.update(chunk as Buffer);
      const digest = hash.digest('hex');
      const claim = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${actor.organizationId + ':employee-import-upload'}))`;
        const existing = await tx.employeeImportJob.findUnique({
          where: {
            organizationId_idempotencyKey: {
              organizationId: actor.organizationId,
              idempotencyKey: key,
            },
          },
        });
        if (existing) {
          if (existing.fileHash !== digest)
            throw new ConflictException(
              'This upload key belongs to another file. Select the file again.',
            );
          return { job: existing, created: false };
        }
        const active = await tx.employeeImportJob.count({
          where: {
            organizationId: actor.organizationId,
            status: { in: ['VALIDATING', 'QUEUED', 'RUNNING'] },
          },
        });
        const retained = await tx.employeeImportJob.count({
          where: { organizationId: actor.organizationId },
        });
        if (active >= 3 || retained >= 100)
          throw new ConflictException(
            'Import capacity reached: at most 3 active and 100 retained jobs per organization.',
          );
        const createdJob = await tx.employeeImportJob.create({
          data: {
            organizationId: actor.organizationId,
            createdById: actor.user.id,
            idempotencyKey: key,
            fileHash: digest,
          },
        });
        await appendAudit(
          tx,
          actor.organizationId,
          'import.created',
          'import',
          createdJob.id,
          { before: null, after: auditSnapshot('import', createdJob) },
        );
        return { job: createdJob, created: true };
      });
      if (!claim.created) return this.get(actor.organizationId, claim.job.id);
      const importId = claim.job.id;
      jobId = importId;
      const seenIds = new Set<string>(),
        seenEmails = new Set<string>(),
        duplicateIds = new Set<string>(),
        duplicateEmails = new Set<string>();
      let buffer: Prisma.EmployeeImportRowCreateManyInput[] = [],
        count = 0;
      const flush = async () => {
        if (!buffer.length) return;
        const existing = await this.prisma.tenantUser.findMany({
          where: {
            OR: [
              { employeeId: { in: buffer.map((row) => row.employeeId) } },
              {
                organizationId: actor.organizationId,
                OR: buffer.map((row) => ({
                  email: { equals: row.email, mode: 'insensitive' as const },
                })),
              },
            ],
          },
          select: { employeeId: true, email: true, organizationId: true },
        });
        const ids = new Set(existing.map((row) => row.employeeId)),
          emails = new Set(
            existing
              .filter((row) => row.organizationId === actor.organizationId)
              .map((row) => row.email.trim().toLowerCase()),
          );
        const managerIds = [
          ...new Set(
            buffer
              .map((row) => (row.payload as ImportPayload).managerEmployeeId)
              .filter(Boolean),
          ),
        ];
        const managers = await this.prisma.tenantUser.findMany({
          where: {
            organizationId: actor.organizationId,
            employeeId: { in: managerIds },
            role: TenantRole.MANAGER,
            status: 'ACTIVE',
            credentialSetupRequired: false,
          },
          select: { employeeId: true },
        });
        const validManagers = new Set(managers.map((row) => row.employeeId));
        for (const row of buffer) {
          const errors = row.errors as string[];
          if (ids.has(row.employeeId))
            errors.push('Employee ID is unavailable.');
          if (emails.has(row.email))
            errors.push('Email already exists in this organization.');
          const manager = (row.payload as ImportPayload).managerEmployeeId;
          if (manager && !validManagers.has(manager))
            errors.push(
              'Manager must be an existing active Manager in this organization.',
            );
          if (errors.length) row.status = 'INVALID';
        }
        await this.prisma.employeeImportRow.createMany({ data: buffer });
        buffer = [];
        await auditedMutation(
          this.prisma,
          actor.organizationId,
          'import.validation_changed',
          'import',
          importId,
          (tx) =>
            tx.employeeImportJob.update({
              where: { id: jobId },
              data: { totalCount: count },
            }),
        );
      };
      const parser = parse({
        bom: true,
        trim: true,
        skip_empty_lines: true,
        max_record_size: 4096,
        columns: (headers: string[]) => {
          if (
            new Set(headers).size !== headers.length ||
            headers.some((h) => !IMPORT_HEADERS.includes(h)) ||
            ['employeeId', 'firstName', 'lastName', 'email'].some(
              (h) => !headers.includes(h),
            )
          )
            throw new BadRequestException(
              'CSV headers must use employeeId, firstName, lastName, email and optional department, role, managerEmployeeId. Password/organization columns are forbidden.',
            );
          return headers;
        },
      });
      const source = createReadStream(file.path);
      source.on('error', (error) => parser.destroy(error));
      source.pipe(parser);
      try {
        for await (const raw of parser) {
          count++;
          if (count > IMPORT_LIMIT)
            throw new BadRequestException('CSV exceeds the 10,000-row limit.');
          const row = validateEmployeeRow(raw as Record<string, string>);
          if (seenIds.has(row.employeeId)) duplicateIds.add(row.employeeId);
          seenIds.add(row.employeeId);
          if (seenEmails.has(row.email)) duplicateEmails.add(row.email);
          seenEmails.add(row.email);
          buffer.push({
            id: randomUUID(),
            jobId,
            rowNumber: count + 1,
            employeeId: row.employeeId,
            email: row.email,
            payload: row.payload,
            status: row.errors.length ? 'INVALID' : 'VALID',
            errors: row.errors,
            userId: randomUUID(),
          });
          if (buffer.length >= IMPORT_BATCH) await flush();
        }
      } finally {
        source.destroy();
        parser.destroy();
      }
      await flush();
      if (!count)
        throw new BadRequestException('CSV contains no employee records.');
      for (const [field, duplicates] of [
        ['employeeId', duplicateIds],
        ['email', duplicateEmails],
      ] as const) {
        const values = [...duplicates];
        for (let start = 0; start < values.length; start += IMPORT_BATCH)
          await this.prisma.employeeImportRow.updateMany({
            where: {
              jobId,
              [field]: { in: values.slice(start, start + IMPORT_BATCH) },
            },
            data: {
              status: 'INVALID',
              errors: { push: `Duplicate ${field} in uploaded file.` },
            },
          });
      }
      const invalidCount = await this.prisma.employeeImportRow.count({
        where: { jobId, status: 'INVALID' },
      });
      await auditedMutation(
        this.prisma,
        actor.organizationId,
        'import.validation_changed',
        'import',
        jobId,
        (tx) =>
          tx.employeeImportJob.update({
            where: { id: jobId },
            data: {
              status: 'READY',
              totalCount: count,
              validCount: count - invalidCount,
              invalidCount,
            },
          }),
      );
      return this.get(actor.organizationId, jobId);
    } catch (error) {
      if (jobId)
        await auditedMutation(
          this.prisma,
          actor.organizationId,
          'import.validation_changed',
          'import',
          jobId,
          (tx) =>
            tx.employeeImportJob.update({
              where: { id: jobId },
              data: {
                status: 'FAILED',
                error:
                  'CSV validation failed. No accounts were provisioned; select a corrected file for a new upload.',
              },
            }),
        );
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      )
        throw error;
      throw new BadRequestException(
        'Malformed CSV or validation could not finish. No accounts were provisioned.',
      );
    } finally {
      await unlink(file.path).catch(() => undefined);
    }
  }

  async confirm(actor: TenantAuthContext, id: string) {
    const job = await this.get(actor.organizationId, id);
    if (['QUEUED', 'RUNNING', 'COMPLETED'].includes(job.status)) return job;
    if (!['READY', 'FAILED'].includes(job.status) || !job.validCount)
      throw new BadRequestException(
        'This job has no validated rows ready to import.',
      );
    await auditedMutation(
      this.prisma,
      actor.organizationId,
      'import.confirmed',
      'import',
      id,
      (tx) =>
        tx.employeeImportJob.updateMany({
          where: {
            id,
            organizationId: actor.organizationId,
            status: { in: ['READY', 'FAILED'] },
          },
          data: {
            status: 'QUEUED',
            confirmedById: actor.user.id,
            confirmedAt: new Date(),
            error: null,
            retries: 0,
          },
        }),
    );
    return this.get(actor.organizationId, id);
  }

  async tick() {
    // Validation never creates users. An interrupted upload must be corrected/re-uploaded.
    const interrupted = await this.prisma.employeeImportJob.findMany({
      where: {
        status: 'VALIDATING',
        updatedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
      },
      take: 100,
    });
    for (const stale of interrupted)
      await auditedMutation(
        this.prisma,
        stale.organizationId,
        'import.validation_interrupted',
        'import',
        stale.id,
        (tx) =>
          tx.employeeImportJob.updateMany({
            where: {
              id: stale.id,
              status: 'VALIDATING',
              updatedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
            },
            data: {
              status: 'FAILED',
              error:
                'Validation interrupted. Upload the file again with a new upload key.',
            },
          }),
        workerActor(stale),
      );
    const now = new Date();
    const job = await this.prisma.employeeImportJob.findFirst({
      where: {
        OR: [
          { status: 'QUEUED' },
          { status: 'RUNNING', leaseExpiresAt: { lt: now } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!job) return;
    const leaseToken = randomUUID();
    const claim = await auditedMutation(
      this.prisma,
      job.organizationId,
      'import.processing_started',
      'import',
      job.id,
      (tx) =>
        tx.employeeImportJob.updateMany({
          where: {
            id: job.id,
            OR: [
              { status: 'QUEUED' },
              { status: 'RUNNING', leaseExpiresAt: { lt: now } },
            ],
          },
          data: {
            status: 'RUNNING',
            leaseToken,
            leaseExpiresAt: new Date(Date.now() + 90000),
          },
        }),
      workerActor(job),
    );
    if (!claim.count) return;
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await lockReporting(tx, job.organizationId);
          const locked = await tx.$queryRaw<
            { id: string }[]
          >`SELECT id FROM "EmployeeImportJob" WHERE id=${job.id}::uuid AND "leaseToken"=${leaseToken}::uuid FOR UPDATE`;
          if (!locked.length) return;
          const actor = await tx.tenantUser.findFirst({
            where: {
              id: job.confirmedById || job.createdById,
              organizationId: job.organizationId,
              status: 'ACTIVE',
              role: TenantRole.CONFIGURATION_MANAGER,
              credentialSetupRequired: false,
            },
            include: { organization: true },
          });
          const org = actor?.organization;
          if (
            !actor ||
            !org ||
            !(org.registrationStatus === 'LEGACY_APPROVED'
              ? ['PROVISIONING', 'ACTIVE', 'TRIAL'].includes(org.status)
              : org.registrationStatus === 'APPROVED' &&
                ['ACTIVE', 'TRIAL'].includes(org.status))
          )
            throw new Error('Import authority is no longer available.');
          const rows = await tx.employeeImportRow.findMany({
            where: { jobId: job.id, status: 'VALID' },
            orderBy: { rowNumber: 'asc' },
            take: IMPORT_BATCH,
          });
          const managerIds = rows
            .map((row) => (row.payload as ImportPayload).managerEmployeeId)
            .filter(Boolean);
          const managers = await tx.tenantUser.findMany({
            where: {
              organizationId: job.organizationId,
              employeeId: { in: managerIds },
              role: TenantRole.MANAGER,
              status: 'ACTIVE',
              credentialSetupRequired: false,
            },
            select: { id: true, employeeId: true },
          });
          const managerMap = new Map(
            managers.map((row) => [row.employeeId, row.id]),
          );
          const ready: EmployeeImportRow[] = [];
          for (const row of rows) {
            const manager = (row.payload as ImportPayload).managerEmployeeId;
            if (manager && !managerMap.has(manager))
              await tx.employeeImportRow.update({
                where: { id: row.id },
                data: {
                  status: 'FAILED',
                  errors: { push: 'Manager is no longer available.' },
                },
              });
            else ready.push(row);
          }
          let createdUserIds: string[] = [];
          let createdUsers: {
            id: string;
            managerId: string | null;
          }[] = [];
          if (ready.length) {
            await tx.tenantUser.createMany({
              data: ready.map((row) => {
                const payload = row.payload as ImportPayload;
                return {
                  id: row.userId,
                  organizationId: job.organizationId,
                  employeeId: row.employeeId,
                  email: row.email,
                  firstName: payload.firstName,
                  lastName: payload.lastName,
                  department: payload.department,
                  managerId: managerMap.get(payload.managerEmployeeId) || null,
                  role: TenantRole.EXPENSE_SUBMITTER,
                  status: 'INACTIVE',
                  credentialSetupRequired: true,
                  passwordHash: '!credential-setup-required:' + randomUUID(),
                };
              }),
              skipDuplicates: true,
            });
            const created = await tx.tenantUser.findMany({
              where: {
                organizationId: job.organizationId,
                id: { in: ready.map((row) => row.userId) },
              },
              select: { id: true, managerId: true },
            });
            createdUsers = created;
            const createdIds = created.map((row) => row.id);
            createdUserIds = createdIds;
            await tx.employeeImportRow.updateMany({
              where: {
                jobId: job.id,
                id: {
                  in: ready
                    .filter((row) => createdIds.includes(row.userId))
                    .map((row) => row.id),
                },
              },
              data: { status: 'SUCCEEDED' },
            });
            await tx.employeeImportRow.updateMany({
              where: {
                jobId: job.id,
                id: {
                  in: ready
                    .filter((row) => !createdIds.includes(row.userId))
                    .map((row) => row.id),
                },
              },
              data: {
                status: 'FAILED',
                errors: {
                  push: 'Employee ID or organization email became unavailable before import.',
                },
              },
            });
          }
          const groups = await tx.employeeImportRow.groupBy({
            by: ['status'],
            where: { jobId: job.id },
            _count: { _all: true },
          });
          const counts = new Map(
            groups.map((group) => [group.status, group._count._all]),
          );
          const successfulCount = counts.get('SUCCEEDED') || 0,
            failedCount =
              (counts.get('INVALID') || 0) + (counts.get('FAILED') || 0),
            remaining = counts.get('VALID') || 0;
          await tx.employeeImportJob.update({
            where: { id: job.id },
            data: {
              successfulCount,
              failedCount,
              processedCount: successfulCount + failedCount,
              status: remaining ? 'QUEUED' : 'COMPLETED',
              completedAt: remaining ? null : new Date(),
              leaseToken: null,
              leaseExpiresAt: null,
              error: null,
            },
          });
          if (!remaining)
            await enqueueNotification(tx, {
              organizationId: job.organizationId,
              recipientUserId: job.confirmedById || job.createdById,
              eventCode: 'import.completed',
              eventKey: `import.completed:${job.id}`,
              type: 'success',
              title: 'Employee import completed',
              message: `${successfulCount} employees provisioned; ${failedCount} rows were not provisioned.`,
              sourceType: 'import',
              sourceId: job.id,
            });
          await appendAudit(
            tx,
            job.organizationId,
            remaining ? 'import.batch_processed' : 'import.completed',
            'import',
            job.id,
            {
              createdUserIds,
              createdUsers,
              successfulCount,
              failedCount,
              remaining,
              role: 'EXPENSE_SUBMITTER',
              status: 'INACTIVE',
              credentialSetupRequired: true,
            },
            workerActor(job),
          );
        },
        { timeout: 20000 },
      );
    } catch {
      await auditedMutation(
        this.prisma,
        job.organizationId,
        'import.processing_interrupted',
        'import',
        job.id,
        (tx) =>
          tx.employeeImportJob.updateMany({
            where: { id: job.id, leaseToken },
            data: {
              status: job.retries >= 4 ? 'FAILED' : 'QUEUED',
              retries: { increment: 1 },
              error:
                'Processing interrupted or authority unavailable. Completed batches are preserved; retry after resolving the problem.',
              leaseToken: null,
              leaseExpiresAt: null,
            },
          }),
        workerActor(job),
      ).catch(() => undefined);
    }
  }
}
