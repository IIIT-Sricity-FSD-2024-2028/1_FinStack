import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

export interface LoginIdOrganization {
  id: string;
  name: string;
}

// Internal insert marker only. PostgreSQL atomically replaces this with the
// persisted organization-prefixed Employee ID before inserting a new user.
// Existing employeeId relationship keys are never rewritten.
export function generateTenantLoginId(
  organization: LoginIdOrganization,
): string {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(organization.id))
    throw new Error(
      'A stored organization UUID is required for login ID generation.',
    );
  return '__allocate__:' + randomUUID();
}

export const employeeLoginWhere = (login: string) => ({
  OR: [{ canonicalEmployeeId: login }, { employeeId: login }],
});

// PostgreSQL deliberately refuses wraparound; expose a domain conflict instead of a 500.
function assertEmployeeIdCapacity(error: unknown): void {
  if (
    (error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError) &&
    error.message.includes('Employee ID range exhausted for this organization')
  ) {
    throw new ConflictException({
      code: 'EMPLOYEE_ID_RANGE_EXHAUSTED',
      message:
        'This organization has used its available Employee IDs (1001-9999). Contact support before adding employees.',
    });
  }
}

export function isGeneratedLoginIdCollision(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  )
    return false;
  if (error.meta?.modelName && error.meta.modelName !== 'TenantUser')
    return false;
  const target = error.meta?.target;
  return Array.isArray(target)
    ? target.length === 1 &&
        typeof target[0] === 'string' &&
        ['employeeId', 'canonicalEmployeeId'].includes(target[0])
    : [
        'TenantUser_employeeId_key',
        'TenantUser_canonicalEmployeeId_key',
      ].includes(String(target));
}

// Each attempt must open its OWN transaction. A PostgreSQL unique violation
// aborts the failing transaction; retrying inside it would be unsafe.
export async function createWithGeneratedLoginId<T>(
  organization: LoginIdOrganization,
  create: (employeeId: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await create(generateTenantLoginId(organization));
    } catch (error) {
      assertEmployeeIdCapacity(error);
      if (!isGeneratedLoginIdCollision(error)) throw error;
    }
  }
  throw new ConflictException({
    code: 'TENANT_LOGIN_ID_UNAVAILABLE',
    message: 'A login ID could not be allocated. Try again later.',
  });
}

// Legacy import identifiers stay hidden aliases. Retry only a recognized
// canonical identity conflict, never duplicate legacy IDs or emails.
export async function retryCanonicalAllocation<T>(
  create: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await create();
    } catch (error) {
      assertEmployeeIdCapacity(error);
      const target =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.meta?.target
          : undefined;
      const codeCollision =
        isGeneratedLoginIdCollision(error) &&
        (Array.isArray(target)
          ? target.length === 1 && target[0] === 'canonicalEmployeeId'
          : target === 'TenantUser_canonicalEmployeeId_key');
      if (!codeCollision || attempt === 4) throw error;
    }
  }
  throw new ConflictException(
    'Employee code could not be allocated. Retry the request.',
  );
}
