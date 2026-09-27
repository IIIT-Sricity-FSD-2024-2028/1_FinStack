import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';

export function PublicOnlyRoute() {
  const { auth, initializing } = useAuth();
  if (initializing) {
    return (
      <div className="full-page-state" role="status">
        <span className="loader" aria-hidden="true" />
        Checking your session…
      </div>
    );
  }
  return auth ? <Navigate to="/" replace /> : <Outlet />;
}
