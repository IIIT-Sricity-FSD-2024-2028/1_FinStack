import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PlatformStaffStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PlatformPermissionResolverService } from '../rbac/platform-permission-resolver.service';
import {
  PlatformAuthContext,
  PlatformAuthResponse,
  PlatformAccessTokenClaims,
  PlatformRefreshContext,
  PlatformStaffIdentity,
} from './auth.types';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { PlatformPasswordService } from './platform-password.service';
import { PlatformSessionService } from './platform-session.service';
import { PlatformTokenService } from './platform-token.service';

@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PlatformPasswordService,
    private readonly sessions: PlatformSessionService,
    private readonly tokens: PlatformTokenService,
    private readonly permissions: PlatformPermissionResolverService,
  ) {}

  async login(dto: PlatformLoginDto): Promise<{
    response: PlatformAuthResponse;
    refreshToken: string;
  }> {
    const staff = await this.prisma.platformStaff.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    const passwordValid = await this.passwords.verifyOrDummy(
      staff?.passwordHash ?? null,
      dto.password,
    );

    if (staff && passwordValid && staff.status !== PlatformStaffStatus.ACTIVE) {
      await this.sessions.revokeAllForStaff(staff.id);
    }

    if (
      !staff ||
      !passwordValid ||
      staff.status !== PlatformStaffStatus.ACTIVE
    ) {
      throw this.invalidCredentials();
    }

    const refreshToken = this.sessions.generateToken();
    const [, session] = await this.prisma.$transaction([
      this.prisma.platformStaff.update({
        where: { id: staff.id },
        data: { lastLoginAt: new Date() },
      }),
      this.prisma.platformAuthSession.create({
        data: this.sessions.createData(staff.id, refreshToken),
      }),
    ]);

    return {
      response: await this.buildResponse(this.toIdentity(staff), session.id),
      refreshToken,
    };
  }

  async refresh(context: PlatformRefreshContext): Promise<{
    response: PlatformAuthResponse;
    refreshToken: string;
  }> {
    const refreshToken = await this.sessions.rotate(context);
    return {
      response: await this.buildResponse(context.staff, context.sessionId),
      refreshToken,
    };
  }

  logout(sessionId: string): Promise<void> {
    return this.sessions.revoke(sessionId);
  }

  async authenticateAccessToken(token: string): Promise<PlatformAuthContext> {
    let claims: PlatformAccessTokenClaims;
    try {
      claims = await this.tokens.verifyAccessToken(token);
    } catch {
      throw this.invalidAccessToken();
    }

    const session = await this.prisma.platformAuthSession.findUnique({
      where: { id: claims.sid },
      include: { staff: true },
    });
    if (
      !session ||
      session.staffId !== claims.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      throw this.invalidAccessToken();
    }
    if (session.staff.status !== PlatformStaffStatus.ACTIVE) {
      await this.sessions.revokeAllForStaff(session.staffId);
      throw this.invalidAccessToken();
    }

    return this.permissions.resolve(this.toIdentity(session.staff), session.id);
  }

  private async buildResponse(
    staff: PlatformStaffIdentity,
    sessionId: string,
  ): Promise<PlatformAuthResponse> {
    const context = await this.permissions.resolve(staff, sessionId);
    return {
      ...context,
      accessToken: await this.tokens.signAccessToken(staff.id, sessionId),
      expiresIn: this.tokens.accessTokenTtlSeconds,
    };
  }

  private toIdentity(staff: PlatformStaffIdentity): PlatformStaffIdentity {
    return {
      id: staff.id,
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.email,
      status: staff.status,
    };
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    });
  }

  private invalidAccessToken(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'INVALID_ACCESS_TOKEN',
      message: 'The platform access token is invalid or has expired.',
    });
  }
}
