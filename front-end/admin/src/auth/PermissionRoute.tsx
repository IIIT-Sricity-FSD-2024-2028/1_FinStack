import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';

interface PermissionRouteProps {
  permission?: string;
  anyOf?: string[];
}

export function PermissionRoute({ permission, anyOf }: PermissionRouteProps) {
  const { hasPermission } = useAuth();
  const allowed = permission
    ? hasPermission(permission)
    : (anyOf?.some((candidate) => hasPermission(candidate)) ?? false);

  return allowed ? (
    <Outlet />
  ) : (
    <Navigate to="/unauthorized" replace />
  );
}
