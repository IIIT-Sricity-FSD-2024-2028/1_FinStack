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
          <PermissionGate permission="subscription.feature.manage">
            <button className="button" onClick={() => setIsEditing(!isEditing)}>
              {isEditing ? 'Cancel Edit' : 'Edit Metadata'}
            </button>
            {!feature.isActive ? (
              <button
                className="button button-secondary"
                onClick={() => {
                  if (confirm('Are you sure you want to activate this feature?')) {
                    activateFeature();
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
                      'Are you sure you want to deactivate this feature? It will no longer be assignable to plans.'
                    )
                  ) {
                    deactivateFeature();
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
        </div>
      )}
    </div>
  );
};
