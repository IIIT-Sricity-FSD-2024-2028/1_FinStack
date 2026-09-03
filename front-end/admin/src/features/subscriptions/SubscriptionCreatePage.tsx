import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorState, LoadingState } from '../../components/OperationalStates';
import { getOrganizations } from '../../services/api/platform-organizations';
import { platformCatalogApi } from '../../services/api/platform-catalog';
import { platformSubscriptionsApi } from '../../services/api/platform-subscriptions';
import type { Organization } from '../../types/organization';
import type { Plan } from '../../types/catalog';
import { adminErrorMessage } from '../access/access-ui';
import { formatMoney } from './subscription-ui';

export function SubscriptionCreatePage() {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [planId, setPlanId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      getOrganizations({ page: 1, limit: 100, sortBy: 'name', order: 'asc' }),
      platformCatalogApi.listPlans({ page: 1, limit: 100, status: 'ACTIVE', sortBy: 'name', order: 'asc' }),
    ]).then(([organizationResult, planResult]) => {
      if (active) { setOrganizations(organizationResult.items); setPlans(planResult.items); setLoading(false); }
    }).catch((caught: unknown) => {
      if (active) { setError(adminErrorMessage(caught, 'Organizations and plans could not be loaded.')); setLoading(false); }
    });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || !planId) return;
    setSubmitting(true); setError(null);
    try {
      const result = await platformSubscriptionsApi.assign(organizationId, planId);
      navigate(`/subscriptions/${result.subscription.id}`);
    } catch (caught) {
      setError(adminErrorMessage(caught, 'Subscription could not be assigned.'));
    } finally { setSubmitting(false); }
  }

  return <section aria-labelledby="subscription-create-title">
    <div className="page-header"><div><p className="eyebrow">Commercial operations</p><h1 id="subscription-create-title">Assign subscription</h1><p className="page-description">Choose an organization and active plan. Price and billing terms come from the backend plan.</p></div><Link className="button button-secondary button-link" to="/subscriptions">Back to subscriptions</Link></div>
    {loading && <LoadingState label="Loading organizations and plans..." />}
    {!loading && error && <ErrorState title="Assignment unavailable" message={error} />}
    {!loading && <div className="status-card form-panel"><form className="login-form" onSubmit={(event) => void submit(event)}>
      <label>Organization<select required value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">Select an organization</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name} ({organization.primaryEmail})</option>)}</select></label>
      <label>Active plan<select required value={planId} onChange={(event) => setPlanId(event.target.value)}><option value="">Select a plan</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} - {formatMoney(plan.basePrice, plan.currency)} / {plan.billingInterval.toLowerCase()}</option>)}</select></label>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="button" disabled={submitting || !organizationId || !planId} type="submit">{submitting ? 'Assigning...' : 'Assign subscription'}</button></div>
    </form></div>}
  </section>;
}
