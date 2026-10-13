import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { configManagerResources } from "../../adapters/configManagerResources";
import { ErrorState, LoadingState } from "../../components/OperationalStates";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import {
  applicableCategory,
  existingTemplate,
  validPolicySelection,
} from "./templateSelection";
import { categoryActivationSummary } from "./categoryLifecycle";
import {
  APPROVAL_OPTIONS,
  APPROVAL_NOTE,
  moneyValue,
  formatPolicyMoney,
  policyActivationSummary,
  policyFailureMessage,
  POLICY_AMOUNT_ERROR,
} from "./policyConfiguration";
import "./configuration-templates.css";

const loadCatalog = () => configManagerResources.templates.list();

export function ConfigurationTemplatePicker({
  mode,
  records,
  categories = [],
  catalogData,
  onRefreshCategories,
  onActivated,
  onClose,
}) {
  const loader = useCallback(
    () => (catalogData ? Promise.resolve(catalogData) : loadCatalog()),
    [catalogData],
  );
  const { data: catalog, status, refresh } = useAsyncResource(loader);
  const [selected, setSelected] = useState({});
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const lock = useRef(false);
  if (status === "loading")
    return <LoadingState message="Loading configuration templates…" />;
  if (status === "error")
    return (
      <ErrorState
        description="Templates could not be loaded."
        onRetry={refresh}
      />
    );
  const isPolicy = mode === "policies";
  const definitions = catalog[mode];
  const available = definitions.filter(
    (template) =>
      !existingTemplate(records, template) &&
      (!isPolicy || applicableCategory(categories, template, catalog)),
  );
  const chosen = available.filter((template) => selected[template.key]);
  function toggle(template, checked) {
    setError("");
    setResult("");
    setPreview(false);
    setSelected((current) => {
      const next = { ...current };
      if (!checked) delete next[template.key];
      else
        next[template.key] = isPolicy
          ? {
              maxAmount: "",
              currency:
                catalog.defaultCurrency ||
                applicableCategory(categories, template, catalog).currency,
              receiptRequired: template.receiptRequired,
              approvalLevels: template.approvalLevels,
            }
          : true;
      return next;
    });
  }
  function change(key, field, value) {
    setPreview(false);
    setError("");
    setSelected((current) => ({
      ...current,
      [key]: { ...current[key], [field]: value },
    }));
  }
  async function activate() {
    if (lock.current || !preview || !chosen.length) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = { version: catalog.version };
      const response = isPolicy
        ? await configManagerResources.templates.activatePolicies({
            ...payload,
            policies: chosen.map((template) => ({
              templateKey: template.key,
              categoryId: applicableCategory(categories, template, catalog).id,
              ...selected[template.key],
              maxAmount: moneyValue(selected[template.key].maxAmount),
              approvalLevels: Number(selected[template.key].approvalLevels),
            })),
          })
        : await configManagerResources.templates.activateCategories({
            ...payload,
            templateKeys: chosen.map((template) => template.key),
          });
      const summary =
        mode === "categories"
          ? categoryActivationSummary(response, chosen.length)
          : policyActivationSummary(response, chosen.length);
      await onActivated?.(response, summary);
      if (onActivated) return;
      setSelected({});
      setPreview(false);
      setResult(summary);
    } catch (cause) {
      setError(
        (isPolicy ? policyFailureMessage(cause.message) : cause.message) ||
          "Activation failed. Your selection is retained; retry safely.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="card configuration-templates"
      aria-label={isPolicy ? "Policy templates" : "Predefined categories"}
    >
      <div className="template-heading">
        <div>
          <h2>{isPolicy ? "Policy templates" : "Predefined categories"}</h2>
          <p>
            {isPolicy
              ? "Choose a starting point, enter your own per-expense cap and review the requirements. Existing policies are preserved."
              : "Select common business categories and activate them together. Existing categories keep their IDs and settings."}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={onClose}
        >
          Close templates
        </button>
      </div>
      {isPolicy && (
        <p>
          Organization default currency: {catalog.defaultCurrency || "INR"}.
          Mileage uses a per-expense cap, not a distance rate.
        </p>
      )}
      {!preview && (
        <>
          <label className="template-check">
            <input
              type="checkbox"
              aria-label="Select all available templates"
              disabled={busy || !available.length}
              checked={
                available.length > 0 && chosen.length === available.length
              }
              onChange={(event) => {
                setError("");
                setResult("");
                setSelected(
                  event.target.checked
                    ? Object.fromEntries(
                        available.map((template) => [
                          template.key,
                          isPolicy
                            ? {
                                maxAmount: "",
                                currency:
                                  catalog.defaultCurrency ||
                                  applicableCategory(
                                    categories,
                                    template,
                                    catalog,
                                  ).currency,
                                receiptRequired: template.receiptRequired,
                                approvalLevels: template.approvalLevels,
                              }
                            : true,
                        ]),
                      )
                    : {},
                );
              }}
            />
            Select / deselect all available
          </label>
          <div className="template-grid">
            {definitions.map((template) => {
              const existing = existingTemplate(records, template);
              const category = isPolicy
                ? applicableCategory(categories, template, catalog)
                : null;
              const disabled = Boolean(existing || (isPolicy && !category));
              return (
                <div className="template-item" key={template.key}>
                  <label className="template-check">
                    <input
                      type="checkbox"
                      aria-label={`Select ${template.name}`}
                      disabled={busy || disabled}
                      checked={Boolean(existing || selected[template.key])}
                      onChange={(event) =>
                        toggle(template, event.target.checked)
                      }
                    />
                    <strong>{template.name}</strong>
                  </label>
                  <p>{template.description}</p>
                  {existing && (
                    <p className="template-hint">
                      Already configured ({existing.status}). Use Edit to change
                      it.
                    </p>
                  )}
                  {isPolicy && !category && (
                    <p className="template-hint">
                      Required active category:{" "}
                      {
                        catalog.categories.find(
                          (item) => item.key === template.categoryKey,
                        )?.name
                      }
                      .{" "}
                      <Link to="/configuration/expense-categories">
                        Configure Expense Categories
                      </Link>
                      . No category is activated automatically.
                    </p>
                  )}
                  {isPolicy && category && <p>Category: {category.name}</p>}
                  {isPolicy && selected[template.key] && !disabled && (
                    <fieldset disabled={busy} className="template-fields">
                      <legend>Review {template.name}</legend>
                      <label>
                        Per-expense spending cap
                        <input
                          className="form-input"
                          type="text"
                          inputMode="decimal"
                          maxLength={64}
                          required
                          aria-invalid={Boolean(
                            error &&
                            !moneyValue(selected[template.key].maxAmount),
                          )}
                          aria-describedby={`template-amount-error-${template.key}`}
                          value={selected[template.key].maxAmount}
                          onChange={(event) =>
                            change(
                              template.key,
                              "maxAmount",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      {error &&
                        !moneyValue(selected[template.key].maxAmount) && (
                          <small
                            id={`template-amount-error-${template.key}`}
                            className="policy-error"
                            role="alert"
                          >
                            {POLICY_AMOUNT_ERROR}
                          </small>
                        )}
                      <label>
                        Currency (three-letter code)
                        <input
                          className="form-input"
                          maxLength={3}
                          pattern="[A-Z]{3}"
                          value={selected[template.key].currency}
                          onChange={(event) =>
                            change(
                              template.key,
                              "currency",
                              event.target.value.toUpperCase(),
                            )
                          }
                        />
                      </label>
                      <label>
                        Approval levels
                        <select
                          className="form-input"
                          value={selected[template.key].approvalLevels}
                          onChange={(event) =>
                            change(
                              template.key,
                              "approvalLevels",
                              Number(event.target.value),
                            )
                          }
                        >
                          {APPROVAL_OPTIONS.map((option) => (
                            <option key={option.levels} value={option.levels}>
                              {option.levels} — {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <small>{APPROVAL_NOTE}</small>
                      <label className="template-check">
                        <input
                          type="checkbox"
                          checked={selected[template.key].receiptRequired}
                          onChange={(event) =>
                            change(
                              template.key,
                              "receiptRequired",
                              event.target.checked,
                            )
                          }
                        />
                        Receipt required
                      </label>
                    </fieldset>
                  )}
                </div>
              );
            })}
          </div>
          {!available.length && (
            <p>
              No new templates are available. Existing records can be edited
              below.
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !chosen.length}
            onClick={() => {
              if (
                isPolicy &&
                chosen.some(
                  (template) => !validPolicySelection(selected[template.key]),
                )
              ) {
                setError(
                  "Enter a positive cap, at most 9999999999.99, with up to two decimal places and a three-letter currency for every selected policy.",
                );
                return;
              }
              setError("");
              setPreview(true);
            }}
          >
            Preview {chosen.length ? `(${chosen.length})` : ""}
          </button>
        </>
      )}
      {preview && (
        <div aria-label="Activation preview">
          <h3>Review before activation</h3>
          <p>
            These {chosen.length} records will be Active for your organization.
            Existing records will be skipped without changes.
          </p>
          <ul>
            {chosen.map((template) => (
              <li key={template.key}>
                <strong>{template.name}</strong>
                {isPolicy
                  ? ` — ${applicableCategory(categories, template, catalog).name}; cap ${formatPolicyMoney(selected[template.key].maxAmount, selected[template.key].currency)}; receipt ${selected[template.key].receiptRequired ? "required" : "optional"}; ${APPROVAL_OPTIONS.find((option) => option.levels === Number(selected[template.key].approvalLevels))?.label}`
                  : " — receipt required; no monetary cap supplied"}
              </li>
            ))}
          </ul>
          <div className="template-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => setPreview(false)}
            >
              Back to selection
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !chosen.length}
              onClick={activate}
            >
              {busy ? "Activating…" : `Activate ${chosen.length} ${mode}`}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="template-error">
          {error}
        </p>
      )}
      {isPolicy && onRefreshCategories && (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={async () => {
            const updated = await onRefreshCategories();
            if (!updated)
              setError(
                "Categories could not be refreshed. Retry when available.",
              );
            else {
              setPreview(false);
              setError("");
            }
          }}
        >
          Refresh category availability
        </button>
      )}
      {preview && (
        <p>
          {definitions
            .filter((template) => existingTemplate(records, template))
            .map((template) => {
              const existing = existingTemplate(records, template);
              return `${existing.name} (${existing.status})`;
            })
            .join(", ")}
          {definitions.some((template) => existingTemplate(records, template))
            ? " — already configured; skipped without changes."
            : ""}
        </p>
      )}
      {result && <p role="status">{result}</p>}
    </section>
  );
}

// Bridge the existing legacy sidebar on these two React-owned pages only.
export function TemplateMobileNavigation() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.classList.toggle("template-nav-open", open);
    return () => document.body.classList.remove("template-nav-open");
  }, [open]);
  return (
    <button
      type="button"
      className="btn btn-secondary template-mobile-nav"
      aria-controls="sidebar"
      aria-expanded={open}
      onClick={() => setOpen((value) => !value)}
    >
      {open ? "Close menu" : "Menu"}
    </button>
  );
}
