import { IsString, IsUUID, MaxLength } from 'class-validator';

export class TenantRazorpayVerifyDto {
  @IsUUID() invoiceId!: string;
  @IsString() @MaxLength(160) razorpay_order_id!: string;
  @IsString() @MaxLength(160) razorpay_payment_id!: string;
  @IsString() @MaxLength(255) razorpay_signature!: string;
}
