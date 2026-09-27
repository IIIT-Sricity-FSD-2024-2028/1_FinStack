import { describe, expect, it } from 'vitest';
import { formatBillingInterval, formatPrice, formatStatus, getStatusPillClass } from './plan-ui';

describe('plan-ui utilities', () => {
  describe('formatPrice', () => {
    it('formats string amount correctly', () => {
      // Intl.NumberFormat behavior varies slightly by Node version, but generally for en-IN
      // it should include the currency symbol and format as Indian rupees.
      // We can use a relaxed match or exact match depending on the system locale data.
      const formatted = formatPrice('1234.56', 'INR');
      expect(formatted).toContain('1,234.56');
    });

    it('formats number amount correctly', () => {
      const formatted = formatPrice(1234.56, 'USD');
      expect(formatted).toContain('1,234.56');
    });
  });

  describe('formatBillingInterval', () => {
    it('formats MONTHLY correctly', () => {
      expect(formatBillingInterval('MONTHLY')).toBe('Monthly');
    });

    it('formats YEARLY correctly', () => {
      expect(formatBillingInterval('YEARLY')).toBe('Yearly');
    });

    it('returns the input for unknown intervals', () => {
      // @ts-expect-error - testing invalid enum
      expect(formatBillingInterval('WEEKLY')).toBe('WEEKLY');
    });
  });

  describe('getStatusPillClass', () => {
    it('returns available class for ACTIVE', () => {
      expect(getStatusPillClass('ACTIVE')).toBe('status-pill status-pill-available');
    });

    it('returns unavailable class for INACTIVE', () => {
      expect(getStatusPillClass('INACTIVE')).toBe('status-pill status-pill-unavailable');
    });
  });

  describe('formatStatus', () => {
    it('formats ACTIVE correctly', () => {
      expect(formatStatus('ACTIVE')).toBe('Active');
    });

    it('formats INACTIVE correctly', () => {
      expect(formatStatus('INACTIVE')).toBe('Inactive');
    });

    it('returns the input for unknown status', () => {
      // @ts-expect-error - testing invalid enum
      expect(formatStatus('UNKNOWN')).toBe('UNKNOWN');
    });
  });
});
