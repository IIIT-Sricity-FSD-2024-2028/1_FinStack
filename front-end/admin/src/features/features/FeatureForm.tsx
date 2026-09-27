import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Feature, FeatureValueType } from '../../types/catalog';
import { platformCatalogApi } from '../../services/api/platform-catalog';

interface FeatureFormProps {
  initialData?: Feature;
  onSuccess?: (feature: Feature) => void;
  onCancel?: () => void;
}

export const FeatureForm: React.FC<FeatureFormProps> = ({ initialData, onSuccess, onCancel }) => {
  const navigate = useNavigate();
  const isEditing = !!initialData;

  const [formData, setFormData] = useState({
    key: initialData?.key || '',
    name: initialData?.name || '',
    description: initialData?.description || '',
    valueType: initialData?.valueType || 'BOOLEAN',
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
      const payload: Partial<Feature> = {
        name: formData.name,
        description: formData.description || null,
      };

      if (!isEditing) {
        payload.key = formData.key;
        payload.valueType = formData.valueType as FeatureValueType;
        const newFeature = await platformCatalogApi.createFeature(payload);
        if (onSuccess) onSuccess(newFeature);
      } else {
        const updatedFeature = await platformCatalogApi.updateFeature(initialData.id, payload);
        if (onSuccess) onSuccess(updatedFeature);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e.response?.data?.error?.message || 'An error occurred while saving the feature.');
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
            Feature Key
            <input
              type="text"
              name="key"
              value={formData.key}
              onChange={handleChange}
              required
              pattern="^[A-Z0-9_]+$"
              title="Uppercase letters, numbers, and underscores only"
              placeholder="e.g. MAX_USERS"
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

        {!isEditing && (
          <label className="field-wide">
            Value Type
            <select
              name="valueType"
              value={formData.valueType}
              onChange={handleChange}
              required
            >
              <option value="BOOLEAN">Boolean (True/False)</option>
              <option value="INTEGER">Integer Number</option>
              <option value="DECIMAL">Decimal Number</option>
              <option value="STRING">Text (String)</option>
              <option value="JSON">JSON Object/Array</option>
            </select>
            <span style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', display: 'block' }}>
              Note: Value Type cannot be changed after the feature is created.
            </span>
          </label>
        )}
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
          {loading ? 'Saving...' : 'Save Feature'}
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => {
            if (onCancel) {
              onCancel();
            } else {
              navigate('/features');
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
