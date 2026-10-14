import { auditedMutation } from '../audit/tenant-audit-write';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ExpenseCategory,
  ExpensePolicy,
  Prisma,
  TenantRole,
  TenantUserStatus,
} from '@prisma/client';
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
import { ExpensesRepository } from '../../modules/expenses/expenses.repository';
import { TenantNotificationsService } from '../notifications/tenant-notifications.service';
import { TransactionsRepository } from '../../modules/transactions/transactions.repository';
import { TransactionsService } from '../../modules/transactions/transactions.service';
import {
  ReceiptDownload,
  ReceiptUploadService,
  StagedReceipt,
} from '../../modules/expenses/receipt-upload/receipt-upload.service';
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
    private readonly notifications: TenantNotificationsService,
    private readonly transactionsRepository: TransactionsRepository,
    private readonly transactionsService: TransactionsService,
    private readonly receiptUploadService: ReceiptUploadService,
  ) {}

  async listCategories(organizationId: string) {
    const categories = await this.prisma.expenseCategory.findMany({
      where: { organizationId, status: 'Active' },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return categories.map(({ id, name, description, requiresReceipt }) => ({
      id,
      name,
      description,
      requiresReceipt,
    }));
  }

  async listConfigurationCategories(organizationId: string) {
    const rows = await this.prisma.expenseCategory.findMany({
      where: { organizationId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.categoryDto(row));
  }

  async createCategory(organizationId: string, dto: CreateTenantCategoryDto) {
    return auditedMutation(
      this.prisma,
      organizationId,
      'category.created',
      'category',
      null,
      async (tx) => {
        const data = this.categoryData(dto);
        try {
          return this.categoryDto(
            await tx.expenseCategory.create({
              data: {
                ...data,
                organizationId,
                name: this.configurationName(dto.name),
              },
            }),
          );
        } catch (error) {
          this.configurationError(error);
        }
      },
    );
  }

  async updateCategory(
    organizationId: string,
    categoryId: string,
    dto: UpdateTenantCategoryDto,
  ) {
    return auditedMutation(
      this.prisma,
      organizationId,
      (before, after) => {
        const previousStatus = (before as { status?: string } | null)?.status;
        const nextStatus = (after as { status?: string } | null)?.status;
        if (previousStatus !== nextStatus && nextStatus === 'Inactive')
          return 'category.deactivated';
        if (previousStatus !== nextStatus && nextStatus === 'Active')
          return 'category.reactivated';
        return 'category.updated';
      },
      'category',
      categoryId,
      async (tx) => {
        await this.requireCategory(organizationId, categoryId, tx);
        try {
          return this.categoryDto(
            await tx.expenseCategory.update({
              where: { organizationId_id: { organizationId, id: categoryId } },
              data: this.categoryData(dto),
            }),
          );
        } catch (error) {
          this.configurationError(error);
        }
      },
    );
  }

  async deleteCategory(organizationId: string, categoryId: string) {
    return auditedMutation(
      this.prisma,
      organizationId,
      'category.deleted',
      'category',
      categoryId,
      async (tx) => {
        await this.requireCategory(organizationId, categoryId, tx);
        const policyCount = await tx.expensePolicy.count({
          where: { organizationId, categoryId },
        });
        if (policyCount > 0) {
          throw new BadRequestException({
            code: 'TENANT_CATEGORY_IN_USE',
            message:
              'This category is used by one or more policies. Deactivate it instead; existing policies will remain unchanged.',
          });
        }
        // Existing expenses remain in the legacy repository during this slice.
        if (
          this.expensesRepository
            .findAll()
            .some(
              (expense) =>
                expense.organizationId === organizationId &&
                expense.categoryId === categoryId,
            )
        ) {
          throw new BadRequestException({
            code: 'TENANT_CATEGORY_IN_USE',
            message:
              'This category is used by existing expenses. Deactivate it instead; financial history will remain unchanged.',
          });
        }
        try {
          await tx.expenseCategory.delete({
            where: { organizationId_id: { organizationId, id: categoryId } },
          });
          return { id: categoryId, deleted: true };
        } catch (error) {
          this.configurationError(error);
        }
      },
    );
  }

  async listPolicies(organizationId: string) {
    const rows = await this.prisma.expensePolicy.findMany({
      where: { organizationId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.policyDto(row));
  }

  async createPolicy(organizationId: string, dto: CreateTenantPolicyDto) {
    return auditedMutation(
      this.prisma,
      organizationId,
      'policy.created',
      'policy',
      null,
      async (tx) => {
        const category = await this.requireCategory(
          organizationId,
          dto.categoryId,
          tx,
        );
        if (category.status !== 'Active')
          throw new BadRequestException(
            'Select an active category for a new policy.',
          );
        const organization = await tx.organization.findUniqueOrThrow({
          where: { id: organizationId },
          select: { defaultCurrency: true },
        });
        const data = this.policyData(dto);
        try {
          return this.policyDto(
            await tx.expensePolicy.create({
              data: {
                ...data,
                organizationId,
                categoryId: dto.categoryId,
                name: this.configurationName(dto.name),
                maxAmount: dto.maxAmount,
                currency:
                  dto.currency?.toUpperCase() || organization.defaultCurrency,
              },
            }),
          );
        } catch (error) {
          this.configurationError(error);
        }
      },
    );
  }

  async updatePolicy(
    organizationId: string,
    policyId: string,
    dto: UpdateTenantPolicyDto,
  ) {
    return auditedMutation(
      this.prisma,
      organizationId,
      (before, after) => {
        const previous = (before as { status?: string } | null)?.status;
        const next = (after as { status?: string } | null)?.status;
        return previous !== next
          ? next === 'Inactive'
            ? 'policy.deactivated'
            : 'policy.reactivated'
          : 'policy.updated';
      },
      'policy',
      policyId,
      async (tx) => {
        const existing = await this.requirePolicy(organizationId, policyId, tx);
        const category = await this.requireCategory(
          organizationId,
          dto.categoryId ?? existing.categoryId,
          tx,
        );
        if (
          category.status !== 'Active' &&
          ((dto.categoryId !== undefined &&
            dto.categoryId !== existing.categoryId) ||
            (dto.status === 'Active' && existing.status !== 'Active'))
        )
          throw new BadRequestException(
            'Activate the linked category before selecting it or reactivating this policy.',
          );
        try {
          return this.policyDto(
            await tx.expensePolicy.update({
              where: { id: policyId, organizationId },
              data: this.policyData(dto),
            }),
          );
        } catch (error) {
          this.configurationError(error);
        }
      },
    );
  }

  async deletePolicy(organizationId: string, policyId: string) {
    return auditedMutation(
      this.prisma,
      organizationId,
      'policy.deleted',
      'policy',
      policyId,
      async (tx) => {
        await this.requirePolicy(organizationId, policyId, tx);
        try {
          await tx.expensePolicy.delete({
            where: { id: policyId, organizationId },
          });
          return { id: policyId, deleted: true };
        } catch (error) {
          this.configurationError(error);
        }
      },
    );
  }

  private configurationName(name: string) {
    const value = name.trim();
    if (!value || value.length > 100)
      throw new BadRequestException('Name must contain 1 to 100 characters.');
    return value;
  }

  private categoryData(dto: UpdateTenantCategoryDto) {
    return {
      ...(dto.name !== undefined
        ? { name: this.configurationName(dto.name) }
        : {}),
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
      ...(dto.color !== undefined ? { color: dto.color } : {}),
    };
  }

  private policyData(dto: UpdateTenantPolicyDto) {
    return {
      ...(dto.name !== undefined
        ? { name: this.configurationName(dto.name) }
        : {}),
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description.trim() }
        : {}),
      ...(dto.maxAmount !== undefined ? { maxAmount: dto.maxAmount } : {}),
      ...(dto.currency !== undefined
        ? { currency: dto.currency.trim().toUpperCase() }
        : {}),
      ...(dto.approval !== undefined ? { approval: dto.approval.trim() } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.requiresApproval !== undefined
        ? { requiresApproval: dto.requiresApproval }
        : {}),
      ...(dto.receiptRequired !== undefined
        ? { receiptRequired: dto.receiptRequired }
        : {}),
    };
  }

  private categoryDto(row: ExpenseCategory): CategoryRecord {
    return {
      ...row,
      limit: Number(row.limit),
      status: row.status as CategoryRecord['status'],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private policyDto(
    row: ExpensePolicy,
  ): PolicyRecord & { maxAmountExact: string } {
    return {
      ...row,
      maxAmount: Number(row.maxAmount),
      maxAmountExact: row.maxAmount.toFixed(2),
      status: row.status as PolicyRecord['status'],
      ownerRole: 'configuration_manager',
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private configurationError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        throw new ConflictException({
          code: 'TENANT_CONFIGURATION_NAME_EXISTS',
          message: 'This name already exists in your organization.',
        });
      if (error.code === 'P2003')
        throw new BadRequestException({
          code: 'TENANT_CONFIGURATION_REFERENCE',
          message:
            'The record is in use or its category is no longer available.',
        });
      if (error.code === 'P2025')
        throw new NotFoundException('Configuration record not found.');
    }
    throw error;
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

    const category = await this.prisma.expenseCategory.findFirst({
      where: { id: dto.categoryId, organizationId: actor.organizationId },
    });
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

    await this.notify(
      actor.organizationId,
      manager.employeeId,
      'manager',
      'New Expense Submitted',
      `${this.fullName(submitter)} submitted expense ${expense.id}.`,
      'warning',
      expense.id,
      'expense_submitted_manager',
    );
    await this.notify(
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

  async createWithReceipt(
    actor: TenantAuthContext,
    dto: CreateTenantExpenseDto,
    file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Receipt upload is required.');
    }

    let stagedReceipt: StagedReceipt | undefined;
    let expenseId: string | undefined;
    try {
      stagedReceipt = await this.receiptUploadService.stage(file);
      const expense = await this.create(actor, {
        ...dto,
        receiptFileName: stagedReceipt.originalName,
      });
      expenseId = expense.id;
      this.receiptUploadService.associate(expense.id, stagedReceipt);
      return expense;
    } catch (error) {
      if (stagedReceipt) {
        await this.receiptUploadService.rollback(expenseId, stagedReceipt);
      }
      throw error;
    }
  }

  async getReceipt(
    actor: TenantAuthContext,
    expenseId: string,
  ): Promise<ReceiptDownload> {
    const expense = this.expensesRepository.findById(expenseId);
    if (!expense || expense.organizationId !== actor.organizationId) {
      throw new NotFoundException('Expense not found.');
    }
    let permitted = actor.user.role === TenantRole.CONFIGURATION_MANAGER;
    if (actor.user.role === TenantRole.EXPENSE_SUBMITTER) {
      permitted = expense.employeeId === actor.user.employeeId;
    } else if (actor.user.role === TenantRole.MANAGER) {
      const report = await this.prisma.tenantUser.findFirst({
        where: {
          organizationId: actor.organizationId,
          employeeId: expense.employeeId,
          managerId: actor.user.id,
        },
        select: { id: true },
      });
      permitted =
        expense.managerEmployeeId === actor.user.employeeId && Boolean(report);
    } else if (actor.user.role === TenantRole.FINANCE_OFFICER) {
      permitted = expense.assignedFinanceOfficerId === actor.user.id;
    } else if (actor.user.role === TenantRole.COMPLIANCE_OFFICER) {
      permitted = expense.workflowStatus === 'compliance_review';
    }
    if (!permitted) {
      throw new ForbiddenException({
        code: 'TENANT_EXPENSE_RECEIPT_ACCESS_DENIED',
        message: 'You do not have access to this expense receipt.',
      });
    }
    return this.receiptUploadService.getForExpense(expenseId);
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
      const category = await this.requireCategory(
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
      await this.notify(
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
      (await this.listCategories(actor.organizationId)).map((category) => [
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
      await this.notify(
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
    await this.notifySubmitter(
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
    await this.notifySubmitter(
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
    await this.notifySubmitter(
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

  async financeApprove(
    actor: TenantAuthContext,
    expenseId: string,
    note?: string,
  ) {
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
    await this.notifySubmitter(
      expense,
      'Finance Approved Expense',
      `${expense.id} is approved for payment.`,
      'success',
      'finance_approved_submitter',
    );
    return updated;
  }

  async financeReject(
    actor: TenantAuthContext,
    expenseId: string,
    note?: string,
  ) {
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
    await this.notifySubmitter(
      expense,
      'Finance Rejected Expense',
      `${expense.id} was rejected by Finance.`,
      'danger',
      'finance_rejected_submitter',
    );
    return updated;
  }

  async financeRequestInfo(
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
    await this.notifySubmitter(
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
    await this.notifySubmitter(
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
    await this.notify(
      actor.organizationId,
      financeOfficer.employeeId,
      'finance_officer',
      'Compliance-Reviewed Expense Ready',
      `${expense.id} was approved by Compliance.`,
      'success',
      expense.id,
      'compliance_approved_finance',
    );
    await this.notifySubmitter(
      expense,
      'Compliance Approved Your Expense',
      `${expense.id} was approved by Compliance.`,
      'success',
      'compliance_approved_submitter',
    );
    return updated;
  }

  async complianceReject(
    actor: TenantAuthContext,
    expenseId: string,
    note?: string,
  ) {
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
    await this.notifySubmitter(
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

  async releasePayment(actor: TenantAuthContext, expenseIds: string[]) {
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
    await Promise.all(
      result.expenses.map((expense) =>
        this.notifySubmitter(
          expense,
          'Payment Released',
          `${expense.id} was released to the bank sandbox.`,
          'info',
          'payment_released_submitter',
        ),
      ),
    );
    return result;
  }

  markBankProcessed(actor: TenantAuthContext, transactionId: string) {
    const transaction = this.requireFinanceTransaction(actor, transactionId);
    return this.transactionsService.markProcessed(transaction.id);
  }

  async markBankFailed(actor: TenantAuthContext, transactionId: string) {
    const transaction = this.requireFinanceTransaction(actor, transactionId);
    const failed = this.transactionsService.markFailed(transaction.id);
    const expense = this.expensesRepository.findById(transaction.expenseId);
    if (expense) {
      await this.notifySubmitter(
        expense,
        'Payment Processing Failed',
        `${expense.id} could not be processed by the bank sandbox.`,
        'danger',
        'payment_failed_submitter',
      );
    }
    return failed;
  }

  async reconcileTransaction(actor: TenantAuthContext, transactionId: string) {
    const transaction = this.requireFinanceTransaction(actor, transactionId);
    const reconciled = this.transactionsService.reconcile(transaction.id);
    const expense = this.expensesRepository.findById(transaction.expenseId);
    if (expense) {
      await this.notifySubmitter(
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
    return this.notifications.legacy(actor);
  }
  markNotificationRead(actor: TenantAuthContext, id: string) {
    return this.notifications.read(actor, id);
  }
  markAllNotificationsRead(actor: TenantAuthContext) {
    return this.notifications.readAll(actor);
  }
  deleteNotification(actor: TenantAuthContext, id: string) {
    return this.notifications.dismiss(actor, id);
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

  private async requireCategory(
    organizationId: string,
    categoryId: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const category = await db.expenseCategory.findFirst({
      where: { id: categoryId, organizationId },
    });
    if (!category)
      throw new NotFoundException({
        code: 'TENANT_CATEGORY_NOT_FOUND',
        message: 'Category not found.',
      });
    return category;
  }

  private async requirePolicy(
    organizationId: string,
    policyId: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const policy = await db.expensePolicy.findFirst({
      where: { id: policyId, organizationId },
    });
    if (!policy)
      throw new NotFoundException({
        code: 'TENANT_POLICY_NOT_FOUND',
        message: 'Policy not found.',
      });
    return policy;
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
      (await this.listConfigurationCategories(organizationId)).map(
        (category) => [category.id, category.name],
      ),
    );
    return expenses.map((expense) =>
      this.toExpenseDto(expense, categories.get(expense.categoryId), {
        employeeId: expense.employeeId,
        fullName: names.get(expense.employeeId) || expense.employeeId,
      }),
    );
  }

  private notificationEventKey(expenseId: string, eventCode: string) {
    const history = this.expensesRepository.findById(expenseId)?.history || [];
    return `${eventCode}:${expenseId}:${history.length}:${history[history.length - 1]?.at || 'initial'}`;
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
    void recipientRole;
    return this.notifications.notifyEmployee(
      organizationId,
      recipientEmployeeId,
      title,
      message,
      type,
      expenseId,
      actionType,
      this.notificationEventKey(expenseId, actionType),
    );
  }

  private async notifySubmitter(
    expense: ExpenseRecord,
    title: string,
    message: string,
    type: NotificationRecord['type'],
    actionType: string,
  ) {
    await this.notify(
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
    let cursor: string | undefined;
    for (;;) {
      const users = await this.prisma.tenantUser.findMany({
        where: { organizationId, role, status: TenantUserStatus.ACTIVE },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 200,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (!users.length) break;
      await this.notifications.notifyRecipients(
        users.map((user) => user.id),
        {
          organizationId,
          title,
          message,
          type,
          sourceId: expenseId,
          sourceType: 'expense',
          eventCode: actionType,
          eventKey: this.notificationEventKey(expenseId, actionType),
        },
      );
      cursor = users[users.length - 1].id;
      if (users.length < 200) break;
    }
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
