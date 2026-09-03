import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantRole } from '@prisma/client';
import { TenantRoles } from '../auth/decorators/tenant-roles.decorator';
import { TenantAuthenticationGuard } from '../auth/guards/tenant-authentication.guard';
import { TenantRoleGuard } from '../auth/guards/tenant-role.guard';
import { TenantRequest } from '../auth/tenant-auth.types';
import { CreateTenantExpenseDto } from './dto/create-tenant-expense.dto';
import { CreateTenantCategoryDto } from './dto/create-tenant-category.dto';
import { CreateTenantPolicyDto } from './dto/create-tenant-policy.dto';
import { ManagerApproveExpenseDto } from './dto/manager-approve-expense.dto';
import { ManagerExpenseActionDto } from './dto/manager-expense-action.dto';
import { ReleaseTenantPaymentDto } from './dto/release-tenant-payment.dto';
import { UpdateTenantCategoryDto } from './dto/update-tenant-category.dto';
import { UpdateTenantExpenseDto } from './dto/update-tenant-expense.dto';
import { UpdateTenantPolicyDto } from './dto/update-tenant-policy.dto';
import { TenantExpensesService } from './tenant-expenses.service';

@ApiTags('Tenant expenses')
@ApiBearerAuth('tenant-access-token')
@UseGuards(TenantAuthenticationGuard, TenantRoleGuard)
@Controller('api/v1/tenant/expenses')
export class TenantExpensesController {
  constructor(private readonly expenses: TenantExpensesService) {}

  @Get('categories')
  @TenantRoles(
    TenantRole.CONFIGURATION_MANAGER,
    TenantRole.EXPENSE_SUBMITTER,
    TenantRole.MANAGER,
    TenantRole.FINANCE_OFFICER,
    TenantRole.COMPLIANCE_OFFICER,
  )
  categories(@Req() request: TenantRequest) {
    return this.expenses.listCategories(request.tenantAuth!.organizationId);
  }

  @Get('policies')
  @TenantRoles(
    TenantRole.CONFIGURATION_MANAGER,
    TenantRole.EXPENSE_SUBMITTER,
    TenantRole.MANAGER,
    TenantRole.FINANCE_OFFICER,
    TenantRole.COMPLIANCE_OFFICER,
  )
  policies(@Req() request: TenantRequest) {
    return this.expenses.listPolicies(request.tenantAuth!.organizationId);
  }

  @Get('configuration/categories')
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  configurationCategories(@Req() request: TenantRequest) {
    return this.expenses.listConfigurationCategories(
      request.tenantAuth!.organizationId,
    );
  }

  @Post('configuration/categories')
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  createCategory(
    @Req() request: TenantRequest,
    @Body() dto: CreateTenantCategoryDto,
  ) {
    return this.expenses.createCategory(
      request.tenantAuth!.organizationId,
      dto,
    );
  }

  @Patch('configuration/categories/:id')
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  updateCategory(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTenantCategoryDto,
  ) {
    return this.expenses.updateCategory(
      request.tenantAuth!.organizationId,
      id,
      dto,
    );
  }

  @Delete('configuration/categories/:id')
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  deleteCategory(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.expenses.deleteCategory(request.tenantAuth!.organizationId, id);
  }

  @Get('configuration/policies')
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  configurationPolicies(@Req() request: TenantRequest) {
    return this.expenses.listPolicies(request.tenantAuth!.organizationId);
  }

  @Post('configuration/policies')
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  createPolicy(
    @Req() request: TenantRequest,
    @Body() dto: CreateTenantPolicyDto,
  ) {
    return this.expenses.createPolicy(request.tenantAuth!.organizationId, dto);
  }

  @Patch('configuration/policies/:id')
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  updatePolicy(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTenantPolicyDto,
  ) {
    return this.expenses.updatePolicy(
      request.tenantAuth!.organizationId,
      id,
      dto,
    );
  }

  @Delete('configuration/policies/:id')
  @TenantRoles(TenantRole.CONFIGURATION_MANAGER)
  deletePolicy(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.expenses.deletePolicy(request.tenantAuth!.organizationId, id);
  }

