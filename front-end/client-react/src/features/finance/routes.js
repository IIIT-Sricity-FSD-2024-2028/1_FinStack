import { FinanceDashboard } from './FinanceDashboard'
import { FinanceReviewQueue } from './FinanceReviewQueue'
import { PaymentReleaseView } from './PaymentReleaseView'
import { TransactionsView } from './TransactionsView'
import { FinanceNotifications } from './FinanceNotifications'

export const financeRoutes = [
  {
    id: 'finance-dashboard',
    workspace: 'finance_officer',
    breadcrumb: 'Dashboard',
    path: '/views/finance/dashboard.html',
    component: FinanceDashboard,
  },
  {
    id: 'finance-review',
    workspace: 'finance_officer',
    breadcrumb: 'Review Queue',
    path: '/views/finance/finance-review.html',
    component: FinanceReviewQueue,
  },
  {
    id: 'finance-payments',
    workspace: 'finance_officer',
    breadcrumb: 'Payment Release',
    path: '/views/finance/payments.html',
    component: PaymentReleaseView,
  },
  {
    id: 'finance-transactions',
    workspace: 'finance_officer',
    breadcrumb: 'Transactions',
    path: '/views/finance/transactions.html',
    component: TransactionsView,
  },
  {
    id: 'finance-notifications',
    workspace: 'finance_officer',
    breadcrumb: 'Notifications',
    path: '/finance/notifications',
    component: FinanceNotifications,
  },
]
