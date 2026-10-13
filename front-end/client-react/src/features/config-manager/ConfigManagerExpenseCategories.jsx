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
import { Icon } from "../../components/Icon";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/OperationalStates";
import { Table } from "../../components/Table";
import { CategorySuccessToast, useCategoryToast } from "./categoryToast";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { filterCategories, paginateCategories } from "./categoryLifecycle";
import "./category-lifecycle.css";

const DESCRIPTION_LIMIT = 1000;
const PAGE_SIZE = 10;
const EMPTY_ADD_FORM = { name: "", description: "", requiresReceipt: true };

async function loadCategories() {
  return configManagerResources.categories.list();
}

function CategoryForm({ form, setForm, error, includeStatus = false }) {
  return (
    <>
      <div>
        <label className="form-label" htmlFor="category-name">
          Category name
        </label>
        <input
          id="category-name"
          className="form-input"
          placeholder="e.g. Travel Expenses"
          maxLength={100}
          required
          aria-describedby="category-name-hint"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <p id="category-name-hint" className="category-field-hint">
          Required. Leading and trailing spaces are removed; up to 100
          characters.
        </p>
      </div>
      <div>
        <label className="form-label" htmlFor="category-description">
          Description <span className="category-optional">(optional)</span>
        </label>
        <textarea
          id="category-description"
          className="form-input"
          placeholder="Briefly explain which expenses belong here."
          rows="3"
          maxLength={DESCRIPTION_LIMIT}
          aria-describedby="category-description-hint"
          value={form.description}
          onChange={(event) =>
            setForm({ ...form, description: event.target.value })
          }
        />
        <p id="category-description-hint" className="category-field-hint">
          Up to {DESCRIPTION_LIMIT} characters. {form.description.length}/
          {DESCRIPTION_LIMIT}
        </p>
      </div>
      <div className="category-form-receipt">
        <div>
          <strong>Receipt required</strong>
          <p>Employees must attach a receipt when submitting this category.</p>
        </div>
        <ToggleSwitch
          checked={form.requiresReceipt}
          label="Receipt required"
          onChange={(requiresReceipt) => setForm({ ...form, requiresReceipt })}
        />
      </div>
      {includeStatus && (
        <p className="category-current-status">
          Current status: <StatusBadge status={form.status} /> Change it with
          the confirmed status action in the category list.
        </p>
      )}
      {error && (
        <p role="alert" className="category-form-error">
          {error}
        </p>
      )}
    </>
  );
}

