import { Injectable } from '@nestjs/common';
import { clone, createId, ReceiptRecord, store } from '../../../data/store';

@Injectable()
export class ReceiptRepository {
  findByExpenseId(expenseId: string): ReceiptRecord | null {
    const receipt = store.receipts.find((item) => item.expenseId === expenseId);
    return receipt ? clone(receipt) : null;
  }

  create(data: Omit<ReceiptRecord, 'id'>): ReceiptRecord {
    const receipt: ReceiptRecord = { id: createId(), ...data };
    store.receipts.push(receipt);
    return clone(receipt);
  }

  deleteByExpenseId(expenseId: string): ReceiptRecord | null {
    const index = store.receipts.findIndex(
      (item) => item.expenseId === expenseId,
    );
    if (index === -1) return null;
    const [removed] = store.receipts.splice(index, 1);
    return clone(removed);
  }
}
