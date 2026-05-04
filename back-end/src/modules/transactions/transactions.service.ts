import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TransactionRecord } from '../../data/store';
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

  private ensureReferences(data: CreateTransactionDto): void {
    const expense = this.expensesRepository.findById(data.expenseId);
    if (!expense || expense.organizationId !== data.organizationId) throw new BadRequestException('Referenced expense not found for this organization.');
    const user = this.usersRepository.findById(data.employeeId);
    if (!user || user.organizationId !== data.organizationId) throw new BadRequestException('Referenced user not found for this organization.');
    const category = this.categoriesRepository.findById(data.categoryId);
    if (!category || category.organizationId !== data.organizationId) throw new BadRequestException('Referenced category not found for this organization.');
  }
}
