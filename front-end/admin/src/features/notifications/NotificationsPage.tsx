import { useMemo, useState } from "react";
import { PermissionGate } from "../../auth/PermissionGate";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "../../services/api/platform-notifications";
import type { PlatformNotificationListQuery } from "../../types/platform-notification";
import { useNotifications } from "./useNotifications";

const PAGE_LIMIT = 10;

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const query = useMemo<PlatformNotificationListQuery>(
    () => ({
      page,
      limit: PAGE_LIMIT,
      unreadOnly,
      sortBy: "createdAt",
      order: "desc",
    }),
    [page, unreadOnly],
  );

  const { data, error, loading, unreadCount, reload } = useNotifications(query);

  async function handleMarkRead(id: string) {
    await markNotificationRead(id);
    await reload();
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    await reload();
  }

  return (
    <section aria-labelledby="notifications-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Staff inbox</p>
          <h1 id="notifications-title">Notifications</h1>
          <p className="page-description">
            Personal platform updates for your staff account, scoped to the
            current authenticated user.
          </p>
        </div>

        <PermissionGate permission="platform.notification.manage">
          <button
            className="button button-secondary"
            type="button"
            disabled={unreadCount === 0}
            onClick={() => void handleMarkAllRead()}
          >
            Mark all read
          </button>
        </PermissionGate>
      </div>

      <div className="filter-bar">
        <label
          style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
        >
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => {
              setPage(1);
              setUnreadOnly(event.target.checked);
            }}
          />
          <span>Unread only</span>
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <strong>{unreadCount}</strong>
          <span>unread</span>
        </div>
      </div>

      {loading && (
        <div className="state-panel" role="status">
          <span className="loader" aria-hidden="true" />
          Loading notifications...
        </div>
      )}

      {!loading && error && (
        <div className="state-panel state-panel-error" role="alert">
          <div>
            <strong>Notifications unavailable</strong>
            <p>{error}</p>
          </div>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => void reload()}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && data && data.items.length === 0 && (
        <div className="state-panel">
          <div>
            <strong>No notifications found</strong>
            <p>You're all caught up for this view.</p>
          </div>
        </div>
      )}

      {!loading && !error && data && data.items.length > 0 && (
        <>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Title</th>
                  <th>Message</th>
                  <th>Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((notification) => (
                  <tr key={notification.id}>
                    <td>
                      <span
                        className={`status-pill ${notification.isRead ? "status-pill-available" : "status-pill-unavailable"}`}
                      >
                        {notification.isRead ? "Read" : "Unread"}
                      </span>
                    </td>
                    <td>
                      <strong>{notification.title}</strong>
                      <span>{notification.type}</span>
                    </td>
                    <td>{notification.body}</td>
                    <td>{formatDate(notification.createdAt)}</td>
                    <td>
                      {!notification.isRead && (
                        <PermissionGate permission="platform.notification.manage">
                          <button
                            className="button button-secondary button-compact"
                            type="button"
                            onClick={() => void handleMarkRead(notification.id)}
                          >
                            Mark read
                          </button>
                        </PermissionGate>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <span>
              Page {data.page} of {data.totalPages} - {data.total} total
            </span>
            <div>
              <button
                className="button button-secondary button-compact"
                type="button"
                disabled={data.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <button
                className="button button-secondary button-compact"
                type="button"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
