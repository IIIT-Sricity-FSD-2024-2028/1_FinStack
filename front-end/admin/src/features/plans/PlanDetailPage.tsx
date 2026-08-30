import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PermissionGate } from '../../auth/PermissionGate';
import { useFeatures } from '../features/useFeatures';
import { formatBillingInterval, formatPrice, formatStatus, getStatusPillClass } from './plan-ui';
import { PlanFeatureRow } from './PlanFeatureRow';
import { PlanForm } from './PlanForm';
import { usePlan } from './usePlan';

export const PlanDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const {
    data: plan,
    isLoading,
    error,
    activatePlan,
    deactivatePlan,
    isActivating,
    isDeactivating,
    assignFeature,
    isAssigning,
    updateFeature,
    isUpdatingFeature,
    removeFeature,
    isRemovingFeature,
    refetch,
  } = usePlan(id!);

  const { data: featuresData } = useFeatures(); // for the assign dropdown

  const [isEditing, setIsEditing] = useState(false);
  const [selectedFeatureId, setSelectedFeatureId] = useState('');
  const [assignValue, setAssignValue] = useState('');

  if (isLoading) {
    return (
      <div className="state-panel">
        <span className="loader"></span>
        <p>Loading plan details...</p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="state-panel state-panel-error">
        <p>Failed to load plan details. It may not exist.</p>
      </div>
    );
  }

  const handleAssignFeature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeatureId) return;

    const feature = featuresData?.items.find((f) => f.id === selectedFeatureId);
    let parsedValue: unknown = null;

    if (assignValue) {
      if (feature?.valueType === 'INTEGER') parsedValue = parseInt(assignValue, 10);
      else if (feature?.valueType === 'DECIMAL') parsedValue = parseFloat(assignValue);
      else if (feature?.valueType === 'BOOLEAN') parsedValue = assignValue === 'true';
      else if (feature?.valueType === 'JSON') {
        try {
          parsedValue = JSON.parse(assignValue);
        } catch {
          alert('Invalid JSON');
          return;
        }
      } else {
        parsedValue = assignValue;
      }
    }

    try {
      await assignFeature({ featureId: selectedFeatureId, value: parsedValue });
      setSelectedFeatureId('');
      setAssignValue('');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      alert(e.response?.data?.error?.message || 'Failed to assign feature');
    }
  };



  const unassignedFeatures = featuresData?.items.filter(
    (f) => !plan.planFeatures?.some((pf) => pf.featureId === f.id)
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Product Catalog / Plan</span>
          <h1>{plan.name}</h1>
          <p className="page-description" style={{ fontFamily: 'monospace' }}>
            {plan.key}
          </p>
        </div>
        <Link className="button button-secondary button-link" to="/plans">
          Back to plans
        </Link>
      </div>
      <div className="filter-bar" style={{ justifyContent: 'flex-end', borderBottom: 'none', paddingBottom: 0 }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span className={getStatusPillClass(plan.status)}>
            {formatStatus(plan.status)}
          </span>
          <PermissionGate permission="subscription.plan.manage">
            <button className="button" onClick={() => setIsEditing(!isEditing)}>
              {isEditing ? 'Cancel Edit' : 'Edit Metadata'}
            </button>
            {plan.status === 'INACTIVE' ? (
              <button
                className="button button-secondary"
                onClick={() => {
                  if (confirm('Are you sure you want to activate this plan?')) {
                    activatePlan();
                  }
                }}
                disabled={isActivating}
              >
                Activate
              </button>
            ) : (
              <button
                className="button button-secondary"
                onClick={() => {
                  if (
                    confirm(
                      'Are you sure you want to deactivate this plan? Existing subscriptions are not affected, but new subscriptions cannot select this plan.'
                    )
                  ) {
                    deactivatePlan();
                  }
                }}
                disabled={isDeactivating}
              >
                Deactivate
              </button>
            )}
          </PermissionGate>
        </div>
      </div>

      {isEditing ? (
        <div className="status-card form-panel">
          <PlanForm
            initialData={plan}
            onSuccess={() => {
              void refetch(true);
              setIsEditing(false);
            }}
            onCancel={() => setIsEditing(false)}
          />
        </div>
      ) : (
        <div className="status-card" style={{ marginBottom: '32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
            <div>
              <p className="eyebrow">Billing Interval</p>
              <p>{formatBillingInterval(plan.billingInterval)}</p>
            </div>
            <div>
              <p className="eyebrow">Base Price</p>
              <p>{formatPrice(plan.basePrice, plan.currency)}</p>
            </div>
            <div>
              <p className="eyebrow">Trial Days</p>
              <p>{plan.trialDays ? `${plan.trialDays} days` : 'None'}</p>
            </div>
            <div>
              <p className="eyebrow">Description</p>
              <p>{plan.description || 'No description provided.'}</p>
            </div>
          </div>
        </div>
      )}

      <h2 style={{ marginBottom: '16px' }}>Plan Features ({plan.planFeatures?.length || 0})</h2>

      <PermissionGate permission="subscription.plan.manage">
        <form onSubmit={handleAssignFeature} className="filter-bar" style={{ marginBottom: '24px' }}>
          <select
            value={selectedFeatureId}
            onChange={(e) => setSelectedFeatureId(e.target.value)}
            required
          >
            <option value="">-- Assign a Feature --</option>
            {unassignedFeatures?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.valueType})
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Value (optional)"
            value={assignValue}
            onChange={(e) => setAssignValue(e.target.value)}
          />
          <button type="submit" className="button" disabled={isAssigning || !selectedFeatureId}>
            Assign
          </button>
        </form>
      </PermissionGate>

      {!plan.planFeatures?.length ? (
        <div className="state-panel">
          <p>No features assigned to this plan yet.</p>
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Feature Key</th>
                <th>Name</th>
                <th>Enabled</th>
                <th>Value</th>
                <th>Assigned Date</th>
                <PermissionGate permission="subscription.plan.manage">
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </PermissionGate>
              </tr>
            </thead>
            <tbody>
              {plan.planFeatures.map((pf) => (
                <PlanFeatureRow
                  key={pf.id}
                  pf={pf}
                  updateFeature={updateFeature}
                  isUpdatingFeature={isUpdatingFeature}
                  removeFeature={removeFeature}
                  isRemovingFeature={isRemovingFeature}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
