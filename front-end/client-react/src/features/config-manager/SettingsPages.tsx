import {
  useState,
  useRef,
  useId,
  Children,
  isValidElement,
  cloneElement,
  type ReactNode,
  type FormEvent,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { request } from "../../services/session";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { LoadingState, ErrorState } from "../../components/OperationalStates";
import { Icon } from "../../components/Icon";
import { ConfirmDialog, ToggleSwitch } from "../../components/CrudPrimitives";
import {
  readPreferences,
  savePreferences,
  type Preferences,
} from "../../services/preferences";
const base = "/api/v1/tenant/configuration/settings";
export function SettingsCard({
  title,
  description,
  icon = "settings",
  color = "purple",
  children,
}: {
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  children: ReactNode;
}) {
  return (
    <section className="card restored-settings-card">
      <div className="settings-card-heading">
        <div className={`icon-box icon-box-${color}`}>
          <Icon name={icon} />
        </div>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  let attached = false;
  const labelControl = (node: ReactNode): ReactNode =>
    Children.map(node, (child) => {
      if (
        !isValidElement<{
          children?: ReactNode;
          id?: string;
          "aria-describedby"?: string;
        }>(child)
      )
        return child;
      if (
        !attached &&
        typeof child.type === "string" &&
        ["input", "select", "textarea"].includes(child.type)
      ) {
        attached = true;
        return cloneElement(child, {
          id,
          "aria-describedby": hint ? id + "-help" : undefined,
        });
      }
      if (child.props.children)
        return cloneElement(child, {}, labelControl(child.props.children));
      return child;
    });
  const controls = labelControl(children);
  return (
    <div className="settings-field">
      <label className="form-label" htmlFor={attached ? id : undefined}>
        {label}
      </label>
      {controls}
      {hint && <small id={id + "-help"}>{hint}</small>}
    </div>
  );
}
const PageTitle = ({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) => (
  <div className="page-header">
    <div className="page-header-text">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    {action}
  </div>
);
interface OrganizationSettings {
  id: string;
  name: string;
  primaryEmail: string;
  defaultCurrency: string;
  timezone: string;
  registrationIdentifier: string;
  taxId: string;
  address: string;
  companySize: string;
  fiscalYearStart: string;
  defaultPaymentMethod: string;
}
const loadOrganization = () =>
  request<OrganizationSettings>(base + "/organization");
export function OrganizationSettingsPage() {
  const data = useAsyncResource(loadOrganization);
  const [saving, setSaving] = useState(false);
  return (
    <>
      <PageTitle
        title="Organization Settings"
        description="Manage your organization's profile and configuration"
        action={
          data.status === "success" ? (
            <button
              className="btn btn-primary"
              type="submit"
              form="organization-settings-form"
              disabled={saving}
            >
              <Icon name="save" size={16} />
              Save Changes
            </button>
          ) : null
        }
      />
      {data.status === "loading" ? (
        <LoadingState />
      ) : data.status === "error" ? (
        <ErrorState description={data.error.message} onRetry={data.refresh} />
      ) : (
        <OrganizationForm initial={data.data} onSavingChange={setSaving} />
      )}
    </>
  );
}
function OrganizationForm({
  initial,
  onSavingChange,
}: {
  initial: OrganizationSettings;
  onSavingChange: (busy: boolean) => void;
}) {
  const requestLock = useRef(false);
  const [values, setValues] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (requestLock.current) return;
    requestLock.current = true;
    setBusy(true);
    onSavingChange(true);
    setError("");
    try {
      const saved = await request<OrganizationSettings>(
        base + "/organization",
        {
          method: "PATCH",
          body: {
            companySize: values.companySize,
            fiscalYearStart: values.fiscalYearStart,
            defaultPaymentMethod: values.defaultPaymentMethod,
          },
        },
      );
      setValues(saved);
      setNotice("Organization settings saved.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Save failed.");
    } finally {
      requestLock.current = false;
      setBusy(false);
      onSavingChange(false);
    }
  }
  return (
    <form
      id="organization-settings-form"
      className="restored-settings"
      onSubmit={submit}
    >
      <div className="settings-grid">
        <SettingsCard
          title="Organization Information"
          description="Your organization profile"
        >
          <div className="settings-fields">
            <Field
              label="Organization Name"
              hint="Registered identity is managed by the platform team."
            >
              <input className="form-input" readOnly value={values.name} />
            </Field>
            <Field label="Organization ID">
              <input className="form-input" readOnly value={values.id} />
            </Field>
            <Field
              label="Organization Email"
              hint="Contact the platform team to change your registered email."
            >
              <input
                className="form-input"
                readOnly
                value={values.primaryEmail}
              />
            </Field>
            <Field label="Company Size">
              <select
                className="form-input"
                value={values.companySize}
                onChange={(event) =>
                  setValues({ ...values, companySize: event.target.value })
                }
              >
                <option value="">Not provided</option>
                {[
                  "1-10 employees",
                  "11-50 employees",
                  "51-200 employees",
                  "201-500 employees",
                  "500+ employees",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Address"
              hint="Registered address changes require review."
            >
              <textarea
                className="form-input"
                readOnly
                rows={2}
                value={values.address}
              />
            </Field>
          </div>
        </SettingsCard>
        <SettingsCard
          title="Financial Settings"
          color="cyan"
          description="Expense defaults for your organization"
        >
          <div className="settings-fields">
            <Field
              label="Default Currency"
              hint="Currency is controlled with your organization and billing setup."
            >
              <select
                className="form-input"
                disabled
                value={values.defaultCurrency}
              >
                <option>{values.defaultCurrency}</option>
              </select>
            </Field>
            <Field label="Fiscal Year Start">
              <select
                className="form-input"
                value={values.fiscalYearStart}
                onChange={(event) =>
                  setValues({ ...values, fiscalYearStart: event.target.value })
                }
              >
                {["January", "April", "July", "October"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Tax ID / EIN"
              hint="Verified identifiers require platform review."
            >
              <input
                className="form-input"
                readOnly
                value={values.taxId || ""}
              />
            </Field>
            <Field
              label="Default Payment Method"
              hint="A reimbursement preference; does not initiate payments."
            >
              <select
                className="form-input"
                value={values.defaultPaymentMethod}
                onChange={(event) =>
                  setValues({
                    ...values,
                    defaultPaymentMethod: event.target.value,
                  })
                }
              >
                {["Bank Transfer", "Corporate Card", "Check"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
          </div>
        </SettingsCard>
        <SettingsCard
          title="Notification Preferences"
          color="green"
          description="Organization notification channels"
        >
          {[
            ["Email Notifications", "Email delivery is not connected."],
            ["Slack Integration", "Slack delivery is not connected."],
            ["Budget Alerts", "Budget monitoring is not configured."],
          ].map(([label, hint]) => (
            <PreferenceToggle
              key={label}
              label={label}
              hint={hint}
              checked={false}
              disabled
              onChange={() => {}}
            />
          ))}
          <div className="settings-row">
            <div className="settings-row-info">
              <h4>Policy Violation Alerts</h4>
              <p>
                Review policy alerts currently available in your notifications.
              </p>
            </div>
            <Link
              className="btn btn-secondary"
              to="/configuration/notifications"
            >
              View alerts
            </Link>
          </div>
        </SettingsCard>
        <SettingsCard
          title="Danger Zone"
          color="pink"
          description="Sensitive organization operations"
        >
          <div className="settings-row">
            <div className="settings-row-info">
              <h4>Export All Data</h4>
              <p>
                Download tenant configuration, users, policies, categories and
                audit records (up to 10,000 each). Expense and billing exports
                remain in their authorized modules.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const result = await request(base + "/organization-export");
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(result, null, 2)], {
                      type: "application/json",
                    }),
                  );
                  const anchor = document.createElement("a");
                  anchor.href = url;
                  anchor.download = "organization-configuration.json";
                  anchor.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                  setNotice(
                    "Configuration export downloaded. Each collection includes up to 10,000 records.",
                  );
                } catch (error) {
                  setError(
                    error instanceof Error ? error.message : "Export failed.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Export
            </button>
          </div>
          <div className="settings-row">
            <div className="settings-row-info">
              <h4>Delete Organization</h4>
              <p>Organization deletion requires platform review.</p>
            </div>
            <button className="btn btn-outline-red" type="button" disabled>
              Delete
            </button>
          </div>
          <Link to="/configuration/help?from=organization-settings">
            Contact guidance
          </Link>
        </SettingsCard>
      </div>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </form>
  );
}
interface Profile {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  phone: string;
  location: string;
  avatarColor: string;
  role: string;
  status: string;
}
const loadProfile = () => request<Profile>(base + "/profile");
export function ProfilePage() {
  const resource = useAsyncResource(loadProfile);
  const [saving, setSaving] = useState(false);
  return (
    <>
      <PageTitle
        title="Profile Settings"
        description="Manage your personal information and account security"
        action={
          resource.status === "success" ? (
            <button
              className="btn btn-primary"
              type="submit"
              form="profile-settings-form"
              disabled={saving}
            >
              <Icon name="save" size={16} />
              Save Changes
            </button>
          ) : null
        }
      />
      {resource.status === "loading" ? (
        <LoadingState />
      ) : resource.status === "error" ? (
        <ErrorState
          description={resource.error.message}
          onRetry={resource.refresh}
        />
      ) : (
        <ProfileForm initial={resource.data} onSavingChange={setSaving} />
      )}
    </>
  );
}
function ProfileForm({
  initial,
  onSavingChange,
}: {
  initial: Profile;
  onSavingChange: (busy: boolean) => void;
}) {
  const requestLock = useRef(false);
  const auth = useAuth();
  const [values, setValues] = useState({
      ...initial,
      fullName: `${initial.firstName} ${initial.lastName}`.trim(),
      phone: initial.phone || "",
      location: initial.location || "",
      avatarColor: initial.avatarColor || "#7C3AED",
    }),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [avatar, setAvatar] = useState(false),
    [revoke, setRevoke] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (requestLock.current) return;
    const nameParts = values.fullName.trim().split(/\s+/);
    if (
      nameParts[0]?.length > 100 ||
      nameParts.slice(1).join(" ").length > 100
    ) {
      setError(
        "Use a first name and remaining names of up to 100 characters each.",
      );
      return;
    }
    if (values.phone && !/^[+()\d .-]{1,40}$/.test(values.phone)) {
      setError(
        "Enter a phone number using digits, spaces, and + ( ) . - only.",
      );
      return;
    }
    requestLock.current = true;
    setBusy(true);
    onSavingChange(true);
    setError("");
    try {
      await request(base + "/profile", {
        method: "PATCH",
        body: {
          fullName: values.fullName,
          phone: values.phone,
          location: values.location,
          avatarColor: values.avatarColor,
        },
      });
      auth.retry();
      setNotice("Profile updated.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Save failed.");
    } finally {
      requestLock.current = false;
      setBusy(false);
      onSavingChange(false);
    }
  }
  return (
    <div className="restored-settings">
      <SettingsCard
        title="Personal Information"
        description="Update your profile details"
      >
        <form id="profile-settings-form" onSubmit={submit}>
          <div className="profile-summary">
            <div
              className="avatar avatar-xl"
              style={{ background: values.avatarColor }}
            >
              {values.fullName
                .split(/\s+/)
                .map((word) => word[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div>
              <h3>{values.fullName}</h3>
              <p>
                {initial.role.replaceAll("_", " ")} · {initial.status}
              </p>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setAvatar(!avatar)}
              >
                Change Avatar
              </button>
              {avatar && (
                <div className="avatar-options">
                  {["#7C3AED", "#22D3EE", "#EC4899", "#10B981"].map((color) => (
                    <button
                      type="button"
                      key={color}
                      aria-label={`Avatar color ${color}`}
                      aria-pressed={values.avatarColor === color}
                      style={{ background: color }}
                      onClick={() =>
                        setValues({ ...values, avatarColor: color })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="settings-fields">
            {(
              [
                "fullName",
                "email",
                "employeeId",
                "department",
                "phone",
                "location",
              ] as const
            ).map((key, index) => (
              <Field
                key={key}
                label={
                  [
                    "Full Name",
                    "Email Address",
                    "Employee ID",
                    "Department",
                    "Phone Number",
                    "Location",
                  ][index]
                }
                hint={
                  key === "email"
                    ? "Email changes require authorized account administration."
                    : undefined
                }
              >
                <input
                  className="form-input"
                  readOnly={["email", "employeeId", "department"].includes(key)}
                  required={key === "fullName"}
                  maxLength={
                    key === "phone" ? 40 : key === "fullName" ? 201 : 180
                  }
                  title={
                    key === "phone"
                      ? "Digits, spaces, and + ( ) . - only"
                      : undefined
                  }
                  type={key === "phone" ? "tel" : "text"}
                  value={values[key]}
                  onChange={(event) =>
                    setValues({ ...values, [key]: event.target.value })
                  }
                />
              </Field>
            ))}
          </div>
          <p className="field-help">
            Email address changes require identity verification by your
            organization’s authorized account administrator.{" "}
            <Link to="/configuration/help?from=profile-settings">
              Contact guidance
            </Link>
          </p>
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
        </form>
      </SettingsCard>
      <PasswordSection />
      <SettingsCard
        title="Active Sessions"
        color="green"
        description="Manage access to your account"
      >
        <div className="settings-row">
          <div className="settings-row-info">
            <h4>
              Current sign-in <span className="badge badge-green">Active</span>
            </h4>
            <p>
              Signed in as {initial.employeeId}. Individual device sessions and
              locations are not tracked.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline-red"
            onClick={() => setRevoke(true)}
          >
            Revoke all sessions
          </button>
        </div>
        <p>
          Revoking sessions signs out all active tokens, including this one.
        </p>
      </SettingsCard>
      <ConfirmDialog
        open={revoke}
        title="Revoke all sessions?"
        description="You will need to sign in again on every device, including this browser."
        onCancel={() => setRevoke(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await request(base + "/session-revocations", { method: "POST" });
            auth.logout();
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Could not revoke sessions.",
            );
          } finally {
            setBusy(false);
          }
        }}
        submitting={busy}
        confirmLabel="Revoke sessions"
        confirmingLabel="Revoking..."
      />
    </div>
  );
}
export function PasswordSection() {
  const auth = useAuth();
  const [currentPassword, setCurrent] = useState(""),
    [newPassword, setNew] = useState(""),
    [confirmPassword, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  return (
    <SettingsCard
      title="Change Password"
      icon="shieldCheck"
      color="cyan"
      description="Update your account password"
    >
      {done ? (
        <p role="status">
          Password updated. Sign in again with your new password.
        </p>
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (newPassword !== confirmPassword) {
              setError("New passwords do not match.");
              return;
            }
            if (
              newPassword.length < 12 ||
              newPassword.length > 128 ||
              !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(
                newPassword,
              )
            ) {
              setError(
                "Use 12–128 characters with uppercase and lowercase letters, a number, and a symbol.",
              );
              return;
            }
            setBusy(true);
            setError("");
            try {
              await request(base + "/password-changes", {
                method: "POST",
                body: { currentPassword, newPassword, confirmPassword },
              });
              setCurrent("");
              setNew("");
              setConfirm("");
              setDone(true);
              auth.logout();
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Password update failed.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="password-fields">
            {[
              ["Current Password", currentPassword, setCurrent],
              ["New Password", newPassword, setNew],
              ["Confirm Password", confirmPassword, setConfirm],
            ].map(([label, value, setter], index) => (
              <PasswordField
                key={String(label)}
                label={String(label)}
                value={String(value)}
                setValue={setter as (value: string) => void}
                fresh={index !== 0}
              />
            ))}
          </div>
          <p className="field-help">
            Use 12-128 characters with uppercase, lowercase, a number and a
            symbol. Updating your password signs out all sessions.
          </p>
          {error && <p role="alert">{error}</p>}
          <button className="btn btn-primary" disabled={busy}>
            Update Password
          </button>
          <Link to="/configuration/password-assistance?from=profile-settings">
            Password assistance
          </Link>
        </form>
      )}
    </SettingsCard>
  );
}
function PasswordField({
  label,
  value,
  setValue,
  fresh,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  fresh: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label}>
      <div className="password-control">
        <input
          className="form-input"
          required
          minLength={fresh ? 12 : 1}
          maxLength={fresh ? 128 : 200}
          autoComplete={fresh ? "new-password" : "current-password"}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button
          type="button"
          className="input-icon-right"
          aria-label={`${visible ? "Hide" : "Show"} ${label}`}
          onClick={() => setVisible(!visible)}
        >
          <Icon name="eye" />
        </button>
      </div>
    </Field>
  );
}
function PreferenceToggle({
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <h4>{label}</h4>
        <p>{hint}</p>
      </div>
      <ToggleSwitch
        label={label}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}
export function PreferencesPage() {
  const [values, setValues] = useState(readPreferences),
    [notice, setNotice] = useState(""),
    [saving, setSaving] = useState(false);
  const set = (key: keyof Preferences, value: Preferences[keyof Preferences]) =>
    setValues({ ...values, [key]: value });
  return (
    <>
      <PageTitle
        title="Preferences"
        description="Customize your FinStack experience"
        action={
          <button
            className="btn btn-primary"
            form="preferences-form"
            type="submit"
            disabled={saving}
          >
            <Icon name="save" size={16} />
            Save Preferences
          </button>
        }
      />
      <form
        id="preferences-form"
        className="restored-settings"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setNotice("");
          try {
            const saved = await savePreferences(values);
            setValues(saved);
            setNotice("Preferences saved to your account.");
          } catch {
            setNotice("Preferences could not be saved. Please retry.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="settings-grid">
          <SettingsCard
            title="Appearance"
            description="Customize the look and feel of your interface"
          >
            <Field label="Theme">
              <div className="theme-options">
                {["Dark", "Light", "System"].map((theme) => (
                  <button
                    type="button"
                    className="theme-option"
                    key={theme}
                    aria-pressed={values.theme === theme.toLowerCase()}
                    onClick={() =>
                      set("theme", theme.toLowerCase() as Preferences["theme"])
                    }
                  >
                    {theme}
                  </button>
                ))}
              </div>
              <small>System follows this device appearance setting.</small>
            </Field>
            <PreferenceToggle
              label="Compact Mode"
              hint="Reduce spacing for more content on screen"
              checked={values.compactMode}
              onChange={(value) => set("compactMode", value)}
            />
            <PreferenceToggle
              label="Animations"
              hint="Enable smooth transitions"
              checked={values.animations}
              onChange={(value) => set("animations", value)}
            />
          </SettingsCard>
          <SettingsCard
            title="Language & Region"
            color="cyan"
            description="Set your regional display preferences"
          >
            <div className="settings-fields">
              <Field label="Language">
                <select
                  className="form-input"
                  value={values.language}
                  onChange={(event) => set("language", event.target.value)}
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  {["Spanish", "French", "German"].map((value) => (
                    <option disabled key={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <small>
                  Interface translations are currently available in English.
                </small>
              </Field>
              <Field label="Date Format">
                <select
                  className="form-input"
                  value={values.dateFormat}
                  onChange={(event) => set("dateFormat", event.target.value)}
                >
                  {["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </Field>
              <Field label="Time Zone">
                <select
                  className="form-input"
                  value={values.timezone}
                  onChange={(event) => set("timezone", event.target.value)}
                >
                  {[
                    "Asia/Kolkata",
                    "America/Los_Angeles",
                    "America/Denver",
                    "America/Chicago",
                    "America/New_York",
                    "UTC",
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </Field>
              <Field label="Number Format">
                <select
                  className="form-input"
                  value={values.numberLocale}
                  onChange={(event) => set("numberLocale", event.target.value)}
                >
                  <option value="en-US">1,234.56</option>
                  <option value="de-DE">1.234,56</option>
                  <option value="fr-FR">1 234,56</option>
                </select>
              </Field>
            </div>
          </SettingsCard>
          <SettingsCard
            title="Personal Notifications"
            color="green"
            description="Choose browser notification behavior"
          >
            <PreferenceToggle
              label="Email Digest"
              hint="Email delivery is not connected."
              disabled
              checked={false}
              onChange={() => {}}
            />
            <PreferenceToggle
              label="Desktop Notifications"
              hint="Notify about new unread account alerts while this workspace is open."
              checked={values.desktopNotifications}
              onChange={async (checked) => {
                if (!checked) {
                  set("desktopNotifications", false);
                  return;
                }
                if (
                  "Notification" in window &&
                  (await Notification.requestPermission()) === "granted"
                )
                  set("desktopNotifications", true);
                else setNotice("Browser notification permission is required.");
              }}
            />
            <PreferenceToggle
              label="Sound Alerts"
              hint="Sound delivery is not configured."
              disabled
              checked={false}
              onChange={() => {}}
            />
          </SettingsCard>
          <SettingsCard
            title="Dashboard Preferences"
            color="pink"
            description="Customize your dashboard view"
          >
            <Field label="Default View">
              <select
                className="form-input"
                value={values.defaultView}
                onChange={(event) => set("defaultView", event.target.value)}
              >
                <option value="dashboard">Dashboard</option>
                <option value="notifications">Notifications</option>
                <option value="audit-logs">Audit Logs</option>
              </select>
            </Field>
            <Field label="Users Per Page">
              <select
                className="form-input"
                value={values.pageSize}
                onChange={(event) =>
                  set("pageSize", Number(event.target.value))
                }
              >
                {[10, 25, 50, 100].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <PreferenceToggle
              label="Auto-refresh Dashboard"
              hint="Refresh dashboard data every 60 seconds"
              checked={values.autoRefresh}
              onChange={(value) => set("autoRefresh", value)}
            />
          </SettingsCard>
        </div>
        {notice && <p role="status">{notice}</p>}
      </form>
    </>
  );
}
export function WorkspaceHelpPage({
  password = false,
}: {
  password?: boolean;
}) {
  const location = useLocation();
  const from = new URLSearchParams(location.search).get("from");
  const destination =
    from &&
    [
      "dashboard",
      "organization-settings",
      "profile-settings",
      "subscription",
      "notifications",
      "preferences",
    ].includes(from)
      ? from
      : "dashboard";
  return (
    <>
      <PageTitle
        title={password ? "Password Assistance" : "Help & Support"}
        description="Help for your authenticated workspace"
      />
      {password && <PasswordSection />}
      <SettingsCard
        title={password ? "Account access" : "Contact guidance"}
        description="Keep your account and organization information safe"
      >
        <p>
          {password
            ? "If you cannot provide your current password, use your established organization support channel for identity-verified recovery."
            : "For legal identity, billing or account restrictions, contact your authorized FinStack platform representative through your established organization channel."}
        </p>
        <div className="form-actions">
          <Link
            className="btn btn-secondary"
            to="/configuration/profile-settings"
          >
            Profile Settings
          </Link>
          <Link
            className="btn btn-secondary"
            to="/configuration/organization-settings"
          >
            Organization Settings
          </Link>
          <Link className="btn btn-secondary" to="/configuration/subscription">
            Subscription & Billing
          </Link>
          <Link
            className="btn btn-primary"
            to={`/configuration/${destination}`}
          >
            Return to workspace
          </Link>
        </div>
      </SettingsCard>
    </>
  );
}
