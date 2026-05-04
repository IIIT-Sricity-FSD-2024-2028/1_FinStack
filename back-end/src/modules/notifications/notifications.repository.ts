import { Injectable } from '@nestjs/common';
import { clone, createId, NotificationRecord, nowIso, store } from '../../data/store';

@Injectable()
export class NotificationsRepository {
  findAll(): NotificationRecord[] {
    return clone(store.notifications);
  }

  findById(id: string): NotificationRecord | null {
    const notification = store.notifications.find((item) => item.id === id);
    return notification ? clone(notification) : null;
  }

  create(data: Omit<NotificationRecord, 'id' | 'createdAt'>): NotificationRecord {
    const notification: NotificationRecord = { id: createId(), createdAt: nowIso(), ...data };
    store.notifications.unshift(notification);
    return clone(notification);
  }

  update(id: string, data: Partial<NotificationRecord>): NotificationRecord | null {
    const index = store.notifications.findIndex((item) => item.id === id);
    if (index === -1) return null;
    store.notifications[index] = { ...store.notifications[index], ...data, id: store.notifications[index].id };
    return clone(store.notifications[index]);
  }

  delete(id: string): NotificationRecord | null {
    const index = store.notifications.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const [removed] = store.notifications.splice(index, 1);
    return clone(removed);
  }
}
