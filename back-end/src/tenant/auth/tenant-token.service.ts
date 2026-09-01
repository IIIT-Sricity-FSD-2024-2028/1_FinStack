import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TenantAccessTokenClaims } from './tenant-auth.types';

@Injectable()
export class TenantTokenService {
  private readonly secret: string;
  private readonly issuer: string;
  private readonly audience: string;
  readonly accessTokenTtlSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.secret = config.get<string>('TENANT_JWT_ACCESS_SECRET', '');
    this.issuer = config.get<string>('TENANT_JWT_ISSUER', 'finstack-api');
    this.audience = config.get<string>(
      'TENANT_JWT_AUDIENCE',
      'finstack-client',
    );
    this.accessTokenTtlSeconds = Number(
      config.get<string>('TENANT_JWT_ACCESS_TTL_SECONDS', '900'),
    );
    if (this.secret.length < 32)
      throw new Error(
        'TENANT_JWT_ACCESS_SECRET must contain at least 32 characters.',
      );
    if (!this.issuer || !this.audience)
      throw new Error('Tenant JWT issuer and audience must be configured.');
    if (
      !Number.isSafeInteger(this.accessTokenTtlSeconds) ||
      this.accessTokenTtlSeconds < 1
    )
      throw new Error(
        'TENANT_JWT_ACCESS_TTL_SECONDS must be a positive integer.',
      );
  }

  sign(user: { id: string; organizationId: string }): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, orgId: user.organizationId, type: 'tenant-access' },
      {
        algorithm: 'HS256',
        secret: this.secret,
        issuer: this.issuer,
        audience: this.audience,
        expiresIn: this.accessTokenTtlSeconds,
      },
    );
  }

  verify(token: string): Promise<TenantAccessTokenClaims> {
    return this.jwt.verifyAsync<TenantAccessTokenClaims>(token, {
      algorithms: ['HS256'],
      secret: this.secret,
      issuer: this.issuer,
      audience: this.audience,
    });
  }
}
