import { useCallback, useEffect, useRef, useState } from "react";
import { employeeImports } from "../../adapters/employeeImports";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { ErrorState, LoadingState } from "../../components/OperationalStates";
import "./employee-import.css";

const loadJobs = () => employeeImports.list();
export function BulkEmployeeImport({ onUsersChanged, onClose, onSuccess }) {
  const history = useAsyncResource(loadJobs);
  const [job, setJob] = useState(null);
  const [file, setFile] = useState(null);
  const [key, setKey] = useState("");
  const [page, setPage] = useState(1);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [compact, setCompact] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef(null);
  const lock = useRef(false);
  const refreshed = useRef(new Set());
  const initialHistorySelected = useRef(false);
  const loadRows = useCallback(
    () => (job ? employeeImports.rows(job.id, page) : Promise.resolve([])),
    [job?.id, page],
  );
  const rows = useAsyncResource(loadRows);
  useEffect(() => {
    if (!initialHistorySelected.current && history.status === "success") {
      initialHistorySelected.current = true;
      if (!job && history.data?.length) setJob(history.data[0]);
    }
  }, [history.data, history.status, job]);
  useEffect(() => {
    if (!job || !["VALIDATING", "QUEUED", "RUNNING"].includes(job.status))
      return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const updated = await employeeImports.get(job.id);
        if (!active) return;
        setJob(updated);
        if (updated.processedCount !== job.processedCount) rows.refresh();
        if (updated.status === "COMPLETED" && !refreshed.current.has(job.id)) {
          refreshed.current.add(job.id);
          setCompact(true);
          setFile(null);
          setKey("");
          if (fileInput.current) fileInput.current.value = "";
          await onUsersChanged();
          history.refresh();
          onSuccess?.(
            `Import completed: ${updated.successfulCount} created, ${updated.failedCount} failed, ${updated.invalidCount} invalid rows skipped.`,
            3000,
          );
        }
      } catch (caught) {
        if (active)
          setError(
            caught.message ||
              "Progress could not be loaded. Reopen the job to retry.",
          );
      }
    }, 1000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [job, onUsersChanged, onSuccess, rows.refresh, history.refresh]);
  async function action(operation) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (caught) {
      setError(caught.message || "The operation failed. Retry safely.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function selectJob(next) {
    setCompact(false);
    setJob(next);
    setPage(1);
    setReviewed(false);
    setError("");
  }
  return (
    <section className="card employee-import" aria-label="Bulk employee import">
      <div className="import-heading">
        <div>
          <h2>Bulk employee import</h2>
          <p>
            Upload up to 10,000 employees per CSV (10 MiB). Preview before
            creating accounts. Larger organizations can use multiple reviewed
            jobs.
          </p>
        </div>
        <button
          className="btn btn-secondary"
          type="button"
          disabled={busy}
          onClick={onClose}
        >
          Close import
        </button>
      </div>
      {compact && job && (
        <div className="import-completion" role="status">
          <strong>Import completed</strong>
          <p>
            {job.successfulCount} created · {job.failedCount} failed ·{" "}
            {job.invalidCount} invalid rows skipped. Imported accounts await
            password setup.
          </p>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setCompact(false)}
          >
            View details, errors & activation links
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              setCompact(false);
              setJob(null);
            }}
          >
            Start another import
          </button>
        </div>
      )}
      {!compact && (
        <>
          <p>
            CSV supports employee ID, first and last name, email, department and
            an existing active manager's employee ID. Bulk roles are limited to
            Expense Submitter. Use authorized individual provisioning for
            privileged roles. Do not include passwords or organization IDs.
          </p>
          <div className="import-actions">
            <button
              className="btn btn-secondary"
              type="button"
              disabled={busy}
              onClick={() => action(() => employeeImports.template())}
            >
              Download CSV template
            </button>
            <label className="form-label" htmlFor="employee-import-file">
              Choose CSV file
              <input
                id="employee-import-file"
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                disabled={busy}
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  setError("");
                  setFile(null);
                  if (!selected) return;
                  if (
                    selected.size === 0 ||
                    selected.size > 10 * 1024 * 1024 ||
                    !selected.name.toLowerCase().endsWith(".csv")
                  ) {
                    setError(
                      "Choose a nonempty CSV file no larger than 10 MiB.",
                    );
                    return;
                  }
                  setFile(selected);
                  setKey(crypto.randomUUID());
                }}
              />
            </label>
            {file && (
              <div className="import-file-summary">
                <span>
                  {file.name} · {(file.size / 1024).toFixed(1)} KiB
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => {
                    setFile(null);
                    setKey("");
                    setError("");
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                >
                  Clear file
                </button>
              </div>
            )}
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy || !file}
              onClick={() =>
                action(async () => {
                  const result = await employeeImports.upload(file, key);
                  selectJob(result);
                  history.refresh();
                })
              }
            >
              {busy ? "Working…" : "Validate CSV"}
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="import-error">
          {error}
        </p>
      )}
      <div className="import-history">
        <h3>Import history</h3>
        {history.status === "loading" && (
          <LoadingState message="Loading import history…" />
        )}
        {history.status === "error" && (
          <ErrorState
            description="Import history could not be loaded."
            onRetry={history.refresh}
          />
        )}
        {history.status === "success" && (
          <>
            <label htmlFor="employee-import-job">
              Choose a job (up to 100 retained)
            </label>
            <select
              id="employee-import-job"
              className="form-input"
              value={job?.id || ""}
              onChange={(event) =>
                selectJob(
                  history.data.find((item) => item.id === event.target.value),
                )
              }
            >
              <option value="" disabled>
                Select a job
              </option>
              {history.data.map((item) => (
                <option key={item.id} value={item.id}>
                  {new Date(item.createdAt).toLocaleString()} — {item.status} —{" "}
                  {item.totalCount} rows · {item.successfulCount} created ·{" "}
                  {item.failedCount} failed · {item.invalidCount} invalid
                </option>
              ))}
            </select>
            {!history.data.length && <p>No import jobs yet.</p>}
          </>
        )}
      </div>
      {job && !compact && (
        <div className="import-job">
          <h3>Import {job.status}</h3>
          <p>
            Rows: {job.totalCount} · Validated: {job.validCount} · Invalid:{" "}
            {job.invalidCount} · Processed: {job.processedCount} · Successful:{" "}
            {job.successfulCount} · Failed: {job.failedCount}
          </p>
          <progress
            aria-label="Import progress"
            max={Math.max(job.totalCount, 1)}
            value={job.processedCount}
          />
          {job.error && (
            <p role="alert" className="import-error">
              {job.error}
            </p>
          )}
          <p>
            New accounts are inactive until each employee sets a password using
            a single-use activation link. No invitation email is sent.
          </p>
          {["READY", "FAILED"].includes(job.status) && job.validCount > 0 && (
            <>
              <label className="import-check">
                <input
                  type="checkbox"
                  checked={reviewed}
                  disabled={busy}
                  onChange={(event) => setReviewed(event.target.checked)}
                />
                I reviewed the rows and will distribute activation links
                securely. Invalid rows will be skipped.
              </label>
              <button
                className="btn btn-primary"
                type="button"
                disabled={busy || !reviewed}
                onClick={() =>
                  action(async () => {
                    setJob(await employeeImports.confirm(job.id));
                    setReviewed(false);
                  })
                }
              >
                {job.status === "FAILED"
                  ? "Retry remaining rows"
                  : "Confirm import"}
              </button>
            </>
          )}
          <div className="import-actions">
            {(job.invalidCount > 0 || job.failedCount > 0) && (
              <button
                className="btn btn-secondary"
                type="button"
                disabled={busy}
                onClick={() => action(() => employeeImports.errors(job.id))}
              >
                Download row errors
              </button>
            )}
            {job.status === "COMPLETED" && job.successfulCount > 0 && (
              <button
                className="btn btn-secondary"
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    !window.confirm(
                      "This CSV contains sensitive account activation links. Distribute each only to its intended employee through a trusted channel. Downloading again replaces outstanding links; links expire in 48 hours. No email is sent.",
                    )
                  )
                    return;
                  action(async () =>
                    onSuccess?.(
                      `${await employeeImports.activationLinks(job.id)} activation links downloaded. Distribute them securely; no email was sent.`,
                      3000,
                    ),
                  );
                }}
              >
                Download activation links
              </button>
            )}
            <button
              className="btn btn-secondary"
              type="button"
              disabled={busy}
              onClick={() =>
                action(async () => {
                  setJob(await employeeImports.get(job.id));
                  rows.refresh();
                })
              }
            >
              Refresh job
            </button>
          </div>
          <h3>Row preview</h3>
          {rows.status === "success" && (
            <p>
              Duplicate/conflict rows on this preview page:{" "}
              {
                rows.data.filter((row) =>
                  row.errors.some((message) =>
                    /duplicate|already exists|unavailable/i.test(message),
                  ),
                ).length
              }
              . Full-file valid and invalid totals are shown above.
            </p>
          )}
          {rows.status === "loading" && (
            <LoadingState message="Loading row preview…" />
          )}
          {rows.status === "error" && (
            <ErrorState
              description="Rows could not be loaded."
              onRetry={rows.refresh}
            />
          )}
          {rows.status === "success" && (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Employee ID</th>
                    <th>Name / email</th>
                    <th>Status</th>
                    <th>Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.data.map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>{row.employeeId}</td>
                      <td>
                        {row.payload.firstName} {row.payload.lastName}
                        <br />
                        {row.email}
                      </td>
                      <td>{row.status}</td>
                      <td>{row.errors.join("; ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="import-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={page === 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous rows
            </button>
            <span>
              Page {page} of {Math.max(1, Math.ceil(job.totalCount / 100))}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={page * 100 >= job.totalCount}
              onClick={() => setPage((value) => value + 1)}
            >
              Next rows
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
