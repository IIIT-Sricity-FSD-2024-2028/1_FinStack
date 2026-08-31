import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import {
  invalidAmount,
  invalidCurrency,
  missingRazorpayConfiguration,
  razorpayApiFailure,
} from './billing-errors';

interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status?: string;
}

export interface CreateRazorpayOrderInput {
  invoiceId: string;
  amount: Prisma.Decimal | string | number;
  currency: string;
  receipt: string;
}

export interface SafeRazorpayOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  providerStatus?: string;
}

@Injectable()
export class RazorpayService {
  constructor(private readonly config: ConfigService) {}

  async createOrder(
    input: CreateRazorpayOrderInput,
  ): Promise<SafeRazorpayOrder> {
    const credentials = this.getCredentials();
    const amount = this.toSmallestCurrencyUnit(input.amount, input.currency);
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${credentials.keyId}:${credentials.keySecret}`,
        ).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency: input.currency,
        receipt: input.receipt,
        notes: {
          invoiceId: input.invoiceId,
          environment: 'test',
        },
      }),
    });

    if (!response.ok) {
      throw razorpayApiFailure();
    }

    const order = (await response.json()) as RazorpayOrderResponse;
    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: credentials.keyId,
      providerStatus: order.status,
    };
  }

  verifyCheckoutSignature(input: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    const { keySecret } = this.getCredentials();
    const expected = this.hmac(
      `${input.orderId}|${input.paymentId}`,
      keySecret,
    );
    return this.safeCompare(expected, input.signature);
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const secret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET')?.trim();
    if (!secret) {
      throw missingRazorpayConfiguration();
    }
    const expected = this.hmac(rawBody, secret);
    return this.safeCompare(expected, signature);
  }

  getPublicKeyId(): string {
    return this.getCredentials().keyId;
  }

  toSmallestCurrencyUnit(
    amount: Prisma.Decimal | string | number,
    currency: string,
  ): number {
    const normalizedCurrency = currency.trim().toUpperCase();
    if (normalizedCurrency !== 'INR') {
      throw invalidCurrency('Razorpay order creation currently supports INR.');
    }

    const decimal = new Prisma.Decimal(amount);
    if (!decimal.isFinite() || decimal.lessThanOrEqualTo(0)) {
      throw invalidAmount('Invoice amount must be greater than zero.');
    }

    return decimal.mul(100).toDecimalPlaces(0).toNumber();
  }

  private getCredentials(): { keyId: string; keySecret: string } {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID')?.trim();
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET')?.trim();

    if (!keyId || !keySecret) {
      throw missingRazorpayConfiguration();
    }

    return { keyId, keySecret };
  }

  private hmac(data: string | Buffer, secret: string): string {
    return createHmac('sha256', secret).update(data).digest('hex');
  }

  private safeCompare(expected: string, actual: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual || '');
    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, actualBuffer);
  }
}
