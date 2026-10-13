import { Link } from "react-router-dom";
import { useEmployeePage } from "../../hooks/useEmployeePage";
import { TemplateMobileNavigation } from "./ConfigurationTemplatePicker";
import "./roles-access.css";
import { useState } from "react";
import { configManagerResources } from "../../adapters/configManagerResources";
import { Icon } from "../../components/Icon";
import { ErrorState, LoadingState } from "../../components/OperationalStates";
import { useAsyncResource } from "../../hooks/useAsyncResource";

async function loadRoles() {
  return configManagerResources.roles.list();
}

function presentationFor(roleId) {
  if (roleId === "expense_submitter")
    return { color: "purple", icon: "receipt" };
  if (roleId === "configuration_manager")
    return { color: "purple", icon: "settings" };
  if (roleId === "manager") return { color: "cyan", icon: "briefcase" };
  if (roleId === "finance_officer")
    return { color: "pink", icon: "calculator" };
  return { color: "green", icon: "shieldCheck" };
}

function RoleList({ roles, selectedRoleId, onSelect }) {
  return (
    <div>
      {roles.map((role) => {
        const presentation = presentationFor(role.id);
        return (
          <div
            key={role.id}
            className={`role-item${selectedRoleId === role.id ? " selected" : ""}${!role.enabled ? " disabled" : ""}`}
            role="button"
            tabIndex="0"
            aria-pressed={selectedRoleId === role.id}
            onClick={() => onSelect(role.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(role.id);
              }
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className={`icon-box icon-box-${presentation.color}`}>
                  <Icon name={presentation.icon} />
                </div>
                <div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <h4
                      style={{ fontWeight: 500, color: "var(--text-primary)" }}
                    >
                      {role.name}
                    </h4>
                    {role.required && (
                      <span
                        className="badge badge-gray"
                        style={{ fontSize: "0.625rem" }}
                      >
                        Required
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      marginTop: 2,
                    }}
                  >
                    {role.description}
                  </p>
                </div>
              </div>
              <span className="badge badge-gray">{role.userCount} users</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoleDetails({ role }) {
  if (!role)
    return (
      <div
        style={{
          textAlign: "center",
          padding: "48px 0",
          color: "var(--text-secondary)",
        }}
      >
        <Icon
          name="shieldCheck"
          size={48}
          style={{ margin: "0 auto 16px", opacity: 0.3, display: "block" }}
        />
        <p>Select a role to view its permissions</p>
      </div>
    );
  const presentation = presentationFor(role.id);
  const permissions = role.permissions || [];
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          className={`icon-box icon-box-${presentation.color}`}
          style={{ width: 48, height: 48 }}
        >
          <Icon name={presentation.icon} size={24} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2>{role.name}</h2>
            {role.required && (
              <span className="badge badge-gray">Required</span>
            )}
          </div>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--text-secondary)",
              marginTop: 4,
            }}
          >
            {role.description}
          </p>
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <h3
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          Permissions
        </h3>
      </div>
      <div className="space-y-3">
        {permissions.map((permission) => (
          <div className="permission-item" key={permission}>
            <div className="permission-check granted">
              <Icon name="check" size={12} />
            </div>
            <div
              style={{
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              {permission}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function RoleMembers({ role }) {
  const [page, setPage] = useState(1);
  const members = useEmployeePage(configManagerResources.users.page, {
    page,
    pageSize: 20,
    role: role.id.toUpperCase(),
  });
  return (
    <section className="card restored-settings-card">
      <h2>Role Members</h2>
      <p>
        Assignments are managed through authorized employee editing. The last
        active Configuration Manager cannot be demoted. Role definitions are
        fixed tenant capabilities.
      </p>
      {members.status === "loading" ? (
        <LoadingState />
      ) : members.status === "error" ? (
        <ErrorState
          description="Members could not load."
          onRetry={members.refresh}
        />
      ) : (
        <>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Role assignment</th>
                </tr>
              </thead>
              <tbody>
                {members.data.items.map((user) => (
                  <tr key={user.id}>
                    <td>
                      {user.firstName} {user.lastName}
                      <br />
                      {user.employeeId}
                    </td>
                    <td>{user.department}</td>
                    <td>{user.status}</td>
                    <td>
                      <Link
                        className="btn btn-secondary"
                        to={
                          "/configuration/manage-users?employee=" +
                          encodeURIComponent(user.employeeId)
                        }
                      >
                        Edit assignment
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!members.data.items.length && <p>No employees hold this role.</p>}
          <button
            className="btn btn-secondary"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous members
          </button>
          <button
            className="btn btn-secondary"
            disabled={page >= members.data.totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next members
          </button>
        </>
      )}
    </section>
  );
}
export function ConfigManagerRolesAccess() {
  const { status, data, refresh } = useAsyncResource(loadRoles);
  const roles = data || [];
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const effectiveSelectedId = roles.some((role) => role.id === selectedRoleId)
    ? selectedRoleId
    : roles[0]?.id;
  const selectedRole =
    roles.find((role) => role.id === effectiveSelectedId) || null;

  return (
    <>
      <TemplateMobileNavigation />
      <div className="page-header">
        <div className="page-header-text">
          <h1>Roles &amp; Access</h1>
          <p>View server-defined roles and their permissions</p>
        </div>
      </div>
      {status === "loading" && (
        <LoadingState message="Loading roles and permissions…" />
      )}
      {status === "error" && (
        <ErrorState
          description="Roles and permissions could not be loaded."
          onRetry={refresh}
        />
      )}
      {status === "success" && (
        <div className="config-manager-roles-grid">
          <div className="card" style={{ overflow: "hidden" }}>
            <div
              style={{
                padding: 20,
                borderBottom: "1px solid var(--border-default)",
              }}
            >
              <h3
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                Organization Roles
              </h3>
            </div>
            <RoleList
              roles={roles}
              selectedRoleId={effectiveSelectedId}
              onSelect={setSelectedRoleId}
            />
          </div>
          <div className="card" style={{ padding: 24 }}>
            <RoleDetails role={selectedRole} />
          </div>
        </div>
      )}
      {selectedRole && (
        <RoleMembers key={selectedRole.id} role={selectedRole} />
      )}
    </>
  );
}
