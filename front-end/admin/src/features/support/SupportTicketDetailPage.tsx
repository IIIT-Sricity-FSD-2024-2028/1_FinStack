import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PermissionGate } from '../../auth/PermissionGate';
import { useAuth } from '../../auth/useAuth';
import {
  addSupportTicketInternalNote,
  replyToSupportTicket,
  transitionSupportTicketStatus,
} from '../../services/api/platform-support';
import type {
  SupportStaffRef,
  TicketStatus,
} from '../../types/support';
import {
  formatDate,
  supportLabel,
  ticketTone,
  transitionPermission,
  transitionTargets,
} from './support-ui';
import { useSupportTicket } from './useSupportTicket';

function staffName(staff: SupportStaffRef | null): string {
  if (!staff) return 'System';
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
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <p className="eyebrow" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link to="/support/tickets" style={{ color: 'inherit', textDecoration: 'none' }}>Support</Link>
            <span>/</span>
            <Link to="/support/tickets" style={{ color: 'inherit', textDecoration: 'none' }}>Tickets</Link>
            <span>/</span>
            <span>{data?.ticketNumber ?? '...'}</span>
          </p>
          <h1 id="support-ticket-detail-title" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
            {data?.subject ?? 'Support ticket'}
            {data && (
              <>
                <span className={`status-pill status-pill-${ticketTone(data.status)}`} style={{ fontSize: '13px' }}>
                  {supportLabel(data.status)}
                </span>
                <span className="status-pill status-pill-available" style={{ fontSize: '13px' }}>
                  {supportLabel(data.priority)}
                </span>
              </>
            )}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link className="button button-secondary button-link" to="/support/tickets">
            Back to tickets
          </Link>
          {availableTransitions.length > 0 && (
            <form onSubmit={submitStatus} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                aria-label="Next ticket status"
                value={targetStatus}
                onChange={(event) => setSelectedTargetStatus(event.target.value as TicketStatus)}
                style={{ height: '40px', padding: '0 12px', borderRadius: '9px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', boxSizing: 'border-box' }}
              >
                {availableTransitions.map((status) => (
                  <option key={status} value={status}>
                    {supportLabel(status)}
                  </option>
                ))}
              </select>
              <button
                className={`button ${targetStatus === 'RESOLVED' || targetStatus === 'CLOSED' ? '' : 'button-secondary'}`}
                disabled={submitting !== null || !targetStatus}
                type="submit"
              >
                {submitting === 'status' ? 'Updating...' : 'Update status'}
              </button>
            </form>
          )}
        </div>
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
          {actionError && (
            <div className="state-panel state-panel-error" role="alert" style={{ marginBottom: '24px' }}>
              <strong>{actionError}</strong>
            </div>
          )}

          <div className="two-column-layout">
            <div className="support-main-column">
              <article className="status-card support-panel" style={{ marginBottom: '24px' }}>
                <div className="status-card-heading">
                  <h2>Description</h2>
                </div>
                <div className="message-body" style={{ padding: '12px' }}>
                  {data.description}
                </div>
              </article>

              <article className="status-card support-panel">
                <div className="status-card-heading">
                  <h2>Conversation</h2>
                  <span className="muted-copy">{data.messages.length} replies</span>
                </div>
                <div className="support-thread">
                  {data.messages.length === 0 ? (
                    <p className="muted-copy">No replies have been added yet.</p>
                  ) : (
                    data.messages.map((message) => {
                      const isStaff = message.authorType === 'PLATFORM_STAFF';
                      return (
                        <div className={`message-card ${isStaff ? 'staff' : 'customer'}`} key={message.id}>
                          <div className="message-header">
                            <strong>
                              {isStaff ? staffName(message.authorStaff) : (data.requesterName || 'Tenant requester')}
                              {isStaff && <span style={{ marginLeft: '8px', color: 'var(--color-primary)' }}>(Staff)</span>}
                            </strong>
                            <span>{formatDate(message.createdAt)}</span>
                          </div>
                          <div className="message-body">{message.message}</div>
                        </div>
                      );
                    })
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
                      placeholder="Write a staff reply to the customer..."
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      style={{ width: '100%', marginBottom: '12px' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        className="button"
                        disabled={submitting !== null || !reply.trim()}
                        type="submit"
                      >
                        {submitting === 'reply' ? 'Sending...' : 'Send reply'}
                      </button>
                    </div>
                  </form>
                </PermissionGate>
              </article>
            </div>

            <aside className="support-side-column">
              <article className="status-card support-panel" style={{ marginBottom: '24px' }}>
                <h2>Ticket Metadata</h2>
                <div className="permission-list" style={{ marginTop: '16px' }}>
                  <div className="permission-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <span className="muted-copy">Organization</span>
                    <strong>{data.organization.name}</strong>
                  </div>
                  <div className="permission-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <span className="muted-copy">Requester</span>
                    <strong>{data.requesterName || 'Unknown'} {data.requesterEmail ? `(${data.requesterEmail})` : ''}</strong>
                  </div>
                  <div className="permission-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <span className="muted-copy">Category</span>
                    <strong>{supportLabel(data.category)}</strong>
                  </div>
                  <div className="permission-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <span className="muted-copy">Created</span>
                    <strong>{formatDate(data.createdAt)}</strong>
                  </div>
                  <div className="permission-row" style={{ padding: '8px 0' }}>
                    <span className="muted-copy">Updated</span>
                    <strong>{formatDate(data.updatedAt)}</strong>
                  </div>
                </div>
              </article>

              <article className="status-card support-panel" style={{ marginBottom: '24px' }}>
                <div className="status-card-heading">
                  <h2>Internal Notes</h2>
                  <span className="muted-copy">
                    {data.internalNotes.length} notes
                  </span>
                </div>
                <div className="support-thread">
                  {data.internalNotes.length === 0 ? (
                    <p className="muted-copy">No internal notes have been added.</p>
                  ) : (
                    data.internalNotes.map((item) => (
                      <div className="internal-note-item" key={item.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <strong>{staffName(item.staff)}</strong>
                          <span className="muted-copy">{formatDate(item.createdAt)}</span>
                        </div>
                        <p>{item.note}</p>
                      </div>
                    ))
                  )}
                </div>
                <PermissionGate
                  permission="support.ticket.note"
                >
                  <form className="support-action-form" onSubmit={submitNote}>
                    <textarea
                      required
                      rows={2}
                      maxLength={5000}
                      placeholder="Add a private internal note..."
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      style={{ width: '100%', marginBottom: '12px' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        className="button button-secondary"
                        disabled={submitting !== null || !note.trim()}
                        type="submit"
                      >
                        {submitting === 'note' ? 'Adding...' : 'Add note'}
                      </button>
                    </div>
                  </form>
                </PermissionGate>
              </article>

              <article className="status-card support-panel">
                <h2>Status History</h2>
                <div style={{ marginTop: '16px' }}>
                  {data.statusHistory.length === 0 ? (
                    <p className="muted-copy">No status history recorded.</p>
                  ) : (
                    data.statusHistory.map((item) => (
                      <div className="timeline-item" key={item.id}>
                        <div className="timeline-header">
                          <strong>{supportLabel(item.newStatus)}</strong>
                          <span className="timeline-meta">{formatDate(item.createdAt)}</span>
                        </div>
                        <div className="timeline-meta">
                          {item.previousStatus ? `From ${supportLabel(item.previousStatus)}` : 'Initial status'} by {staffName(item.changedByStaff)}
                        </div>
                        {item.note && <div className="timeline-note">{item.note}</div>}
                      </div>
                    ))
                  )}
                </div>
              </article>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
