import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../../auth/auth-context';
import type { PlatformStaffStatus } from '../../types/auth';
import { StaffCreatePage } from './StaffCreatePage';
import { StaffDetailPage } from './StaffDetailPage';
import { StaffPage } from './StaffPage';

function response(status: number, data: unknown, code?: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(status >= 200 && status < 300 ? { success: true, data } : { success: false, error: { code, message: 'Backend denied the action.' } }),
  };
}

const staff = {
  id: 'staff-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.test',
  status: 'ACTIVE' as PlatformStaffStatus,
  lastLoginAt: null,
  createdAt: '2026-08-20T10:00:00.000Z',
  updatedAt: '2026-08-21T10:00:00.000Z',
};

const roleAssignment = {
  staffId: 'staff-1',
  role: { id: 'role-1', key: 'PLATFORM_OPERATOR', name: 'Platform Operator', description: null, isSystemPreset: false, isActive: true },
  assignedAt: '2026-08-22T10:00:00.000Z',
  assignedByStaffId: 'actor-1',
};

const financeRoleAssignment = {
  ...roleAssignment,
  role: {
    ...roleAssignment.role,
    id: 'role-2',
    key: 'FINANCE_REVIEWER',
    name: 'Finance Reviewer',
  },
};

function renderWithAuth(
  page: React.ReactNode,
  permissions: string[],
  path = '/',
  routePath = path,
) {
  render(
    <AuthContext.Provider value={{
      auth: { sessionId: 'session', staff: { id: 'actor-1', firstName: 'Grace', lastName: 'Admin', email: 'grace@example.test', status: 'ACTIVE' }, roles: [], permissions },
      initializing: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: (permission) => permissions.includes(permission),
    }}>
      <MemoryRouter initialEntries={[path]}><Routes><Route path={routePath} element={page} /><Route path="/staff/:id" element={<span>Created staff detail</span>} /></Routes></MemoryRouter>
    </AuthContext.Provider>,
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Staff pages', () => {
  it('renders the safe paginated staff projection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, { items: [staff], page: 1, limit: 10, total: 1, totalPages: 1 })));
    renderWithAuth(<StaffPage />, ['platform.staff.view']);
    expect(await screen.findByText('Ada Lovelace')).toBeVisible();
    expect(screen.getByText('ada@example.test')).toBeVisible();
    expect(screen.getByText('Never')).toBeVisible();
    expect(screen.queryByText(/password/i)).not.toBeInTheDocument();
  });

  it('creates staff with only the allowed payload and no role or status fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(201, staff));
    vi.stubGlobal('fetch', fetchMock);
    renderWithAuth(<StaffCreatePage />, ['platform.staff.create', 'platform.staff.view'], '/staff/new');
    expect(screen.queryByLabelText(/status/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Lovelace' } });
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'ada@example.test' } });
    fireEvent.change(screen.getByLabelText(/Initial password/), { target: { value: 'correct-horse-battery' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create staff member' }));
    expect(await screen.findByText('Created staff detail')).toBeVisible();
    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', initialPassword: 'correct-horse-battery' });
  });

  it('renders assigned roles and uses the assignment and removal endpoints', async () => {
    const requests: Array<{ url: string; method: string; body?: string }> = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const method = options?.method ?? 'GET';
      requests.push({ url, method, body: options?.body as string | undefined });
      if (url.endsWith('/staff/staff-1/roles')) return Promise.resolve(response(200, method === 'GET' ? [roleAssignment, financeRoleAssignment] : roleAssignment));
      if (url.endsWith('/roles?limit=100&isActive=true&sortBy=name&order=asc') || url.includes('/roles?')) return Promise.resolve(response(200, { items: [{ ...roleAssignment.role, createdAt: staff.createdAt, updatedAt: staff.updatedAt }, { ...financeRoleAssignment.role, createdAt: staff.createdAt, updatedAt: staff.updatedAt }, { id: 'role-3', key: 'SECURITY_REVIEWER', name: 'Security Reviewer', description: null, isSystemPreset: false, isActive: true, createdAt: staff.createdAt, updatedAt: staff.updatedAt }], page: 1, limit: 100, total: 3, totalPages: 1 }));
      if (url.endsWith('/staff/staff-1')) return Promise.resolve(response(200, staff));
      if (url.endsWith('/staff/staff-1/role-assignments') && method === 'POST') return Promise.resolve(response(201, roleAssignment));
      if (url.endsWith('/staff/staff-1/role-assignments/role-1') && method === 'DELETE') return Promise.resolve(response(200, roleAssignment));
      return Promise.resolve(response(404, null));
    }));
    renderWithAuth(<StaffDetailPage />, ['platform.staff.view', 'platform.staff.role.assign', 'platform.role.view'], '/staff/staff-1', '/staff/:id');
    expect(await screen.findByText('Platform Operator')).toBeVisible();
    expect(screen.getByText('Finance Reviewer')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Role to assign'), { target: { value: 'role-3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assign role' }));
    await waitFor(() => expect(requests.some((request) => request.url.endsWith('/staff/staff-1/role-assignments') && request.method === 'POST' && request.body === JSON.stringify({ roleId: 'role-3' }))).toBe(true));
    expect(await screen.findByText('Role assigned.')).toBeVisible();

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    let dialog = screen.getByRole('dialog', { name: 'Remove assigned role' });
    expect(requests.some((request) => request.method === 'DELETE')).toBe(false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(requests.some((request) => request.method === 'DELETE')).toBe(false);

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    dialog = screen.getByRole('dialog', { name: 'Remove assigned role' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove role' }));
    await waitFor(() => expect(requests.some((request) => request.url.endsWith('/staff/staff-1/role-assignments/role-1') && request.method === 'DELETE')).toBe(true));
  });

  it('follows lifecycle permissions and renders backend security errors', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.endsWith('/staff/staff-1/deactivations') && options?.method === 'POST') return Promise.resolve(response(403, null, 'LAST_EFFECTIVE_SUPER_ADMIN'));
      if (url.endsWith('/staff/staff-1/roles')) return Promise.resolve(response(200, []));
      return Promise.resolve(response(200, staff));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithAuth(<StaffDetailPage />, ['platform.staff.view', 'platform.staff.disable'], '/staff/staff-1', '/staff/:id');
    expect(await screen.findByRole('button', { name: 'Deactivate' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog', { name: 'Deactivate staff member' });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([url, options]) => String(url).endsWith('/deactivations') && options?.method === 'POST')).toBe(false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate staff' }));
    expect(await screen.findByText('The final effective Super Admin cannot lose access.')).toBeVisible();
    vi.useFakeTimers();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText('The final effective Super Admin cannot lose access.')).toBeVisible();
  });
});
