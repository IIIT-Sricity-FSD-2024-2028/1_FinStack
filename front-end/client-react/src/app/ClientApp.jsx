import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthProvider, ProtectedRoute } from "../auth/AuthContext";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ConfigurationManagerLayout } from "../layouts/ConfigurationManagerLayout";
import { PublicLayout } from "../layouts/PublicLayout";
import { legacyPaths } from "../routes/paths";
import {
  HomePage,
  LoginPage,
  GuidancePage,
  ActivationPage,
  NotFoundPage,
} from "../features/shared/PublicPages";
import {
  RegistrationPage,
  RegistrationReceiptPage,
} from "../features/shared/RegistrationPage";
import { ConfigManagerDashboard } from "../features/config-manager/ConfigManagerDashboard";
import { NotificationsPage } from "../features/config-manager/WorkspacePages";
import {
  OrganizationSettingsPage,
  PreferencesPage,
  ProfilePage,
  WorkspaceHelpPage,
} from "../features/config-manager/SettingsPages";
import { FinanceLayout } from "../features/finance/FinanceLayout";
import { FinanceDashboard } from "../features/finance/FinanceDashboard";
import { FinanceReviewQueue } from "../features/finance/FinanceReviewQueue";
import { PaymentReleaseView } from "../features/finance/PaymentReleaseView";
import { TransactionsView } from "../features/finance/TransactionsView";
import { FinanceNotifications } from "../features/finance/FinanceNotifications";
const Subscription = lazy(() =>
  import("../features/config-manager/SubscriptionPage").then((module) => ({
    default: module.SubscriptionPage,
  })),
);
const loaders = {
  ConfigManagerManageUsers: () =>
    import("../features/config-manager/ConfigManagerManageUsers"),
  ConfigManagerUserHierarchy: () =>
    import("../features/config-manager/ConfigManagerUserHierarchy"),
  ConfigManagerRolesAccess: () =>
    import("../features/config-manager/ConfigManagerRolesAccess"),
  ConfigManagerExpenseCategories: () =>
    import("../features/config-manager/ConfigManagerExpenseCategories"),
  ConfigManagerExpensePolicies: () =>
    import("../features/config-manager/ConfigManagerExpensePolicies"),
  ConfigManagerAuditLogs: () =>
    import("../features/config-manager/ConfigManagerAuditLogs"),
};
const feature = (name) =>
  lazy(() => loaders[name]().then((module) => ({ default: module[name] })));
const Users = feature("ConfigManagerManageUsers"),
  Hierarchy = feature("ConfigManagerUserHierarchy"),
  Roles = feature("ConfigManagerRolesAccess"),
  Categories = feature("ConfigManagerExpenseCategories"),
  Policies = feature("ConfigManagerExpensePolicies"),
  Audit = feature("ConfigManagerAuditLogs");
function LegacyRedirect() {
  const location = useLocation();
  return (
    <Navigate
      to={
        (legacyPaths[location.pathname] || "/") +
        location.search +
        location.hash
      }
      replace
    />
  );
}
export function ClientApp() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Suspense
            fallback={
              <p role="status" className="standalone-state">
                Loading page…
              </p>
            }
          >
            <Routes>
              {Object.keys(legacyPaths).map((path) => (
                <Route key={path} path={path} element={<LegacyRedirect />} />
              ))}
              <Route element={<PublicLayout />}>
                <Route index element={<HomePage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="register" element={<RegistrationPage />} />
                <Route
                  path="registration/receipt"
                  element={<RegistrationReceiptPage />}
                />
                <Route path="activate-account" element={<ActivationPage />} />
                {[
                  "help",
                  "account-request",
                  "forgot-password",
                  "reset-password",
                ].map((kind) => (
                  <Route
                    key={kind}
                    path={kind}
                    element={<GuidancePage kind={kind} />}
                  />
                ))}
                <Route
                  path="contact"
                  element={<Navigate to="/help" replace />}
                />
                <Route
                  path="support"
                  element={<Navigate to="/help" replace />}
                />
                <Route path="forbidden" element={<NotFoundPage forbidden />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
              <Route element={<ProtectedRoute />}>
                <Route
                  path="configuration"
                  element={<ConfigurationManagerLayout />}
                >
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route
                    path="dashboard"
                    element={<ConfigManagerDashboard />}
                  />
                  <Route path="manage-users" element={<Users />} />
                  <Route path="user-hierarchy" element={<Hierarchy />} />
                  <Route path="roles-access" element={<Roles />} />
                  <Route path="expense-categories" element={<Categories />} />
                  <Route path="expense-policies" element={<Policies />} />
                  <Route path="audit-logs" element={<Audit />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route
                    path="organization-settings"
                    element={<OrganizationSettingsPage />}
                  />
                  <Route path="preferences" element={<PreferencesPage />} />
                  <Route path="profile-settings" element={<ProfilePage />} />
                  <Route path="subscription" element={<Subscription />} />
                  <Route path="help" element={<WorkspaceHelpPage />} />
                  <Route
                    path="password-assistance"
                    element={<WorkspaceHelpPage password />}
                  />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
              <Route
                element={
                  <ProtectedRoute allowedRoles={["FINANCE_OFFICER"]} />
                }
              >
                <Route path="finance" element={<FinanceLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<FinanceDashboard />} />
                  <Route path="queue" element={<FinanceReviewQueue />} />
                  <Route path="payments" element={<PaymentReleaseView />} />
                  <Route
                    path="transactions"
                    element={<TransactionsView />}
                  />
                  <Route
                    path="notifications"
                    element={<FinanceNotifications />}
                  />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
