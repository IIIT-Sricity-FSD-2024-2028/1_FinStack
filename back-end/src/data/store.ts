import { randomUUID } from 'crypto';

export type RoleId =
  | 'expense_submitter'
  | 'manager'
  | 'finance_officer'
  | 'compliance_officer'
  | 'configuration_manager';

export type WorkflowStatus =
  | 'manager_review'
  | 'finance_review'
  | 'compliance_review'
  | 'approved_for_payment'
  | 'payment_processing'
  | 'returned'
  | 'rejected'
  | 'paid';

export interface UserRecord {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  department: string;
  phone: string;
  location: string;
  roles: RoleId[];
  managerEmployeeId: string;
  status: 'Active' | 'Inactive';
  accountStatus: 'approved' | 'pending' | 'rejected';
  organizationId: string;
  password: string;
  firstLoginRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  description: string;
  limit: number;
  currency: string;
  status: 'Active' | 'Inactive';
  organizationId: string;
  requiresReceipt: boolean;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseHistoryRecord {
  code: string;
  label: string;
  at: string;
  note: string;
}

export interface ExpenseRecord {
  id: string;
  employeeId: string;
  organizationId: string;
  managerEmployeeId: string;
  amount: number;
  currency: string;
  categoryId: string;
  merchant: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  workflowStatus: WorkflowStatus;
  notes: string;
  paymentMethod: string;
  receiptFileName: string;
  extraction_confidence?: number;
  flag?: string;
  risk_score?: number;
  managerDecision: string;
  managerDecisionAt?: string;
  managerDecisionNote?: string;
  financeDecision: string;
  financeDecisionAt?: string;
  financeDecisionNote?: string;
  complianceDecision: string;
  complianceDecisionAt?: string;
  complianceDecisionNote?: string;
  escalatedByManager?: boolean;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  history: ExpenseHistoryRecord[];
}

export interface PolicyRecord {
  id: string;
  name: string;
  categoryId: string;
  maxAmount: number;
  currency: string;
  approval: string;
  status: 'Active' | 'Inactive';
  description: string;
  requiresApproval: boolean;
  receiptRequired: boolean;
  ownerRole: RoleId;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  userEmployeeId: string;
  organizationId: string;
  userRoleId: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  status: 'Success' | 'Failure';
  metadata?: Record<string, unknown>;
}

export interface NotificationRecord {
  id: string;
  unread: boolean;
  createdAt: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  recipientEmployeeId: string;
  recipientRole: RoleId | '';
  title: string;
  message: string;
  relatedExpenseId: string;
  relatedEntityId: string;
  actionType: string;
  dedupeKey: string;
}

export interface TransactionRecord {
  id: string;
  expenseId: string;
  employeeId: string;
  organizationId: string;
  amount: number;
  currency: string;
  merchant: string;
  categoryId: string;
  paymentMethod: string;
  status: 'pending' | 'processed' | 'failed' | 'reconciled';
  transactionDate: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  users: UserRecord[];
  expenses: ExpenseRecord[];
  categories: CategoryRecord[];
  policies: PolicyRecord[];
  auditLogs: AuditRecord[];
  notifications: NotificationRecord[];
  transactions: TransactionRecord[];
}

export const createId = (): string => randomUUID();

export const nowIso = (): string => new Date().toISOString();

const organizationId = 'finstack-tech-01';
const createdAt = '2026-03-01T09:00:00.000Z';

const travelCategoryId = createId();
const mealsCategoryId = createId();
const softwareCategoryId = createId();

export const store: Store = {
  users: [
    {
      id: createId(),
      employeeId: 'CFG-1001',
      fullName: 'Polasa Nikhil',
      email: 'polasa.nikhil@finstack.io',
      department: 'Operations',
      phone: '+91 90000 11111',
      location: 'Hyderabad, India',
      roles: ['configuration_manager'],
      managerEmployeeId: '',
      status: 'Active',
      accountStatus: 'approved',
      organizationId,
      password: 'FinStack@123',
      firstLoginRequired: false,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: createId(),
      employeeId: 'MGR-2001',
      fullName: 'Sarah Johnson',
      email: 'sarah.johnson@finstack.io',
      department: 'Marketing',
      phone: '+91 90000 22222',
      location: 'Bengaluru, India',
      roles: ['manager'],
      managerEmployeeId: '',
      status: 'Active',
      accountStatus: 'approved',
      organizationId,
      password: 'FinStack@123',
      firstLoginRequired: false,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: createId(),
      employeeId: 'FIN-2001',
      fullName: 'Rajesh Kumar',
      email: 'rajesh.kumar@finstack.io',
      department: 'Finance Operations',
      phone: '+91 90000 33333',
      location: 'Chennai, India',
      roles: ['finance_officer'],
      managerEmployeeId: '',
      status: 'Active',
      accountStatus: 'approved',
      organizationId,
      password: 'FinStack@123',
      firstLoginRequired: false,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: createId(),
      employeeId: 'CMP-2001',
      fullName: 'Hari Vamsi',
      email: 'hari.vamsi@finstack.io',
      department: 'Compliance',
      phone: '+91 90000 44444',
      location: 'Pune, India',
      roles: ['compliance_officer'],
      managerEmployeeId: '',
      status: 'Active',
      accountStatus: 'approved',
      organizationId,
      password: 'FinStack@123',
      firstLoginRequired: false,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: createId(),
      employeeId: 'EMP-1001',
      fullName: 'Harshith Rekapalli',
      email: 'harshith.rekapalli@finstack.io',
      department: 'Marketing',
      phone: '+91 98765 43210',
      location: 'Hyderabad, India',
      roles: ['expense_submitter'],
      managerEmployeeId: 'MGR-2001',
      status: 'Active',
      accountStatus: 'approved',
      organizationId,
      password: 'FinStack@123',
      firstLoginRequired: false,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: createId(),
      employeeId: 'EMP-1002',
      fullName: 'Aarav Sharma',
      email: 'aarav.sharma@finstack.io',
      department: 'Marketing',
      phone: '+91 98888 12345',
      location: 'Bengaluru, India',
      roles: ['expense_submitter'],
      managerEmployeeId: 'MGR-2001',
      status: 'Active',
      accountStatus: 'approved',
      organizationId,
      password: 'FinStack@123',
      firstLoginRequired: false,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: createId(),
      employeeId: 'EMP-1003',
      fullName: 'Vikram Patel',
      email: 'vikram.patel@finstack.io',
      department: 'Marketing',
      phone: '+91 97777 54321',
      location: 'Mumbai, India',
      roles: ['expense_submitter'],
      managerEmployeeId: 'MGR-2001',
      status: 'Active',
      accountStatus: 'approved',
      organizationId,
      password: 'FinStack@123',
      firstLoginRequired: false,
      createdAt,
      updatedAt: createdAt,
    },
  ],
  expenses: [],
  categories: [
    {
      id: travelCategoryId,
      name: 'Travel',
      description: 'Flights, hotels, local transport, and business travel.',
      limit: 75000,
      currency: 'INR',
      status: 'Active',
      organizationId,
      requiresReceipt: true,
      color: '#2563EB',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: mealsCategoryId,
      name: 'Meals',
      description: 'Client meals and approved employee meal reimbursements.',
      limit: 5000,
      currency: 'INR',
      status: 'Active',
      organizationId,
      requiresReceipt: true,
      color: '#16A34A',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: softwareCategoryId,
      name: 'Software',
      description: 'Business software subscriptions and productivity tools.',
      limit: 25000,
      currency: 'INR',
      status: 'Active',
      organizationId,
      requiresReceipt: true,
      color: '#EA580C',
      createdAt,
      updatedAt: createdAt,
    },
  ],
  policies: [
    {
      id: createId(),
      name: 'Travel Expense Limit',
      categoryId: travelCategoryId,
      maxAmount: 75000,
      currency: 'INR',
      approval: 'Manager + Finance',
      status: 'Active',
      description: 'Travel expenses above the category threshold require finance review.',
      requiresApproval: true,
      receiptRequired: true,
      ownerRole: 'configuration_manager',
      organizationId,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: createId(),
      name: 'Meals Receipt Requirement',
      categoryId: mealsCategoryId,
      maxAmount: 5000,
      currency: 'INR',
      approval: 'Manager',
      status: 'Active',
      description: 'Meal claims require a receipt and manager approval.',
      requiresApproval: true,
      receiptRequired: true,
      ownerRole: 'configuration_manager',
      organizationId,
      createdAt,
      updatedAt: createdAt,
    },
  ],
  auditLogs: [
    {
      id: createId(),
      timestamp: createdAt,
      userEmployeeId: 'CFG-1001',
      organizationId,
      userRoleId: 'configuration_manager',
      userRole: 'Configuration Manager',
      action: 'Initialized Backend Store',
      entityType: 'System',
      entityId: organizationId,
      entityName: 'FinStack Technologies',
      status: 'Success',
    },
  ],
  notifications: [],
  transactions: [],
};

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
