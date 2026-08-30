import React from 'react';
import { PlanStatus } from '../../types/catalog';
import { useNavigate } from 'react-router-dom';
import { PermissionGate } from '../../auth/PermissionGate';
import { formatBillingInterval, formatPrice, formatStatus, getStatusPillClass } from './plan-ui';
import { usePlans } from './usePlans';

export const PlansPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, error, search, handleSearch, status, handleStatusChange, page, setPage } = usePlans();

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Product Catalog</span>
          <h1>Subscription Plans</h1>
          <p className="page-description">Manage billing plans and base pricing.</p>
        </div>
        <PermissionGate permission="subscription.plan.manage">
          <button className="button" onClick={() => navigate('/plans/new')}>
            Create Plan
          </button>
        </PermissionGate>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search plans..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value as PlanStatus | '')}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <div className="data-table-wrap">
        {isLoading ? (
          <div className="state-panel">
            <span className="loader"></span>
            <p>Loading plans...</p>
          </div>
        ) : error ? (
          <div className="state-panel state-panel-error">
            <p>Failed to load plans. Please try again.</p>
          </div>
        ) : !data?.items.length ? (
          <div className="state-panel">
            <p>No plans found.</p>
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Plan Key</th>
                  <th>Name</th>
                  <th>Billing</th>
                  <th>Base Price</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((plan) => (
                  <tr
                    key={plan.id}
                    onClick={() => navigate(`/plans/${plan.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ fontFamily: 'monospace' }}>{plan.key}</td>
                    <td>{plan.name}</td>
                    <td>{formatBillingInterval(plan.billingInterval)}</td>
                    <td>{formatPrice(plan.basePrice, plan.currency)}</td>
                    <td>
                      <span className={getStatusPillClass(plan.status)}>
                        {formatStatus(plan.status)}
                      </span>
                    </td>
                    <td>{new Date(plan.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {data.totalPages > 1 && (
              <div className="pagination-bar">
                <button
                  className="button button-secondary"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {data.totalPages}
                </span>
                <button
                  className="button button-secondary"
                  disabled={page === data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
