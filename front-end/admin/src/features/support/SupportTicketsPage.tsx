import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PermissionGate } from "../../auth/PermissionGate";
import type {
  SupportTicketListQuery,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "../../types/support";
import {
  formatDate,
  supportLabel,
  ticketCategories,
  ticketPriorities,
  ticketStatuses,
  ticketTone,
} from "./support-ui";
import { useSupportTickets } from "./useSupportTickets";

export function SupportTicketsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [organizationIdDraft, setOrganizationIdDraft] = useState("");
  const [search, setSearch] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [priority, setPriority] = useState<TicketPriority | "">("");
  const [category, setCategory] = useState<TicketCategory | "">("");
  const [sortBy, setSortBy] =
    useState<NonNullable<SupportTicketListQuery["sortBy"]>>("createdAt");
  const [order, setOrder] =
    useState<NonNullable<SupportTicketListQuery["order"]>>("desc");
  const query = useMemo<SupportTicketListQuery>(
    () => ({
      page,
      limit: 10,
      search,
      organizationId,
      status,
      priority,
      category,
      sortBy,
      order,
    }),
    [category, order, organizationId, page, priority, search, sortBy, status],
  );
  const { data, error, loading, reload } = useSupportTickets(query);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
    setOrganizationId(organizationIdDraft.trim());
  }

  return (
    <section aria-labelledby="support-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Support core</p>
          <h1 id="support-title">Support tickets</h1>
          <p className="page-description">
            Track customer support tickets, replies, internal notes, and status
            history before assignment and workload routing are introduced.
          </p>
        </div>
        <PermissionGate permission="support.ticket.create">
          <Link className="button button-link" to="/support/tickets/new">
            New ticket
          </Link>
        </PermissionGate>
      </div>

      <form className="filter-bar support-filter-bar" onSubmit={submitSearch}>
        <input
          aria-label="Search support tickets"
          placeholder="Search ticket, subject, requester, or organization"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
        />
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value as TicketStatus | "");
          }}
        >
          <option value="">All statuses</option>
          {ticketStatuses.map((item) => (
            <option key={item} value={item}>
              {supportLabel(item)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by priority"
          value={priority}
          onChange={(event) => {
            setPage(1);
            setPriority(event.target.value as TicketPriority | "");
          }}
        >
          <option value="">All priorities</option>
          {ticketPriorities.map((item) => (
            <option key={item} value={item}>
              {supportLabel(item)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by category"
          value={category}
          onChange={(event) => {
            setPage(1);
            setCategory(event.target.value as TicketCategory | "");
          }}
        >
          <option value="">All categories</option>
          {ticketCategories.map((item) => (
            <option key={item} value={item}>
              {supportLabel(item)}
            </option>
          ))}
        </select>
        <input
          aria-label="Filter by organization ID"
          maxLength={36}
          placeholder="Organization ID"
          value={organizationIdDraft}
          onChange={(event) => setOrganizationIdDraft(event.target.value)}
        />
        <select
          aria-label="Sort support tickets by"
          value={sortBy}
          onChange={(event) => {
            setPage(1);
            setSortBy(
              event.target.value as NonNullable<
                SupportTicketListQuery["sortBy"]
              >,
            );
          }}
        >
          <option value="createdAt">Created</option>
          <option value="updatedAt">Updated</option>
          <option value="ticketNumber">Ticket number</option>
          <option value="status">Status</option>
          <option value="priority">Priority</option>
        </select>
        <select
          aria-label="Sort support tickets order"
          value={order}
          onChange={(event) => {
            setPage(1);
            setOrder(
              event.target.value as NonNullable<
                SupportTicketListQuery["order"]
              >,
            );
          }}
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
        <button className="button button-secondary" type="submit">
          Apply
        </button>
      </form>

      {loading && (
        <div className="state-panel" role="status">
          <span className="loader" aria-hidden="true" />
          Loading support tickets...
        </div>
      )}

      {!loading && error && (
        <div className="state-panel state-panel-error" role="alert">
          <div>
            <strong>Support tickets unavailable</strong>
            <p>{error}</p>
          </div>
          <button
            className="button button-secondary"
            onClick={() => void reload()}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && data && data.items.length === 0 && (
        <div className="state-panel">
          <div>
            <strong>No support tickets found</strong>
            <p>Create a ticket or adjust the current filters.</p>
          </div>
        </div>
      )}

      {!loading && data && data.items.length > 0 && (
        <>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Organization</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => navigate(`/support/tickets/${ticket.id}`)}
                  >
                    <td>
                      <strong>{ticket.subject}</strong>
                      <span>{ticket.ticketNumber}</span>
                    </td>
                    <td>
                      <span
                        className={`status-pill status-pill-${ticketTone(
                          ticket.status,
                        )}`}
                      >
                        {supportLabel(ticket.status)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-pill status-pill-${ticketTone(
                          ticket.priority,
                        )}`}
                      >
                        {supportLabel(ticket.priority)}
                      </span>
                    </td>
                    <td>{ticket.organization.name}</td>
                    <td>{formatDate(ticket.createdAt)}</td>
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
                disabled={data.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <button
                className="button button-secondary button-compact"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
