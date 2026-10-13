import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { clientApi } from "../../adapters/clientApi";
import { tenantSession } from "../../adapters/tenantSession";
import { Link } from "react-router-dom";
import { tenantAudit } from "../../adapters/tenantAudit";
import { useAsyncResource } from "../../hooks/useAsyncResource";
const loadAlerts = async () => {
  const pages = await Promise.all(
    ["danger", "warning"].map((type) =>
      clientApi.request(
        `/api/v1/tenant/expenses/notifications/page?page=1&pageSize=5&type=${type}`,
      ),
    ),
  );
  return pages
    .flatMap((page) => page.items)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 5);
};
const recentEvents = () => tenantAudit.list({ page: 1, pageSize: 5 });

function formatMoney(amount, currency) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return "Not available";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(numericAmount);
  } catch {
    return `${currency || ""} ${amount}`.trim();
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatBillingInterval(interval) {
  if (interval === "MONTHLY") return "month";
  if (interval === "YEARLY" || interval === "ANNUAL") return "year";
  return String(interval || "recurring").toLowerCase();
}

function MetricCard({ label, value, detail, icon, iconBoxClass }) {
  return (
    <div className="metric-card">
      <div className="metric-heading">
        <div className={`icon-box ${iconBoxClass}`}>
          <Icon name={icon} size={20} />
        </div>
        <div className="metric-label">{label}</div>
      </div>
      <div className="metric-value" title={String(value)}>
        {value}
      </div>
      <p
        style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 12 }}
      >
        {detail}
      </p>
    </div>
  );
}

