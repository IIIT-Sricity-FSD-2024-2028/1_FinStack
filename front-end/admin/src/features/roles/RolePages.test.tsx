import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../../auth/auth-context';
import { RoleCreatePage } from './RoleCreatePage';
import { RoleDetailPage } from './RoleDetailPage';

function response(status: number, data: unknown, code?: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(status >= 200 && status < 300 ? { success: true, data } : { success: false, error: { code, message: 'Backend denied the action.' } }),
  };
}

const customRole = {
  id: 'role-1',
  key: 'PLATFORM_OPERATOR',
  name: 'Platform Operator',
  description: 'Performs daily operations.',
  isSystemPreset: false,
  isActive: true,
  createdAt: '2026-08-20T10:00:00.000Z',
  updatedAt: '2026-08-21T10:00:00.000Z',
};

const permission = { id: 'permission-1', key: 'platform.staff.view', description: 'View platform staff.' };
const availablePermission = { id: 'permission-2', key: 'platform.staff.update', description: 'Update platform staff.' };
const organizationPermission = { id: 'permission-3', key: 'platform.organization.view', description: 'View organizations.' };
const rolePermission = { id: 'permission-4', key: 'platform.role.view', description: 'View platform roles.' };
const assignment = { roleId: 'role-1', permission, assignedAt: '2026-08-22T10:00:00.000Z' };

function renderWithAuth(
  page: React.ReactNode,
  permissions: string[],
  path: string,
  routePath = path,
) {
  render(
    <AuthContext.Provider value={{
      auth: { sessionId: 'session', staff: { id: 'actor', firstName: 'Ada', lastName: 'Admin', email: 'ada@example.test', status: 'ACTIVE' }, roles: [], permissions },
      initializing: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: (item) => permissions.includes(item),
    }}>
      <MemoryRouter initialEntries={[path]}><Routes><Route path={routePath} element={page} /><Route path="/roles/:id" element={<span>Created role detail</span>} /></Routes></MemoryRouter>
    </AuthContext.Provider>,
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Role pages', () => {
  it('creates a custom role with only allowed metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(201, customRole));
    vi.stubGlobal('fetch', fetchMock);
    renderWithAuth(<RoleCreatePage />, ['platform.role.manage', 'platform.role.view'], '/roles/new');
    expect(screen.queryByLabelText(/system/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/active/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/permission/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Role key/), { target: { value: 'PLATFORM_OPERATOR' } });
    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: 'Platform Operator' } });
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'Performs daily operations.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create custom role' }));
    expect(await screen.findByText('Created role detail')).toBeVisible();
    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ key: 'PLATFORM_OPERATOR', name: 'Platform Operator', description: 'Performs daily operations.' });
  });

  it('keeps system roles fully read-only while rendering assigned permissions', async () => {
    const systemRole = { ...customRole, id: 'system-role', key: 'PLATFORM_SUPER_ADMIN', name: 'Super Admin', isSystemPreset: true };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/roles/system-role/permissions')) return Promise.resolve(response(200, [{ ...assignment, roleId: 'system-role' }]));
      if (url.endsWith('/permissions')) return Promise.resolve(response(200, [permission]));
      return Promise.resolve(response(200, systemRole));
    }));
    renderWithAuth(<RoleDetailPage />, ['platform.role.view', 'platform.role.manage'], '/roles/system-role', '/roles/:id');
    expect(await screen.findByText('System - Managed by FinStack')).toBeVisible();
    expect(screen.getByText('platform.staff.view')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Grant permission' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save metadata' })).not.toBeInTheDocument();
  });

  it('manages custom lifecycle and permission removal through exact endpoints', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const requests: Array<{ url: string; method: string }> = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const method = options?.method ?? 'GET';
      requests.push({ url, method });
      if (url.endsWith('/roles/role-1/permissions')) return Promise.resolve(response(200, [assignment]));
      if (url.endsWith('/permissions')) return Promise.resolve(response(200, [permission, availablePermission, organizationPermission, rolePermission]));
      return Promise.resolve(response(200, customRole));
    }));
    renderWithAuth(<RoleDetailPage />, ['platform.role.view', 'platform.role.manage'], '/roles/role-1', '/roles/:id');
    expect(await screen.findByRole('button', { name: 'Deactivate' })).toBeVisible();
    expect(screen.getByText('platform.staff.view')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    let dialog = screen.getByRole('dialog', { name: 'Deactivate custom role' });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(requests.some((request) => request.url.endsWith('/roles/role-1/deactivations') && request.method === 'POST')).toBe(false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate role' }));
    await waitFor(() => expect(requests.some((request) => request.url.endsWith('/roles/role-1/deactivations') && request.method === 'POST')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    dialog = screen.getByRole('dialog', { name: 'Remove assigned permission' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove permission' }));
    await waitFor(() => expect(requests.some((request) => request.url.endsWith('/roles/role-1/permission-assignments/permission-1') && request.method === 'DELETE')).toBe(true));
  });

  it('uses the permission grant endpoint and explains authority rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.endsWith('/roles/role-1/permission-assignments') && options?.method === 'POST') return Promise.resolve(response(403, null, 'PERMISSION_GRANT_NOT_ALLOWED'));
      if (url.endsWith('/roles/role-1/permissions')) return Promise.resolve(response(200, [assignment]));
      if (url.endsWith('/permissions')) return Promise.resolve(response(200, [permission, availablePermission, organizationPermission, rolePermission]));
      return Promise.resolve(response(200, customRole));
    }));
    renderWithAuth(<RoleDetailPage />, ['platform.role.view', 'platform.role.manage'], '/roles/role-1', '/roles/:id');
    await screen.findByText('platform.staff.view');
    expect(screen.getByRole('button', { name: 'Permission to grant' })).toBeVisible();
    expect(document.querySelector('select[aria-label="Permission to grant"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Permission to grant' }));
    let listbox = screen.getByRole('listbox', { name: 'Available permissions' });
    expect(screen.getByPlaceholderText('Search permissions...')).toBeVisible();
    expect(within(listbox).getByText('STAFF')).toBeVisible();
    expect(within(listbox).getByText('ORGANIZATION')).toBeVisible();
    expect(within(listbox).getByText('ROLE')).toBeVisible();
    expect(within(listbox).getByText('platform.staff.update')).toBeVisible();
    expect(within(listbox).getByText('Update platform staff.')).toBeVisible();
    expect(within(listbox).queryByText('platform.staff.view')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Search available permissions' }), { target: { value: 'Update platform' } });
    expect(within(listbox).getByText('platform.staff.update')).toBeVisible();
    expect(within(listbox).queryByText('platform.organization.view')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search available permissions' }), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Permission to grant' }));
    listbox = screen.getByRole('listbox', { name: 'Available permissions' });
    expect(listbox).toBeVisible();
    fireEvent.change(screen.getByRole('combobox', { name: 'Search available permissions' }), { target: { value: 'platform.staff.update' } });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search available permissions' }), { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Permission to grant' })).toHaveTextContent('platform.staff.update');
    fireEvent.click(screen.getByRole('button', { name: 'Grant permission' }));
    expect(await screen.findByText('You can only grant permissions that you currently have.')).toBeVisible();
    vi.useFakeTimers();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText('You can only grant permissions that you currently have.')).toBeVisible();
  });
});
