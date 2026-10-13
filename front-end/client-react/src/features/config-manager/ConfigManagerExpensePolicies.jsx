import { useEffect, useState } from "react";
import {
  ConfigurationTemplatePicker,
  TemplateMobileNavigation,
} from "./ConfigurationTemplatePicker";
import {
  configManagerResources,
  mutateAndRefresh,
} from "../../adapters/configManagerResources";
import {
  ConfirmDialog,
  CrudModal,
  StatusBadge,
  ToggleSwitch,
} from "../../components/CrudPrimitives";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/OperationalStates";
import { Table } from "../../components/Table";
import { Icon } from "../../components/Icon";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { CategorySuccessToast, useCategoryToast } from "./categoryToast";
import { paginateCategories } from "./categoryLifecycle";
import {
  APPROVAL_OPTIONS,
  APPROVAL_NOTE,
  moneyValue,
  formatPolicyMoney,
  approvalLabel,
  filterPolicies,
  POLICY_AMOUNT_ERROR,
  policyFailureMessage,
} from "./policyConfiguration";
import "./category-lifecycle.css";
import "./policy-configuration.css";
const loadPolicies = () => configManagerResources.policies.list();
const loadCategories = () => configManagerResources.categories.list();
const loadCatalog = () => configManagerResources.templates.list();
const blank = {
  name: "",
  categoryId: "",
  maxAmount: "",
  description: "",
  currency: "",
  approval: "Manager + Finance",
  requiresApproval: true,
  receiptRequired: true,
};
function PolicyFields({
  form,
  setForm,
  categories,
  error,
  defaultCurrency,
  amountError,
  setAmountError,
  clearError,
}) {
  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    clearError();
  };
  const approval =
    form.requiresApproval === false ? "Auto Approved" : form.approval;
  return (
    <>
      <label>
        Policy name
        <input
          id="policy-name"
          className="form-input"
          required
          maxLength={100}
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
        />
        <small>
          Required; up to 100 characters. Surrounding spaces are removed.
        </small>
      </label>
      <label>
        Applicable category
        <select
          id="policy-category"
          className="form-input"
          required
          value={form.categoryId}
          onChange={(e) => update("categoryId", e.target.value)}
        >
          <option value="">Select an active category</option>
          {categories
            .filter((c) => c.status === "Active" || c.id === form.categoryId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.status !== "Active"
                  ? " (inactive; existing link retained)"
                  : ""}
              </option>
            ))}
        </select>
      </label>
      <label>
        Per-expense spending cap ({form.currency})
        <input
          id="policy-amount"
          type="text"
          inputMode="decimal"
          className="form-input"
          required
          maxLength={64}
          placeholder="e.g. 7500.50"
          aria-invalid={Boolean(amountError)}
          aria-describedby="policy-amount-help policy-amount-error"
          onInvalid={(event) => {
            event.preventDefault();
            setAmountError(POLICY_AMOUNT_ERROR);
            event.currentTarget.focus();
          }}
          value={form.maxAmount}
          onChange={(e) => {
            update("maxAmount", e.target.value);
            if (moneyValue(e.target.value)) setAmountError("");
          }}
        />
        <small id="policy-amount-help">
          Positive amount; up to two decimal places. No currency conversion.
        </small>
        {amountError && (
          <small id="policy-amount-error" className="policy-error" role="alert">
            {amountError}
          </small>
        )}
      </label>
      <label>
        Currency
        <input
          id="policy-currency"
          className="form-input"
          required
          pattern="[A-Z]{3}"
          maxLength={3}
          value={form.currency}
          onChange={(e) => update("currency", e.target.value.toUpperCase())}
        />
        <small>
          Organization default: {defaultCurrency}. Change only when a different
          currency is intended.
        </small>
      </label>
      <label>
        Approval configuration
        <select
          id="policy-approval"
          className="form-input"
          value={approval}
          onChange={(e) =>
            setForm((current) => ({
              ...current,
              approval: e.target.value,
              requiresApproval: e.target.value !== "Auto Approved",
            }))
          }
        >
          {APPROVAL_OPTIONS.map((o) => (
            <option key={o.levels} value={o.value}>
              {o.levels} — {o.label}
            </option>
          ))}
          {!APPROVAL_OPTIONS.some((o) => o.value === approval) && (
            <option value={approval}>
              {approval} (existing configuration)
            </option>
          )}
        </select>
      </label>
      <small className="policy-approval-help">
        Manager means the employee's reporting manager. {APPROVAL_NOTE}
      </small>
      <div className="policy-receipt">
        <span>Receipt required</span>
        <ToggleSwitch
          checked={form.receiptRequired}
          label="Receipt required"
          onChange={(v) => update("receiptRequired", v)}
        />
      </div>
      <label>
        Description (optional)
        <textarea
          id="policy-description"
          className="form-input"
          rows={3}
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
        />
      </label>
      {form.id && (
        <p>
          Current status: <StatusBadge status={form.status} /> Use the confirmed
          lifecycle action in the list to change it.
        </p>
      )}
      {error && (
        <p className="policy-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
export function ConfigManagerExpensePolicies() {
  const policyResource = useAsyncResource(loadPolicies),
    categoryResource = useAsyncResource(loadCategories),
    catalogResource = useAsyncResource(loadCatalog);
  const resources = [policyResource, categoryResource, catalogResource];
  const status = resources.some((r) => r.status === "error")
    ? "error"
    : resources.some((r) => r.status === "loading")
      ? "loading"
      : "success";
  const categories = categoryResource.data || [],
    policies = policyResource.data || [],
    defaultCurrency = catalogResource.data?.defaultCurrency || "INR";
  const [templatesOpen, setTemplatesOpen] = useState(false),
    [search, setSearch] = useState(""),
    [categoryFilter, setCategoryFilter] = useState("all"),
    [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1),
    [form, setForm] = useState(null),
    [deleting, setDeleting] = useState(null),
    [lifecycle, setLifecycle] = useState(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [amountError, setAmountError] = useState("");
  const { notice, showSuccess } = useCategoryToast();
  const filtered = filterPolicies(
      policies,
      search,
      statusFilter,
      categoryFilter,
    ),
    paged = paginateCategories(filtered, page, 10);
  useEffect(() => {
    setPage((current) => Math.min(current, paged.page));
  }, [paged.page]);
  const categoryName = (id) =>
    categories.find((c) => c.id === id)?.name || "Category unavailable";
  async function mutate(operation, message, close) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await mutateAndRefresh(operation, policyResource.refresh);
      if (result == null || result === false)
        throw Error("The change could not be saved.");
      setError("");
      close();
      setPage(1);
      showSuccess(message, 2000);
    } catch (cause) {
      const message = policyFailureMessage(cause.message);
      if (form && message === POLICY_AMOUNT_ERROR) setAmountError(message);
      else setError(message);
    } finally {
      setBusy(false);
    }
  }
  function save(event) {
    event.preventDefault();
    const previous = policies.find((p) => p.id === form.id),
      unchanged =
        previous &&
        String(form.maxAmount) ===
          String(previous.maxAmountExact ?? previous.maxAmount),
      amount = moneyValue(form.maxAmount);
    if (!form.name.trim() || form.name.trim().length > 100)
      return setError("Policy name must contain 1 to 100 characters.");
    if (!form.categoryId) return setError("Select an active category.");
    if (!amount && !unchanged) return setAmountError(POLICY_AMOUNT_ERROR);
    if (!/^[A-Z]{3}$/.test(form.currency))
      return setError("Currency must be a three-letter code.");
    const payload = {
      name: form.name.trim(),
      categoryId: form.categoryId,
      description: form.description.trim(),
      currency: form.currency,
      approval: form.approval,
      requiresApproval: form.requiresApproval,
      receiptRequired: form.receiptRequired,
      ...(!unchanged ? { maxAmount: amount } : {}),
    };
    mutate(
      () =>
        previous
          ? configManagerResources.policies.update(form.id, payload, previous)
          : configManagerResources.policies.create(payload),
      previous ? "Policy changes saved." : "Policy created and saved.",
      () => setForm(null),
    );
  }
  async function activated(_result, summary) {
    const updated = await policyResource.refresh();
    if (!updated)
      throw Error(
        "Activation completed but the list could not be refreshed. Refresh or retry safely; existing policies will be skipped.",
      );
    setTemplatesOpen(false);
    setPage(1);
    showSuccess(summary, 3000);
  }
  return (
    <div className="policy-page">
      <TemplateMobileNavigation />
      <CategorySuccessToast notice={notice} />
      <header className="policy-header">
        <div>
          <h1>Expense Policies</h1>
          <p>
            Configure spending caps, receipt requirements and intended reviews.
          </p>
        </div>
        <div className="policy-actions">
          <button
            className="btn btn-secondary"
            disabled={status !== "success"}
            onClick={() => setTemplatesOpen((o) => !o)}
          >
            {templatesOpen
              ? "Close policy templates"
              : "Browse policy templates"}
          </button>
          <button
            className="btn btn-primary"
            disabled={status !== "success"}
            onClick={() => {
              setError("");
              setAmountError("");
              setForm({
                ...blank,
                currency: defaultCurrency,
                categoryId:
                  categories.find((c) => c.status === "Active")?.id || "",
              });
            }}
          >
            Add Policy
          </button>
        </div>
      </header>
      {error && !form && (
        <div role="alert" className="policy-error">
          {error}{" "}
          <button className="btn btn-secondary" onClick={() => setError("")}>
            Dismiss error
          </button>
        </div>
      )}
      {status === "success" && !policies.length && (
        <div className="card policy-onboarding">
          <h2>Start with predefined policies</h2>
          <p>
            Select common templates, enter your organization's own caps, then
            review them together. Default currency: {defaultCurrency}.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setTemplatesOpen(true)}
          >
            Choose policy templates
          </button>
        </div>
      )}
      {templatesOpen && catalogResource.data && categoryResource.data && (
        <ConfigurationTemplatePicker
          mode="policies"
          records={policies}
          categories={categories}
          catalogData={catalogResource.data}
          onRefreshCategories={categoryResource.refresh}
          onActivated={activated}
          onClose={() => setTemplatesOpen(false)}
        />
      )}
      <div className="filters-bar">
        <input
          className="form-input"
          type="search"
          aria-label="Search policies"
          placeholder="Search policy names"
          maxLength={120}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="form-input"
          aria-label="Filter policy category"
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="form-input"
          aria-label="Filter policy status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All Status</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
      </div>
      <div className="card policy-table">
        {status === "loading" && (
          <LoadingState message="Loading expense policies…" />
        )}
        {status === "error" && (
          <ErrorState
            description="Policies, categories or currency defaults could not be loaded."
            onRetry={() =>
              resources
                .filter((r) => r.status === "error")
                .forEach((r) => r.refresh())
            }
          />
        )}
        {status === "success" &&
          (!filtered.length ? (
            <>
              <EmptyState
                title={
                  policies.length
                    ? "No policies match these filters"
                    : "No policies configured yet"
                }
                description="Choose templates or add a custom policy. Matching active categories are required."
              />
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("all");
                  setStatusFilter("all");
                }}
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <thead>
                    <tr>
                      <th>Policy name</th>
                      <th>Category</th>
                      <th>Per-expense cap</th>
                      <th>Review configuration</th>
                      <th>Receipt</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.items.map((p) => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>{categoryName(p.categoryId)}</td>
                        <td>
                          {formatPolicyMoney(
                            p.maxAmountExact ?? p.maxAmount,
                            p.currency,
                          )}
                        </td>
                        <td>{approvalLabel(p)}</td>
                        <td>{p.receiptRequired ? "Required" : "Optional"}</td>
                        <td>
                          <StatusBadge status={p.status} />
                        </td>
                        <td>
                          <div className="policy-row-actions">
                            <button
                              className="btn btn-secondary"
                              disabled={busy}
                              aria-label={"Edit " + p.name}
                              onClick={() => {
                                setError("");
                                setAmountError("");
                                setForm({
                                  ...p,
                                  maxAmount: String(
                                    p.maxAmountExact ?? p.maxAmount,
                                  ),
                                  description: p.description || "",
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-secondary"
                              disabled={busy}
                              aria-label={
                                (p.status === "Active"
                                  ? "Deactivate "
                                  : "Reactivate ") + p.name
                              }
                              onClick={() => {
                                setError("");
                                setLifecycle(p);
                              }}
                            >
                              {p.status === "Active"
                                ? "Deactivate"
                                : "Reactivate"}
                            </button>
                            <button
                              className="btn btn-outline-red"
                              disabled={busy}
                              aria-label={"Delete " + p.name}
                              onClick={() => {
                                setError("");
                                setDeleting(p);
                              }}
                            >
                              <Icon name="trash" size={15} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <div className="pagination">
                <span role="status">
                  Page {paged.page} of {paged.pageCount} · {filtered.length}{" "}
                  policies
                </span>
                <div className="policy-actions">
                  <button
                    className="btn btn-secondary"
                    disabled={paged.page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={paged.page === paged.pageCount}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ))}
      </div>
      <div className="policy-modal-scope">
        <CrudModal
          open={Boolean(form)}
          title={form?.id ? "Edit Policy" : "Add Policy"}
          submitLabel={form?.id ? "Update Policy" : "Save Policy"}
          maxWidth={620}
          submitting={busy}
          onClose={() => {
            setForm(null);
            setError("");
          }}
          onSubmit={save}
        >
          {form && (
            <PolicyFields
              form={form}
              setForm={setForm}
              categories={categories}
              error={error}
              defaultCurrency={defaultCurrency}
              amountError={amountError}
              setAmountError={setAmountError}
              clearError={() => setError("")}
            />
          )}
        </CrudModal>
      </div>
      <ConfirmDialog
        open={Boolean(lifecycle)}
        title={
          lifecycle?.status === "Active"
            ? "Deactivate policy?"
            : "Reactivate policy?"
        }
        confirmLabel={
          lifecycle?.status === "Active"
            ? "Deactivate policy"
            : "Reactivate policy"
        }
        description={
          lifecycle
            ? "Change the status of “" +
              lifecycle.name +
              "”? Its ID, category, settings and history remain unchanged. Reactivation requires an active linked category."
            : ""
        }
        tone={lifecycle?.status === "Active" ? "danger" : "primary"}
        submitting={busy}
        onCancel={() => setLifecycle(null)}
        onConfirm={() =>
          mutate(
            () =>
              configManagerResources.policies.update(
                lifecycle.id,
                {
                  status: lifecycle.status === "Active" ? "Inactive" : "Active",
                },
                lifecycle,
              ),
            lifecycle.status === "Active"
              ? "Policy deactivated."
              : "Policy reactivated.",
            () => setLifecycle(null),
          )
        }
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete policy?"
        confirmLabel="Delete policy"
        description={
          deleting
            ? "Delete “" +
              deleting.name +
              "”? Deactivate instead when it should be retained for historical reference."
            : ""
        }
        submitting={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          mutate(
            () => configManagerResources.policies.delete(deleting.id),
            "Policy deleted.",
            () => setDeleting(null),
          )
        }
      />
    </div>
  );
}
