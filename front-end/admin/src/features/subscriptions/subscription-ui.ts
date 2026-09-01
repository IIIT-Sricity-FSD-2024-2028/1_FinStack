import type { SubscriptionStatus } from '../../types/commercial';
import { formatPrice } from '../plans/plan-ui';

export { formatPrice };

export function formatCommercialDate(value: string | null): string {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export function statusLabel(status: SubscriptionStatus | string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function statusTone(status: SubscriptionStatus | string): string {
  if (status === 'ACTIVE' || status === 'TRIAL' || status === 'PAID' || status === 'SUCCEEDED') return 'available';
  return 'unavailable';
}

export function formatMoney(amount: string, currency: string): string {
  return formatPrice(amount, currency);
}
