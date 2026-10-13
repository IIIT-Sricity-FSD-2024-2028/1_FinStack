import { TenantRole, TenantUserStatus } from '@prisma/client';
import { Request } from 'express';
import { TenantWorkspace } from './tenant-workspace';

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
  effectiveRoles?: TenantRole[];
  workspace?: TenantWorkspace;
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
  cv?: number;
  iss?: string;
  aud?: string | string[];
  iat?: number;
  exp?: number;
}

export interface TenantAuthResponse {
  effectiveRoles: TenantRole[];
  workspace: TenantWorkspace;
  accessToken: string;
  expiresIn: number;
  user: TenantUserIdentity;
  organizationId: string;
}
