import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseRecord, nowIso, TransactionRecord } from '../../data/store';
import { AuditService } from '../audit/audit.service';
import { CategoriesRepository } from '../categories/categories.repository';
import { ExpensesRepository } from '../expenses/expenses.repository';
import { UsersRepository } from '../users/users.repository';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionsRepository } from './transactions.repository';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly transactionsRepository: TransactionsRepository,
    private readonly expensesRepository: ExpensesRepository,
    private readonly usersRepository: UsersRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly auditService: AuditService,
  ) {}

  findAll(): TransactionRecord[] {
    return this.transactionsRepository.findAll();
  }

  findOne(id: string): TransactionRecord {
    const transaction = this.transactionsRepository.findById(id);
    if (!transaction) throw new NotFoundException('Transaction not found.');
    return transaction;
  }

  create(dto: CreateTransactionDto): TransactionRecord {
    this.ensureReferences(dto);
    const transaction = this.transactionsRepository.create({
      expenseId: dto.expenseId,
      employeeId: dto.employeeId,
      organizationId: dto.organizationId,
      amount: dto.amount,
      currency: dto.currency || 'INR',
      merchant: dto.merchant,
      categoryId: dto.categoryId,
      paymentMethod: dto.paymentMethod,
      status: dto.status || 'pending',
      transactionDate: dto.transactionDate,
      processedAt: dto.processedAt,
    });
    this.auditService.record('Created Transaction', 'Transaction', transaction.id, transaction.organizationId);
    return transaction;
  }

  update(id: string, dto: Partial<CreateTransactionDto>): TransactionRecord {
    const current = this.findOne(id);
    if (dto.status && dto.status !== current.status) {
      throw new BadRequestException('Use the transaction lifecycle endpoints to change transaction status.');
    }
    const next = { ...current, ...dto };
    this.ensureReferences(next);
    const updated = this.transactionsRepository.update(id, dto);
    if (!updated) throw new NotFoundException('Transaction not found.');
    this.auditService.record('Updated Transaction', 'Transaction', updated.id, updated.organizationId);
    return updated;
  }

  delete(id: string): { id: string; deleted: boolean } {
    const current = this.findOne(id);
    const removed = this.transactionsRepository.delete(id);
    if (!removed) throw new NotFoundException('Transaction not found.');
    this.auditService.record('Deleted Transaction', 'Transaction', current.id, current.organizationId);
    return { id: current.id, deleted: true };
  }

  releasePaymentBatch(batchId: string, expenseIds?: string[]): { batchId: string; expenses: ExpenseRecord[]; transactions: TransactionRecord[] } {
    const candidates = this.findReleaseCandidates(expenseIds);
    const expenses: ExpenseRecord[] = [];
    const transactions: TransactionRecord[] = [];

    candidates.forEach((expense) => {
      const existing = this.findExistingPaymentAttempt(expense.id);
      if (existing) {
        expenses.push(expense);
        transactions.push(existing);
        return;
      }

      if (expense.workflowStatus !== 'approved_for_payment') return;

      const released = this.expensesRepository.update(expense.id, {
        workflowStatus: 'payment_processing',
        status: 'approved',
        paidAt: undefined,
        history: this.appendExpenseHistoryOnce(
          expense,
          'payment_released',
          'Payment Released to Bank',
          `Payment batch ${batchId} submitted for bank processing.`,
        ),
      });
      if (!released) throw new NotFoundException('Expense not found.');

      const transaction = this.transactionsRepository.create({
        expenseId: released.id,
        employeeId: released.employeeId,
        organizationId: released.organizationId,
        amount: Number(released.amount || 0),
        currency: released.currency || 'INR',
        merchant: released.merchant,
        categoryId: released.categoryId,
        paymentMethod: released.paymentMethod,
        status: 'pending',
        transactionDate: nowIso(),
      });

      this.auditService.record('Released Payment to Bank', 'Expense', released.id, released.organizationId);
      this.auditService.record('Created Pending Bank Transaction', 'Transaction', transaction.id, transaction.organizationId);
      expenses.push(released);
      transactions.push(transaction);
    });

    this.auditService.record('Released Payment Batch', 'Payment Batch', batchId, candidates[0]?.organizationId || 'system');
    return { batchId, expenses, transactions };
  }

  markProcessed(id: string): TransactionRecord {
    const transaction = this.findOne(id);
    this.ensureReferencedExpense(transaction);
    if (transaction.status === 'processed') return transaction;
    if (transaction.status !== 'pending') {
      throw new BadRequestException('Only pending transactions can be marked processed.');
    }
    const updated = this.transactionsRepository.update(id, { status: 'processed', processedAt: nowIso() });
    if (!updated) throw new NotFoundException('Transaction not found.');
    this.auditService.record('Bank Sandbox Processed Transaction', 'Transaction', updated.id, updated.organizationId);
    return updated;
  }

  markFailed(id: string): TransactionRecord {
    const transaction = this.findOne(id);
    this.ensureReferencedExpense(transaction);
    if (transaction.status === 'failed') return transaction;
    if (transaction.status !== 'pending') {
      throw new BadRequestException('Only pending transactions can be marked failed.');
    }
    const updated = this.transactionsRepository.update(id, { status: 'failed', processedAt: nowIso() });
    if (!updated) throw new NotFoundException('Transaction not found.');
    this.auditService.record('Bank Sandbox Failed Transaction', 'Transaction', updated.id, updated.organizationId);
    return updated;
  }

  reconcile(id: string): TransactionRecord {
    const transaction = this.findOne(id);
    const expense = this.ensureReferencedExpense(transaction);
    if (transaction.status === 'reconciled') return transaction;
    if (transaction.status !== 'processed') {
      throw new BadRequestException('Only processed transactions can be reconciled.');
    }
    if (expense.workflowStatus !== 'payment_processing') {
      throw new BadRequestException('Related expense must be payment_processing before reconciliation.');
    }

    const timestamp = nowIso();
    const updatedTransaction = this.transactionsRepository.update(id, { status: 'reconciled', processedAt: transaction.processedAt || timestamp });
    if (!updatedTransaction) throw new NotFoundException('Transaction not found.');

    const paidExpense = this.expensesRepository.update(expense.id, {
      workflowStatus: 'paid',
      status: 'approved',
      paidAt: timestamp,
      history: this.appendExpenseHistoryOnce(
        expense,
        'paid',
        'Paid',
        `Bank transaction ${updatedTransaction.id} reconciled and expense marked paid.`,
      ),
    });
    if (!paidExpense) throw new NotFoundException('Expense not found.');

    this.auditService.record('Reconciled Transaction', 'Transaction', updatedTransaction.id, updatedTransaction.organizationId);
    this.auditService.record('Marked Expense Paid', 'Expense', paidExpense.id, paidExpense.organizationId);
    return updatedTransaction;
  }

  private ensureReferences(data: CreateTransactionDto): void {
    const expense = this.expensesRepository.findById(data.expenseId);
    if (!expense || expense.organizationId !== data.organizationId) throw new BadRequestException('Referenced expense not found for this organization.');
    const user = this.usersRepository.findById(data.employeeId);
    if (!user || user.organizationId !== data.organizationId) throw new BadRequestException('Referenced user not found for this organization.');
    const category = this.categoriesRepository.findById(data.categoryId);
    if (!category || category.organizationId !== data.organizationId) throw new BadRequestException('Referenced category not found for this organization.');
  }

  private findReleaseCandidates(expenseIds?: string[]): ExpenseRecord[] {
    const expenses = this.expensesRepository.findAll();
    const allowedStatuses = ['approved_for_payment', 'payment_processing'] as const;
    if (!expenseIds || !expenseIds.length) {
      return expenses.filter((expense) => allowedStatuses.includes(expense.workflowStatus as (typeof allowedStatuses)[number]));
    }

    return expenseIds.map((expenseId) => {
      const expense = this.expensesRepository.findById(expenseId);
      if (!expense) throw new BadRequestException(`Referenced expense ${expenseId} was not found.`);
      if (!allowedStatuses.includes(expense.workflowStatus as (typeof allowedStatuses)[number])) {
        throw new BadRequestException(`Expense ${expenseId} is not approved for payment release.`);
      }
      return expense;
    });
  }

  private findExistingPaymentAttempt(expenseId: string): TransactionRecord | null {
    const existing = this.transactionsRepository
      .findByExpenseId(expenseId)
      .find((transaction) => ['pending', 'processed', 'failed', 'reconciled'].includes(transaction.status));
    return existing || null;
  }

  private ensureReferencedExpense(transaction: TransactionRecord): ExpenseRecord {
    const expense = this.expensesRepository.findById(transaction.expenseId);
    if (!expense || expense.organizationId !== transaction.organizationId) {
      throw new BadRequestException('Referenced expense not found for this organization.');
    }
    return expense;
  }

  private appendExpenseHistoryOnce(expense: ExpenseRecord, code: string, label: string, note: string): ExpenseRecord['history'] {
    const history = Array.isArray(expense.history) ? [...expense.history] : [];
    const exists = history.some((entry) => entry.code === code || entry.label === label);
    if (!exists) history.push({ code, label, at: nowIso(), note });
    return history;
  }
}
