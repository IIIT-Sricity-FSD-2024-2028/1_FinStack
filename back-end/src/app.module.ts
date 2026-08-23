import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import configuration, { AppConfiguration } from './common/config/configuration';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RolesGuard } from './common/guards/roles.guard';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingModule } from './common/logging/logging.module';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';
import { AuditController } from './modules/audit/audit.controller';
import { AuditModule } from './modules/audit/audit.module';
import { CategoriesController } from './modules/categories/categories.controller';
import { CategoriesModule } from './modules/categories/categories.module';
import { DashboardController } from './modules/dashboard/dashboard.controller';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExpensesController } from './modules/expenses/expenses.controller';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { NotificationsController } from './modules/notifications/notifications.controller';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PoliciesController } from './modules/policies/policies.controller';
import { PoliciesModule } from './modules/policies/policies.module';
import { ReportsController } from './modules/reports/reports.controller';
import { ReportsModule } from './modules/reports/reports.module';
import { TransactionsController } from './modules/transactions/transactions.controller';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { UsersController } from './modules/users/users.controller';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfiguration, true>) => [
        {
          ttl: seconds(
            configService.get('throttle.ttlSeconds', { infer: true }),
          ),
          limit: configService.get('throttle.limit', { infer: true }),
        },
      ],
    }),
    LoggingModule,
    UsersModule,
    ExpensesModule,
    CategoriesModule,
    PoliciesModule,
    AuditModule,
    NotificationsModule,
    TransactionsModule,
    ReportsModule,
    DashboardModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware, RequestLoggingMiddleware)
      .forRoutes(
        UsersController,
        ExpensesController,
        CategoriesController,
        PoliciesController,
        AuditController,
        NotificationsController,
        TransactionsController,
        ReportsController,
        DashboardController,
      );
  }
}
