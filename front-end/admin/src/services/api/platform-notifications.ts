import type {
  PlatformNotification,
  PlatformNotificationListQuery,
  PlatformNotificationListResponse,
  UnreadNotificationCount,
} from "../../types/platform-notification";
import { apiRequest } from "./client";

function queryString(query: PlatformNotificationListQuery): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function getNotifications(
  query: PlatformNotificationListQuery,
  signal?: AbortSignal,
) {
  return apiRequest<PlatformNotificationListResponse>(
    `/notifications${queryString(query)}`,
    { signal },
  );
}

export function getUnreadNotificationCount(signal?: AbortSignal) {
  return apiRequest<UnreadNotificationCount>("/notifications/unread-count", {
    signal,
  });
}

export function markNotificationRead(id: string) {
  return apiRequest<PlatformNotification>(`/notifications/${id}/read`, {
    method: "PATCH",
  });
}

export function markAllNotificationsRead() {
  return apiRequest<{ updatedCount: number }>("/notifications/read-all", {
    method: "PATCH",
  });
}
