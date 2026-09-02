import type {
  AuditLog,
  AuditLogListQuery,
  AuditLogListResponse,
} from "../../types/platform-audit";
import { apiRequest } from "./client";

function queryString(query: AuditLogListQuery): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function getAuditLogs(query: AuditLogListQuery, signal?: AbortSignal) {
  return apiRequest<AuditLogListResponse>(`/audit-logs${queryString(query)}`, {
    signal,
  });
}

export function getAuditLog(id: string, signal?: AbortSignal) {
  return apiRequest<AuditLog>(`/audit-logs/${id}`, { signal });
}
