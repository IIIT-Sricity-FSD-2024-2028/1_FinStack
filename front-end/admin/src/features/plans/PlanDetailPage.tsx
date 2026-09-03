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

  const { data: featuresData } = useFeatures({ isActive: 'true' }); // for the assign dropdown

  const [isEditing, setIsEditing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'activate' | 'deactivate' | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState('');
  const [assignValue, setAssignValue] = useState('');
  const [assignEnabled, setAssignEnabled] = useState(true);
  const [assignIsAddOn, setAssignIsAddOn] = useState(false);
  const [assignAddOnPrice, setAssignAddOnPrice] = useState('0');
  const [assignError, setAssignError] = useState<string | null>(null);

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
    setAssignError(null);

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
          setAssignError('Invalid JSON');
          return;
        }
      } else {
        parsedValue = assignValue;
      }
    }

    try {
      if (assignIsAddOn && (!Number.isFinite(Number(assignAddOnPrice)) || Number(assignAddOnPrice) < 0)) {
        setAssignError('Add-on price must be zero or greater.');
        return;
      }
      await assignFeature({
        featureId: selectedFeatureId,
        enabled: assignEnabled,
        isAddOn: assignIsAddOn,
        addOnPrice: assignIsAddOn ? assignAddOnPrice : '0',
        value: parsedValue,
      });
      setSelectedFeatureId('');
      setAssignValue('');
      setAssignEnabled(true);
      setAssignIsAddOn(false);
      setAssignAddOnPrice('0');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setAssignError(e.response?.data?.error?.message || 'Failed to assign feature');
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
          {confirmAction ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <strong style={{ fontSize: '14px', color: 'var(--color-error)' }}>
                {confirmAction === 'activate' ? 'Activate this plan?' : 'Deactivate this plan?'}
              </strong>
              <button
                className="button"
                onClick={() => {
                  if (confirmAction === 'activate') {
                    void activatePlan().then(() => setConfirmAction(null));
                  } else {
                    void deactivatePlan().then(() => setConfirmAction(null));
                  }
                }}
                disabled={isActivating || isDeactivating}
              >
                Confirm
              </button>
              <button
                className="button button-secondary"
                onClick={() => setConfirmAction(null)}
                disabled={isActivating || isDeactivating}
              >
                Cancel
              </button>
            </div>
          ) : (
            <PermissionGate permission="subscription.plan.manage">
              <button className="button" onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? 'Cancel Edit' : 'Edit Metadata'}
              </button>
              {plan.status === 'INACTIVE' ? (
                <button
                  className="button button-secondary"
                  onClick={() => setConfirmAction('activate')}
                  disabled={isActivating}
                >
                  Activate
                </button>
              ) : (
                <button
                  className="button button-secondary"
                  onClick={() => setConfirmAction('deactivate')}
                  disabled={isDeactivating}
                >
                  Deactivate
                </button>
              )}
            </PermissionGate>
          )}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '24px' }}>
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
              <p className="eyebrow">Included Employee Seats</p>
              <p>{plan.includedEmployeeCount}</p>
            </div>
            <div>
              <p className="eyebrow">Additional Employee Price</p>
              <p>{formatPrice(plan.additionalEmployeePrice, plan.currency)} / employee / {plan.billingInterval === 'YEARLY' ? 'year' : 'month'}</p>
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
        <div className="status-card form-panel" style={{ marginBottom: '32px' }}>
          <form onSubmit={handleAssignFeature} className="login-form">
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Assign Feature</h3>
            <div className="form-grid">
              <label>
                Feature
                <select
                  value={selectedFeatureId}
                  onChange={(e) => {
                    setSelectedFeatureId(e.target.value);
                    setAssignValue('');
                  }}
                  required
                >
                  <option value="">-- Select an active feature --</option>
                  {unassignedFeatures?.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.valueType})
                    </option>
                  ))}
                </select>
              </label>

              {selectedFeatureId && (() => {
                const feature = featuresData?.items.find((f) => f.id === selectedFeatureId);
                return (
                  <label>
                    Assigned Value ({feature?.valueType})
                    {feature?.valueType === 'BOOLEAN' ? (
                      <select value={assignValue} onChange={(e) => setAssignValue(e.target.value)}>
                        <option value="">Default (null)</option>
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    ) : feature?.valueType === 'INTEGER' || feature?.valueType === 'DECIMAL' ? (
                      <input
                        type="number"
                        step={feature.valueType === 'INTEGER' ? '1' : 'any'}
                        placeholder="Value (optional)"
                        value={assignValue}
                        onChange={(e) => setAssignValue(e.target.value)}
                      />
                    ) : feature?.valueType === 'JSON' ? (
                      <textarea
                        rows={3}
                        placeholder='JSON (e.g. {"limit": 10})'
                        value={assignValue}
                        onChange={(e) => setAssignValue(e.target.value)}
                      />
                    ) : (
                      <input
                        type="text"
                        placeholder="String Value (optional)"
                        value={assignValue}
                        onChange={(e) => setAssignValue(e.target.value)}
                      />
                    )}
                  </label>
                );
              })()}
            </div>

            {selectedFeatureId && (
              <div className="form-grid" style={{ marginTop: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flexDirection: 'row' }}>
                  <input
                    type="checkbox"
                    style={{ width: 'auto', minHeight: 'auto' }}
                    checked={assignEnabled}
                    onChange={(e) => setAssignEnabled(e.target.checked)}
                  />
                  <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--color-text)' }}>Enabled</span>
                </label>
                <label>
                  Access Type
                  <select value={assignIsAddOn ? 'ADD_ON' : 'INCLUDED'} onChange={(e) => setAssignIsAddOn(e.target.value === 'ADD_ON')}>
                    <option value="INCLUDED">Included</option>
                    <option value="ADD_ON">Paid Add-on</option>
                  </select>
                </label>
                {assignIsAddOn && (
                  <label>
                    Add-on Price ({plan.currency})
                    <input type="number" min="0" step="0.01" value={assignAddOnPrice} onChange={(e) => setAssignAddOnPrice(e.target.value)} required />
                  </label>
                )}
              </div>
            )}

            {assignError && (
              <div style={{ color: 'var(--color-error)', fontSize: '14px', marginTop: '12px' }}>
                {assignError}
              </div>
            )}

            <div className="form-actions" style={{ marginTop: '16px' }}>
              <button type="submit" className="button" disabled={isAssigning || !selectedFeatureId}>
                Assign Feature
              </button>
            </div>
          </form>
        </div>
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
                <th>Access Type</th>
                <th>Add-on Price</th>
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
                  currency={plan.currency}
                  billingInterval={plan.billingInterval}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
