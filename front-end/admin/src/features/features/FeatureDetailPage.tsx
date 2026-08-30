import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PermissionGate } from '../../auth/PermissionGate';
import { formatValueType } from './feature-ui';
import { FeatureForm } from './FeatureForm';
import { useFeature } from './useFeature';

export const FeatureDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const {
    data: feature,
    isLoading,
    error,
    activateFeature,
    deactivateFeature,
    isActivating,
    isDeactivating,
    refetch,
  } = useFeature(id!);

  const [isEditing, setIsEditing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'activate' | 'deactivate' | null>(null);

  if (isLoading) {
    return (
      <div className="state-panel">
        <span className="loader"></span>
        <p>Loading feature details...</p>
      </div>
    );
  }

  if (error || !feature) {
    return (
      <div className="state-panel state-panel-error">
        <p>Failed to load feature details. It may not exist.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Product Catalog / Feature</span>
          <h1>{feature.name}</h1>
          <p className="page-description" style={{ fontFamily: 'monospace' }}>
            {feature.key}
          </p>
        </div>
        <Link className="button button-secondary button-link" to="/features">
          Back to features
        </Link>
      </div>
      <div className="filter-bar" style={{ justifyContent: 'flex-end', borderBottom: 'none', paddingBottom: 0 }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span
            className={
              feature.isActive ? 'status-pill status-pill-available' : 'status-pill status-pill-unavailable'
            }
          >
            {feature.isActive ? 'Active' : 'Inactive'}
          </span>
          {confirmAction ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <strong style={{ fontSize: '14px', color: 'var(--color-error)' }}>
                {confirmAction === 'activate' ? 'Activate this feature?' : 'Deactivate this feature?'}
              </strong>
              <button
                className="button"
                onClick={() => {
                  if (confirmAction === 'activate') {
                    void activateFeature().then(() => setConfirmAction(null));
                  } else {
                    void deactivateFeature().then(() => setConfirmAction(null));
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
            <PermissionGate permission="subscription.feature.manage">
              <button className="button" onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? 'Cancel Edit' : 'Edit Metadata'}
              </button>
              {!feature.isActive ? (
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
          <FeatureForm
            initialData={feature}
            onSuccess={() => {
              void refetch(true);
              setIsEditing(false);
            }}
            onCancel={() => setIsEditing(false)}
          />
        </div>
      ) : (
        <div className="status-card" style={{ marginBottom: '32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            <div>
              <p className="eyebrow">Value Type</p>
              <p>{formatValueType(feature.valueType)}</p>
            </div>
            <div>
              <p className="eyebrow">Usage</p>
              <p>Assigned to {feature._count?.planFeatures || 0} plans</p>
            </div>
            <div>
              <p className="eyebrow">Description</p>
              <p>{feature.description || 'No description provided.'}</p>
            </div>
          </div>

          <div className="status-card form-panel" style={{ marginTop: '32px' }}>
            <h2>Plans using this feature</h2>
            {!feature.planFeatures || feature.planFeatures.length === 0 ? (
              <p className="muted-copy">No plans are currently using this feature.</p>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Plan Name</th>
                      <th>Enabled</th>
                      <th>Assigned Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feature.planFeatures.map((pf) => (
                      <tr key={pf.id}>
                        <td>
                          <Link to={`/plans/${pf.plan?.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            <strong>{pf.plan?.name}</strong>
                            <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>{pf.plan?.key}</span>
                          </Link>
                        </td>
                        <td>
                          <span className={pf.enabled ? 'status-pill status-pill-available' : 'status-pill status-pill-unavailable'}>
                            {pf.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace' }}>
                          {pf.value !== null ? JSON.stringify(pf.value) : 'null'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
