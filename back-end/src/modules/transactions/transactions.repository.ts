import { Injectable } from '@nestjs/common';
import { clone, createId, nowIso, store, TransactionRecord } from '../../data/store';

@Injectable()
export class TransactionsRepository {
  findAll(): TransactionRecord[] {
    return clone(store.transactions);
  }

  findById(id: string): TransactionRecord | null {
    const transaction = store.transactions.find((item) => item.id === id);
    return transaction ? clone(transaction) : null;
  }

  create(data: Omit<TransactionRecord, 'id' | 'createdAt' | 'updatedAt'>): TransactionRecord {
    const timestamp = nowIso();
    const transaction: TransactionRecord = { id: createId(), ...data, createdAt: timestamp, updatedAt: timestamp };
    store.transactions.unshift(transaction);
    return clone(transaction);
  }

  update(id: string, data: Partial<TransactionRecord>): TransactionRecord | null {
    const index = store.transactions.findIndex((item) => item.id === id);
    if (index === -1) return null;
    store.transactions[index] = { ...store.transactions[index], ...data, id: store.transactions[index].id, updatedAt: nowIso() };
    return clone(store.transactions[index]);
  }

  delete(id: string): TransactionRecord | null {
    const index = store.transactions.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const [removed] = store.transactions.splice(index, 1);
    return clone(removed);
  }
}
