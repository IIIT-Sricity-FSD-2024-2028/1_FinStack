import { readPreferences } from "../../services/preferences";
import { useEmployeePage } from "../../hooks/useEmployeePage";
import { Link } from "react-router-dom";
import { ManagerPicker } from "./ManagerPicker";
import { BulkEmployeeImport } from "./BulkEmployeeImport";
import { TemplateMobileNavigation } from "./ConfigurationTemplatePicker";
import { useEffect, useState } from "react";
import {
  configManagerResources,
  mutateAndRefresh,
} from "../../adapters/configManagerResources";
import {
  ConfirmDialog,
  CrudModal,
  StatusBadge,
} from "../../components/CrudPrimitives";
import { Icon } from "../../components/Icon";
import { ErrorState, LoadingState } from "../../components/OperationalStates";
import { Table } from "../../components/Table";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { employeeErrors, employeeFailure } from "./employeeForm";
import { CategorySuccessToast, useCategoryToast } from "./categoryToast";
import "./employee-management.css";

const ROLE_LABELS = {
  expense_submitter: "Expense Submitter",
  manager: "Manager",
  finance_officer: "Finance Officer",
  compliance_officer: "Compliance Officer",
  configuration_manager: "Configuration Manager",
};
const ROLE_COLORS = [
  { bg: "#7C3AED20", text: "#7C3AED", border: "#7C3AED40" },
  { bg: "#22D3EE20", text: "#22D3EE", border: "#22D3EE40" },
  { bg: "#EC489920", text: "#EC4899", border: "#EC489940" },
];
const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  employeeId: "",
  department: "",
  roles: ["expense_submitter"],
  managerId: "",
  password: "",
};

const loadUsers = (params) => configManagerResources.users.page(params);
async function loadRoles() {
  return configManagerResources.roles.list();
}

