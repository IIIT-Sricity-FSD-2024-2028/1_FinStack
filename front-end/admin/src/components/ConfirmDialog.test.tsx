import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

afterEach(cleanup);

describe('ConfirmDialog', () => {
  it('supports keyboard cancellation and blocks it while pending', () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <ConfirmDialog
        confirmLabel="Remove"
        destructive
        message="Remove this assignment?"
        onCancel={onCancel}
        onConfirm={vi.fn()}
        open
        title="Remove assignment"
      />,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();

    onCancel.mockClear();
    rerender(
      <ConfirmDialog
        confirmLabel="Remove"
        destructive
        message="Remove this assignment?"
        onCancel={onCancel}
        onConfirm={vi.fn()}
        open
        pending
        title="Remove assignment"
      />,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button').every((button) => button.hasAttribute('disabled'))).toBe(true);
  });
});
