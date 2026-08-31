import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../auth/auth-context';
import { clearAccessToken } from '../../services/auth/session';
import { SubscriptionListPage } from './SubscriptionListPage';

import { SUBSCRIPTION_VIEW } from './subscription-permissions';

const authValue: AuthContextValue = {
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
    permissions: [SUBSCRIPTION_VIEW],
  },
  initializing: false,
  login: vi.fn(),
  logout: vi.fn(),
  hasPermission: (permission) => permission === SUBSCRIPTION_VIEW,
};

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

function renderPage(ui = <SubscriptionListPage />) {
  return render(
    <MemoryRouter initialEntries={['/subscriptions']}>
      <AuthContext.Provider value={authValue}>{ui}</AuthContext.Provider>
    </MemoryRouter>,
  );
}

const subscription = {
  id: '6fd73a18-a458-4e63-a81d-93c79ecab71f',
  organizationId: '7d887ac7-aa7c-47f8-9401-c6a2ced17cfe',
  planId: '9af6f9a0-6090-4c5d-bd8a-c6b4f830eb89',
  status: 'ACTIVE',
  billingInterval: 'MONTHLY',
  currency: 'INR',
  priceAtSubscription: '4999.00',
  currentPeriodStart: '2026-08-01T00:00:00.000Z',
  currentPeriodEnd: '2026-08-31T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-18T00:00:00.000Z',
  organization: {
    id: '7d887ac7-aa7c-47f8-9401-c6a2ced17cfe',
    name: 'Acme Finance',
    primaryEmail: 'billing@acme.test',
    status: 'ACTIVE',
  },
  plan: {
    id: '9af6f9a0-6090-4c5d-bd8a-c6b4f830eb89',
    key: 'PROFESSIONAL',
    name: 'Professional',
  },
};

describe('SubscriptionListPage', () => {
  afterEach(() => {
    cleanup();
    clearAccessToken();
    vi.unstubAllGlobals();
  });

  it('renders subscriptions from the platform API with detail links', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response(200, {
          success: true,
          data: {
            items: [subscription],
            meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
          },
        }),
      ),
    );

    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading subscriptions',
    );
    expect(await screen.findByText('Acme Finance')).toBeVisible();
    expect(screen.getByText('Professional')).toBeVisible();
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Acme Finance' })).toHaveAttribute(
      'href',
      '/subscriptions/6fd73a18-a458-4e63-a81d-93c79ecab71f',
    );
  });

  it('sends search, filter, pagination, and sorting query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response(200, {
        success: true,
        data: {
          items: [subscription],
          meta: { page: 1, limit: 10, total: 1, totalPages: 2 },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    await screen.findByText('Acme Finance');

    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'acme' },
    });
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'ACTIVE' },
    });
    fireEvent.change(screen.getByLabelText('Sort'), {
      target: { value: 'createdAt:desc' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      const requestedUrl = String(fetchMock.mock.calls.at(-1)?.[0]);
      expect(requestedUrl).toContain('search=acme');
    });
    const requestedUrl = String(fetchMock.mock.calls.at(-1)?.[0]);
    expect(requestedUrl).toContain('/api/v1/platform/subscriptions?');
    expect(requestedUrl).toContain('page=1');
    expect(requestedUrl).toContain('limit=10');
    expect(requestedUrl).toContain('search=acme');
    expect(requestedUrl).toContain('status=ACTIVE');
    expect(requestedUrl).toContain('sortBy=createdAt');
    expect(requestedUrl).toContain('order=desc');
  });

  it('uses the fixed status for filtered subscription pages', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response(200, {
        success: true,
        data: {
          items: [],
          meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderPage(
      <SubscriptionListPage
        fixedStatus="TRIAL"
        title="Trial subscriptions"
        description="Trials"
      />,
    );

    expect(await screen.findByText('No subscriptions found')).toBeVisible();
    expect(screen.getByLabelText('Status')).toBeDisabled();
    expect(String(fetchMock.mock.calls[0][0])).toContain('status=TRIAL');
  });

  it('renders API errors without subscription rows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response(500, {
          success: false,
          error: {
            code: 'SUBSCRIPTIONS_UNAVAILABLE',
            message: 'Subscriptions are unavailable.',
          },
        }),
      ),
    );

    renderPage();

    expect(await screen.findByText('Subscriptions unavailable')).toBeVisible();
    expect(screen.getByText('Subscriptions are unavailable.')).toBeVisible();
  });
});
