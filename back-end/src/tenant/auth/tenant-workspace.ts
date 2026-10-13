import { TenantRole } from '@prisma/client';

// TenantUser currently has exactly one role. It is the sole effective role and
// default workspace for an active account; no client choice grants authority.
export const TENANT_WORKSPACES = {
  CONFIGURATION_MANAGER: {
    key: 'configuration_manager',
    path: 'views/config-manager/dashboard.html',
  },
  EXPENSE_SUBMITTER: {
    key: 'expense_submitter',
    path: 'views/submitter/dashboard.html',
  },
  MANAGER: { key: 'manager', path: 'views/manager/dashboard.html' },
  FINANCE_OFFICER: {
    key: 'finance_officer',
    path: 'views/finance/dashboard.html',
  },
  COMPLIANCE_OFFICER: {
    key: 'compliance_officer',
    path: 'views/compliance/dashboard.html',
  },
} satisfies Record<TenantRole, { key: string; path: string }>;

export type TenantWorkspace = { key: string; path: string };
