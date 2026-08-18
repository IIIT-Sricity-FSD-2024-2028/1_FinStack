import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAccessToken, setAccessToken } from '../auth/session';
import { apiRequest, configureAuthRecovery } from './client';

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

describe('platform API client', () => {
  afterEach(() => {
    clearAccessToken();
    configureAuthRecovery(null);
    vi.unstubAllGlobals();
  });

  it('performs one refresh for concurrent 401 responses and retries once', async () => {
    let authorizedCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, options: RequestInit) => {
        const headers = options.headers as Headers;
        if (headers.get('Authorization') === 'Bearer refreshed-token') {
          authorizedCalls += 1;
          return Promise.resolve(response(200, { success: true, data: 'ok' }));
        }
        return Promise.resolve(
          response(401, {
            success: false,
            error: { code: 'INVALID_ACCESS_TOKEN', message: 'Expired' },
          }),
        );
      }),
    );
    const refresh = vi.fn().mockImplementation(async () => {
      await Promise.resolve();
      setAccessToken('refreshed-token');
      return 'refreshed-token';
    });
    configureAuthRecovery({ refresh, failed: vi.fn() });

    await expect(
      Promise.all([apiRequest<string>('/one'), apiRequest<string>('/two')]),
    ).resolves.toEqual(['ok', 'ok']);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(authorizedCalls).toBe(2);
  });

  it('never retries a request more than once', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response(401, {
        success: false,
        error: { code: 'INVALID_ACCESS_TOKEN', message: 'Expired' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const failed = vi.fn();
    configureAuthRecovery({
      refresh: async () => {
        setAccessToken('still-invalid');
        return 'still-invalid';
      },
      failed,
    });

    await expect(apiRequest('/protected')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it('signals authentication failure when refresh fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response(401, {
          success: false,
          error: { code: 'INVALID_ACCESS_TOKEN', message: 'Expired' },
        }),
      ),
    );
    const failed = vi.fn();
    configureAuthRecovery({
      refresh: vi.fn().mockRejectedValue(new Error('Refresh failed')),
      failed,
    });

    await expect(apiRequest('/protected')).rejects.toMatchObject({ status: 401 });
    expect(failed).toHaveBeenCalledTimes(1);
  });
});
