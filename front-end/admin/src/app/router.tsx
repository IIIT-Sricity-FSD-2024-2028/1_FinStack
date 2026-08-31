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
import { SupportTicketCreatePage } from '../features/support/SupportTicketCreatePage';
import { SupportTicketDetailPage } from '../features/support/SupportTicketDetailPage';
import { SupportTicketsPage } from '../features/support/SupportTicketsPage';
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
          <Route element={<PermissionRoute permission="support.ticket.view" />}>
            <Route path="support/tickets" element={<SupportTicketsPage />} />
            <Route
              path="support/tickets/:id"
              element={<SupportTicketDetailPage />}
            />
          </Route>
          <Route element={<PermissionRoute permission="support.ticket.create" />}>
            <Route
              path="support/tickets/new"
              element={<SupportTicketCreatePage />}
            />
          </Route>
        </Route>
      </Route>
      <Route path="unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
