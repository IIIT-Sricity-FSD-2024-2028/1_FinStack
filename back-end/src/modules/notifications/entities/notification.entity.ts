import { NotificationRecord } from '../../../data/store';

export class Notification implements NotificationRecord {
  id: string;
  unread: boolean;
  createdAt: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  recipientEmployeeId: string;
  recipientRole: NotificationRecord['recipientRole'];
  title: string;
  message: string;
  relatedExpenseId: string;
  relatedEntityId: string;
  actionType: string;
  dedupeKey: string;
}