function initials(name) {
  return String(name || "")
    .split(" ")
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function AddUserFields({ form, setForm, enabledRoles, errors }) {
  const update = (field, value) => setForm({ ...form, [field]: value });
  const field = (key, label, suffix, options = {}) => (
    <div className="employee-field">
      <label className="form-label" htmlFor={"manage-user-" + suffix}>
        {label}
      </label>
      <input
        id={"manage-user-" + suffix}
        className="form-input"
        value={form[key]}
        onChange={(e) => update(key, e.target.value)}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={"employee-error-" + key}
        {...options}
      />
      {errors[key] && (
        <small
          id={"employee-error-" + key}
          role="alert"
          className="employee-error"
        >
          {errors[key]}
        </small>
      )}
    </div>
  );
  return (
    <>
      {errors.form && (
        <p role="alert" className="employee-error">
          {errors.form}
        </p>
      )}
      <fieldset className="employee-group">
        <legend>Employee details</legend>
        <div className="employee-name-grid">
          {field("firstName", "First Name", "first-name", {
            required: true,
            maxLength: 100,
          })}
          {field("lastName", "Last Name", "last-name", {
            required: true,
            maxLength: 100,
          })}
        </div>
        {field("email", "Email Address", "email", {
          type: "email",
          required: true,
          maxLength: 320,
        })}
        {form.id ? (
          field("employeeId", "FinStack login ID", "employee-id", {
            readOnly: true,
            maxLength: 80,
          })
        ) : (
          <p>
            A unique FinStack login ID is generated automatically after
            creation.
          </p>
        )}
        {field("department", "Department", "department", {
          maxLength: 120,
          placeholder: "General",
        })}
      </fieldset>
      <fieldset className="employee-group">
        <legend>Access and reporting</legend>
        <label className="form-label" htmlFor="manage-user-role">
          Assign Role
        </label>
        <select
          id="manage-user-role"
          className="form-input"
          value={form.roles[0] || ""}
          onChange={(e) => update("roles", [e.target.value])}
        >
          {Object.entries(ROLE_LABELS)
            .filter(([id]) => enabledRoles.includes(id))
            .map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
        </select>
        {errors.roles && (
          <small role="alert" className="employee-error">
            {errors.roles}
          </small>
        )}
        {!form.id ? (
          <>
            <ManagerPicker
              value={form.managerId}
              onChange={(value) => update("managerId", value)}
            />
            <small>
              Optional. Choose an active Manager, or leave unassigned. Reporting
              changes remain available in User Hierarchy.
            </small>
            {errors.managerId && (
              <small role="alert" className="employee-error">
                {errors.managerId}
              </small>
            )}
          </>
        ) : (
          <p>
            Reporting manager: {form.manager?.fullName || "Unassigned"}.{" "}
            <Link to="/configuration/user-hierarchy">
              Change reporting in User Hierarchy
            </Link>
            .
          </p>
        )}
      </fieldset>
      {!form.id && (
        <fieldset className="employee-group">
          <legend>Account credentials</legend>
          {field("password", "Temporary Password", "password", {
            type: "password",
            required: true,
            minLength: 8,
            maxLength: 200,
            autoComplete: "new-password",
          })}
          <small>
            Use 8–200 characters. Share securely; no email is sent and automatic
            forced password change is unavailable. CSV imports use single-use
            activation instead.
          </small>
        </fieldset>
      )}
    </>
  );
}

export function ConfigManagerManageUsers() {
  const [params, setParams] = useState({
    page: 1,
    pageSize: readPreferences().pageSize,
    search: "",
    department: "",
    role: "",
    status: "",
  });
  const [search, setSearch] = useState(
    () => new URLSearchParams(window.location.search).get("employee") || "",
  );
  const [department, setDepartment] = useState("");
  const userResource = useEmployeePage(loadUsers, params);
  const roleResource = useAsyncResource(loadRoles);
  const status = userResource.status;
  const refresh = userResource.refresh;
  const users = userResource.data?.items || [];
  const total = userResource.data?.total || 0;
  const pageCount = Math.max(1, userResource.data?.totalPages || 0);
  const enabledRoles = (roleResource.data || []).map((role) => role.id);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [createdLoginId, setCreatedLoginId] = useState("");
  const { notice, showSuccess } = useCategoryToast();
  const [mutation, setMutation] = useState(null);
  const [mutationError, setMutationError] = useState("");
  const [statusTarget, setStatusTarget] = useState(null);
  useEffect(() => {
    const updatePageSize = () => {
      const pageSize = readPreferences().pageSize;
      setParams((current) =>
        current.pageSize === pageSize
          ? current
          : { ...current, page: 1, pageSize },
      );
    };
    window.addEventListener("finstack:preferences", updatePageSize);
    return () =>
      window.removeEventListener("finstack:preferences", updatePageSize);
  }, []);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setParams((current) =>
          current.search === search.trim() &&
          current.department === department.trim()
            ? current
            : {
                ...current,
                page: 1,
                search: search.trim(),
                department: department.trim(),
              },
        ),
      300,
    );
    return () => clearTimeout(timer);
  }, [search, department]);
  useEffect(() => {
    if (userResource.status === "success" && params.page > pageCount)
      setParams((current) => ({ ...current, page: pageCount }));
  }, [userResource.status, params.page, pageCount]);
  function filter(key, value) {
    setParams((current) => ({ ...current, page: 1, [key]: value }));
  }

  function initialForm() {
    return {
      ...EMPTY_FORM,
      roles: enabledRoles.includes("expense_submitter")
        ? ["expense_submitter"]
        : [],
    };
  }

  async function addUser(event) {
    event.preventDefault();
    if (mutation) return;
    const errors = employeeErrors(form, Boolean(form.id));
    if (!enabledRoles.includes(form.roles[0]))
      errors.roles = "Choose an available role.";
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setMutation("add");
    setFieldErrors({});
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      department: form.department.trim() || "General",
      role: form.roles[0],
    };
    try {
      const result = await mutateAndRefresh(
        () =>
          form.id
            ? configManagerResources.users.update(form.id, payload)
            : configManagerResources.users.create({
                ...payload,
                managerId: form.managerId,
                password: form.password,
              }),
        refresh,
      );
      if (!result) throw Error("Save failed.");
      if (!form.id) setCreatedLoginId(result.employeeId);
      setForm(null);
      showSuccess(
        form.id
          ? "Employee changes saved."
          : "Employee created: " + result.employeeId,
        2000,
      );
    } catch (caught) {
      setFieldErrors(employeeFailure(caught.message));
    } finally {
      setMutation(null);
    }
  }

  async function toggleStatus(user) {
    if (mutation) return;
    setMutation(user.employeeId);
    setMutationError("");
    try {
      const nextStatus = user.status === "Active" ? "Inactive" : "Active";
      await mutateAndRefresh(
        () => configManagerResources.users.updateStatus(user.id, nextStatus),
        refresh,
      );
      showSuccess(
        nextStatus === "Active"
          ? "Employee enabled."
          : "Employee disabled. Reporting links were preserved.",
        2000,
      );
      setStatusTarget(null);
    } catch (caught) {
      setMutationError(caught.message || "User status could not be changed.");
    } finally {
      setMutation(null);
    }
  }

  return (
    <div className="employee-management">
      <CategorySuccessToast notice={form || statusTarget ? null : notice} />
      <TemplateMobileNavigation />
      {createdLoginId && (
        <div role="status" className="card">
          <strong>
            Account created. FinStack login ID:{" "}
            <code style={{ overflowWrap: "anywhere" }}>{createdLoginId}</code>
          </strong>
          <p>
            Save this ID and share the initial password through a secure
            channel.
          </p>
        </div>
      )}
      <div className="page-header">
        <div className="page-header-text">
          <h1>Manage Users</h1>
          <p>View and manage all users in your organization</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={roleResource.status !== "success"}
          onClick={() => {
            setForm(initialForm());
            setFieldErrors({});
          }}
        >
          Add User
        </button>
      </div>
      <div style={{ marginBottom: 20 }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setImportOpen(true)}
        >
          Bulk Import
        </button>
      </div>
      {importOpen && (
        <BulkEmployeeImport
          onUsersChanged={refresh}
          onSuccess={showSuccess}
          onClose={() => setImportOpen(false)}
        />
      )}
      <div className="filters-bar">
        <div className="search-wrapper">
          <Icon name="search" size={18} className="input-icon" />
          <input
            type="search"
            className="form-input has-icon"
            placeholder="Search users..."
            aria-label="Search users"
            maxLength={120}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select
          className="form-input"
          style={{ width: "auto" }}
          value={params.role}
          aria-label="Filter by role"
          onChange={(event) => filter("role", event.target.value)}
        >
          <option value="">All Roles</option>
          {Object.entries(ROLE_LABELS).map(([key, label]) => (
            <option key={key} value={key.toUpperCase()}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="form-input"
          style={{ width: "auto" }}
          value={params.status}
          aria-label="Filter by status"
          onChange={(event) => filter("status", event.target.value)}
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <input
          className="form-input"
          type="search"
          aria-label="Filter by department"
          placeholder="Department (exact name)"
          maxLength={120}
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
        />
        <select
          className="form-input"
          aria-label="Employees per page"
          value={params.pageSize}
          onChange={(event) => filter("pageSize", Number(event.target.value))}
        >
          {[25, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size} per page
            </option>
          ))}
        </select>
      </div>
      {mutationError && <p role="alert">{mutationError}</p>}
      {roleResource.status === "error" && (
        <ErrorState
          description="Role choices could not be loaded."
          onRetry={roleResource.refresh}
        />
      )}
      <div className="card" aria-busy={status === "loading"}>
        {status === "loading" && <LoadingState message="Loading users…" />}
        {status === "error" && (
          <ErrorState
            description="Users could not be loaded."
            onRetry={refresh}
          />
        )}
        {status === "success" && (
          <>
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Roles</th>
                    <th>Status</th>
                    <th>Manager</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.employeeId}
                      data-employee-id={user.employeeId}
                    >
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <div className="avatar avatar-lg">
                            {initials(user.fullName)}
                          </div>
                          <span
                            style={{
                              fontWeight: 500,
                              color: "var(--text-primary)",
                            }}
                          >
                            <span>{user.fullName}</span>
                            <small className="employee-secondary">
                              {user.employeeId} · {user.department}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>
                        {user.email}
                      </td>
                      <td>
                        <div
                          style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
                        >
                          {(user.roles || []).map((role, index) => {
                            const color =
                              ROLE_COLORS[index % ROLE_COLORS.length];
                            return (
                              <span
                                key={role}
                                className="badge"
                                style={{
                                  background: color.bg,
                                  color: color.text,
                                  borderColor: color.border,
                                }}
                              >
                                {ROLE_LABELS[role] || role}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={user.status} />
                      </td>
                      <td style={{ color: "var(--text-primary)" }}>
                        {user.manager?.fullName || "Unassigned"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            className="btn btn-secondary"
                            type="button"
                            disabled={
                              mutation !== null ||
                              roleResource.status !== "success"
                            }
                            aria-label={"Edit " + user.fullName}
                            onClick={() => {
                              setFieldErrors({});
                              setForm({
                                ...user,
                                password: "",
                                roles: user.roles || [user.role.toLowerCase()],
                              });
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={
                              mutation !== null || user.credentialSetupRequired
                            }
                            aria-label={`${user.status === "Active" ? "Disable" : "Enable"} ${user.fullName}`}
                            title={
                              user.credentialSetupRequired
                                ? "Employee must set a password using an activation link"
                                : `${user.status === "Active" ? "Disable" : "Enable"} User`
                            }
                            onClick={() => {
                              setMutationError("");
                              setStatusTarget(user);
                            }}
                          >
                            <Icon
                              name={
                                user.status === "Active" ? "userX" : "userCheck"
                              }
                              size={16}
                            />
                            {user.status === "Active" ? "Disable" : "Enable"}
                          </button>
                          {user.credentialSetupRequired && (
                            <small>Activation required</small>
                          )}
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
              aria-label="Employee pagination"
            >
              <div className="pagination-info" role="status" aria-live="polite">
                {total
                  ? `Showing ${(params.page - 1) * params.pageSize + 1}-${Math.min(params.page * params.pageSize, total)} of ${total} users`
                  : "No users found"}
              </div>
              <div className="pagination-buttons">
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={params.page === 1}
                  onClick={() =>
                    setParams((current) => ({
                      ...current,
                      page: current.page - 1,
                    }))
                  }
                >
                  Previous
                </button>
                <span>
                  Page {params.page} of {pageCount}
                </span>
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={!userResource.data?.hasNextPage}
                  onClick={() =>
                    setParams((current) => ({
                      ...current,
                      page: current.page + 1,
                    }))
                  }
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      <ConfirmDialog
        open={Boolean(statusTarget)}
        title={
          statusTarget?.status === "Active"
            ? "Disable employee?"
            : "Enable employee?"
        }
        description={
          mutationError ||
          (statusTarget?.status === "Active"
            ? "This employee will lose access. Reporting relationships and historical records are preserved."
            : "Restore access for this credentialed employee. Activation-required accounts cannot be enabled here.")
        }
        confirmLabel={
          statusTarget?.status === "Active"
            ? "Disable employee"
            : "Enable employee"
        }
        confirmingLabel="Saving…"
        submitting={mutation !== null}
        onCancel={() => setStatusTarget(null)}
        onConfirm={() => toggleStatus(statusTarget)}
      />
      <CrudModal
        open={Boolean(form)}
        title={form?.id ? "Edit User" : "Add New User"}
        submitLabel={form?.id ? "Save Changes" : "Add User"}
        maxWidth={600}
        submitting={mutation === "add"}
        onClose={() => {
          setForm(null);
          setFieldErrors({});
        }}
        onSubmit={addUser}
      >
        {form && (
          <AddUserFields
            form={form}
            setForm={(next) => {
              setForm(next);
              setFieldErrors((current) => {
                const updated = { ...current };
                for (const key of Object.keys(next))
                  if (next[key] !== form[key]) delete updated[key];
                delete updated.form;
                return updated;
              });
            }}
            enabledRoles={enabledRoles}
            errors={fieldErrors}
          />
        )}
      </CrudModal>
    </div>
  );
}
