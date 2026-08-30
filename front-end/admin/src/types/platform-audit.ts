export interface AuditLog {
  id: string;
  actorStaffId: string | null;
  eventCode: string;
  category: string;
  resourceType: string;
  resourceId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  requestId: string | null;
  correlationId: string | null;
  createdAt: string;
}

export interface AuditLogListResponse {
  items: AuditLog[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuditLogListQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  resourceType?: string;
  actorStaffId?: string;
  sortBy?: "createdAt";
  order?: "asc" | "desc";
}
