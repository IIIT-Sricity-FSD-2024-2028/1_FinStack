import { TenantRole, TenantUserStatus } from '@prisma/client';
import { Request } from 'express';

export interface TenantUserIdentity {
  id: string;
  organizationId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: TenantRole;
  status: TenantUserStatus;
}

export interface TenantAuthContext {
  user: TenantUserIdentity;
  organizationId: string;
}

export interface TenantRequest extends Request {
  tenantAuth?: TenantAuthContext;
}

export interface TenantAccessTokenClaims {
  sub: string;
  orgId: string;
  type: 'tenant-access';
  iss?: string;
  aud?: string | string[];
  iat?: number;
  exp?: number;
}

export interface TenantAuthResponse {
  accessToken: string;
  expiresIn: number;
  user: TenantUserIdentity;
  organizationId: string;
}
