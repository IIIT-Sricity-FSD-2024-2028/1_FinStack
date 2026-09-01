import { Navigate, Route, Routes } from 'react-router-dom';
import { PermissionRoute } from '../auth/PermissionRoute';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { PublicOnlyRoute } from '../auth/PublicOnlyRoute';

import { LoginPage } from '../features/auth/LoginPage';
import { UnauthorizedPage } from '../features/auth/UnauthorizedPage';

import { BillingPage } from '../features/billing/BillingPage';

import { HealthPage } from '../features/health/HealthPage';

import { FeatureCreatePage } from '../features/features/FeatureCreatePage';
import { FeatureDetailPage } from '../features/features/FeatureDetailPage';
import { FeaturesPage } from '../features/features/FeaturesPage';

import { OrganizationCreatePage } from '../features/organizations/OrganizationCreatePage';
import { OrganizationDetailPage } from '../features/organizations/OrganizationDetailPage';
import { OrganizationsPage } from '../features/organizations/OrganizationsPage';

import { PlanCreatePage } from '../features/plans/PlanCreatePage';
import { PlanDetailPage } from '../features/plans/PlanDetailPage';
import { PlansPage } from '../features/plans/PlansPage';

import { RoleCreatePage } from '../features/roles/RoleCreatePage';
import { RoleDetailPage } from '../features/roles/RoleDetailPage';
import { RolesPage } from '../features/roles/RolesPage';

import { StaffCreatePage } from '../features/staff/StaffCreatePage';
import { StaffDetailPage } from '../features/staff/StaffDetailPage';
import { StaffPage } from '../features/staff/StaffPage';

import { SubscriptionDetailPage } from '../features/subscriptions/SubscriptionDetailPage';
import { SubscriptionListPage } from '../features/subscriptions/SubscriptionListPage';

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

          {/* Organizations */}
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

          <Route
            path="organizations/:id"
            element={<OrganizationDetailPage />}
          />

          {/* Staff */}
          <Route
            element={<PermissionRoute permission="platform.staff.view" />}
          >
            <Route path="staff" element={<StaffPage />} />
            <Route path="staff/:id" element={<StaffDetailPage />} />
          </Route>

          <Route
            element={<PermissionRoute permission="platform.staff.create" />}
          >
            <Route path="staff/new" element={<StaffCreatePage />} />
          </Route>

          {/* Roles */}
          <Route
            element={<PermissionRoute permission="platform.role.view" />}
          >
            <Route path="roles" element={<RolesPage />} />
            <Route path="roles/:id" element={<RoleDetailPage />} />
          </Route>

          <Route
            element={<PermissionRoute permission="platform.role.manage" />}
          >
            <Route path="roles/new" element={<RoleCreatePage />} />
          </Route>

          {/* Features */}
          <Route
            element={
              <PermissionRoute permission="subscription.feature.view" />
            }
          >
            <Route path="features" element={<FeaturesPage />} />
            <Route path="features/:id" element={<FeatureDetailPage />} />
          </Route>

          <Route
            element={
              <PermissionRoute permission="subscription.feature.manage" />
            }
          >
            <Route path="features/new" element={<FeatureCreatePage />} />
          </Route>

          {/* Plans */}
          <Route
            element={<PermissionRoute permission="subscription.plan.view" />}
          >
            <Route path="plans" element={<PlansPage />} />
            <Route path="plans/:id" element={<PlanDetailPage />} />
          </Route>

          <Route
            element={<PermissionRoute permission="subscription.plan.manage" />}
          >
            <Route path="plans/new" element={<PlanCreatePage />} />
          </Route>

          {/* Subscriptions */}
          <Route path="subscriptions" element={<SubscriptionListPage />} />

          <Route
            path="subscriptions/trials"
            element={
              <SubscriptionListPage
                fixedStatus="TRIAL"
                title="Trial subscriptions"
                description="Review organizations currently evaluating FinStack through trial subscriptions."
              />
            }
          />

          <Route
            path="subscriptions/expiring"
            element={
              <SubscriptionListPage
                fixedStatus="EXPIRING"
                title="Expiring subscriptions"
                description="Track subscriptions approaching the end of their current commercial period."
              />
            }
          />

          <Route
            path="subscriptions/suspended"
            element={
              <SubscriptionListPage
                fixedStatus="SUSPENDED"
                title="Suspended subscriptions"
                description="Review subscriptions paused through the platform lifecycle controls."
              />
            }
          />

          <Route
            path="subscriptions/:subscriptionId"
            element={<SubscriptionDetailPage />}
          />

          {/* Billing */}
          <Route
            element={<PermissionRoute permission="billing.billing.view" />}
          >
            <Route
              path="billing"
              element={<BillingPage view="overview" />}
            />
          </Route>

          <Route
            element={<PermissionRoute permission="billing.invoice.view" />}
          >
            <Route
              path="billing/invoices"
              element={<BillingPage view="invoices" />}
            />
          </Route>

          <Route
            element={<PermissionRoute permission="billing.payment.view" />}
          >
            <Route
              path="billing/payments"
              element={<BillingPage view="payments" />}
            />
            <Route
              path="billing/failed-payments"
              element={<BillingPage view="failed" />}
            />
          </Route>
        </Route>
      </Route>

      <Route path="unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}