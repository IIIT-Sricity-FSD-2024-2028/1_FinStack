import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TenantRole, TenantUserStatus } from '@prisma/client';
import {
  CategoryRecord,
  ExpenseRecord,
  NotificationRecord,
} from '../../data/store';
import { PrismaService } from '../../database/prisma.service';
import { CategoriesRepository } from '../../modules/categories/categories.repository';
import { ExpensesRepository } from '../../modules/expenses/expenses.repository';
import { NotificationsRepository } from '../../modules/notifications/notifications.repository';
import { PoliciesRepository } from '../../modules/policies/policies.repository';
import { TransactionsRepository } from '../../modules/transactions/transactions.repository';
import { TransactionsService } from '../../modules/transactions/transactions.service';
import { TenantAuthContext } from '../auth/tenant-auth.types';
import { CreateTenantExpenseDto } from './dto/create-tenant-expense.dto';
import { TenantExpensesService } from './tenant-expenses.service';

describe('TenantExpensesService', () => {
  const organizationId = '10000000-0000-4000-8000-000000000001';
  const otherOrganizationId = '10000000-0000-4000-8000-000000000002';
  const submitterActor: TenantAuthContext = {
    organizationId,
    user: {
      id: '20000000-0000-4000-8000-000000000001',
      organizationId,
      employeeId: 'EMP-001',
      firstName: 'Emma',
      lastName: 'Submitter',
      email: 'emma@example.test',
      role: TenantRole.EXPENSE_SUBMITTER,
      status: TenantUserStatus.ACTIVE,
    },
  };
  const managerActor: TenantAuthContext = {
    organizationId,
    user: {
      id: '20000000-0000-4000-8000-000000000002',
      organizationId,
      employeeId: 'MGR-001',
      firstName: 'Mina',
      lastName: 'Manager',
      email: 'mina@example.test',
      role: TenantRole.MANAGER,
      status: TenantUserStatus.ACTIVE,
    },
  };
  const financeActor: TenantAuthContext = {
    organizationId,
    user: {
      ...managerActor.user,
      id: '20000000-0000-4000-8000-000000000003',
      employeeId: 'FIN-001',
      role: TenantRole.FINANCE_OFFICER,
    },
  };
  const complianceActor: TenantAuthContext = {
    organizationId,
    user: {
      ...managerActor.user,
      id: '20000000-0000-4000-8000-000000000004',
      employeeId: 'CMP-001',
      role: TenantRole.COMPLIANCE_OFFICER,
    },
  };

  function expense(overrides: Partial<ExpenseRecord> = {}): ExpenseRecord {
    return {
      id: 'expense-1',
      organizationId,
      employeeId: 'EMP-001',
      managerEmployeeId: 'MGR-001',
      assignedFinanceOfficerId: null,
      amount: 100,
      currency: 'INR',
      categoryId: 'category-1',
      merchant: 'Railway',
      date: '2026-09-02',
      status: 'pending',
      workflowStatus: 'manager_review',
      notes: 'Client visit',
      paymentMethod: 'personal-card',
      receiptFileName: 'receipt.pdf',
      managerDecision: '',
      financeDecision: '',
      complianceDecision: '',
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
      history: [],
      ...overrides,
    };
  }

  function category(overrides: Partial<CategoryRecord> = {}): CategoryRecord {
    return {
      id: 'category-1',
      name: 'Travel',
      description: 'Business travel expenses.',
      limit: 10000,
      currency: 'INR',
      status: 'Active',
      organizationId,
      requiresReceipt: true,
      color: '#2563EB',
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
      ...overrides,
    };
  }

  function setup() {
    const tenantUserMocks = {
      findUnique: jest.fn(),
      findFirst: jest.fn<
        Promise<{ id: string; employeeId?: string } | null>,
        [unknown]
      >(),
      findMany: jest.fn().mockResolvedValue([]),
    };
    const prisma = {
      tenantUser: tenantUserMocks,
    } as unknown as PrismaService;
    const expenseMocks = {
      findAll: jest.fn<ExpenseRecord[], []>().mockReturnValue([]),
      findById: jest.fn<ExpenseRecord | null, [string]>(),
      create: jest.fn<
        ExpenseRecord,
        [Omit<ExpenseRecord, 'id' | 'createdAt' | 'updatedAt'>]
      >(),
      update: jest.fn<ExpenseRecord | null, [string, Partial<ExpenseRecord>]>(),
      delete: jest.fn<ExpenseRecord | null, [string]>(),
    };
    const expenses = expenseMocks as unknown as ExpensesRepository;
    const categoryMocks = {
      findAll: jest.fn<CategoryRecord[], []>().mockReturnValue([]),
      findById: jest.fn<CategoryRecord | null, [string]>(),
      create: jest.fn<
        CategoryRecord,
        [Omit<CategoryRecord, 'id' | 'createdAt' | 'updatedAt'>]
      >(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    const categories = categoryMocks as unknown as CategoriesRepository;
    const policyMocks = {
      findAll: jest.fn().mockReturnValue([]),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    const policies = policyMocks as unknown as PoliciesRepository;
    const notificationMocks = {
      findAll: jest.fn().mockReturnValue([]),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    const notifications =
      notificationMocks as unknown as NotificationsRepository;
    const transactionRepositoryMocks = {
      findAll: jest.fn().mockReturnValue([]),
      findById: jest.fn(),
      findByExpenseId: jest.fn().mockReturnValue([]),
    };
    const transactionRepository =
      transactionRepositoryMocks as unknown as TransactionsRepository;
    const transactionServiceMocks = {
      releasePaymentBatch: jest.fn(),
      markProcessed: jest.fn(),
      markFailed: jest.fn(),
      reconcile: jest.fn(),
    };
    const transactions =
      transactionServiceMocks as unknown as TransactionsService;
    return {
      prisma,
      tenantUserMocks,
      expenses,
      expenseMocks,
      categories,
      categoryMocks,
      policyMocks,
      notificationMocks,
      transactionRepositoryMocks,
      transactionServiceMocks,
      service: new TenantExpensesService(
        prisma,
        expenses,
        categories,
        policies,
        notifications,
        transactionRepository,
        transactions,
      ),
    };
  }

  it('submits only for the authenticated submitter and derives the active reporting manager', async () => {
    const { tenantUserMocks, expenseMocks, categoryMocks, service } = setup();
    tenantUserMocks.findUnique.mockResolvedValue({
      ...submitterActor.user,
      manager: {
        ...managerActor.user,
        organizationId,
        role: TenantRole.MANAGER,
        status: TenantUserStatus.ACTIVE,
      },
    });
    categoryMocks.findById.mockReturnValue(category());
    expenseMocks.create.mockImplementation((data) => expense(data));

    const clientPayload: CreateTenantExpenseDto & {
      organizationId: string;
      employeeId: string;
      managerEmployeeId: string;
    } = {
      amount: 100,
      categoryId: 'category-1',
      merchant: 'Railway',
      date: '2026-09-02',
      organizationId: otherOrganizationId,
      employeeId: 'EMP-ATTACKER',
      managerEmployeeId: 'MGR-ATTACKER',
    };
    const result = await service.create(submitterActor, clientPayload);

    expect(result.employeeId).toBe('EMP-001');
    expect(expenseMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        employeeId: 'EMP-001',
        managerEmployeeId: 'MGR-001',
        workflowStatus: 'manager_review',
      }),
    );
    expect(expenseMocks.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: 'EMP-1001' }),
    );
  });

  it('creates categories for the authenticated organization only', () => {
    const { categoryMocks, service } = setup();
    categoryMocks.create.mockImplementation((data) => category(data));

    const result = service.createCategory(organizationId, {
      name: 'Client Travel',
      description: 'Customer travel',
    });

    expect(result.organizationId).toBe(organizationId);
    expect(categoryMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        name: 'Client Travel',
      }),
    );
  });

  it('lists only active categories from the authenticated organization', () => {
    const { categoryMocks, service } = setup();
    categoryMocks.findAll.mockReturnValue([
      category(),
      category({ id: 'inactive-category', status: 'Inactive' }),
      category({ id: 'other-category', organizationId: otherOrganizationId }),
    ]);

    expect(service.listCategories(organizationId)).toEqual([
      {
        id: 'category-1',
        name: 'Travel',
        description: 'Business travel expenses.',
        requiresReceipt: true,
      },
    ]);
  });

  it('lists only expenses owned by the authenticated submitter and tenant', async () => {
    const { tenantUserMocks, expenseMocks, categoryMocks, service } = setup();
    tenantUserMocks.findMany.mockResolvedValue([
      { employeeId: 'EMP-001', firstName: 'Emma', lastName: 'Submitter' },
    ]);
    categoryMocks.findAll.mockReturnValue([category()]);
    expenseMocks.findAll.mockReturnValue([
      expense(),
      expense({ id: 'other-user', employeeId: 'EMP-002' }),
      expense({ id: 'other-org', organizationId: otherOrganizationId }),
    ]);

    await expect(service.listOwnExpenses(submitterActor)).resolves.toEqual([
      expect.objectContaining({ id: 'expense-1', employeeId: 'EMP-001' }),
    ]);
  });

  it('does not allow a finance officer to act on another officer expense', () => {
    const { expenseMocks, service } = setup();
    expenseMocks.findById.mockReturnValue(
      expense({
        workflowStatus: 'finance_review',
        assignedFinanceOfficerId: 'different-finance-user',
      }),
    );

    expect(() => service.financeApprove(financeActor, 'expense-1')).toThrow(
      ForbiddenException,
    );
    expect(expenseMocks.update).not.toHaveBeenCalled();
  });

  it('moves an assigned finance expense to the payment queue', () => {
    const { expenseMocks, service } = setup();
    expenseMocks.findById.mockReturnValue(
      expense({
        workflowStatus: 'finance_review',
        assignedFinanceOfficerId: financeActor.user.id,
      }),
    );
    expenseMocks.update.mockImplementation((_id, updates) => expense(updates));

    const result = service.financeApprove(
      financeActor,
      'expense-1',
      'Verified.',
    );

    expect(result.workflowStatus).toBe('approved_for_payment');
    expect(expenseMocks.update).toHaveBeenCalledWith(
      'expense-1',
      expect.objectContaining({ workflowStatus: 'approved_for_payment' }),
    );
  });

  it('routes compliance approval to an active finance officer in the same tenant', async () => {
    const { tenantUserMocks, expenseMocks, service } = setup();
    expenseMocks.findById.mockReturnValue(
      expense({ workflowStatus: 'compliance_review' }),
    );
    tenantUserMocks.findFirst.mockResolvedValue({
      id: financeActor.user.id,
      employeeId: financeActor.user.employeeId,
    });
    expenseMocks.update.mockImplementation((_id, updates) => expense(updates));

    const result = await service.complianceApprove(
      complianceActor,
      'expense-1',
    );

    expect(result.workflowStatus).toBe('finance_review');
    const financeLookup = tenantUserMocks.findFirst.mock.calls[0]?.[0] as {
      where?: { organizationId?: string };
    };
    expect(financeLookup.where?.organizationId).toBe(organizationId);
    expect(result.assignedFinanceOfficerId).toBe(financeActor.user.id);
  });

  it('limits the compliance queue to the authenticated tenant', async () => {
    const { tenantUserMocks, expenseMocks, categoryMocks, service } = setup();
    tenantUserMocks.findMany.mockResolvedValue([
      { employeeId: 'EMP-001', firstName: 'Emma', lastName: 'Submitter' },
    ]);
    categoryMocks.findAll.mockReturnValue([category()]);
    expenseMocks.findAll.mockReturnValue([
      expense({ workflowStatus: 'compliance_review' }),
      expense({ id: 'manager-review', workflowStatus: 'manager_review' }),
      expense({
        id: 'other-org',
        organizationId: otherOrganizationId,
        workflowStatus: 'compliance_review',
      }),
    ]);

    await expect(service.listComplianceQueue(organizationId)).resolves.toEqual([
      expect.objectContaining({ id: 'expense-1' }),
    ]);
  });

  it('releases only eligible expenses assigned to the authenticated finance officer', () => {
    const { expenseMocks, transactionServiceMocks, service } = setup();
    const approved = expense({
      workflowStatus: 'approved_for_payment',
      assignedFinanceOfficerId: financeActor.user.id,
    });
    expenseMocks.findById.mockReturnValue(approved);
    transactionServiceMocks.releasePaymentBatch.mockReturnValue({
      batchId: 'PB-1',
      expenses: [approved],
      transactions: [],
    });

    service.releasePayment(financeActor, [approved.id]);

    expect(transactionServiceMocks.releasePaymentBatch).toHaveBeenCalledWith(
      expect.stringMatching(/^PB-/),
      [approved.id],
    );
  });

  it('returns notifications only for the authenticated recipient and tenant', () => {
    const { notificationMocks, service } = setup();
    const notification = {
      id: 'notification-1',
      organizationId,
      unread: true,
      createdAt: '2026-09-02T00:00:00.000Z',
      type: 'info',
      recipientEmployeeId: submitterActor.user.employeeId,
      recipientRole: 'expense_submitter',
      title: 'Expense update',
      message: 'Updated',
      relatedExpenseId: 'expense-1',
      relatedEntityId: 'expense-1',
      actionType: 'expense_updated',
      dedupeKey: 'expense_updated:expense-1:EMP-001',
    } satisfies NotificationRecord;
    notificationMocks.findAll.mockReturnValue([
      notification,
      { ...notification, id: 'other-user', recipientEmployeeId: 'EMP-002' },
      {
        ...notification,
        id: 'other-org',
        organizationId: otherOrganizationId,
      },
    ]);

    expect(service.listNotifications(submitterActor)).toEqual([notification]);
  });

  it('rejects submission when the authenticated submitter has no active manager', async () => {
    const { tenantUserMocks, categoryMocks, expenseMocks, service } = setup();
    tenantUserMocks.findUnique.mockResolvedValue({
      ...submitterActor.user,
      manager: null,
    });

    await expect(
      service.create(submitterActor, {
        amount: 100,
        categoryId: 'category-1',
        merchant: 'Railway',
        date: '2026-09-02',
      }),
    ).rejects.toThrow(
      'No active manager is assigned to your account. Contact your Configuration Manager.',
    );
    expect(categoryMocks.findById).not.toHaveBeenCalled();
    expect(expenseMocks.create).not.toHaveBeenCalled();
  });

  it('rejects a category from another organization', async () => {
    const { tenantUserMocks, categoryMocks, expenseMocks, service } = setup();
    tenantUserMocks.findUnique.mockResolvedValue({
      ...submitterActor.user,
      manager: { ...managerActor.user },
    });
    categoryMocks.findById.mockReturnValue(
      category({ organizationId: otherOrganizationId }),
    );

    await expect(
      service.create(submitterActor, {
        amount: 100,
        categoryId: 'category-1',
        merchant: 'Railway',
        date: '2026-09-02',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(expenseMocks.create).not.toHaveBeenCalled();
  });

  it('returns only direct-report expenses assigned to the authenticated manager', async () => {
    const { tenantUserMocks, expenseMocks, categoryMocks, service } = setup();
    tenantUserMocks.findMany.mockResolvedValue([
      { employeeId: 'EMP-001', firstName: 'Emma', lastName: 'Submitter' },
    ]);
    categoryMocks.findAll.mockReturnValue([category()]);
    expenseMocks.findAll.mockReturnValue([
      expense(),
      expense({ id: 'other-manager', managerEmployeeId: 'MGR-002' }),
      expense({ id: 'other-report', employeeId: 'EMP-002' }),
      expense({ id: 'other-org', organizationId: otherOrganizationId }),
    ]);

    await expect(service.listManagerQueue(managerActor)).resolves.toEqual([
      expect.objectContaining({ id: 'expense-1', employeeId: 'EMP-001' }),
    ]);
  });

  it('does not let a manager act on an expense assigned to another manager', async () => {
    const { expenseMocks, service } = setup();
    expenseMocks.findById.mockReturnValue(
      expense({ managerEmployeeId: 'MGR-002' }),
    );

    await expect(
      service.managerReturn(managerActor, 'expense-1', 'Please clarify.'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(expenseMocks.update).not.toHaveBeenCalled();
  });

  it('does not let a manager from another tenant act on an expense', async () => {
    const { expenseMocks, service } = setup();
    expenseMocks.findById.mockReturnValue(expense());
    const otherTenantManager: TenantAuthContext = {
      ...managerActor,
      organizationId: otherOrganizationId,
      user: {
        ...managerActor.user,
        organizationId: otherOrganizationId,
      },
    };

    await expect(
      service.managerReject(otherTenantManager, 'expense-1', 'Unauthorized.'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(expenseMocks.update).not.toHaveBeenCalled();
  });

  it('assigns finance review only to an active same-organization Finance Officer', async () => {
    const { tenantUserMocks, expenseMocks, service } = setup();
    expenseMocks.findById.mockReturnValue(expense());
    tenantUserMocks.findUnique.mockResolvedValue({
      managerId: managerActor.user.id,
    });
    tenantUserMocks.findFirst.mockResolvedValue({
      id: 'finance-user-1',
    });
    expenseMocks.update.mockImplementation((_id, updates) => expense(updates));

    await service.managerApprove(managerActor, 'expense-1', {
      financeOfficerId: 'finance-user-1',
    });

    expect(tenantUserMocks.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'finance-user-1',
        organizationId,
        role: TenantRole.FINANCE_OFFICER,
        status: TenantUserStatus.ACTIVE,
      },
      select: { id: true },
    });
    expect(expenseMocks.update).toHaveBeenCalledWith(
      'expense-1',
      expect.objectContaining({
        assignedFinanceOfficerId: 'finance-user-1',
        workflowStatus: 'finance_review',
      }),
    );
  });

  it('limits the finance queue to the authenticated officer and tenant', async () => {
    const { expenseMocks, service } = setup();
    expenseMocks.findAll.mockReturnValue([
      expense({
        workflowStatus: 'finance_review',
        assignedFinanceOfficerId: 'finance-user-1',
      }),
      expense({
        id: 'other-officer',
        workflowStatus: 'finance_review',
        assignedFinanceOfficerId: 'finance-user-2',
      }),
      expense({
        id: 'other-org',
        organizationId: otherOrganizationId,
        workflowStatus: 'finance_review',
        assignedFinanceOfficerId: 'finance-user-1',
      }),
    ]);
    const actor: TenantAuthContext = {
      ...managerActor,
      user: {
        ...managerActor.user,
        id: 'finance-user-1',
        role: TenantRole.FINANCE_OFFICER,
      },
    };

    await expect(service.listFinanceQueue(actor)).resolves.toEqual([
      expect.objectContaining({ id: 'expense-1' }),
    ]);
  });
});