export function ConfigManagerExpenseCategories() {
  const { status, data, refresh } = useAsyncResource(loadCategories);
  const categories = data || [];
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [addForm, setAddForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [statusChange, setStatusChange] = useState(null);
  const [formError, setFormError] = useState("");
  const { notice, showSuccess } = useCategoryToast();
  const [operationNotice, setOperationNotice] = useState(null);
  const [mutation, setMutation] = useState(null);

  const filtered = filterCategories(categories, search, statusFilter);
  const {
    page: currentPage,
    pageCount,
    items: visibleCategories,
    total: filteredCount,
  } = paginateCategories(filtered, page, PAGE_SIZE);

  useEffect(() => {
    if (status === "success" && categories.length === 0) setTemplatesOpen(true);
  }, [status, categories.length]);
  useEffect(() => {
    setPage((current) => Math.min(current, currentPage));
  }, [currentPage]);

  async function mutate(kind, operation, successMessage, close) {
    setMutation(kind);
    setFormError("");
    try {
      const result = await mutateAndRefresh(operation, refresh);
      if (result === false || result == null)
        throw new Error("The requested change could not be saved.");
      close();
      setPage(1);
      setOperationNotice(null);
      if (successMessage) showSuccess(successMessage, 2000);
    } catch (error) {
      const message =
        error.message || "The requested change could not be saved.";
      setFormError(message);
      setOperationNotice({ type: "error", message });
    } finally {
      setMutation(null);
    }
  }

  function validateForm(form) {
    if (!form.name.trim()) {
      setFormError("Category name is required.");
      return false;
    }
    if (form.name.trim().length > 100) {
      setFormError("Category name must be 100 characters or fewer.");
      return false;
    }
    if (form.description.length > DESCRIPTION_LIMIT) {
      setFormError(
        `Description must be ${DESCRIPTION_LIMIT} characters or fewer.`,
      );
      return false;
    }
    return true;
  }

  async function templatesActivated(_response, summary) {
    await refresh();
    setTemplatesOpen(false);
    showSuccess(summary, 3000);
    setPage(1);
  }

  const statusTarget =
    statusChange?.status === "Inactive" ? "deactivate" : "reactivate";

  return (
    <>
      <TemplateMobileNavigation />
      <CategorySuccessToast notice={notice} />
      <div className="category-page">
        <header className="category-page-header">
          <div>
            <p className="category-eyebrow">Configuration Manager</p>
            <h1>Expense Categories</h1>
            <p>
              Set up common expense types once, then manage the categories
              available to your organization.
            </p>
          </div>
          <div className="category-header-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={status !== "success"}
              onClick={() => {
                setTemplatesOpen((open) => !open);
              }}
            >
              {templatesOpen
                ? "Close predefined categories"
                : "Choose predefined categories"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setFormError("");
                setAddForm({ ...EMPTY_ADD_FORM });
              }}
            >
              Add custom category
            </button>
          </div>
        </header>

        {operationNotice && !addForm && !editing && (
          <p
            className="category-operation-notice category-operation-notice-error"
            role="alert"
          >
            {operationNotice.message}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setOperationNotice(null)}
              aria-label="Dismiss category error"
            >
              Dismiss
            </button>
          </p>
        )}
        {status === "success" && categories.length === 0 && (
          <section
            className="category-first-setup card"
            aria-labelledby="category-first-title"
          >
            <div>
              <p className="category-eyebrow">Start with a useful baseline</p>
              <h2 id="category-first-title">
                Configure once. Reuse across expense submissions.
              </h2>
              <p>
                Select the common categories your organization uses, review the
                preview, and activate them together. You can still add a custom
                category at any time.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setTemplatesOpen(true)}
            >
              Browse 8 predefined categories
            </button>
          </section>
        )}

        {templatesOpen && status === "success" && (
          <ConfigurationTemplatePicker
            mode="categories"
            records={categories}
            onActivated={templatesActivated}
            onClose={() => setTemplatesOpen(false)}
          />
        )}

        <section
          className="category-list-section"
          aria-label="Configured expense categories"
        >
          <div className="category-section-heading">
            <div>
              <h2>Your categories</h2>
              <p>
                Active categories are available for new expenses. Deactivation
                preserves existing policies and expense history.
              </p>
            </div>
          </div>
          <div className="filters-bar category-filters">
            <div className="search-wrapper">
              <Icon name="search" size={18} className="input-icon" />
              <input
                type="search"
                className="form-input has-icon"
                placeholder="Search categories..."
                aria-label="Search categories"
                maxLength={120}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <label className="category-filter-status">
              Status
              <select
                className="form-input"
                aria-label="Filter category status"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>
          </div>

          <div
            className="card category-table-card"
            aria-busy={status === "loading"}
          >
            {status === "loading" && (
              <LoadingState message="Loading expense categories…" />
            )}
            {status === "error" && (
              <ErrorState
                description="Categories could not be loaded. Your records have not been changed."
                onRetry={refresh}
              />
            )}
            {status === "success" &&
              filteredCount === 0 &&
              categories.length > 0 && (
                <div className="category-empty-filter">
                  <EmptyState
                    title="No categories match these filters"
                    description="Try another search or status, or clear the filters to see every category."
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                      setPage(1);
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            {status === "success" && categories.length === 0 && (
              <EmptyState
                title="No categories configured yet"
                description="Choose predefined categories for a quick start, or add a custom category above."
              />
            )}
            {status === "success" && filteredCount > 0 && (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th>Receipt</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCategories.map((category) => (
                        <tr key={category.id}>
                          <td>
                            <div className="category-name-cell">
                              <span
                                className="category-bar"
                                style={{ background: category.color }}
                              />
                              <span>{category.name}</span>
                            </div>
                          </td>
                          <td className="category-description-cell">
                            {category.description || (
                              <span className="category-muted">
                                No description
                              </span>
                            )}
                          </td>
                          <td>
                            <StatusBadge status={category.status} />
                          </td>
                          <td>
                            {category.requiresReceipt ? "Required" : "Optional"}
                          </td>
                          <td>
                            <div className="category-row-actions">
                              <button
                                type="button"
                                className="btn btn-secondary category-action"
                                disabled={mutation !== null}
                                aria-label={`Edit ${category.name}`}
                                onClick={() => {
                                  setFormError("");
                                  setEditing({
                                    id: category.id,
                                    name: category.name,
                                    description: category.description || "",
                                    requiresReceipt: category.requiresReceipt,
                                    status: category.status || "Active",
                                  });
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary category-action"
                                disabled={mutation !== null}
                                aria-label={`${category.status === "Active" ? "Deactivate" : "Reactivate"} ${category.name}`}
                                onClick={() =>
                                  setStatusChange({
                                    ...category,
                                    status:
                                      category.status === "Active"
                                        ? "Inactive"
                                        : "Active",
                                  })
                                }
                              >
                                {category.status === "Active"
                                  ? "Deactivate"
                                  : "Reactivate"}
                              </button>
                              <button
                                type="button"
                                className="btn-icon btn-icon-danger"
                                disabled={mutation !== null}
                                title={`Delete ${category.name}`}
                                aria-label={`Delete ${category.name}`}
                                onClick={() => {
                                  setDeleting(category);
                                  setFormError("");
                                }}
                              >
                                <Icon name="trash" size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
                <div
                  className="pagination"
                  role="navigation"
                  aria-label="Category pagination"
                >
                  <div
                    className="pagination-info"
                    role="status"
                    aria-live="polite"
                  >
                    Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                    {Math.min(currentPage * PAGE_SIZE, filteredCount)} of{" "}
                    {filteredCount} categories
                  </div>
                  <div className="pagination-buttons">
                    <button
                      type="button"
                      className="pagination-btn"
                      disabled={currentPage === 1}
                      onClick={() => setPage((current) => current - 1)}
                    >
                      Previous
                    </button>
                    <span>
                      Page {currentPage} of {pageCount}
                    </span>
                    <button
                      type="button"
                      className="pagination-btn"
                      disabled={currentPage >= pageCount}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <CrudModal
        open={addForm !== null}
        title="Add custom category"
        submitLabel="Save category"
        submitting={mutation === "add"}
        onClose={() => {
          setAddForm(null);
          setFormError("");
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!validateForm(addForm)) return;
          mutate(
            "add",
            () =>
              configManagerResources.categories.create({
                ...addForm,
                name: addForm.name.trim(),
                description: addForm.description.trim(),
              }),
            "Category created and saved.",
            () => setAddForm(null),
          );
        }}
      >
        <CategoryForm
          form={addForm || EMPTY_ADD_FORM}
          setForm={setAddForm}
          error={formError}
        />
      </CrudModal>
      <CrudModal
        open={Boolean(editing)}
        title="Edit category"
        submitLabel="Save changes"
        submitting={mutation === "edit"}
        onClose={() => {
          setEditing(null);
          setFormError("");
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!validateForm(editing)) return;
          mutate(
            "edit",
            () =>
              configManagerResources.categories.update(
                editing.id,
                {
                  name: editing.name.trim(),
                  description: editing.description.trim(),
                  requiresReceipt: editing.requiresReceipt,
                },
                categories.find((category) => category.id === editing.id),
              ),
            "Category changes saved.",
            () => setEditing(null),
          );
        }}
      >
        {editing && (
          <CategoryForm
            form={editing}
            setForm={setEditing}
            error={formError}
            includeStatus
          />
        )}
      </CrudModal>
      <ConfirmDialog
        open={Boolean(statusChange)}
        title={
          statusTarget === "deactivate"
            ? "Deactivate category?"
            : "Reactivate category?"
        }
        description={
          statusChange
            ? statusTarget === "deactivate"
              ? `Deactivate “${statusChange.name}”? It will be unavailable for new expenses. Existing policies, submitted expenses, and history will remain unchanged.`
              : `Reactivate “${statusChange.name}”? It will become available for new expenses again. Existing policies and history will remain unchanged.`
            : ""
        }
        confirmLabel={
          statusTarget === "deactivate"
            ? "Deactivate category"
            : "Reactivate category"
        }
        confirmingLabel={
          statusTarget === "deactivate" ? "Deactivating…" : "Reactivating…"
        }
        tone={statusTarget === "deactivate" ? "danger" : "primary"}
        submitting={mutation === "status"}
        onCancel={() => setStatusChange(null)}
        onConfirm={() =>
          mutate(
            "status",
            () =>
              configManagerResources.categories.update(
                statusChange.id,
                { status: statusChange.status },
                statusChange,
              ),
            statusTarget === "deactivate"
              ? "Category deactivated. Existing policies and history were preserved."
              : "Category reactivated.",
            () => setStatusChange(null),
          )
        }
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete category?"
        description={
          deleting
            ? `Delete “${deleting.name}”? Categories referenced by policies or existing expenses cannot be deleted. Deactivate the category to preserve its references and history.`
            : ""
        }
        confirmLabel="Delete category"
        confirmingLabel="Deleting…"
        submitting={mutation === "delete"}
        onCancel={() => {
          setDeleting(null);
          setFormError("");
        }}
        onConfirm={() =>
          mutate(
            "delete",
            () => configManagerResources.categories.delete(deleting.id),
            "Category deleted.",
            () => setDeleting(null),
          )
        }
      />
    </>
  );
}
