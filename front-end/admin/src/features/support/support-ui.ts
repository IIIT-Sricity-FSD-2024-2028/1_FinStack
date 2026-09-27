import type { TicketCategory, TicketPriority, TicketStatus } from '../../types/support';

export const ticketStatuses: TicketStatus[] = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_FOR_CUSTOMER',
  'ESCALATED',
  'RESOLVED',
  'CLOSED',
];

export const ticketPriorities: TicketPriority[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
];

export const ticketCategories: TicketCategory[] = [
  'ACCOUNT',
  'BILLING',
  'SUBSCRIPTION',
  'TECHNICAL',
  'EXPENSE_MODULE',
  'PAYMENT',
  'RECONCILIATION',
  'COMPLIANCE',
  'OTHER',
];

export function supportLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

export function ticketTone(status: TicketStatus | TicketPriority): string {
  if (status === 'RESOLVED' || status === 'CLOSED' || status === 'LOW') {
    return 'available';
  }
  if (status === 'CRITICAL' || status === 'ESCALATED') {
    return 'unavailable';
  }
  return 'pending';
}

const allowedStatusTransitions: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'ESCALATED', 'RESOLVED'],
  ASSIGNED: ['IN_PROGRESS', 'ESCALATED', 'RESOLVED'],
  IN_PROGRESS: ['WAITING_FOR_CUSTOMER', 'ESCALATED', 'RESOLVED'],
  WAITING_FOR_CUSTOMER: ['IN_PROGRESS', 'ESCALATED', 'RESOLVED'],
  ESCALATED: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
};

export function transitionTargets(status: TicketStatus): TicketStatus[] {
  return allowedStatusTransitions[status];
}

export function transitionPermission(status: TicketStatus): string {
  if (status === 'RESOLVED' || status === 'CLOSED') {
    return 'support.ticket.resolve';
  }
  if (status === 'ESCALATED') {
    return 'support.ticket.escalate';
  }
  return 'support.ticket.update';
}

export function formatDate(value: string | null): string {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
