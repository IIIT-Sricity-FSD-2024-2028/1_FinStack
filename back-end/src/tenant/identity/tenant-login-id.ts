import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';

export interface LoginIdOrganization {
  id: string;
  name: string;
}

// The full server-owned UUID is the stable organization code, not an authority
// inferred from a user-supplied name, slug or prefix. Existing IDs are immutable.
export function generateTenantLoginId(
  organization: LoginIdOrganization,
): string {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(organization.id))
    throw new Error(
      'A stored organization UUID is required for login ID generation.',
    );
  const hint =
    organization.name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 3) || 'ORG';
  return `${hint}-${organization.id.replaceAll('-', '').toUpperCase()}-${randomBytes(10).toString('hex').toUpperCase()}`;
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
    ? target.length === 1 && target[0] === 'employeeId'
    : target === 'TenantUser_employeeId_key';
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
      if (!isGeneratedLoginIdCollision(error)) throw error;
    }
  }
  throw new ConflictException({
    code: 'TENANT_LOGIN_ID_UNAVAILABLE',
    message: 'A login ID could not be allocated. Try again later.',
  });
}
