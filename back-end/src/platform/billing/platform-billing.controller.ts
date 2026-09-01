import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoreBillingService } from '../../core/billing/core-billing.service';
import { Permissions } from '../rbac/decorators/platform-permissions.decorator';
import {
  ListInvoicesDto,
  ListPaymentsDto,
  RevenueQueryDto,
} from './dto/platform-billing-query.dto';

@ApiTags('Platform billing')
@ApiBearerAuth('platform-access-token')
@Controller('billing')
export class PlatformBillingController {
  constructor(private readonly billing: CoreBillingService) {}

  @Get('overview')
  @Permissions('billing.billing.view')
  @ApiOperation({ summary: 'Get platform billing overview' })
  getOverview(@Query() query: RevenueQueryDto) {
    return this.billing.getRevenueSummary(query);
  }

  @Get('revenue')
  @Permissions('billing.revenue.view')
  @ApiOperation({ summary: 'Get revenue summary and breakdowns' })
  getRevenue(@Query() query: RevenueQueryDto) {
    return this.billing.getRevenueSummary(query);
  }

  @Get('invoices')
  @Permissions('billing.invoice.view')
  @ApiOperation({ summary: 'List platform invoices' })
  listInvoices(@Query() query: ListInvoicesDto) {
    return this.billing.listInvoices(query);
  }

  @Get('invoices/:id')
  @Permissions('billing.invoice.view')
  @ApiOperation({ summary: 'Get platform invoice details' })
  getInvoice(@Param('id', ParseUUIDPipe) id: string) {
    return this.billing.getInvoice(id);
  }

  @Get('payments')
  @Permissions('billing.payment.view')
  @ApiOperation({ summary: 'List platform subscription payments' })
  listPayments(@Query() query: ListPaymentsDto) {
    return this.billing.listPayments(query);
  }

  @Get('payments/failed')
  @Permissions('billing.payment.view')
  @ApiOperation({ summary: 'List failed subscription payments' })
  listFailedPayments(@Query() query: ListPaymentsDto) {
    return this.billing.listPayments({ ...query, failedOnly: true });
  }

  @Get('payments/:id')
  @Permissions('billing.payment.view')
  @ApiOperation({ summary: 'Get subscription payment details' })
  getPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.billing.getPayment(id);
  }
}
