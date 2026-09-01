import { Navigate, Route, Routes } from 'react-router-dom';
import { PermissionRoute } from '../auth/PermissionRoute';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { PublicOnlyRoute } from '../auth/PublicOnlyRoute';
import { LoginPage } from '../features/auth/LoginPage';
import { UnauthorizedPage } from '../features/auth/UnauthorizedPage';
import { HealthPage } from '../features/health/HealthPage';
import { OrganizationCreatePage } from '../features/organizations/OrganizationCreatePage';
import { OrganizationDetailPage } from '../features/organizations/OrganizationDetailPage';
import { OrganizationsPage } from '../features/organizations/OrganizationsPage';
import { RoleCreatePage } from '../features/roles/RoleCreatePage';
import { RoleDetailPage } from '../features/roles/RoleDetailPage';
import { RolesPage } from '../features/roles/RolesPage';
import { StaffCreatePage } from '../features/staff/StaffCreatePage';
import { StaffDetailPage } from '../features/staff/StaffDetailPage';
import { StaffPage } from '../features/staff/StaffPage';
import { AdminLayout } from '../layouts/AdminLayout';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="login" element={<LoginPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<HealthPage />} />
          <Route path="health" element={<HealthPage />} />
          <Route path="organizations" element={<OrganizationsPage />} />
          <Route
            element={
              <PermissionRoute permission="platform.organization.create" />
            }
          >
            <Route
              path="organizations/new"
              element={<OrganizationCreatePage />}
            />
          </Route>
          <Route path="organizations/:id" element={<OrganizationDetailPage />} />
          <Route element={<PermissionRoute permission="platform.staff.view" />}>
            <Route path="staff" element={<StaffPage />} />
            <Route path="staff/:id" element={<StaffDetailPage />} />
          </Route>
          <Route element={<PermissionRoute permission="platform.staff.create" />}>
            <Route path="staff/new" element={<StaffCreatePage />} />
          </Route>
          <Route element={<PermissionRoute permission="platform.role.view" />}>
            <Route path="roles" element={<RolesPage />} />
            <Route path="roles/:id" element={<RoleDetailPage />} />
          </Route>
          <Route element={<PermissionRoute permission="platform.role.manage" />}>
            <Route path="roles/new" element={<RoleCreatePage />} />
          </Route>
        </Route>
      </Route>
      <Route path="unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
