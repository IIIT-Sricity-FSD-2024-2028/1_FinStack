import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createOrganization } from '../../services/api/platform-organizations';
import type { OrganizationPayload } from '../../types/organization';
import { OrganizationForm } from './OrganizationForm';

export function OrganizationCreatePage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function create(payload: OrganizationPayload) {
    setError(null);
    setSubmitting(true);
    try {
      const organization = await createOrganization(payload);
      navigate(`/organizations/${organization.id}`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Organization could not be created.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="create-organization-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Provisioning</p>
          <h1 id="create-organization-title">New organization</h1>
          <p className="page-description">
            Create the canonical customer record before subscriptions,
            entitlements, billing, or support attach to it.
          </p>
        </div>
        <Link className="button button-secondary button-link" to="/organizations">
          Back to organizations
        </Link>
      </div>
      {error && (
        <div className="state-panel state-panel-error" role="alert">
          <strong>{error}</strong>
        </div>
      )}
      <div className="status-card form-panel">
        <OrganizationForm
          includeStatus
          submitting={submitting}
          submitLabel="Create organization"
          onSubmit={create}
        />
      </div>
    </section>
  );
}
