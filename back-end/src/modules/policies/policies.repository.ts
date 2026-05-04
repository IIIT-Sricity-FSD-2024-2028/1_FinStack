import { Injectable } from '@nestjs/common';
import { clone, createId, nowIso, PolicyRecord, store } from '../../data/store';

@Injectable()
export class PoliciesRepository {
  findAll(): PolicyRecord[] {
    return clone(store.policies);
  }

  findById(id: string): PolicyRecord | null {
    const policy = store.policies.find((item) => item.id === id);
    return policy ? clone(policy) : null;
  }

  create(data: Omit<PolicyRecord, 'id' | 'createdAt' | 'updatedAt'>): PolicyRecord {
    const timestamp = nowIso();
    const policy: PolicyRecord = { id: createId(), ...data, createdAt: timestamp, updatedAt: timestamp };
    store.policies.push(policy);
    return clone(policy);
  }

  update(id: string, data: Partial<PolicyRecord>): PolicyRecord | null {
    const index = store.policies.findIndex((item) => item.id === id);
    if (index === -1) return null;
    store.policies[index] = { ...store.policies[index], ...data, id: store.policies[index].id, updatedAt: nowIso() };
    return clone(store.policies[index]);
  }

  delete(id: string): PolicyRecord | null {
    const index = store.policies.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const [removed] = store.policies.splice(index, 1);
    return clone(removed);
  }
}
