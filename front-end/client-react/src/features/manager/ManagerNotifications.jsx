import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../../components/OperationalStates";
import { notify } from "../../components/ToastHost";
import { SharedPageHeader } from "../../layouts/TenantAppShell";
import { managerApi } from "./managerApi";

const tabs = [["all", "All"], ["unread", "Unread"], ["read", "Read"]];
function notificationCategory(item) {
  const action = String(item.actionType || "").toLowerCase();
  if (action.includes("reject")) return "rejected";
  if (action.includes("escalat")) return "high-risk";
  if (action.includes("approv")) return "approved";
  if (action.includes("submit") || action.includes("return")) return "pending";
  if (item.type === "danger") return "high-risk";
  if (item.type === "warning") return "pending";
  if (item.type === "success") return "approved";
  return "other";
}

export function ManagerNotifications() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setError("");
    managerApi.notifications(controller.signal)
      .then((result) => { if (!controller.signal.aborted) { setItems(Array.isArray(result) ? result : []); setStatus("success"); } })
      .catch((caught) => { if (!controller.signal.aborted) { setError(caught instanceof Error ? caught.message : "Notifications could not be loaded."); setStatus("error"); } });
    return () => controller.abort();
  }, [revision]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const filtered = useMemo(() => items.filter((item) =>
    (filter === "all" || (filter === "unread" ? item.unread : !item.unread)) &&
    (typeFilter === "all" || notificationCategory(item) === typeFilter),
  ), [items, filter, typeFilter]);

  async function markRead(item) {
    if (busyId || !item.unread) return;
    setBusyId(item.id);
    try {
      await managerApi.markNotificationRead(item.id);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, unread: false, readAt: new Date().toISOString() } : entry));
      window.dispatchEvent(new Event("finstack:manager-notifications-refresh"));
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Notification update failed.", "error"); }
    finally { setBusyId(""); }
  }
  async function markAllRead() {
    if (busyId || !items.some((item) => item.unread)) return;
    setBusyId("all");
    try {
      await managerApi.markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setItems((current) => current.map((item) => item.unread ? { ...item, unread: false, readAt } : item));
      window.dispatchEvent(new Event("finstack:manager-notifications-refresh"));
      notify("All notifications marked as read.", "success");
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Notifications could not be updated.", "error"); }
    finally { setBusyId(""); }
  }
  async function dismiss(item) {
    if (busyId) return;
    setBusyId(item.id);
    try {
      await managerApi.dismissNotification(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      window.dispatchEvent(new Event("finstack:manager-notifications-refresh"));
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Notification could not be dismissed.", "error"); }
    finally { setBusyId(""); }
  }

  const unreadCount = items.filter((item) => item.unread).length;
  return <section className="manager-page">
    <SharedPageHeader title="Notifications" description={`Updates for expenses assigned to your Manager account. ${unreadCount} unread of ${items.length}.`} actions={<div className="manager-actions"><button className="btn btn-secondary" type="button" onClick={refresh}>Refresh</button><button className="btn btn-primary" type="button" disabled={busyId === "all" || unreadCount === 0} onClick={markAllRead}>{busyId === "all" ? "Saving…" : "Mark all read"}</button></div>} />
    <div className="manager-filters"><label>Status<select className="form-input" value={filter} onChange={(event) => setFilter(event.target.value)}>{tabs.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Category<select className="form-input" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All categories</option><option value="pending">Pending</option><option value="high-risk">High risk</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="other">Other</option></select></label><span className="manager-count">Showing {filtered.length} of {items.length}</span></div>
    {status === "loading" ? <LoadingState message="Loading notifications…" /> : status === "error" ? <ErrorState title="Notifications unavailable" description={error} onRetry={refresh} /> : filtered.length === 0 ? <EmptyState title={items.length ? "No matching notifications" : "No notifications"} description={items.length ? "Try changing the notification filters." : "New expense updates will appear here."} /> : <div className="manager-notifications">{filtered.map((item) => <article className={`card manager-notification ${item.unread ? "is-unread" : ""}`} key={item.id}><div><div className="manager-notification-title"><strong>{item.title}</strong><span className="manager-badge">{notificationCategory(item)}</span><span className="manager-badge">{item.unread ? "Unread" : "Read"}</span></div><p>{item.message}</p><small>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</small></div><div className="manager-notification-actions">{item.relatedExpenseId && <Link to={`/manager/expenses/${encodeURIComponent(item.relatedExpenseId)}`}>View expense</Link>}{item.unread && <button className="btn btn-secondary" type="button" disabled={Boolean(busyId)} onClick={() => markRead(item)}>Mark read</button>}<button className="btn btn-secondary" type="button" disabled={Boolean(busyId)} onClick={() => dismiss(item)}>Dismiss</button></div></article>)}</div>}
  </section>;
}
