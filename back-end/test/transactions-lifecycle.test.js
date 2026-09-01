const assert = require('node:assert/strict');
const test = require('node:test');

const { store } = require('../dist/src/data/store');
const { AuditRepository } = require('../dist/src/modules/audit/audit.repository');
const { AuditService } = require('../dist/src/modules/audit/audit.service');
const { CategoriesRepository } = require('../dist/src/modules/categories/categories.repository');
const { ExpensesRepository } = require('../dist/src/modules/expenses/expenses.repository');
const { TransactionsRepository } = require('../dist/src/modules/transactions/transactions.repository');
const { TransactionsService } = require('../dist/src/modules/transactions/transactions.service');
const { UsersRepository } = require('../dist/src/modules/users/users.repository');

function makeService() {
  const expensesRepository = new ExpensesRepository();
  return {
    expensesRepository,
    transactionsRepository: new TransactionsRepository(),
    service: new TransactionsService(
      new TransactionsRepository(),
      expensesRepository,
      new UsersRepository(),
      new CategoriesRepository(),
      new AuditService(new AuditRepository()),
    ),
  };
}

function resetWorkflowStore() {
  store.expenses = [];
  store.transactions = [];
  store.auditLogs = [];
}

function createApprovedExpense(expensesRepository) {
  const employee = store.users.find((user) => user.roles.includes('expense_submitter'));
  const manager = store.users.find((user) => user.roles.includes('manager'));
  const finance = store.users.find((user) => user.roles.includes('finance_officer'));
  const category = store.categories[0];

  return expensesRepository.create({
    employeeId: employee.employeeId,
    organizationId: employee.organizationId,
    managerEmployeeId: manager.employeeId,
    assignedFinanceOfficerId: finance.id,
    amount: 1250,
    currency: 'INR',
    categoryId: category.id,
    merchant: 'Test Merchant',
    date: '2026-09-01',
    status: 'approved',
    workflowStatus: 'approved_for_payment',
    notes: '',
    paymentMethod: 'personal-card',
    receiptFileName: '',
    managerDecision: 'Approved',
    financeDecision: 'Approved',
    complianceDecision: '',
    history: [{ code: 'finance_approved', label: 'Finance Approved', at: '2026-09-01T00:00:00.000Z', note: 'Approved.' }],
  });
}

function releaseOnePayment() {
  const { expensesRepository, transactionsRepository, service } = makeService();
  const expense = createApprovedExpense(expensesRepository);
  service.releasePaymentBatch('PB-TEST', [expense.id]);
  const transaction = transactionsRepository.findByExpenseId(expense.id)[0];
  return { expense, transaction, transactionsRepository, service };
}

test.beforeEach(resetWorkflowStore);

test('release does not mark expense paid', () => {
  const { expensesRepository, service } = makeService();
  const expense = createApprovedExpense(expensesRepository);

  service.releasePaymentBatch('PB-TEST', [expense.id]);

  const updatedExpense = expensesRepository.findById(expense.id);
  assert.equal(updatedExpense.workflowStatus, 'payment_processing');
  assert.equal(updatedExpense.status, 'approved');
  assert.equal(updatedExpense.paidAt, undefined);
});

test('release creates a pending transaction', () => {
  const { expensesRepository, transactionsRepository, service } = makeService();
  const expense = createApprovedExpense(expensesRepository);

  service.releasePaymentBatch('PB-TEST', [expense.id]);

  const transactions = transactionsRepository.findByExpenseId(expense.id);
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].status, 'pending');
  assert.equal(transactions[0].expenseId, expense.id);
  assert.equal(transactions[0].employeeId, expense.employeeId);
  assert.equal(transactions[0].organizationId, expense.organizationId);
  assert.equal(transactions[0].categoryId, expense.categoryId);
});

test('bank success marks pending transaction processed', () => {
  const { transaction, service } = releaseOnePayment();

  const processed = service.markProcessed(transaction.id);

  assert.equal(processed.status, 'processed');
  assert.ok(processed.processedAt);
});

test('bank failure marks pending transaction failed', () => {
  const { transaction, service } = releaseOnePayment();

  const failed = service.markFailed(transaction.id);

  assert.equal(failed.status, 'failed');
  assert.ok(failed.processedAt);
});

test('bank success alone does not mark expense paid', () => {
  const { transaction, transactionsRepository, service } = releaseOnePayment();

  const processed = service.markProcessed(transaction.id);
  const expense = store.expenses.find((item) => item.id === processed.expenseId);

  assert.equal(transactionsRepository.findById(transaction.id).status, 'processed');
  assert.equal(expense.workflowStatus, 'payment_processing');
  assert.equal(expense.paidAt, undefined);
});

test('reconcile processed transaction marks transaction reconciled and expense paid', () => {
  const { transaction, service } = releaseOnePayment();
  service.markProcessed(transaction.id);

  const reconciled = service.reconcile(transaction.id);
  const expense = store.expenses.find((item) => item.id === transaction.expenseId);

  assert.equal(reconciled.status, 'reconciled');
  assert.equal(expense.workflowStatus, 'paid');
  assert.equal(expense.status, 'approved');
  assert.ok(expense.paidAt);
});

test('cannot reconcile pending transaction', () => {
  const { transaction, service } = releaseOnePayment();

  assert.throws(() => service.reconcile(transaction.id), /Only processed transactions can be reconciled/);
});

test('cannot reconcile failed transaction', () => {
  const { transaction, service } = releaseOnePayment();
  service.markFailed(transaction.id);

  assert.throws(() => service.reconcile(transaction.id), /Only processed transactions can be reconciled/);
});

test('cannot fail processed or reconciled transactions', () => {
  const first = releaseOnePayment();
  const service = first.service;
  service.markProcessed(first.transaction.id);
  assert.throws(() => service.markFailed(first.transaction.id), /Only pending transactions can be marked failed/);

  resetWorkflowStore();
  const second = releaseOnePayment();
  second.service.markProcessed(second.transaction.id);
  second.service.reconcile(second.transaction.id);
  assert.throws(() => second.service.markFailed(second.transaction.id), /Only pending transactions can be marked failed/);
});

test('repeated release and reconcile calls do not duplicate or corrupt state', () => {
  const { expensesRepository, transactionsRepository, service } = makeService();
  const expense = createApprovedExpense(expensesRepository);

  service.releasePaymentBatch('PB-TEST', [expense.id]);
  service.releasePaymentBatch('PB-TEST', [expense.id]);
  assert.equal(transactionsRepository.findByExpenseId(expense.id).length, 1);

  const transaction = transactionsRepository.findByExpenseId(expense.id)[0];
  service.markProcessed(transaction.id);
  service.reconcile(transaction.id);
  service.reconcile(transaction.id);

  const paidExpense = expensesRepository.findById(expense.id);
  assert.equal(paidExpense.workflowStatus, 'paid');
  assert.equal(paidExpense.history.filter((entry) => entry.code === 'paid').length, 1);
  assert.equal(transactionsRepository.findByExpenseId(expense.id).length, 1);
});
