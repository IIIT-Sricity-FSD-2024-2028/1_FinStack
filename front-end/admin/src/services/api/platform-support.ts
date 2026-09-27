import type {
  SupportTicketDetail,
  SupportTicketListQuery,
  SupportTicketListResponse,
  SupportTicketPayload,
  SupportTicketUpdatePayload,
  TicketStatus,
} from '../../types/support';
import { apiRequest } from './client';

function queryString(query: SupportTicketListQuery): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

export function getSupportTickets(
  query: SupportTicketListQuery,
  signal?: AbortSignal,
) {
  return apiRequest<SupportTicketListResponse>(
    `/support/tickets${queryString(query)}`,
    { signal },
  );
}

export function getSupportTicket(id: string, signal?: AbortSignal) {
  return apiRequest<SupportTicketDetail>(`/support/tickets/${id}`, { signal });
}

export function createSupportTicket(payload: SupportTicketPayload) {
  return apiRequest<SupportTicketDetail>('/support/tickets', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateSupportTicket(
  id: string,
  payload: SupportTicketUpdatePayload,
) {
  return apiRequest<SupportTicketDetail>(`/support/tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function replyToSupportTicket(id: string, message: string) {
  return apiRequest<SupportTicketDetail>(`/support/tickets/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export function addSupportTicketInternalNote(id: string, note: string) {
  return apiRequest<SupportTicketDetail>(
    `/support/tickets/${id}/internal-notes`,
    {
      method: 'POST',
      body: JSON.stringify({ note }),
    },
  );
}

export function transitionSupportTicketStatus(
  id: string,
  status: TicketStatus,
  note?: string,
) {
  return apiRequest<SupportTicketDetail>(
    `/support/tickets/${id}/status-transitions`,
    {
      method: 'POST',
      body: JSON.stringify({ status, note }),
    },
  );
}
