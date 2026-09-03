import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../rbac/decorators/platform-permissions.decorator';
import {
  ListInvoicesQueryDto,
  ListPaymentsQueryDto,
  RevenueOverviewQueryDto,
} from './dto/list-billing-query.dto';
import { PlatformBillingService } from './platform-billing.service';

@ApiTags('Platform billing and revenue')
@ApiBearerAuth('platform-access-token')
@Controller('billing')
export class PlatformBillingController {
  constructor(private readonly billing: PlatformBillingService) {}

  @Get('invoices')
  @Permissions('billing.invoice.view')
  @ApiOperation({ summary: 'List subscription invoices' })
  listInvoices(@Query() query: ListInvoicesQueryDto) {
    return this.billing.listInvoices(query);
  }

  @Get('payments')
  @Permissions('billing.payment.view')
  @ApiOperation({ summary: 'List subscription payments' })
  listPayments(@Query() query: ListPaymentsQueryDto) {
    return this.billing.listPayments(query);
  }

  @Get('overview')
  @Permissions('billing.revenue.view')
  @ApiOperation({ summary: 'Get currency-safe billing and revenue overview' })
  getOverview(@Query() query: RevenueOverviewQueryDto) {
    return this.billing.getRevenueOverview(query);
  }

  @Get('revenue')
  @Permissions('billing.revenue.view')
  @ApiOperation({ summary: 'Get the canonical revenue overview' })
  getRevenue(@Query() query: RevenueOverviewQueryDto) {
    return this.billing.getRevenueOverview(query);
  }
}
