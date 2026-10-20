import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  OrganizationStatus,
  PrismaClient,
  TenantRole,
  TenantUserStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { ExpensesRepository } from '../../modules/expenses/expenses.repository';
import { ReceiptUploadService } from '../../modules/expenses/receipt-upload/receipt-upload.service';
import { AuditRepository } from '../../modules/audit/audit.repository';
import { AuditService } from '../../modules/audit/audit.service';
import { CategoriesRepository } from '../../modules/categories/categories.repository';
import { TransactionsRepository } from '../../modules/transactions/transactions.repository';
import { TransactionsService } from '../../modules/transactions/transactions.service';
import { UsersRepository } from '../../modules/users/users.repository';
import { TenantNotificationsService } from '../notifications/tenant-notifications.service';
import { TenantAuthContext } from '../auth/tenant-auth.types';
import { TenantExpensesService } from './tenant-expenses.service';
import { PrismaService } from '../../database/prisma.service';

describe('Finance Officer PostgreSQL Persistence & Lifecycle Integration', () => {
  let prisma: PrismaService;
  let service: TenantExpensesService;
  let expensesRepo: ExpensesRepository;
  let transactionsRepo: TransactionsRepository;
  let transactionsService: TransactionsService;
  let notificationsService: TenantNotificationsService;

  const testOrgId = randomUUID();
  const financeUserId = randomUUID();
  const managerUserId = randomUUID();
  const submitterUserId = randomUUID();
  const complianceUserId = randomUUID();
  const categoryId = randomUUID();

  const financeActor: TenantAuthContext = {
    user: {
      id: financeUserId,
      organizationId: testOrgId,
      employeeId: 'FIN-TEST-001',
      firstName: 'Finance',
      lastName: 'Officer',
      email: 'finance-test@finstack.local',
      role: TenantRole.FINANCE_OFFICER,
      status: 'ACTIVE',
    },
    organizationId: testOrgId,
  };

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    expensesRepo = new ExpensesRepository();
    transactionsRepo = new TransactionsRepository();
    const auditService = new AuditService(new AuditRepository());
    transactionsService = new TransactionsService(
      transactionsRepo,
      expensesRepo,
      new UsersRepository(),
      new CategoriesRepository(),
      auditService,
    );
    notificationsService = new TenantNotificationsService(prisma);
    const receiptUploadService = {} as ReceiptUploadService;

    service = new TenantExpensesService(
      prisma,
      expensesRepo,
      notificationsService,
      transactionsRepo,
      transactionsService,
      receiptUploadService,
    );

    const passwordHash = await argon2.hash('TestPassword123!');

    // 1. Seed test organization
    await prisma.organization.create({
      data: {
        id: testOrgId,
        name: 'Finance Test Org',
        primaryEmail: `test-org-${testOrgId.substring(0, 8)}@finstack.local`,
        status: OrganizationStatus.ACTIVE,
        defaultCurrency: 'INR',
      },
    });

    // 2. Seed manager user
    await prisma.tenantUser.create({
      data: {
        id: managerUserId,
        organizationId: testOrgId,
        employeeId: 'MGR-TEST-001',
        firstName: 'Test',
        lastName: 'Manager',
        email: `mgr-${testOrgId.substring(0, 8)}@finstack.local`,
        passwordHash,
        role: TenantRole.MANAGER,
        status: TenantUserStatus.ACTIVE,
      },
    });

    // 3. Seed submitter user (reporting to manager)
    await prisma.tenantUser.create({
      data: {
        id: submitterUserId,
        organizationId: testOrgId,
        employeeId: 'SUB-TEST-001',
        firstName: 'Test',
        lastName: 'Submitter',
        email: `sub-${testOrgId.substring(0, 8)}@finstack.local`,
        passwordHash,
        role: TenantRole.EXPENSE_SUBMITTER,
        status: TenantUserStatus.ACTIVE,
        managerId: managerUserId,
      },
    });

    // 4. Seed finance officer
    await prisma.tenantUser.create({
      data: {
        id: financeUserId,
        organizationId: testOrgId,
        employeeId: 'FIN-TEST-001',
        firstName: 'Finance',
        lastName: 'Officer',
        email: `fin-${testOrgId.substring(0, 8)}@finstack.local`,
        passwordHash,
        role: TenantRole.FINANCE_OFFICER,
        status: TenantUserStatus.ACTIVE,
      },
    });

    // 5. Seed compliance officer
    await prisma.tenantUser.create({
      data: {
        id: complianceUserId,
        organizationId: testOrgId,
        employeeId: 'CMP-TEST-001',
        firstName: 'Compliance',
        lastName: 'Officer',
        email: `cmp-${testOrgId.substring(0, 8)}@finstack.local`,
        passwordHash,
        role: TenantRole.COMPLIANCE_OFFICER,
        status: TenantUserStatus.ACTIVE,
      },
    });

    // 6. Seed active category
    await prisma.expenseCategory.create({
      data: {
        id: categoryId,
        organizationId: testOrgId,
        name: 'Travel & Lodging',
        status: 'Active',
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.tenantNotification.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.tenantAuditLog.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.expenseCategory.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.tenantUser.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.organization.deleteMany({
      where: { id: testOrgId },
    });
    await prisma.$disconnect();
  });

  it('lists active categories persisted in PostgreSQL', async () => {
    const categories = await service.listCategories(testOrgId);
    expect(categories.length).toBeGreaterThanOrEqual(1);
    expect(categories.some((c) => c.name === 'Travel & Lodging')).toBe(true);
  });

  it('Finance Officer approves an assigned expense and persists notification', async () => {
    const expense = expensesRepo.create({
      employeeId: 'SUB-TEST-001',
      organizationId: testOrgId,
      managerEmployeeId: 'MGR-TEST-001',
      assignedFinanceOfficerId: financeUserId,
      amount: 4500,
      currency: 'INR',
      categoryId,
      merchant: 'Airlines Inc',
      date: '2026-10-10',
      status: 'pending',
      workflowStatus: 'finance_review',
      notes: 'Client summit flight',
      paymentMethod: 'Corporate Card',
      receiptFileName: '',
      managerDecision: 'Approved',
      financeDecision: '',
      complianceDecision: '',
      history: [],
    });

    const approved = await service.financeApprove(
      financeActor,
      expense.id,
      'Approved after invoice audit',
    );

    expect(approved.workflowStatus).toBe('approved_for_payment');
    expect(approved.status).toBe('approved');
    expect(approved.financeDecision).toBe('Approved');
    expect(approved.financeDecisionNote).toBe('Approved after invoice audit');

    // Verify submitter notification was persisted to PostgreSQL
    const notification = await prisma.tenantNotification.findFirst({
      where: {
        organizationId: testOrgId,
        recipientUserId: submitterUserId,
        eventCode: 'finance_approved_submitter',
      },
    });
    expect(notification).not.toBeNull();
    expect(notification?.type).toBe('success');
    expect(notification?.title).toBe('Finance Approved Expense');
  });

  it('Finance Officer flags an expense for compliance and notifies compliance', async () => {
    const expense = expensesRepo.create({
      employeeId: 'SUB-TEST-001',
      organizationId: testOrgId,
      managerEmployeeId: 'MGR-TEST-001',
      assignedFinanceOfficerId: financeUserId,
      amount: 15000,
      currency: 'INR',
      categoryId,
      merchant: 'Luxury Hotel',
      date: '2026-10-11',
      status: 'pending',
      workflowStatus: 'finance_review',
      notes: 'Over policy limit',
      paymentMethod: 'Corporate Card',
      receiptFileName: '',
      managerDecision: 'Approved',
      financeDecision: '',
      complianceDecision: '',
      history: [],
    });

    const flagged = await service.financeFlag(
      financeActor,
      expense.id,
      'Possible policy violation on suite rate',
    );

    expect(flagged.workflowStatus).toBe('compliance_review');
    expect(flagged.financeDecision).toBe('Flagged');

    // Verify compliance notification persisted in PostgreSQL
    const compNotification = await prisma.tenantNotification.findFirst({
      where: {
        organizationId: testOrgId,
        recipientUserId: complianceUserId,
        eventCode: 'finance_flagged_compliance',
      },
    });
    expect(compNotification).not.toBeNull();
    expect(compNotification?.type).toBe('danger');
  });

  it('Finance Officer requests additional information', async () => {
    const expense = expensesRepo.create({
      employeeId: 'SUB-TEST-001',
      organizationId: testOrgId,
      managerEmployeeId: 'MGR-TEST-001',
      assignedFinanceOfficerId: financeUserId,
      amount: 1200,
      currency: 'INR',
      categoryId,
      merchant: 'Stationery Depot',
      date: '2026-10-12',
      status: 'pending',
      workflowStatus: 'finance_review',
      notes: 'Desk supplies',
      paymentMethod: 'Reimbursement',
      receiptFileName: '',
      managerDecision: 'Approved',
      financeDecision: '',
      complianceDecision: '',
      history: [],
    });

    const returned = await service.financeRequestInfo(
      financeActor,
      expense.id,
      'Please attach itemized tax invoice',
    );

    expect(returned.workflowStatus).toBe('returned');
    expect(returned.status).toBe('pending');
    expect(returned.financeDecision).toBe('Requested Info');
  });

  it('Finance Officer rejects an expense', async () => {
    const expense = expensesRepo.create({
      employeeId: 'SUB-TEST-001',
      organizationId: testOrgId,
      managerEmployeeId: 'MGR-TEST-001',
      assignedFinanceOfficerId: financeUserId,
      amount: 9999,
      currency: 'INR',
      categoryId,
      merchant: 'Personal Club',
      date: '2026-10-12',
      status: 'pending',
      workflowStatus: 'finance_review',
      notes: 'Club membership',
      paymentMethod: 'Personal Card',
      receiptFileName: '',
      managerDecision: 'Approved',
      financeDecision: '',
      complianceDecision: '',
      history: [],
    });

    const rejected = await service.financeReject(
      financeActor,
      expense.id,
      'Personal expenses cannot be reimbursed',
    );

    expect(rejected.workflowStatus).toBe('rejected');
    expect(rejected.status).toBe('rejected');
  });

  it('executes full payment release, processing, and reconciliation lifecycle', async () => {
    const expense = expensesRepo.create({
      employeeId: 'SUB-TEST-001',
      organizationId: testOrgId,
      managerEmployeeId: 'MGR-TEST-001',
      assignedFinanceOfficerId: financeUserId,
      amount: 3200,
      currency: 'INR',
      categoryId,
      merchant: 'Express Rail',
      date: '2026-10-13',
      status: 'approved',
      workflowStatus: 'approved_for_payment',
      notes: 'Train tickets',
      paymentMethod: 'Corporate Card',
      receiptFileName: '',
      managerDecision: 'Approved',
      financeDecision: 'Approved',
      complianceDecision: '',
      history: [],
    });

    // 1. Release Payment Batch
    const batchResult = await service.releasePayment(financeActor, [expense.id]);
    expect(batchResult.batchId).toBeDefined();
    expect(batchResult.transactions.length).toBe(1);

    const transaction = batchResult.transactions[0];
    expect(transaction.status).toBe('pending');
    expect(transaction.expenseId).toBe(expense.id);

    const releasedExpense = expensesRepo.findById(expense.id);
    expect(releasedExpense?.workflowStatus).toBe('payment_processing');

    // 2. Mark Bank Processed
    const processedTx = service.markBankProcessed(financeActor, transaction.id);
    expect(processedTx.status).toBe('processed');
    expect(processedTx.processedAt).toBeDefined();

    // 3. Reconcile Transaction
    const reconciledTx = await service.reconcileTransaction(financeActor, transaction.id);
    expect(reconciledTx.status).toBe('reconciled');

    const paidExpense = expensesRepo.findById(expense.id);
    expect(paidExpense?.workflowStatus).toBe('paid');
    expect(paidExpense?.paidAt).toBeDefined();

    // Verify paid notification persisted in PostgreSQL
    const paidNotification = await prisma.tenantNotification.findFirst({
      where: {
        organizationId: testOrgId,
        recipientUserId: submitterUserId,
        eventCode: 'expense_paid_submitter',
      },
    });
    expect(paidNotification).not.toBeNull();
    expect(paidNotification?.type).toBe('success');
  });

  it('prevents acting on expenses assigned to another finance officer', async () => {
    const otherFinanceId = randomUUID();
    const otherExpense = expensesRepo.create({
      employeeId: 'SUB-TEST-001',
      organizationId: testOrgId,
      managerEmployeeId: 'MGR-TEST-001',
      assignedFinanceOfficerId: otherFinanceId,
      amount: 1000,
      currency: 'INR',
      categoryId,
      merchant: 'Other Merchant',
      date: '2026-10-13',
      status: 'pending',
      workflowStatus: 'finance_review',
      notes: '',
      paymentMethod: 'Corporate Card',
      receiptFileName: '',
      managerDecision: 'Approved',
      financeDecision: '',
      complianceDecision: '',
      history: [],
    });

    await expect(
      service.financeApprove(financeActor, otherExpense.id),
    ).rejects.toThrow(ForbiddenException);
  });
});
