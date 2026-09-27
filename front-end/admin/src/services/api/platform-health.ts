import { apiRequest } from './client';

export interface PlatformHealth {
  status: 'healthy' | 'degraded';
  api: {
    status: 'available';
  };
  database: {
    status: 'available' | 'unavailable';
    checkedAt: string;
  };
  checkedAt: string;
}

export function getPlatformHealth(signal?: AbortSignal) {
  return apiRequest<PlatformHealth>('/health', { signal });
}
