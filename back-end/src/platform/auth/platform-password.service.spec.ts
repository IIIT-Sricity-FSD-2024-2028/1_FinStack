import { PlatformPasswordService } from './platform-password.service';

describe('PlatformPasswordService', () => {
  const service = new PlatformPasswordService();

  it('hashes with Argon2id and verifies only the correct password', async () => {
    const hash = await service.hash('correct horse battery staple');

    expect(hash).toContain('$argon2id$');
    await expect(
      service.verify(hash, 'correct horse battery staple'),
    ).resolves.toBe(true);
    await expect(service.verify(hash, 'incorrect')).resolves.toBe(false);
  });

  it('performs a safe dummy verification for an unknown account', async () => {
    await expect(service.verifyOrDummy(null, 'unknown')).resolves.toBe(false);
  });
});
