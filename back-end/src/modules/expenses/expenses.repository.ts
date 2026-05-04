import { Injectable } from '@nestjs/common';
import { clone, createId, ExpenseRecord, nowIso, store } from '../../data/store';

@Injectable()
export class ExpensesRepository {
  findAll(): ExpenseRecord[] {
    return clone(store.expenses);
  }

  findById(id: string): ExpenseRecord | null {
    const expense = store.expenses.find((item) => item.id === id);
    return expense ? clone(expense) : null;
  }

  create(data: Omit<ExpenseRecord, 'id' | 'createdAt' | 'updatedAt'>): ExpenseRecord {
    const timestamp = nowIso();
    const expense: ExpenseRecord = { id: createId(), ...data, createdAt: timestamp, updatedAt: timestamp };
    store.expenses.unshift(expense);
    return clone(expense);
  }

  update(id: string, data: Partial<ExpenseRecord>): ExpenseRecord | null {
    const index = store.expenses.findIndex((item) => item.id === id);
    if (index === -1) return null;
    store.expenses[index] = { ...store.expenses[index], ...data, id: store.expenses[index].id, updatedAt: nowIso() };
    return clone(store.expenses[index]);
  }

  delete(id: string): ExpenseRecord | null {
    const index = store.expenses.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const [removed] = store.expenses.splice(index, 1);
    return clone(removed);
  }
}
