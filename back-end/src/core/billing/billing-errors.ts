import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

export function invoiceNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'INVOICE_NOT_FOUND',
    message: 'Invoice not found.',
  });
}

export function paymentNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'PAYMENT_NOT_FOUND',
    message: 'Payment not found.',
  });
}

export function subscriptionNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'SUBSCRIPTION_NOT_FOUND',
    message: 'Subscription not found.',
  });
}

export function invalidAmount(
  message = 'Invalid billing amount.',
): BadRequestException {
  return new BadRequestException({ code: 'INVALID_AMOUNT', message });
}

export function invalidCurrency(
  message = 'Unsupported currency.',
): BadRequestException {
  return new BadRequestException({ code: 'UNSUPPORTED_CURRENCY', message });
}

export function invalidPaymentTransition(message: string): BadRequestException {
  return new BadRequestException({
    code: 'INVALID_PAYMENT_STATUS_TRANSITION',
    message,
  });
}

export function missingRazorpayConfiguration(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: 'MISSING_RAZORPAY_CONFIGURATION',
    message: 'Razorpay test mode configuration is incomplete.',
  });
}

export function razorpayApiFailure(
  message = 'Razorpay API request failed.',
): BadGatewayException {
  return new BadGatewayException({
    code: 'RAZORPAY_API_FAILURE',
    message,
  });
}

export function paymentVerificationFailure(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'PAYMENT_VERIFICATION_FAILURE',
    message: 'Payment verification failed.',
  });
}

export function webhookSignatureFailure(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'WEBHOOK_SIGNATURE_FAILURE',
    message: 'Webhook signature verification failed.',
  });
}
