import type { ApiResponse } from '../../types/api';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || '/api/v1/platform';

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...options.headers,
    },
  });
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.success) {
    const message =
      (!payload.success && (payload.error?.message || payload.message)) ||
      'The platform API request failed.';
    throw new ApiError(message);
  }

  return payload.data;
}
