import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from './auth-context';
import { PermissionRoute } from './PermissionRoute';

afterEach(() => {
  cleanup();
});

function renderRoute(permissions: string[]) {
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
      <MemoryRouter initialEntries={['/organizations/new']}>
        <Routes>
          <Route
            element={
              <PermissionRoute permission="platform.organization.create" />
            }
          >
            <Route
              path="/organizations/new"
              element={<span>Create organization page</span>}
            />
          </Route>
          <Route path="/unauthorized" element={<span>Permission required</span>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('PermissionRoute', () => {
  it('renders the protected route when the permission is granted', () => {
    renderRoute(['platform.organization.create']);

    expect(screen.getByText('Create organization page')).toBeVisible();
  });

  it('redirects to unauthorized when the permission is missing', async () => {
    renderRoute(['platform.organization.view']);

    expect(await screen.findByText('Permission required')).toBeVisible();
    await waitFor(() =>
      expect(
        screen.queryByText('Create organization page'),
      ).not.toBeInTheDocument(),
    );
  });
});
