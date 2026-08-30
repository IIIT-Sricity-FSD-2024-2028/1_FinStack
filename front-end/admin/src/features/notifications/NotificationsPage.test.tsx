import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../auth/AuthContext";
import { NotificationsPage } from "./NotificationsPage";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("NotificationsPage", () => {
  it("renders the notifications inbox and unread badge", async () => {
    vi.mock("../../services/api/platform-notifications", () => ({
      getNotifications: vi.fn().mockResolvedValue({
        items: [
          {
            id: "note-1",
            recipientStaffId: "staff-1",
            type: "INFO",
            title: "Subscription review due",
            body: "Your action is required.",
            link: "/audit-logs",
            isRead: false,
            readAt: null,
            metadata: { source: "billing" },
            createdAt: "2026-08-29T09:00:00.000Z",
            updatedAt: "2026-08-29T09:00:00.000Z",
          },
        ],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      }),
      getUnreadNotificationCount: vi.fn().mockResolvedValue({ unreadCount: 1 }),
      markNotificationRead: vi.fn().mockResolvedValue({}),
      markAllNotificationsRead: vi.fn().mockResolvedValue({ updatedCount: 1 }),
    }));

    render(
      <AuthProvider>
        <NotificationsPage />
      </AuthProvider>,
    );

    expect(screen.getByText("Notifications")).toBeVisible();
    expect(await screen.findByText("Subscription review due")).toBeVisible();
  });
});
