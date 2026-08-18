import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HealthPage } from './HealthPage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HealthPage', () => {
  it('renders live API and database availability', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
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
      }),
    );

    render(<HealthPage />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Checking platform services',
    );
    expect(await screen.findByText('Platform status: Healthy')).toBeVisible();
    expect(screen.getByText('PostgreSQL')).toBeVisible();
  });
});
