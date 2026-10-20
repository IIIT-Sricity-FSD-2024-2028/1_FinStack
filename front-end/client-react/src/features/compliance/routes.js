import { ComplianceDashboard } from './ComplianceDashboard'
import { ComplianceReviewQueue } from './ComplianceReviewQueue'
import { PoliciesViolationsView } from './PoliciesViolationsView'
import { ComplianceAuditView } from './ComplianceAuditView'
import { ComplianceNotifications } from './ComplianceNotifications'

export const complianceRoutes = [
  {
    id: 'compliance-dashboard',
    workspace: 'compliance_officer',
    breadcrumb: 'Dashboard',
    path: '/views/compliance/dashboard.html',
    mountId: 'compliance-dashboard-root',
    component: ComplianceDashboard,
  },
  {
    id: 'compliance-queue',
    workspace: 'compliance_officer',
    breadcrumb: 'Escalated Expenses',
    path: '/views/compliance/escalated-expenses.html',
    mountId: 'compliance-queue-root',
    component: ComplianceReviewQueue,
  },
  {
    id: 'compliance-policy-violations',
    workspace: 'compliance_officer',
    breadcrumb: 'Policy Violations',
    path: '/views/compliance/compliance.html',
    mountId: 'compliance-violations-root',
    component: ComplianceReviewQueue,
  },
  {
    id: 'compliance-policies',
    workspace: 'compliance_officer',
    breadcrumb: 'Policies',
    path: '/views/compliance/policies.html',
    mountId: 'compliance-policies-root',
    component: PoliciesViolationsView,
  },
  {
    id: 'compliance-audit',
    workspace: 'compliance_officer',
    breadcrumb: 'Audit Logs',
    path: '/views/compliance/audit.html',
    mountId: 'compliance-audit-root',
    component: ComplianceAuditView,
  },
  {
    id: 'compliance-notifications',
    workspace: 'compliance_officer',
    breadcrumb: 'Notifications',
    path: '/views/compliance/communications.html',
    mountId: 'compliance-notifications-root',
    component: ComplianceNotifications,
  },
]
