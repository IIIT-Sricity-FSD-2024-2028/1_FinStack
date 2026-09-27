import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DEFAULT_ACCESS_TOKEN_TTL_SECONDS } from './auth.constants';
import { PlatformAccessTokenClaims } from './auth.types';

@Injectable()
export class PlatformTokenService {
  readonly accessTokenTtlSeconds: number;
  private readonly secret: string;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    this.secret = config.get<string>('PLATFORM_JWT_ACCESS_SECRET', '');
    this.issuer = config.get<string>('PLATFORM_JWT_ISSUER', 'finstack-api');
    this.audience = config.get<string>(
      'PLATFORM_JWT_AUDIENCE',
      'finstack-admin',
    );
    this.accessTokenTtlSeconds = Number(
      config.get<string>(
        'PLATFORM_JWT_ACCESS_TTL_SECONDS',
        String(DEFAULT_ACCESS_TOKEN_TTL_SECONDS),
      ),
    );

    if (this.secret.length < 32) {
      throw new Error(
        'PLATFORM_JWT_ACCESS_SECRET must contain at least 32 characters.',
      );
    }
    if (!this.issuer || !this.audience) {
      throw new Error('Platform JWT issuer and audience must be configured.');
    }
    if (
      !Number.isSafeInteger(this.accessTokenTtlSeconds) ||
      this.accessTokenTtlSeconds < 1
    ) {
      throw new Error(
        'PLATFORM_JWT_ACCESS_TTL_SECONDS must be a positive integer.',
      );
    }
  }

  signAccessToken(staffId: string, sessionId: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: staffId, sid: sessionId, type: 'access' },
      {
        algorithm: 'HS256',
        secret: this.secret,
        issuer: this.issuer,
        audience: this.audience,
        expiresIn: this.accessTokenTtlSeconds,
      },
    );
  }

  async verifyAccessToken(token: string): Promise<PlatformAccessTokenClaims> {
    const claims = await this.jwtService.verifyAsync<PlatformAccessTokenClaims>(
      token,
      {
        algorithms: ['HS256'],
        secret: this.secret,
        issuer: this.issuer,
        audience: this.audience,
      },
    );

    if (!claims.sub || !claims.sid || claims.type !== 'access') {
      throw new Error('Invalid platform access token claims.');
    }
    return claims;
  }
}
