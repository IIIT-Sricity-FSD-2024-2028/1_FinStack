import { DatabaseHealthService } from './database-health.service';
import { PrismaService } from './prisma.service';

describe('DatabaseHealthService', () => {
  it('reports an available database after a successful probe', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as PrismaService;
    const service = new DatabaseHealthService(prisma);

    await expect(service.check()).resolves.toMatchObject({
      status: 'available',
    });
  });

  it('reports an unavailable database without leaking the connection error', async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockRejectedValue(new Error('secret connection detail')),
    } as unknown as PrismaService;
    const service = new DatabaseHealthService(prisma);

    const result = await service.check();

    expect(result.status).toBe('unavailable');
    expect(result).not.toHaveProperty('error');
  });
});
