import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

export function ProtectedRoute() {
  const { auth, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="full-page-state" role="status">
        <span className="loader" aria-hidden="true" />
        Restoring your secure session…
      </div>
    );
  }
  if (!auth) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
