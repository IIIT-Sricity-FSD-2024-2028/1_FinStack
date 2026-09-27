import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PlatformTokenService } from './platform-token.service';

describe('PlatformTokenService', () => {
  const config = new ConfigService({
    PLATFORM_JWT_ACCESS_SECRET:
      'test-secret-with-more-than-thirty-two-characters',
    PLATFORM_JWT_ISSUER: 'test-issuer',
    PLATFORM_JWT_AUDIENCE: 'test-audience',
    PLATFORM_JWT_ACCESS_TTL_SECONDS: '600',
  });
  const service = new PlatformTokenService(new JwtService(), config);

  it('issues the approved minimal access claims', async () => {
    const token = await service.signAccessToken('staff-id', 'session-id');
    const claims = await service.verifyAccessToken(token);

    expect(claims).toMatchObject({
      sub: 'staff-id',
      sid: 'session-id',
      type: 'access',
      iss: 'test-issuer',
      aud: 'test-audience',
    });
    expect(claims).not.toHaveProperty('roles');
    expect(claims).not.toHaveProperty('permissions');
  });

  it('rejects a token issued for a different audience', async () => {
    const otherService = new PlatformTokenService(
      new JwtService(),
      new ConfigService({
        PLATFORM_JWT_ACCESS_SECRET:
          'test-secret-with-more-than-thirty-two-characters',
        PLATFORM_JWT_ISSUER: 'test-issuer',
        PLATFORM_JWT_AUDIENCE: 'other-audience',
      }),
    );
    const token = await otherService.signAccessToken('staff-id', 'session-id');

    await expect(service.verifyAccessToken(token)).rejects.toBeDefined();
  });

  it('rejects wrong signatures, issuers, token types, and expiry', async () => {
    const jwt = new JwtService();
    const baseOptions = {
      algorithm: 'HS256' as const,
      secret: 'test-secret-with-more-than-thirty-two-characters',
      issuer: 'test-issuer',
      audience: 'test-audience',
    };
    const wrongIssuer = jwt.sign(
      { sub: 'staff-id', sid: 'session-id', type: 'access' },
      { ...baseOptions, issuer: 'wrong-issuer', expiresIn: 600 },
    );
    const wrongType = jwt.sign(
      { sub: 'staff-id', sid: 'session-id', type: 'refresh' },
      { ...baseOptions, expiresIn: 600 },
    );
    const expired = jwt.sign(
      { sub: 'staff-id', sid: 'session-id', type: 'access' },
      { ...baseOptions, expiresIn: -1 },
    );
    const valid = await service.signAccessToken('staff-id', 'session-id');

    await expect(
      service.verifyAccessToken(`${valid}tampered`),
    ).rejects.toBeDefined();
    await expect(service.verifyAccessToken(wrongIssuer)).rejects.toBeDefined();
    await expect(service.verifyAccessToken(wrongType)).rejects.toBeDefined();
    await expect(service.verifyAccessToken(expired)).rejects.toBeDefined();
  });
});
