import { Link } from 'react-router-dom';

export function UnauthorizedPage() {
  return (
    <main className="full-page-state">
      <div>
        <p className="eyebrow">Access denied</p>
        <h1>Permission required</h1>
        <p className="page-description">
          Your account does not have permission to view this area.
        </p>
        <Link className="button button-link" to="/">Return to the dashboard</Link>
      </div>
    </main>
  );
}
