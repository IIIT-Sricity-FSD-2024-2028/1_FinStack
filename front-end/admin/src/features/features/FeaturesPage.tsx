import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PermissionGate } from '../../auth/PermissionGate';
import { formatValueType } from './feature-ui';
import { useFeatures } from './useFeatures';

export const FeaturesPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, error, search, handleSearch, isActive, handleStatusChange, page, setPage } = useFeatures();

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Product Catalog</span>
          <h1>Features</h1>
          <p className="page-description">Manage product features and limits.</p>
        </div>
        <PermissionGate permission="subscription.feature.manage">
          <button className="button" onClick={() => navigate('/features/new')}>
            Create Feature
          </button>
        </PermissionGate>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search features..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
        <select
          value={isActive}
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      <div className="data-table-wrap">
        {isLoading ? (
          <div className="state-panel">
            <span className="loader"></span>
            <p>Loading features...</p>
          </div>
        ) : error ? (
          <div className="state-panel state-panel-error">
            <p>Failed to load features. Please try again.</p>
          </div>
        ) : !data?.items.length ? (
          <div className="state-panel">
            <p>No features found.</p>
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Feature Key</th>
                  <th>Name</th>
                  <th>Value Type</th>
                  <th>Status</th>
                  <th>Plan Count</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((feature) => (
                  <tr
                    key={feature.id}
                    onClick={() => navigate(`/features/${feature.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ fontFamily: 'monospace' }}>{feature.key}</td>
                    <td>{feature.name}</td>
                    <td>{formatValueType(feature.valueType)}</td>
                    <td>
                      <span
                        className={
                          feature.isActive ? 'status-pill status-pill-available' : 'status-pill status-pill-unavailable'
                        }
                      >
                        {feature.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{feature._count?.planFeatures || 0}</td>
                    <td>{new Date(feature.createdAt).toLocaleDateString()}</td>
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
