import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InvoiceStatus,
  Prisma,
  SubscriptionPaymentStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import {
  paymentInclude,
  PaymentDto,
  toPaymentDto,
} from '../commercial/platform-commercial.types';
import {
  PlatformBillingService,
  TrustedPaymentFinalizationInput,
} from './platform-billing.service';

const PROVIDER = 'RAZORPAY';
const PAYABLE_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.PENDING,
  InvoiceStatus.OVERDUE,
];

interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  status?: string;
}

interface RazorpayPaymentResponse {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  created_at?: number;
  error_code?: string;
  error_description?: string;
  error_reason?: string;
}

interface RazorpayWebhookPayload {
  event?: unknown;
  id?: unknown;
  payload?: {
    payment?: {
      entity?: unknown;
    };
  };
}

interface RazorpayPaymentEntity {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status?: string;
  method?: string;
  created_at?: number;
  error_code?: string;
  error_description?: string;
  error_reason?: string;
}

export interface SafeRazorpayOrder {
  orderId: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  keyId: string;
  provider: typeof PROVIDER;
  providerStatus?: string;
}

export interface RazorpayCheckoutVerificationInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  invoiceId?: string;
}

@Injectable()
export class RazorpayService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly billing: PlatformBillingService,
  ) {}

  async createPaymentOrder(
    invoiceId: string,
    actorStaffId: string,
  ): Promise<SafeRazorpayOrder> {
    const credentials = this.credentials();
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { subscription: true },
    });
    if (!invoice) {
      throw new NotFoundException({
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice not found.',
      });
    }
    this.assertInvoicePayable(invoice.status);
    if (invoice.subscription.status === SubscriptionStatus.CANCELLED) {
      throw new ConflictException({
        code: 'SUBSCRIPTION_CANCELLED',
        message: 'A cancelled subscription cannot receive a payment order.',
      });
    }

    const existing = await this.prisma.subscriptionPayment.findFirst({
      where: {
        invoiceId,
        provider: PROVIDER,
        status: SubscriptionPaymentStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
      include: paymentInclude,
    });
    if (existing) {
      return this.safeOrder(
        existing.providerOrderId,
        existing.id,
        invoice.id,
        existing.amount,
        existing.currency,
        credentials.keyId,
      );
    }

    const amount = this.toSmallestCurrencyUnit(
      invoice.totalAmount,
      invoice.currency,
    );
    const currency = this.normalizeCurrency(invoice.currency);
    const order = await this.createProviderOrder({
      amount,
      currency,
      receipt: invoice.invoiceNumber,
      invoiceId: invoice.id,
    });
    if (
      order.amount !== amount ||
      this.normalizeCurrency(order.currency) !== currency
    ) {
      throw new BadGatewayException({
        code: 'RAZORPAY_ORDER_MISMATCH',
        message: 'Razorpay returned an order that does not match the invoice.',
      });
    }

    try {
      const payment = await this.billing.createPaymentAttempt({
        invoiceId: invoice.id,
        provider: PROVIDER,
        providerOrderId: order.id,
        actorStaffId,
      });
      return this.safeOrder(
        order.id,
        payment.id,
        invoice.id,
        payment.amount,
        payment.currency,
        credentials.keyId,
        order.status,
      );
    } catch (error) {
      if (
        error instanceof ConflictException &&
        this.exceptionCode(error) === 'PROVIDER_ORDER_ALREADY_RECORDED'
      ) {
        const racedPayment = await this.prisma.subscriptionPayment.findFirst({
          where: {
            invoiceId,
            provider: PROVIDER,
            status: SubscriptionPaymentStatus.PENDING,
          },
          orderBy: { createdAt: 'desc' },
          include: paymentInclude,
        });
        if (racedPayment) {
          return this.safeOrder(
            racedPayment.providerOrderId,
            racedPayment.id,
            invoice.id,
            racedPayment.amount,
            racedPayment.currency,
            credentials.keyId,
          );
        }
      }
      throw error;
    }
  }

  async verifyCheckoutPayment(
    input: RazorpayCheckoutVerificationInput,
    actorStaffId?: string,
  ): Promise<PaymentDto> {
    this.credentials();
    const orderId = this.required(input.razorpay_order_id, 'razorpay_order_id');
    const paymentId = this.required(
      input.razorpay_payment_id,
      'razorpay_payment_id',
    );
    const signature = this.required(
      input.razorpay_signature,
      'razorpay_signature',
    );
    if (!this.verifyCheckoutSignature(orderId, paymentId, signature)) {
      throw new UnauthorizedException({
        code: 'PAYMENT_VERIFICATION_FAILURE',
        message: 'Payment verification failed.',
      });
    }

    const payment = await this.findPaymentByOrder(orderId, input.invoiceId);
    const providerPayment = await this.fetchPayment(paymentId);
    this.assertProviderPayment(providerPayment, payment, paymentId, orderId);
    const providerStatus = providerPayment.status.trim().toUpperCase();
    if (providerStatus === 'FAILED') {
      await this.billing.recordVerifiedProviderPaymentFailure({
        provider: PROVIDER,
        providerEventId: `checkout:${paymentId}`,
        providerEventType: 'payment.failed',
        providerOrderId: orderId,
        providerReference: paymentId,
        paymentMethod: providerPayment.method,
        failureCode: providerPayment.error_code,
        failureReason:
          providerPayment.error_description ||
          providerPayment.error_reason ||
          'Razorpay reported payment failure.',
        actorStaffId,
      });
      throw new ConflictException({
        code: 'PAYMENT_NOT_CAPTURED',
        message: 'Razorpay payment was not captured.',
      });
    }
    if (providerStatus !== 'CAPTURED') {
      throw new ConflictException({
        code: 'PAYMENT_NOT_CAPTURED',
        message: 'Only a captured Razorpay payment can be finalized.',
      });
    }

    return this.billing.finalizeVerifiedProviderPayment(
      this.finalizationInput(
        providerPayment,
        `checkout:${paymentId}`,
        'PROVIDER_API',
        actorStaffId,
      ),
    );
  }

  async handleWebhook(
    rawBody: Buffer,
    signature: string | undefined,
    headerEventId?: string,
  ): Promise<{
    duplicate: boolean;
    processed: boolean;
    eventId: string;
    eventType: string;
    payment?: PaymentDto;
  }> {
    this.credentials();
    if (!signature || !this.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException({
        code: 'WEBHOOK_SIGNATURE_FAILURE',
        message: 'Webhook signature verification failed.',
      });
    }
    const payload = this.parseWebhookPayload(rawBody);
    const eventType = this.requiredString(payload.event, 'event');
    const eventId = this.webhookEventId(rawBody, payload, headerEventId);
    const duplicate = await this.prisma.paymentProviderEvent.findUnique({
      where: { provider_eventId: { provider: PROVIDER, eventId } },
      include: { subscriptionPayment: { include: paymentInclude } },
    });
    if (duplicate?.status === 'PROCESSED' && duplicate.subscriptionPayment) {
      return {
        duplicate: true,
        processed: true,
        eventId,
        eventType,
        payment: toPaymentDto(duplicate.subscriptionPayment),
      };
    }

    if (eventType !== 'payment.captured' && eventType !== 'payment.failed') {
      return { duplicate: false, processed: false, eventId, eventType };
    }
    const entity = this.paymentEntity(payload);
    const providerPayment = await this.fetchPayment(entity.id);
    const payment = await this.findPaymentByOrder(entity.order_id);
    this.assertProviderPayment(
      providerPayment,
      payment,
      entity.id,
      entity.order_id,
    );

    if (eventType === 'payment.captured') {
      if (providerPayment.status.trim().toUpperCase() !== 'CAPTURED') {
        throw new ConflictException({
          code: 'PAYMENT_NOT_CAPTURED',
          message: 'Only a captured Razorpay payment can be finalized.',
        });
      }
      const finalized = await this.billing.finalizeVerifiedProviderPayment(
        this.finalizationInput(providerPayment, eventId, 'SIGNED_WEBHOOK'),
      );
      return {
        duplicate: false,
        processed: true,
        eventId,
        eventType,
        payment: finalized,
      };
    }

    if (providerPayment.status.trim().toUpperCase() !== 'FAILED') {
      throw new ConflictException({
        code: 'PAYMENT_FAILURE_NOT_CONFIRMED',
        message: 'Razorpay has not confirmed a failed payment.',
      });
    }
    const failed = await this.billing.recordVerifiedProviderPaymentFailure({
      provider: PROVIDER,
      providerEventId: eventId,
      providerEventType: eventType,
      providerOrderId: providerPayment.order_id,
      providerReference: providerPayment.id,
      paymentMethod: providerPayment.method,
      failureCode: providerPayment.error_code,
      failureReason:
        providerPayment.error_description ||
        providerPayment.error_reason ||
        'Razorpay reported payment failure.',
    });
    return {
      duplicate: false,
      processed: true,
      eventId,
      eventType,
      payment: failed,
    };
  }

  toSmallestCurrencyUnit(
    amount: Prisma.Decimal | string | number,
    currency: string,
  ): number {
    const exponent = this.currencyExponent(currency);
    const decimal = new Prisma.Decimal(amount);
    const smallest = decimal.mul(new Prisma.Decimal(10).pow(exponent));
    if (
      !decimal.isFinite() ||
      decimal.lessThanOrEqualTo(0) ||
      !smallest.isInteger()
    ) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'Invoice amount must be a positive exact currency amount.',
      });
    }
    const value = smallest.toNumber();
    if (!Number.isSafeInteger(value)) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'Invoice amount exceeds Razorpay limits.',
      });
    }
    return value;
  }

  verifyCheckoutSignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    const { keySecret } = this.credentials();
    return this.safeCompare(
      this.hmac(`${orderId}|${paymentId}`, keySecret),
      signature,
    );
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    return this.safeCompare(
      this.hmac(rawBody, this.webhookSecret()),
      signature,
    );
  }

  private async createProviderOrder(input: {
    amount: number;
    currency: string;
    receipt: string;
    invoiceId: string;
  }): Promise<RazorpayOrderResponse> {
    const { keyId, keySecret } = this.credentials();
    let response: Response;
    try {
      response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: input.amount,
          currency: input.currency,
          receipt: input.receipt,
          notes: { invoiceId: input.invoiceId, environment: 'test' },
        }),
      });
    } catch {
      throw this.providerApiFailure();
    }
    const body = await this.readProviderBody(response);
    if (!response.ok) throw this.providerApiFailure();
    const order = this.orderResponse(body);
    if (!order.id || !Number.isInteger(order.amount) || !order.currency) {
      throw this.providerApiFailure('Razorpay returned an invalid order.');
    }
    return order;
  }

  private async fetchPayment(
    paymentId: string,
  ): Promise<RazorpayPaymentResponse> {
    const { keyId, keySecret } = this.credentials();
    let response: Response;
    try {
      response = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
          },
        },
      );
    } catch {
      throw this.providerApiFailure();
    }
    const body = await this.readProviderBody(response);
    if (!response.ok) throw this.providerApiFailure();
    const payment = this.paymentResponse(body);
    if (!payment.id || !payment.order_id || !payment.currency) {
      throw this.providerApiFailure('Razorpay returned an invalid payment.');
    }
    return payment;
  }

  private async findPaymentByOrder(orderId: string, invoiceId?: string) {
    const payment = await this.prisma.subscriptionPayment.findFirst({
      where: {
        provider: PROVIDER,
        providerOrderId: orderId,
        ...(invoiceId ? { invoiceId } : {}),
      },
      include: {
        invoice: {
          select: { id: true, status: true, totalAmount: true, currency: true },
        },
        subscription: { select: { id: true, status: true } },
      },
    });
    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Razorpay payment order was not found.',
      });
    }
    return payment;
  }

  private assertProviderPayment(
    providerPayment: RazorpayPaymentResponse,
    payment: Awaited<ReturnType<RazorpayService['findPaymentByOrder']>>,
    paymentId: string,
    orderId: string,
  ): void {
    if (
      providerPayment.id !== paymentId ||
      providerPayment.order_id !== orderId
    ) {
      throw new ConflictException({
        code: 'RAZORPAY_PAYMENT_MISMATCH',
        message: 'Razorpay payment does not match the stored payment order.',
      });
    }
    if (
      providerPayment.amount !==
        this.toSmallestCurrencyUnit(
          payment.invoice.totalAmount,
          payment.invoice.currency,
        ) ||
      this.normalizeCurrency(providerPayment.currency) !==
        this.normalizeCurrency(payment.invoice.currency)
    ) {
      throw new ConflictException({
        code: 'PAYMENT_COMMERCIAL_MISMATCH',
        message: 'Razorpay amount or currency does not match the invoice.',
      });
    }
  }

  private finalizationInput(
    payment: RazorpayPaymentResponse,
    eventId: string,
    verificationSource: TrustedPaymentFinalizationInput['verificationSource'] = 'PROVIDER_API',
    actorStaffId?: string,
  ): TrustedPaymentFinalizationInput {
    return {
      provider: PROVIDER,
      providerEventId: eventId,
      providerEventType: 'payment.captured',
      providerOrderId: payment.order_id,
      providerReference: payment.id,
      amount: this.fromSmallestCurrencyUnit(payment.amount, payment.currency),
      currency: this.normalizeCurrency(payment.currency),
      paymentStatus: 'CAPTURED',
      verificationSource,
      paymentMethod: payment.method,
      occurredAt: this.providerDate(payment.created_at),
      actorStaffId,
    };
  }

  private providerDate(value?: number): Date {
    if (typeof value === 'number' && Number.isFinite(value)) {
      const date = new Date(value * 1000);
      if (!Number.isNaN(date.getTime())) return date;
    }
    return new Date();
  }

  private fromSmallestCurrencyUnit(amount: number, currency: string): string {
    const exponent = this.currencyExponent(currency);
    return new Prisma.Decimal(amount)
      .div(new Prisma.Decimal(10).pow(exponent))
      .toFixed(exponent);
  }

  private safeOrder(
    orderId: string,
    paymentId: string,
    invoiceId: string,
    amount: Prisma.Decimal | string,
    currency: string,
    keyId: string,
    providerStatus?: string,
  ): SafeRazorpayOrder {
    return {
      orderId,
      paymentId,
      invoiceId,
      amount: this.toSmallestCurrencyUnit(amount, currency),
      currency: this.normalizeCurrency(currency),
      keyId,
      provider: PROVIDER,
      ...(providerStatus ? { providerStatus } : {}),
    };
  }

  private credentials(): { keyId: string; keySecret: string } {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID')?.trim();
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET')?.trim();
    if (!keyId || !keySecret) {
      throw new ServiceUnavailableException({
        code: 'MISSING_RAZORPAY_CONFIGURATION',
        message: 'Razorpay test mode configuration is incomplete.',
      });
    }
    return { keyId, keySecret };
  }

  private webhookSecret(): string {
    const configured = this.config
      .get<string>('RAZORPAY_WEBHOOK_SECRET')
      ?.trim();
    return configured || this.credentials().keySecret;
  }

  private currencyExponent(currency: string): number {
    const normalized = this.normalizeCurrency(currency);
    const exponents: Record<string, number | undefined> = {
      AED: 2,
      AUD: 2,
      BHD: 3,
      CAD: 2,
      CHF: 2,
      CNY: 2,
      DKK: 2,
      EUR: 2,
      GBP: 2,
      HKD: 2,
      INR: 2,
      JOD: 3,
      JPY: 0,
      KRW: 0,
      KWD: 3,
      MYR: 2,
      NZD: 2,
      OMR: 3,
      PHP: 2,
      PLN: 2,
      QAR: 2,
      SAR: 2,
      SEK: 2,
      SGD: 2,
      THB: 2,
      USD: 2,
      ZAR: 2,
    };
    const exponent = exponents[normalized];
    if (exponent === undefined) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_CURRENCY',
        message: `Razorpay does not support ${normalized} in this adapter.`,
      });
    }
    return exponent;
  }

  private normalizeCurrency(currency: string): string {
    const normalized = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalized)) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_CURRENCY',
        message: 'Invoice currency must be a three-letter ISO code.',
      });
    }
    return normalized;
  }

  private assertInvoicePayable(status: InvoiceStatus): void {
    if (!PAYABLE_INVOICE_STATUSES.includes(status)) {
      throw new ConflictException({
        code: 'INVOICE_NOT_PAYABLE',
        message: `Invoice cannot be paid from ${status}.`,
      });
    }
  }

  private required(value: string, field: string): string {
    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException({
        code: 'INVALID_PROVIDER_DATA',
        message: `${field} is required.`,
      });
    }
    return normalized;
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException({
        code: 'INVALID_WEBHOOK_PAYLOAD',
        message: `Razorpay webhook ${field} is required.`,
      });
    }
    return this.required(value, field);
  }

  private parseWebhookPayload(rawBody: Buffer): RazorpayWebhookPayload {
    try {
      const value: unknown = JSON.parse(rawBody.toString('utf8'));
      if (!value || typeof value !== 'object') throw new Error('invalid');
      return value;
    } catch {
      throw new BadRequestException({
        code: 'INVALID_WEBHOOK_PAYLOAD',
        message: 'Razorpay webhook payload is not valid JSON.',
      });
    }
  }

  private paymentEntity(
    payload: RazorpayWebhookPayload,
  ): RazorpayPaymentEntity {
    const entity = payload.payload?.payment?.entity;
    if (!entity || typeof entity !== 'object') {
      throw new BadRequestException({
        code: 'INVALID_WEBHOOK_PAYLOAD',
        message: 'Razorpay webhook payment data is missing.',
      });
    }
    const record = entity as Record<string, unknown>;
    if (
      typeof record.id !== 'string' ||
      typeof record.order_id !== 'string' ||
      typeof record.amount !== 'number' ||
      typeof record.currency !== 'string'
    ) {
      throw new BadRequestException({
        code: 'INVALID_WEBHOOK_PAYLOAD',
        message: 'Razorpay webhook payment data is incomplete.',
      });
    }
    return {
      id: record.id,
      order_id: record.order_id,
      amount: record.amount,
      currency: record.currency,
      status: typeof record.status === 'string' ? record.status : undefined,
      method: typeof record.method === 'string' ? record.method : undefined,
      created_at:
        typeof record.created_at === 'number' ? record.created_at : undefined,
      error_code:
        typeof record.error_code === 'string' ? record.error_code : undefined,
      error_description:
        typeof record.error_description === 'string'
          ? record.error_description
          : undefined,
      error_reason:
        typeof record.error_reason === 'string'
          ? record.error_reason
          : undefined,
    };
  }

  private webhookEventId(
    rawBody: Buffer,
    payload: RazorpayWebhookPayload,
    headerEventId?: string,
  ): string {
    const candidate =
      headerEventId?.trim() ||
      (typeof payload.id === 'string' ? payload.id.trim() : '');
    return (
      candidate || `body:${createHash('sha256').update(rawBody).digest('hex')}`
    );
  }

  private async readProviderBody(response: Response): Promise<unknown> {
    try {
      return (await response.json()) as unknown;
    } catch {
      throw this.providerApiFailure('Razorpay returned an invalid response.');
    }
  }

  private orderResponse(value: unknown): RazorpayOrderResponse {
    if (!value || typeof value !== 'object')
      return { id: '', amount: 0, currency: '' };
    const record = value as Record<string, unknown>;
    return {
      id: typeof record.id === 'string' ? record.id : '',
      amount: typeof record.amount === 'number' ? record.amount : 0,
      currency: typeof record.currency === 'string' ? record.currency : '',
      status: typeof record.status === 'string' ? record.status : undefined,
    };
  }

  private paymentResponse(value: unknown): RazorpayPaymentResponse {
    if (!value || typeof value !== 'object') {
      return { id: '', order_id: '', amount: 0, currency: '', status: '' };
    }
    const record = value as Record<string, unknown>;
    return {
      id: typeof record.id === 'string' ? record.id : '',
      order_id: typeof record.order_id === 'string' ? record.order_id : '',
      amount: typeof record.amount === 'number' ? record.amount : 0,
      currency: typeof record.currency === 'string' ? record.currency : '',
      status: typeof record.status === 'string' ? record.status : '',
      method: typeof record.method === 'string' ? record.method : undefined,
      created_at:
        typeof record.created_at === 'number' ? record.created_at : undefined,
      error_code:
        typeof record.error_code === 'string' ? record.error_code : undefined,
      error_description:
        typeof record.error_description === 'string'
          ? record.error_description
          : undefined,
      error_reason:
        typeof record.error_reason === 'string'
          ? record.error_reason
          : undefined,
    };
  }

  private hmac(data: string | Buffer, secret: string): string {
    return createHmac('sha256', secret).update(data).digest('hex');
  }

  private safeCompare(expected: string, actual: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual || '');
    return (
      expectedBuffer.length === actualBuffer.length &&
      timingSafeEqual(expectedBuffer, actualBuffer)
    );
  }

  private providerApiFailure(
    message = 'Razorpay API request failed.',
  ): BadGatewayException {
    return new BadGatewayException({ code: 'RAZORPAY_API_FAILURE', message });
  }

  private exceptionCode(error: ConflictException): string | undefined {
    const response = error.getResponse();
    if (
      typeof response === 'object' &&
      response !== null &&
      'code' in response
    ) {
      const code = (response as { code?: unknown }).code;
      return typeof code === 'string' ? code : undefined;
    }
    return undefined;
  }
}
