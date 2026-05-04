import { Injectable } from '@nestjs/common';
import { clone, createId, nowIso, store, UserRecord } from '../../data/store';

@Injectable()
export class UsersRepository {
  findAll(): UserRecord[] {
    return clone(store.users);
  }

  findById(id: string): UserRecord | null {
    const user = store.users.find((item) => item.id === id || item.employeeId === id);
    return user ? clone(user) : null;
  }

  create(data: Omit<UserRecord, 'id' | 'createdAt' | 'updatedAt'>): UserRecord {
    const timestamp = nowIso();
    const user: UserRecord = { id: createId(), ...data, createdAt: timestamp, updatedAt: timestamp };
    store.users.push(user);
    return clone(user);
  }

  update(id: string, data: Partial<UserRecord>): UserRecord | null {
    const index = store.users.findIndex((item) => item.id === id || item.employeeId === id);
    if (index === -1) return null;
    store.users[index] = { ...store.users[index], ...data, id: store.users[index].id, updatedAt: nowIso() };
    return clone(store.users[index]);
  }

  delete(id: string): UserRecord | null {
    const index = store.users.findIndex((item) => item.id === id || item.employeeId === id);
    if (index === -1) return null;
    const [removed] = store.users.splice(index, 1);
    return clone(removed);
  }
}
