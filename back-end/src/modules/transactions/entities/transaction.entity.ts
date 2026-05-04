import { TransactionRecord } from '../../../data/store';

export class Transaction implements TransactionRecord {
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
