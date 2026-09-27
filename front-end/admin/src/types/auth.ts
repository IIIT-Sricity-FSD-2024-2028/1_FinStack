export type PlatformStaffStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

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

export interface PlatformAuthState {
  sessionId: string;
  staff: PlatformStaffIdentity;
  roles: PlatformRoleIdentity[];
  permissions: string[];
}

export interface PlatformAuthPayload extends PlatformAuthState {
  accessToken: string;
  expiresIn: number;
}
