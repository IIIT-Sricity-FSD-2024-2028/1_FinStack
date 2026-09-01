import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../../auth/auth-context';
import { PlatformDashboardPage } from './PlatformDashboardPage';

function response(data: unknown) {
  return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, data }) };
}

const organization = {
  id: 'organization-1', name: 'Acme Corp', slug: 'acme', primaryEmail: 'admin@acme.test', primaryContactName: null, primaryContactEmail: null,
  billingEmail: null, country: null, defaultCurrency: 'INR', timezone: null, status: 'ACTIVE', externalCustomerRef: null, metadata: null,
  statusChangedAt: null, suspendedAt: null, cancelledAt: null, archivedAt: null, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
};
const payment = {
  id: 'payment-1', organizationId: organization.id, subscriptionId: 'subscription-1', invoiceId: 'invoice-1', amount: '1500.00', currency: 'INR', status: 'SUCCEEDED',
  provider: 'RAZORPAY', providerOrderId: 'order-1', providerReference: 'pay-1', paymentMethod: 'card', failureCode: null, failureReason: null,
  paidAt: '2026-08-01T00:00:00.000Z', failedAt: null, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
  organization: { id: organization.id, name: organization.name, slug: organization.slug, primaryEmail: organization.primaryEmail }, invoice: { id: 'invoice-1', invoiceNumber: 'INV-0001', status: 'PAID' },
};
const subscription = {
  id: 'subscription-1', status: 'ACTIVE', billingInterval: 'MONTHLY', currency: 'INR', priceAtSubscription: '1500.00', employeeCount: 2, employeeAmount: '500.00', featureAmount: '0.00',
  currentPeriodStart: null, currentPeriodEnd: null, trialStartAt: null, trialEndAt: null, cancelledAt: null, createdAt: organization.createdAt, updatedAt: organization.updatedAt,
  organization: payment.organization,
  plan: { id: 'plan-1', key: 'GROWTH', name: 'Growth', billingInterval: 'MONTHLY', basePrice: '1000.00', currency: 'INR', features: [], includedEmployeeCount: 1, additionalEmployeePrice: '500.00' },
};

function renderDashboard(permissions: string[]) {
  render(<AuthContext.Provider value={{ auth: { sessionId: 'session', staff: { id: 'staff', firstName: 'Ada', lastName: 'Admin', email: 'ada@example.test', status: 'ACTIVE' }, roles: [], permissions }, initializing: false, login: vi.fn(), logout: vi.fn(), hasPermission: (permission) => permissions.includes(permission) }}><MemoryRouter><PlatformDashboardPage /></MemoryRouter></AuthContext.Provider>);
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('PlatformDashboardPage', () => {
  it('shows the full permitted platform and commercial overview', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/health')) return Promise.resolve(response({ status: 'healthy', checkedAt: organization.createdAt, api: { status: 'available' }, database: { status: 'available' } }));
      if (url.includes('/organizations')) return Promise.resolve(response({ items: [organization], page: 1, limit: 5, total: 6, totalPages: 2 }));
      if (url.includes('/staff')) return Promise.resolve(response({ items: [], page: 1, limit: 1, total: 3, totalPages: 3 }));
      if (url.includes('/subscriptions')) return Promise.resolve(response({ items: [subscription], meta: { page: 1, pageSize: 5, totalItems: 4, totalPages: 1 } }));
      return Promise.resolve(response({ activeSubscriptions: 2, trialSubscriptions: 1, successfulRevenueByCurrency: [{ currency: 'INR', amount: '1500.00' }], pendingInvoiceValueByCurrency: [{ currency: 'INR', amount: '500.00' }], failedPaymentCount: 1, recentSuccessfulPayments: [payment] }));
    }));
    renderDashboard(['platform.organization.view', 'platform.staff.view', 'subscription.subscription.view', 'billing.revenue.view']);
    expect(await screen.findByText('Platform overview')).toBeVisible();
    expect(screen.getByText('Commercial')).toBeVisible();
    expect(screen.getByText('Recent organizations')).toBeVisible();
    expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₹1,500.00').length).toBeGreaterThan(0);
  });

  it('shows commercial data without staff or organization data for a billing-oriented actor', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/health')) return Promise.resolve(response({ status: 'healthy', checkedAt: organization.createdAt, api: { status: 'available' }, database: { status: 'available' } }));
      if (url.includes('/subscriptions')) return Promise.resolve(response({ items: [subscription], meta: { page: 1, pageSize: 5, totalItems: 4, totalPages: 1 } }));
      return Promise.resolve(response({ activeSubscriptions: 2, trialSubscriptions: 1, successfulRevenueByCurrency: [], pendingInvoiceValueByCurrency: [], failedPaymentCount: 0, recentSuccessfulPayments: [] }));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderDashboard(['subscription.subscription.view', 'billing.revenue.view']);
    expect(await screen.findByText('Commercial')).toBeVisible();
    expect(screen.queryByText('Platform staff')).not.toBeInTheDocument();
    expect(screen.queryByText('Recent organizations')).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/organizations'))).toBe(false));
  });

  it('keeps a limited operations actor focused on permitted organization data', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/health')) return Promise.resolve(response({ status: 'healthy', checkedAt: organization.createdAt, api: { status: 'available' }, database: { status: 'available' } }));
      return Promise.resolve(response({ items: [organization], page: 1, limit: 5, total: 1, totalPages: 1 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderDashboard(['platform.organization.view']);
    expect(await screen.findByText('Recent organizations')).toBeVisible();
    expect(screen.queryByText('Commercial')).not.toBeInTheDocument();
    expect(screen.queryByText('Platform staff')).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/billing/overview'))).toBe(false));
  });
});