  @Post()
  @TenantRoles(TenantRole.EXPENSE_SUBMITTER)
  create(@Req() request: TenantRequest, @Body() dto: CreateTenantExpenseDto) {
    return this.expenses.create(request.tenantAuth!, dto);
  }

  @Get('mine')
  @TenantRoles(TenantRole.EXPENSE_SUBMITTER)
  ownExpenses(@Req() request: TenantRequest) {
    return this.expenses.listOwnExpenses(request.tenantAuth!);
  }

  @Patch(':id')
  @TenantRoles(TenantRole.EXPENSE_SUBMITTER)
  updateOwnExpense(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTenantExpenseDto,
  ) {
    return this.expenses.updateOwnExpense(request.tenantAuth!, id, dto);
  }

  @Delete(':id')
  @TenantRoles(TenantRole.EXPENSE_SUBMITTER)
  deleteOwnExpense(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.expenses.deleteOwnExpense(request.tenantAuth!, id);
  }

  @Get('manager/queue')
  @TenantRoles(TenantRole.MANAGER)
  managerQueue(@Req() request: TenantRequest) {
    return this.expenses.listManagerQueue(request.tenantAuth!);
  }

  @Get('manager/history')
  @TenantRoles(TenantRole.MANAGER)
  managerHistory(@Req() request: TenantRequest) {
    return this.expenses.listManagerHistory(request.tenantAuth!);
  }

  @Get('manager/finance-officers')
  @TenantRoles(TenantRole.MANAGER)
  financeOfficers(@Req() request: TenantRequest) {
    return this.expenses.listFinanceOfficers(
      request.tenantAuth!.organizationId,
    );
  }

  @Post(':id/manager/approve')
  @TenantRoles(TenantRole.MANAGER)
  managerApprove(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() dto: ManagerApproveExpenseDto,
  ) {
    return this.expenses.managerApprove(request.tenantAuth!, id, dto);
  }

  @Post(':id/manager/return')
  @TenantRoles(TenantRole.MANAGER)
  managerReturn(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() dto: ManagerExpenseActionDto,
  ) {
    return this.expenses.managerReturn(request.tenantAuth!, id, dto.note);
  }

  @Post(':id/manager/reject')
  @TenantRoles(TenantRole.MANAGER)
  managerReject(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() dto: ManagerExpenseActionDto,
  ) {
    return this.expenses.managerReject(request.tenantAuth!, id, dto.note);
  }

  @Post(':id/manager/escalate')
  @TenantRoles(TenantRole.MANAGER)
  managerEscalate(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() dto: ManagerExpenseActionDto,
  ) {
    return this.expenses.managerEscalate(request.tenantAuth!, id, dto.note);
  }

  @Get('finance/queue')
  @TenantRoles(TenantRole.FINANCE_OFFICER)
  financeQueue(@Req() request: TenantRequest) {
    return this.expenses.listFinanceQueue(request.tenantAuth!);
  }

  @Get('finance/workspace')
  @TenantRoles(TenantRole.FINANCE_OFFICER)
  financeWorkspace(@Req() request: TenantRequest) {
    return this.expenses.listFinanceWorkspace(request.tenantAuth!);
  }

  @Post(':id/finance/approve')
  @TenantRoles(TenantRole.FINANCE_OFFICER)
  financeApprove(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() dto: ManagerExpenseActionDto,
  ) {
    return this.expenses.financeApprove(request.tenantAuth!, id, dto.note);
  }

  @Post(':id/finance/reject')
  @TenantRoles(TenantRole.FINANCE_OFFICER)
  financeReject(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() dto: ManagerExpenseActionDto,
  ) {
    return this.expenses.financeReject(request.tenantAuth!, id, dto.note);
  }

  @Post(':id/finance/request-info')
  @TenantRoles(TenantRole.FINANCE_OFFICER)
  financeRequestInfo(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() dto: ManagerExpenseActionDto,
  ) {
    return this.expenses.financeRequestInfo(request.tenantAuth!, id, dto.note);
  }

