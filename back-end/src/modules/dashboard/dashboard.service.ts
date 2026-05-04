import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { CategoriesService } from '../categories/categories.service';
import { ExpensesService } from '../expenses/expenses.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PoliciesService } from '../policies/policies.service';
import { TransactionsService } from '../transactions/transactions.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly usersService: UsersService,
    private readonly expensesService: ExpensesService,
    private readonly categoriesService: CategoriesService,
    private readonly policiesService: PoliciesService,
    private readonly notificationsService: NotificationsService,
    private readonly transactionsService: TransactionsService,
    private readonly auditService: AuditService,
  ) {}

  overview() {
    const expenses = this.expensesService.findAll();
    const notifications = this.notificationsService.findAll();
    return {
      totals: {
        users: this.usersService.findAll().length,
        expenses: expenses.length,
        categories: this.categoriesService.findAll().length,
        policies: this.policiesService.findAll().length,
        notifications: notifications.length,
        transactions: this.transactionsService.findAll().length,
      },
      expenseStatus: {
        pending: expenses.filter((expense) => expense.status === 'pending').length,
        approved: expenses.filter((expense) => expense.status === 'approved').length,
        rejected: expenses.filter((expense) => expense.status === 'rejected').length,
      },
      workflow: {
        managerReview: expenses.filter((expense) => expense.workflowStatus === 'manager_review').length,
        financeReview: expenses.filter((expense) => expense.workflowStatus === 'finance_review').length,
        complianceReview: expenses.filter((expense) => expense.workflowStatus === 'compliance_review').length,
        paymentQueue: expenses.filter((expense) => expense.workflowStatus === 'approved_for_payment' || expense.workflowStatus === 'payment_processing').length,
        paid: expenses.filter((expense) => expense.workflowStatus === 'paid').length,
      },
      spend: {
        total: expenses.reduce((sum, expense) => sum + expense.amount, 0),
        approved: expenses.filter((expense) => expense.status === 'approved').reduce((sum, expense) => sum + expense.amount, 0),
      },
      unreadNotifications: notifications.filter((notification) => notification.unread).length,
      recentAuditLogs: this.auditService.findAll().slice(0, 5),
    };
  }
}
