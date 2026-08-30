import React, { useState } from 'react';
import { PermissionGate } from '../../auth/PermissionGate';
import { PlanFeature } from '../../types/catalog';

interface PlanFeatureRowProps {
  pf: PlanFeature;
  updateFeature: (data: { featureId: string; payload: { enabled?: boolean; value?: unknown } }) => Promise<void>;
  isUpdatingFeature: boolean;
  removeFeature: (featureId: string) => Promise<void>;
  isRemovingFeature: boolean;
}

export const PlanFeatureRow: React.FC<PlanFeatureRowProps> = ({
  pf,
  updateFeature,
  isUpdatingFeature,
  removeFeature,
  isRemovingFeature,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [enabled, setEnabled] = useState(pf.enabled);
  const [value, setValue] = useState<string>(
    pf.value !== null ? (typeof pf.value === 'object' ? JSON.stringify(pf.value) : String(pf.value)) : ''
  );

  const handleSave = async () => {
    let parsedValue: unknown = null;
    if (value !== '') {
      if (pf.feature!.valueType === 'INTEGER') parsedValue = parseInt(value, 10);
      else if (pf.feature!.valueType === 'DECIMAL') parsedValue = parseFloat(value);
      else if (pf.feature!.valueType === 'BOOLEAN') parsedValue = value === 'true';
      else if (pf.feature!.valueType === 'JSON') {
        try {
          parsedValue = JSON.parse(value);
        } catch {
          alert('Invalid JSON');
          return;
        }
      } else {
        parsedValue = value;
      }
    }

    try {
      await updateFeature({ featureId: pf.featureId, payload: { enabled, value: parsedValue } });
      setIsEditing(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      alert(e.response?.data?.error?.message || 'Failed to update feature');
    }
  };

  const handleCancel = () => {
    setEnabled(pf.enabled);
    setValue(pf.value !== null ? (typeof pf.value === 'object' ? JSON.stringify(pf.value) : String(pf.value)) : '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <tr>
        <td style={{ fontFamily: 'monospace' }}>{pf.feature?.key}</td>
        <td>{pf.feature?.name}</td>
        <td>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            style={{ width: '16px', height: '16px' }}
          />
        </td>
        <td>
          {pf.feature?.valueType === 'BOOLEAN' ? (
            <select value={value} onChange={(e) => setValue(e.target.value)} style={{ padding: '4px' }}>
              <option value="">-</option>
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          ) : pf.feature?.valueType === 'INTEGER' || pf.feature?.valueType === 'DECIMAL' ? (
            <input
              type="number"
              step={pf.feature?.valueType === 'INTEGER' ? '1' : '0.01'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Value"
              style={{ padding: '4px', width: '100px' }}
            />
          ) : pf.feature?.valueType === 'JSON' ? (
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={1}
              placeholder="{}"
              style={{ padding: '4px' }}
            />
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Value"
              style={{ padding: '4px' }}
            />
          )}
        </td>
        <td>{new Date(pf.createdAt).toLocaleDateString()}</td>
        <td style={{ textAlign: 'right' }}>
          <button
            className="button button-secondary"
            onClick={handleSave}
            disabled={isUpdatingFeature}
            style={{ padding: '4px 8px', fontSize: '12px' }}
          >
            Save
          </button>
          <button
            className="button button-link"
            onClick={handleCancel}
            disabled={isUpdatingFeature}
            style={{ padding: '4px 8px', fontSize: '12px', marginLeft: '8px' }}
          >
            Cancel
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td style={{ fontFamily: 'monospace' }}>{pf.feature?.key}</td>
      <td>{pf.feature?.name}</td>
      <td>
        <span
          className={
            pf.enabled ? 'status-pill status-pill-available' : 'status-pill status-pill-unavailable'
          }
        >
          {pf.enabled ? 'Yes' : 'No'}
        </span>
      </td>
      <td>
        {pf.value !== null ? JSON.stringify(pf.value) : <span style={{ color: '#6b7280' }}>-</span>}
      </td>
      <td>{new Date(pf.createdAt).toLocaleDateString()}</td>
      <PermissionGate permission="subscription.plan.manage">
        <td style={{ textAlign: 'right' }}>
          <button
            className="button button-link"
            onClick={() => setIsEditing(true)}
            disabled={isUpdatingFeature}
          >
            Edit
          </button>
          <button
            className="button button-link"
            style={{ color: '#EF4444', marginLeft: '12px' }}
            onClick={() => {
              if (confirm('Remove this feature from the plan?')) {
                void removeFeature(pf.featureId);
              }
            }}
            disabled={isRemovingFeature}
          >
            Remove
          </button>
        </td>
      </PermissionGate>
    </tr>
  );
};