export function ConfigManagerDashboard() {
  const activity = useAsyncResource(recentEvents);
  const alerts = useAsyncResource(loadAlerts);
  useEffect(() => {
    const refresh = () => {
      activity.refresh();
      alerts.refresh();
      clientApi
        .request("/api/v1/tenant/subscription")
        .then(setSubscription)
        .catch(() => {});
    };
    window.addEventListener("finstack:dashboard-refresh", refresh);
    return () =>
      window.removeEventListener("finstack:dashboard-refresh", refresh);
  }, [activity.refresh, alerts.refresh]);
  const [subscription, setSubscription] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!clientApi.supports("tenantSubscription")) {
      setStatus("unsupported");
      return undefined;
    }
    if (!tenantSession.isAuthenticated()) {
      setStatus("error");
      return undefined;
    }
    let mounted = true;
    clientApi
      .request("/api/v1/tenant/subscription")
      .then((payload) => {
        if (!mounted) return;
        if (payload?.organization && payload?.plan) {
          setSubscription(payload);
          setStatus("success");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        if (mounted) setStatus("error");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    if (!subscription)
      return [
        {
          id: "organization",
          label: "Organization",
          value: "—",
          detail: "",
          icon: "building",
          iconBoxClass: "icon-box-purple",
        },
        {
          id: "status",
          label: "Subscription status",
          value: "—",
          detail: "",
          icon: "file",
          iconBoxClass: "icon-box-cyan",
        },
        {
          id: "price",
          label: "Recurring price",
          value: "—",
          detail: "",
          icon: "check",
          iconBoxClass: "icon-box-green",
        },
        {
          id: "seats",
          label: "Purchased seats",
          value: "—",
          detail: "",
          icon: "users",
          iconBoxClass: "icon-box-cyan",
        },
      ];
    const purchasedSeats = Number(subscription.employeeCount);
    const includedSeats = Number(subscription.plan.includedEmployeeCount);
    const seatsAvailable =
      Number.isFinite(purchasedSeats) && Number.isFinite(includedSeats);
    const period =
      subscription.status === "TRIAL"
        ? subscription.trialEndAt
          ? `Trial ends ${formatDate(subscription.trialEndAt)}`
          : "Trial end not available"
        : subscription.currentPeriodEnd
          ? `Current period ends ${formatDate(subscription.currentPeriodEnd)}`
          : "Billing period end not available";
    return [
      {
        id: "organization",
        label: "Organization",
        value: subscription.organization.name,
        detail: `${subscription.plan.name} plan`,
        icon: "building",
        iconBoxClass: "icon-box-purple",
      },
      {
        id: "status",
        label: "Subscription status",
        value: subscription.status,
        detail: period,
        icon: "file",
        iconBoxClass: "icon-box-cyan",
      },
      {
        id: "price",
        label: "Recurring price",
        value: `${formatMoney(subscription.priceAtSubscription, subscription.currency)} / ${formatBillingInterval(subscription.billingInterval)}`,
        detail: `${subscription.plan.name} recurring total`,
        icon: "check",
        iconBoxClass: "icon-box-green",
      },
      {
        id: "seats",
        label: "Purchased seats",
        value: seatsAvailable ? `${purchasedSeats} purchased` : "Not available",
        detail: seatsAvailable
          ? `${includedSeats} included · ${Math.max(0, purchasedSeats - includedSeats)} additional`
          : "Seat allowance not available",
        icon: "users",
        iconBoxClass: "icon-box-cyan",
      },
    ];
  }, [subscription]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Configuration Manager Dashboard</h1>
          <p>Your organization’s configuration at a glance</p>
        </div>
      </div>
      <section className="card dashboard-quick-actions">
        <h2>Quick actions</h2>
        <div className="action-row">
          <Link className="btn btn-primary" to="/configuration/manage-users">
            Manage users & imports
          </Link>
          <Link
            className="btn btn-secondary"
            to="/configuration/expense-categories"
          >
            Configure categories
          </Link>
          <Link
            className="btn btn-secondary"
            to="/configuration/expense-policies"
          >
            Configure policies
          </Link>
          <Link
            className="btn btn-secondary"
            to="/configuration/user-hierarchy"
          >
            View hierarchy
          </Link>
        </div>
      </section>
      {status !== "success" && (
        <p
          role={status === "error" ? "alert" : "status"}
          style={{ gridColumn: "1 / -1", color: "var(--text-secondary)" }}
        >
          {status === "loading"
            ? "Loading subscription details…"
            : status === "unsupported"
              ? "Subscription details are not available from the current client API."
              : "Subscription details are unavailable. Please refresh the page."}
        </p>
      )}
      <div className="dashboard-metrics">
        {status === "success" &&
          metrics.map((metric) => (
            <MetricCard
              key={metric.id}
              {...metric}
              value={
                metric.id === "status"
                  ? metric.value.replaceAll("_", " ")
                  : metric.value
              }
            />
          ))}
      </div>
      <section className="card restored-settings-card">
        <h2>Pending Account Requests</h2>
        <p>
          Provision employees and review pending credential setup in Manage
          Users.
        </p>
        <Link className="btn btn-secondary" to="/configuration/manage-users">
          Manage accounts
        </Link>
      </section>
      <section className="card restored-settings-card">
        <h2>Expense alerts</h2>
        {alerts.status === "loading" ? (
          <p role="status">Loading alerts...</p>
        ) : alerts.status === "error" ? (
          <div role="alert">
            <p>Alerts could not be loaded.</p>
            <button className="btn btn-secondary" onClick={alerts.refresh}>
              Retry alerts
            </button>
          </div>
        ) : alerts.data.length ? (
          <ul>
            {alerts.data.map((alert) => (
              <li key={alert.id}>
                <span
                  className={`badge badge-${alert.type === "danger" ? "red" : "orange"}`}
                >
                  {alert.type === "danger" ? "Alert" : "Warning"}
                </span>
                <strong>{alert.title}</strong>
                <p>{alert.message}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No current alerts for your account.</p>
        )}
        <Link to="/configuration/notifications">View notifications</Link>
      </section>
      <section className="card recent-activity">
        <h2>Recent activity</h2>
        <p>Latest activity in your organization</p>
        {activity.status === "loading" && (
          <p role="status">Loading recent events…</p>
        )}
        {activity.status === "error" && (
          <div role="alert">
            <p>Recent events could not be loaded.</p>
            <button className="btn btn-secondary" onClick={activity.refresh}>
              Retry activity
            </button>
          </div>
        )}
        {activity.status === "success" &&
          (activity.data.items.length ? (
            <ul>
              {activity.data.items.map((event) => (
                <li key={event.id}>
                  <strong>{event.eventCode.replaceAll("_", " ")}</strong>
                  <p>
                    {event.actorName} · {event.targetType} · {event.outcome}
                  </p>
                  <time>{new Date(event.occurredAt).toLocaleString()}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p>No configuration events recorded yet.</p>
          ))}
        <div className="action-row">
          <Link to="/configuration/audit-logs">View all audit events →</Link>
        </div>
      </section>
    </>
  );
}
