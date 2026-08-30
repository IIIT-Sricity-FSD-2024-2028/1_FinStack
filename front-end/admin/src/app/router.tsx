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
import { FeatureCreatePage } from '../features/features/FeatureCreatePage';
import { FeatureDetailPage } from '../features/features/FeatureDetailPage';
import { FeaturesPage } from '../features/features/FeaturesPage';
import { PlanCreatePage } from '../features/plans/PlanCreatePage';
import { PlanDetailPage } from '../features/plans/PlanDetailPage';
import { PlansPage } from '../features/plans/PlansPage';
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
          <Route element={<PermissionRoute permission="platform.organization.create" />}>
            <Route path="organizations/new" element={<OrganizationCreatePage />} />
          </Route>
          <Route path="organizations/:id" element={<OrganizationDetailPage />} />

          <Route element={<PermissionRoute permission="subscription.feature.view" />}>
            <Route path="features" element={<FeaturesPage />} />
            <Route path="features/:id" element={<FeatureDetailPage />} />
          </Route>
          <Route element={<PermissionRoute permission="subscription.feature.manage" />}>
            <Route path="features/new" element={<FeatureCreatePage />} />
          </Route>

          <Route element={<PermissionRoute permission="subscription.plan.view" />}>
            <Route path="plans" element={<PlansPage />} />
            <Route path="plans/:id" element={<PlanDetailPage />} />
          </Route>
          <Route element={<PermissionRoute permission="subscription.plan.manage" />}>
            <Route path="plans/new" element={<PlanCreatePage />} />
          </Route>
        </Route>
      </Route>
      <Route path="unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
