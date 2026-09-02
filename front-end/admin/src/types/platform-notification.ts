export interface PlatformNotification {
  id: string;
  recipientStaffId: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  readAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformNotificationListResponse {
  items: PlatformNotification[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PlatformNotificationListQuery {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  sortBy?: "createdAt";
  order?: "asc" | "desc";
}

export interface UnreadNotificationCount {
  unreadCount: number;
}
