import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  createWithGeneratedLoginId,
  generateTenantLoginId,
  isGeneratedLoginIdCollision,
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
  it('uses a stable full tenant UUID, readable hint and 80 random bits within the legacy limit', () => {
    const id = generateTenantLoginId(organization);
    expect(id).toMatch(/^ACM-10000000000040008000000000000001-[A-F0-9]{20}$/);
    expect(id.length).toBeLessThanOrEqual(80);
    expect(
      generateTenantLoginId({ ...organization, name: '\u00c5cme' }),
    ).toMatch(/^ACM-/);
    expect(
      generateTenantLoginId({
        ...organization,
        name: '\u00c5cme updated',
      }).split('-')[1],
    ).toBe(id.split('-')[1]);
    expect(
      generateTenantLoginId({ ...organization, name: '\u7814\u53d1' }),
    ).toMatch(/^ORG-/);
    expect(() =>
      generateTenantLoginId({ ...organization, id: 'untrusted-name' }),
    ).toThrow('stored organization UUID');
  });
  it('distinguishes tenants even with the same name hint', () => {
    const first = generateTenantLoginId(organization);
    const second = generateTenantLoginId({
      ...organization,
      id: '20000000-0000-4000-8000-000000000001',
    });
    expect(first.split('-')[0]).toBe(second.split('-')[0]);
    expect(first.split('-')[1]).not.toBe(second.split('-')[1]);
  });
  it('allocates independent IDs across concurrent creation requests', async () => {
    const create = jest.fn((id: string) => Promise.resolve(id));
    const ids = await Promise.all(
      Array.from({ length: 200 }, () =>
        createWithGeneratedLoginId(organization, create),
      ),
    );
    expect(new Set(ids).size).toBe(200);
    expect(create).toHaveBeenCalledTimes(200);
  });
  it('retries only a recognized global TenantUser employeeId unique violation', async () => {
    const create = jest
      .fn((id: string) => Promise.resolve(id))
      .mockRejectedValueOnce(collision(['employeeId']))
      .mockRejectedValueOnce(collision('TenantUser_employeeId_key'));
    const id = await createWithGeneratedLoginId(organization, create);
    expect(create).toHaveBeenCalledTimes(3);
    expect(id).toBe(create.mock.calls[2][0]);
    expect(new Set(create.mock.calls.map(([value]) => value)).size).toBe(3);
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
});
