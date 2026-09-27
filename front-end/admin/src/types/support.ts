import type { Organization, OrganizationStatus } from './organization';

export type TicketStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_CUSTOMER'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type TicketCategory =
  | 'ACCOUNT'
  | 'BILLING'
  | 'SUBSCRIPTION'
  | 'TECHNICAL'
  | 'EXPENSE_MODULE'
  | 'PAYMENT'
  | 'RECONCILIATION'
  | 'COMPLIANCE'
  | 'OTHER';

export type TicketMessageAuthorType = 'TENANT_USER' | 'PLATFORM_STAFF';

export interface SupportTicketOrganization {
  id: string;
  name: string;
  status: OrganizationStatus;
}

export interface SupportStaffRef {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  organizationId: string;
  requesterUserId: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  status: TicketStatus;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  organization: SupportTicketOrganization | Organization;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  authorType: TicketMessageAuthorType;
  authorUserId: string | null;
  authorStaffId: string | null;
  message: string;
  createdAt: string;
  authorStaff: SupportStaffRef | null;
}

export interface TicketInternalNote {
  id: string;
  ticketId: string;
  staffId: string;
  note: string;
  createdAt: string;
  staff: SupportStaffRef;
}

export interface TicketStatusHistory {
  id: string;
  ticketId: string;
  previousStatus: TicketStatus | null;
  newStatus: TicketStatus;
  changedByStaffId: string | null;
  changedByUserId: string | null;
  note: string | null;
  createdAt: string;
  changedByStaff: SupportStaffRef | null;
}

export interface SupportTicketDetail extends SupportTicket {
  messages: TicketMessage[];
  internalNotes: TicketInternalNote[];
  statusHistory: TicketStatusHistory[];
}

export interface SupportTicketListResponse {
  items: SupportTicket[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SupportTicketListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: TicketStatus | '';
  priority?: TicketPriority | '';
  category?: TicketCategory | '';
  organizationId?: string;
  sortBy?: 'ticketNumber' | 'status' | 'priority' | 'createdAt' | 'updatedAt';
  order?: 'asc' | 'desc';
}

export interface SupportTicketPayload {
  organizationId: string;
  requesterUserId?: string;
  requesterName?: string;
  requesterEmail?: string;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
}

export interface SupportTicketUpdatePayload {
  requesterName?: string;
  requesterEmail?: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  subject?: string;
  description?: string;
}
