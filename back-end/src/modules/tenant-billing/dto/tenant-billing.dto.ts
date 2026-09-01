import { IsOptional, IsString } from 'class-validator';

export class VerifyRazorpayPaymentDto {
  @IsString()
  orderId!: string;

  @IsString()
  paymentId!: string;

  @IsString()
  signature!: string;
}

export class RecordRazorpayFailureDto {
  @IsString()
  orderId!: string;

  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
