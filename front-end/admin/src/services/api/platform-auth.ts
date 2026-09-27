import type { PlatformAuthPayload, PlatformAuthState } from '../../types/auth';
import { apiRequest } from './client';

export interface PlatformLoginInput {
  email: string;
  password: string;
}

export function loginPlatform(input: PlatformLoginInput) {
  return apiRequest<PlatformAuthPayload>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify(input) },
    { skipAuthentication: true, skipRefresh: true },
  );
}

export function refreshPlatformSession() {
  return apiRequest<PlatformAuthPayload>(
    '/auth/refresh',
    { method: 'POST' },
    { skipAuthentication: true, skipRefresh: true },
  );
}

export function logoutPlatform() {
  return apiRequest<void>(
    '/auth/logout',
    { method: 'POST' },
    { skipAuthentication: true, skipRefresh: true },
  );
}

export function getCurrentPlatformAuth() {
  return apiRequest<PlatformAuthState>('/auth/me');
}
