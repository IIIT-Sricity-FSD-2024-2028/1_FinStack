import { profileField, managerProfileField } from "../../shared/expensePresentation.js";
import { useSubmitter } from "../SubmitterContext";
import { initials } from "../utils";

export default function ProfileSettingsPage() {
  const { user } = useSubmitter();
  const manager = managerProfileField(user?.manager);
  const details = [
    ["Name", user?.fullName],
    ["Email", user?.email],
    ["Employee ID", user?.employeeId],
    ["Department", user?.department],
    ["Manager", manager],
    ["Role", "Expense Submitter"],
    ["Organization", user?.organizationName],
    ["Account status", user?.status],
  ];
  return (
    <>
      <div className="dashboard-head">
        <div>
          <h1>Profile &amp; Settings</h1>
          <p className="text-text-muted mt-1">
            Available account details from your authenticated profile
          </p>
        </div>
      </div>
      <div className="profile-grid">
        <div className="card react-profile-card">
          <div className="profile-avatar">
            <span>{initials(user?.fullName)}</span>
          </div>
          <h2>{user?.fullName || "Expense Submitter"}</h2>
          <p>{user?.email}</p>
          <div>
            <span className="badge badge-info">Expense Submitter</span>
            <span className="badge badge-success">{user?.status}</span>
          </div>
        </div>
        <div className="card react-settings-card">
          <div className="settings-panel">
            <section>
              <div className="card-title react-panel-title">
                Account information
              </div>
              <p className="profile-managed-note">
                Your account information is managed by your Configuration
                Manager.
              </p>
              <dl className="profile-details">
                {details.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{profileField(value)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
