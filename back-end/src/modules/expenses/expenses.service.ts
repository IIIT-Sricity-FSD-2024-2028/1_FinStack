import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseRecord, nowIso } from '../../data/store';
import { AuditService } from '../audit/audit.service';
import { CategoriesRepository } from '../categories/categories.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersRepository } from '../users/users.repository';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesRepository } from './expenses.repository';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly expensesRepository: ExpensesRepository,
    private readonly usersRepository: UsersRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  findAll(): ExpenseRecord[] {
    return this.expensesRepository.findAll();
  }

  findOne(id: string): ExpenseRecord {
    const expense = this.expensesRepository.findById(id);
    if (!expense) throw new NotFoundException('Expense not found.');
    return expense;
  }

  create(dto: CreateExpenseDto): ExpenseRecord {
    this.ensureUser(dto.employeeId, dto.organizationId);
    this.ensureUser(dto.managerEmployeeId, dto.organizationId);
    if (dto.assignedFinanceOfficerId) this.ensureFinanceOfficer(dto.assignedFinanceOfficerId, dto.organizationId);
    this.ensureCategory(dto.categoryId, dto.organizationId);
    const expense = this.expensesRepository.create({
      employeeId: dto.employeeId,
      organizationId: dto.organizationId,
      managerEmployeeId: dto.managerEmployeeId,
      assignedFinanceOfficerId: dto.assignedFinanceOfficerId || null,
      amount: dto.amount,
      currency: dto.currency || 'INR',
      categoryId: dto.categoryId,
      merchant: dto.merchant,
      date: dto.date,
      status: dto.status || 'pending',
      workflowStatus: dto.workflowStatus || 'manager_review',
      notes: dto.notes || '',
      paymentMethod: dto.paymentMethod || 'personal-card',
      receiptFileName: dto.receiptFileName || '',
      extraction_confidence: dto.extraction_confidence,
      flag: dto.flag,
      risk_score: dto.risk_score,
      managerDecision: '',
      financeDecision: '',
      complianceDecision: '',
      history: [{ code: 'submitted', label: 'Submitted', at: nowIso(), note: 'Expense submitted.' }],
    });
    this.notificationsService.createSystem({
      recipientEmployeeId: expense.managerEmployeeId,
      recipientRole: 'manager',
      title: 'New Expense Submitted',
      message: `${expense.id} is ready for manager review.`,
      type: 'warning',
      relatedExpenseId: expense.id,
      actionType: 'expense_submitted_manager',
    });
    this.auditService.record('Created Expense', 'Expense', expense.id, expense.organizationId);
    return expense;
  }

  update(id: string, dto: UpdateExpenseDto): ExpenseRecord {
    const current = this.findOne(id);
    const organizationId = dto.organizationId || current.organizationId;
    if (dto.employeeId) this.ensureUser(dto.employeeId, organizationId);
    if (dto.managerEmployeeId) this.ensureUser(dto.managerEmployeeId, organizationId);
    if (dto.assignedFinanceOfficerId !== undefined && dto.assignedFinanceOfficerId !== null) {
      this.ensureFinanceOfficer(dto.assignedFinanceOfficerId, organizationId);
    }
    if (
      dto.workflowStatus === 'finance_review' &&
      dto.managerDecision === 'Approved' &&
      !((dto.assignedFinanceOfficerId !== undefined ? dto.assignedFinanceOfficerId : current.assignedFinanceOfficerId))
    ) {
      throw new BadRequestException('A finance officer assignment is required for manager approval.');
    }
    if (dto.categoryId) this.ensureCategory(dto.categoryId, organizationId);
    const updated = this.expensesRepository.update(id, dto);
    if (!updated) throw new NotFoundException('Expense not found.');
    this.auditService.record('Updated Expense', 'Expense', updated.id, updated.organizationId);
    return updated;
  }

  delete(id: string): { id: string; deleted: boolean } {
    const current = this.findOne(id);
    const removed = this.expensesRepository.delete(id);
    if (!removed) throw new NotFoundException('Expense not found.');
    this.auditService.record('Deleted Expense', 'Expense', current.id, current.organizationId);
    return { id: current.id, deleted: true };
  }

  transition(id: string, updates: Partial<ExpenseRecord>, code: string, label: string, note: string): ExpenseRecord {
    const current = this.findOne(id);
    const history = [...current.history, { code, label, at: nowIso(), note }];
    const updated = this.expensesRepository.update(id, { ...updates, history });
    if (!updated) throw new NotFoundException('Expense not found.');
    this.auditService.record(label, 'Expense', updated.id, updated.organizationId);
    return updated;
  }

  private ensureUser(employeeId: string, organizationId: string): void {
    const user = this.usersRepository.findById(employeeId);
    if (!user || user.organizationId !== organizationId) throw new BadRequestException('Referenced user not found for this organization.');
  }

  private ensureFinanceOfficer(employeeId: string, organizationId: string): void {
    const user = this.usersRepository.findById(employeeId);
    if (!user || user.organizationId !== organizationId || !user.roles.includes('finance_officer')) {
      throw new BadRequestException('Assigned finance officer not found for this organization.');
    }
  }

  private ensureCategory(categoryId: string, organizationId: string): void {
    const category = this.categoriesRepository.findById(categoryId);
    if (!category || category.organizationId !== organizationId) throw new BadRequestException('Referenced category not found for this organization.');
  }
}
