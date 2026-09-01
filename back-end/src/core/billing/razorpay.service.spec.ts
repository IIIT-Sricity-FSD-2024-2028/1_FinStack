import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { Prisma } from '@prisma/client';
import { RazorpayService } from './razorpay.service';

describe('RazorpayService', () => {
  let service: RazorpayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RazorpayService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'RAZORPAY_KEY_ID') return 'rzp_test_public';
              if (key === 'RAZORPAY_KEY_SECRET') return 'test_secret';
              if (key === 'RAZORPAY_WEBHOOK_SECRET') return 'webhook_secret';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(RazorpayService);
  });

  it('converts INR amounts to paise without floating point math', () => {
    expect(
      service.toSmallestCurrencyUnit(new Prisma.Decimal('2999.50'), 'INR'),
    ).toBe(299950);
  });

  it('verifies checkout signatures', () => {
    const signature = createHmac('sha256', 'test_secret')
      .update('order_123|pay_123')
      .digest('hex');

    expect(
      service.verifyCheckoutSignature({
        orderId: 'order_123',
        paymentId: 'pay_123',
        signature,
      }),
    ).toBe(true);
  });

  it('verifies webhook signatures from the raw body', () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
    const signature = createHmac('sha256', 'webhook_secret')
      .update(rawBody)
      .digest('hex');

    expect(service.verifyWebhookSignature(rawBody, signature)).toBe(true);
  });
});
