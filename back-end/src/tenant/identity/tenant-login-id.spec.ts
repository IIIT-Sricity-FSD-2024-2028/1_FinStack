import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  createWithGeneratedLoginId,
  generateTenantLoginId,
  employeeLoginWhere,
  isGeneratedLoginIdCollision,
  retryCanonicalAllocation,
} from './tenant-login-id';

const organization = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Acme Research',
};
function collision(target: string | string[], modelName = 'TenantUser') {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint', {
    code: 'P2002',
    clientVersion: '6.19.1',
    meta: { target, modelName },
  });
}
describe('server-generated tenant login IDs', () => {
  it('creates private insertion markers; PostgreSQL assigns the canonical ID', () => {
    for (let i = 0; i < 100; i++)
      expect(generateTenantLoginId(organization)).toMatch(
        /^__allocate__:[a-f0-9-]{36}$/,
      );
    expect(() =>
      generateTenantLoginId({ ...organization, id: 'untrusted-name' }),
    ).toThrow('stored organization UUID');
  });
  it('looks up both canonical and legacy aliases without accepting client tenant context', () => {
    expect(employeeLoginWhere('FIC-1029')).toEqual({
      OR: [{ canonicalEmployeeId: 'FIC-1029' }, { employeeId: 'FIC-1029' }],
    });
    expect(employeeLoginWhere('OLD-LONG')).toEqual({
      OR: [{ canonicalEmployeeId: 'OLD-LONG' }, { employeeId: 'OLD-LONG' }],
    });
  });
  it('allocates independent IDs across concurrent creation requests', async () => {
    const allocated = new Set<string>();
    const create = jest.fn((id: string) => {
      if (allocated.has(id)) throw collision(['canonicalEmployeeId']);
      allocated.add(id);
      return Promise.resolve(id);
    });
    const ids = await Promise.all(
      Array.from({ length: 200 }, () =>
        createWithGeneratedLoginId(organization, create),
      ),
    );
    expect(new Set(ids).size).toBe(200);
    expect(create.mock.calls.length).toBeGreaterThanOrEqual(200);
  });
  it('retries only a recognized global TenantUser employeeId unique violation', async () => {
    const create = jest
      .fn((id: string) => Promise.resolve(id))
      .mockRejectedValueOnce(collision(['employeeId']))
      .mockRejectedValueOnce(collision('TenantUser_employeeId_key'))
      .mockRejectedValueOnce(collision(['canonicalEmployeeId']));
    const id = await createWithGeneratedLoginId(organization, create);
    expect(create).toHaveBeenCalledTimes(4);
    expect(id).toBe(create.mock.calls[3][0]);
    expect(id).toMatch(/^__allocate__:[a-f0-9-]{36}$/);
  });
  it.each([
    collision(['organizationId', 'email']),
    collision(['id']),
    collision(['slug'], 'Organization'),
    collision(['employeeId'], 'UnrelatedModel'),
    collision('unknown'),
    new Error('unavailable'),
  ])(
    'does not retry other uniqueness failures or infrastructure errors: %s',
    async (error) => {
      expect(isGeneratedLoginIdCollision(error)).toBe(false);
      const create = jest.fn().mockRejectedValue(error);
      await expect(
        createWithGeneratedLoginId(organization, create),
      ).rejects.toBe(error);
      expect(create).toHaveBeenCalledTimes(1);
    },
  );
  it('bounds collisions without leaking constraint details', async () => {
    const create = jest.fn().mockRejectedValue(collision(['employeeId']));
    const attempt = createWithGeneratedLoginId(organization, create);
    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toThrow(
      'A login ID could not be allocated. Try again later.',
    );
    expect(create).toHaveBeenCalledTimes(5);
  });
  it('retries code allocation collisions for legacy provisioning without changing its primary ID', async () => {
    const create = jest
      .fn()
      .mockRejectedValueOnce(collision(['canonicalEmployeeId']))
      .mockResolvedValue({
        employeeId: 'LEGACY-ID',
        canonicalEmployeeId: 'FIC-1029',
      });
    await expect(retryCanonicalAllocation(create)).resolves.toEqual({
      employeeId: 'LEGACY-ID',
      canonicalEmployeeId: 'FIC-1029',
    });
    expect(create).toHaveBeenCalledTimes(2);
  });
  it('does not retry a duplicate legacy login when allocating a code', async () => {
    const error = collision(['employeeId']);
    const create = jest.fn().mockRejectedValue(error);
    await expect(retryCanonicalAllocation(create)).rejects.toBe(error);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it('reports finite-range exhaustion as a domain conflict without retrying or wrapping', async () => {
    const databaseError = new Prisma.PrismaClientUnknownRequestError(
      'ERROR: Employee ID range exhausted for this organization (1001-9999).',
      { clientVersion: '6.19.1' },
    );
    const create = jest.fn().mockRejectedValue(databaseError);
    try {
      await createWithGeneratedLoginId(organization, create);
      throw new Error('Expected capacity refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'EMPLOYEE_ID_RANGE_EXHAUSTED',
      });
    }
    expect(create).toHaveBeenCalledTimes(1);
  });
});
