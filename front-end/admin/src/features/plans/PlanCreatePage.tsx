import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PlanForm } from './PlanForm';

export const PlanCreatePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Product Catalog</span>
          <h1>Create Plan</h1>
          <p className="page-description">Define a new subscription plan.</p>
        </div>
      </div>

      <div className="status-card form-panel">
        <PlanForm
          onSuccess={(plan) => {
            navigate(`/plans/${plan.id}`);
          }}
        />
      </div>
    </div>
  );
};
