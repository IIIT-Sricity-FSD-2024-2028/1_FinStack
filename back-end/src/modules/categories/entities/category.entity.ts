import { CategoryRecord } from '../../../data/store';

export class Category implements CategoryRecord {
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
