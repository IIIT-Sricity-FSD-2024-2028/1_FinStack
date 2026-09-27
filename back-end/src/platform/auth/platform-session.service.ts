import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformStaffStatus, Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { DEFAULT_REFRESH_TOKEN_TTL_DAYS } from './auth.constants';
import { PlatformRefreshContext } from './auth.types';

@Injectable()
export class PlatformSessionService {
  readonly refreshTokenTtlDays: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.refreshTokenTtlDays = Number(
      config.get<string>(
        'PLATFORM_REFRESH_TOKEN_TTL_DAYS',
        String(DEFAULT_REFRESH_TOKEN_TTL_DAYS),
      ),
    );
    if (
      !Number.isSafeInteger(this.refreshTokenTtlDays) ||
      this.refreshTokenTtlDays < 1
    ) {
      throw new Error(
        'PLATFORM_REFRESH_TOKEN_TTL_DAYS must be a positive integer.',
      );
    }
  }

  generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  expiresAt(): Date {
    return new Date(Date.now() + this.refreshTokenTtlDays * 86_400_000);
  }

  createData(
    staffId: string,
    token: string,
  ): Prisma.PlatformAuthSessionCreateInput {
    return {
      staff: { connect: { id: staffId } },
      refreshTokenHash: this.hashToken(token),
      expiresAt: this.expiresAt(),
    };
  }

  async authenticate(token: string): Promise<PlatformRefreshContext> {
    const session = await this.prisma.platformAuthSession.findUnique({
      where: { refreshTokenHash: this.hashToken(token) },
      include: { staff: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw this.invalidSession();
    }
    if (session.staff.status !== PlatformStaffStatus.ACTIVE) {
      await this.revokeAllForStaff(session.staffId);
      throw this.invalidSession();
    }

    return {
      sessionId: session.id,
      refreshToken: token,
      staff: {
        id: session.staff.id,
        firstName: session.staff.firstName,
        lastName: session.staff.lastName,
        email: session.staff.email,
        status: session.staff.status,
      },
    };
  }

  async rotate(context: PlatformRefreshContext): Promise<string> {
    const nextToken = this.generateToken();
    const result = await this.prisma.platformAuthSession.updateMany({
      where: {
        id: context.sessionId,
        refreshTokenHash: this.hashToken(context.refreshToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        refreshTokenHash: this.hashToken(nextToken),
        lastUsedAt: new Date(),
        expiresAt: this.expiresAt(),
      },
    });
    if (result.count !== 1) {
      throw this.invalidSession();
    }
    return nextToken;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.platformAuthSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForStaff(
    staffId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = transaction ?? this.prisma;
    await client.platformAuthSession.updateMany({
      where: { staffId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private invalidSession(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'INVALID_REFRESH_SESSION',
      message: 'The platform session is invalid or has expired.',
    });
  }
}
