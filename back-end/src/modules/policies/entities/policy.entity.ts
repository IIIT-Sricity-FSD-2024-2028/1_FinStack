import { PolicyRecord } from '../../../data/store';

export class Policy implements PolicyRecord {
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
  ownerRole: PolicyRecord['ownerRole'];
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}
