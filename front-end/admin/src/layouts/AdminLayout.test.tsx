import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/auth-context';
import { AdminLayout } from './AdminLayout';

afterEach(() => {
  cleanup();
});

function renderLayout(permissions: string[]) {
  render(
    <AuthContext.Provider value={{
        auth: { sessionId: 'session', staff: { id: 'staff', firstName: 'Ada', lastName: 'Admin', email: 'ada@example.test', status: 'ACTIVE' }, roles: [], permissions },
        initializing: false,
        login: vi.fn(),
        logout: vi.fn(),
        hasPermission: (permission) => permissions.includes(permission),
      }}>
        <MemoryRouter initialEntries={['/']}>
          <Routes><Route element={<AdminLayout />}><Route index element={<span>Dashboard</span>} /></Route></Routes>
        </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('AdminLayout access navigation', () => {
  it('shows Staff and Roles navigation only with their view permissions', () => {
    renderLayout(['platform.staff.view']);
    expect(screen.getByRole('link', { name: 'Staff' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Roles' })).not.toBeInTheDocument();
    cleanup();
    renderLayout(['platform.role.view']);
    expect(screen.queryByRole('link', { name: 'Staff' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Roles' })).toBeVisible();
  });

  it('shows commercial navigation only with its view permissions', () => {
    renderLayout(['subscription.subscription.view']);
    expect(screen.getByRole('link', { name: 'Subscriptions' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Billing & revenue' })).not.toBeInTheDocument();
    cleanup();
    renderLayout(['billing.revenue.view']);
    expect(screen.queryByRole('link', { name: 'Subscriptions' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Billing & revenue' })).toBeVisible();
  });

  it('renders only populated navigation groups for a limited actor', () => {
    renderLayout(['platform.organization.view']);
    expect(screen.getByText('Overview')).toBeVisible();
    expect(screen.getByText('Organizations', { selector: '.nav-group-label' })).toBeVisible();
    expect(screen.queryByText('People & access')).not.toBeInTheDocument();
    expect(screen.queryByText('Product & pricing')).not.toBeInTheDocument();
    expect(screen.queryByText('Commercial')).not.toBeInTheDocument();
  });

});
