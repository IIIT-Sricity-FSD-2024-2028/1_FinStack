import { useEffect, useRef, useState } from "react";
import { configManagerResources } from "../../adapters/configManagerResources";
import { useEmployeePage } from "../../hooks/useEmployeePage";
import { ErrorState, LoadingState } from "../../components/OperationalStates";
import { TemplateMobileNavigation } from "./ConfigurationTemplatePicker";
import "./user-hierarchy.css";
import { CategorySuccessToast, useCategoryToast } from "./categoryToast";

const loadBranch = (params) => configManagerResources.hierarchy.branch(params);
const loadSummary = (params) =>
  configManagerResources.hierarchy.summary(params);
const loadEmployee = (params) =>
  configManagerResources.hierarchy.employee(params);
const roleLabel = (role) => role.replaceAll("_", " ").toLowerCase();

function Pager({ data, onPage, label }) {
  return (
    <nav className="hierarchy-pager" aria-label={label}>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={!data.hasPreviousPage}
        onClick={() => onPage(data.page - 1)}
      >
        Previous
      </button>
      <span role="status">
        Page {data.page} of {Math.max(1, data.totalPages)} · {data.total} people
      </span>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={!data.hasNextPage}
        onClick={() => onPage(data.page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

function Person({ user, onSelect, mutation, trail }) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = user.directReportCount > 0 && !trail.includes(user.id);
  return (
    <li className="hierarchy-person" data-employee-id={user.employeeId}>
      <div className="hierarchy-person-row">
        <button
          type="button"
          className="btn btn-secondary hierarchy-expand"
          disabled={!canExpand}
          aria-label={`${expanded ? "Collapse" : "Expand"} reports of ${user.fullName}`}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "−" : "+"}
        </button>
        <button
          type="button"
          className="hierarchy-person-details"
          onClick={() => onSelect(user.id)}
        >
          <strong>{user.fullName}</strong>
          <span>
            {user.employeeId} · {roleLabel(user.role)} · {user.department}
          </span>
          <span>
            {user.directReportCount} direct{" "}
            {user.directReportCount === 1 ? "report" : "reports"} ·{" "}
            {user.status === "ACTIVE" ? "Active" : "Inactive"}
            {user.manager?.status === "INACTIVE" ? " · Manager inactive" : ""}
          </span>
        </button>
      </div>
      {expanded && canExpand && (
        <div className="hierarchy-children">
          <Branch
            query={{ view: "REPORTS", managerId: user.id }}
            onSelect={onSelect}
            mutation={mutation}
            trail={[...trail, user.id]}
            label={`Reports of ${user.fullName}`}
          />
        </div>
      )}
    </li>
  );
}

function Branch({
  query,
  onSelect,
  mutation,
  trail = [],
  label = "Organization employees",
}) {
  const [page, setPage] = useState(1);
  const resource = useEmployeePage(loadBranch, {
    ...query,
    page,
    pageSize: 20,
  });
  const previousMutation = useRef(mutation?.sequence);
  useEffect(() => {
    if (previousMutation.current === mutation?.sequence) return;
    previousMutation.current = mutation?.sequence;
    const affected =
      query.view === "REPORTS"
        ? [mutation?.oldManagerId, mutation?.newManagerId].includes(
            query.managerId,
          )
        : query.view === "ROOTS"
          ? mutation?.oldManagerId === null || mutation?.newManagerId === null
          : false;
    const changedIds = [
      mutation?.employeeId,
      mutation?.oldManagerId,
      mutation?.newManagerId,
    ];
    if (
      affected ||
      resource.data?.items.some((user) => changedIds.includes(user.id))
    )
      resource.refresh();
  }, [mutation, query, resource]);
  useEffect(() => {
    if (
      resource.status === "success" &&
      page > Math.max(1, resource.data.totalPages)
    )
      setPage(Math.max(1, resource.data.totalPages));
  }, [resource.status, resource.data, page]);
  return (
    <section aria-label={label} aria-busy={resource.status === "loading"}>
      {resource.status === "loading" && (
        <LoadingState message="Loading reporting branch..." />
      )}
      {resource.status === "error" && (
        <ErrorState
          description={
            resource.error?.message || "This branch could not be loaded."
          }
          onRetry={resource.refresh}
        />
      )}
      {resource.data &&
        (resource.status === "success" || resource.status === "loading") && (
          <>
            {!resource.data.items.length ? (
              <p className="hierarchy-empty">No employees in this view.</p>
            ) : (
              <ul className="hierarchy-people">
                {resource.data.items.map((user) => (
                  <Person
                    key={user.id}
                    user={user}
                    onSelect={onSelect}
                    mutation={mutation}
                    trail={trail}
                  />
                ))}
              </ul>
            )}
            <Pager
              data={resource.data}
              label={`${label} pages`}
              onPage={setPage}
            />
          </>
        )}
    </section>
  );
}

function ManagerAssignment({ employee, onSaved, onCancel }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState({
    view: "CANDIDATES",
    page: 1,
    pageSize: 20,
    search: "",
  });
  const [managerId, setManagerId] = useState(employee.managerId || "");
  const [choice, setChoice] = useState(employee.manager);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const managers = useEmployeePage(loadBranch, query);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setQuery((current) =>
          current.search === search.trim()
            ? current
            : { ...current, page: 1, search: search.trim() },
        ),
      300,
    );
    return () => clearTimeout(timer);
  }, [search]);
  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await configManagerResources.hierarchy.updateManager(
        employee.id,
        managerId || null,
        employee.managerId,
      );
      if (mounted.current)
        onSaved({
          employeeId: employee.id,
          oldManagerId: employee.managerId,
          newManagerId: managerId || null,
        });
    } catch (failure) {
      if (mounted.current)
        setError(failure.message || "Reporting manager could not be saved.");
    } finally {
      if (mounted.current) setSaving(false);
    }
  }
  const items =
    managers.status === "success"
      ? managers.data.items.filter((user) => user.id !== employee.id)
      : [];
  return (
    <form onSubmit={save} className="hierarchy-assignment">
      <h3>Change reporting manager</h3>
      <p>
        Choose an active employee of any role. Cycles are rejected by the
        server. Saving replaces this employee's reporting link.
      </p>
      <label className="form-label" htmlFor="hierarchy-manager-search">
        Find reporting manager
      </label>
      <input
        autoFocus
        id="hierarchy-manager-search"
        className="form-input"
        type="search"
        value={search}
        maxLength={120}
        onChange={(event) => setSearch(event.target.value)}
      />
      <label className="form-label" htmlFor="hierarchy-manager">
        Reporting manager
      </label>
      <select
        id="hierarchy-manager"
        className="form-input"
        value={managerId}
        disabled={saving}
        onChange={(event) => {
          setManagerId(event.target.value);
          setChoice(
            items.find((user) => user.id === event.target.value) || null,
          );
        }}
      >
        <option value="">No manager (remove assignment)</option>
        {choice &&
          managerId &&
          !items.some((user) => user.id === managerId) && (
            <option value={choice.id}>
              {choice.fullName} ({choice.employeeId})
            </option>
          )}
        {items.map((user) => (
          <option key={user.id} value={user.id}>
            {user.fullName} ({user.employeeId}) · {roleLabel(user.role)}
          </option>
        ))}
      </select>
      {managers.status === "loading" && (
        <p role="status">Loading eligible managers...</p>
      )}
      {managers.status === "error" && (
        <ErrorState
          description="Manager search failed."
          onRetry={managers.refresh}
        />
      )}
      {managers.status === "success" && (
        <Pager
          data={managers.data}
          label="Eligible manager pages"
          onPage={(page) => setQuery((current) => ({ ...current, page }))}
        />
      )}
      {error && <p role="alert">{error}</p>}
      <div className="hierarchy-actions">
        <button
          className="btn btn-primary"
          type="submit"
          disabled={saving || managerId === (employee.managerId || "")}
        >
          {saving ? "Saving..." : "Save manager"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function EmployeeDetails({ id, onClose, onSelect, onNavigate, onMutation }) {
  const resource = useEmployeePage(loadEmployee, { id });
  const [editing, setEditing] = useState(false);
  const user = resource.status === "success" ? resource.data : null;
  return (
    <aside className="hierarchy-detail card" aria-label="Employee details">
      <div className="hierarchy-actions">
        <h2>Employee details</h2>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close details
        </button>
      </div>
      {resource.status === "loading" && (
        <LoadingState message="Loading employee details..." />
      )}
      {resource.status === "error" && (
        <ErrorState
          description={resource.error?.message}
          onRetry={resource.refresh}
        />
      )}
      {user && (
        <>
          <h3>{user.fullName}</h3>
          <dl>
            <dt>Employee ID</dt>
            <dd>{user.employeeId}</dd>
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>Department</dt>
            <dd>{user.department}</dd>
            <dt>Role / status</dt>
            <dd>
              {roleLabel(user.role)} /{" "}
              {user.status === "ACTIVE" ? "Active" : "Inactive"}
            </dd>
            <dt>Reporting manager</dt>
            <dd>
              {user.manager ? (
                <button
                  type="button"
                  className="hierarchy-link"
                  onClick={() => onSelect(user.manager.id)}
                >
                  {user.manager.fullName}
                  {user.manager.status === "INACTIVE" ? " (Inactive)" : ""}
                </button>
              ) : (
                "No manager assigned"
              )}
            </dd>
            <dt>Direct reports</dt>
            <dd>{user.directReportCount}</dd>
          </dl>
          {user.manager?.status === "INACTIVE" && (
            <p role="status">
              The reporting manager is inactive. The existing link is preserved;
              assign an active replacement when appropriate.
            </p>
          )}
          <nav aria-label="Reporting ancestor path">
            <h3>Reporting path</h3>
            <button
              type="button"
              className="hierarchy-link"
              onClick={() => onNavigate(null)}
            >
              Organization
            </button>
            {user.ancestors.map((ancestor) => (
              <span key={ancestor.id}>
                {" "}
                /{" "}
                <button
                  type="button"
                  className="hierarchy-link"
                  onClick={() => onNavigate(ancestor)}
                >
                  {ancestor.fullName}
                </button>
              </span>
            ))}
            <span> / {user.fullName}</span>
          </nav>
          {user.pathTruncated && (
            <p role="status">
              Path shortened at 100 levels or an inconsistent historical link.
              Navigate an ancestor to continue.
            </p>
          )}
          <div className="hierarchy-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onNavigate(user)}
            >
              Browse direct reports
            </button>
            {!editing && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setEditing(true);
                }}
              >
                Change manager
              </button>
            )}
          </div>
          {editing && (
            <ManagerAssignment
              key={id}
              employee={user}
              onCancel={() => setEditing(false)}
              onSaved={(change) => {
                setEditing(false);
                resource.refresh();
                onMutation(change);
              }}
            />
          )}
        </>
      )}
    </aside>
  );
}

