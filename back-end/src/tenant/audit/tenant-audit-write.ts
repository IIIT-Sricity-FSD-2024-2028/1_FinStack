import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { auditContext, AuditActor } from './tenant-audit-context';
// Deliberately allowlisted. Never serialize DTOs, requests, tokens, hashes or import payloads.
const fields: Record<string, string[]> = {
  employee: [
    'role',
    'status',
    'department',
    'managerId',
    'credentialSetupRequired',
  ],
  category: [
    'name',
    'limit',
    'currency',
    'status',
    'requiresReceipt',
    'templateKey',
  ],
  policy: [
    'name',
    'categoryId',
    'maxAmount',
    'currency',
    'status',
    'requiresApproval',
    'receiptRequired',
    'approval',
    'templateKey',
  ],
  import: [
    'status',
    'totalCount',
    'validCount',
    'invalidCount',
    'processedCount',
    'successfulCount',
    'failedCount',
    'retries',
  ],
};
export function auditSnapshot(
  type: string,
  value: unknown,
): Prisma.InputJsonObject | null {
  if (!value) return null;
  const row = value as Record<string, unknown>;
  return Object.fromEntries(
    (fields[type] || []).map((key) => [
      key,
      row[key] == null
        ? null
        : (JSON.parse(JSON.stringify(row[key])) as Prisma.InputJsonValue),
    ]),
  );
}
export async function appendAudit(
  tx: Prisma.TransactionClient,
  organizationId: string,
  eventCode: string,
  targetType: string,
  targetId: string,
  changes: Prisma.InputJsonObject,
  explicit?: AuditActor,
  outcome = 'SUCCESS',
) {
  const actor = explicit || auditContext.getStore();
  if (!actor || actor.organizationId !== organizationId)
    throw new Error('Authoritative tenant audit actor is required.');
  if (Buffer.byteLength(JSON.stringify(changes)) > 65536)
    throw new Error('Audit change summary exceeds limit.');
  const { organizationId: ignored, ...snapshot } = actor;
  void ignored;
  return tx.tenantAuditLog.create({
    data: {
      organizationId,
      ...snapshot,
      eventCode,
      targetType,
      targetId,
      changes,
      outcome,
      occurredAt: new Date(),
    },
  });
}
export async function auditedMutation<T>(
  prisma: PrismaService,
  organizationId: string,
  eventCode: string | ((before: unknown, after: unknown) => string),
  type: 'employee' | 'category' | 'policy' | 'import',
  id: string | null,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  explicit?: AuditActor,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // Same per-tenant lock used by reporting writes. Before/after cannot race with other audited configuration writers.
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${organizationId}::uuid FOR UPDATE`;
    const read = async (key: string | null): Promise<unknown> =>
      !key
        ? null
        : type === 'employee'
          ? tx.tenantUser.findFirst({
              where: { id: key, organizationId },
              select: {
                role: true,
                status: true,
                department: true,
                managerId: true,
                credentialSetupRequired: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            })
          : type === 'category'
            ? tx.expenseCategory.findFirst({
                where: { id: key, organizationId },
              })
            : type === 'policy'
              ? tx.expensePolicy.findFirst({
                  where: { id: key, organizationId },
                })
              : tx.employeeImportJob.findFirst({
                  where: { id: key, organizationId },
                });
    const beforeRow = await read(id);
    const before = auditSnapshot(type, beforeRow);
    const result = await work(tx);
    const targetId = id || (result as { id: string }).id;
    const afterRow = await read(targetId);
    const after = auditSnapshot(type, afterRow);
    const allowed = [
      ...fields[type],
      ...(type === 'employee'
        ? ['firstName', 'lastName', 'email']
        : type === 'category'
          ? ['description', 'color']
          : type === 'policy'
            ? ['description']
            : []),
    ];
    const changedFields = allowed.filter(
      (key) =>
        JSON.stringify(
          (beforeRow as Record<string, unknown> | null)?.[key] ?? null,
        ) !==
        JSON.stringify(
          (afterRow as Record<string, unknown> | null)?.[key] ?? null,
        ),
    );
    const changes: Prisma.InputJsonObject = { before, after, changedFields };
    if (changedFields.length) {
      const resolvedEventCode =
        typeof eventCode === 'function'
          ? eventCode(beforeRow, afterRow)
          : eventCode;
      await appendAudit(
        tx,
        organizationId,
        resolvedEventCode,
        type,
        targetId,
        changes,
        explicit,
        type === 'import' &&
          (after?.status === 'FAILED' ||
            resolvedEventCode.endsWith('_interrupted'))
          ? 'FAILED'
          : 'SUCCESS',
      );
    }
    return result;
  });
}
