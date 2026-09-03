import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantRole, TenantUserStatus } from '@prisma/client';
import {
  CategoryRecord,
  ExpenseRecord,
  NotificationRecord,
  nowIso,
  PolicyRecord,
  RoleId,
  TransactionRecord,
} from '../../data/store';
import { PrismaService } from '../../database/prisma.service';
import { CategoriesRepository } from '../../modules/categories/categories.repository';
import { ExpensesRepository } from '../../modules/expenses/expenses.repository';
import { NotificationsRepository } from '../../modules/notifications/notifications.repository';
import { PoliciesRepository } from '../../modules/policies/policies.repository';
import { TransactionsRepository } from '../../modules/transactions/transactions.repository';
import { TransactionsService } from '../../modules/transactions/transactions.service';
import { TenantAuthContext } from '../auth/tenant-auth.types';
import { CreateTenantCategoryDto } from './dto/create-tenant-category.dto';
import { CreateTenantExpenseDto } from './dto/create-tenant-expense.dto';
import { CreateTenantPolicyDto } from './dto/create-tenant-policy.dto';
import { ManagerApproveExpenseDto } from './dto/manager-approve-expense.dto';
import { UpdateTenantCategoryDto } from './dto/update-tenant-category.dto';
import { UpdateTenantExpenseDto } from './dto/update-tenant-expense.dto';
import { UpdateTenantPolicyDto } from './dto/update-tenant-policy.dto';

