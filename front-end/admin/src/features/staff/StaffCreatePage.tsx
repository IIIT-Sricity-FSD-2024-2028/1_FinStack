import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { createPlatformStaff } from '../../services/api/platform-staff';
import { adminErrorMessage } from '../access/access-ui';
import { StaffForm, type StaffFormValues } from './StaffForm';

export function StaffCreatePage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function create(values: StaffFormValues) {
    if (!values.initialPassword) return;
    setError(null);
    setSubmitting(true);
    try {
      const staff = await createPlatformStaff({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        initialPassword: values.initialPassword,
      });
      navigate(hasPermission('platform.staff.view') ? `/staff/${staff.id}` : '/');
    } catch (caught) {
      setError(adminErrorMessage(caught, 'Staff member could not be created.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="create-staff-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Identity provisioning</p>
          <h1 id="create-staff-title">New staff member</h1>
          <p className="page-description">
            Create an active internal account. Roles are assigned after creation.
          </p>
        </div>
        <Link className="button button-secondary button-link" to="/staff">Back to staff</Link>
      </div>
      {error && <div className="state-panel state-panel-error" role="alert"><strong>{error}</strong></div>}
      <div className="status-card form-panel">
        <StaffForm submitting={submitting} submitLabel="Create staff member" onSubmit={create} />
      </div>
    </section>
  );
}
