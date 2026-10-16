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
import { ToastHost } from "../components/ToastHost";
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
} from "../features/config-manager/SettingsPages";
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

const named = (loader, name) => lazy(() => loader().then(module => ({ default: module[name] })));
const SubmitterProvider = named(() => import('../features/submitter/SubmitterContext'), 'SubmitterProvider');
const SubmitterLayout = lazy(() => import('../features/submitter/components/SubmitterLayout'));
const SubmitterDashboard = lazy(() => import('../features/submitter/pages/DashboardPage'));
const SubmitExpense = lazy(() => import('../features/submitter/pages/SubmitExpensePage'));
const SubmitterExpenses = lazy(() => import('../features/submitter/pages/ExpensesPage'));
const SubmitterStatus = lazy(() => import('../features/submitter/pages/StatusPage'));
const SubmitterReports = lazy(() => import('../features/submitter/pages/ReportsPage'));
const SubmitterNotifications = lazy(() => import('../features/submitter/pages/NotificationsPage'));
const SubmitterProfile = lazy(() => import('../features/submitter/pages/ProfileSettingsPage'));
const ManagerLayout = named(() => import('../features/manager/ManagerLayout'), 'ManagerLayout');
const ManagerDashboard = named(() => import('../features/manager/ManagerDashboard'), 'ManagerDashboard');
const ManagerExpenseQueue = named(() => import('../features/manager/ManagerExpenseQueue'), 'ManagerExpenseQueue');
const ManagerExpenseDetails = named(() => import('../features/manager/ManagerExpenseDetails'), 'ManagerExpenseDetails');
const ManagerHistory = named(() => import('../features/manager/ManagerHistory'), 'ManagerHistory');
const ManagerNotifications = named(() => import('../features/manager/ManagerNotifications'), 'ManagerNotifications');
const ManagerProfileSettings = named(() => import('../features/manager/ManagerProfileSettings'), 'ManagerProfileSettings');
const FinanceLayout = named(() => import('../features/finance/FinanceLayout'), 'FinanceLayout');
const FinanceDashboard = named(() => import('../features/finance/FinanceDashboard'), 'FinanceDashboard');
const FinanceReviewQueue = named(() => import('../features/finance/FinanceReviewQueue'), 'FinanceReviewQueue');
const PaymentReleaseView = named(() => import('../features/finance/PaymentReleaseView'), 'PaymentReleaseView');
const TransactionsView = named(() => import('../features/finance/TransactionsView'), 'TransactionsView');
const FinanceNotifications = named(() => import('../features/finance/FinanceNotifications'), 'FinanceNotifications');
const FinanceSettings = named(() => import('../features/finance/FinanceSettings'), 'FinanceSettings');
const ComplianceLayout = named(() => import('../features/compliance/ComplianceLayout'), 'ComplianceLayout');
const ComplianceDashboard = named(() => import('../features/compliance/ComplianceDashboard'), 'ComplianceDashboard');
const ComplianceReviewQueue = named(() => import('../features/compliance/ComplianceReviewQueue'), 'ComplianceReviewQueue');
const PoliciesViolationsView = named(() => import('../features/compliance/PoliciesViolationsView'), 'PoliciesViolationsView');
const ComplianceAuditView = named(() => import('../features/compliance/ComplianceAuditView'), 'ComplianceAuditView');
const ComplianceNotifications = named(() => import('../features/compliance/ComplianceNotifications'), 'ComplianceNotifications');
const ComplianceSettings = named(() => import('../features/compliance/ComplianceSettings'), 'ComplianceSettings');

function SubmitterWorkspace() {
  return <SubmitterProvider><SubmitterLayout /></SubmitterProvider>;
}

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
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
              <Route element={<ProtectedRoute allowedRoles={["EXPENSE_SUBMITTER"]} />}>
                <Route element={<SubmitterWorkspace />}>
                  <Route path="dashboard" element={<SubmitterDashboard />} />
                  <Route path="submit" element={<SubmitExpense />} />
                  <Route path="expenses" element={<SubmitterExpenses />} />
                  <Route path="status" element={<SubmitterStatus />} />
                  <Route path="reports" element={<SubmitterReports />} />
                  <Route path="notifications" element={<SubmitterNotifications />} />
                  <Route path="profile-settings" element={<SubmitterProfile />} />
                </Route>
              </Route>
              <Route element={<ProtectedRoute allowedRoles={["MANAGER"]} />}>
                <Route path="manager" element={<ManagerLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<ManagerDashboard />} />
                  <Route path="expenses" element={<ManagerExpenseQueue />} />
                  <Route path="expenses/:expenseId" element={<ManagerExpenseDetails />} />
                  <Route path="history" element={<ManagerHistory />} />
                  <Route path="notifications" element={<ManagerNotifications />} />
                  <Route path="profile-settings" element={<ManagerProfileSettings />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
              <Route element={<ProtectedRoute allowedRoles={["FINANCE_OFFICER"]} />}>
                <Route path="finance" element={<FinanceLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<FinanceDashboard />} />
                  <Route path="queue" element={<FinanceReviewQueue />} />
                  <Route path="payments" element={<PaymentReleaseView />} />
                  <Route path="transactions" element={<TransactionsView />} />
                  <Route path="notifications" element={<FinanceNotifications />} />
                  <Route path="settings" element={<FinanceSettings />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
              <Route element={<ProtectedRoute allowedRoles={["COMPLIANCE_OFFICER"]} />}>
                <Route path="compliance" element={<ComplianceLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<ComplianceDashboard />} />
                  <Route path="queue" element={<ComplianceReviewQueue />} />
                  <Route path="policies" element={<PoliciesViolationsView />} />
                  <Route path="audit" element={<ComplianceAuditView />} />
                  <Route path="notifications" element={<ComplianceNotifications />} />
                  <Route path="settings" element={<ComplianceSettings />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
          <ToastHost />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