@Injectable()
export class TenantExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expensesRepository: ExpensesRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly policiesRepository: PoliciesRepository,
    private readonly notificationsRepository: NotificationsRepository,
    private readonly transactionsRepository: TransactionsRepository,
    private readonly transactionsService: TransactionsService,
  ) {}

  listCategories(organizationId: string) {
    return this.categoriesRepository
      .findAll()
      .filter(
        (category) =>
          category.organizationId === organizationId &&
          category.status === 'Active',
      )
      .map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        requiresReceipt: category.requiresReceipt,
      }));
  }

  listConfigurationCategories(organizationId: string) {
    return this.categoriesRepository
      .findAll()
      .filter((category) => category.organizationId === organizationId);
  }

  createCategory(
    organizationId: string,
    dto: CreateTenantCategoryDto,
  ): CategoryRecord {
    this.ensureUniqueCategoryName(organizationId, dto.name);
    return this.categoriesRepository.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || '',
      limit: dto.limit ?? 0,
      currency: dto.currency?.trim().toUpperCase() || 'INR',
      status: dto.status ?? 'Active',
      organizationId,
      requiresReceipt: dto.requiresReceipt ?? true,
      color: dto.color?.trim() || '#7C3AED',
    });
  }

  updateCategory(
    organizationId: string,
    categoryId: string,
    dto: UpdateTenantCategoryDto,
  ): CategoryRecord {
    const category = this.requireCategory(organizationId, categoryId);
    if (dto.name && dto.name.trim() !== category.name) {
      this.ensureUniqueCategoryName(organizationId, dto.name, categoryId);
    }
    const updated = this.categoriesRepository.update(categoryId, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description.trim() }
        : {}),
      ...(dto.limit !== undefined ? { limit: dto.limit } : {}),
      ...(dto.currency !== undefined
        ? { currency: dto.currency.trim().toUpperCase() }
        : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.requiresReceipt !== undefined
        ? { requiresReceipt: dto.requiresReceipt }
        : {}),
      ...(dto.color !== undefined ? { color: dto.color.trim() } : {}),
    });
    if (!updated) throw new NotFoundException('Category not found.');
    return updated;
  }

  deleteCategory(organizationId: string, categoryId: string) {
    this.requireCategory(organizationId, categoryId);
    const isUsed =
      this.expensesRepository
        .findAll()
        .some(
          (expense) =>
            expense.organizationId === organizationId &&
            expense.categoryId === categoryId,
        ) ||
      this.policiesRepository
        .findAll()
        .some(
          (policy) =>
            policy.organizationId === organizationId &&
            policy.categoryId === categoryId,
        );
    if (isUsed) {
      throw new BadRequestException({
        code: 'TENANT_CATEGORY_IN_USE',
        message: 'Categories used by expenses or policies cannot be deleted.',
      });
    }
    this.categoriesRepository.delete(categoryId);
    return { id: categoryId, deleted: true };
  }

  listPolicies(organizationId: string): PolicyRecord[] {
    return this.policiesRepository
      .findAll()
      .filter((policy) => policy.organizationId === organizationId);
  }

  createPolicy(
    organizationId: string,
    dto: CreateTenantPolicyDto,
  ): PolicyRecord {
    this.requireCategory(organizationId, dto.categoryId);
    return this.policiesRepository.create({
      name: dto.name.trim(),
      categoryId: dto.categoryId,
      maxAmount: dto.maxAmount,
      currency: dto.currency?.trim().toUpperCase() || 'INR',
      approval: dto.approval?.trim() || 'Manager Approval',
      status: dto.status ?? 'Active',
      description: dto.description?.trim() || '',
      requiresApproval: dto.requiresApproval ?? true,
      receiptRequired: dto.receiptRequired ?? true,
      ownerRole: 'configuration_manager',
      organizationId,
    });
  }

  updatePolicy(
    organizationId: string,
    policyId: string,
    dto: UpdateTenantPolicyDto,
  ): PolicyRecord {
    this.requirePolicy(organizationId, policyId);
    if (dto.categoryId !== undefined) {
      this.requireCategory(organizationId, dto.categoryId);
    }
    const updated = this.policiesRepository.update(policyId, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      ...(dto.maxAmount !== undefined ? { maxAmount: dto.maxAmount } : {}),
      ...(dto.currency !== undefined
        ? { currency: dto.currency.trim().toUpperCase() }
        : {}),
      ...(dto.approval !== undefined ? { approval: dto.approval.trim() } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description.trim() }
        : {}),
      ...(dto.requiresApproval !== undefined
        ? { requiresApproval: dto.requiresApproval }
        : {}),
      ...(dto.receiptRequired !== undefined
        ? { receiptRequired: dto.receiptRequired }
        : {}),
    });
    if (!updated) throw new NotFoundException('Policy not found.');
    return updated;
  }

  deletePolicy(organizationId: string, policyId: string) {
    this.requirePolicy(organizationId, policyId);
    this.policiesRepository.delete(policyId);
    return { id: policyId, deleted: true };
  }

  async create(actor: TenantAuthContext, dto: CreateTenantExpenseDto) {
    const submitter = await this.prisma.tenantUser.findUnique({
      where: { id: actor.user.id },
      include: { manager: true },
    });
    if (
      !submitter ||
      submitter.organizationId !== actor.organizationId ||
      submitter.role !== TenantRole.EXPENSE_SUBMITTER ||
      submitter.status !== TenantUserStatus.ACTIVE
    ) {
      throw new ForbiddenException({
        code: 'TENANT_EXPENSE_SUBMITTER_REQUIRED',
        message: 'Only an active Expense Submitter can submit expenses.',
      });
    }

    const manager = submitter.manager;
    if (
      !manager ||
      manager.organizationId !== submitter.organizationId ||
      manager.role !== TenantRole.MANAGER ||
      manager.status !== TenantUserStatus.ACTIVE
    ) {
      throw new BadRequestException({
        code: 'TENANT_EXPENSE_MANAGER_REQUIRED',
        message:
          'No active manager is assigned to your account. Contact your Configuration Manager.',
      });
    }

    const category = this.categoriesRepository.findById(dto.categoryId);
    if (
      !category ||
      category.organizationId !== actor.organizationId ||
      category.status !== 'Active'
    ) {
      throw new BadRequestException({
        code: 'TENANT_EXPENSE_CATEGORY_INVALID',
        message:
          'The selected expense category is not available for your organization.',
      });
    }

    const expense = this.expensesRepository.create({
      employeeId: submitter.employeeId,
      organizationId: submitter.organizationId,
      managerEmployeeId: manager.employeeId,
      assignedFinanceOfficerId: null,
      amount: dto.amount,
      currency: dto.currency?.trim().toUpperCase() || 'INR',
      categoryId: category.id,
      merchant: dto.merchant.trim(),
      date: dto.date,
      status: 'pending',
      workflowStatus: 'manager_review',
      notes: dto.notes?.trim() || '',
      paymentMethod: dto.paymentMethod?.trim() || 'personal-card',
      receiptFileName: dto.receiptFileName?.trim() || '',
      extraction_confidence: dto.extractionConfidence,
      flag: dto.flag?.trim(),
      risk_score: dto.riskScore,
      managerDecision: '',
      financeDecision: '',
      complianceDecision: '',
      history: [
        {
          code: 'submitted',
          label: 'Submitted',
          at: nowIso(),
          note: 'Expense submitted for manager review.',
        },
      ],
    });

    this.notify(
      actor.organizationId,
      manager.employeeId,
      'manager',
      'New Expense Submitted',
      `${this.fullName(submitter)} submitted expense ${expense.id}.`,
      'warning',
      expense.id,
      'expense_submitted_manager',
    );
    this.notify(
      actor.organizationId,
      submitter.employeeId,
      'expense_submitter',
      'Expense Submitted',
      `${expense.id} is awaiting manager review.`,
      'info',
      expense.id,
      'expense_submitted_submitter',
    );

    return this.toExpenseDto(expense, category.name, {
      employeeId: submitter.employeeId,
      fullName: this.fullName(submitter),
    });
  }

  async listOwnExpenses(actor: TenantAuthContext) {
    return this.mapExpenses(
      actor.organizationId,
      this.expensesRepository
        .findAll()
        .filter(
          (expense) =>
            expense.organizationId === actor.organizationId &&
            expense.employeeId === actor.user.employeeId,
        ),
    );
  }

  async updateOwnExpense(
    actor: TenantAuthContext,
    expenseId: string,
    dto: UpdateTenantExpenseDto,
  ) {
    const expense = this.requireOwnedExpense(actor, expenseId);
    if (!['manager_review', 'returned'].includes(expense.workflowStatus)) {
      throw new BadRequestException({
        code: 'TENANT_EXPENSE_NOT_EDITABLE',
        message: 'Only submitted or returned expenses can be edited.',
      });
    }
    if (dto.categoryId !== undefined) {
      const category = this.requireCategory(
        actor.organizationId,
        dto.categoryId,
      );
      if (category.status !== 'Active') {
        throw new BadRequestException({
          code: 'TENANT_EXPENSE_CATEGORY_INVALID',
          message: 'Select an active category.',
        });
      }
    }
    const wasReturned = expense.workflowStatus === 'returned';
    const updated = this.expensesRepository.update(expenseId, {
      ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      ...(dto.merchant !== undefined ? { merchant: dto.merchant.trim() } : {}),
      ...(dto.date !== undefined ? { date: dto.date } : {}),
      ...(dto.currency !== undefined
        ? { currency: dto.currency.trim().toUpperCase() }
        : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes.trim() } : {}),
      ...(dto.paymentMethod !== undefined
        ? { paymentMethod: dto.paymentMethod.trim() }
        : {}),
      ...(dto.receiptFileName !== undefined
        ? { receiptFileName: dto.receiptFileName.trim() }
        : {}),
      ...(dto.extractionConfidence !== undefined
        ? { extraction_confidence: dto.extractionConfidence }
        : {}),
      ...(dto.flag !== undefined ? { flag: dto.flag.trim() } : {}),
      ...(dto.riskScore !== undefined ? { risk_score: dto.riskScore } : {}),
      ...(wasReturned
        ? {
            workflowStatus: 'manager_review',
            status: 'pending',
            history: [
              ...expense.history,
              {
                code: 'resubmitted',
                label: 'Resubmitted',
                at: nowIso(),
                note: 'Expense updated and resubmitted.',
              },
            ],
          }
        : {}),
    });
    if (!updated) throw new NotFoundException('Expense not found.');
    if (wasReturned) {
      this.notify(
        actor.organizationId,
        expense.managerEmployeeId,
        'manager',
        'Expense Resubmitted',
        `${expense.id} has been updated and resubmitted.`,
        'info',
        expense.id,
        'expense_resubmitted_manager',
      );
    }
    return (await this.mapExpenses(actor.organizationId, [updated]))[0];
  }

  deleteOwnExpense(actor: TenantAuthContext, expenseId: string) {
    const expense = this.requireOwnedExpense(actor, expenseId);
    if (!['manager_review', 'returned'].includes(expense.workflowStatus)) {
      throw new BadRequestException({
        code: 'TENANT_EXPENSE_NOT_DELETABLE',
        message: 'Only submitted or returned expenses can be deleted.',
      });
    }
    this.expensesRepository.delete(expenseId);
    return { id: expenseId, deleted: true };
  }

  async listManagerQueue(actor: TenantAuthContext) {
    const directReports = await this.prisma.tenantUser.findMany({
      where: {
        organizationId: actor.organizationId,
        managerId: actor.user.id,
      },
      select: { employeeId: true, firstName: true, lastName: true },
    });
    const directReportIds = new Set(
      directReports.map((report) => report.employeeId),
    );
    const expenses = this.expensesRepository
      .findAll()
      .filter(
        (expense) =>
          expense.organizationId === actor.organizationId &&
          expense.managerEmployeeId === actor.user.employeeId &&
          expense.workflowStatus === 'manager_review' &&
          directReportIds.has(expense.employeeId),
      );
    const displayNames = new Map(
      directReports.map((report) => [
        report.employeeId,
        `${report.firstName} ${report.lastName}`.trim(),
      ]),
    );
    const categories = new Map(
      this.listCategories(actor.organizationId).map((category) => [
        category.id,
        category.name,
      ]),
    );
    return expenses.map((expense) =>
      this.toExpenseDto(expense, categories.get(expense.categoryId), {
        employeeId: expense.employeeId,
        fullName: displayNames.get(expense.employeeId) || expense.employeeId,
      }),
    );
  }

  async listFinanceOfficers(organizationId: string) {
    const officers = await this.prisma.tenantUser.findMany({
      where: {
        organizationId,
        role: TenantRole.FINANCE_OFFICER,
        status: TenantUserStatus.ACTIVE,
      },
      select: { id: true, employeeId: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    return officers.map((officer) => ({
      id: officer.id,
      employeeId: officer.employeeId,
      fullName: this.fullName(officer),
    }));
  }

  async managerApprove(
    actor: TenantAuthContext,
    expenseId: string,
    dto: ManagerApproveExpenseDto,
  ) {
    const expense = await this.requireManagerExpense(actor, expenseId);
    const officer = await this.prisma.tenantUser.findFirst({
      where: {
        id: dto.financeOfficerId,
        organizationId: actor.organizationId,
        role: TenantRole.FINANCE_OFFICER,
        status: TenantUserStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!officer) {
      throw new BadRequestException({
        code: 'TENANT_EXPENSE_FINANCE_OFFICER_INVALID',
        message: 'Select an active Finance Officer in your organization.',
      });
    }
    const updated = this.transition(
      expense,
      {
        managerDecision: 'Approved',
        managerDecisionAt: nowIso(),
        managerDecisionNote: dto.note?.trim() || 'Approved by manager.',
        assignedFinanceOfficerId: officer.id,
        workflowStatus: 'finance_review',
        status: 'pending',
      },
      'manager_approved',
      'Manager Approved',
      dto.note?.trim() || 'Approved by manager.',
    );
    const financeEmployee = await this.prisma.tenantUser.findUnique({
      where: { id: officer.id },
      select: { employeeId: true },
    });
    if (financeEmployee) {
      this.notify(
        actor.organizationId,
        financeEmployee.employeeId,
        'finance_officer',
        'Expense Ready for Finance Review',
        `${expense.id} was approved by its manager.`,
        'info',
        expense.id,
        'manager_approved_finance',
      );
    }
    this.notifySubmitter(
      expense,
      'Your Expense Was Approved',
      `${expense.id} was approved by your manager.`,
      'success',
      'manager_approved_submitter',
    );
    return updated;
  }

  async managerReturn(
    actor: TenantAuthContext,
    expenseId: string,
    note?: string,
  ) {
    const expense = await this.requireManagerExpense(actor, expenseId);
    const message = note?.trim() || 'Returned for clarification.';
    const updated = this.transition(
      expense,
      {
        managerDecision: 'Returned',
        managerDecisionAt: nowIso(),
        managerDecisionNote: message,
        workflowStatus: 'returned',
        status: 'pending',
      },
      'manager_returned',
      'Returned by Manager',
      message,
    );
    this.notifySubmitter(
      expense,
      'Expense Returned',
      `${expense.id} was returned by your manager: ${message}`,
      'warning',
      'manager_returned_submitter',
    );
    return updated;
  }

  async managerReject(
    actor: TenantAuthContext,
    expenseId: string,
    note?: string,
  ) {
    const expense = await this.requireManagerExpense(actor, expenseId);
    const message = note?.trim() || 'Rejected by manager.';
    const updated = this.transition(
      expense,
      {
        managerDecision: 'Rejected',
        managerDecisionAt: nowIso(),
        managerDecisionNote: message,
        workflowStatus: 'rejected',
        status: 'rejected',
      },
      'manager_rejected',
      'Rejected by Manager',
      message,
    );
    this.notifySubmitter(
      expense,
      'Your Expense Was Rejected',
      `${expense.id} was rejected by your manager.`,
      'danger',
      'manager_rejected_submitter',
    );
    return updated;
  }

  async managerEscalate(
    actor: TenantAuthContext,
    expenseId: string,
    note?: string,
  ) {
    const expense = await this.requireManagerExpense(actor, expenseId);
    const message =
      note?.trim() || 'Escalated to compliance officer for review.';
    const updated = this.transition(
      expense,
      {
        managerDecision: 'Escalated',
        managerDecisionAt: nowIso(),
        managerDecisionNote: message,
        assignedFinanceOfficerId: null,
        workflowStatus: 'compliance_review',
        status: 'pending',
        escalatedByManager: true,
      },
      'manager_escalated',
      'Escalated to Compliance',
      message,
    );
    await this.notifyRole(
      actor.organizationId,
      TenantRole.COMPLIANCE_OFFICER,
      'Expense Escalated for Compliance Review',
      `${expense.id} was escalated by a manager.`,
      'warning',
      expense.id,
      'manager_escalated_compliance',
    );
    return updated;
  }

  async listManagerHistory(actor: TenantAuthContext) {
    return this.mapExpenses(
      actor.organizationId,
      this.expensesRepository
        .findAll()
        .filter(
          (expense) =>
            expense.organizationId === actor.organizationId &&
            expense.managerEmployeeId === actor.user.employeeId &&
            expense.workflowStatus !== 'manager_review',
        ),
    );
  }

  async listFinanceQueue(actor: TenantAuthContext) {
    return this.mapExpenses(
      actor.organizationId,
      this.expensesRepository
        .findAll()
        .filter(
          (expense) =>
            expense.organizationId === actor.organizationId &&
            expense.workflowStatus === 'finance_review' &&
            expense.assignedFinanceOfficerId === actor.user.id,
        ),
    );
  }

  async listFinanceWorkspace(actor: TenantAuthContext) {
    const expenses = this.expensesRepository
      .findAll()
      .filter(
        (expense) =>
          expense.organizationId === actor.organizationId &&
          expense.assignedFinanceOfficerId === actor.user.id,
      );
    const expenseIds = new Set(expenses.map((expense) => expense.id));
    const transactions = this.transactionsRepository
      .findAll()
      .filter(
        (transaction) =>
          transaction.organizationId === actor.organizationId &&
          expenseIds.has(transaction.expenseId),
      );
    return {
      expenses: await this.mapExpenses(actor.organizationId, expenses),
      transactions,
    };
  }

  financeApprove(actor: TenantAuthContext, expenseId: string, note?: string) {
    const expense = this.requireFinanceExpense(actor, expenseId);
    const message = note?.trim() || 'Approved for payment.';
    const updated = this.transition(
      expense,
      {
        financeDecision: 'Approved',
        financeDecisionAt: nowIso(),
        financeDecisionNote: message,
        workflowStatus: 'approved_for_payment',
        status: 'approved',
      },
      'finance_approved',
      'Finance Approved',
      message,
    );
    this.notifySubmitter(
      expense,
      'Finance Approved Expense',
      `${expense.id} is approved for payment.`,
      'success',
      'finance_approved_submitter',
    );
    return updated;
  }

  financeReject(actor: TenantAuthContext, expenseId: string, note?: string) {
    const expense = this.requireFinanceExpense(actor, expenseId);
    const message = note?.trim() || 'Rejected during finance review.';
    const updated = this.transition(
      expense,
      {
        financeDecision: 'Rejected',
        financeDecisionAt: nowIso(),
        financeDecisionNote: message,
        workflowStatus: 'rejected',
        status: 'rejected',
      },
      'finance_rejected',
      'Rejected by Finance',
      message,
    );
    this.notifySubmitter(
      expense,
      'Finance Rejected Expense',
      `${expense.id} was rejected by Finance.`,
      'danger',
      'finance_rejected_submitter',
    );
    return updated;
  }

  financeRequestInfo(
    actor: TenantAuthContext,
    expenseId: string,
    note?: string,
  ) {
    const expense = this.requireFinanceExpense(actor, expenseId);
    const message = note?.trim() || 'Additional information requested.';
    const updated = this.transition(
      expense,
      {
        financeDecision: 'Requested Info',
        financeDecisionAt: nowIso(),
        financeDecisionNote: message,
        workflowStatus: 'returned',
        status: 'pending',
      },
      'finance_requested_info',
      'Finance Requested Information',
      message,
    );
    this.notifySubmitter(
      expense,
      'More Information Requested',
      `${expense.id} needs more information: ${message}`,
      'warning',
      'finance_requested_info_submitter',
    );
    return updated;
  }

  async financeFlag(
    actor: TenantAuthContext,
    expenseId: string,
    note?: string,
  ) {
    const expense = this.requireFinanceExpense(actor, expenseId);
    const message = note?.trim() || 'Flagged for compliance review.';
    const updated = this.transition(
      expense,
      {
        financeDecision: 'Flagged',
        financeDecisionAt: nowIso(),
        financeDecisionNote: message,
        workflowStatus: 'compliance_review',
        status: 'pending',
      },
      'finance_flagged',
      'Flagged by Finance',
      message,
    );
    await this.notifyRole(
      actor.organizationId,
      TenantRole.COMPLIANCE_OFFICER,
      'Flagged Expense Requires Review',
      `${expense.id} was flagged by Finance.`,
      'danger',
      expense.id,
      'finance_flagged_compliance',
    );
    this.notifySubmitter(
      expense,
      'Expense Under Compliance Review',
      `${expense.id} is under compliance review.`,
      'warning',
      'finance_flagged_submitter',
    );
    return updated;
  }

  async listComplianceQueue(organizationId: string) {
    return this.mapExpenses(
      organizationId,
      this.expensesRepository
        .findAll()
        .filter(
          (expense) =>
            expense.organizationId === organizationId &&
            expense.workflowStatus === 'compliance_review',
        ),
    );
  }

  async complianceApprove(
    actor: TenantAuthContext,
    expenseId: string,
    note?: string,
  ) {
    const expense = this.requireComplianceExpense(actor, expenseId);
    let financeOfficer = expense.assignedFinanceOfficerId
      ? await this.prisma.tenantUser.findFirst({
          where: {
            id: expense.assignedFinanceOfficerId,
            organizationId: actor.organizationId,
            role: TenantRole.FINANCE_OFFICER,
            status: TenantUserStatus.ACTIVE,
          },
          select: { id: true, employeeId: true },
        })
      : null;
    financeOfficer ??= await this.prisma.tenantUser.findFirst({
      where: {
        organizationId: actor.organizationId,
        role: TenantRole.FINANCE_OFFICER,
        status: TenantUserStatus.ACTIVE,
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, employeeId: true },
    });
    if (!financeOfficer) {
      throw new BadRequestException({
        code: 'TENANT_EXPENSE_FINANCE_OFFICER_REQUIRED',
        message: 'No active Finance Officer is available in this organization.',
      });
    }
    const message =
      note?.trim() || 'Approved by compliance and returned to Finance.';
    const updated = this.transition(
      expense,
      {
        complianceDecision: 'Approved',
        complianceDecisionAt: nowIso(),
        complianceDecisionNote: message,
        assignedFinanceOfficerId: financeOfficer.id,
        workflowStatus: 'finance_review',
        status: 'pending',
      },
      'compliance_approved',
      'Compliance Approved - Sent to Finance',
      message,
    );
    this.notify(
      actor.organizationId,
      financeOfficer.employeeId,
      'finance_officer',
      'Compliance-Reviewed Expense Ready',
      `${expense.id} was approved by Compliance.`,
      'success',
      expense.id,
      'compliance_approved_finance',
    );
    this.notifySubmitter(
      expense,
      'Compliance Approved Your Expense',
      `${expense.id} was approved by Compliance.`,
      'success',
      'compliance_approved_submitter',
    );
    return updated;
  }

  complianceReject(actor: TenantAuthContext, expenseId: string, note?: string) {
    const expense = this.requireComplianceExpense(actor, expenseId);
    const message = note?.trim() || 'Rejected during compliance review.';
    const updated = this.transition(
      expense,
      {
        complianceDecision: 'Rejected',
        complianceDecisionAt: nowIso(),
        complianceDecisionNote: message,
        workflowStatus: 'rejected',
        status: 'rejected',
      },
      'compliance_rejected',
      'Rejected by Compliance',
      message,
    );
    this.notifySubmitter(
      expense,
      'Expense Rejected by Compliance',
      `${expense.id} was rejected by Compliance.`,
      'danger',
      'compliance_rejected_submitter',
    );
    return updated;
  }

  complianceCorrectiveAction(
    actor: TenantAuthContext,
    expenseId: string,
    note?: string,
  ) {
    const expense = this.requireComplianceExpense(actor, expenseId);
    const message = note?.trim() || 'Corrective action initiated.';
    return this.transition(
      expense,
      {
        complianceDecision: 'Corrective Action',
        complianceDecisionAt: nowIso(),
        complianceDecisionNote: message,
      },
      'compliance_corrective_action',
      'Corrective Action Initiated',
      message,
    );
  }

  releasePayment(actor: TenantAuthContext, expenseIds: string[]) {
    expenseIds.forEach((expenseId) => {
      const expense = this.requireFinanceOwnedExpense(actor, expenseId);
      if (
        !['approved_for_payment', 'payment_processing'].includes(
          expense.workflowStatus,
        )
      ) {
        throw new BadRequestException({
          code: 'TENANT_EXPENSE_PAYMENT_RELEASE_NOT_ALLOWED',
          message: `${expense.id} is not approved for payment release.`,
        });
      }
    });
    const batchId = `PB-${Date.now()}`;
    const result = this.transactionsService.releasePaymentBatch(
      batchId,
      expenseIds,
    );
    result.expenses.forEach((expense) =>
      this.notifySubmitter(
        expense,
        'Payment Released',
        `${expense.id} was released to the bank sandbox.`,
        'info',
        'payment_released_submitter',
      ),
    );
    return result;
  }

  markBankProcessed(actor: TenantAuthContext, transactionId: string) {
    const transaction = this.requireFinanceTransaction(actor, transactionId);
    return this.transactionsService.markProcessed(transaction.id);
  }

  markBankFailed(actor: TenantAuthContext, transactionId: string) {
    const transaction = this.requireFinanceTransaction(actor, transactionId);
    const failed = this.transactionsService.markFailed(transaction.id);
    const expense = this.expensesRepository.findById(transaction.expenseId);
    if (expense) {
      this.notifySubmitter(
        expense,
        'Payment Processing Failed',
        `${expense.id} could not be processed by the bank sandbox.`,
        'danger',
        'payment_failed_submitter',
      );
    }
    return failed;
  }

  reconcileTransaction(actor: TenantAuthContext, transactionId: string) {
    const transaction = this.requireFinanceTransaction(actor, transactionId);
    const reconciled = this.transactionsService.reconcile(transaction.id);
    const expense = this.expensesRepository.findById(transaction.expenseId);
    if (expense) {
      this.notifySubmitter(
        expense,
        'Expense Paid',
        `${expense.id} has been reconciled and marked paid.`,
        'success',
        'expense_paid_submitter',
      );
    }
    return reconciled;
  }

  listNotifications(actor: TenantAuthContext) {
    return this.notificationsRepository
      .findAll()
      .filter(
        (notification) =>
          notification.organizationId === actor.organizationId &&
          notification.recipientEmployeeId === actor.user.employeeId,
      );
  }

  markNotificationRead(actor: TenantAuthContext, notificationId: string) {
    this.requireNotification(actor, notificationId);
    return this.notificationsRepository.update(notificationId, {
      unread: false,
    });
  }

  markAllNotificationsRead(actor: TenantAuthContext) {
    const notifications = this.listNotifications(actor);
    notifications.forEach((notification) =>
      this.notificationsRepository.update(notification.id, { unread: false }),
    );
    return { updated: notifications.filter((item) => item.unread).length };
  }

  deleteNotification(actor: TenantAuthContext, notificationId: string) {
    this.requireNotification(actor, notificationId);
    this.notificationsRepository.delete(notificationId);
    return { id: notificationId, deleted: true };
  }

  private async requireManagerExpense(
    actor: TenantAuthContext,
    expenseId: string,
  ): Promise<ExpenseRecord> {
    const expense = this.expensesRepository.findById(expenseId);
    if (!expense) {
      throw new NotFoundException({
        code: 'TENANT_EXPENSE_NOT_FOUND',
        message: 'Expense not found.',
      });
    }
    if (
      expense.organizationId !== actor.organizationId ||
      expense.managerEmployeeId !== actor.user.employeeId
    ) {
      throw new ForbiddenException({
        code: 'TENANT_EXPENSE_MANAGER_ACCESS_DENIED',
        message: 'You can only act on expenses assigned to you.',
      });
    }
    if (expense.workflowStatus !== 'manager_review') {
      throw new BadRequestException({
        code: 'TENANT_EXPENSE_MANAGER_REVIEW_REQUIRED',
        message: 'This expense is no longer awaiting manager review.',
      });
    }
    const employee = await this.prisma.tenantUser.findUnique({
      where: {
        organizationId_employeeId: {
          organizationId: actor.organizationId,
          employeeId: expense.employeeId,
        },
      },
      select: { managerId: true },
    });
    if (!employee || employee.managerId !== actor.user.id) {
      throw new ForbiddenException({
        code: 'TENANT_EXPENSE_DIRECT_REPORT_REQUIRED',
        message:
          'You can only act on expenses submitted by your direct reports.',
      });
    }
    return expense;
  }

  private requireOwnedExpense(
    actor: TenantAuthContext,
    expenseId: string,
  ): ExpenseRecord {
    const expense = this.expensesRepository.findById(expenseId);
    if (!expense) throw new NotFoundException('Expense not found.');
    if (
      expense.organizationId !== actor.organizationId ||
      expense.employeeId !== actor.user.employeeId
    ) {
      throw new ForbiddenException({
        code: 'TENANT_EXPENSE_ACCESS_DENIED',
        message: 'You can only access your own expenses.',
      });
    }
    return expense;
  }

  private requireFinanceOwnedExpense(
    actor: TenantAuthContext,
    expenseId: string,
  ): ExpenseRecord {
    const expense = this.expensesRepository.findById(expenseId);
    if (!expense) throw new NotFoundException('Expense not found.');
    if (
      expense.organizationId !== actor.organizationId ||
      expense.assignedFinanceOfficerId !== actor.user.id
    ) {
      throw new ForbiddenException({
        code: 'TENANT_EXPENSE_FINANCE_ACCESS_DENIED',
        message: 'You can only access expenses assigned to you.',
      });
    }
    return expense;
  }

  private requireFinanceExpense(
    actor: TenantAuthContext,
    expenseId: string,
  ): ExpenseRecord {
    const expense = this.requireFinanceOwnedExpense(actor, expenseId);
    if (expense.workflowStatus !== 'finance_review') {
      throw new BadRequestException({
        code: 'TENANT_EXPENSE_FINANCE_REVIEW_REQUIRED',
        message: 'This expense is no longer awaiting finance review.',
      });
    }
    return expense;
  }

  private requireComplianceExpense(
    actor: TenantAuthContext,
    expenseId: string,
  ): ExpenseRecord {
    const expense = this.expensesRepository.findById(expenseId);
    if (!expense) throw new NotFoundException('Expense not found.');
    if (expense.organizationId !== actor.organizationId) {
      throw new ForbiddenException({
        code: 'TENANT_EXPENSE_COMPLIANCE_ACCESS_DENIED',
        message: 'You can only access expenses in your organization.',
      });
    }
    if (expense.workflowStatus !== 'compliance_review') {
      throw new BadRequestException({
        code: 'TENANT_EXPENSE_COMPLIANCE_REVIEW_REQUIRED',
        message: 'This expense is no longer awaiting compliance review.',
      });
    }
    return expense;
  }

  private requireFinanceTransaction(
    actor: TenantAuthContext,
    transactionId: string,
  ): TransactionRecord {
    const transaction = this.transactionsRepository.findById(transactionId);
    if (!transaction) throw new NotFoundException('Transaction not found.');
    if (transaction.organizationId !== actor.organizationId) {
      throw new ForbiddenException({
        code: 'TENANT_TRANSACTION_ACCESS_DENIED',
        message: 'You can only access transactions in your organization.',
      });
    }
    this.requireFinanceOwnedExpense(actor, transaction.expenseId);
    return transaction;
  }

  private requireCategory(
    organizationId: string,
    categoryId: string,
  ): CategoryRecord {
    const category = this.categoriesRepository.findById(categoryId);
    if (!category || category.organizationId !== organizationId) {
      throw new NotFoundException({
        code: 'TENANT_CATEGORY_NOT_FOUND',
        message: 'Category not found.',
      });
    }
    return category;
  }

  private requirePolicy(
    organizationId: string,
    policyId: string,
  ): PolicyRecord {
    const policy = this.policiesRepository.findById(policyId);
    if (!policy || policy.organizationId !== organizationId) {
      throw new NotFoundException({
        code: 'TENANT_POLICY_NOT_FOUND',
        message: 'Policy not found.',
      });
    }
    return policy;
  }

  private requireNotification(
    actor: TenantAuthContext,
    notificationId: string,
  ): NotificationRecord {
    const notification = this.notificationsRepository.findById(notificationId);
    if (
      !notification ||
      notification.organizationId !== actor.organizationId ||
      notification.recipientEmployeeId !== actor.user.employeeId
    ) {
      throw new NotFoundException('Notification not found.');
    }
    return notification;
  }

  private ensureUniqueCategoryName(
    organizationId: string,
    name: string,
    exceptId?: string,
  ) {
    const normalized = name.trim().toLowerCase();
    const duplicate = this.categoriesRepository
      .findAll()
      .some(
        (category) =>
          category.organizationId === organizationId &&
          category.id !== exceptId &&
          category.name.trim().toLowerCase() === normalized,
      );
    if (duplicate) {
      throw new BadRequestException({
        code: 'TENANT_CATEGORY_NAME_EXISTS',
        message: 'A category with this name already exists.',
      });
    }
  }

  private async mapExpenses(organizationId: string, expenses: ExpenseRecord[]) {
    const employeeIds = [...new Set(expenses.map((item) => item.employeeId))];
    const users = employeeIds.length
      ? await this.prisma.tenantUser.findMany({
          where: { organizationId, employeeId: { in: employeeIds } },
          select: { employeeId: true, firstName: true, lastName: true },
        })
      : [];
    const names = new Map(
      users.map((user) => [user.employeeId, this.fullName(user)]),
    );
    const categories = new Map(
      this.categoriesRepository
        .findAll()
        .filter((category) => category.organizationId === organizationId)
        .map((category) => [category.id, category.name]),
    );
    return expenses.map((expense) =>
      this.toExpenseDto(expense, categories.get(expense.categoryId), {
        employeeId: expense.employeeId,
        fullName: names.get(expense.employeeId) || expense.employeeId,
      }),
    );
  }

  private notify(
    organizationId: string,
    recipientEmployeeId: string,
    recipientRole: RoleId,
    title: string,
    message: string,
    type: NotificationRecord['type'],
    expenseId: string,
    actionType: string,
  ) {
    const dedupeKey = `${actionType}:${expenseId}:${recipientEmployeeId}`;
    const exists = this.notificationsRepository
      .findAll()
      .some(
        (item) =>
          item.organizationId === organizationId &&
          item.dedupeKey === dedupeKey,
      );
    if (exists) return;
    this.notificationsRepository.create({
      organizationId,
      unread: true,
      type,
      recipientEmployeeId,
      recipientRole,
      title,
      message,
      relatedExpenseId: expenseId,
      relatedEntityId: expenseId,
      actionType,
      dedupeKey,
    });
  }

  private notifySubmitter(
    expense: ExpenseRecord,
    title: string,
    message: string,
    type: NotificationRecord['type'],
    actionType: string,
  ) {
    this.notify(
      expense.organizationId,
      expense.employeeId,
      'expense_submitter',
      title,
      message,
      type,
      expense.id,
      actionType,
    );
  }

  private async notifyRole(
    organizationId: string,
    role: TenantRole,
    title: string,
    message: string,
    type: NotificationRecord['type'],
    expenseId: string,
    actionType: string,
  ) {
    const users = await this.prisma.tenantUser.findMany({
      where: { organizationId, role, status: TenantUserStatus.ACTIVE },
      select: { employeeId: true },
    });
    users.forEach((user) =>
      this.notify(
        organizationId,
        user.employeeId,
        role.toLowerCase() as RoleId,
        title,
        message,
        type,
        expenseId,
        actionType,
      ),
    );
  }

  private transition(
    expense: ExpenseRecord,
    updates: Partial<ExpenseRecord>,
    code: string,
    label: string,
    note: string,
  ) {
    const updated = this.expensesRepository.update(expense.id, {
      ...updates,
      history: [...expense.history, { code, label, at: nowIso(), note }],
    });
    if (!updated) {
      throw new NotFoundException({
        code: 'TENANT_EXPENSE_NOT_FOUND',
        message: 'Expense not found.',
      });
    }
    return this.toExpenseDto(updated);
  }

  private toExpenseDto(
    expense: ExpenseRecord,
    categoryName?: string,
    employee?: { employeeId: string; fullName: string },
  ) {
    return {
      id: expense.id,
      organizationId: expense.organizationId,
      employeeId: expense.employeeId,
      employee: employee ?? null,
      managerEmployeeId: expense.managerEmployeeId,
      assignedFinanceOfficerId: expense.assignedFinanceOfficerId,
      amount: expense.amount,
      currency: expense.currency,
      categoryId: expense.categoryId,
      category: categoryName || expense.categoryId,
      merchant: expense.merchant,
      date: expense.date,
      status: expense.status,
      workflowStatus: expense.workflowStatus,
      notes: expense.notes,
      paymentMethod: expense.paymentMethod,
      receiptFileName: expense.receiptFileName,
      extractionConfidence: expense.extraction_confidence,
      flag: expense.flag,
      riskScore: expense.risk_score,
      managerDecision: expense.managerDecision,
      managerDecisionAt: expense.managerDecisionAt,
      managerDecisionNote: expense.managerDecisionNote,
      financeDecision: expense.financeDecision,
      financeDecisionAt: expense.financeDecisionAt,
      financeDecisionNote: expense.financeDecisionNote,
      complianceDecision: expense.complianceDecision,
      complianceDecisionAt: expense.complianceDecisionAt,
      complianceDecisionNote: expense.complianceDecisionNote,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
      history: expense.history,
    };
  }

  private fullName(user: { firstName: string; lastName: string }) {
    return `${user.firstName} ${user.lastName}`.trim();
  }
}