  @Post(':id/finance/flag')
  @TenantRoles(TenantRole.FINANCE_OFFICER)
  financeFlag(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() dto: ManagerExpenseActionDto,
  ) {
    return this.expenses.financeFlag(request.tenantAuth!, id, dto.note);
  }

  @Post('finance/payment-releases')
  @TenantRoles(TenantRole.FINANCE_OFFICER)
  releasePayment(
    @Req() request: TenantRequest,
    @Body() dto: ReleaseTenantPaymentDto,
  ) {
    return this.expenses.releasePayment(request.tenantAuth!, dto.expenseIds);
  }

  @Post('finance/transactions/:id/process')
  @TenantRoles(TenantRole.FINANCE_OFFICER)
  markBankProcessed(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.expenses.markBankProcessed(request.tenantAuth!, id);
  }

  @Post('finance/transactions/:id/fail')
  @TenantRoles(TenantRole.FINANCE_OFFICER)
  markBankFailed(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.expenses.markBankFailed(request.tenantAuth!, id);
  }

  @Post('finance/transactions/:id/reconcile')
  @TenantRoles(TenantRole.FINANCE_OFFICER)
  reconcileTransaction(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.expenses.reconcileTransaction(request.tenantAuth!, id);
  }

  @Get('compliance/queue')
  @TenantRoles(TenantRole.COMPLIANCE_OFFICER)
  complianceQueue(@Req() request: TenantRequest) {
    return this.expenses.listComplianceQueue(
      request.tenantAuth!.organizationId,
    );
  }

  @Post(':id/compliance/approve')
  @TenantRoles(TenantRole.COMPLIANCE_OFFICER)
  complianceApprove(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() dto: ManagerExpenseActionDto,
  ) {
    return this.expenses.complianceApprove(request.tenantAuth!, id, dto.note);
  }

  @Post(':id/compliance/reject')
  @TenantRoles(TenantRole.COMPLIANCE_OFFICER)
  complianceReject(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() dto: ManagerExpenseActionDto,
  ) {
    return this.expenses.complianceReject(request.tenantAuth!, id, dto.note);
  }

  @Post(':id/compliance/corrective-action')
  @TenantRoles(TenantRole.COMPLIANCE_OFFICER)
  complianceCorrectiveAction(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() dto: ManagerExpenseActionDto,
  ) {
    return this.expenses.complianceCorrectiveAction(
      request.tenantAuth!,
      id,
      dto.note,
    );
  }

  @Get('notifications')
  @TenantRoles(
    TenantRole.CONFIGURATION_MANAGER,
    TenantRole.EXPENSE_SUBMITTER,
    TenantRole.MANAGER,
    TenantRole.FINANCE_OFFICER,
    TenantRole.COMPLIANCE_OFFICER,
  )
  notifications(@Req() request: TenantRequest) {
    return this.expenses.listNotifications(request.tenantAuth!);
  }

  @Patch('notifications/:id/read')
  @TenantRoles(
    TenantRole.CONFIGURATION_MANAGER,
    TenantRole.EXPENSE_SUBMITTER,
    TenantRole.MANAGER,
    TenantRole.FINANCE_OFFICER,
    TenantRole.COMPLIANCE_OFFICER,
  )
  markNotificationRead(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.expenses.markNotificationRead(request.tenantAuth!, id);
  }

  @Post('notifications/read-all')
  @TenantRoles(
    TenantRole.CONFIGURATION_MANAGER,
    TenantRole.EXPENSE_SUBMITTER,
    TenantRole.MANAGER,
    TenantRole.FINANCE_OFFICER,
    TenantRole.COMPLIANCE_OFFICER,
  )
  markAllNotificationsRead(@Req() request: TenantRequest) {
    return this.expenses.markAllNotificationsRead(request.tenantAuth!);
  }

  @Delete('notifications/:id')
  @TenantRoles(
    TenantRole.CONFIGURATION_MANAGER,
    TenantRole.EXPENSE_SUBMITTER,
    TenantRole.MANAGER,
    TenantRole.FINANCE_OFFICER,
    TenantRole.COMPLIANCE_OFFICER,
  )
  deleteNotification(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.expenses.deleteNotification(request.tenantAuth!, id);
  }
}
