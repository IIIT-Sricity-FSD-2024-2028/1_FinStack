import type { SubscriptionStatus } from '../../types/commercial';
import { formatPrice } from '../plans/plan-ui';

export { formatPrice };

export function formatCommercialDate(value: string | null): string {
  if (!value) return 'Not set';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(date);
}

export function statusLabel(status: SubscriptionStatus | string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function statusTone(status: SubscriptionStatus | string): string {
  if (
    status === 'ACTIVE' ||
    status === 'TRIAL' ||
    status === 'PAID' ||
    status === 'SUCCEEDED'
  ) {
    return 'available';
  }

  return 'unavailable';
}

export function formatMoney(
  amount: string | number | null | undefined,
  currency: string,
): string {
  if (amount === null || amount === undefined || amount === '') {
    return formatPrice(0, currency);
  }

  return formatPrice(amount, currency);
}