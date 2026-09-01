import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PermissionGate } from '../../auth/PermissionGate';
import { useAuth } from '../../auth/useAuth';
import {
  addSupportTicketInternalNote,
  replyToSupportTicket,
  transitionSupportTicketStatus,
  updateSupportTicket,
} from '../../services/api/platform-support';
import type {
  SupportStaffRef,
  SupportTicketUpdatePayload,
  TicketCategory,
  TicketStatus,
} from '../../types/support';
import {
  formatDate,
  supportLabel,
  ticketCategories,
  ticketPriorities,
  ticketTone,
  transitionPermission,
  transitionTargets,
} from './support-ui';
import { useSupportTicket } from './useSupportTicket';

function staffName(staff: SupportStaffRef | null): string {
  if (!staff) return 'Unknown staff';
  return `${staff.firstName} ${staff.lastName}`;
}

export function SupportTicketDetailPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const { data, error, loading, reload } = useSupportTicket(id);
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [selectedTargetStatus, setSelectedTargetStatus] =
    useState<TicketStatus | ''>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const availableTransitions = useMemo(() => {
    if (!data) return [];
    return transitionTargets(data.status).filter((status) =>
      hasPermission(transitionPermission(status)),
    );
  }, [data, hasPermission]);

  const targetStatus =
    selectedTargetStatus && availableTransitions.includes(selectedTargetStatus)
      ? selectedTargetStatus
      : (availableTransitions[0] ?? '');

  async function runAction(
    key: string,
    fallback: string,
    action: () => Promise<void>,
  ) {
    setActionError(null);
    setSubmitting(key);
    try {
      await action();
      await reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : fallback);
    } finally {
      setSubmitting(null);
    }
  }

  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const formData = new FormData(event.currentTarget);
    const payload: SupportTicketUpdatePayload = {
      requesterName:
        String(formData.get('requesterName') ?? '').trim() || undefined,
      requesterEmail:
        String(formData.get('requesterEmail') ?? '').trim() || undefined,
      category: String(formData.get('category')) as TicketCategory,
      priority: String(formData.get('priority')) as SupportTicketUpdatePayload['priority'],
      subject: String(formData.get('subject') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim(),
    };
    await runAction('metadata', 'Support ticket could not be updated.', async () => {
      await updateSupportTicket(data.id, payload);
    });
  }

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !reply.trim()) return;
    await runAction('reply', 'Reply could not be added.', async () => {
      await replyToSupportTicket(data.id, reply.trim());
      setReply('');
    });
  }

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !note.trim()) return;
    await runAction('note', 'Internal note could not be added.', async () => {
      await addSupportTicketInternalNote(data.id, note.trim());
      setNote('');
    });
  }

  async function submitStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !targetStatus) return;
    await runAction('status', 'Ticket status could not be changed.', async () => {
      await transitionSupportTicketStatus(
        data.id,
        targetStatus,
        statusNote.trim() || undefined,
      );
      setStatusNote('');
      setSelectedTargetStatus('');
    });
  }

  return (
    <section aria-labelledby="support-ticket-detail-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Ticket detail</p>
          <h1 id="support-ticket-detail-title">
            {data?.ticketNumber ?? 'Support ticket'}
          </h1>
          <p className="page-description">
            Review customer context, staff replies, private notes, and lifecycle
            history.
          </p>
        </div>
        <Link className="button button-secondary button-link" to="/support/tickets">
          Back to tickets
        </Link>
      </div>

      {loading && (
        <div className="state-panel" role="status">
          <span className="loader" aria-hidden="true" />
          Loading support ticket...
        </div>
      )}

      {!loading && error && (
        <div className="state-panel state-panel-error" role="alert">
          <div>
            <strong>Support ticket unavailable</strong>
            <p>{error}</p>
          </div>
          <button className="button button-secondary" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="detail-grid support-detail-grid">
            <div className="summary-banner organization-summary">
              <span
                className={`status-dot status-dot-${ticketTone(data.status)}`}
                aria-hidden="true"
              />
              <div>
                <strong>{data.subject}</strong>
                <span>
                  {supportLabel(data.status)} for {data.organization.name}
                </span>
              </div>
            </div>
            <article className="status-card detail-card">
              <span>Priority</span>
              <strong>{supportLabel(data.priority)}</strong>
            </article>
            <article className="status-card detail-card">
              <span>Category</span>
              <strong>{supportLabel(data.category)}</strong>
            </article>
            <article className="status-card detail-card">
              <span>First response</span>
              <strong>{formatDate(data.firstResponseAt)}</strong>
            </article>
            <article className="status-card detail-card">
              <span>Resolved</span>
              <strong>{formatDate(data.resolvedAt)}</strong>
            </article>
          </div>

          {actionError && (
            <div className="state-panel state-panel-error" role="alert">
              <strong>{actionError}</strong>
            </div>
          )}

          <div className="support-layout">
            <div className="support-main-column">
              <article className="status-card support-panel">
                <div className="status-card-heading">
                  <h2>Messages</h2>
                  <span className="muted-copy">{data.messages.length} total</span>
                </div>
                <div className="support-thread">
                  {data.messages.length === 0 ? (
                    <p className="muted-copy">No messages have been added yet.</p>
                  ) : (
                    data.messages.map((message) => (
                      <div className="thread-item" key={message.id}>
                        <div>
                          <strong>
                            {message.authorType === 'PLATFORM_STAFF'
                              ? staffName(message.authorStaff)
                              : 'Tenant requester'}
                          </strong>
                          <span>{formatDate(message.createdAt)}</span>
                        </div>
                        <p>{message.message}</p>
                      </div>
                    ))
                  )}
                </div>
                <PermissionGate
                  permission="support.ticket.reply"
                  fallback={
                    <p className="muted-copy">
                      You do not have permission to reply to this ticket.
                    </p>
                  }
                >
                  <form className="support-action-form" onSubmit={submitReply}>
                    <textarea
                      required
                      rows={4}
                      maxLength={5000}
                      placeholder="Write a staff reply"
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                    />
                    <button
                      className="button"
                      disabled={submitting !== null || !reply.trim()}
                      type="submit"
                    >
                      {submitting === 'reply' ? 'Sending...' : 'Send reply'}
                    </button>
                  </form>
                </PermissionGate>
              </article>

              <article className="status-card support-panel">
                <div className="status-card-heading">
                  <h2>Internal notes</h2>
                  <span className="muted-copy">
                    {data.internalNotes.length} total
                  </span>
                </div>
                <div className="support-thread">
                  {data.internalNotes.length === 0 ? (
                    <p className="muted-copy">No internal notes have been added.</p>
                  ) : (
                    data.internalNotes.map((item) => (
                      <div className="thread-item" key={item.id}>
                        <div>
                          <strong>{staffName(item.staff)}</strong>
                          <span>{formatDate(item.createdAt)}</span>
                        </div>
                        <p>{item.note}</p>
                      </div>
                    ))
                  )}
                </div>
                <PermissionGate
                  permission="support.ticket.note"
                  fallback={
                    <p className="muted-copy">
                      You do not have permission to add internal notes.
                    </p>
                  }
                >
                  <form className="support-action-form" onSubmit={submitNote}>
                    <textarea
                      required
                      rows={3}
                      maxLength={5000}
                      placeholder="Add a private internal note"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                    <button
                      className="button"
                      disabled={submitting !== null || !note.trim()}
                      type="submit"
                    >
                      {submitting === 'note' ? 'Adding...' : 'Add note'}
                    </button>
                  </form>
                </PermissionGate>
              </article>
            </div>

            <aside className="support-side-column">
              <article className="status-card support-panel">
                <h2>Status</h2>
                <span
                  className={`status-pill status-pill-${ticketTone(data.status)}`}
                >
                  {supportLabel(data.status)}
                </span>
                {transitionTargets(data.status).length === 0 ? (
                  <p className="muted-copy">No further transitions are available.</p>
                ) : availableTransitions.length === 0 ? (
                  <p className="muted-copy">
                    You do not have permission for the available transitions.
                  </p>
                ) : (
                  <form className="support-action-form" onSubmit={submitStatus}>
                    <select
                      aria-label="Next ticket status"
                      value={targetStatus}
                      onChange={(event) =>
                        setSelectedTargetStatus(event.target.value as TicketStatus)
                      }
                    >
                      {availableTransitions.map((status) => (
                        <option key={status} value={status}>
                          {supportLabel(status)}
                        </option>
                      ))}
                    </select>
                    <textarea
                      rows={3}
                      maxLength={1000}
                      placeholder="Transition note"
                      value={statusNote}
                      onChange={(event) => setStatusNote(event.target.value)}
                    />
                    <button
                      className="button"
                      disabled={submitting !== null || !targetStatus}
                      type="submit"
                    >
                      {submitting === 'status' ? 'Updating...' : 'Update status'}
                    </button>
                  </form>
                )}
              </article>

              <article className="status-card support-panel">
                <h2>History</h2>
                <div className="support-history">
                  {data.statusHistory.length === 0 ? (
                    <p className="muted-copy">No status history recorded.</p>
                  ) : (
                    data.statusHistory.map((item) => (
                      <div className="history-item" key={item.id}>
                        <strong>{supportLabel(item.newStatus)}</strong>
                        <span>
                          {item.previousStatus
                            ? `From ${supportLabel(item.previousStatus)}`
                            : 'Initial status'}{' '}
                          by {staffName(item.changedByStaff)}
                        </span>
                        <span>{formatDate(item.createdAt)}</span>
                        {item.note && <p>{item.note}</p>}
                      </div>
                    ))
                  )}
                </div>
              </article>

              <article className="status-card support-panel">
                <h2>Metadata</h2>
                <PermissionGate
                  permission="support.ticket.update"
                  fallback={
                    <p className="muted-copy">
                      You do not have permission to update ticket metadata.
                    </p>
                  }
                >
                  <form className="support-action-form" onSubmit={saveMetadata}>
                    <label>
                      Requester name
                      <input
                        maxLength={160}
                        name="requesterName"
                        defaultValue={data.requesterName ?? ''}
                      />
                    </label>
                    <label>
                      Requester email
                      <input
                        type="email"
                        maxLength={320}
                        name="requesterEmail"
                        defaultValue={data.requesterEmail ?? ''}
                      />
                    </label>
                    <label>
                      Category
                      <select
                        name="category"
                        defaultValue={data.category}
                      >
                        {ticketCategories.map((category) => (
                          <option key={category} value={category}>
                            {supportLabel(category)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Priority
                      <select
                        name="priority"
                        defaultValue={data.priority}
                      >
                        {ticketPriorities.map((priority) => (
                          <option key={priority} value={priority}>
                            {supportLabel(priority)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Subject
                      <input
                        required
                        minLength={3}
                        maxLength={200}
                        name="subject"
                        defaultValue={data.subject}
                      />
                    </label>
                    <label>
                      Description
                      <textarea
                        required
                        rows={5}
                        maxLength={5000}
                        name="description"
                        defaultValue={data.description}
                      />
                    </label>
                    <button
                      className="button"
                      disabled={submitting !== null}
                      type="submit"
                    >
                      {submitting === 'metadata' ? 'Saving...' : 'Save metadata'}
                    </button>
                  </form>
                </PermissionGate>
              </article>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
