import { Injectable } from '@nestjs/common';
import { CategoryRecord, clone, createId, nowIso, store } from '../../data/store';

@Injectable()
export class CategoriesRepository {
  findAll(): CategoryRecord[] {
    return clone(store.categories);
  }

  findById(id: string): CategoryRecord | null {
    const category = store.categories.find((item) => item.id === id);
    return category ? clone(category) : null;
  }

  create(data: Omit<CategoryRecord, 'id' | 'createdAt' | 'updatedAt'>): CategoryRecord {
    const timestamp = nowIso();
    const category: CategoryRecord = { id: createId(), ...data, createdAt: timestamp, updatedAt: timestamp };
    store.categories.push(category);
    return clone(category);
  }

  update(id: string, data: Partial<CategoryRecord>): CategoryRecord | null {
    const index = store.categories.findIndex((item) => item.id === id);
    if (index === -1) return null;
    store.categories[index] = { ...store.categories[index], ...data, id: store.categories[index].id, updatedAt: nowIso() };
    return clone(store.categories[index]);
  }

  delete(id: string): CategoryRecord | null {
    const index = store.categories.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const [removed] = store.categories.splice(index, 1);
    return clone(removed);
  }
}
