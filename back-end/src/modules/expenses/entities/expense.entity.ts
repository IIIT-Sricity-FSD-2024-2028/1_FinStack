import { ExpenseRecord } from '../../../data/store';

export class Expense implements ExpenseRecord {
  id: string;
  employeeId: string;
  organizationId: string;
  managerEmployeeId: string;
  assignedFinanceOfficerId: string | null;
  amount: number;
  currency: string;
  categoryId: string;
  merchant: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  workflowStatus: ExpenseRecord['workflowStatus'];
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
  history: ExpenseRecord['history'];
}
