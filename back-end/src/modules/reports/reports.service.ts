import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { CategoriesService } from '../categories/categories.service';
import { ExpensesService } from '../expenses/expenses.service';
import { PoliciesService } from '../policies/policies.service';
import { TransactionsService } from '../transactions/transactions.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly expensesService: ExpensesService,
    private readonly categoriesService: CategoriesService,
    private readonly policiesService: PoliciesService,
    private readonly transactionsService: TransactionsService,
    private readonly auditService: AuditService,
  ) {}

  findAll() {
    const expenses = this.expensesService.findAll();
    const transactions = this.transactionsService.findAll();
    return {
      monthlyExpenseReport: this.monthlyExpenseSummary(expenses),
      categoryAnalysis: this.categoryAnalysis(expenses),
      paymentReleaseReport: {
        releasedCount: expenses.filter((expense) => expense.workflowStatus === 'paid').length,
        releasedTotal: expenses.filter((expense) => expense.workflowStatus === 'paid').reduce((sum, expense) => sum + expense.amount, 0),
        transactions: transactions.length,
      },
      complianceSummary: {
        activePolicies: this.policiesService.findAll().filter((policy) => policy.status === 'Active').length,
        auditEvents: this.auditService.findAll().length,
        flaggedExpenses: expenses.filter((expense) => expense.workflowStatus === 'compliance_review').length,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  summary() {
    return {
      users: this.usersService.findAll().length,
      categories: this.categoriesService.findAll().length,
      policies: this.policiesService.findAll().length,
      expenses: this.expensesService.findAll().length,
      transactions: this.transactionsService.findAll().length,
      auditLogs: this.auditService.findAll().length,
    };
  }

  private monthlyExpenseSummary(expenses: ReturnType<ExpensesService['findAll']>) {
    return expenses.reduce<Record<string, { count: number; total: number }>>((acc, expense) => {
      const month = expense.date.slice(0, 7);
      acc[month] = acc[month] || { count: 0, total: 0 };
      acc[month].count += 1;
      acc[month].total += expense.amount;
      return acc;
    }, {});
  }

  private categoryAnalysis(expenses: ReturnType<ExpensesService['findAll']>) {
    return expenses.reduce<Record<string, { count: number; total: number }>>((acc, expense) => {
      acc[expense.categoryId] = acc[expense.categoryId] || { count: 0, total: 0 };
      acc[expense.categoryId].count += 1;
      acc[expense.categoryId].total += expense.amount;
      return acc;
    }, {});
  }
}
