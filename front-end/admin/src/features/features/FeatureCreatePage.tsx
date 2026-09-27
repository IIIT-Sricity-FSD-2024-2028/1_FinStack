import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FeatureForm } from './FeatureForm';

export const FeatureCreatePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Product Catalog</span>
          <h1>Create Feature</h1>
          <p className="page-description">Define a new product feature or limit.</p>
        </div>
      </div>

      <div className="status-card form-panel">
        <FeatureForm
          onSuccess={(feature) => {
            navigate(`/features/${feature.id}`);
          }}
        />
      </div>
    </div>
  );
};