export function ConfigManagerUserHierarchy() {
  const [departmentPage, setDepartmentPage] = useState(1);
  const summary = useEmployeePage(loadSummary, {
    page: departmentPage,
    pageSize: 20,
  });
  const [department, setDepartment] = useState("");
  const [search, setSearch] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [focus, setFocus] = useState(null);
  const [selected, setSelected] = useState(null);
  const [mutation, setMutation] = useState(null);
  const { notice, showSuccess } = useCategoryToast();
  useEffect(() => {
    const timer = setTimeout(() => setCommittedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const query = committedSearch
    ? {
        view: "SEARCH",
        search: committedSearch,
        ...(department ? { department } : {}),
      }
    : focus
      ? { view: "REPORTS", managerId: focus.id }
      : department
        ? { view: "DEPARTMENT", department }
        : { view: "ROOTS" };
  function navigate(person) {
    setFocus(person);
    setDepartment("");
    setSearch("");
    setCommittedSearch("");
  }
  return (
    <div className="hierarchy-page">
      <CategorySuccessToast notice={notice} />
      <TemplateMobileNavigation />
      <header className="page-header">
        <div>
          <h1>User Hierarchy</h1>
          <p>
            Browse reporting lines and maintain your organization's manager
            assignments.
          </p>
        </div>
      </header>
      {summary.status === "loading" && (
        <LoadingState message="Loading organization overview..." />
      )}
      {summary.status === "error" && (
        <ErrorState
          description="Organization overview could not be loaded."
          onRetry={summary.refresh}
        />
      )}
      {summary.status === "success" && (
        <>
          <div
            className="hierarchy-overview card"
            aria-label="Organization overview"
          >
            <span>
              <strong>{summary.data.total}</strong>{" "}
              {summary.data.total === 1 ? "employee" : "employees"}
            </span>
            <span>
              <strong>{summary.data.active}</strong> active
            </span>
            <span>
              <strong>{summary.data.unassigned}</strong> without a manager
            </span>
            <span>
              <strong>{summary.data.inactiveManagers}</strong> inactive managers
              with reports
            </span>
          </div>
          <div className="hierarchy-filters">
            <label>
              Department
              <select
                className="form-input"
                aria-label="Hierarchy department"
                value={department}
                onChange={(event) => {
                  setDepartment(event.target.value);
                  setFocus(null);
                }}
              >
                <option value="">All departments</option>
                {department &&
                  !summary.data.departments.some(
                    (item) => item.name === department,
                  ) && <option value={department}>{department}</option>}
                {summary.data.departments.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name} ({item.total})
                  </option>
                ))}
              </select>
            </label>
            {summary.data.departmentTotalPages > 1 && (
              <nav className="hierarchy-actions" aria-label="Department pages">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={departmentPage === 1}
                  onClick={() => setDepartmentPage((page) => page - 1)}
                >
                  Previous departments
                </button>
                <span>
                  {departmentPage} / {summary.data.departmentTotalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={departmentPage >= summary.data.departmentTotalPages}
                  onClick={() => setDepartmentPage((page) => page + 1)}
                >
                  Next departments
                </button>
              </nav>
            )}
          </div>
        </>
      )}
      <div className="hierarchy-filters">
        <label htmlFor="hierarchy-search">
          Find employee or manager
          <input
            id="hierarchy-search"
            className="form-input"
            type="search"
            maxLength={120}
            value={search}
            placeholder="Name, employee ID or email"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate(null)}
        >
          Organization roots / unassigned
        </button>
      </div>
      <div className="hierarchy-layout">
        <main className="card hierarchy-tree">
          <h2>
            {committedSearch
              ? "Search results"
              : focus
                ? `Direct reports of ${focus.fullName}`
                : department
                  ? `${department} employees`
                  : "Organization roots / employees without managers"}
          </h2>
          <p>
            {department
              ? "Department entry points include all matching employees. Expanded reports may belong to other departments."
              : "Expand a person to load only their immediate reports. Select a name for details and manager assignment."}
          </p>
          <Branch
            key={JSON.stringify(query)}
            query={query}
            onSelect={setSelected}
            mutation={mutation}
          />
        </main>
        {selected && (
          <EmployeeDetails
            key={selected}
            id={selected}
            onClose={() => setSelected(null)}
            onSelect={setSelected}
            onNavigate={navigate}
            onMutation={(change) => {
              setMutation({ ...change, sequence: Date.now() });
              summary.refresh();
              showSuccess("Reporting manager saved.", 2000);
            }}
          />
        )}
      </div>
    </div>
  );
}
