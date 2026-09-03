import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TenantTokenService } from './tenant-token.service';

describe('TenantTokenService', () => {
  const service = new TenantTokenService(
    new JwtService(),
    new ConfigService({
      TENANT_JWT_ACCESS_SECRET:
        'test-secret-with-more-than-thirty-two-characters',
      TENANT_JWT_ISSUER: 'test-issuer',
      TENANT_JWT_AUDIENCE: 'test-audience',
      TENANT_JWT_ACCESS_TTL_SECONDS: '28800',
    }),
  );

  it('issues tenant access tokens with an eight-hour lifetime', async () => {
    const token = await service.sign({ id: 'tenant-user-id', organizationId: 'org-id' });
    const claims = await service.verify(token);

    expect(claims).toMatchObject({
      sub: 'tenant-user-id',
      orgId: 'org-id',
      type: 'tenant-access',
      iss: 'test-issuer',
      aud: 'test-audience',
    });
    expect(claims.exp).toBeDefined();
    expect(claims.iat).toBeDefined();
    expect(claims.exp! - claims.iat!).toBe(28800);
  });

  it('rejects expired tenant access tokens', async () => {
    const jwt = new JwtService();
    const expired = jwt.sign(
      { sub: 'tenant-user-id', orgId: 'org-id', type: 'tenant-access' },
      {
        algorithm: 'HS256',
        secret: 'test-secret-with-more-than-thirty-two-characters',
        issuer: 'test-issuer',
        audience: 'test-audience',
        expiresIn: -1,
      },
    );

    await expect(service.verify(expired)).rejects.toBeDefined();
  });
});
