import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from './auth-context';
import { PermissionRoute } from './PermissionRoute';

afterEach(() => {
  cleanup();
});

function renderRoute(
  path: string,
  requiredPermission: string,
  permissions: string[],
) {
  render(
    <AuthContext.Provider
      value={{
        auth: {
          sessionId: 'session-id',
          staff: {
            id: 'staff-id',
            firstName: 'Ada',
            lastName: 'Admin',
            email: 'ada@example.test',
            status: 'ACTIVE',
          },
          roles: [],
          permissions,
        },
        initializing: false,
        login: vi.fn(),
        logout: vi.fn(),
        hasPermission: (permission) => permissions.includes(permission),
      }}
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            element={<PermissionRoute permission={requiredPermission} />}
          >
            <Route path={path} element={<span>Protected page</span>} />
          </Route>
          <Route path="/unauthorized" element={<span>Permission required</span>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('PermissionRoute', () => {
  it('renders the protected route when the permission is granted', () => {
    renderRoute(
      '/organizations/new',
      'platform.organization.create',
      ['platform.organization.create'],
    );

    expect(screen.getByText('Protected page')).toBeVisible();
  });

  it('redirects to unauthorized when the permission is missing', async () => {
    renderRoute(
      '/organizations/new',
      'platform.organization.create',
      ['platform.organization.view'],
    );

    expect(await screen.findByText('Permission required')).toBeVisible();
    await waitFor(() =>
      expect(
        screen.queryByText('Protected page'),
      ).not.toBeInTheDocument(),
    );
  });

  it.each([
    ['/staff', 'platform.staff.view'],
    ['/staff/new', 'platform.staff.create'],
    ['/staff/staff-id', 'platform.staff.view'],
    ['/roles', 'platform.role.view'],
    ['/roles/new', 'platform.role.manage'],
    ['/roles/role-id', 'platform.role.view'],
  ])('protects %s with %s', (path, permission) => {
    renderRoute(path, permission, [permission]);
    expect(screen.getByText('Protected page')).toBeVisible();
  });
});
