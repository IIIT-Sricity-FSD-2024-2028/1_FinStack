import { useState } from "react";
import type { NotificationPage } from "../../services/contracts";
import { request } from "../../services/session";
import { useEmployeePage } from "../../hooks/useEmployeePage";
import { ErrorState, LoadingState } from "../../components/OperationalStates";
import { ConfirmDialog } from "../../components/CrudPrimitives";
import {
  CategorySuccessToast as SuccessToast,
  useCategoryToast as useSuccessToast,
} from "./categoryToast";
const NOTIFICATIONS = "/api/v1/tenant/expenses/notifications";
const loadNotifications = (query: object) =>
  request<NotificationPage>(
    `${NOTIFICATIONS}/page?${new URLSearchParams(query as Record<string, string>)}`,
  );
export function NotificationsPage() {
  const { notice, showSuccess } = useSuccessToast();
  const [type, setType] = useState("");
  const [state, setState] = useState("all"),
    [page, setPage] = useState(1),
    [pending, setPending] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const resource = useEmployeePage(loadNotifications, {
    page,
    pageSize: 25,
    state,
    ...(type ? { type } : {}),
  });
  async function act(path: string, method: string) {
    setBusy(true);
    setError("");
    try {
      await request(NOTIFICATIONS + path, { method });
      await resource.refresh();
      setPending(null);
      showSuccess("Notifications updated.", 2000);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Notification update failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SuccessToast notice={pending ? null : notice} />
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p>
            Updates for your account · {resource.data?.unreadCount ?? "—"}{" "}
            unread
          </p>
        </div>
        <button
          className="btn btn-secondary"
          disabled={busy || !resource.data?.unreadCount}
          onClick={() => act("/read-all", "POST")}
        >
          Mark all read
        </button>
      </div>
      <div
        className="notification-tabs"
        role="group"
        aria-label="Notification categories"
      >
        {[
          ["", "All"],
          ["warning", "Warnings"],
          ["danger", "Alerts"],
          ["success", "Success"],
          ["info", "Info"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={`btn btn-secondary ${type === value ? "active" : ""}`}
            aria-pressed={type === value}
            onClick={() => {
              setType(value);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="filters-bar">
        <label>
          Show
          <select
            className="form-input"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All notifications</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </label>
        <button className="btn btn-secondary" onClick={resource.refresh}>
          Refresh
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {resource.status === "loading" && (
        <LoadingState message="Loading notifications…" />
      )}
      {resource.status === "error" && (
        <ErrorState
          description="Notifications could not be loaded."
          onRetry={resource.refresh}
        />
      )}{" "}
      {resource.status === "success" && (
        <>
          <div className="notification-list">
            {resource.data.items.length ? (
              resource.data.items.map((item) => (
                <article
                  key={item.id}
                  data-notification-id={item.id}
                  className="card"
                >
                  <div className="notification-heading">
                    <h2>{item.title}</h2>
                    <span className="badge">
                      {item.unread ? "Unread" : "Read"}
                    </span>
                  </div>
                  <p>{item.message}</p>
                  <time>{new Date(item.createdAt).toLocaleString()}</time>
                  <div className="action-row">
                    <button
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() =>
                        act(
                          `/${item.id}/${item.unread ? "read" : "unread"}`,
                          "PATCH",
                        )
                      }
                    >
                      Mark {item.unread ? "read" : "unread"}
                    </button>
                    <button
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => setPending(item.id)}
                    >
                      Dismiss
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="card">
                <p>No notifications match this filter.</p>
              </div>
            )}
          </div>
          <div className="action-row">
            <button
              className="btn btn-secondary"
              disabled={page === 1}
              onClick={() => setPage((v) => v - 1)}
            >
              Previous
            </button>
            <span>
              Page {page} of {Math.max(1, resource.data.totalPages)}
            </span>
            <button
              className="btn btn-secondary"
              disabled={page >= resource.data.totalPages}
              onClick={() => setPage((v) => v + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
      <ConfirmDialog
        open={Boolean(pending)}
        title="Dismiss notification?"
        description="This notification will be removed from your inbox."
        confirmLabel="Dismiss"
        confirmingLabel="Dismissing…"
        submitting={busy}
        onCancel={() => setPending(null)}
        onConfirm={() => act(`/${pending}`, "DELETE")}
      />
    </>
  );
}
