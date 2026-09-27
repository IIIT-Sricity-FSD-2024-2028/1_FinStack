import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  invoiceInclude,
  paymentInclude,
  subscriptionInclude,
  toInvoiceDto,
  toPaymentDto,
  toSubscriptionDto,
} from '../../platform/commercial/platform-commercial.types';
import { PlatformSubscriptionsService } from '../../platform/subscriptions/platform-subscriptions.service';
import { ChangeSubscriptionPlanDto } from '../../platform/subscriptions/dto/change-subscription-plan.dto';
import { CancelSubscriptionDto } from '../../platform/subscriptions/dto/cancel-subscription.dto';
import { RazorpayService } from '../../platform/billing/razorpay.service';
import { TenantRazorpayVerifyDto } from './dto/tenant-razorpay-verify.dto';

@Injectable()
export class TenantCommercialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: PlatformSubscriptionsService,
    private readonly razorpay: RazorpayService,
  ) {}

  async getSubscription(organizationId: string) {
    const record = await this.prisma.organizationSubscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: subscriptionInclude,
    });
    if (!record)
      throw new NotFoundException({
        code: 'TENANT_SUBSCRIPTION_NOT_FOUND',
        message: 'Subscription not found.',
      });
    return toSubscriptionDto(record);
  }

  async listInvoices(organizationId: string) {
    const records = await this.prisma.invoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: invoiceInclude,
    });
    return { items: records.map(toInvoiceDto) };
  }

  async listPayments(organizationId: string) {
    const records = await this.prisma.subscriptionPayment.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: paymentInclude,
    });
    return { items: records.map(toPaymentDto) };
  }

  async changePlan(organizationId: string, dto: ChangeSubscriptionPlanDto) {
    const subscription = await this.requireSubscription(organizationId);
    return this.subscriptions.requestPlanChange(subscription.id, dto, null);
  }

  async cancel(organizationId: string, dto: CancelSubscriptionDto) {
    const subscription = await this.requireSubscription(organizationId);
    return this.subscriptions.cancel(subscription.id, dto, null);
  }

  async createPaymentOrder(organizationId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      select: { id: true },
    });
    if (!invoice)
      throw new NotFoundException({
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice not found for this organization.',
      });
    return this.razorpay.createPaymentOrder(invoice.id);
  }

  async verifyPayment(organizationId: string, dto: TenantRazorpayVerifyDto) {
    const payment = await this.prisma.subscriptionPayment.findFirst({
      where: {
        invoiceId: dto.invoiceId,
        providerOrderId: dto.razorpay_order_id,
        organizationId,
      },
      select: { id: true },
    });
    if (!payment)
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Payment order not found for this organization.',
      });
    return this.razorpay.verifyCheckoutPayment(dto);
  }

  private async requireSubscription(organizationId: string) {
    const subscription = await this.prisma.organizationSubscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!subscription)
      throw new NotFoundException({
        code: 'TENANT_SUBSCRIPTION_NOT_FOUND',
        message: 'Subscription not found.',
      });
    return subscription;
  }
}
