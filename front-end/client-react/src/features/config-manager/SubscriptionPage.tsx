import { Link } from "react-router-dom";
import {
  formatPreferredDate,
  preferredMoney,
} from "../../services/preferences";
import { useEffect, useState } from "react";
import {
  billing,
  payInvoice,
  type Invoice,
  type Selection,
} from "../../services/tenantBilling";
import type { PublicPlan, Quote } from "../../services/contracts";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from "../../components/OperationalStates";
import { CrudModal } from "../../components/CrudPrimitives";
import { Table } from "../../components/Table";
const money = preferredMoney;
const date = formatPreferredDate;
export function SubscriptionPage() {
  const resource = useAsyncResource(billing.load);
  const [dialog, setDialog] = useState<"change" | "cancel" | null>(null);
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [selection, setSelection] = useState<Selection>({
    planId: "",
    employeeCount: 1,
    featureIds: [],
  });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [reason, setReason] = useState("");
  useEffect(() => {
    if (dialog !== "change") return;
    let active = true;
    billing
      .plans()
      .then((data) => {
        if (active) setPlans(data.items);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [dialog]);
  useEffect(() => {
    setQuote(null);
    if (dialog !== "change" || !selection.planId || selection.employeeCount < 1)
      return;
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        billing
          .quote(selection, controller.signal)
          .then(setQuote)
          .catch((error) => {
            if (!controller.signal.aborted) setError(error.message);
          }),
      250,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [dialog, selection]);
  async function perform(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setDialog(null);
      await resource.refresh();
      setNotice(message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  function openChange() {
    if (!resource.data) return;
    setSelection({
      planId: resource.data.subscription.plan.id,
      employeeCount: resource.data.subscription.employeeCount,
      featureIds: resource.data.subscription.selectedAddOns.map(
        (item) => item.featureId,
      ),
    });
    setError("");
    setPlans(null);
    setDialog("change");
  }
  const pay = (invoice: Invoice) =>
    perform(() => payInvoice(invoice), "Payment verified by the backend.");
  const selectedPlan = plans?.find((plan) => plan.id === selection.planId);
  return (
    <div className="billing-page">
      <div className="page-header">
        <div>
          <h1>Subscription &amp; Billing</h1>
          <p>Plan, employee capacity, invoices and payment history.</p>
        </div>
      </div>
      <Link to="/configuration/help?from=subscription">Help &amp; Support</Link>
      {notice && (
        <p role="status" className="success-banner">
          {notice}
        </p>
      )}
      {error && !dialog && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {resource.status === "loading" && <LoadingState />}
      {resource.status === "error" && (
        <ErrorState
          description={resource.error.message}
          onRetry={resource.refresh}
        />
      )}
      {resource.status === "success" && (
        <>
          <section className="card">
            <h2>{resource.data.subscription.plan.name}</h2>
            <p>
              <span className="badge">
                {resource.data.subscription.status
                  .toLowerCase()
                  .replaceAll("_", " ")}
              </span>{" "}
              ·{" "}
              {money(
                resource.data.subscription.priceAtSubscription,
                resource.data.subscription.currency,
              )}{" "}
              / {resource.data.subscription.billingInterval.toLowerCase()}
            </p>
            <p>
              Current period:{" "}
              {date(resource.data.subscription.currentPeriodStart)} –{" "}
              {date(resource.data.subscription.currentPeriodEnd)}
            </p>
            <p>
              {resource.data.subscription.employeeCount} purchased seats ·{" "}
              {resource.data.subscription.plan.includedEmployeeCount} included
              seats
            </p>
            {resource.data.subscription.status === "CANCELLED" && (
              <p>
                Plan changes are unavailable for a cancelled subscription.
                Contact your authorized platform representative to review
                reactivation.
              </p>
            )}
            <div className="form-actions">
              <button
                className="btn btn-primary"
                disabled={
                  busy || resource.data.subscription.status === "CANCELLED"
                }
                onClick={openChange}
              >
                Change Plan
              </button>
              {resource.data.subscription.status !== "CANCELLED" && (
                <button
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setDialog("cancel");
                  }}
                >
                  Cancel subscription
                </button>
              )}
            </div>
          </section>
          <section className="card">
            <h2>Pricing breakdown</h2>
            <dl>
              <dt>Base plan</dt>
              <dd>
                {money(
                  resource.data.subscription.plan.basePrice,
                  resource.data.subscription.currency,
                )}
              </dd>
              <dt>Additional employees</dt>
              <dd>
                {money(
                  resource.data.subscription.employeeAmount,
                  resource.data.subscription.currency,
                )}
              </dd>
              <dt>Feature add-ons</dt>
              <dd>
                {money(
                  resource.data.subscription.featureAmount,
                  resource.data.subscription.currency,
                )}
              </dd>
              <dt>Total recurring price</dt>
              <dd>
                {money(
                  resource.data.subscription.priceAtSubscription,
                  resource.data.subscription.currency,
                )}
              </dd>
            </dl>
          </section>
          <section className="card">
            <h2>Features</h2>
            <h3>Included features</h3>
            {resource.data.subscription.plan.features
              .filter((item) => !item.isAddOn)
              .map((item) => (
                <p key={item.id}>{item.name}</p>
              ))}
            {!resource.data.subscription.plan.features.some(
              (item) => !item.isAddOn,
            ) && <p>No included features listed.</p>}
            <h3>Selected paid add-ons</h3>
            {resource.data.subscription.selectedAddOns.map((item) => (
              <p key={item.featureId}>
                {item.name} ·{" "}
                {money(item.amount, resource.data!.subscription.currency)}
              </p>
            ))}
            {!resource.data.subscription.selectedAddOns.length && (
              <p>No paid add-ons selected.</p>
            )}
          </section>
          <section className="card">
            <h2>Invoices</h2>
            {!resource.data.invoices.length ? (
              <EmptyState
                title="No invoices yet"
                description="Invoices will appear here when issued."
              />
            ) : (
              <div className="table-container">
                <Table>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Issued / due</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.data.invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>{invoice.invoiceNumber}</td>
                        <td>
                          {date(invoice.issueDate)} / {date(invoice.dueDate)}
                        </td>
                        <td>{money(invoice.totalAmount, invoice.currency)}</td>
                        <td>{invoice.status}</td>
                        <td>
                          {["PENDING", "OVERDUE"].includes(invoice.status) && (
                            <button
                              className="btn btn-secondary"
                              disabled={busy}
                              onClick={() => pay(invoice)}
                            >
                              Pay invoice {invoice.invoiceNumber}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </section>
          <section className="card">
            <h2>Payment history</h2>
            {!resource.data.payments.length ? (
              <EmptyState
                title="No payments yet"
                description="Verified subscription payments will appear here."
              />
            ) : (
              <div className="table-container">
                <Table>
                  <thead>
                    <tr>
                      <th>Provider / reference</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.data.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>
                          {payment.provider}
                          <br />
                          {payment.providerReference}
                        </td>
                        <td>{money(payment.amount, payment.currency)}</td>
                        <td>{payment.status}</td>
                        <td>
                          {date(
                            payment.paidAt ||
                              payment.failedAt ||
                              payment.createdAt,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </section>
        </>
      )}
      <CrudModal
        open={dialog === "change"}
        title="Change subscription plan"
        onClose={() => setDialog(null)}
        submitting={busy}
        submitDisabled={!quote}
        submitLabel="Confirm plan change"
        onSubmit={(event: React.FormEvent) => {
          event.preventDefault();
          if (quote)
            void perform(
              () => billing.change(selection),
              "Plan change recorded. Any required invoice is shown below; payment is verified separately.",
            );
        }}
      >
        {error && <p role="alert">{error}</p>}
        {!plans ? (
          <LoadingState />
        ) : !plans.length ? (
          <p>No active plans available.</p>
        ) : (
          <>
            <label className="settings-field">
              <span className="form-label">Plan</span>
              <select
                className="form-input"
                value={selection.planId}
                onChange={(event) => {
                  setError("");
                  setSelection({
                    ...selection,
                    planId: event.target.value,
                    featureIds: [],
                  });
                }}
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-field">
              <span className="form-label">Employee seats</span>
              <input
                className="form-input"
                type="number"
                min="1"
                step="1"
                required
                value={selection.employeeCount}
                onChange={(event) => {
                  setError("");
                  setSelection({
                    ...selection,
                    employeeCount: Number(event.target.value),
                  });
                }}
              />
            </label>
            {selectedPlan?.features
              .filter((item) => item.isAddOn)
              .map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={selection.featureIds.includes(item.id)}
                    onChange={(event) =>
                      setSelection({
                        ...selection,
                        featureIds: event.target.checked
                          ? [...selection.featureIds, item.id]
                          : selection.featureIds.filter((id) => id !== item.id),
                      })
                    }
                  />
                  {item.name} · {money(item.addOnPrice, selectedPlan.currency)}
                </label>
              ))}
            <p role="status">
              {quote
                ? `Quoted recurring total: ${money(quote.totalAmount, quote.currency)} / ${quote.billingInterval.toLowerCase()}. Confirm to request this change.`
                : "Calculating current quote…"}
            </p>
          </>
        )}
      </CrudModal>
      <CrudModal
        open={dialog === "cancel"}
        title="Cancel subscription"
        onClose={() => setDialog(null)}
        submitting={busy}
        submitLabel="Confirm cancellation"
        onSubmit={(event: React.FormEvent) => {
          event.preventDefault();
          void perform(
            () => billing.cancel(reason),
            "Subscription cancelled. Organization records are preserved.",
          );
        }}
      >
        <p>
          This changes the organization subscription lifecycle. Review your
          billing obligations before confirming.
        </p>
        <label className="settings-field">
          <span className="form-label">Cancellation reason</span>
          <textarea
            className="form-input"
            rows={4}
            required
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
      </CrudModal>
    </div>
  );
}
