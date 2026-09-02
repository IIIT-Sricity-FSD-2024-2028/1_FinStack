import { useMemo, useState } from "react";
import type { AuditLogListQuery } from "../../types/platform-audit";
import { useAuditLogs } from "./useAuditLogs";

const PAGE_LIMIT = 10;

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatMetadata(value: Record<string, unknown> | null) {
  if (!value) return "—";
  return JSON.stringify(value);
}

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const query = useMemo<AuditLogListQuery>(
    () => ({
      page,
      limit: PAGE_LIMIT,
      search,
      category,
      resourceType,
      sortBy: "createdAt",
      order: "desc",
    }),
    [category, page, resourceType, search],
  );

  const { data, error, loading, reload } = useAuditLogs(query);
  const selectedLog =
    data?.items.find((log) => log.id === selectedLogId) ?? null;

  return (
    <section aria-labelledby="audit-logs-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Platform operations</p>
          <h1 id="audit-logs-title">Audit logs</h1>
          <p className="page-description">
            Review append-only platform activity for staff actions, lifecycle
            changes, and sensitive control-plane events.
          </p>
        </div>
      </div>

      <form
        className="filter-bar"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSearch(searchDraft.trim());
        }}
      >
        <input
          aria-label="Search audit logs"
          placeholder="Search summary, event code, or resource ID"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
        />
        <input
          aria-label="Filter by category"
          placeholder="Category"
          value={category}
          onChange={(event) => {
            setPage(1);
            setCategory(event.target.value.trim());
          }}
        />
        <input
          aria-label="Filter by resource type"
          placeholder="Resource type"
          value={resourceType}
          onChange={(event) => {
            setPage(1);
            setResourceType(event.target.value.trim());
          }}
        />
        <button className="button button-secondary" type="submit">
          Search
        </button>
      </form>

      {loading && (
        <div className="state-panel" role="status">
          <span className="loader" aria-hidden="true" />
          Loading audit logs...
        </div>
      )}

      {!loading && error && (
        <div className="state-panel state-panel-error" role="alert">
          <div>
            <strong>Audit logs unavailable</strong>
            <p>{error}</p>
          </div>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => void reload()}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && data && data.items.length === 0 && (
        <div className="state-panel">
          <div>
            <strong>No audit logs found</strong>
            <p>
              Adjust the filters or wait for platform activity to be recorded.
            </p>
          </div>
        </div>
      )}

      {!loading && !error && data && data.items.length > 0 && (
        <>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Category</th>
                  <th>Resource</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLogId(log.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{formatDate(log.createdAt)}</td>
                    <td>
                      <strong>{log.eventCode}</strong>
                      <span>{log.actorStaffId ?? "System"}</span>
                    </td>
                    <td>{log.category}</td>
                    <td>
                      <strong>{log.resourceType}</strong>
                      <span>{log.resourceId ?? "—"}</span>
                    </td>
                    <td>{log.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <span>
              Page {data.page} of {data.totalPages} - {data.total} total
            </span>
            <div>
              <button
                className="button button-secondary button-compact"
                type="button"
                disabled={data.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <button
                className="button button-secondary button-compact"
                type="button"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </div>

          {selectedLog && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                display: "grid",
                placeItems: "center",
                background: "rgb(15 23 42 / 58%)",
                zIndex: 20,
              }}
              onClick={() => setSelectedLogId(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="audit-log-detail-title"
                onClick={(event) => event.stopPropagation()}
                style={{
                  width: "min(640px, calc(100vw - 32px))",
                  border: "1px solid #334155",
                  borderRadius: "12px",
                  background: "#111827",
                  padding: "1.5rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  <h2 id="audit-log-detail-title" style={{ margin: 0 }}>
                    {selectedLog.eventCode}
                  </h2>
                  <button
                    type="button"
                    className="button button-secondary button-compact"
                    onClick={() => setSelectedLogId(null)}
                  >
                    Close
                  </button>
                </div>
                <p style={{ color: "#94a3b8", marginTop: "0.75rem" }}>
                  {selectedLog.summary}
                </p>
                <div
                  style={{ display: "grid", gap: "0.5rem", marginTop: "1rem" }}
                >
                  <p>
                    <strong>Category:</strong> {selectedLog.category}
                  </p>
                  <p>
                    <strong>Resource:</strong> {selectedLog.resourceType} /{" "}
                    {selectedLog.resourceId ?? "—"}
                  </p>
                  <p>
                    <strong>Actor:</strong>{" "}
                    {selectedLog.actorStaffId ?? "System"}
                  </p>
                  <p>
                    <strong>Request ID:</strong> {selectedLog.requestId ?? "—"}
                  </p>
                  <p>
                    <strong>Correlation ID:</strong>{" "}
                    {selectedLog.correlationId ?? "—"}
                  </p>
                  <p>
                    <strong>Metadata:</strong>{" "}
                    {formatMetadata(selectedLog.metadata)}
                  </p>
                  <p>
                    <strong>Timestamp:</strong>{" "}
                    {formatDate(selectedLog.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
