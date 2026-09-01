import { Navigate, Route, Routes } from 'react-router-dom';
import { PermissionRoute } from '../auth/PermissionRoute';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { PublicOnlyRoute } from '../auth/PublicOnlyRoute';
import { LoginPage } from '../features/auth/LoginPage';
import { UnauthorizedPage } from '../features/auth/UnauthorizedPage';
import { HealthPage } from '../features/health/HealthPage';
import { PlatformDashboardPage } from '../features/dashboard/PlatformDashboardPage';
import { OrganizationCreatePage } from '../features/organizations/OrganizationCreatePage';
import { OrganizationDetailPage } from '../features/organizations/OrganizationDetailPage';
import { OrganizationsPage } from '../features/organizations/OrganizationsPage';
import { FeatureCreatePage } from '../features/features/FeatureCreatePage';
import { FeatureDetailPage } from '../features/features/FeatureDetailPage';
import { FeaturesPage } from '../features/features/FeaturesPage';
import { PlanCreatePage } from '../features/plans/PlanCreatePage';
import { PlanDetailPage } from '../features/plans/PlanDetailPage';
import { PlansPage } from '../features/plans/PlansPage';
import { RoleCreatePage } from '../features/roles/RoleCreatePage';
import { RoleDetailPage } from '../features/roles/RoleDetailPage';
import { RolesPage } from '../features/roles/RolesPage';
import { StaffCreatePage } from '../features/staff/StaffCreatePage';
import { StaffDetailPage } from '../features/staff/StaffDetailPage';
import { StaffPage } from '../features/staff/StaffPage';
import { AdminLayout } from '../layouts/AdminLayout';
import { BillingPage } from '../features/billing/BillingPage';
import { SubscriptionCreatePage } from '../features/subscriptions/SubscriptionCreatePage';
import { SubscriptionDetailPage } from '../features/subscriptions/SubscriptionDetailPage';
import { SubscriptionsPage } from '../features/subscriptions/SubscriptionsPage';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="login" element={<LoginPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<PlatformDashboardPage />} />
          <Route path="health" element={<HealthPage />} />
          <Route element={<PermissionRoute permission="platform.organization.view" />}>
            <Route path="organizations" element={<OrganizationsPage />} />
            <Route path="organizations/:id" element={<OrganizationDetailPage />} />
          </Route>
          <Route element={<PermissionRoute permission="platform.organization.create" />}>
            <Route path="organizations/new" element={<OrganizationCreatePage />} />
          </Route>
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

          <Route element={<PermissionRoute permission="subscription.subscription.view" />}>
            <Route path="subscriptions" element={<SubscriptionsPage />} />
            <Route path="subscriptions/:id" element={<SubscriptionDetailPage />} />
          </Route>
          <Route element={<PermissionRoute permission="subscription.subscription.manage" />}>
            <Route path="subscriptions/new" element={<SubscriptionCreatePage />} />
          </Route>
          <Route element={<PermissionRoute anyOf={['billing.revenue.view', 'billing.invoice.view', 'billing.payment.view']} />}>
            <Route path="billing" element={<BillingPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
