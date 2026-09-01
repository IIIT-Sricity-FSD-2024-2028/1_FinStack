import { PlatformPermissionsService } from './platform-permissions.service';

describe('PlatformPermissionsService', () => {
  it('returns a safe, searchable permission catalog in stable key order', async () => {
    let findManyArgs: unknown;
    const permissions = [
      {
        id: 'e2bef0e6-3eef-472f-a8e9-57fc8fb45004',
        key: 'platform.role.view',
        description: 'View platform roles and permissions',
      },
    ];
    const service = new PlatformPermissionsService({
      permission: {
        findMany: jest.fn((args: unknown) => {
          findManyArgs = args;
          return Promise.resolve(permissions);
        }),
      },
    } as never);

    await expect(service.findAll({ search: 'role' })).resolves.toEqual(
      permissions,
    );
    expect(findManyArgs).toMatchObject({
      orderBy: [{ key: 'asc' }, { id: 'asc' }],
    });
    expect(
      (findManyArgs as { select: Record<string, boolean> }).select,
    ).toEqual({ id: true, key: true, description: true });
  });
});
