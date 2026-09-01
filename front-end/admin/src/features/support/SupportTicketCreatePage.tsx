import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createSupportTicket } from '../../services/api/platform-support';
import { getOrganizations } from '../../services/api/platform-organizations';
import type { Organization } from '../../types/organization';
import type {
  SupportTicketPayload,
  TicketCategory,
  TicketPriority,
} from '../../types/support';
import { supportLabel, ticketCategories, ticketPriorities } from './support-ui';

const initialForm: SupportTicketPayload = {
  organizationId: '',
  requesterUserId: '',
  requesterName: '',
  requesterEmail: '',
  category: 'TECHNICAL',
  priority: 'MEDIUM',
  subject: '',
  description: '',
};

export function SupportTicketCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<SupportTicketPayload>(initialForm);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    getOrganizations({ page: 1, limit: 100, sortBy: 'name', order: 'asc' })
      .then((result) => {
        if (active) {
          setOrganizations(result.items);
          setLoading(false);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Organizations could not be loaded.'
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const ticket = await createSupportTicket({
        ...form,
        organizationId: form.organizationId.trim(),
        requesterUserId: form.requesterUserId?.trim() || undefined,
        requesterName: form.requesterName?.trim() || undefined,
        requesterEmail: form.requesterEmail?.trim() || undefined,
        subject: form.subject.trim(),
        description: form.description.trim(),
      });
      navigate(`/support/tickets/${ticket.id}`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Support ticket could not be created.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="create-support-ticket-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Support intake</p>
          <h1 id="create-support-ticket-title">New support ticket</h1>
          <p className="page-description">
            Create a customer support ticket against the canonical organization
            record. Assignment and workload routing are intentionally deferred.
          </p>
        </div>
        <Link className="button button-secondary button-link" to="/support/tickets">
          Back to tickets
        </Link>
      </div>

      {error && (
        <div className="state-panel state-panel-error" role="alert">
          <strong>{error}</strong>
        </div>
      )}

      <div className="status-card form-panel">
        <form className="login-form organization-form" onSubmit={submit}>
          <label>
            Organization
            <select
              required
              disabled={loading}
              value={form.organizationId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  organizationId: event.target.value,
                }))
              }
            >
              <option value="">
                {loading ? 'Loading organizations...' : 'Select an organization'}
              </option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              <span className="optional-label">Requester user ID (optional)</span>
              <input
                maxLength={36}
                value={form.requesterUserId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    requesterUserId: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span className="optional-label">Requester name (optional)</span>
              <input
                maxLength={160}
                value={form.requesterName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    requesterName: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span className="optional-label">Requester email (optional)</span>
              <input
                type="email"
                maxLength={320}
                value={form.requesterEmail}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    requesterEmail: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Category
              <select
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value as TicketCategory,
                  }))
                }
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
                value={form.priority}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priority: event.target.value as TicketPriority,
                  }))
                }
              >
                {ticketPriorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {supportLabel(priority)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-wide">
              Subject
              <input
                required
                minLength={3}
                maxLength={200}
                value={form.subject}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    subject: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field-wide">
              Description
              <textarea
                required
                rows={6}
                maxLength={5000}
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <div className="form-actions">
            <span className="muted-copy">Initial status: Open</span>
            <button className="button" disabled={submitting} type="submit">
              {submitting ? 'Creating...' : 'Create ticket'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
