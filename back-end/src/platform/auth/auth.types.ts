import { PlatformStaffStatus } from '@prisma/client';
import { Request } from 'express';

export interface PlatformStaffIdentity {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: PlatformStaffStatus;
}

export interface PlatformRoleIdentity {
  id: string;
  key: string;
  name: string;
}

export interface PlatformAuthContext {
  sessionId: string;
  staff: PlatformStaffIdentity;
  roles: PlatformRoleIdentity[];
  permissions: string[];
}

export interface PlatformRefreshContext {
  sessionId: string;
  refreshToken: string;
  staff: PlatformStaffIdentity;
}

export interface PlatformRequest extends Request {
  platformAuth?: PlatformAuthContext;
  platformRefreshAuth?: PlatformRefreshContext;
}

export interface PlatformAccessTokenClaims {
  sub: string;
  sid: string;
  type: 'access';
  iss?: string;
  aud?: string | string[];
  iat?: number;
  exp?: number;
}

export interface PlatformAuthResponse extends PlatformAuthContext {
  accessToken: string;
  expiresIn: number;
}
