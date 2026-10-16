import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import type {
  PublicPlans,
  Quote,
  RegistrationReceipt,
} from "../../services/contracts";
import { request } from "../../services/session";
import { countryCodes, registrationErrors, isRegistrationEmployeeId } from "./registrationValidation";
import { PasswordInput } from "./PublicPages";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { ErrorState, LoadingState } from "../../components/OperationalStates";
const RECEIPT = "finstack.registration.employee-id";
const empty = {
  name: "",
  registrationCountry: "",
  registrationIdentifier: "",
  registrationExemptionReason: "",
  primaryEmail: "",
  firstName: "",
  lastName: "",
  authorizedContactTitle: "",
  email: "",
  password: "",
  confirmPassword: "",
  employeeCount: "1",
  planId: "",
};
const names = new Intl.DisplayNames(["en"], { type: "region" });
const countries = countryCodes
  .map((code: string) => ({ code, name: names.of(code) }))
  .sort((a: any, b: any) => a.name.localeCompare(b.name));
const loadPlans = () =>
  request<PublicPlans>("/api/v1/tenant/onboarding/plans", {
    authenticated: false,
  });
export function RegistrationPage() {
  const [values, setValues] = useState(empty),
    [features, setFeatures] = useState<string[]>([]),
    [touched, setTouched] = useState<Record<string, boolean>>({}),
    [qa, setQa] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [quote, setQuote] = useState("");
  const plans = useAsyncResource(loadPlans),
    navigate = useNavigate();
  const saved = sessionStorage.getItem(RECEIPT);
  const valuesForServer = {
    ...values,
    employeeCount: Number(values.employeeCount),
  };
  const errors = registrationErrors(valuesForServer, qa) as unknown as Record<
    string,
    string
  >;
  const selectedPlan = plans.data?.items.find(
    (item) => item.id === values.planId,
  );
  useEffect(() => {
    const controller = new AbortController();
    request("/api/v1/tenant/onboarding/environment", {
      authenticated: false,
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted)
          setQa(
            data.manualQa === true &&
              ["localhost", "127.0.0.1", "[::1]"].includes(
                window.location.hostname,
              ),
          );
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    setQuote("");
    if (
      !values.planId ||
      !Number.isInteger(Number(values.employeeCount)) ||
      Number(values.employeeCount) < 1 ||
      Number(values.employeeCount) > 1000000
    )
      return;
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        request<Quote>("/api/v1/tenant/onboarding/quotes", {
          authenticated: false,
          method: "POST",
          signal: controller.signal,
          body: {
            planId: values.planId,
            employeeCount: Number(values.employeeCount),
            featureIds: features,
          },
        })
          .then((data) => {
            if (!controller.signal.aborted)
              setQuote(
                `Server-calculated recurring quote: ${data.currency} ${data.totalAmount} / ${data.billingInterval.toLowerCase()}. Approval and commercial activation are separate.`,
              );
          })
          .catch(() => {
            if (!controller.signal.aborted)
              setQuote(
                "Quote unavailable. Retry with a valid plan and seat count.",
              );
          }),
      300,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [values.planId, values.employeeCount, features]);
  if (isRegistrationEmployeeId(saved))
    return <Navigate to="/registration/receipt" replace />;
  function update(key: keyof typeof empty, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setError("");
  }
  function field(
    key: keyof typeof empty,
    label: string,
    options: {
      type?: string;
      maxLength?: number;
      required?: boolean;
      help?: string;
    } = {},
  ) {
    const { help, ...input } = options;
    return (
      <label className="field" htmlFor={`reg-${key}`}>
        {label}
        <input
          id={`reg-${key}`}
          className="form-input"
          value={values[key]}
          onChange={(e) => update(key, e.target.value)}
          onBlur={() => setTouched((v) => ({ ...v, [key]: true }))}
          aria-invalid={Boolean(touched[key] && errors[key])}
          aria-describedby={`reg-${key}-error`}
          maxLength={180}
          required
          {...input}
        />
        {help && <small>{help}</small>}
        <small className="form-error" id={`reg-${key}-error`}>
          {touched[key] && errors[key]}
        </small>
      </label>
    );
  }
  return (
    <section className="registration-content registration-card">
      <Link to="/login">FinStack - Client login</Link>
      <h1>Register your organization</h1>
      <p>
        Submit legal organization details for manual review. Registration does
        not verify identity, domain ownership or email delivery.
      </p>
      {qa && (
        <p className="qa-notice" role="status">
          LOCAL MANUAL QA · isolated database. Fictional .test mailboxes are
          accepted. No legal identity or domain ownership is verified.
        </p>
      )}
      {plans.status === "loading" && (
        <LoadingState message="Loading available plans…" />
      )}
      {plans.status === "error" && (
        <ErrorState
          description="Registration plans could not be loaded."
          onRetry={plans.refresh}
        />
      )}
      <form
        id="reg-form"
        aria-busy={busy}
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setTouched(
            Object.fromEntries(Object.keys(empty).map((key) => [key, true])),
          );
          if (Object.keys(errors).length) {
            setError("Review the highlighted fields before submitting.");
            return;
          }
          setBusy(true);
          setError("");
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 20000);
          try {
            const { confirmPassword: _confirm, ...body } = valuesForServer;
            const result = await request<RegistrationReceipt>(
              "/api/v1/tenant/registrations/organizations",
              {
                authenticated: false,
                method: "POST",
                body: { ...body, featureIds: features },
                signal: controller.signal,
              },
            );
            setValues(empty);
            sessionStorage.setItem(RECEIPT, result.employeeId);
            navigate("/registration/receipt", { replace: true });
          } catch (caught) {
            setError(
              caught instanceof Error && caught.name === "AbortError"
                ? "Submission timed out and may have been saved. Do not assume it failed or repeatedly resubmit. Online receipt recovery is unavailable."
                : caught instanceof Error
                  ? caught.message
                  : "Registration could not be submitted.",
            );
          } finally {
            clearTimeout(timeout);
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <legend>Organization legal identity</legend>
          <div className="registration-grid">
            {field("name", "Legal organization name")}
            <label className="field" htmlFor="reg-registrationCountry">
              Registration country
              <select
                id="reg-registrationCountry"
                className="form-input"
                value={values.registrationCountry}
                onChange={(e) => update("registrationCountry", e.target.value)}
              >
                <option value="">Select country</option>
                {countries.map((item: any) => (
                  <option value={item.code} key={item.code}>
                    {item.name} ({item.code})
                  </option>
                ))}
              </select>
              {touched.registrationCountry && (
                <small className="form-error">
                  {errors.registrationCountry}
                </small>
              )}
            </label>
            {field(
              "registrationIdentifier",
              "Government-issued registration identifier",
              {
                required: false,
                maxLength: 160,
                help: "Use the identifier as issued by the registry, or explain below why none applies. Do not enter personal identity numbers.",
              },
            )}
            {field(
              "registrationExemptionReason",
              "Why no registration identifier applies",
              { required: false, maxLength: 500 },
            )}
            {field("primaryEmail", "Official organization email", {
              type: "email",
              maxLength: 320,
            })}
          </div>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Authorized contact</legend>
          <div className="registration-grid">
            {field("firstName", "Authorized contact first name", {
              maxLength: 100,
            })}
            {field("lastName", "Authorized contact last name", {
              maxLength: 100,
            })}
            {field("authorizedContactTitle", "Authorized contact title", {
              maxLength: 120,
            })}
            {field("email", "Authorized contact email", {
              type: "email",
              maxLength: 320,
              help: "Use the same domain as the official organization email.",
            })}
          </div>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Login credentials</legend>
          <div className="registration-grid">
            <div>
              <PasswordInput
                id="reg-password"
                label="Password"
                value={values.password}
                onChange={(v) => update("password", v)}
              />
              {touched.password && (
                <small className="form-error">{errors.password}</small>
              )}
            </div>
            <div>
              <PasswordInput
                id="reg-confirm-password"
                label="Confirm password"
                value={values.confirmPassword}
                onChange={(v) => update("confirmPassword", v)}
              />
              {touched.confirmPassword && (
                <small className="form-error">{errors.confirmPassword}</small>
              )}
            </div>
          </div>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Plan & seats</legend>
          <div className="registration-grid">
            {field("employeeCount", "Employee count", { type: "number" })}
            <label className="field" htmlFor="reg-planId">
              Plan
              <select
                id="reg-planId"
                className="form-input"
                value={values.planId}
                onChange={(e) => {
                  update("planId", e.target.value);
                  setFeatures([]);
                }}
              >
                <option value="">Select an active plan</option>
                {plans.data?.items.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · {plan.currency} {plan.basePrice}
                  </option>
                ))}
              </select>
              {touched.planId && (
                <small className="form-error">{errors.planId}</small>
              )}
            </label>
          </div>
          {selectedPlan?.features
            .filter((item) => item.isAddOn)
            .map((feature) => (
              <label className="checkbox-field" key={feature.id}>
                <input
                  type="checkbox"
                  checked={features.includes(feature.id)}
                  onChange={(e) =>
                    setFeatures((v) =>
                      e.target.checked
                        ? [...v, feature.id]
                        : v.filter((id) => id !== feature.id),
                    )
                  }
                />
                {feature.name} · {selectedPlan.currency} {feature.addOnPrice}
              </label>
            ))}
          {quote && <p role="status">{quote}</p>}
        </fieldset>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            className="btn btn-primary"
            disabled={busy || plans.status !== "success"}
          >
            {busy ? "Submitting…" : "Submit for review"}
          </button>
          <Link to="/login">Already registered? Sign in</Link>
        </div>
      </form>
    </section>
  );
}
export function RegistrationReceiptPage() {
  const navigate = useNavigate();
  const employeeId = sessionStorage.getItem(RECEIPT);
  if (!isRegistrationEmployeeId(employeeId))
    return (
      <section className="registration-content">
        <h1>No receipt in this tab</h1>
        <p>
          Online receipt recovery is unavailable. If you already submitted,
          contact your authorized platform team before resubmitting.
        </p>
        <Link to="/register">Registration</Link>
      </section>
    );
  return (
    <section className="registration-content" id="success-card">
      <h1>Submitted for organization review</h1>
      <p>
        Save your Employee ID:{" "}
        <strong id="success-admin-emp-id" className="receipt-id">
          {employeeId}
        </strong>
      </p>
      <p>
        At submission: pending organization review; domain ownership unverified.
        This receipt is not approval and does not query the current decision.
      </p>
      <p>
        Use this Employee ID and your chosen password after Admin approval. Keep
        a copy before closing this tab. No password is stored in the receipt.
      </p>
      <div className="action-row">
        <button
          className="btn btn-primary"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob(
                [
                  `FinStack registration receipt\nEmployee ID: ${employeeId}\nUse your chosen password after Admin approval. This receipt does not prove approval.\n`,
                ],
                { type: "text/plain;charset=utf-8" },
              ),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "finstack-employee-id.txt";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Download Employee ID receipt
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => {
            sessionStorage.removeItem(RECEIPT);
            navigate("/register");
          }}
        >
          Start another registration
        </button>
        <Link to="/login">Return to login</Link>
      </div>
    </section>
  );
}
