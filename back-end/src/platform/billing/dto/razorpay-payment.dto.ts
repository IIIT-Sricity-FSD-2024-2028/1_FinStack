import { IsString, MaxLength } from 'class-validator';

export class VerifyRazorpayPaymentDto {
  @IsString()
  @MaxLength(160)
  razorpay_order_id!: string;

  @IsString()
  @MaxLength(160)
  razorpay_payment_id!: string;

  @IsString()
  @MaxLength(256)
  razorpay_signature!: string;
}
