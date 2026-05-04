import { Injectable } from '@nestjs/common';
import { AuditRecord, clone, createId, nowIso, store } from '../../data/store';

@Injectable()
export class AuditRepository {
  findAll(): AuditRecord[] {
    return clone(store.auditLogs);
  }

  findById(id: string): AuditRecord | null {
    const audit = store.auditLogs.find((item) => item.id === id);
    return audit ? clone(audit) : null;
  }

  create(data: Omit<AuditRecord, 'id' | 'timestamp'>): AuditRecord {
    const audit: AuditRecord = { id: createId(), timestamp: nowIso(), ...data };
    store.auditLogs.unshift(audit);
    return clone(audit);
  }

  update(id: string, data: Partial<AuditRecord>): AuditRecord | null {
    const index = store.auditLogs.findIndex((item) => item.id === id);
    if (index === -1) return null;
    store.auditLogs[index] = { ...store.auditLogs[index], ...data, id: store.auditLogs[index].id };
    return clone(store.auditLogs[index]);
  }

  delete(id: string): AuditRecord | null {
    const index = store.auditLogs.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const [removed] = store.auditLogs.splice(index, 1);
    return clone(removed);
  }
}
