import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { createPlatformRole } from '../../services/api/platform-roles';
import { adminErrorMessage } from '../access/access-ui';
import { RoleForm, type RoleFormValues } from './RoleForm';

export function RoleCreatePage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function create(values: RoleFormValues) {
    if (!values.key) return;
    setError(null);
    setSubmitting(true);
    try {
      const role = await createPlatformRole({ key: values.key, name: values.name, ...(values.description ? { description: values.description } : {}) });
      navigate(hasPermission('platform.role.view') ? `/roles/${role.id}` : '/');
    } catch (caught) {
      setError(adminErrorMessage(caught, 'Custom role could not be created.'));
    } finally {
      setSubmitting(false);
    }
  }

  return <section aria-labelledby="create-role-title"><div className="page-header"><div><p className="eyebrow">Role design</p><h1 id="create-role-title">New custom role</h1><p className="page-description">Create role metadata now. Assign permissions after creation.</p></div><Link className="button button-secondary button-link" to="/roles">Back to roles</Link></div>{error && <div className="state-panel state-panel-error" role="alert"><strong>{error}</strong></div>}<div className="status-card form-panel"><RoleForm submitting={submitting} submitLabel="Create custom role" onSubmit={create} /></div></section>;
}
