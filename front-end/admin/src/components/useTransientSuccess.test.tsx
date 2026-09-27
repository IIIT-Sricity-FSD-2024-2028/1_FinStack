import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTransientSuccess } from './useTransientSuccess';

function SuccessHarness() {
  const { message, showSuccess } = useTransientSuccess();
  return (
    <>
      <button onClick={() => showSuccess('Profile updated.')} type="button">
        Show success
      </button>
      {message && <div role="status">{message}</div>}
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useTransientSuccess', () => {
  it('shows the latest success message and dismisses it after three seconds', () => {
    vi.useFakeTimers();
    render(<SuccessHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Show success' }));
    expect(screen.getByRole('status')).toHaveTextContent('Profile updated.');

    act(() => vi.advanceTimersByTime(2999));
    expect(screen.getByRole('status')).toBeVisible();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
