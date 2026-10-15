import { BaselineHome } from "./BaselineHome";
import { readPreferences } from "../../services/preferences";
import { loginDestination } from "../../routes/workspaces";
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import type { PublicPlans } from "../../services/contracts";
import { request } from "../../services/session";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { ErrorState, LoadingState } from "../../components/OperationalStates";
const loadPublicPlans = () =>
  request<PublicPlans>("/api/v1/tenant/onboarding/plans", {
    authenticated: false,
  });
function PublicPlans() {
  const resource = useAsyncResource(loadPublicPlans);
  const money = (value: string, currency: string) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
      Number(value),
    );
  return (
    <section
      className="landing-pricing"
      id="pricing"
      aria-labelledby="pricing-title"
    >
      <div className="landing-features-header">
        <h2 id="pricing-title">Pricing Built Around Your Team</h2>
        <p>Choose an active plan and configure seats and optional add-ons.</p>
      </div>
      {resource.status === "loading" ? (
        <LoadingState message="Loading active plans..." />
      ) : resource.status === "error" ? (
        <ErrorState
          description="Pricing is temporarily unavailable."
          onRetry={resource.refresh}
        />
      ) : (
        <div className="landing-pricing-grid">
          {resource.data.items.map((plan) => (
            <article className="landing-pricing-card" key={plan.id}>
              <div className="landing-pricing-card-header">
                <h3>{plan.name}</h3>
                <p>{plan.description || "Active FinStack plan."}</p>
              </div>
              <div className="landing-pricing-price">
                <strong>{money(plan.basePrice, plan.currency)}</strong>
                <span>/ {plan.billingInterval.toLowerCase()}</span>
              </div>
              <dl className="landing-pricing-meta">
                <div>
                  <dt>Included employees</dt>
                  <dd>{plan.includedEmployeeCount} seats</dd>
                </div>
                <div>
                  <dt>Additional employee</dt>
                  <dd>
                    {money(plan.additionalEmployeePrice, plan.currency)} /
                    employee
                  </dd>
                </div>
              </dl>
              {[false, true].map(
                (addOn) =>
                  plan.features.some(
                    (feature) => feature.isAddOn === addOn,
                  ) && (
                    <div
                      key={String(addOn)}
                      className="landing-pricing-feature-group"
                    >
                      <p className="landing-pricing-feature-heading">
                        {addOn ? "Optional paid add-ons" : "Included features"}
                      </p>
                      <ul className="landing-pricing-feature-list">
                        {plan.features
                          .filter((feature) => feature.isAddOn === addOn)
                          .map((feature) => (
                            <li key={feature.id}>
                              {feature.name}
                              {addOn
                                ? ` (${money(feature.addOnPrice, plan.currency)})`
                                : feature.value != null
                                  ? `: ${feature.value === true ? "Enabled" : String(feature.value)}`
                                  : ""}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ),
              )}
              {!!plan.trialDays && (
                <p className="landing-pricing-trial">
                  {plan.trialDays}-day trial available
                </p>
              )}
              <Link
                to="/register"
                className="landing-hero-btn landing-hero-btn-primary"
              >
                {plan.trialDays ? "Start Free Trial" : "Get Started"}
              </Link>
            </article>
          ))}
          {!resource.data.items.length && (
            <p>No active plans are available at the moment.</p>
          )}
        </div>
      )}
      <p className="landing-pricing-note">
        Your recurring subscription is based on the selected plan, employee
        count, and optional paid add-ons.
      </p>
    </section>
  );
}
export function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete = "new-password",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field" htmlFor={id}>
      {label}
      <div className="password-control">
        <input
          className="form-input"
          id={id}
          type={visible ? "text" : "password"}
          required
          minLength={autoComplete === "current-password" ? undefined : 8}
          maxLength={200}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </label>
  );
}
export function LoginPage() {
  const location = useLocation();
  const auth = useAuth(),
    navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow-purple" aria-hidden="true" />
      <div className="auth-card">
        <Link to="/" className="login-brand">
          <span className="sidebar-logo-icon">F</span>FinStack
        </Link>
        <section className="auth-card-inner">
          <h1>Welcome back</h1>
          <p>Sign in with your employee ID.</p>
          <form
            id="login-form"
            aria-busy={busy}
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              if (
                !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(employeeId.trim())
              ) {
                setError(
                  "Enter an Employee ID starting with a letter or number, using letters, numbers, periods, underscores or hyphens.",
                );
                return;
              }
              setBusy(true);
              setError("");
              try {
                const result = await auth.login(employeeId.trim(), password);
                setPassword("");
                navigate(loginDestination(result.user.role, location.state?.from, readPreferences().defaultView), { replace: true });
              } catch (caught) {
                setError(
                  caught instanceof Error
                    ? caught.message
                    : "Sign in could not be completed.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field" htmlFor="employee-id">
              Employee ID
              <input
                id="employee-id"
                className="form-input"
                required
                maxLength={80}
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                autoComplete="username"
                placeholder="e.g. CFG-1234 or EMP-1001"
                autoCapitalize="none"
                spellCheck={false}
              />
            </label>
            <PasswordInput
              id="password-input"
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              id="login-submit"
              className="btn btn-primary"
              disabled={busy}
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <div className="login-links">
            <Link to="/forgot-password">Forgot password?</Link>
            <Link to="/account-request">Request an account</Link>
            <Link to="/register">Register an organization</Link>
          </div>
        </section>
        <Link className="login-home" to="/">
          Back to home
        </Link>
      </div>
    </main>
  );
}
export function HomePage() {
  return <BaselineHome pricing={<PublicPlans />} />;
}
export function GuidancePage({ kind }: { kind: string }) {
  const password = kind === "forgot-password" || kind === "reset-password";
  return (
    <section className="registration-content">
      <h1>
        {password
          ? "Password Assistance"
          : kind === "account-request"
            ? "Request an Account"
            : "Help & Contact"}
      </h1>
      <p>
        {password
          ? "Contact your organization administrator through your established workplace channel for identity-verified account recovery."
          : kind === "account-request"
            ? "Your organization administrator can provision an account and provide your Employee ID."
            : "For account or billing help, use your organization's established FinStack support contact."}
      </p>

      <div className="public-links">
        <Link to="/login">Back to Login</Link>
        {!password && <Link to="/forgot-password">Password Assistance</Link>}
        <Link to="/register">Register organization</Link>
      </div>
    </section>
  );
}
export function ActivationPage() {
  // Read the single-use secret once, then remove it from the address/history.
  const [link] = useState(() => {
    const values = new URLSearchParams(window.location.hash.slice(1));
    const result = {
      token: values.get("token") || "",
      employeeId: values.get("employeeId") || "",
    };
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname,
    );
    return result;
  });
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState("");
  const valid = /^[a-f0-9]{64}$/.test(link.token) && Boolean(link.employeeId);
  return (
    <section className="registration-content">
      <h1>Set up your account</h1>
      <p>Single-use activation for an imported employee account.</p>
      {!valid && (
        <p role="alert">
          Activation link is invalid. Request a new link from your Configuration
          Manager.
        </p>
      )}
      {done ? (
        <>
          <p role="status">
            Your password is set. Sign in with your Employee ID.
          </p>
          <Link className="btn btn-primary" to="/login">
            Sign in
          </Link>
        </>
      ) : (
        <form
          id="activation-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || !valid) return;
            if (password !== confirm) {
              setError("Passwords must match.");
              return;
            }
            setBusy(true);
            setError("");
            try {
              await request("/api/v1/tenant/employee-activation", {
                authenticated: false,
                method: "POST",
                body: { ...link, password },
              });
              link.token = "";
              setPassword("");
              setConfirm("");
              setDone(true);
            } catch (caught) {
              setError(
                caught instanceof Error ? caught.message : "Activation failed.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            Employee ID
            <input
              id="activation-employee"
              className="form-input"
              value={link.employeeId}
              readOnly
              autoComplete="username"
            />
          </label>
          <PasswordInput
            id="activation-password"
            label="Password"
            value={password}
            onChange={setPassword}
          />
          <PasswordInput
            id="activation-confirm"
            label="Confirm password"
            value={confirm}
            onChange={setConfirm}
          />
          {error && <p role="alert">{error}</p>}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !valid}
          >
            {busy ? "Setting password…" : "Set password"}
          </button>
        </form>
      )}
    </section>
  );
}
export function NotFoundPage({ forbidden = false }: { forbidden?: boolean }) {
  return (
    <section className="public-card">
      <h1>{forbidden ? "Access denied" : "Page not found"}</h1>
      <p>
        {forbidden
          ? "Your account does not have access to this workspace."
          : "This address does not match a client page."}
      </p>
      <Link to="/login">Return to sign in</Link>
    </section>
  );
}
