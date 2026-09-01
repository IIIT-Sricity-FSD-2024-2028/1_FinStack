import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plan, BillingInterval } from '../../types/catalog';
import { platformCatalogApi } from '../../services/api/platform-catalog';

interface PlanFormProps {
  initialData?: Plan;
  onSuccess?: (plan: Plan) => void;
  onCancel?: () => void;
}

export const PlanForm: React.FC<PlanFormProps> = ({ initialData, onSuccess, onCancel }) => {
  const navigate = useNavigate();
  const isEditing = !!initialData;

  const [formData, setFormData] = useState({
    key: initialData?.key || '',
    name: initialData?.name || '',
    description: initialData?.description || '',
    billingInterval: initialData?.billingInterval || 'MONTHLY',
    basePrice: initialData?.basePrice || '',
    currency: initialData?.currency || 'INR',
    trialDays: initialData?.trialDays?.toString() || '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: Partial<Plan> = {
        name: formData.name,
        description: formData.description || null,
        billingInterval: formData.billingInterval as BillingInterval,
        basePrice: formData.basePrice,
        currency: formData.currency,
        trialDays: formData.trialDays ? parseInt(formData.trialDays, 10) : null,
      };

      if (!isEditing) {
        payload.key = formData.key;
        const newPlan = await platformCatalogApi.createPlan(payload);
        if (onSuccess) onSuccess(newPlan);
      } else {
        const updatedPlan = await platformCatalogApi.updatePlan(initialData.id, payload);
        if (onSuccess) onSuccess(updatedPlan);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e.response?.data?.error?.message || 'An error occurred while saving the plan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="login-form organization-form" onSubmit={handleSubmit}>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <div className="form-grid">
        {!isEditing && (
          <label>
            Plan Key
            <input
              type="text"
              name="key"
              value={formData.key}
              onChange={handleChange}
              required
              pattern="^[A-Z0-9_]+$"
              title="Uppercase letters, numbers, and underscores only"
              placeholder="e.g. STARTER"
            />
          </label>
        )}

        <label>
          Display Name
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            minLength={2}
            maxLength={150}
          />
        </label>

        <label>
          Billing Interval
          <select
            name="billingInterval"
            value={formData.billingInterval}
            onChange={handleChange}
            required
          >
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </label>

        <label>
          Base Price
          <input
            type="number"
            name="basePrice"
            value={formData.basePrice}
            onChange={handleChange}
            required
            min="0"
            step="1"
          />
        </label>

        <label>
          Currency
          <select
            name="currency"
            value={formData.currency}
            onChange={handleChange}
            required
          >
            <option value="INR">INR - Indian Rupee</option>
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - British Pound</option>
          </select>
        </label>

        <label>
          Trial Days (Optional)
          <input
            type="number"
            name="trialDays"
            value={formData.trialDays}
            onChange={handleChange}
            min="0"
            max="365"
          />
        </label>
      </div>

      <label className="field-wide">
        Description
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
        />
      </label>

      <div className="form-actions">
        <button type="submit" className="button" disabled={loading}>
          {loading ? 'Saving...' : 'Save Plan'}
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => {
            if (onCancel) {
              onCancel();
            } else {
              navigate('/plans');
            }
          }}
          disabled={loading}
        >
          Cancel
        </button>
      </div>
    </form>
  );
};
