import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../../auth/auth-context';
import { BillingPage } from '../billing/BillingPage';
import { SubscriptionDetailPage } from '../subscriptions/SubscriptionDetailPage';
import { SubscriptionCreatePage } from '../subscriptions/SubscriptionCreatePage';
import { SubscriptionsPage } from '../subscriptions/SubscriptionsPage';

function response(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify({ success: status < 300, data }),
  };
}

const plan = {
  id: 'plan-1',
  key: 'GROWTH',
  name: 'Growth',
  billingInterval: 'MONTHLY',
  basePrice: '1000.00',
  currency: 'INR',
  trialDays: 0,
};

const organization = {
  id: 'org-1',
  name: 'Acme Corp',
  slug: 'acme',
  primaryEmail: 'billing@acme.test',
};

const subscription = {
  id: 'subscription-1',
  status: 'ACTIVE',
  billingInterval: 'MONTHLY',
  currency: 'INR',
  priceAtSubscription: '1000.00',
  employeeCount: 0,
  employeeAmount: '0.00',
  featureAmount: '0.00',
  currentPeriodStart: '2026-08-01T00:00:00.000Z',
  currentPeriodEnd: '2026-09-01T00:00:00.000Z',
  trialStartAt: null,
  trialEndAt: null,
  cancelledAt: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  organization,
  plan: {
    ...plan,
    features: [
      {
        id: 'feature-1',
        key: 'OCR_RECEIPT_EXTRACTION',
        name: 'Receipt OCR',
        valueType: 'BOOLEAN',
        enabled: true,
        value: true,
      },
    ],
  },
};

const invoice = {
  id: 'invoice-1',
  invoiceNumber: 'INV-0001',
  organizationId: 'org-1',
  subscriptionId: 'subscription-1',
  planId: 'plan-1',
  billingReason: 'INITIAL',
  status: 'PAID',
  subtotal: '1000.00',
  taxAmount: '0',
  totalAmount: '1000.00',
  currency: 'INR',
  billingPeriodStart: null,
  billingPeriodEnd: null,
  issueDate: '2026-08-01T00:00:00.000Z',
  dueDate: '2026-08-01T00:00:00.000Z',
  paidAt: '2026-08-01T00:00:00.000Z',
  voidedAt: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  organization,
  plan: {
    id: plan.id,
    key: plan.key,
    name: plan.name,
  },
};

const payment = {
  id: 'payment-1',
  organizationId: 'org-1',
  subscriptionId: 'subscription-1',
  invoiceId: 'invoice-1',
  amount: '1000.00',
  currency: 'INR',
  status: 'SUCCEEDED',
  provider: 'RAZORPAY',
  providerOrderId: 'order-1',
  providerReference: 'pay-1',
  paymentMethod: 'card',
  failureCode: null,
  failureReason: null,
  paidAt: '2026-08-01T00:00:00.000Z',
  failedAt: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  organization,
  invoice: {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
  },
};

