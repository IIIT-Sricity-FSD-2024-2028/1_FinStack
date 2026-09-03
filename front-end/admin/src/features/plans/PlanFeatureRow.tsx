import React, { useState } from 'react';
import { PermissionGate } from '../../auth/PermissionGate';
import { PlanFeature, PlanFeatureMutation } from '../../types/catalog';
import { formatPrice } from './plan-ui';

interface PlanFeatureRowProps {
  pf: PlanFeature;
  updateFeature: (data: { featureId: string; payload: PlanFeatureMutation }) => Promise<void>;
  isUpdatingFeature: boolean;
  removeFeature: (featureId: string) => Promise<void>;
  isRemovingFeature: boolean;
  currency: string;
  billingInterval: 'MONTHLY' | 'YEARLY';
}

export const PlanFeatureRow: React.FC<PlanFeatureRowProps> = ({
  pf,
  updateFeature,
  isUpdatingFeature,
  removeFeature,
  isRemovingFeature,
  currency,
  billingInterval,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [enabled, setEnabled] = useState(pf.enabled);
  const [isAddOn, setIsAddOn] = useState(pf.isAddOn);
  const [addOnPrice, setAddOnPrice] = useState(pf.addOnPrice);
  const [value, setValue] = useState<string>(
    pf.value !== null ? (typeof pf.value === 'object' ? JSON.stringify(pf.value) : String(pf.value)) : ''
  );
  const [updateError, setUpdateError] = useState<string | null>(null);

  const handleSave = async () => {
    setUpdateError(null);
    if (isAddOn && (!Number.isFinite(Number(addOnPrice)) || Number(addOnPrice) < 0)) {
      setUpdateError('Add-on price must be zero or greater.');
      return;
    }
    let parsedValue: unknown = null;
    if (value !== '') {
      if (pf.feature!.valueType === 'INTEGER') parsedValue = parseInt(value, 10);
      else if (pf.feature!.valueType === 'DECIMAL') parsedValue = parseFloat(value);
      else if (pf.feature!.valueType === 'BOOLEAN') parsedValue = value === 'true';
      else if (pf.feature!.valueType === 'JSON') {
        try {
          parsedValue = JSON.parse(value);
        } catch {
          setUpdateError('Invalid JSON');
          return;
        }
      } else {
        parsedValue = value;
      }
    }

    try {
      await updateFeature({
        featureId: pf.featureId,
        payload: { enabled, value: parsedValue, isAddOn, addOnPrice: isAddOn ? addOnPrice : '0' },
      });
      setIsEditing(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setUpdateError(e.response?.data?.error?.message || 'Failed to update feature');
    }
  };

  const handleCancel = () => {
    setEnabled(pf.enabled);
    setIsAddOn(pf.isAddOn);
    setAddOnPrice(pf.addOnPrice);
    setValue(pf.value !== null ? (typeof pf.value === 'object' ? JSON.stringify(pf.value) : String(pf.value)) : '');
    setUpdateError(null);
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
          {updateError && (
            <div style={{ color: 'var(--color-error)', fontSize: '12px', marginTop: '4px' }}>
              {updateError}
            </div>
          )}
        </td>
        <td>
          <select value={isAddOn ? 'ADD_ON' : 'INCLUDED'} onChange={(e) => setIsAddOn(e.target.value === 'ADD_ON')} style={{ padding: '4px' }}>
            <option value="INCLUDED">Included</option>
            <option value="ADD_ON">Paid Add-on</option>
          </select>
        </td>
        <td>
          {isAddOn ? <input type="number" min="0" step="0.01" value={addOnPrice} onChange={(e) => setAddOnPrice(e.target.value)} style={{ padding: '4px', width: '100px' }} /> : 'Included'}
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
        {pf.feature?.key === 'MAX_USERS' ? <span style={{ color: '#6b7280' }}>Included Seat Reference</span> : pf.value !== null ? JSON.stringify(pf.value) : <span style={{ color: '#6b7280' }}>-</span>}
      </td>
      <td>
        <span className={pf.isAddOn ? 'status-pill status-pill-pending' : 'status-pill status-pill-available'}>
          {pf.isAddOn ? 'Paid Add-on' : 'Included'}
        </span>
      </td>
      <td>{pf.isAddOn ? `${formatPrice(pf.addOnPrice, currency)} / ${billingInterval === 'YEARLY' ? 'year' : 'month'}` : <span style={{ color: '#6b7280' }}>—</span>}</td>
      <td>{new Date(pf.createdAt).toLocaleDateString()}</td>
      <PermissionGate permission="subscription.plan.manage">
        <td style={{ textAlign: 'right' }}>
          {!confirmRemove ? (
            <>
              <button
                className="button button-link"
                onClick={() => setIsEditing(true)}
                disabled={isUpdatingFeature || isRemovingFeature}
              >
                Edit
              </button>
              <button
                className="button button-link"
                style={{ color: '#EF4444', marginLeft: '12px' }}
                onClick={() => setConfirmRemove(true)}
                disabled={isRemovingFeature || isUpdatingFeature}
              >
                Remove
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-error)' }}>Remove?</span>
              <button
                className="button button-secondary"
                onClick={() => void removeFeature(pf.featureId).then(() => setConfirmRemove(false))}
                disabled={isRemovingFeature}
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                Confirm
              </button>
              <button
                className="button button-link"
                onClick={() => setConfirmRemove(false)}
                disabled={isRemovingFeature}
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                Cancel
              </button>
            </div>
          )}
        </td>
      </PermissionGate>
    </tr>
  );
};
