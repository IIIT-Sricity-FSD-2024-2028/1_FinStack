import type { ReactNode } from 'react';
import { useAuth } from './useAuth';

interface PermissionGateProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({
  permission,
  children,
  fallback = null,
}: PermissionGateProps) {
  return useAuth().hasPermission(permission) ? children : fallback;
}
