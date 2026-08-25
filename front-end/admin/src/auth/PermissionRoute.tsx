import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';

interface PermissionRouteProps {
  permission: string;
}

export function PermissionRoute({ permission }: PermissionRouteProps) {
  return useAuth().hasPermission(permission) ? (
    <Outlet />
  ) : (
    <Navigate to="/unauthorized" replace />
  );
}
