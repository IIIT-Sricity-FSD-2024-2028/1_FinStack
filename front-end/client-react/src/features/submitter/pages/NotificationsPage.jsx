import { useState } from "react";
import { submitterApi } from "../api/submitterApi";
import { useSubmitter } from "../SubmitterContext";
import { timeAgo } from "../utils";
import { Icon } from "../components/Icons";
import { Toast } from "../components/PageBits";
import ResourceState from "../components/ResourceState";

export default function NotificationsPage() {
  const { notifications, notificationState, refreshNotifications } =
    useSubmitter();
  const [toast, setToast] = useState(null),
    [busy, setBusy] = useState(false);
  const unread = notifications.filter((item) => item.unread);
  const act = async (action, message) => {
    setBusy(true);
    try {
      await action();
      await refreshNotifications();
      if (message) setToast({ message });
    } catch (error) {
      setToast({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="dashboard-head">
        <div>
          <h1>Notifications</h1>
          <p className="text-text-muted mt-1">
            Updates from your real expense workflow
          </p>
        </div>
        <div className="react-notification-actions">
          <span>{unread.length} unread</span>
          <button
            className="btn btn-outline"
            type="button"
            disabled={busy || !unread.length}
            onClick={() =>
              act(
                () => submitterApi.markAllNotificationsRead(),
                "All notifications marked read.",
              )
            }
          >
            Mark all read
          </button>
        </div>
      </div>
      <ResourceState
        {...notificationState}
        onRetry={refreshNotifications}
        empty={
          !notifications.length && (
            <>
              <Icon name="bell" size={30} />
              <h3>All caught up</h3>
              <p>No notifications yet.</p>
            </>
          )
        }
      >
        <div className="react-notifications-container">
          {notifications.map((item) => (
            <article
              className={`react-notification-row${item.unread ? " unread" : ""}`}
              key={item.id}
            >
              <div className="react-notification-icon">
                <Icon name="bell" size={20} />
              </div>
              <div className="react-notification-body">
                <div
                  className={`react-notification-title${item.unread ? "" : " read"}`}
                >
                  <p>{item.title}</p>
                  {item.unread && <span />}
                </div>
                <p className="react-notification-message">{item.message}</p>
                <div className="react-notification-meta">
                  <small>{timeAgo(item.createdAt)}</small>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      act(() =>
                        item.unread
                          ? submitterApi.markNotificationRead(item.id)
                          : submitterApi.markNotificationUnread(item.id),
                      )
                    }
                  >
                    {item.unread ? "Mark read" : "Mark unread"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      act(
                        () => submitterApi.deleteNotification(item.id),
                        "Notification dismissed.",
                      )
                    }
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </ResourceState>
      <Toast {...toast} onClose={() => setToast(null)} />
    </>
  );
}
