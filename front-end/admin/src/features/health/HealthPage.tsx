import { StatusCard } from '../../components/StatusCard';
import { usePlatformHealth } from './usePlatformHealth';

export function HealthPage() {
  const { data, error, loading, reload } = usePlatformHealth();

  return (
    <section aria-labelledby="health-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">Platform foundation</p>
          <h1 id="health-title">System health</h1>
          <p className="page-description">
            Live availability for the Admin API and its PostgreSQL connection.
          </p>
        </div>
        <button className="button" type="button" onClick={() => void reload()}>
          Refresh status
        </button>
      </div>

      {loading && (
        <div className="state-panel" role="status">
          <span className="loader" aria-hidden="true" />
          Checking platform services…
        </div>
      )}

      {!loading && error && (
        <div className="state-panel state-panel-error" role="alert">
          <div>
            <strong>Platform API unavailable</strong>
            <p>{error}</p>
          </div>
          <button className="button button-secondary" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="summary-banner">
            <span
              className={`status-dot status-dot-${
                data.status === 'healthy' ? 'available' : 'unavailable'
              }`}
              aria-hidden="true"
            />
            <div>
              <strong>
                Platform status: {data.status === 'healthy' ? 'Healthy' : 'Degraded'}
              </strong>
              <span>Last checked {new Date(data.checkedAt).toLocaleString()}</span>
            </div>
          </div>

          <div className="status-grid">
            <StatusCard
              label="Platform API"
              status={data.api.status}
              detail="The versioned control-plane endpoint is responding."
            />
            <StatusCard
              label="PostgreSQL"
              status={data.database.status}
              detail={
                data.database.status === 'available'
                  ? 'Prisma completed a live database query.'
                  : 'The API is running, but the database probe failed.'
              }
            />
          </div>
        </>
      )}
    </section>
  );
}
