import type { OrganizationStatus } from '../../types/organization';

export const organizationStatuses: OrganizationStatus[] = [
  'PROVISIONING',
  'TRIAL',
  'ACTIVE',
  'SUSPENDED',
  'CANCELLED',
  'ARCHIVED',
];

export function statusLabel(status: OrganizationStatus): string {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

export function statusTone(status: OrganizationStatus): 'available' | 'unavailable' {
  return ['PROVISIONING', 'TRIAL', 'ACTIVE'].includes(status)
    ? 'available'
    : 'unavailable';
}

export function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : 'Not set';
}
