import { BillingInterval, PlanStatus } from '../../types/catalog';

export const formatPrice = (amount: string | number, currency: string) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export const formatBillingInterval = (interval: BillingInterval) => {
  switch (interval) {
    case 'MONTHLY':
      return 'Monthly';
    case 'YEARLY':
      return 'Yearly';
    default:
      return interval;
  }
};

export const getStatusPillClass = (status: PlanStatus) => {
  return status === 'ACTIVE'
    ? 'status-pill status-pill-available'
    : 'status-pill status-pill-unavailable';
};

export const formatStatus = (status: PlanStatus) => {
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'INACTIVE':
      return 'Inactive';
    default:
      return status;
  }
};
