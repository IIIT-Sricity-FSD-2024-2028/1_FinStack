import type { ApiResponse } from '../../types/api';
import { getAccessToken } from '../auth/session';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || '/api/v1/platform';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiRequestOptions {
  skipAuthentication?: boolean;
  skipRefresh?: boolean;
}

interface AuthRecovery {
  refresh: () => Promise<string>;
  failed: () => void;
}

let authRecovery: AuthRecovery | null = null;
let refreshPromise: Promise<string> | null = null;

export function configureAuthRecovery(recovery: AuthRecovery | null): void {
  authRecovery = recovery;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  requestOptions: ApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getAccessToken();
  if (token && !requestOptions.skipAuthentication) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });
  if (
    response.status === 401 &&
    !requestOptions.skipRefresh &&
    authRecovery
  ) {
    try {
      refreshPromise ??= authRecovery.refresh().finally(() => {
        refreshPromise = null;
      });
      await refreshPromise;
      return apiRequest<T>(path, options, {
        ...requestOptions,
        skipRefresh: true,
      });
    } catch {
      authRecovery.failed();
    }
  }
  if (response.status === 401 && requestOptions.skipRefresh && authRecovery) {
    authRecovery.failed();
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as ApiResponse<T>) : null;

  if (!response.ok || (payload && !payload.success)) {
    const message =
      (payload &&
        !payload.success &&
        (payload.error?.message || payload.message)) ||
      'The platform API request failed.';
    const code = payload && !payload.success ? payload.error?.code : undefined;
    throw new ApiError(message, response.status, code);
  }

  return payload && payload.success ? payload.data : (undefined as T);
}
