import { Prisma } from '@prisma/client';

// All tenant reporting writers (manual creation, reassignment, status and imports)
// serialize on the canonical organization row. ReadCommitted then sees the last
// committed chain after acquiring the lock, including concurrent opposite moves.
export async function lockReporting(
  tx: Prisma.TransactionClient,
  organizationId: string,
) {
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${organizationId}::uuid FOR UPDATE`;
}
