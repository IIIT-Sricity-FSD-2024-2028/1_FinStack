import { AuditRecord } from '../../../data/store';

export class Audit implements AuditRecord {
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
