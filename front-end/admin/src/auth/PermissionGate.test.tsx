import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAccessToken } from '../services/auth/session';
import { AuthProvider } from './AuthContext';
import { PermissionGate } from './PermissionGate';

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('PermissionGate', () => {
  it('renders granted content and the configured denial fallback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
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
              permissions: ['platform.staff.view'],
            },
          }),
      }),
    );

    render(
      <AuthProvider>
        <PermissionGate permission="platform.staff.view">
          <span>Granted content</span>
        </PermissionGate>
        <PermissionGate
          permission="platform.role.manage"
          fallback={<span>Denied content</span>}
        >
          <span>Hidden content</span>
        </PermissionGate>
      </AuthProvider>,
    );

    expect(await screen.findByText('Granted content')).toBeVisible();
    expect(screen.getByText('Denied content')).toBeVisible();
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });
});
