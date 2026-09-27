import { Module } from '@nestjs/common';
import { CategoriesModule } from '../../modules/categories/categories.module';
import { DatabaseModule } from '../../database/database.module';
import { ExpensesModule } from '../../modules/expenses/expenses.module';
import { NotificationsModule } from '../../modules/notifications/notifications.module';
import { PoliciesModule } from '../../modules/policies/policies.module';
import { TransactionsModule } from '../../modules/transactions/transactions.module';
import { TenantAuthModule } from '../auth/tenant-auth.module';
import { TenantExpensesController } from './tenant-expenses.controller';
import { TenantExpensesService } from './tenant-expenses.service';

@Module({
  imports: [
    DatabaseModule,
    TenantAuthModule,
    ExpensesModule,
    CategoriesModule,
    PoliciesModule,
    NotificationsModule,
    TransactionsModule,
  ],
  controllers: [TenantExpensesController],
  providers: [TenantExpensesService],
})
export class TenantExpensesModule {}
