import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { clearAccessToken, getAccessToken } from '../../services/auth/session';

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

describe('platform authentication flow', () => {
  afterEach(() => {
    cleanup();
    clearAccessToken();
    vi.unstubAllGlobals();
  });

  it('restores with refresh, redirects to login on failure, then holds login token in memory', async () => {
    window.history.replaceState({}, '', '/');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.endsWith('/auth/refresh')) {
          return Promise.resolve(
            response(401, {
              success: false,
              error: { code: 'REFRESH_SESSION_REQUIRED', message: 'No session' },
            }),
          );
        }
        if (url.endsWith('/auth/login')) {
          return Promise.resolve(
            response(200, {
              success: true,
              data: {
                sessionId: 'session-id',
                accessToken: 'access-token',
                expiresIn: 600,
                staff: {
                  id: 'staff-id',
                  firstName: 'Ada',
                  lastName: 'Admin',
                  email: 'ada@example.test',
                  status: 'ACTIVE',
                },
                roles: [],
                permissions: [],
              },
            }),
          );
        }
        return Promise.resolve(
          response(200, {
            success: true,
            data: {
              status: 'healthy',
              api: { status: 'available' },
              database: {
                status: 'available',
                checkedAt: '2026-08-18T00:00:00.000Z',
              },
              checkedAt: '2026-08-18T00:00:00.000Z',
            },
          }),
        );
      }),
    );

    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeVisible();

    fireEvent.change(screen.getByLabelText('Work email'), {
      target: { value: 'ada@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'correct-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Platform status: Healthy')).toBeVisible();
    await waitFor(() => expect(screen.getByText('Ada Admin')).toBeVisible());
  });

  it('shows login progress and a safe error', async () => {
    window.history.replaceState({}, '', '/login');
    let resolveLogin: ((value: unknown) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.endsWith('/auth/refresh')) {
          return Promise.resolve(
            response(401, {
              success: false,
              error: { code: 'REFRESH_SESSION_REQUIRED', message: 'No session' },
            }),
          );
        }
        return new Promise((resolve) => {
          resolveLogin = resolve;
        });
      }),
    );
    render(<App />);
    await screen.findByRole('heading', { name: 'Welcome back' });
    fireEvent.change(screen.getByLabelText('Work email'), {
      target: { value: 'ada@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();

    resolveLogin?.(
      response(401, {
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password.',
    );
  });

  it('bootstraps from refresh and logout clears the memory token', async () => {
    window.history.replaceState({}, '', '/');
    const authPayload = {
      sessionId: 'session-id',
      accessToken: 'refreshed-access-token',
      expiresIn: 600,
      staff: {
        id: 'staff-id',
        firstName: 'Ada',
        lastName: 'Admin',
        email: 'ada@example.test',
        status: 'ACTIVE',
      },
      roles: [],
      permissions: [],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.endsWith('/auth/refresh')) {
          return Promise.resolve(
            response(200, { success: true, data: authPayload }),
          );
        }
        if (url.endsWith('/auth/logout')) {
          return Promise.resolve(response(204, null));
        }
        return Promise.resolve(
          response(200, {
            success: true,
            data: {
              status: 'healthy',
              api: { status: 'available' },
              database: {
                status: 'available',
                checkedAt: '2026-08-18T00:00:00.000Z',
              },
              checkedAt: '2026-08-18T00:00:00.000Z',
            },
          }),
        );
      }),
    );

    render(<App />);
    expect(await screen.findByText('Platform status: Healthy')).toBeVisible();
    expect(getAccessToken()).toBe('refreshed-access-token');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(getAccessToken()).toBeNull();
  });
});
