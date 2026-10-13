import { useEffect, useRef, useState } from "react";
import { TemplateMobileNavigation } from "./ConfigurationTemplatePicker";
import { tenantAudit } from "../../adapters/tenantAudit";
import { Icon } from "../../components/Icon";
import { ErrorState, LoadingState } from "../../components/OperationalStates";
import { Pagination } from "../../components/Pagination";
import { Table } from "../../components/Table";
import { Modal } from "../../components/Modal";
import { useEmployeePage } from "../../hooks/useEmployeePage";
import "./tenant-audit.css";
const PAGE_SIZE = 25;
export function ConfigManagerAuditLogs() {
  const [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState("");
  const [filters, setFilters] = useState({
    targetType: "",
    outcome: "",
    eventCode: "",
    from: "",
    to: "",
  });
  const [eventInput, setEventInput] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => ({ ...current, eventCode: eventInput.trim() }));
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [eventInput]);
  const [page, setPage] = useState(1),
    [detail, setDetail] = useState(null),
    [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState("");
  const detailClose = useRef(null),
    detailSequence = useRef(0),
    detailOrigin = useRef(null);
  const [detailPending, setDetailPending] = useState(null);
  function closeDetail() {
    detailSequence.current++;
    setDetail(null);
    detailOrigin.current?.focus();
  }
  const [detailError, setDetailError] = useState("");
  useEffect(
    () => () => {
      detailSequence.current++;
    },
    [],
  );
  async function openDetail(id) {
    detailOrigin.current = document.activeElement;
    const sequence = ++detailSequence.current;
    setDetailPending(id);
    setDetailError("");
    try {
      const record = await tenantAudit.detail(id);
      if (sequence === detailSequence.current) setDetail(record);
    } catch (e) {
      if (sequence === detailSequence.current) setDetailError(e.message);
    } finally {
      if (sequence === detailSequence.current) setDetailPending(null);
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const params = { ...filters, search: debounced, page, pageSize: PAGE_SIZE };
  const { status, data, error, refresh } = useEmployeePage(
    tenantAudit.list,
    params,
  );
  const change = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  useEffect(() => {
    if (!detail) return;
    detailClose.current?.focus();
    const close = (event) => {
      if (event.key === "Escape") closeDetail();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [detail]);
  async function exportLogs() {
    setExporting(true);
    setExportError("");
    try {
      await tenantAudit.export({ ...filters, search: debounced });
    } catch (e) {
      setExportError(e.message);
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <TemplateMobileNavigation />
      <div className="page-header">
        <div className="page-header-text">
          <h1>Audit Logs</h1>
          <p>
            Durable Configuration Manager events {data ? `(${data.total})` : ""}
          </p>
        </div>
        <div className="audit-actions">
          <button type="button" className="btn btn-secondary" onClick={refresh}>
            <Icon name="refresh" size={16} /> Refresh
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={exporting || status !== "success"}
            onClick={exportLogs}
          >
            <Icon name="download" size={16} />
            {exporting ? "Exporting..." : "Export Logs"}
          </button>
        </div>
      </div>
      <p role="status">
        Recorded configuration changes only. Earlier activity and other actors'
        workflows are not reconstructed. Export includes all matching events, up
        to 10,000 events or 10 MB.
      </p>
      {exportError && <p role="alert">{exportError}</p>}
      {detailError && <p role="alert">{detailError}</p>}
      <div className="filters-bar audit-filters">
        <input
          type="search"
          className="form-input"
          placeholder="Search logs..."
          aria-label="Search audit logs"
          maxLength={120}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="form-input"
          aria-label="Filter by resource"
          value={filters.targetType}
          onChange={(event) => change("targetType", event.target.value)}
        >
          <option value="">All resources</option>
          {[
            "organization",
            "employee",
            "category",
            "policy",
            "category_batch",
            "policy_batch",
            "import",
            "credential",
          ].map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <select
          className="form-input"
          aria-label="Filter by status"
          value={filters.outcome}
          onChange={(event) => change("outcome", event.target.value)}
        >
          <option value="">All statuses</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILED">Failed lifecycle</option>
        </select>
        <input
          className="form-input"
          aria-label="Filter by event code"
          placeholder="Exact event code"
          maxLength={100}
          value={eventInput}
          onChange={(event) => setEventInput(event.target.value)}
        />
        <label>
          From (UTC)
          <input
            type="date"
            className="form-input"
            aria-label="From date"
            value={filters.from.slice(0, 10)}
            onChange={(event) =>
              change(
                "from",
                event.target.value ? `${event.target.value}T00:00:00.000Z` : "",
              )
            }
          />
        </label>
        <label>
          Through (UTC)
          <input
            type="date"
            className="form-input"
            aria-label="Through date"
            value={filters.to.slice(0, 10)}
            onChange={(event) =>
              change(
                "to",
                event.target.value ? `${event.target.value}T23:59:59.999Z` : "",
              )
            }
          />
        </label>
      </div>
      <div className="card">
        {status === "loading" && (
          <LoadingState message="Loading audit logs..." />
        )}
        {status === "error" && (
          <ErrorState
            description={error?.message || "Audit logs could not be loaded."}
            onRetry={refresh}
          />
        )}
        {status === "success" && (
          <>
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Role at action</th>
                    <th>Event</th>
                    <th>Resource</th>
                    <th>Status</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length ? (
                    data.items.map((log) => (
                      <tr key={log.id}>
                        <td>{new Date(log.occurredAt).toLocaleString()}</td>
                        <td>
                          {log.actorName}
                          <br />
                          <small>{log.actorKind}</small>
                        </td>
                        <td>{log.actorRole || "System"}</td>
                        <td>{log.eventCode}</td>
                        <td>
                          {log.targetType}
                          <br />
                          <small title={log.targetId}>
                            {log.targetId
                              ? log.targetId.slice(0, 8) + "?"
                              : "?"}
                          </small>
                        </td>
                        <td>{log.outcome}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            aria-label={`View event ${log.id}`}
                            aria-busy={detailPending === log.id}
                            disabled={detailPending === log.id}
                            onClick={() => openDetail(log.id)}
                          >
                            {detailPending === log.id ? "Loading..." : "View"}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7">No logs match the current filters.</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={data.total}
              itemLabel="logs"
              onPageChange={setPage}
            />
          </>
        )}
      </div>
      <Modal
        open={Boolean(detail)}
        label="Audit event details"
        onClose={closeDetail}
      >
        <div
          className="modal-content audit-detail"
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              event.preventDefault();
              detailClose.current?.focus();
            }
          }}
        >
          <div className="modal-header">
            <h2>Audit event details</h2>
            <button
              ref={detailClose}
              type="button"
              className="btn btn-secondary"
              onClick={closeDetail}
            >
              Close
            </button>
          </div>
          {detail && (
            <div className="modal-body">
              <p>
                {detail.eventCode} · {detail.outcome}
              </p>
              <p>
                Actor UUID: {detail.actorUserId || "System"}
                {detail.initiatedByUserId &&
                  `; initiated by ${detail.initiatedByUserId}`}
              </p>
              <p>Event UUID: {detail.id}</p>
              <pre>{JSON.stringify(detail.changes, null, 2)}</pre>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
