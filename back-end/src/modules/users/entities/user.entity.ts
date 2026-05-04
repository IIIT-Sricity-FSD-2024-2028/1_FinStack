import { UserRecord } from '../../../data/store';

export class User implements UserRecord {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  department: string;
  phone: string;
  location: string;
  roles: UserRecord['roles'];
  managerEmployeeId: string;
  status: 'Active' | 'Inactive';
  accountStatus: 'approved' | 'pending' | 'rejected';
  organizationId: string;
  password: string;
  firstLoginRequired: boolean;
  createdAt: string;
  updatedAt: string;
}