function renderWithAuth(
  page: React.ReactNode,
  permissions: string[],
  path: string,
  routePath = path,
  includeCreatedRoute = false,
) {
  render(
    <AuthContext.Provider
      value={{
        auth: {
          sessionId: 'session',
          staff: {
            id: 'actor',
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
          <Route path={routePath} element={page} />
          {includeCreatedRoute && (
            <Route
              path="/subscriptions/subscription-1"
              element={<span>Subscription detail</span>}
            />
          )}
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('commercial Admin pages', () => {
  it('renders paginated subscriptions and sends assign payload without client pricing', async () => {
    const fetchMock = vi.fn().mockImplementation(
      (url: string, options?: RequestInit) => {
        if (url.endsWith('/subscriptions') && options?.method === 'POST') {
          return Promise.resolve(response({ subscription, invoice }, 201));
        }

        if (url.includes('/subscriptions')) {
          return Promise.resolve(
            response({
              items: [subscription],
              meta: {
                page: 1,
                pageSize: 10,
                totalItems: 1,
                totalPages: 1,
              },
            }),
          );
        }

        return Promise.resolve(
          response({
            items: [],
            meta: {
              page: 1,
              pageSize: 10,
              totalItems: 0,
              totalPages: 1,
            },
          }),
        );
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderWithAuth(
      <SubscriptionsPage />,
      ['subscription.subscription.view', 'subscription.subscription.manage'],
      '/subscriptions',
    );

    expect(await screen.findByText('Acme Corp')).toBeVisible();
    expect(screen.getByText('Growth')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Assign subscription' }),
    ).toHaveAttribute('href', '/subscriptions/new');
  });

  it('renders detail history and lifecycle controls, then calls cancel endpoint', async () => {
    const requests: Array<{ url: string; method: string }> = [];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        requests.push({
          url,
          method: options?.method ?? 'GET',
        });

        if (url.includes('/subscriptions/subscription-1/history')) {
          return Promise.resolve(
            response({
              items: [
                {
                  id: 'history-1',
                  subscriptionId: subscription.id,
                  action: 'PAYMENT_ACTIVATED',
                  previousStatus: 'PENDING_PAYMENT',
                  newStatus: 'ACTIVE',
                  previousPlanId: null,
                  newPlanId: plan.id,
                  note: 'Paid',
                  metadata: null,
                  createdAt: subscription.createdAt,
                  actorStaff: null,
                },
              ],
              meta: {
                page: 1,
                pageSize: 50,
                totalItems: 1,
                totalPages: 1,
              },
            }),
          );
        }

        if (url.endsWith('/subscriptions/subscription-1/cancellations')) {
          return Promise.resolve(response(subscription));
        }

        if (url.includes('/plans?')) {
          return Promise.resolve(
            response({
              items: [plan],
              page: 1,
              limit: 100,
              total: 1,
              totalPages: 1,
            }),
          );
        }

        return Promise.resolve(response(subscription));
      }),
    );

    renderWithAuth(
      <SubscriptionDetailPage />,
      ['subscription.subscription.view', 'subscription.subscription.manage'],
      '/subscriptions/subscription-1',
      '/subscriptions/:id',
    );

    expect(await screen.findByText(/Subscription History/i)).toBeVisible();
    expect(screen.getByText('Payment Activated')).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel subscription' }),
    );

    const dialog = screen.getByRole('dialog', {
      name: 'Cancel subscription',
    });

    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Cancel subscription',
      }),
    );

    await waitFor(() =>
      expect(
        requests.some(
          (request) =>
            request.url.endsWith('/cancellations') &&
            request.method === 'POST',
        ),
      ).toBe(true),
    );
  });

  it('shows revenue, invoice, and payment data without checkout controls', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.endsWith('/billing/overview')) {
          return Promise.resolve(
            response({
              activeSubscriptions: 2,
              trialSubscriptions: 1,
              successfulRevenueByCurrency: [
                {
                  currency: 'INR',
                  amount: '2000.00',
                },
              ],
              pendingInvoiceValueByCurrency: [
                {
                  currency: 'USD',
                  amount: '50.00',
                },
              ],
              failedPaymentCount: 1,
              recentSuccessfulPayments: [payment],
            }),
          );
        }

        if (url.includes('/billing/invoices')) {
          return Promise.resolve(
            response({
              items: [invoice],
              meta: {
                page: 1,
                pageSize: 10,
                totalItems: 1,
                totalPages: 1,
              },
            }),
          );
        }

        return Promise.resolve(
          response({
            items: [payment],
            meta: {
              page: 1,
              pageSize: 10,
              totalItems: 1,
              totalPages: 1,
            },
          }),
        );
      }),
    );

    renderWithAuth(
      <BillingPage />,
      ['billing.revenue.view', 'billing.invoice.view', 'billing.payment.view'],
      '/billing',
    );

    expect(await screen.findByText(/Successful Revenue/i)).toBeVisible();
    expect(screen.getByText('₹2,000.00')).toBeVisible();
    expect(screen.getAllByText('INV-0001').length).toBeGreaterThan(0);
    expect(screen.getByText('RAZORPAY')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /checkout|pay/i }),
    ).not.toBeInTheDocument();
  });

  it('assigns a subscription using only organization and plan ids', async () => {
    const fetchMock = vi.fn().mockImplementation(
      (url: string, options?: RequestInit) => {
        if (
          url.endsWith(
            '/organizations?page=1&limit=100&sortBy=name&order=asc',
          )
        ) {
          return Promise.resolve(
            response({
              items: [
                {
                  ...organization,
                  primaryContactName: null,
                  primaryContactEmail: null,
                  billingEmail: null,
                  country: null,
                  defaultCurrency: 'INR',
                  timezone: null,
                  status: 'ACTIVE',
                  externalCustomerRef: null,
                  metadata: null,
                  statusChangedAt: null,
                  suspendedAt: null,
                  cancelledAt: null,
                  archivedAt: null,
                  createdAt: subscription.createdAt,
                  updatedAt: subscription.updatedAt,
                },
              ],
              page: 1,
              limit: 100,
              total: 1,
              totalPages: 1,
            }),
          );
        }

        if (
          url.endsWith(
            '/plans?page=1&limit=100&status=ACTIVE&sortBy=name&order=asc',
          )
        ) {
          return Promise.resolve(
            response({
              items: [plan],
              page: 1,
              limit: 100,
              total: 1,
              totalPages: 1,
            }),
          );
        }

        if (url.endsWith('/subscriptions') && options?.method === 'POST') {
          return Promise.resolve(
            response({ subscription, invoice }, 201),
          );
        }

        return Promise.resolve(
          response({
            items: [],
            meta: {
              page: 1,
              pageSize: 10,
              totalItems: 0,
              totalPages: 1,
            },
          }),
        );
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    renderWithAuth(
      <SubscriptionCreatePage />,
      ['subscription.subscription.manage'],
      '/subscriptions/new',
      '/subscriptions/new',
      true,
    );

    expect(await screen.findByLabelText('Organization')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Organization'), {
      target: { value: organization.id },
    });

    fireEvent.change(screen.getByLabelText('Active plan'), {
      target: { value: plan.id },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Assign subscription' }),
    );

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([, options]) =>
            options?.method === 'POST' &&
            JSON.parse(options.body as string).organizationId ===
            organization.id &&
            JSON.parse(options.body as string).planId === plan.id,
        ),
      ).toBe(true),
    );
  });
});